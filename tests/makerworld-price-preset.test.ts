// Phase B Tầng 1 — verified MakerWorld price presets (makerworld-phase-b-storefront-estimate.md §5,
// ADR-0033): admin = storefront parity, re-pricing with the current config, fallbacks, validation.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { makerWorldPricePresetInputSchema } from '../src/domain/schemas.js';
import { buildMakerWorldMaterialLines, priceMakerWorldLines } from '../src/lib/pricing/makerworld-pricing.js';
import { lookupVerifiedPrices, repricePreset, savePricePreset, setPricePresetActive, type MaterialCostRow } from '../src/services/makerworld-price-preset.service.js';
import type { PricingConfigInput } from '../src/services/pricing.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const config: PricingConfigInput = {
  electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2,
  laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000,
};
const filaments = [
  { name: 'PLA #68724D', materialType: 'PLA', netWeightGrams: 120 },
  { name: 'PLA #000000', materialType: 'PLA', netWeightGrams: 48 },
];

// ---------------------------------------------------------------- pure

test('repricePreset: same inputs + same material costs + same config = the admin panel price (parity)', () => {
  const materials: MaterialCostRow[] = [
    { id: 'm1', materialType: 'PLA', unit: 'GRAM', costPerSpool: null, spoolWeightGrams: null, currentUnitCost: 300, isActive: true },
    { id: 'm2', materialType: 'PLA', unit: 'SPOOL', costPerSpool: 250_000, spoolWeightGrams: 1_000, currentUnitCost: null, isActive: true },
  ];
  // Admin side: exactly what MakerWorldQuotePanel computes.
  const adminLines = buildMakerWorldMaterialLines({
    filaments, colorsCount: 2, amsRequired: false, tier: 'KIT',
    choices: [{ unitCostVndPerGram: 300, materialId: 'm1' }, { unitCostVndPerGram: 250, materialId: 'm2' }],
  })!;
  const adminPrice = priceMakerWorldLines({ lines: adminLines, printMinutes: 443, laborMinutes: 20, config })!.finalPriceVnd;
  // Storefront side: stored inputs re-priced from the material table.
  const stored = adminLines.map(({ label, materialId, materialType, gram }) => ({ label, materialId: materialId!, materialType, gram }));
  const storefrontPrice = repricePreset({ materialLines: stored, printMinutes: 443, laborMinutes: 20, config, materials })!.finalPriceVnd;
  assert.equal(storefrontPrice, adminPrice);
});

test('repricePreset: deactivated spool falls back to the median of active materials of the same type', () => {
  const materials: MaterialCostRow[] = [
    { id: 'gone', materialType: 'PLA', unit: 'GRAM', costPerSpool: null, spoolWeightGrams: null, currentUnitCost: 999, isActive: false },
    { id: 'a', materialType: 'PLA', unit: 'GRAM', costPerSpool: null, spoolWeightGrams: null, currentUnitCost: 200, isActive: true },
    { id: 'b', materialType: 'PLA', unit: 'GRAM', costPerSpool: null, spoolWeightGrams: null, currentUnitCost: 400, isActive: true },
  ];
  const viaMedian = repricePreset({ materialLines: [{ label: 'x', materialId: 'gone', materialType: 'PLA', gram: 100 }], printMinutes: 60, laborMinutes: 20, config, materials });
  const direct = priceMakerWorldLines({ lines: [{ label: 'x', gram: 100, unitCostVndPerGram: 300 }], printMinutes: 60, laborMinutes: 20, config });
  assert.equal(viaMedian?.finalPriceVnd, direct?.finalPriceVnd);
});

test('repricePreset: no usable cost for a line → null (never a guessed price)', () => {
  const materials: MaterialCostRow[] = [{ id: 'gone', materialType: 'PETG', unit: 'GRAM', costPerSpool: null, spoolWeightGrams: null, currentUnitCost: 300, isActive: false }];
  assert.equal(repricePreset({ materialLines: [{ label: 'x', materialId: 'gone', materialType: 'PETG', gram: 100 }], printMinutes: 60, laborMinutes: 20, config, materials }), null);
});

test('preset input schema accepts inputs only — no price fields, printMinutes must match the snapshot', () => {
  const base = presetInput(randomUUID(), randomUUID(), 'KIT');
  assert.equal(makerWorldPricePresetInputSchema.safeParse(base).success, true);
  assert.equal(makerWorldPricePresetInputSchema.safeParse({ ...base, finalPriceVnd: 1 }).success, false);
  assert.equal(makerWorldPricePresetInputSchema.safeParse({ ...base, printMinutes: 500 }).success, false);
  assert.equal(makerWorldPricePresetInputSchema.safeParse({ ...base, sourceUrl: 'https://evil.com/models/1' }).success, false);
});

// ---------------------------------------------------------------- DB

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';

function presetInput(materialId: string, pricingConfigId: string, tier: 'ASSEMBLED' | 'KIT', modelId = '3246150') {
  return {
    sourceUrl: `https://makerworld.com/en/models/${modelId}-frankenstein#profileId-3678340`,
    profileId: '3678340',
    tier,
    profileSnapshot: {
      modelTitle: "Frankenstein's Monster", profileTitle: '0.2mm layer, 2 walls, 15% infill',
      profileCoverImageUrl: 'https://makerworld.bblmw.com/makerworld/model/x/instance/a.png', printerTarget: 'P1S',
      platesCount: 6, printMinutes: 443, netWeightGrams: 168, amsRequired: false, colorsCount: 1,
      license: 'Standard Digital File License', dataSource: 'RESOLVER' as const,
    },
    materialLines: [{ label: 'PLA #68724D (PLA)', materialId, materialType: 'PLA', gram: 176.4 }],
    printMinutes: 443,
    laborMinutes: tier === 'KIT' ? 20 : 50,
    pricingConfigId,
  };
}

