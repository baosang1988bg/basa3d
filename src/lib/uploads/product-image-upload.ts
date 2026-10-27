// Phase 52 P3 (exec-plan D11) — browser side of product image upload:
//   1. shrink each photo (long edge ≤ 1600 px, WEBP ~0.85; JPEG where the browser can't encode WEBP)
//   2. ask the server for signed upload targets (one call for the batch)
//   3. PUT each file straight to Supabase Storage (no Server Action / function body limit)
//   4. register the uploaded paths (server re-checks storage.objects before writing product_images)
// Client-only: imports server actions as RPC stubs, never services.
import { createSupabaseUploadClient } from '@/lib/supabase/client';
import {
  createProductImageUploadTargetsAction,
  registerProductImagesAction,
} from '@/app/admin/(protected)/products/new/actions';
import { fitWithin } from './image-fit';

export const PRODUCT_IMAGE_MAX_EDGE = 1600;
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class ProductImageUploadError extends Error {}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Returns a smaller WEBP/JPEG; falls back to the original when it can't decode or doesn't shrink. */
export async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = fitWithin(bitmap.width, bitmap.height, PRODUCT_IMAGE_MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    let blob = await canvasToBlob(canvas, 'image/webp', 0.85);
    // Safari < 17 silently returns PNG for an unsupported type.
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
    if (blob && ALLOWED.has(blob.type) && (blob.size < file.size || !ALLOWED.has(file.type))) return blob;
  } catch {
    // Undecodable here (e.g. HEIC on Chrome) — the checks below decide.
  }
  if (!ALLOWED.has(file.type)) throw new ProductImageUploadError(`"${file.name}" không phải ảnh JPG/PNG/WEBP.`);
  return file;
}

export type PreparedImage = { key: string; blob: Blob };

/**
 * Uploads `images` for `productId` and registers them, with `coverKey` as the cover.
 * Returns the storage path for each key so a retry can skip what already went through.
 */
export async function uploadProductImages(
  productId: string,
  images: PreparedImage[],
  coverKey: string | null,
  alreadyUploaded: Record<string, string> = {},
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, string>> {
  const paths: Record<string, string> = { ...alreadyUploaded };
  const pending = images.filter((image) => !paths[image.key]);
  for (const image of pending) {
    if (image.blob.size > MAX_BYTES) throw new ProductImageUploadError('Có ảnh vẫn lớn hơn 5 MB sau khi nén. Hãy chọn ảnh khác.');
  }
  if (pending.length) {
    const targets = await createProductImageUploadTargetsAction({
      productId,
      files: pending.map((image) => ({ contentType: image.blob.type, sizeBytes: image.blob.size })),
    });
    if (!targets.ok) throw new ProductImageUploadError(targets.message);
    const storage = createSupabaseUploadClient().storage.from('product-images');
    let done = images.length - pending.length;
    onProgress?.(done, images.length);
    for (const [index, image] of pending.entries()) {
      const target = targets.data[index];
      const typed = new Blob([image.blob], { type: target.contentType });
      const { error } = await storage.uploadToSignedUrl(target.path, target.token, typed, { contentType: target.contentType });
      if (error) throw new ProductImageUploadError('Tải ảnh lên thất bại. Kiểm tra mạng rồi thử lại.');
      paths[image.key] = target.path;
      done += 1;
      onProgress?.(done, images.length);
    }
  }
  const storagePaths = images.map((image) => paths[image.key]).filter(Boolean);
  if (!storagePaths.length) return paths;
  const registered = await registerProductImagesAction({
    productId,
    storagePaths,
    coverPath: coverKey && paths[coverKey] ? paths[coverKey] : null,
  });
  if (!registered.ok) throw new ProductImageUploadError(registered.message);
  return paths;
}
