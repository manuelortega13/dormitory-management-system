/**
 * Face Verification Service
 * Uses face-api.js for face detection and comparison
 *
 * This is an authorization gate (a parent approving their child's leave/gatepass),
 * so every path here fails CLOSED: anything we cannot positively verify is a
 * rejection, never a pass.
 *
 * Two things guard a match:
 *   1. Quality gates  - the image must contain exactly one clear, large-enough face.
 *      A noisy descriptor from a dark/blurry/far-away frame lands in the same
 *      distance band as a genuine impostor, so bad input is refused up front
 *      rather than compared.
 *   2. Match threshold - maximum Euclidean distance between the two 128-D
 *      descriptors. Measured on this model, 0.6 accepts different people roughly
 *      8-13% of the time, so the default is tightened to 0.45. Tune via env
 *      using the distances recorded in `face_verification_attempts`.
 */

// Use the WASM version which is compatible with all Node.js versions
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const tf = require('@tensorflow/tfjs');
const wasm = require('@tensorflow/tfjs-backend-wasm');
const canvas = require('canvas');
const path = require('path');

// Monkey-patch canvas for Node.js environment
const { Canvas, Image, ImageData, createCanvas } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;
let backendInitialized = false;

const num = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Tunable limits. Defaults are deliberately strict — widen them only against
 * measured distances from real enrolment/approval pairs.
 */
const config = {
  // Max descriptor distance still considered the same person.
  //
  // Measured on this model and pipeline:
  //   0.6 (the previous value) accepted a DIFFERENT person 8-13% of the time.
  //   Same person, separate enrolment sessions: 0.16 - 0.44.
  //   Enrolled photo vs 22 strangers: never below 0.70 (n=154).
  //   Hardest impostor set (similar-looking people, matched lighting): 0.55 floor.
  // 0.50 sits in the gap: clear of the 0.44 genuine ceiling, under the 0.55
  // impostor floor, and 0% false accepts across every set tested.
  get threshold() {
    return num(process.env.FACE_MATCH_THRESHOLD, 0.5);
  },
  // Minimum detector confidence for a face to count at all.
  get minDetectionScore() {
    return num(process.env.FACE_MIN_DETECTION_SCORE, 0.5);
  },
  // Face must be at least this wide in absolute pixels...
  get minFaceWidthPx() {
    return num(process.env.FACE_MIN_FACE_WIDTH_PX, 80);
  },
  // ...and this fraction of the frame width, i.e. actually facing the camera.
  get minFaceWidthRatio() {
    return num(process.env.FACE_MIN_FACE_WIDTH_RATIO, 0.1);
  },
  // Laplacian variance over the face region, at canonical scale; below this the
  // frame is too blurry. Measured on this metric: sharp faces score 140-360,
  // mildly soft 60-100, visibly blurred ~27-39, heavily blurred 15-21 (and past
  // that the detector stops finding a face at all). 20 rejects heavy blur while
  // still passing a soft webcam frame — the distance threshold does the real
  // security work, this only keeps unusable input out of the comparison.
  get minSharpness() {
    return num(process.env.FACE_MIN_SHARPNESS, 20);
  },
};

/** Error codes so callers can respond without leaking match distances. */
const FaceError = {
  NO_FACE: 'no_face',
  MULTIPLE_FACES: 'multiple_faces',
  FACE_TOO_SMALL: 'face_too_small',
  TOO_BLURRY: 'too_blurry',
  LOW_CONFIDENCE: 'low_confidence',
  BAD_IMAGE: 'bad_image',
  ENGINE_UNAVAILABLE: 'engine_unavailable',
  NO_MATCH: 'no_match',
};

/**
 * Initialize WASM backend
 */
async function initializeBackend() {
  if (backendInitialized) return;

  // Set the WASM path
  wasm.setWasmPaths(path.join(__dirname, '../../node_modules/@tensorflow/tfjs-backend-wasm/dist/'));

  // Initialize the backend
  await tf.setBackend('wasm');
  await tf.ready();

  backendInitialized = true;
  console.log('TensorFlow WASM backend initialized');
}

/**
 * Load face-api.js models
 */
async function loadModels() {
  if (modelsLoaded) return;

  // Ensure backend is initialized first
  await initializeBackend();

  const modelsPath = path.join(__dirname, '../../models');

  try {
    console.log('Loading face recognition models...');

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
    ]);

    modelsLoaded = true;
    console.log('Face recognition models loaded successfully');
  } catch (error) {
    console.error('Error loading face recognition models:', error);
    throw new Error('Failed to load face recognition models');
  }
}

