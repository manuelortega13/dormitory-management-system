/**
 * Downscale an image file to a max dimension and re-encode it as JPEG,
 * returning a base64 data URL. Keeps large phone photos small enough to upload.
 *
 * Shared by the gatepass extend flow and task-completion proof upload.
 * (Parent registration uses its own capture-based compression and is intentionally
 * not wired to this helper.)
 */
export function compressImage(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string); // fallback: original data URL
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Work out a sensible file extension for a download, from a data URL's mime type
 * or a plain URL's suffix. Falls back to png, which is what QR codes normally are.
 */
function imageExtension(src: string): string {
  const dataMatch = /^data:image\/([a-z0-9.+-]+)/i.exec(src);
  if (dataMatch) {
    return dataMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : dataMatch[1].toLowerCase();
  }
  const suffix = src.split('?')[0].split('#')[0].split('.').pop();
  return suffix && /^[a-z0-9]{2,5}$/i.test(suffix) ? suffix.toLowerCase() : 'png';
}

/**
 * Save an image to the user's device. Handles both base64 data URLs (how the
 * payment QR codes are stored in settings) and remote URLs — the latter are
 * fetched into a blob first, since a cross-origin href ignores `download`.
 */
export async function downloadImage(src: string, baseName: string): Promise<void> {
  if (!src) throw new Error('No image to download');

  let href = src;
  let objectUrl: string | null = null;

  if (!src.startsWith('data:')) {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Failed to fetch image (${response.status})`);
    objectUrl = URL.createObjectURL(await response.blob());
    href = objectUrl;
  }

  const link = document.createElement('a');
  link.href = href;
  link.download = `${baseName}.${imageExtension(src)}`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  if (objectUrl) URL.revokeObjectURL(objectUrl);
}
