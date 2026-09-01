import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { getPool, query } from '../src/lib/db.js';
import { computePricingBreakdown } from '../src/services/pricing.service.js';
import { createPricingConfig } from '../src/services/pricing-config.service.js';
import { createQuote } from '../src/services/quote.service.js';
import { createProduct, updateProduct } from '../src/services/product.service.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const CONFIG_INPUT = {
  electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000,
  printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000,
};

test('createQuote persists pricingBreakdown/pricingConfigId when provided, and still works with neither (backward compatible)', { skip: !process.env.DATABASE_URL }, async () => {
  const { id: configId } = await createPricingConfig(CONFIG_INPUT, ACTOR_ID);
  const breakdown = computePricingBreakdown({
    materials: [{ label: 'PLA', gram: 50, unitCostVndPerGram: 160 }],
    printMinutes: 180, laborMinutes: 30, config: CONFIG_INPUT,
  });

  const customRequestId = randomUUID();
  const suffix = customRequestId.slice(0, 8).toUpperCase();
  await query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
     values ($1, $2, 'OTHER', 'Pricing Snapshot Test', '0900000000', 'test', 1)`,
    [customRequestId, `CR-${suffix}`],
  );
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const withBreakdown = await createQuote({
    customRequestId, subtotal: breakdown.finalPriceVnd, total: breakdown.finalPriceVnd, validUntil,
    pricingBreakdown: breakdown, pricingConfigId: configId,
  }, ACTOR_ID);
  const stored = await query<{ pricing_breakdown: unknown; pricing_config_id: string }>(
    'select pricing_breakdown, pricing_config_id from quotes where id = $1', [withBreakdown.id],
  );
  assert.equal(stored.rows[0].pricing_config_id, configId);
  assert.equal((stored.rows[0].pricing_breakdown as { finalPriceVnd: number }).finalPriceVnd, breakdown.finalPriceVnd);

  // Manual quote (no pricing engine involved) — must still work, both columns stay null.
  const manual = await createQuote({ customRequestId, subtotal: 50_000, total: 50_000, validUntil }, ACTOR_ID);
  const storedManual = await query<{ pricing_breakdown: unknown; pricing_config_id: string | null }>(
    'select pricing_breakdown, pricing_config_id from quotes where id = $1', [manual.id],
  );
  assert.equal(storedManual.rows[0].pricing_breakdown, null);
  assert.equal(storedManual.rows[0].pricing_config_id, null);
});

test('a Quote breakdown does not change when a newer pricing_configs row is created afterwards (snapshot immutability, business-rules #3/#7)', { skip: !process.env.DATABASE_URL }, async () => {
  const { id: configId } = await createPricingConfig(CONFIG_INPUT, ACTOR_ID);
  const breakdown = computePricingBreakdown({
    materials: [{ label: 'PLA', gram: 50, unitCostVndPerGram: 160 }],
    printMinutes: 180, laborMinutes: 30, config: CONFIG_INPUT,
  });
  const customRequestId = randomUUID();
  const suffix = customRequestId.slice(0, 8).toUpperCase();
  await query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
     values ($1, $2, 'OTHER', 'Pricing Snapshot Immutability Test', '0900000000', 'test', 1)`,
    [customRequestId, `CR-${suffix}`],
  );
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const quote = await createQuote({
    customRequestId, subtotal: breakdown.finalPriceVnd, total: breakdown.finalPriceVnd, validUntil,
    pricingBreakdown: breakdown, pricingConfigId: configId,
  }, ACTOR_ID);

  // OWNER changes margin after the fact.
  await createPricingConfig({ ...CONFIG_INPUT, marginPct: 60 }, ACTOR_ID);

  const stored = await query<{ pricing_breakdown: { finalPriceVnd: number }; pricing_config_id: string }>(
    'select pricing_breakdown, pricing_config_id from quotes where id = $1', [quote.id],
  );
  assert.equal(stored.rows[0].pricing_config_id, configId);
  assert.equal(stored.rows[0].pricing_breakdown.finalPriceVnd, breakdown.finalPriceVnd);
});