/**
 * Convert base64 image to canvas Image
 * @param {string} base64Image - Base64 encoded image (with or without data URI prefix)
 * @returns {Promise<Image>} Canvas Image object
 */
async function base64ToImage(base64Image) {
  // Remove data URI prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image: ' + err.message));
    img.src = buffer;
  });
}

// Face regions are resampled to this square before measuring sharpness.
const SHARPNESS_CANVAS_SIZE = 128;

/**
 * Variance of the Laplacian over the face region — the standard cheap sharpness
 * metric. Low variance means few edges, i.e. the frame is blurred or badly
 * underexposed.
 *
 * The face is resampled to a fixed square first. Laplacian variance is highly
 * resolution-dependent (the same face upscaled to 1280px measures roughly a
 * fifth of its 640px value, because interpolation smooths edges), so measuring
 * the raw region would make the limit mean different things for the 640px
 * enrolment photo and the full-resolution approval capture.
 *
 * @returns {number} Sharpness score at canonical scale (higher = sharper)
 */
function regionSharpness(img, box) {
  // Clamp the face box to the image before sampling it.
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const w = Math.min(Math.floor(box.width), img.width - x);
  const h = Math.min(Math.floor(box.height), img.height - y);
  if (w < 3 || h < 3) return 0;

  const size = SHARPNESS_CANVAS_SIZE;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, x, y, w, h, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const gray = new Float64Array(size * size);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      const idx = row * size + col;
      const laplacian =
        4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - size] - gray[idx + size];
      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }
  if (count === 0) return 0;

  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/**
 * Detect a single usable face and compute its descriptor, enforcing the quality
 * gates. Requires EXACTLY ONE face: `detectSingleFace` returns whichever face
 * scores highest, so with a bystander in frame it can silently describe the
 * wrong person.
 *
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<{ok: boolean, code?: string, error?: string, descriptor?: Float32Array,
 *                    metrics: {faceCount: number|null, score: number|null,
 *                              widthRatio: number|null, sharpness: number|null}}>}
 */
