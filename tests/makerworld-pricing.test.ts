// Shared MakerWorld pricing rules (src/lib/pricing/makerworld-pricing.ts) — the single source used by
// the admin panel and the storefront estimate (makerworld-phase-b-storefront-estimate.md §2).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMakerWorldMaterialLines,
  defaultLaborMinutes,
  medianUnitCostByMaterialType,
  needsAmsChoice,
  priceMakerWorldLines,
} from '../src/lib/pricing/makerworld-pricing.js';
import { computePricingBreakdown, type PricingConfigInput } from '../src/services/pricing.service.js';

const config: PricingConfigInput = {
  electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2,
  laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000,
};
const twoColors = [
  { name: 'PLA #68724D', materialType: 'PLA', netWeightGrams: 120 },
  { name: 'PLA #000000', materialType: 'PLA', netWeightGrams: 48 },
];

test('No-AMS multi-color profile uses the 5% baseline waste on every color', () => {
  const lines = buildMakerWorldMaterialLines({ filaments: twoColors, colorsCount: 2, amsRequired: false, tier: 'KIT', choices: [{ unitCostVndPerGram: 300 }, { unitCostVndPerGram: 300 }] });
  assert.deepEqual(lines?.map((l) => l.gram), [126, 50.4]);
});

test('AMS multi-color profile uses the color-count default (20% for 2–4 colors)', () => {
  const lines = buildMakerWorldMaterialLines({ filaments: twoColors, colorsCount: 2, amsRequired: true, tier: 'KIT', choices: [{ unitCostVndPerGram: 300 }, { unitCostVndPerGram: 300 }] });
  assert.deepEqual(lines?.map((l) => l.gram), [144, 57.6]);
});

test('cannot price: AMS unknown on multi-color, missing cost, or no filaments (never guesses)', () => {
  assert.equal(needsAmsChoice(2, null), true);
  assert.equal(buildMakerWorldMaterialLines({ filaments: twoColors, colorsCount: 2, amsRequired: null, tier: 'KIT', choices: [{ unitCostVndPerGram: 300 }, { unitCostVndPerGram: 300 }] }), null);
  assert.equal(buildMakerWorldMaterialLines({ filaments: twoColors, colorsCount: 2, amsRequired: false, tier: 'KIT', choices: [{ unitCostVndPerGram: 300 }, { unitCostVndPerGram: null }] }), null);
  assert.equal(buildMakerWorldMaterialLines({ filaments: [], colorsCount: 0, amsRequired: false, tier: 'KIT', choices: [] }), null);
});

test('consumable line only applies to the ASSEMBLED tier', () => {
  const base = { filaments: twoColors.slice(0, 1), colorsCount: 1, amsRequired: false, choices: [{ unitCostVndPerGram: 300 }], consumable: { grams: 5, unitCostVndPerGram: 1_000 } };
  assert.equal(buildMakerWorldMaterialLines({ ...base, tier: 'ASSEMBLED' })?.length, 2);
  assert.equal(buildMakerWorldMaterialLines({ ...base, tier: 'KIT' })?.length, 1);
});

test('waste overrides: preset and custom grams', () => {
  const lines = buildMakerWorldMaterialLines({ filaments: twoColors, colorsCount: 2, amsRequired: false, tier: null, choices: [
    { unitCostVndPerGram: 300, waste: { mode: 'PRESET', preset: 'HIGH' } },
    { unitCostVndPerGram: 300, waste: { mode: 'CUSTOM_GRAMS', grams: 2 } },
  ] });
  assert.deepEqual(lines?.map((l) => l.gram), [180, 50]);
});

test('defaultLaborMinutes: tier total or plates × 15', () => {
  assert.equal(defaultLaborMinutes('ASSEMBLED', 6), 50);
  assert.equal(defaultLaborMinutes('KIT', 6), 20);
  assert.equal(defaultLaborMinutes(null, 6), 90);
});

test('priceMakerWorldLines equals computePricingBreakdown and never throws', () => {
  const lines = buildMakerWorldMaterialLines({ filaments: twoColors, colorsCount: 2, amsRequired: false, tier: 'KIT', choices: [{ unitCostVndPerGram: 300 }, { unitCostVndPerGram: 250 }] })!;
  const viaShared = priceMakerWorldLines({ lines, printMinutes: 443, laborMinutes: 20, config });
  const direct = computePricingBreakdown({ materials: lines.map(({ label, gram, unitCostVndPerGram }) => ({ label, gram, unitCostVndPerGram })), printMinutes: 443, laborMinutes: 20, config });
  assert.deepEqual(viaShared, direct);
  assert.equal(priceMakerWorldLines({ lines, printMinutes: 443, laborMinutes: Number.NaN, config }), null);
  assert.equal(priceMakerWorldLines({ lines, printMinutes: 443, laborMinutes: 20, config: { ...config, marginPct: 100 } }), null);
});

test('medianUnitCostByMaterialType ignores inactive and unpriced materials', () => {
  const medians = medianUnitCostByMaterialType([
    { materialType: 'PLA', unitCostVndPerGram: 200 },
    { materialType: 'pla', unitCostVndPerGram: 400 },
    { materialType: 'PLA', unitCostVndPerGram: 300 },
    { materialType: 'PLA', unitCostVndPerGram: 9_999, isActive: false },
    { materialType: 'PETG', unitCostVndPerGram: 0 },
  ]);
  assert.equal(medians.get('PLA'), 300);
  assert.equal(medians.has('PETG'), false);
});
