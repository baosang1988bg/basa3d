import assert from 'node:assert/strict';
import test from 'node:test';
import { computePricingBreakdown, resolveMaterialUnitCostVndPerGram, type PricingConfigInput } from '../src/services/pricing.service.js';

// Placeholder config from docs/product/catalog-spec.md §4 ("Số liệu placeholder" table).
const CATALOG_SPEC_CONFIG: PricingConfigInput = {
  electricityVndPerKwh: 3_500,
  machinePriceVnd: 15_000_000,
  machineLifetimeHours: 10_000,
  printerPowerKw: 0.2,
  laborVndPerHour: 35_000,
  failureBufferPct: 10,
  marginPct: 40,
  packagingFeeVnd: 5_000,
};

test('golden calculation matches the worked example in catalog-spec.md §4 exactly', () => {
  // Input: model 50g, in mất 3 giờ, 0.5 giờ labor (setup + hậu kỳ + đóng gói), material giả sử 8.000đ.
  const breakdown = computePricingBreakdown({
    materials: [{ label: 'PLA', gram: 50, unitCostVndPerGram: 8_000 / 50 }],
    printMinutes: 3 * 60,
    laborMinutes: 0.5 * 60,
    config: CATALOG_SPEC_CONFIG,
  });

  assert.equal(breakdown.materialCostVnd, 8_000);
  assert.equal(breakdown.electricityCostVnd, 2_100);
  assert.equal(breakdown.machineDepreciationVnd, 4_500);
  assert.equal(breakdown.failureBufferVnd, 1_460);
  assert.equal(breakdown.laborCostVnd, 17_500);
  assert.equal(breakdown.packagingFeeVnd, 5_000);
  assert.equal(breakdown.totalCostVnd, 38_560);
  assert.equal(breakdown.priceBeforeRoundingVnd, 64_267);
  assert.equal(breakdown.finalPriceVnd, 65_000);
});

test('every breakdown field is an integer VND (Rule #2 — no floating-point money)', () => {
  const breakdown = computePricingBreakdown({
    materials: [
      { label: 'PLA Red', gram: 37.4, unitCostVndPerGram: 173.2 },
      { label: 'PLA Blue', gram: 12.1, unitCostVndPerGram: 201.7 },
    ],
    printMinutes: 793,
    laborMinutes: 145,
    config: CATALOG_SPEC_CONFIG,
  });

  for (const value of [
    breakdown.materialCostVnd, breakdown.electricityCostVnd, breakdown.machineDepreciationVnd,
    breakdown.failureBufferVnd, breakdown.laborCostVnd, breakdown.packagingFeeVnd,
    breakdown.totalCostVnd, breakdown.priceBeforeRoundingVnd, breakdown.finalPriceVnd,
  ]) {
    assert.equal(Number.isInteger(value), true, `expected integer VND, got ${value}`);
  }
  for (const line of breakdown.materialLines) assert.equal(Number.isInteger(line.costVnd), true);
});

test('rounding rule (ADR-0010): final price is always a multiple of 1,000 and never less than the pre-rounding price', () => {
  // Property test over a spread of random-ish cost/margin combinations, not just the golden example.
  const scenarios = [
    { totalCostVnd: 1, marginPct: 0 },
    { totalCostVnd: 999, marginPct: 5 },
    { totalCostVnd: 1_000, marginPct: 0 },
    { totalCostVnd: 12_345, marginPct: 33.33 },
    { totalCostVnd: 999_999, marginPct: 99 },
    { totalCostVnd: 7, marginPct: 50 },
  ];
  for (const scenario of scenarios) {
    const breakdown = computePricingBreakdown({
      materials: [],
      printMinutes: 0,
      laborMinutes: 0,
      config: { ...CATALOG_SPEC_CONFIG, packagingFeeVnd: scenario.totalCostVnd, marginPct: scenario.marginPct },
    });
    assert.equal(breakdown.finalPriceVnd % 1000, 0, `not a multiple of 1000: ${breakdown.finalPriceVnd}`);
    assert.equal(Number.isInteger(breakdown.finalPriceVnd), true);
    assert.ok(breakdown.finalPriceVnd >= breakdown.priceBeforeRoundingVnd, `${breakdown.finalPriceVnd} < ${breakdown.priceBeforeRoundingVnd}`);
  }
});

