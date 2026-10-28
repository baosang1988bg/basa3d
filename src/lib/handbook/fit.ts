// Phase 53 — Fit & clearance calculator (pure, no React). Imported by the FitCalculator client island
// and by tests. All arithmetic is done in integer micrometres so 3.4 + 2 × 0.15 never prints as
// 3.6999999. Clearance values come from HANDBOOK_TOLERANCES (passed in, never duplicated here).

export type FitMode = 'shaft-known' | 'hole-known';

/** The trimmed shape the server hands to the island — only what the calculator needs. */
export type FitOption = { id: string; fit: string; clearanceMm: [number, number] };

export const FIT_DIAMETER_MIN_MM = 0.5;
export const FIT_DIAMETER_MAX_MM = 500;

export type FitResult =
  | {
      ok: true;
      /** Recommended CAD diameter of the part you are designing, [min, max] in µm. */
      targetUm: [number, number];
      /** Clearance per side in µm — also the slicer hole-compensation range, if used instead. */
      clearanceUm: [number, number];
    }
  | { ok: false; reason: 'empty' | 'invalid' | 'out-of-range' | 'no-room' };

const toUm = (mm: number) => Math.round(mm * 1000);

/**
 * Parses a user-typed diameter. Accepts "3.5", "3,5" (Vietnamese decimal comma) and surrounding
 * spaces; rejects anything else instead of guessing (rule #6: validate at the boundary).
 */
export function parseDiameterMm(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!/^\d{1,3}(?:\.\d{1,3})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * shaft-known: you have a shaft/pin/bolt of `diameterMm` → hole to draw = d + 2 × clearance.
 * hole-known:  you have a hole of `diameterMm`          → shaft to draw = d − 2 × clearance.
 * Clearance is per side, so the diameter changes by twice the value.
 */
export function computeFit(mode: FitMode, raw: string, option: FitOption): FitResult {
  if (!raw.trim()) return { ok: false, reason: 'empty' };
  const diameterMm = parseDiameterMm(raw);
  if (diameterMm === null) return { ok: false, reason: 'invalid' };
  if (diameterMm < FIT_DIAMETER_MIN_MM || diameterMm > FIT_DIAMETER_MAX_MM) return { ok: false, reason: 'out-of-range' };

  const d = toUm(diameterMm);
  const [cMin, cMax] = [toUm(option.clearanceMm[0]), toUm(option.clearanceMm[1])];
  const targetUm: [number, number] = mode === 'shaft-known' ? [d + 2 * cMin, d + 2 * cMax] : [d - 2 * cMax, d - 2 * cMin];
  if (targetUm[0] <= 0) return { ok: false, reason: 'no-room' };
  return { ok: true, targetUm, clearanceUm: [cMin, cMax] };
}

/** 3400 → "3.40" (two decimals: finer than any FDM printer can resolve, matches the table). */
export function formatUm(um: number): string {
  return (um / 1000).toFixed(2);
}
