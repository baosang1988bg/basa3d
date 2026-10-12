// Shared MakerWorld pricing rules (makerworld-phase-b-storefront-estimate.md §2).
//
// ONE place that turns "a MakerWorld print profile + tier + material costs" into the
// computePricingBreakdown() input, used by BOTH:
//   - the admin MakerWorldQuotePanel (client, staff-chosen spools), and
//   - the storefront estimate / verified price presets (server, ADR-0033),
// so a customer never sees a number computed by different rules than staff would quote.
// Pure: no DB, no React — callers resolve unit costs and the pricing config first.

import { computePricingBreakdown, type PricingBreakdown, type PricingConfigInput, type PricingMaterialLine } from '../../services/pricing.service';
import { ASSEMBLY_TIERS, type AssemblyTier } from './assembly-tiers';
import {
  defaultWasteRatioPctForProfile,
  estimateWaste,
  estimateWasteWithCustomGrams,
  WASTE_RATIO_OVERRIDE_PRESETS,
} from './smart-waste-estimator';

export const CONSUMABLE_LINE_LABEL = 'Keo/vật tư hoàn thiện';
export const DEFAULT_LABOR_MINUTES_PER_PLATE = 15;

export type MakerWorldPricingFilament = { name: string; materialType: string; netWeightGrams: number };

export type WasteChoice =
  | { mode: 'DEFAULT' }
  | { mode: 'PRESET'; preset: keyof typeof WASTE_RATIO_OVERRIDE_PRESETS }
  | { mode: 'CUSTOM_GRAMS'; grams: number };

export type FilamentPricingChoice = {
  /** null = no usable cost for this filament → the whole profile can't be priced. */
  unitCostVndPerGram: number | null;
  materialId?: string | null;
  waste?: WasteChoice;
};

/** A priced material line, with enough provenance to be stored as a verified preset. */
export type MakerWorldMaterialLine = PricingMaterialLine & {
  label: string;
  materialId: string | null;
  materialType: string;
};

export function needsAmsChoice(colorsCount: number, amsRequired: boolean | null): boolean {
  return colorsCount > 1 && amsRequired === null;
}

/** Default labor minutes: the tier's total labor, or plates × 15 when no tier is chosen (Phase 13). */
export function defaultLaborMinutes(tier: AssemblyTier | null, platesCount: number): number {
  return tier ? ASSEMBLY_TIERS[tier].laborMinutes : platesCount * DEFAULT_LABOR_MINUTES_PER_PLATE;
}

function wasteGramsFor(filament: MakerWorldPricingFilament, choice: WasteChoice | undefined, defaultPct: number): number {
  const waste = choice ?? { mode: 'DEFAULT' };
  const estimate = waste.mode === 'CUSTOM_GRAMS'
    ? estimateWasteWithCustomGrams(filament.netWeightGrams, Number.isFinite(waste.grams) && waste.grams >= 0 ? waste.grams : 0)
    : estimateWaste({
      netWeightGrams: filament.netWeightGrams,
      wasteRatioPct: waste.mode === 'PRESET' ? WASTE_RATIO_OVERRIDE_PRESETS[waste.preset] : defaultPct,
    });
  return Math.round(estimate.totalWeightGrams * 100) / 100;
}

/**
 * Material lines (grams already include waste) for one profile + tier. Returns null when the profile
 * can't be priced from these inputs: AMS unknown on a multi-color profile, no filaments, or a
 * filament without a usable unit cost. Never substitutes a guessed cost.
 */
export function buildMakerWorldMaterialLines(input: {
  filaments: MakerWorldPricingFilament[];
  colorsCount: number;
  amsRequired: boolean | null;
  tier: AssemblyTier | null;
  choices: FilamentPricingChoice[];
  consumable?: { grams: number; unitCostVndPerGram: number; materialId?: string | null } | null;
}): MakerWorldMaterialLine[] | null {
  if (!input.filaments.length || needsAmsChoice(input.colorsCount, input.amsRequired)) return null;
  const defaultPct = defaultWasteRatioPctForProfile(input.colorsCount, input.amsRequired);
  const lines: MakerWorldMaterialLine[] = [];
  for (const [index, filament] of input.filaments.entries()) {
    const choice = input.choices[index];
    if (!choice || choice.unitCostVndPerGram === null || !Number.isFinite(choice.unitCostVndPerGram) || choice.unitCostVndPerGram < 0) return null;
    lines.push({
      label: `${filament.name} (${filament.materialType})`,
      gram: wasteGramsFor(filament, choice.waste, defaultPct),
      unitCostVndPerGram: choice.unitCostVndPerGram,
      materialId: choice.materialId ?? null,
      materialType: filament.materialType,
    });
  }
  const consumable = input.consumable;
  if (input.tier && ASSEMBLY_TIERS[input.tier].consumableLine && consumable && Number.isFinite(consumable.grams) && consumable.grams > 0) {
    lines.push({
      label: CONSUMABLE_LINE_LABEL,
      gram: consumable.grams,
      unitCostVndPerGram: consumable.unitCostVndPerGram,
      materialId: consumable.materialId ?? null,
      materialType: 'CONSUMABLE',
    });
  }
  return lines;
}

/** computePricingBreakdown wrapper that never throws (bad inputs → null, shown as "no price"). */
export function priceMakerWorldLines(input: {
  lines: Pick<PricingMaterialLine, 'label' | 'gram' | 'unitCostVndPerGram'>[];
  printMinutes: number;
  laborMinutes: number;
  config: PricingConfigInput;
}): PricingBreakdown | null {
  if (!input.lines.length || !Number.isFinite(input.laborMinutes) || input.laborMinutes < 0) return null;
  try {
    return computePricingBreakdown({
      materials: input.lines.map(({ label, gram, unitCostVndPerGram }) => ({ label, gram, unitCostVndPerGram })),
      printMinutes: input.printMinutes,
      laborMinutes: input.laborMinutes,
      config: input.config,
    });
  } catch {
    return null;
  }
}

/** Median đơn giá/gram of active materials per material type (upper-cased), ignoring missing/0
 * costs. Used where no specific spool is chosen (storefront auto estimate, preset whose spool was
 * deactivated). A type with no priced active material is absent → caller must not price it. */
export function medianUnitCostByMaterialType(
  materials: { materialType: string; isActive?: boolean | null; unitCostVndPerGram: number }[],
): Map<string, number> {
  const byType = new Map<string, number[]>();
  for (const material of materials) {
    if (material.isActive === false) continue;
    if (!Number.isFinite(material.unitCostVndPerGram) || material.unitCostVndPerGram <= 0) continue;
    const key = material.materialType.trim().toUpperCase();
    byType.set(key, [...(byType.get(key) ?? []), material.unitCostVndPerGram]);
  }
  const medians = new Map<string, number>();
  for (const [type, costs] of byType) {
    const sorted = [...costs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medians.set(type, sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
  }
  return medians;
}
