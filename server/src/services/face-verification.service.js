/**
 * Face Verification Service
 * Uses face-api.js for face detection and comparison
 */

const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const path = require('path');

// Monkey-patch canvas for Node.js environment
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

/**
 * Load face-api.js models
 */
async function loadModels() {
  if (modelsLoaded) return;

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

/**
 * Get face descriptor (128-dimensional feature vector) from an image
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<Float32Array|null>} Face descriptor or null if no face detected
 */
async function getFaceDescriptor(base64Image) {
  await loadModels();
  
  const img = await base64ToImage(base64Image);
  
  // Detect face with landmarks and compute descriptor
  const detection = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();
  
  if (!detection) {
    return null;
  }
  
  return detection.descriptor;
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
 * Verify if two face images belong to the same person
 * @param {string} storedFaceImage - Base64 encoded stored/registered face image
 * @param {string} capturedFaceImage - Base64 encoded captured/verification face image
 * @param {number} threshold - Maximum distance to consider a match (default: 0.6)
 * @returns {Promise<{match: boolean, distance: number, error?: string}>}
 */
async function verifyFaces(storedFaceImage, capturedFaceImage, threshold = 0.6) {
  try {
    // Get face descriptors for both images
    const [storedDescriptor, capturedDescriptor] = await Promise.all([
      getFaceDescriptor(storedFaceImage),
      getFaceDescriptor(capturedFaceImage),
    ]);
    
    if (!storedDescriptor) {
      return {
        match: false,
        distance: -1,
        error: 'No face detected in registered image. Please update your registration photo.',
      };
    }
    
    if (!capturedDescriptor) {
      return {
        match: false,
        distance: -1,
        error: 'No face detected in captured image. Please ensure your face is clearly visible.',
      };
    }
    
    // Calculate distance between faces
    const distance = getFaceDistance(storedDescriptor, capturedDescriptor);
    const match = distance <= threshold;
    
    console.log(`Face verification: distance=${distance.toFixed(4)}, threshold=${threshold}, match=${match}`);
    
    return {
      match,
      distance,
    };
  } catch (error) {
    console.error('Face verification error:', error);
    return {
      match: false,
      distance: -1,
      error: error.message || 'Face verification failed',
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
  getFaceDescriptor,
  getFaceDistance,
  initializeFaceVerification,
};
