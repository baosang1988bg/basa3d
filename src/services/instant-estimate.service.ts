// Instant (quote-first) estimates for the storefront — ADR-0034.
// Same pricing rules as the admin panel (src/lib/pricing/makerworld-pricing.ts →
// computePricingBreakdown, ADR-0010), fed from three kinds of input the customer can provide without
// MakerWorld's servers:
//   - SPEC    : the profile spec line the customer copied from MakerWorld ("7.4 h · 6 plates · 168 g").
//   - SLICED  : a sliced Bambu/Orca .3mf (exact time + grams per filament from slice_info).
//   - MESH    : an .stl/.obj (volume only → a price RANGE, since infill/time are unknown).
// Every result is an estimate, rounded to 5.000đ, never a quote. DTOs carry no costs/margin (B1).
import { getCurrentPricingConfig } from './pricing-config.service';
import { listMaterials } from './inventory.service';
import { resolveMaterialUnitCostVndPerGram, type PricingConfigInput } from './pricing.service';
import {
  buildMakerWorldMaterialLines,
  defaultLaborMinutes,
  medianUnitCostByMaterialType,
  priceMakerWorldLines,
} from '../lib/pricing/makerworld-pricing';
import { ASSEMBLY_TIER_KEYS } from '../lib/pricing/assembly-tiers';
import { estimatePrintMinutes } from '../lib/pricing/mesh-estimator';
import type { ParsedSliceInfo } from '../lib/parsers/threemf-slice-info';
import type { MeshVolumeResult } from '../lib/parsers/mesh-volume';
import type { MeshMetrics } from '../lib/pricing/mesh-metrics';
import { estimateFdmPrint, lineSubtotalVnd, type FdmUnpricedReason } from '../lib/pricing/fdm-estimate-model';
import { computeVat } from '../lib/pricing/vat';

export const INSTANT_ROUNDING_VND = 5_000;
/** PLA density g/cm³ — the mesh path converts volume to grams with it. */
export const PLA_DENSITY = 1.24;
/** Share of the solid volume actually printed (walls + infill). Unknown for a raw mesh, so the
 * estimate is a range between a light (≈2 walls, 15% infill on a big part) and a dense small part. */
export const MESH_FILL_RANGE = { low: 0.35, high: 0.75 } as const;
export const SPEC_LIMITS = { maxMinutes: 20_000, maxGrams: 20_000, maxPlates: 200 } as const;

export type InstantOptionKey = 'ASSEMBLED' | 'KIT' | 'STANDARD';
export type InstantOption = { key: InstantOptionKey; priceVnd: number | null; minVnd?: number; maxVnd?: number };

export type InstantEstimate = {
  kind: 'SPEC' | 'SLICED' | 'MESH';
  materialType: string;
  specs: {
    printMinutes: number | null;
    netWeightGrams: number | null;
    platesCount: number | null;
    colorsCount: number;
    amsRequired: boolean | null;
    sizeMm?: { x: number; y: number; z: number };
  };
  /** Multi-plate jobs get the two finishing tiers (ráp sẵn / kit); single-plate jobs one price. */
  options: InstantOption[];
};

export type PricingContext = {
  config: PricingConfigInput;
  medians: Map<string, number>;
  /** Phase 33: VAT of the current pricing config (absent → off). */
  vat?: { enabled: boolean; rateBps: number };
  pricingConfigId?: string;
};

export function roundInstant(value: number): number {
  return Math.max(INSTANT_ROUNDING_VND, Math.round(value / INSTANT_ROUNDING_VND) * INSTANT_ROUNDING_VND);
}

/** null when the shop has no current pricing config — callers show "no price", never a guess. */
export async function loadPricingContext(): Promise<PricingContext | null> {
  const config = await getCurrentPricingConfig();
  if (!config) return null;
  const materials = await listMaterials();
  const medians = medianUnitCostByMaterialType(materials.map((m) => ({ materialType: m.materialType, unitCostVndPerGram: resolveMaterialUnitCostVndPerGram(m) })));
  return { config, medians, vat: { enabled: config.vatEnabled, rateBps: config.vatRateBps }, pricingConfigId: config.id };
}

function normalizeType(type: string | null | undefined): string {
  return (type ?? 'PLA').trim().toUpperCase() || 'PLA';
}

type Filament = { name: string; materialType: string; netWeightGrams: number; extraWaste?: 'NONE' };

