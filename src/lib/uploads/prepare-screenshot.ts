// ADR-0039 (browser only): re-encode a screenshot before upload.
// - Drops EXIF/metadata (a phone photo can carry GPS) — the image goes to storage AND a third-party AI.
// - Caps the long side so a 4K photo becomes a few hundred KB (faster upload, cheaper vision call),
//   while keeping phone screenshots (≈1200×2600) sharp enough to read small text.
// - Lets iPhone HEIC photos through when the browser can decode them (output is always JPEG).
// Falls back to the original file when the browser cannot decode/encode; the server re-checks type
// and size either way.

export const SCREENSHOT_MAX_LONG_SIDE = 2_600;
const JPEG_QUALITY = 0.9;

export type PreparedScreenshot = { blob: Blob; fileName: string; mimeType: string };

const PASSTHROUGH_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function prepareScreenshot(file: File): Promise<PreparedScreenshot | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, SCREENSHOT_MAX_LONG_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');
    context.fillStyle = '#ffffff'; // transparent PNG areas would otherwise turn black in JPEG
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('encode failed');
    return { blob, fileName: 'makerworld-screenshot.jpg', mimeType: 'image/jpeg' };
  } catch {
    const extension = PASSTHROUGH_TYPES[file.type];
    return extension ? { blob: file, fileName: `makerworld-screenshot.${extension}`, mimeType: file.type } : null;
  }
}
