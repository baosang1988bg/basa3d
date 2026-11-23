import { computePricingBreakdown, type PricingConfigInput } from '@/services/pricing.service';

export function calculateToolPriceRange(input: {
  weightGrams: number;
  printMinutes: number;
  unitCostVndPerGram?: number;
  isMultiColor?: boolean;
  colorCount?: number;
  config: PricingConfigInput;
}) {
  const isMulti = input.isMultiColor ?? (input.colorCount ? input.colorCount > 1 : false);
  const unitCost = input.unitCostVndPerGram && input.unitCostVndPerGram > 0 ? input.unitCostVndPerGram : 180;
  const laborMinutes = isMulti ? 8 : 5;
  const totalGrams = input.weightGrams + (isMulti ? 0.5 : 0);

  const center = computePricingBreakdown({
    materials: [{ label: 'PLA', gram: totalGrams, unitCostVndPerGram: unitCost }],
    printMinutes: input.printMinutes + (isMulti ? 2 : 0),
    laborMinutes,
    config: input.config,
  }).finalPriceVnd;

  const adjustedCenter = isMulti ? center + 5_000 : center;

  return {
    minPriceVnd: Math.max(1_000, Math.floor((adjustedCenter * 0.85) / 1_000) * 1_000),
    maxPriceVnd: Math.ceil((adjustedCenter * 1.15) / 1_000) * 1_000,
  };
}
