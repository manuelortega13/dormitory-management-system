/**
 * Face verification error codes returned by the backend, and the client-side
 * capture quality checks that keep obviously unusable frames from being submitted.
 *
 * The server is always the authority — these checks only save the parent a
 * round-trip and a confusing rejection. Mirrors
 * `server/src/services/face-verification.service.js`.
 */

/** Codes the API returns when a photo, rather than the person, was the problem. */
export const FACE_ERROR_CODES = [
  'no_face',
  'multiple_faces',
  'face_too_small',
  'too_blurry',
  'low_confidence',
  'bad_image',
] as const;

/**
 * Widest edge of a captured frame. The face crop is what gets compared, so a
 * bigger frame adds upload size without adding recognition detail.
 */
export const CAPTURE_MAX_WIDTH = 1280;

/** JPEG quality for captured frames. */
export const CAPTURE_QUALITY = 0.85;

/**
 * Minimum variance-of-Laplacian for a frame to be worth submitting. Measured at
 * full frame scale, well below the server's own per-face limit so the server
 * stays the real gate — this only catches badly blurred or very dark frames.
 */
export const MIN_CAPTURE_SHARPNESS = 60;

/**
 * Variance of the Laplacian over the frame — higher means more edge detail.
 * Low values mean motion blur, an out-of-focus camera, or near-darkness.
 */
export function frameSharpness(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): number {
  if (width < 3 || height < 3) return 0;

  const { data } = context.getImageData(0, 0, width, height);
  const gray = new Float64Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - width] - gray[idx + width];
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
 * Draw the current video frame to the canvas, capped at CAPTURE_MAX_WIDTH, and
 * return it as a JPEG data URL — or an error message if the frame is unusable.
 */
export function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): { image: string } | { error: string } {
  if (!video.videoWidth || !video.videoHeight) {
    return { error: 'The camera is not ready yet. Please wait a moment and try again.' };
  }

  const scale = Math.min(1, CAPTURE_MAX_WIDTH / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    return { error: 'Could not read the camera image. Please try again.' };
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (frameSharpness(context, canvas.width, canvas.height) < MIN_CAPTURE_SHARPNESS) {
    return {
      error: 'The photo is too blurry or too dark. Hold steady in good light and try again.',
    };
  }

  return { image: canvas.toDataURL('image/jpeg', CAPTURE_QUALITY) };
}
