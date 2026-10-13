// Phase 33 (plan §12b D7): /bao-gia and its estimate endpoint stay OFF until the FDM model is
// calibrated (S0 PASS → fdm-v1). Server-only flag; set BAO_GIA_ENABLED=true to turn them on.
export function isBaoGiaEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.BAO_GIA_ENABLED === 'true';
}

/** Items per estimate request / per custom request (schema: custom_request_items.position 1–10). */
export const BAO_GIA_MAX_ITEMS = 10;
/** Sanity bound on client-reported extents (mm) — far above any printable part. */
export const BAO_GIA_MAX_EXTENT_MM = 2_000;
