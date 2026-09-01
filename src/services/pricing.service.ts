// Phase 9: cost-plus pricing engine (docs/product/catalog-spec.md §4 + Phase 9 addendum).
// Deliberately a pure calculator — no DB query, no transaction. Callers (quote.service,
// product.service, the /admin pricing routes/actions) resolve material unit costs and the current
// pricing_configs row first, then call computePricingBreakdown. This keeps the formula itself
// testable without a database and stops it from ever opening a transaction that could nest inside
// a caller's own withTransaction (phase-9.md decision #1).

export type PricingConfigInput = {
  electricityVndPerKwh: number;
  machinePriceVnd: number;
  machineLifetimeHours: number;
  printerPowerKw: number;
  laborVndPerHour: number;
  /** 0-100, e.g. 10 means 10% — never a 0-1 fraction. */
  failureBufferPct: number;
  /** 0-100, e.g. 40 means 40% — never a 0-1 fraction. */
  marginPct: number;
  packagingFeeVnd: number;
};

export type PricingMaterialLine = {
  label?: string | null;
  /** Total consumption for this color/material, already inclusive of purge/prime-tower/support
   * waste — see catalog-spec.md's Phase 9 addendum. Not the model's net weight alone. */
  gram: number;
  unitCostVndPerGram: number;
};

export type PricingInput = {
  materials: PricingMaterialLine[];
  /** Slicer-reported machine print time across all plates, in minutes. Does NOT include plate
   * changeover time — that belongs in laborMinutes (see catalog-spec.md addendum). */
  printMinutes: number;
  /** Setup (first plate) + inter-plate changeover + post-processing + packaging, in minutes. */
  laborMinutes: number;
  config: PricingConfigInput;
};

export type PricingBreakdown = {
  materialCostVnd: number;
  materialLines: { label: string | null; gram: number; costVnd: number }[];
  electricityCostVnd: number;
  machineDepreciationVnd: number;
  failureBufferVnd: number;
  laborCostVnd: number;
  packagingFeeVnd: number;
  totalCostVnd: number;
  priceBeforeRoundingVnd: number;
  /** Integer VND, rounded up to the nearest 1,000 (ADR-0010). This is the number to actually charge. */
  finalPriceVnd: number;
};

/** Every line total is an integer VND (Rule #2) — Math.round is applied per line, not once at the
 * end, so a caller inspecting materialLines/electricityCostVnd/etc. individually never sees a
 * fractional VND. Only the final 1,000-VND rounding rule (ADR-0010) is special-cased below. */
function toIntegerVnd(value: number): number {
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value)) || value < 0) {
    throw new RangeError('Pricing calculation produced an invalid VND amount.');
  }
  return Math.round(value);
}

export function computePricingBreakdown(input: PricingInput): PricingBreakdown {
  const numericInputs = [
    input.printMinutes, input.laborMinutes, input.config.electricityVndPerKwh,
    input.config.machinePriceVnd, input.config.machineLifetimeHours, input.config.printerPowerKw,
    input.config.laborVndPerHour, input.config.failureBufferPct, input.config.marginPct,
    input.config.packagingFeeVnd,
    ...input.materials.flatMap((line) => [line.gram, line.unitCostVndPerGram]),
  ];
  if (numericInputs.some((value) => !Number.isFinite(value) || value < 0)
      || input.config.machineLifetimeHours <= 0
      || input.config.marginPct >= 100) {
    throw new RangeError('Pricing inputs must be finite, non-negative, and margin must be below 100%.');
  }
  const printHours = input.printMinutes / 60;
  const laborHours = input.laborMinutes / 60;

  const materialLines = input.materials.map((line) => ({
    label: line.label ?? null,
    gram: line.gram,
    costVnd: toIntegerVnd(line.gram * line.unitCostVndPerGram),
  }));
  const materialCostVnd = materialLines.reduce((sum, line) => sum + line.costVnd, 0);

  const electricityCostVnd = toIntegerVnd(printHours * input.config.printerPowerKw * input.config.electricityVndPerKwh);
  const machineDepreciationVnd = toIntegerVnd(printHours * (input.config.machinePriceVnd / input.config.machineLifetimeHours));
  const failureBufferVnd = toIntegerVnd(
    (materialCostVnd + electricityCostVnd + machineDepreciationVnd) * (input.config.failureBufferPct / 100),
  );
  const laborCostVnd = toIntegerVnd(laborHours * input.config.laborVndPerHour);
  const packagingFeeVnd = toIntegerVnd(input.config.packagingFeeVnd);

  const totalCostVnd = materialCostVnd + electricityCostVnd + machineDepreciationVnd + failureBufferVnd + laborCostVnd + packagingFeeVnd;

  // Total/(1-margin%) can produce a long decimal or float noise (e.g. 64266.99999999997 instead of
  // 64267). Round to the nearest integer VND *before* applying the ADR-0010 ceil-to-1000 rule —
  // otherwise float epsilon just above an exact multiple of 1000 would ceil up an extra 1,000đ that
  // was never actually owed (see phase-9.md Risks: "Rounding double-error").
  const priceBeforeRoundingVnd = toIntegerVnd(totalCostVnd / (1 - input.config.marginPct / 100));
  const finalPriceVnd = Math.ceil(priceBeforeRoundingVnd / 1000) * 1000;

  return {
    materialCostVnd,
    materialLines,
    electricityCostVnd,
    machineDepreciationVnd,
    failureBufferVnd,
    laborCostVnd,
    packagingFeeVnd,
    totalCostVnd,
    priceBeforeRoundingVnd,
    finalPriceVnd,
  };
}

export type MaterialUnitCostInput = {
  unit: string;
  costPerSpool: number | null;
  spoolWeightGrams: number | null;
  currentUnitCost: number | null;
};

/** catalog-spec.md Phase 9 addendum: unit='SPOOL' derives đơn giá/gram from cost_per_spool /
 * spool_weight_grams; unit='GRAM' uses current_unit_cost directly (material bought loose, not on a
 * spool — e.g. resin by the bottle). Returns 0 (not a thrown error) when the material is missing
 * the cost fields it needs — callers surface that as "chưa có giá, staff cần nhập tay", not a crash. */
export function resolveMaterialUnitCostVndPerGram(material: MaterialUnitCostInput): number {
  if (material.unit === 'SPOOL') {
    if (!material.costPerSpool || !material.spoolWeightGrams) return 0;
    return material.costPerSpool / material.spoolWeightGrams;
  }
  return material.currentUnitCost ?? 0;
}
