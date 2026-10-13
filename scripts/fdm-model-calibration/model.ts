// Phase 33 S0 — the §5.1/§5.2 FDM estimate model + a dependency-free fitter (offline calibration).
// The production module (src/lib/pricing/fdm-estimate-model.ts) is S3; it will take the constants
// this script reports, not import this file.
import type { CalibrationSample } from './sample';

/** g/cm³. PLA matches PLA_DENSITY in instant-estimate.service.ts. */
export const DENSITY: Record<string, number> = { PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07, TPU: 1.21, PC: 1.2 };
export const DEFAULT_DENSITY = 1.24;

export function densityFor(material: string): number {
  const key = Object.keys(DENSITY).find((name) => material.toUpperCase().startsWith(name));
  return key ? DENSITY[key] : DEFAULT_DENSITY;
}

export type ModelConstants = {
  SHELL_THICKNESS_MM: number;
  SUPPORT_FACTOR: number;
  Q_WALL: number; // cm³/min
  Q_INFILL: number;
  Q_SUPPORT: number;
  MIN_LAYER_SECONDS: number;
  LAYER_OVERHEAD_SECONDS: number;
  T_SETUP: number; // minutes
  K_CALIB: number;
};

/** Plan §5.2 starting values — placeholders the fit replaces. */
export const PLACEHOLDER_CONSTANTS: ModelConstants = {
  SHELL_THICKNESS_MM: 0.9,
  SUPPORT_FACTOR: 0.1,
  Q_WALL: 0.35,
  Q_INFILL: 0.9,
  Q_SUPPORT: 0.6,
  MIN_LAYER_SECONDS: 8,
  LAYER_OVERHEAD_SECONDS: 1.5,
  T_SETUP: 6,
  K_CALIB: 1,
};

export type ModelInput = {
  volumeCm3: number;
  surfaceCm2: number;
  zMm: number;
  infill: number; // 0–1
  layerHeightMm: number;
  material: string;
};

export function sampleInput(sample: CalibrationSample): ModelInput {
  return {
    volumeCm3: sample.geometry.volumeCm3,
    surfaceCm2: sample.geometry.surfaceCm2,
    zMm: sample.geometry.sizeMm.z,
    infill: sample.settings.infill,
    layerHeightMm: sample.settings.layerHeightMm,
    material: sample.material,
  };
}

function volumes(input: ModelInput, c: ModelConstants) {
  // A (cm²) × t (mm) / 10 = cm³
  const shell = Math.min(input.volumeCm3, (input.surfaceCm2 * c.SHELL_THICKNESS_MM) / 10);
  const fill = input.volumeCm3 - shell;
  const support = input.volumeCm3 * c.SUPPORT_FACTOR;
  return { shell, fill, support };
}

/** §5.1 */
export function predictGrams(input: ModelInput, c: ModelConstants): number {
  const v = volumes(input, c);
  return densityFor(input.material) * (v.shell + v.fill * input.infill + v.support);
}

/** §5.2 */
export function predictMinutes(input: ModelInput, c: ModelConstants): number {
  const v = volumes(input, c);
  const layers = Math.ceil(input.zMm / input.layerHeightMm - 1e-9);
  const flow = v.shell / c.Q_WALL + (v.fill * input.infill) / c.Q_INFILL + v.support / c.Q_SUPPORT;
  const layerFloor = (layers * c.MIN_LAYER_SECONDS) / 60;
  const minutes = c.T_SETUP + Math.max(flow, layerFloor) + (layers * c.LAYER_OVERHEAD_SECONDS) / 60;
  return Math.round(minutes * c.K_CALIB);
}

// ---------------------------------------------------------------------------------------------
// Error statistics
// ---------------------------------------------------------------------------------------------

export function absPctError(actual: number, predicted: number): number {
  return actual > 0 ? (Math.abs(predicted - actual) / actual) * 100 : Infinity;
}

export function quantile(values: number[], q: number): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

export type ErrorStats = { medianPct: number; p90Pct: number; meanPct: number };

export function errorStats(errors: number[]): ErrorStats {
  return {
    medianPct: quantile(errors, 0.5),
    p90Pct: quantile(errors, 0.9),
    meanPct: errors.reduce((a, b) => a + b, 0) / (errors.length || 1),
  };
}

// ---------------------------------------------------------------------------------------------
// Fitting — coordinate search over a multiplicative grid (no dependency). Objective: mean absolute
// % error (smooth enough to search; the acceptance threshold is reported on the median).
// ---------------------------------------------------------------------------------------------

type Bounds = Partial<Record<keyof ModelConstants, [number, number]>>;

const BOUNDS: Bounds = {
  SHELL_THICKNESS_MM: [0.2, 4],
  Q_WALL: [0.05, 5],
  Q_INFILL: [0.05, 10],
  Q_SUPPORT: [0.05, 10],
  MIN_LAYER_SECONDS: [0, 30],
  LAYER_OVERHEAD_SECONDS: [0, 10],
  T_SETUP: [0, 30],
  K_CALIB: [0.5, 2],
};

