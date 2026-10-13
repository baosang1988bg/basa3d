import { createSupabaseUploadClient } from '@/lib/supabase/client';
import {
  CUSTOM_REQUEST_ATTACHMENT_BUCKET,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES_PER_REQUEST,
  formatUploadLimitMb,
  isUploadExtension,
} from '@/config/uploads';

export class UploadError extends Error {}

type UploadTarget = { path: string; token: string; contentType: string };
export type UploadSource = { file: Blob; fileName: string };

function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split('.').pop() ?? '';
}

function validate(source: UploadSource): string {
  const extension = extensionOf(source.fileName);
  if (!isUploadExtension(extension)) throw new UploadError('Chỉ chấp nhận ảnh (JPG, PNG, WEBP) hoặc file thiết kế 3D (.stl, .step, .stp, .obj, .3mf).');
  if (source.file.size === 0) throw new UploadError('File rỗng, vui lòng chọn file khác.');
  if (source.file.size > MAX_UPLOAD_BYTES) throw new UploadError(`Dung lượng file tối đa là ${formatUploadLimitMb()}.`);
  return extension;
}

/** One call to /upload-urls for the whole batch (the route is limited to 20 calls/hour/IP). */
async function requestTargets(sources: UploadSource[]): Promise<UploadTarget[]> {
  const files = sources.map((source) => ({ ext: validate(source), sizeBytes: source.file.size }));
  const response = await fetch('/api/public/custom-requests/upload-urls', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new UploadError(body?.message ?? 'Tải file lên thất bại, vui lòng thử lại.');
  const uploads = (body as { uploads?: UploadTarget[] } | null)?.uploads;
  if (!uploads || uploads.length !== sources.length) throw new UploadError('Tải file lên thất bại, vui lòng thử lại.');
  return uploads;
}

/**
 * storage-js sends a Blob as multipart and the PART's type comes from the Blob itself, not from
 * `contentType` — so the file is re-wrapped as a Blob of the server-returned type (no copy; Blob
 * parts are references). Otherwise .stl uploads would arrive as "" / application/vnd.ms-pki.stl and
 * be refused by the bucket's allowed_mime_types.
 */
async function putToTarget(source: UploadSource, target: UploadTarget): Promise<void> {
  const typed = new Blob([source.file], { type: target.contentType });
  const { error } = await createSupabaseUploadClient().storage
    .from(CUSTOM_REQUEST_ATTACHMENT_BUCKET)
    .uploadToSignedUrl(target.path, target.token, typed, { contentType: target.contentType });
  if (error) throw new UploadError('Tải file lên thất bại, vui lòng thử lại.');
}

/**
 * Phase 33 S2 (§6.2, T7/T14): browser → Supabase Storage directly (no Vercel 4.5MB body limit).
 *   1. POST /api/public/custom-requests/upload-urls → server-chosen path + signed token + contentType
 *   2. storage.uploadToSignedUrl(path, token, file, { contentType })
 * Returns the private storage path the existing flows already expect.
 */
export async function uploadCustomRequestFile(file: Blob, fileName: string): Promise<{ path: string }> {
  const [path] = await uploadCustomRequestFiles([{ file, fileName }]);
  return { path };
}

/** Phase 33 S6: several files, one token request, sequential uploads with a progress callback. */
export async function uploadCustomRequestFiles(sources: UploadSource[], onProgress?: (done: number, total: number) => void): Promise<string[]> {
  if (!sources.length) return [];
  if (sources.length > MAX_UPLOAD_FILES_PER_REQUEST) throw new UploadError(`Tối đa ${MAX_UPLOAD_FILES_PER_REQUEST} file mỗi lần.`);
  const targets = await requestTargets(sources);
  const paths: string[] = [];
  for (const [index, source] of sources.entries()) {
    await putToTarget(source, targets[index]);
    paths.push(targets[index].path);
    onProgress?.(index + 1, sources.length);
  }
  return paths;
}
