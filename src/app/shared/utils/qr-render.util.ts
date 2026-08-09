import QRCode from 'qrcode';

/**
 * Payment QR codes are stored in one of two forms in payment_settings:
 *
 *  - the decoded payload (e.g. "00020101021228…"), written when the uploaded image
 *    could be read. A few hundred bytes, and re-rendered crisply at any size.
 *  - a `data:` image URL, the legacy form and the fallback for uploads that could not
 *    be decoded (jsQR has no perspective correction, so an angled photo of a valid QR
 *    fails to read).
 *
 * These helpers let the two live side by side without a migration.
 */

/** True when the stored value is a decoded payload rather than an image. */
export function isQrPayload(value: string | null | undefined): boolean {
  return !!value && !value.startsWith('data:');
}

/**
 * Render a decoded payload to a PNG data URL.
 *
 * Rendered locally rather than through an external QR service: that would send the
 * payment payload to a third party on every view, and break the payment dialog whenever
 * that service is unavailable.
 */
export async function renderQrToDataUrl(payload: string, size = 512): Promise<string | null> {
  if (!payload) return null;
  try {
    return await QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      // Pure black on white: scanners want maximum contrast, and this also keeps the
      // PNG tiny because the image is only two colours.
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch {
    return null;
  }
}

/**
 * Resolve a stored setting value to something an <img> can display: payloads are
 * rendered, images are passed through, empty stays empty.
 */
export async function resolveQrImage(
  value: string | null | undefined,
  size = 512,
): Promise<string> {
  if (!value) return '';
  return isQrPayload(value) ? ((await renderQrToDataUrl(value, size)) ?? '') : value;
}