test('createProduct persists pricingBreakdown/pricingConfigId when provided, and still works with neither', { skip: !process.env.DATABASE_URL }, async () => {
  const { id: configId } = await createPricingConfig(CONFIG_INPUT, ACTOR_ID);
  const breakdown = computePricingBreakdown({
    materials: [{ label: 'PLA', gram: 30, unitCostVndPerGram: 160 }],
    printMinutes: 120, laborMinutes: 20, config: CONFIG_INPUT,
  });
  const slugSuffix = randomUUID().slice(0, 8);

  const withBreakdown = await createProduct({
    name: `Pricing Test Product ${slugSuffix}`, slug: `pricing-test-product-${slugSuffix}`,
    productType: 'READY_STOCK', status: 'DRAFT', basePrice: breakdown.finalPriceVnd,
    pricingBreakdown: breakdown, pricingConfigId: configId,
  }, ACTOR_ID);
  const stored = await query<{ pricing_breakdown: { finalPriceVnd: number }; pricing_config_id: string }>(
    'select pricing_breakdown, pricing_config_id from products where id = $1', [withBreakdown.id],
  );
  assert.equal(stored.rows[0].pricing_config_id, configId);
  assert.equal(stored.rows[0].pricing_breakdown.finalPriceVnd, breakdown.finalPriceVnd);

  const manual = await createProduct({
    name: `Manual Product ${slugSuffix}`, slug: `manual-product-${slugSuffix}`,
    productType: 'READY_STOCK', status: 'DRAFT', basePrice: 99_000,
  }, ACTOR_ID);
  const storedManual = await query<{ pricing_breakdown: unknown; pricing_config_id: string | null }>(
    'select pricing_breakdown, pricing_config_id from products where id = $1', [manual.id],
  );
  assert.equal(storedManual.rows[0].pricing_breakdown, null);
  assert.equal(storedManual.rows[0].pricing_config_id, null);
});

test('a Product CAN be explicitly repriced — updateProduct overwrites basePrice + snapshot together (ADR-0022, unlike Quote which has no update path)', { skip: !process.env.DATABASE_URL }, async () => {
  const { id: firstConfigId } = await createPricingConfig(CONFIG_INPUT, ACTOR_ID);
  const firstBreakdown = computePricingBreakdown({
    materials: [{ label: 'PLA', gram: 30, unitCostVndPerGram: 160 }],
    printMinutes: 120, laborMinutes: 20, config: CONFIG_INPUT,
  });
  const slugSuffix = randomUUID().slice(0, 8);
  const product = await createProduct({
    name: `Reprice Test Product ${slugSuffix}`, slug: `reprice-test-product-${slugSuffix}`,
    productType: 'READY_STOCK', status: 'DRAFT', basePrice: firstBreakdown.finalPriceVnd,
    pricingBreakdown: firstBreakdown, pricingConfigId: firstConfigId,
  }, ACTOR_ID);

  // OWNER changes margin, staff re-opens the product and reprices with the new config.
  const { id: secondConfigId } = await createPricingConfig({ ...CONFIG_INPUT, marginPct: 55 }, ACTOR_ID);
  const secondBreakdown = computePricingBreakdown({
    materials: [{ label: 'PLA', gram: 30, unitCostVndPerGram: 160 }],
    printMinutes: 120, laborMinutes: 20, config: { ...CONFIG_INPUT, marginPct: 55 },
  });
  assert.notEqual(secondBreakdown.finalPriceVnd, firstBreakdown.finalPriceVnd);

  await updateProduct(product.id, {
    basePrice: secondBreakdown.finalPriceVnd, pricingBreakdown: secondBreakdown, pricingConfigId: secondConfigId,
  }, ACTOR_ID);

  const stored = await query<{ base_price: number; pricing_breakdown: { finalPriceVnd: number }; pricing_config_id: string }>(
    'select base_price, pricing_breakdown, pricing_config_id from products where id = $1', [product.id],
  );
  assert.equal(Number(stored.rows[0].base_price), secondBreakdown.finalPriceVnd);
  assert.equal(stored.rows[0].pricing_config_id, secondConfigId);
  assert.equal(stored.rows[0].pricing_breakdown.finalPriceVnd, secondBreakdown.finalPriceVnd);
});
