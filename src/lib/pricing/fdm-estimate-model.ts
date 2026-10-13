// Phase 33 S3 (plan §5.1–§5.3, T3): grams + print time of an FDM print from mesh metrics alone.
// Pure, shared by browser and server. Constants live in code (T3) and are versioned by
// FDM_MODEL_VERSION so every estimate snapshot records which constants produced it.
//
// ⚠️ UNCALIBRATED: the constants below are the plan's §5.2 PLACEHOLDERS. Replace them with the
// output of `scripts/fdm-model-calibration/calibrate.ts` (S0, run on the shop's own sliced files)
// and bump FDM_MODEL_VERSION to 'fdm-v1' before /bao-gia is enabled on Production.
import { checkMeshConsistency, scaleMeshMetrics, type MeshMetrics } from './mesh-metrics';

export const FDM_MODEL_VERSION = 'fdm-v0-uncalibrated';
export const FDM_MODEL_CALIBRATED = false;

export const FDM_CONSTANTS = {
  /** Walls + top/bottom skins expressed as one equivalent shell thickness (mm). */
  SHELL_THICKNESS_MM: 0.9,
  /** Support volume as a share of the part volume (v1: fixed). */
  SUPPORT_FACTOR: 0.1,
  /** Effective extrusion rates, cm³ per minute. */
  Q_WALL: 0.35,
  Q_INFILL: 0.9,
  Q_SUPPORT: 0.6,
  /** A layer never prints faster than this (cooling / travel), seconds. */
  MIN_LAYER_SECONDS: 8,
  /** Per-layer overhead (z-hop, travel, retraction), seconds. */
  LAYER_OVERHEAD_SECONDS: 1.5,
  /** Heating, levelling, purge line, minutes. */
  T_SETUP: 6,
  K_CALIB: 1,
  LAYER_HEIGHT_MM: 0.2,
} as const;

export type FdmConstants = { readonly [K in keyof typeof FDM_CONSTANTS]: number };

/** g/cm³. PLA matches PLA_DENSITY in instant-estimate.service.ts. */
export const FDM_DENSITY: Record<string, number> = { PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07, TPU: 1.21 };

/** Customer-selectable FDM materials (O6, recorded 2026-10-13). Only those with an active priced
 * material in inventory are actually offered — the estimate returns NO_MATERIAL_PRICE otherwise. */
export const FDM_MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU'] as const;
export type FdmMaterial = typeof FDM_MATERIALS[number];

/** Infill choices (plan §7 B2 / schema check on custom_request_items.infill_pct). */
export const INFILL_OPTIONS = [10, 15, 20, 30, 50, 100] as const;
export type InfillPct = typeof INFILL_OPTIONS[number];
export const DEFAULT_INFILL_PCT: InfillPct = 15;

/** Bambu P1S/P2S build volume (mm). Larger → UNPRICED ("needs splitting / staff quote"). */
export const BUILD_VOLUME_MM = { x: 256, y: 256, z: 256 } as const;

/** Floor price per LINE (item × quantity), estimate only (T3, I3). Staff set real prices on Quotes. */
export const MIN_ITEM_PRICE_VND = 25_000;

export const SCALE_PERMILLE_RANGE = { min: 100, max: 10_000 } as const;

export type FdmUnpricedReason = 'EXCEEDS_BUILD_VOLUME' | 'INVALID_MESH';

export type FdmEstimate =
  | {
      status: 'OK';
      modelVersion: string;
      sizeMm: { x: number; y: number; z: number };
      volumeCm3: number;
      surfaceCm2: number;
      grams: number;
      printMinutes: number;
      layers: number;
    }
  | { status: 'UNPRICED'; modelVersion: string; reason: FdmUnpricedReason; sizeMm: { x: number; y: number; z: number } };

const round1 = (value: number) => Math.round(value * 10) / 10;

export function densityFor(materialType: string): number {
  return FDM_DENSITY[materialType.trim().toUpperCase()] ?? FDM_DENSITY.PLA;
}

