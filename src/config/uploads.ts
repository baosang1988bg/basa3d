// Phase 33 S2 (plan §6.2, T7): the single place for custom-request upload limits. Shared by the
// server (upload-urls route, inspectUploadedObject, orphan cleanup) and the browser uploader
// (client-side UX checks only — the server and the bucket's file_size_limit are the authority).
// Pure constants, no server-only imports, so Client Components may import this file.

export const CUSTOM_REQUEST_ATTACHMENT_BUCKET = 'custom-request-attachments';

/** 50MB — Supabase Free per-file ceiling; must match the bucket's file_size_limit
 * (migration 20261015000001_custom_request_items.sql). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Files per `POST /api/public/custom-requests/upload-urls` call. */
export const MAX_UPLOAD_FILES_PER_REQUEST = 10;

// Content-Type is resolved from this hardcoded extension map, NEVER from the client-supplied
// `file.type` (phase-6.md decision #1): the route is public/anonymous, and .stl/.step/.obj/.3mf have
// no MIME type a browser reports reliably (Windows says application/vnd.ms-pki.stl for .stl), so
// trusting the client would let the bucket become a mislabeled anonymous file host. Every value
// here must appear in the bucket's allowed_mime_types.
export const CONTENT_TYPE_BY_EXTENSION = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  stl: 'model/stl', step: 'model/step', stp: 'model/step', obj: 'application/octet-stream', '3mf': 'model/3mf',
} as const satisfies Record<string, string>;

export type UploadExtension = keyof typeof CONTENT_TYPE_BY_EXTENSION;
export const UPLOAD_EXTENSIONS = Object.keys(CONTENT_TYPE_BY_EXTENSION) as [UploadExtension, ...UploadExtension[]];

export function isUploadExtension(value: string): value is UploadExtension {
  return Object.prototype.hasOwnProperty.call(CONTENT_TYPE_BY_EXTENSION, value);
}

export function formatUploadLimitMb(bytes = MAX_UPLOAD_BYTES): string {
  return `${Math.floor(bytes / (1024 * 1024))}MB`;
}
