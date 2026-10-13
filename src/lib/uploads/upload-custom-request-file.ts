import { createSupabaseUploadClient } from '@/lib/supabase/client';
import { CUSTOM_REQUEST_ATTACHMENT_BUCKET, MAX_UPLOAD_BYTES, formatUploadLimitMb, isUploadExtension } from '@/config/uploads';

export class UploadError extends Error {}

type UploadTarget = { path: string; token: string; contentType: string };

/**
 * Phase 33 S2 (§6.2, T7/T14): browser → Supabase Storage directly (no Vercel 4.5MB body limit).
 *   1. POST /api/public/custom-requests/upload-urls → server-chosen path + signed token + contentType
 *   2. storage.uploadToSignedUrl(path, token, file, { contentType })
 * Returns the private storage path the existing flows already expect.
 *
 * storage-js sends a Blob as multipart and the PART's type comes from the Blob itself, not from
 * `contentType` — so the file is re-wrapped as a Blob of the server-returned type (no copy; Blob
 * parts are references). Otherwise .stl uploads would arrive as "" / application/vnd.ms-pki.stl and
 * be refused by the bucket's allowed_mime_types.
 */
export async function uploadCustomRequestFile(file: Blob, fileName: string): Promise<{ path: string }> {
  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  if (!isUploadExtension(extension)) throw new UploadError('Chỉ chấp nhận ảnh (JPG, PNG, WEBP) hoặc file thiết kế 3D (.stl, .step, .stp, .obj, .3mf).');
  if (file.size === 0) throw new UploadError('File rỗng, vui lòng chọn file khác.');
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(`Dung lượng file tối đa là ${formatUploadLimitMb()}.`);

  const response = await fetch('/api/public/custom-requests/upload-urls', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files: [{ ext: extension, sizeBytes: file.size }] }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new UploadError(body?.message ?? 'Tải file lên thất bại, vui lòng thử lại.');
  const target = (body as { uploads?: UploadTarget[] } | null)?.uploads?.[0];
  if (!target) throw new UploadError('Tải file lên thất bại, vui lòng thử lại.');

  const typed = new Blob([file], { type: target.contentType });
  const { error } = await createSupabaseUploadClient().storage
    .from(CUSTOM_REQUEST_ATTACHMENT_BUCKET)
    .uploadToSignedUrl(target.path, target.token, typed, { contentType: target.contentType });
  if (error) throw new UploadError('Tải file lên thất bại, vui lòng thử lại.');
  return { path: target.path };
}