function priceOptions(ctx: PricingContext, input: {
  filaments: Filament[];
  colorsCount: number;
  amsRequired: boolean | null;
  printMinutes: number;
  platesCount: number;
  forceTiers?: boolean;
}): InstantOption[] {
  const tiers: InstantOptionKey[] = input.forceTiers || input.platesCount > 1 ? [...ASSEMBLY_TIER_KEYS] : ['STANDARD'];
  return tiers.map((key) => {
    const tier = key === 'STANDARD' ? null : key;
    const lines = buildMakerWorldMaterialLines({
      filaments: input.filaments,
      colorsCount: input.colorsCount,
      amsRequired: input.amsRequired,
      tier,
      choices: input.filaments.map((f) => ({
        unitCostVndPerGram: ctx.medians.get(normalizeType(f.materialType)) ?? null,
        // Sliced grams already include purge/prime-tower waste (Phase 9 addendum) — add nothing.
        waste: f.extraWaste === 'NONE' ? { mode: 'CUSTOM_GRAMS' as const, grams: 0 } : undefined,
      })),
    });
    const breakdown = lines ? priceMakerWorldLines({ lines, printMinutes: input.printMinutes, laborMinutes: defaultLaborMinutes(tier, input.platesCount), config: ctx.config }) : null;
    return { key, priceVnd: breakdown ? roundInstant(breakdown.finalPriceVnd) : null };
  });
}

/** SPEC: the customer pasted MakerWorld's spec line. Requires time + grams; plates default to 1.
 * Unknown AMS on a multi-color line is priced as AMS (conservative, ADR-0033 update). */
export function estimateFromSpec(ctx: PricingContext, spec: {
  printMinutes: number | null; netWeightGrams: number | null; platesCount: number | null; amsRequired: boolean | null;
  colorsCount?: number | null; materialType?: string | null;
}, opts: { forceTiers?: boolean } = {}): InstantEstimate | null {
  const minutes = spec.printMinutes; const grams = spec.netWeightGrams;
  if (!minutes || !grams || minutes < 1 || grams < 1 || minutes > SPEC_LIMITS.maxMinutes || grams > SPEC_LIMITS.maxGrams) return null;
  const plates = Math.min(Math.max(spec.platesCount ?? 1, 1), SPEC_LIMITS.maxPlates);
  const colorsCount = Math.min(Math.max(spec.colorsCount ?? (spec.amsRequired === true ? 2 : 1), 1), 16);
  const amsRequired = colorsCount > 1 ? (spec.amsRequired ?? true) : spec.amsRequired;
  const materialType = normalizeType(spec.materialType);
  const options = priceOptions(ctx, {
    filaments: [{ name: 'Nhựa', materialType, netWeightGrams: grams }],
    colorsCount, amsRequired, printMinutes: Math.round(minutes), platesCount: plates, forceTiers: opts.forceTiers,
  });
  return {
    kind: 'SPEC', materialType,
    specs: { printMinutes: Math.round(minutes), netWeightGrams: grams, platesCount: plates, colorsCount, amsRequired },
    options,
  };
}

/** SLICED: exact numbers from a sliced .3mf. `materialOverride` = the material the customer picked. */
export function estimateFromSliceInfo(ctx: PricingContext, parsed: ParsedSliceInfo, materialOverride?: string | null): InstantEstimate | null {
  const filaments = parsed.filaments.filter((f) => f.totalGrams > 0).map((f) => ({
    name: f.color ? `${normalizeType(f.type)} ${f.color}` : normalizeType(f.type),
    materialType: normalizeType(materialOverride || f.type),
    netWeightGrams: Math.round(f.totalGrams * 100) / 100,
    extraWaste: 'NONE' as const,
  }));
  if (!filaments.length || parsed.totalPrintMinutes < 1) return null;
  const grams = filaments.reduce((sum, f) => sum + f.netWeightGrams, 0);
  const options = priceOptions(ctx, {
    filaments,
    colorsCount: filaments.length,
    // Waste is already inside the sliced grams, so AMS only matters for the label — never null here.
    amsRequired: filaments.length > 1,
    printMinutes: parsed.totalPrintMinutes,
    platesCount: Math.max(parsed.plateCount, 1),
  });
  return {
    kind: 'SLICED', materialType: filaments[0].materialType,
    specs: { printMinutes: parsed.totalPrintMinutes, netWeightGrams: Math.round(grams * 10) / 10, platesCount: parsed.plateCount, colorsCount: filaments.length, amsRequired: filaments.length > 1 },
    options,
  };
}

