import { computePricingBreakdown, type PricingConfigInput } from '@/services/pricing.service';

export function calculateToolPriceRange(input: {
  weightGrams: number;
  printMinutes: number;
  unitCostVndPerGram: number;
  config: PricingConfigInput;
}) {
  const center = computePricingBreakdown({
    materials: [{ label: 'PLA', gram: input.weightGrams, unitCostVndPerGram: input.unitCostVndPerGram }],
    printMinutes: input.printMinutes,
    laborMinutes: 5,
    config: input.config,
  }).finalPriceVnd;
  return {
    minPriceVnd: Math.max(1_000, Math.floor((center * 0.85) / 1_000) * 1_000),
    maxPriceVnd: Math.ceil((center * 1.15) / 1_000) * 1_000,
  };
}
