// Feature 003 (FR-005, research R6): estimated price of an imported model with the shop's current
// pricing config — the same FDM model + cost-plus breakdown as the storefront estimate, never a
// separate formula. Always flagged for review (the FDM model is uncalibrated).
import { DEFAULT_INFILL_PCT, estimateFdmPrint, MIN_ITEM_PRICE_VND } from '../pricing/fdm-estimate-model';
import { priceMakerWorldLines } from '../pricing/makerworld-pricing';
import type { MeshMetrics } from '../pricing/mesh-metrics';
import type { PricingBreakdown, PricingConfigInput } from '../../services/pricing.service';

export const IMPORT_MATERIAL = 'PLA';

export type ImportPricingContext = { config: PricingConfigInput; medians: Map<string, number>; pricingConfigId?: string };

export type ImportPrice =
  | { priced: true; basePrice: number; breakdown: PricingBreakdown; pricingConfigId: string }
  | { priced: false; reason: 'EXCEEDS_BUILD_VOLUME' | 'INVALID_MESH' | 'NO_PRICING_CONFIG' | 'NO_MATERIAL_COST' | 'PRICING_FAILED' };

export function estimateImportPrice(metrics: MeshMetrics, context: ImportPricingContext | null): ImportPrice {
  if (!context?.pricingConfigId) return { priced: false, reason: 'NO_PRICING_CONFIG' };
  const estimate = estimateFdmPrint({ metrics, scalePermille: 1000, infillPct: DEFAULT_INFILL_PCT, materialType: IMPORT_MATERIAL });
  if (estimate.status !== 'OK') return { priced: false, reason: estimate.reason };
  const unitCost = context.medians.get(IMPORT_MATERIAL);
  if (unitCost === undefined) return { priced: false, reason: 'NO_MATERIAL_COST' };
  const breakdown = priceMakerWorldLines({
    lines: [{ label: `Nhựa ${IMPORT_MATERIAL}`, gram: estimate.grams, unitCostVndPerGram: unitCost }],
    printMinutes: estimate.printMinutes,
    laborMinutes: 0,
    config: context.config,
  });
  if (!breakdown) return { priced: false, reason: 'PRICING_FAILED' };
  return { priced: true, basePrice: Math.max(MIN_ITEM_PRICE_VND, breakdown.finalPriceVnd), breakdown, pricingConfigId: context.pricingConfigId };
}
