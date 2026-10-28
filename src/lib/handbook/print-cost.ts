// Phase 53 — "chi phí tự in tại nhà" calculator (pure, no React).
//
// B1 (phase-53 review): this is NOT a BaSa3D price. BaSa3D prices live in the database
// (pricing_configs, AGENTS.md rule #1) and are only shown by /bao-gia. Every number here is typed by
// the visitor; the defaults are illustrative examples. Never import pricing services or configs here.
//
// Rule #2: money is integer VND. Inputs are converted to integers (VND, milligrams, minutes, watts)
// before any arithmetic; the only rounding is one Math.round per line item.

export type PrintCostField = 'grams' | 'pricePerKg' | 'hours' | 'minutes' | 'powerW' | 'kwhPrice' | 'bufferPercent';
export type PrintCostInput = Record<PrintCostField, string>;

export const PRINT_COST_DEFAULTS: PrintCostInput = {
  grams: '50',
  pricePerKg: '300.000',
  hours: '2',
  minutes: '30',
  powerW: '150',
  kwhPrice: '3.000',
  bufferPercent: '10',
};

/** Inclusive bounds; anything outside is rejected rather than clamped. */
export const PRINT_COST_LIMITS = {
  grams: [0, 10_000],
  pricePerKg: [0, 20_000_000],
  hours: [0, 999],
  minutes: [0, 59],
  powerW: [0, 5_000],
  kwhPrice: [0, 20_000],
  bufferPercent: [0, 100],
} as const satisfies Record<PrintCostField, readonly [number, number]>;

export type PrintCostResult =
  | { ok: true; filamentVnd: number; electricityVnd: number; bufferVnd: number; totalVnd: number; energyWh: number }
  | { ok: false; errors: Partial<Record<PrintCostField, 'invalid' | 'out-of-range'>> };

/** VND amount: "300000", "300.000", "300 000" or "300,000" → 300000. No decimals (VND has none). */
export function parseVnd(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^(?:\d{1,3}(?:[.,\s]\d{3})+|\d{1,9})$/.test(trimmed)) return null;
  return Number(trimmed.replace(/[.,\s]/g, ''));
}

/** Plain integer (hours, minutes, watts, percent). */
export function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  return /^\d{1,6}$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Filament weight as shown by slicers ("48.62 g"; Vietnamese users may type "48,62") → milligrams.
 * Up to 2 decimals. Thousands separators are NOT accepted, so "1.250" is rejected instead of being
 * guessed as 1.25 g or 1250 g — a silent 1000× error is worse than asking the visitor to retype.
 */
export function parseGramsToMg(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 1000);
}

const roundDiv = (numerator: number, denominator: number) => Math.round(numerator / denominator);

export function computePrintCost(input: PrintCostInput): PrintCostResult {
  const errors: Partial<Record<PrintCostField, 'invalid' | 'out-of-range'>> = {};
  const read = (field: PrintCostField, parse: (raw: string) => number | null, scale = 1): number => {
    const value = parse(input[field]);
    if (value === null) {
      errors[field] = 'invalid';
      return 0;
    }
    const [min, max] = PRINT_COST_LIMITS[field];
    if (value < min * scale || value > max * scale) errors[field] = 'out-of-range';
    return value;
  };

  const mg = read('grams', parseGramsToMg, 1000);
  const pricePerKg = read('pricePerKg', parseVnd);
  const hours = read('hours', parseWholeNumber);
  const minutes = read('minutes', parseWholeNumber);
  const powerW = read('powerW', parseWholeNumber);
  const kwhPrice = read('kwhPrice', parseVnd);
  const bufferPercent = read('bufferPercent', parseWholeNumber);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const totalMinutes = hours * 60 + minutes;
  // mg × VND/kg ÷ 1e6 (mg per kg). Max 1e7 mg × 2e7 VND = 2e14 — well inside Number.MAX_SAFE_INTEGER.
  const filamentVnd = roundDiv(mg * pricePerKg, 1_000_000);
  // W × min × VND/kWh ÷ 60 000 (60 min/h × 1000 W/kW). Max 5e3 × 6e4 × 2e4 = 6e12 — safe.
  const electricityVnd = roundDiv(powerW * totalMinutes * kwhPrice, 60_000);
  const bufferVnd = roundDiv((filamentVnd + electricityVnd) * bufferPercent, 100);
  return {
    ok: true,
    filamentVnd,
    electricityVnd,
    bufferVnd,
    totalVnd: filamentVnd + electricityVnd + bufferVnd,
    energyWh: roundDiv(powerW * totalMinutes, 60),
  };
}

const vndFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
export const formatVnd = (vnd: number) => `${vndFormatter.format(vnd)} ₫`;