/**
 * One UNIT of the part. `metrics` are the UNSCALED mesh metrics (mm); scale, infill and material are
 * the customer's choices. Throws RangeError for out-of-range inputs (callers validate with Zod first).
 */
export function estimateFdmPrint(input: {
  metrics: MeshMetrics;
  scalePermille: number;
  infillPct: number;
  materialType: string;
}, constants: FdmConstants = FDM_CONSTANTS): FdmEstimate {
  if (!Number.isInteger(input.scalePermille) || input.scalePermille < SCALE_PERMILLE_RANGE.min || input.scalePermille > SCALE_PERMILLE_RANGE.max) {
    throw new RangeError(`scalePermille out of range: ${input.scalePermille}`);
  }
  if (!(INFILL_OPTIONS as readonly number[]).includes(input.infillPct)) throw new RangeError(`infillPct not allowed: ${input.infillPct}`);

  const scaled = scaleMeshMetrics(input.metrics, input.scalePermille);
  const sizeMm = { x: round1(scaled.sizeMm.x), y: round1(scaled.sizeMm.y), z: round1(scaled.sizeMm.z) };
  if (!checkMeshConsistency(scaled).ok) return { status: 'UNPRICED', modelVersion: FDM_MODEL_VERSION, reason: 'INVALID_MESH', sizeMm };
  // Any orientation that fits counts (the shop can lay a part down), so compare sorted extents.
  const sortedSize = [scaled.sizeMm.x, scaled.sizeMm.y, scaled.sizeMm.z].sort((a, b) => a - b);
  const sortedBed = [BUILD_VOLUME_MM.x, BUILD_VOLUME_MM.y, BUILD_VOLUME_MM.z].sort((a, b) => a - b);
  if (sortedSize.some((value, index) => value > sortedBed[index])) {
    return { status: 'UNPRICED', modelVersion: FDM_MODEL_VERSION, reason: 'EXCEEDS_BUILD_VOLUME', sizeMm };
  }

  // §5.1 — grams
  const volumeCm3 = scaled.volumeMm3 / 1_000;
  const surfaceCm2 = scaled.surfaceMm2 / 100;
  const infill = input.infillPct / 100;
  const shell = Math.min(volumeCm3, (surfaceCm2 * constants.SHELL_THICKNESS_MM) / 10);
  const fill = volumeCm3 - shell;
  const support = volumeCm3 * constants.SUPPORT_FACTOR;
  const grams = densityFor(input.materialType) * (shell + fill * infill + support);

  // §5.2 — minutes (layer-limited parts: tall, thin, light)
  const layers = Math.max(1, Math.ceil(scaled.sizeMm.z / constants.LAYER_HEIGHT_MM - 1e-9));
  const flow = shell / constants.Q_WALL + (fill * infill) / constants.Q_INFILL + support / constants.Q_SUPPORT;
  const layerFloor = (layers * constants.MIN_LAYER_SECONDS) / 60;
  const minutes = constants.T_SETUP + Math.max(flow, layerFloor) + (layers * constants.LAYER_OVERHEAD_SECONDS) / 60;

  return {
    status: 'OK',
    modelVersion: FDM_MODEL_VERSION,
    sizeMm,
    volumeCm3: Math.round(volumeCm3 * 100) / 100,
    surfaceCm2: Math.round(surfaceCm2 * 100) / 100,
    grams: Math.max(1, round1(grams)),
    printMinutes: Math.max(1, Math.round(minutes * constants.K_CALIB)),
    layers,
  };
}

/** §5.3 — line subtotal with the per-line floor. */
export function lineSubtotalVnd(unitPriceVnd: number, quantity: number): { lineSubtotalVnd: number; floorApplied: boolean } {
  const raw = unitPriceVnd * quantity;
  return raw < MIN_ITEM_PRICE_VND ? { lineSubtotalVnd: MIN_ITEM_PRICE_VND, floorApplied: true } : { lineSubtotalVnd: raw, floorApplied: false };
}
