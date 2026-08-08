import jsQR from 'jsqr';

/**
 * Read a QR code out of an image (data URL or object URL) and return its payload,
 * or null when no QR can be found.
 *
 * Used to sanity-check the payment QR codes an admin uploads, so a wrong image is
 * caught at upload time instead of silently failing to scan for every occupant.
 *
 * Caveat worth knowing at the call site: jsQR does no perspective correction, so a
 * genuine QR photographed at an angle will not decode. Treat a null result as
 * "could not read", not as proof the image is invalid.
 */
export async function decodeQrFromImage(src: string): Promise<string | null> {
  if (!src) return null;

  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch {
    return null;
  }
  if (!img.naturalWidth || !img.naturalHeight) return null;

  // Cap the working size: decoding a full-resolution phone photo costs a few hundred
  // milliseconds, and QR detection does not benefit from the extra pixels.
  const maxDim = 1000;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Flatten onto white: a transparent PNG would otherwise read as black-on-black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return code?.data ?? null;
}
