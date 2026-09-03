// Phase 13: Smart AMS multi-color waste estimator (phase-13.md decision #2).
// Formula: W_total_waste = W_net * waste_ratio. Pure calculator — no DB access — mirrors
// pricing.service's "pure function, callers resolve everything else" shape.

export type WasteRatioPreset = 'LOW' | 'STANDARD' | 'HIGH' | 'CUSTOM';

/** Default preset selected purely from color count, per phase-13.md decision #2:
 * 1 color = 5% (bavia/brim/support nhẹ), 2-4 colors = 20%, >=5 colors = 35% (e.g. Ace Snail, 7 màu). */
export function defaultWasteRatioPctForColorCount(colorCount: number): number {
  if (colorCount <= 1) return 5;
  if (colorCount <= 4) return 20;
  return 35;
}

/** Staff quick-select override presets (independent of the color-count default above) — 15/30/50%,
 * or CUSTOM to type an exact gram value directly (bypassing the ratio entirely). */
export const WASTE_RATIO_OVERRIDE_PRESETS: Record<Exclude<WasteRatioPreset, 'CUSTOM'>, number> = {
  LOW: 15,
  STANDARD: 30,
  HIGH: 50,
};

export type WasteEstimateInput = {
  /** Net (model-only) weight in grams, per filament/color. */
  netWeightGrams: number;
  /** 0-100 (e.g. 20 means 20%). Pass the color-count default, an override preset, or a custom value
   * — this function does not decide which one, callers do (staff can override before pricing). */
  wasteRatioPct: number;
};

export type WasteEstimate = {
  netWeightGrams: number;
  wasteRatioPct: number;
  wasteWeightGrams: number;
  totalWeightGrams: number;
};

export function estimateWaste(input: WasteEstimateInput): WasteEstimate {
  if (!Number.isFinite(input.netWeightGrams) || input.netWeightGrams < 0) {
    throw new RangeError('netWeightGrams must be a finite, non-negative number.');
  }
  if (!Number.isFinite(input.wasteRatioPct) || input.wasteRatioPct < 0) {
    throw new RangeError('wasteRatioPct must be a finite, non-negative number.');
  }
  const wasteWeightGrams = input.netWeightGrams * (input.wasteRatioPct / 100);
  return {
    netWeightGrams: input.netWeightGrams,
    wasteRatioPct: input.wasteRatioPct,
    wasteWeightGrams,
    totalWeightGrams: input.netWeightGrams + wasteWeightGrams,
  };
}

/** Convenience wrapper: applies the color-count default ratio directly. */
export function estimateWasteWithDefaultRatio(netWeightGrams: number, colorCount: number): WasteEstimate {
  return estimateWaste({ netWeightGrams, wasteRatioPct: defaultWasteRatioPctForColorCount(colorCount) });
}

/** A custom gram override skips the ratio math entirely — total is just netWeightGrams + extraGrams,
 * but the ratio is still back-computed (informational only) so the UI can show an equivalent %. */
export function estimateWasteWithCustomGrams(netWeightGrams: number, extraGrams: number): WasteEstimate {
  if (!Number.isFinite(extraGrams) || extraGrams < 0) throw new RangeError('extraGrams must be a finite, non-negative number.');
  const wasteRatioPct = netWeightGrams > 0 ? (extraGrams / netWeightGrams) * 100 : 0;
  return {
    netWeightGrams,
    wasteRatioPct,
    wasteWeightGrams: extraGrams,
    totalWeightGrams: netWeightGrams + extraGrams,
  };
}