/** MESH: volume only → a price range between a light and a dense print of the same part. */
export function estimateFromMesh(ctx: PricingContext, mesh: MeshVolumeResult, materialType?: string | null): InstantEstimate | null {
  const type = normalizeType(materialType);
  const gramsFor = (fill: number) => Math.max(1, Math.round(mesh.volumeCm3 * PLA_DENSITY * fill * 10) / 10);
  const priceAt = (fill: number) => {
    const grams = gramsFor(fill);
    return priceOptions(ctx, {
      filaments: [{ name: 'Nhựa', materialType: type, netWeightGrams: grams }],
      colorsCount: 1, amsRequired: false, printMinutes: Math.round(estimatePrintMinutes(grams)), platesCount: 1,
    })[0].priceVnd;
  };
  const low = priceAt(MESH_FILL_RANGE.low);
  const high = priceAt(MESH_FILL_RANGE.high);
  const specs = { printMinutes: null, netWeightGrams: null, platesCount: null, colorsCount: 1, amsRequired: false, sizeMm: mesh.sizeMm };
  // No priced active material of this type → no range (caller reports NO_MATERIAL_PRICE).
  if (low === null || high === null) return { kind: 'MESH', materialType: type, specs, options: [{ key: 'STANDARD', priceVnd: null }] };
  return {
    kind: 'MESH', materialType: type, specs,
    options: [{ key: 'STANDARD', priceVnd: null, minVnd: Math.min(low, high), maxVnd: Math.max(low, high) }],
  };
}

// ---------------------------------------------------------------------------------------------
// Phase 33 S3 (plan §5.3): ONE estimated price per item from mesh metrics (used by /bao-gia).
// /custom-print keeps the volume RANGE above (estimateFromMesh) until the model is calibrated (O3).
// ---------------------------------------------------------------------------------------------

export type MeshItemEstimate =
  | {
      status: 'OK';
      modelVersion: string;
      sizeMm: { x: number; y: number; z: number };
      volumeCm3: number;
      surfaceCm2: number;
      grams: number;
      printMinutes: number;
      unitPriceVnd: number;
      lineSubtotalVnd: number;
      /** The per-line minimum price (MIN_ITEM_PRICE_VND) replaced unit × quantity. */
      floorApplied: boolean;
      vatRateBps: number;
      vatVnd: number;
      lineTotalVnd: number;
    }
  | { status: 'UNPRICED'; modelVersion: string; reason: FdmUnpricedReason; sizeMm: { x: number; y: number; z: number } }
  | { status: 'NO_MATERIAL_PRICE'; modelVersion: string; sizeMm: { x: number; y: number; z: number } };

export function estimateFromMeshMetrics(ctx: PricingContext, input: {
  metrics: MeshMetrics;
  scalePermille: number;
  infillPct: number;
  materialType: string;
  quantity: number;
}): MeshItemEstimate {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 1000) throw new RangeError(`quantity out of range: ${input.quantity}`);
  const materialType = normalizeType(input.materialType);
  const print = estimateFdmPrint({ metrics: input.metrics, scalePermille: input.scalePermille, infillPct: input.infillPct, materialType });
  if (print.status === 'UNPRICED') return print;
  const [option] = priceOptions(ctx, {
    filaments: [{ name: 'Nhựa', materialType, netWeightGrams: print.grams }],
    colorsCount: 1, amsRequired: false, printMinutes: print.printMinutes, platesCount: 1,
  });
  if (option.priceVnd === null) return { status: 'NO_MATERIAL_PRICE', modelVersion: print.modelVersion, sizeMm: print.sizeMm };
  const { lineSubtotalVnd: subtotal, floorApplied } = lineSubtotalVnd(option.priceVnd, input.quantity);
  // T11: VAT per item (= per future Quote), through the same computeVat createQuote uses.
  const vatRateBps = ctx.vat?.enabled ? ctx.vat.rateBps : 0;
  const vatVnd = computeVat(subtotal, vatRateBps);
  return {
    status: 'OK',
    modelVersion: print.modelVersion,
    sizeMm: print.sizeMm,
    volumeCm3: print.volumeCm3,
    surfaceCm2: print.surfaceCm2,
    grams: print.grams,
    printMinutes: print.printMinutes,
    unitPriceVnd: option.priceVnd,
    lineSubtotalVnd: subtotal,
    floorApplied,
    vatRateBps,
    vatVnd,
    lineTotalVnd: subtotal + vatVnd,
  };
}
