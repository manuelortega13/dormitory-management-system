/**
 * Composes a payment QR into a labelled card image for download.
 *
 * The on-screen viewer shows the brand, account name and number around the QR, but a
 * downloaded bare image loses all of that — and "which account is this?" matters most
 * later, in a gallery, with no app around it for context. This draws the same
 * information into the saved file.
 */

export interface QrCardOptions {
  /** Source QR image (data URL or same-origin URL). */
  image: string;
  brand: 'gcash' | 'maya';
  /** Display name for the brand, e.g. "GCash". */
  label: string;
  accountName?: string;
  accountNumber?: string;
  /** Optional brand logo (same-origin path). Skipped silently if it fails to load. */
  logo?: string;
}

const BRAND_COLORS: Record<QrCardOptions['brand'], [string, string]> = {
  gcash: ['#0057ff', '#1f8bff'],
  maya: ['#00a850', '#35c46f'],
};

const CARD_WIDTH = 640;
const HEADER_HEIGHT = 104;
const PADDING = 40;
const QR_MAX = 440;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Returns a data URL for the composed card, or null when the QR image cannot be loaded.
 * Encodes as both PNG and JPEG and keeps whichever is smaller: a clean QR compresses far
 * better as PNG, while a photographed one is dramatically smaller as JPEG.
 */
export async function composeQrCard(options: QrCardOptions): Promise<string | null> {
  const qr = await loadImage(options.image);
  if (!qr || !qr.naturalWidth) return null;

  const logo = options.logo ? await loadImage(options.logo) : null;

  // Scale the QR to fit, preserving aspect ratio.
  const scale = Math.min(1, QR_MAX / Math.max(qr.naturalWidth, qr.naturalHeight));
  const qrW = Math.round(qr.naturalWidth * scale);
  const qrH = Math.round(qr.naturalHeight * scale);

  const hasName = !!options.accountName;
  const hasNumber = !!options.accountNumber;
  const footerHeight = 34 + (hasName ? 40 : 0) + (hasNumber ? 44 : 0);
  const height = HEADER_HEIGHT + PADDING + qrH + PADDING / 2 + footerHeight + PADDING / 2;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Card background.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Brand header. The colour stays here — a tint behind the QR itself can stop a
  // scanner reading it.
  const [from, to] = BRAND_COLORS[options.brand];
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, HEADER_HEIGHT);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, HEADER_HEIGHT);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 34px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  const labelWidth = ctx.measureText(options.label).width;
  const logoSize = 44;
  const gap = 14;
  const hasLogo = !!logo;
  const totalWidth = labelWidth + (hasLogo ? logoSize + gap : 0);
  const startX = (CARD_WIDTH - totalWidth) / 2;

  if (hasLogo) {
    const logoY = HEADER_HEIGHT / 2 - logoSize / 2;
    ctx.save();
    roundedRectPath(ctx, startX, logoY, logoSize, logoSize, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, startX + 3, logoY + 3, logoSize - 6, logoSize - 6);
    ctx.restore();
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillText(
    options.label,
    startX + (hasLogo ? logoSize + gap : 0) + labelWidth / 2,
    HEADER_HEIGHT / 2 + 1,
  );

  // QR on plain white.
  const qrX = (CARD_WIDTH - qrW) / 2;
  const qrY = HEADER_HEIGHT + PADDING;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qrX - 8, qrY - 8, qrW + 16, qrH + 16);
  ctx.drawImage(qr, qrX, qrY, qrW, qrH);

  // Account details.
  let y = qrY + qrH + PADDING / 2 + 18;
  if (hasName) {
    ctx.fillStyle = '#1e293b';
    ctx.font = '600 28px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(options.accountName as string, CARD_WIDTH / 2, y);
    y += 40;
  }
  if (hasNumber) {
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 32px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(options.accountNumber as string, CARD_WIDTH / 2, y);
    y += 44;
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Scan with your ${options.label} app`, CARD_WIDTH / 2, y);

  // Keep whichever encoding is smaller — see the doc comment above.
  const png = canvas.toDataURL('image/png');
  const jpeg = canvas.toDataURL('image/jpeg', 0.92);
  return jpeg.length < png.length ? jpeg : png;
}