function coordinateSearch(
  start: ModelConstants,
  keys: (keyof ModelConstants)[],
  objective: (c: ModelConstants) => number,
  rounds = 40,
): ModelConstants {
  let best = { ...start };
  let bestScore = objective(best);
  let step = 1; // log2 span of the grid around the current value
  for (let round = 0; round < rounds && step > 1 / 512; round += 1) {
    let improved = false;
    for (const key of keys) {
      const [lo, hi] = BOUNDS[key] ?? [0, Infinity];
      const current = best[key];
      const candidates = new Set<number>();
      for (let i = -8; i <= 8; i += 1) {
        // Multiplicative grid; additive near zero so a parameter can reach/leave 0.
        const multiplicative = current * 2 ** ((i / 8) * step);
        const additive = current + (i / 8) * step * (hi === Infinity ? 1 : (hi - lo) / 8);
        for (const value of [multiplicative, additive]) if (value >= lo && value <= hi) candidates.add(value);
      }
      for (const value of candidates) {
        const trial = { ...best, [key]: value };
        const score = objective(trial);
        if (score < bestScore - 1e-12) { best = trial; bestScore = score; improved = true; }
      }
    }
    if (!improved) step /= 2;
  }
  return best;
}

export function gramsObjective(samples: CalibrationSample[], c: ModelConstants): number {
  return errorStats(samples.map((s) => absPctError(s.actualGrams, predictGrams(sampleInput(s), c)))).meanPct;
}

export function minutesObjective(samples: CalibrationSample[], c: ModelConstants): number {
  return errorStats(samples.map((s) => absPctError(s.actualMinutes, predictMinutes(sampleInput(s), c)))).meanPct;
}

/**
 * 1) SHELL_THICKNESS_MM from grams (the only free grams parameter; SUPPORT_FACTOR stays fixed).
 * 2) Time parameters with K_CALIB = 1 (K scales everything, so fitting it together with the Q's is
 *    degenerate). 3) K_CALIB alone as a final global correction (≈ 1 after step 2).
 */
export function fitConstants(samples: CalibrationSample[], start: ModelConstants = PLACEHOLDER_CONSTANTS): ModelConstants {
  if (!samples.length) return { ...start };
  const shell = coordinateSearch({ ...start }, ['SHELL_THICKNESS_MM'], (c) => gramsObjective(samples, c));
  const time = coordinateSearch(
    { ...shell, K_CALIB: 1 },
    ['Q_WALL', 'Q_INFILL', 'Q_SUPPORT', 'MIN_LAYER_SECONDS', 'LAYER_OVERHEAD_SECONDS', 'T_SETUP'],
    (c) => minutesObjective(samples, c),
  );
  return coordinateSearch(time, ['K_CALIB'], (c) => minutesObjective(samples, c));
}

export type SampleResult = {
  file: string;
  actualGrams: number; predictedGrams: number; gramsErrPct: number;
  actualMinutes: number; predictedMinutes: number; minutesErrPct: number;
};

export function evaluate(samples: CalibrationSample[], c: ModelConstants): { rows: SampleResult[]; grams: ErrorStats; minutes: ErrorStats } {
  const rows = samples.map((s) => {
    const input = sampleInput(s);
    const predictedGrams = predictGrams(input, c);
    const predictedMinutes = predictMinutes(input, c);
    return {
      file: s.file,
      actualGrams: s.actualGrams, predictedGrams, gramsErrPct: absPctError(s.actualGrams, predictedGrams),
      actualMinutes: s.actualMinutes, predictedMinutes, minutesErrPct: absPctError(s.actualMinutes, predictedMinutes),
    };
  });
  return { rows, grams: errorStats(rows.map((r) => r.gramsErrPct)), minutes: errorStats(rows.map((r) => r.minutesErrPct)) };
}

/** Leave-one-out: each sample predicted by constants fitted WITHOUT it — the honest error estimate
 * when 7 constants are fitted on 15–20 files. */
export function leaveOneOut(samples: CalibrationSample[], start: ModelConstants = PLACEHOLDER_CONSTANTS): { grams: ErrorStats; minutes: ErrorStats } {
  const gramsErrors: number[] = [];
  const minutesErrors: number[] = [];
  for (let i = 0; i < samples.length; i += 1) {
    const training = samples.filter((_, index) => index !== i);
    if (!training.length) continue;
    const fitted = fitConstants(training, start);
    const input = sampleInput(samples[i]);
    gramsErrors.push(absPctError(samples[i].actualGrams, predictGrams(input, fitted)));
    minutesErrors.push(absPctError(samples[i].actualMinutes, predictMinutes(input, fitted)));
  }
  return { grams: errorStats(gramsErrors), minutes: errorStats(minutesErrors) };
}

/** Plan §8 S0 acceptance threshold (median). The Owner decides; the script only reports. */
export const ACCEPTANCE = { gramsMedianPct: 15, minutesMedianPct: 25 } as const;

export function acceptance(stats: { grams: ErrorStats; minutes: ErrorStats }) {
  const grams = stats.grams.medianPct <= ACCEPTANCE.gramsMedianPct;
  const minutes = stats.minutes.medianPct <= ACCEPTANCE.minutesMedianPct;
  return { grams, minutes, pass: grams && minutes };
}