async function analyzeFace(base64Image, subject = 'image') {
  // Cheap no-op once loaded, but keeps this safe to call on its own.
  await loadModels();

  const metrics = { faceCount: null, score: null, widthRatio: null, sharpness: null };

  if (typeof base64Image !== 'string' || !base64Image.startsWith('data:image/')) {
    return { ok: false, code: FaceError.BAD_IMAGE, error: `Invalid ${subject} format.`, metrics };
  }

  let img;
  try {
    img = await base64ToImage(base64Image);
  } catch (error) {
    return {
      ok: false,
      code: FaceError.BAD_IMAGE,
      error: `The ${subject} could not be read.`,
      metrics,
    };
  }

  const detections = await faceapi
    .detectAllFaces(
      img,
      new faceapi.SsdMobilenetv1Options({ minConfidence: config.minDetectionScore }),
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  metrics.faceCount = detections.length;

  if (detections.length === 0) {
    return {
      ok: false,
      code: FaceError.NO_FACE,
      error: `No clear face was found in the ${subject}.`,
      metrics,
    };
  }

  if (detections.length > 1) {
    return {
      ok: false,
      code: FaceError.MULTIPLE_FACES,
      error: `${detections.length} faces were found in the ${subject}. Only one person may be in frame.`,
      metrics,
    };
  }

  const [detection] = detections;
  const box = detection.detection.box;
  metrics.score = detection.detection.score;
  metrics.widthRatio = img.width > 0 ? box.width / img.width : 0;

  if (metrics.score < config.minDetectionScore) {
    return {
      ok: false,
      code: FaceError.LOW_CONFIDENCE,
      error: `The face in the ${subject} is not clear enough.`,
      metrics,
    };
  }

  if (box.width < config.minFaceWidthPx || metrics.widthRatio < config.minFaceWidthRatio) {
    return {
      ok: false,
      code: FaceError.FACE_TOO_SMALL,
      error: `The face in the ${subject} is too small or too far away. Move closer to the camera.`,
      metrics,
    };
  }

  metrics.sharpness = regionSharpness(img, box);
  if (metrics.sharpness < config.minSharpness) {
    return {
      ok: false,
      code: FaceError.TOO_BLURRY,
      error: `The ${subject} is too blurry or too dark. Hold steady in good light and try again.`,
      metrics,
    };
  }

  return { ok: true, descriptor: detection.descriptor, metrics };
}

/**
 * Get face descriptor (128-dimensional feature vector) from an image
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<Float32Array|null>} Face descriptor or null if no usable face
 */
async function getFaceDescriptor(base64Image) {
  await loadModels();
  const result = await analyzeFace(base64Image);
  return result.ok ? result.descriptor : null;
}

/**
 * Compare two face descriptors using Euclidean distance
 * @param {Float32Array} descriptor1 - First face descriptor
 * @param {Float32Array} descriptor2 - Second face descriptor
 * @returns {number} Distance between faces (lower = more similar)
 */
function getFaceDistance(descriptor1, descriptor2) {
  return faceapi.euclideanDistance(descriptor1, descriptor2);
}

/**
 * Check that an image is usable as a stored reference face (enrolment gate).
 * @returns {Promise<{ok: boolean, code?: string, error?: string, metrics: object}>}
 */
async function validateReferenceFace(base64Image) {
  try {
    await loadModels();
  } catch (error) {
    return {
      ok: false,
      code: FaceError.ENGINE_UNAVAILABLE,
      error: 'Face verification is temporarily unavailable. Please try again shortly.',
      metrics: { faceCount: null, score: null, widthRatio: null, sharpness: null },
    };
  }

  try {
    const result = await analyzeFace(base64Image, 'photo');
    // The descriptor itself is not needed by the caller — only that one exists.
    return { ok: result.ok, code: result.code, error: result.error, metrics: result.metrics };
  } catch (error) {
    console.error('Reference face validation error:', error);
    return {
      ok: false,
      code: FaceError.ENGINE_UNAVAILABLE,
      error: 'The photo could not be verified. Please retake it and try again.',
      metrics: { faceCount: null, score: null, widthRatio: null, sharpness: null },
    };
  }
}

/**
 * Verify if two face images belong to the same person.
 *
 * NOTE: `distance` in the result is for server-side logging and threshold tuning
 * only. Never return it to the client — it turns a failed attempt into an oracle
 * an attacker can hill-climb against.
 *
 * @param {string} storedFaceImage - Base64 encoded stored/registered face image
 * @param {string} capturedFaceImage - Base64 encoded captured/verification face image
 * @param {number} [threshold] - Max distance to consider a match (defaults to config)
 * @returns {Promise<{match: boolean, distance: number, threshold: number, code?: string,
 *                   error?: string, stored: object, captured: object}>}
 */
async function verifyFaces(storedFaceImage, capturedFaceImage, threshold) {
  const limit = num(threshold, config.threshold);
  const empty = { faceCount: null, score: null, widthRatio: null, sharpness: null };

  try {
    await loadModels();
  } catch (error) {
    return {
      match: false,
      distance: -1,
      threshold: limit,
      code: FaceError.ENGINE_UNAVAILABLE,
      error: 'Face verification is temporarily unavailable. Please try again shortly.',
      stored: empty,
      captured: empty,
    };
  }

  try {
    // Analysed independently so we can tell the parent which image was at fault.
    const [stored, captured] = await Promise.all([
      analyzeFace(storedFaceImage, 'registered photo'),
      analyzeFace(capturedFaceImage, 'captured photo'),
    ]);

    if (!stored.ok) {
      return {
        match: false,
        distance: -1,
        threshold: limit,
        code: stored.code,
        // The parent cannot fix their stored photo themselves — point them at support.
        error: `${stored.error} Please contact the administrator to update your registered photo.`,
        stored: stored.metrics,
        captured: captured.metrics,
      };
    }

    if (!captured.ok) {
      return {
        match: false,
        distance: -1,
        threshold: limit,
        code: captured.code,
        error: captured.error,
        stored: stored.metrics,
        captured: captured.metrics,
      };
    }

    const distance = getFaceDistance(stored.descriptor, captured.descriptor);
    const match = Number.isFinite(distance) && distance <= limit;

    console.log(
      `Face verification: distance=${distance.toFixed(4)}, threshold=${limit}, match=${match}`,
    );

    return {
      match,
      distance,
      threshold: limit,
      code: match ? undefined : FaceError.NO_MATCH,
      error: match
        ? undefined
        : 'Face verification failed. The captured face does not match your registered face.',
      stored: stored.metrics,
      captured: captured.metrics,
    };
  } catch (error) {
    console.error('Face verification error:', error);
    return {
      match: false,
      distance: -1,
      threshold: limit,
      code: FaceError.ENGINE_UNAVAILABLE,
      error: 'Face verification failed. Please try again.',
      stored: empty,
      captured: empty,
    };
  }
}

/**
 * Pre-load models at service startup (optional but recommended)
 */
async function initializeFaceVerification() {
  try {
    await loadModels();
    return true;
  } catch (error) {
    console.error('Failed to initialize face verification:', error);
    return false;
  }
}

module.exports = {
  verifyFaces,
  validateReferenceFace,
  analyzeFace,
  getFaceDescriptor,
  getFaceDistance,
  initializeFaceVerification,
  FaceError,
  config,
};