async function seedConfig(laborVndPerHour = 35_000): Promise<string> {
  const id = randomUUID();
  await query(`insert into pricing_configs (id, electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw, labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd, effective_from)
    values ($1, 3500, 15000000, 10000, 0.2, $2, 10, 40, 5000, timezone('utc', now()) - interval '1 second')`, [id, laborVndPerHour]);
  return id;
}
async function seedMaterial(type = 'PLA', cost = 300): Promise<string> {
  const id = randomUUID();
  await query(`insert into materials (id, name, material_type, unit, current_unit_cost, is_active) values ($1, $2, $3, 'GRAM', $4, true)`, [id, `Preset test ${id.slice(0, 6)}`, type, cost]);
  return id;
}
const uniqueModelId = () => String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000));

test('save → lookup returns the verified price for both tiers; KIT < ASSEMBLED', { skip: !hasDb }, async () => {
  const configId = await seedConfig();
  const materialId = await seedMaterial();
  const modelId = uniqueModelId();
  const kit = await savePricePreset(makerWorldPricePresetInputSchema.parse(presetInput(materialId, configId, 'KIT', modelId)), ACTOR_ID);
  const assembled = await savePricePreset(makerWorldPricePresetInputSchema.parse(presetInput(materialId, configId, 'ASSEMBLED', modelId)), ACTOR_ID);
  assert.ok(kit.finalPriceVnd < assembled.finalPriceVnd);
  const lookup = await lookupVerifiedPrices(modelId);
  assert.equal(lookup.profiles.length, 1);
  assert.equal(lookup.profiles[0].prices.KIT, kit.finalPriceVnd);
  assert.equal(lookup.profiles[0].prices.ASSEMBLED, assembled.finalPriceVnd);
});

test('lookup re-prices with the CURRENT pricing config (owner decision D3)', { skip: !hasDb }, async () => {
  const configId = await seedConfig();
  const materialId = await seedMaterial();
  const modelId = uniqueModelId();
  const saved = await savePricePreset(makerWorldPricePresetInputSchema.parse(presetInput(materialId, configId, 'KIT', modelId)), ACTOR_ID);
  await seedConfig(80_000); // newer, more expensive labor
  const lookup = await lookupVerifiedPrices(modelId);
  assert.ok((lookup.profiles[0].prices.KIT ?? 0) > saved.finalPriceVnd);
});

test('saving again replaces the active preset (one active per model/profile/tier, history kept)', { skip: !hasDb }, async () => {
  const configId = await seedConfig();
  const materialId = await seedMaterial();
  const modelId = uniqueModelId();
  await savePricePreset(makerWorldPricePresetInputSchema.parse(presetInput(materialId, configId, 'KIT', modelId)), ACTOR_ID);
  await savePricePreset(makerWorldPricePresetInputSchema.parse({ ...presetInput(materialId, configId, 'KIT', modelId), laborMinutes: 30 }), ACTOR_ID);
  const rows = await query<{ is_active: boolean; labor_minutes: number }>('select is_active, labor_minutes from makerworld_price_presets where model_id = $1 order by created_at', [modelId]);
  assert.deepEqual(rows.rows.map((r) => [r.is_active, r.labor_minutes]), [[false, 20], [true, 30]]);
});

test('save rejects an inactive/unknown material and an unknown config', { skip: !hasDb }, async () => {
  const configId = await seedConfig();
  await assert.rejects(
    () => savePricePreset(makerWorldPricePresetInputSchema.parse(presetInput(randomUUID(), configId, 'KIT', uniqueModelId())), ACTOR_ID),
    (error: unknown) => error instanceof DomainError && error.code === 'MATERIAL_NOT_FOUND',
  );
  const materialId = await seedMaterial();
  await assert.rejects(
    () => savePricePreset(makerWorldPricePresetInputSchema.parse(presetInput(materialId, randomUUID(), 'KIT', uniqueModelId())), ACTOR_ID),
    (error: unknown) => error instanceof DomainError && error.code === 'PRICING_CONFIG_NOT_FOUND',
  );
});

test('disabled presets disappear from the storefront lookup; re-enabling clashes with a newer active one', { skip: !hasDb }, async () => {
  const configId = await seedConfig();
  const materialId = await seedMaterial();
  const modelId = uniqueModelId();
  const first = await savePricePreset(makerWorldPricePresetInputSchema.parse(presetInput(materialId, configId, 'KIT', modelId)), ACTOR_ID);
  await setPricePresetActive(first.id, false, ACTOR_ID);
  assert.equal((await lookupVerifiedPrices(modelId)).profiles.length, 0);
  await savePricePreset(makerWorldPricePresetInputSchema.parse(presetInput(materialId, configId, 'KIT', modelId)), ACTOR_ID);
  await assert.rejects(() => setPricePresetActive(first.id, true, ACTOR_ID), (error: unknown) => error instanceof DomainError && error.code === 'PRESET_ACTIVE_EXISTS');
});