test('a price that is already an exact multiple of 1,000 does not get bumped up an extra 1,000 by float noise', () => {
  // 0.4 margin is a classic float-imprecision trigger (1 - 0.4 = 0.6000000000000001 in IEEE 754).
  // totalCost chosen so the mathematically exact price is precisely 60,000.
  const breakdown = computePricingBreakdown({
    materials: [],
    printMinutes: 0,
    laborMinutes: 0,
    config: { ...CATALOG_SPEC_CONFIG, packagingFeeVnd: 36_000, marginPct: 40 },
  });
  assert.equal(breakdown.priceBeforeRoundingVnd, 60_000);
  assert.equal(breakdown.finalPriceVnd, 60_000);
});

test('multi-material: total Material cost is the sum of each color, not a lump rounded average', () => {
  const breakdown = computePricingBreakdown({
    materials: [
      { label: 'A', gram: 30.5, unitCostVndPerGram: 173.2 },
      { label: 'B', gram: 4.52, unitCostVndPerGram: 210 },
      { label: 'C', gram: 118.4, unitCostVndPerGram: 165.9 },
    ],
    printMinutes: 792,
    laborMinutes: 135,
    config: CATALOG_SPEC_CONFIG,
  });
  const expectedSum = breakdown.materialLines.reduce((sum, line) => sum + line.costVnd, 0);
  assert.equal(breakdown.materialCostVnd, expectedSum);
  assert.equal(breakdown.materialLines.length, 3);
});

test('resolveMaterialUnitCostVndPerGram: SPOOL derives per-gram cost, GRAM uses current_unit_cost directly', () => {
  assert.equal(
    resolveMaterialUnitCostVndPerGram({ unit: 'SPOOL', costPerSpool: 350_000, spoolWeightGrams: 1_000, currentUnitCost: null }),
    350,
  );
  assert.equal(
    resolveMaterialUnitCostVndPerGram({ unit: 'GRAM', costPerSpool: null, spoolWeightGrams: null, currentUnitCost: 420 }),
    420,
  );
});

test('resolveMaterialUnitCostVndPerGram: missing SPOOL cost fields resolve to 0, not a crash', () => {
  assert.equal(resolveMaterialUnitCostVndPerGram({ unit: 'SPOOL', costPerSpool: null, spoolWeightGrams: 1_000, currentUnitCost: null }), 0);
  assert.equal(resolveMaterialUnitCostVndPerGram({ unit: 'SPOOL', costPerSpool: 300_000, spoolWeightGrams: null, currentUnitCost: null }), 0);
  assert.equal(resolveMaterialUnitCostVndPerGram({ unit: 'GRAM', costPerSpool: null, spoolWeightGrams: null, currentUnitCost: null }), 0);
});

test('rejects non-finite/out-of-domain inputs before NaN or Infinity can enter a snapshot', () => {
  const base = { materials: [], printMinutes: 0, laborMinutes: 0, config: CATALOG_SPEC_CONFIG };
  assert.throws(() => computePricingBreakdown({ ...base, config: { ...CATALOG_SPEC_CONFIG, marginPct: 100 } }), RangeError);
  assert.throws(() => computePricingBreakdown({ ...base, printMinutes: Number.NaN }), RangeError);
  assert.throws(() => computePricingBreakdown({ ...base, config: { ...CATALOG_SPEC_CONFIG, machineLifetimeHours: 0 } }), RangeError);
  assert.throws(() => computePricingBreakdown({ ...base, materials: [{ gram: -1, unitCostVndPerGram: 100 }] }), RangeError);
});
