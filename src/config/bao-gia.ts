// Phase 33 (plan §12b D7): /bao-gia, its nav link and its APIs stay OFF until the FDM model is
// calibrated (S0 PASS → fdm-v1). ONE flag: NEXT_PUBLIC_BAO_GIA_ENABLED=true. It is NEXT_PUBLIC_ so
// the storefront header can hide the link; Next inlines it into client bundles at build time, so
// changing it needs a redeploy. Server code reads it at runtime through isBaoGiaEnabled().
export function isBaoGiaEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_BAO_GIA_ENABLED === 'true';
}

/** Client-side copy (static dot access so Next can inline it — see src/lib/supabase/client.ts). */
export const BAO_GIA_ENABLED_IN_BROWSER = process.env.NEXT_PUBLIC_BAO_GIA_ENABLED === 'true';

/** Items per estimate request / per custom request (DB: custom_request_items_position_range 1–50).
 * Raised from 10 (Owner, 2026-10-13): 10 made customers split one order. Uploads still go in
 * batches of MAX_UPLOAD_FILES_PER_REQUEST signed URLs per call. */
export const BAO_GIA_MAX_ITEMS = 50;
/** Sanity bound on client-reported extents (mm) — far above any printable part. */
export const BAO_GIA_MAX_EXTENT_MM = 2_000;
/** Above this many triangles the browser shows sizes only, no 3D preview (mobile memory). */
export const PREVIEW_MAX_TRIANGLES = 1_500_000;
/** Shown on the hero (O4 — same promise as /custom-print). */
export const BAO_GIA_RESPONSE_TIME_TEXT = 'trong 2 giờ làm việc';
