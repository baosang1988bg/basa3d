// Phase 33 S1 — versioned VAT (plan §4A, §5.3, §6.4).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { computeQuoteTotals, computeVat, vatPercentToBps } from '../src/lib/pricing/vat.js';
import { pricingConfigInputSchema, quoteInputSchema } from '../src/domain/schemas.js';
import { createPricingConfig, getCurrentPricingConfig } from '../src/services/pricing-config.service.js';
import { createQuote, listQuotesByCustomRequest } from '../src/services/quote.service.js';
import { createOrder } from '../src/services/order.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const CONFIG_INPUT = {
  electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000,
  printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000,
};

// ---------------------------------------------------------------------------------------------
// Unit: computeVat / computeQuoteTotals / percent → bps
// ---------------------------------------------------------------------------------------------

test('computeVat: 0 bps → 0, 800 bps → 8%, 1000 bps → 10%', () => {
  assert.equal(computeVat(100_000, 0), 0);
  assert.equal(computeVat(100_000, 800), 8_000);
  assert.equal(computeVat(100_000, 1000), 10_000);
  assert.equal(computeVat(0, 800), 0);
});

test('computeVat rounds half-up to whole VND, same as Math.round(base * bps / 10000)', () => {
  assert.equal(computeVat(12_345, 800), 988); // 987.6 → 988
  assert.equal(computeVat(6_250, 800), 500); // exact
  assert.equal(computeVat(1_875, 800), 150); // exact
  assert.equal(computeVat(1_250, 1), 0); // 0.125 → 0
  assert.equal(computeVat(5_000, 1), 1); // 0.5 → 1 (half-up)
  assert.equal(computeVat(15_000, 1), 2); // 1.5 → 2
  for (const [base, bps] of [[1, 5_000], [3, 5_000], [99_999, 799], [123_456_789, 833]]) {
    assert.equal(computeVat(base, bps), Math.round((base * bps) / 10_000), `${base} @ ${bps}`);
  }
});

test('computeVat handles large values without precision loss', () => {
  assert.equal(computeVat(1_000_000_000_000, 800), 80_000_000_000);
  // base * rate exceeds 2^53 — BigInt keeps it exact.
  assert.equal(computeVat(Number.MAX_SAFE_INTEGER, 10_000), Number.MAX_SAFE_INTEGER);
});

test('computeVat rejects floats, negatives and out-of-range rates', () => {
  assert.throws(() => computeVat(100.5, 800), RangeError);
  assert.throws(() => computeVat(-1, 800), RangeError);
  assert.throws(() => computeVat(100, 8.5), RangeError);
  assert.throws(() => computeVat(100, -800), RangeError);
  assert.throws(() => computeVat(100, 10_001), RangeError);
  assert.throws(() => computeVat(Number.NaN, 800), RangeError);
});

test('computeQuoteTotals: base = subtotal + shipping − discount; disabled VAT forces rate 0', () => {
  assert.deepEqual(
    computeQuoteTotals({ subtotal: 100_000, shippingFee: 20_000, discount: 10_000 }, { enabled: true, rateBps: 800 }),
    { vatRateBps: 800, vatAmount: 8_800, total: 118_800 },
  );
  assert.deepEqual(
    computeQuoteTotals({ subtotal: 100_000, shippingFee: 20_000, discount: 10_000 }, { enabled: false, rateBps: 800 }),
    { vatRateBps: 0, vatAmount: 0, total: 110_000 },
  );
});

test('vatPercentToBps converts the admin percent input server-side', () => {
  assert.equal(vatPercentToBps('8'), 800);
  assert.equal(vatPercentToBps('8.5'), 850);
  assert.equal(vatPercentToBps('8,5'), 850);
  assert.equal(vatPercentToBps(''), 0);
  assert.equal(vatPercentToBps(null), 0);
  assert.ok(Number.isNaN(vatPercentToBps('8.125')));
  assert.ok(Number.isNaN(vatPercentToBps('-8')));
  assert.ok(Number.isNaN(vatPercentToBps('abc')));
});

test('pricingConfigInputSchema: VAT defaults off, integer bps 0–10000, rate > 0 required when enabled', () => {
  const parsed = pricingConfigInputSchema.parse(CONFIG_INPUT);
  assert.equal(parsed.vatEnabled, false);
  assert.equal(parsed.vatRateBps, 0);
  assert.equal(pricingConfigInputSchema.safeParse({ ...CONFIG_INPUT, vatEnabled: true, vatRateBps: 800 }).success, true);
  assert.equal(pricingConfigInputSchema.safeParse({ ...CONFIG_INPUT, vatEnabled: true, vatRateBps: 0 }).success, false);
  assert.equal(pricingConfigInputSchema.safeParse({ ...CONFIG_INPUT, vatRateBps: 10_001 }).success, false);
  assert.equal(pricingConfigInputSchema.safeParse({ ...CONFIG_INPUT, vatRateBps: 8.5 }).success, false);
  assert.equal(pricingConfigInputSchema.safeParse({ ...CONFIG_INPUT, vatRateBps: Number.NaN }).success, false);
});

test('quoteInputSchema accepts a total that includes VAT but rejects one below the pre-VAT amount', () => {
  const base = { customRequestId: randomUUID(), subtotal: 100_000, validUntil: new Date().toISOString() };
  assert.equal(quoteInputSchema.safeParse({ ...base, total: 108_000 }).success, true);
  assert.equal(quoteInputSchema.safeParse({ ...base, total: 100_000 }).success, true);
  assert.equal(quoteInputSchema.safeParse({ ...base, total: 99_000 }).success, false);
});

test('VAT migration contract: columns, renamed total checks, DO-block guard, no formula in the DB', async () => {
  const sql = await readFile('supabase/migrations/20261015000000_vat_versioned.sql', 'utf8');
  assert.match(sql, /alter table pricing_configs[\s\S]*?add column vat_enabled boolean not null default false/);
  assert.match(sql, /add column vat_rate_bps integer not null default 0 check \(vat_rate_bps between 0 and 10000\)/);
  assert.match(sql, /add constraint pricing_configs_vat_rate_when_enabled check \(not vat_enabled or vat_rate_bps > 0\)/);
  assert.match(sql, /alter table quotes[\s\S]*?add column vat_amount bigint not null default 0 check \(vat_amount >= 0\)/);
  assert.match(sql, /alter table orders[\s\S]*?add column vat_amount bigint not null default 0 check \(vat_amount >= 0\)/);
  assert.match(sql, /quotes_total_with_vat check \([\s\S]*?total = subtotal \+ shipping_fee - discount \+ vat_amount[\s\S]*?vat_rate_bps > 0 or vat_amount = 0/);
  assert.match(sql, /orders_total_with_vat check \([\s\S]*?total = subtotal \+ shipping_fee \+ cod_fee - discount \+ vat_amount[\s\S]*?vat_rate_bps > 0 or vat_amount = 0/);
  assert.equal((sql.match(/raise exception/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /vat_rate_bps \/ 10000|\* vat_rate_bps/);
});

// ---------------------------------------------------------------------------------------------
// Integration (real DB)
// ---------------------------------------------------------------------------------------------

async function insertCustomRequest(): Promise<string> {
  const id = randomUUID();
  await query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
     values ($1, $2, 'OTHER', 'VAT Test', '0900000000', 'phase 33 vat test', 1)`,
    [id, `CR-VAT${id.slice(0, 8).toUpperCase()}`],
  );
  return id;
}

/** Makes a VAT config "current" for the duration of `work`, then deletes it so later test files
 * (which create quotes with total = subtotal) keep seeing VAT off. */
async function withVatConfig<T>(vat: { vatEnabled: boolean; vatRateBps: number }, work: () => Promise<T>): Promise<T> {
  const { id } = await createPricingConfig({ ...CONFIG_INPUT, ...vat }, ACTOR_ID);
  try {
    return await work();
  } finally {
    await query('update quotes set pricing_config_id = null where pricing_config_id = $1', [id]);
    await query('delete from pricing_configs where id = $1', [id]);
  }
}

const validUntil = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

test('pricing config read path returns real VAT numbers; DB rejects vat_enabled with rate 0', { skip: !hasDb }, async () => {
  await withVatConfig({ vatEnabled: true, vatRateBps: 800 }, async () => {
    const current = await getCurrentPricingConfig();
    assert.equal(current?.vatEnabled, true);
    assert.equal(current?.vatRateBps, 800);
    assert.equal(typeof current?.vatRateBps, 'number');
  });
  await assert.rejects(
    query(`insert into pricing_configs (electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw,
      labor_vnd_per_hour, failure_buffer_pct, margin_pct, vat_enabled, vat_rate_bps) values (3500, 1, 1, 0.2, 1, 1, 1, true, 0)`),
    /pricing_configs_vat_rate_when_enabled/,
  );
});

test('VAT off: createQuote stores identical totals to before and vat_amount = 0', { skip: !hasDb }, async () => {
  await withVatConfig({ vatEnabled: false, vatRateBps: 0 }, async () => {
    const customRequestId = await insertCustomRequest();
    const quote = await createQuote({ customRequestId, subtotal: 100_000, shippingFee: 20_000, discount: 5_000, total: 115_000, validUntil: validUntil() }, ACTOR_ID);
    const row = (await query<{ total: string; vat_amount: string; vat_rate_bps: number }>('select total, vat_amount, vat_rate_bps from quotes where id = $1', [quote.id])).rows[0];
    assert.equal(Number(row.total), 115_000);
    assert.equal(Number(row.vat_amount), 0);
    assert.equal(row.vat_rate_bps, 0);
    const [summary] = await listQuotesByCustomRequest(customRequestId);
    assert.equal(summary.vatAmount, 0);
    assert.equal(summary.total, 115_000);
  });
});

test('VAT on at 800 bps: vat_amount and total are computed server-side from the current config', { skip: !hasDb }, async () => {
  await withVatConfig({ vatEnabled: true, vatRateBps: 800 }, async () => {
    const customRequestId = await insertCustomRequest();
    const quote = await createQuote({ customRequestId, subtotal: 100_000, shippingFee: 20_000, discount: 10_000, total: 118_800, validUntil: validUntil() }, ACTOR_ID);
    const row = (await query<{ total: string; vat_amount: string; vat_rate_bps: number }>('select total, vat_amount, vat_rate_bps from quotes where id = $1', [quote.id])).rows[0];
    assert.equal(Number(row.vat_amount), 8_800);
    assert.equal(row.vat_rate_bps, 800);
    assert.equal(Number(row.total), 118_800);
    const [summary] = await listQuotesByCustomRequest(customRequestId);
    assert.equal(summary.vatRateBps, 800);
    assert.equal(summary.vatAmount, 8_800);
  });
});

test('createQuote rejects a client total that does not match the server total (QUOTE_TOTAL_MISMATCH)', { skip: !hasDb }, async () => {
  await withVatConfig({ vatEnabled: true, vatRateBps: 800 }, async () => {
    const customRequestId = await insertCustomRequest();
    // Client "forgot" the VAT — must not be silently stored without it, nor with it.
    await assert.rejects(
      createQuote({ customRequestId, subtotal: 100_000, total: 100_000, validUntil: validUntil() }, ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'QUOTE_TOTAL_MISMATCH' && error.status === 400,
    );
    const count = await query<{ count: string }>('select count(*) from quotes where custom_request_id = $1', [customRequestId]);
    assert.equal(Number(count.rows[0].count), 0);
  });
});

test('raw SQL: quotes reject a wrong total and VAT money without a rate', { skip: !hasDb }, async () => {
  const customRequestId = await insertCustomRequest();
  const insert = (subtotal: number, total: number, vatRateBps: number, vatAmount: number) => query(
    `insert into quotes (custom_request_id, quote_number, subtotal, total, valid_until, vat_rate_bps, vat_amount)
     values ($1, $2, $3, $4, now() + interval '1 day', $5, $6)`,
    [customRequestId, `Q-VAT${randomUUID().slice(0, 8).toUpperCase()}`, subtotal, total, vatRateBps, vatAmount],
  );
  await assert.rejects(insert(100_000, 100_000, 800, 8_000), /quotes_total_with_vat/); // total excludes VAT
  await assert.rejects(insert(100_000, 108_000, 0, 8_000), /quotes_total_with_vat/); // VAT money, rate 0
  await insert(100_000, 108_000, 800, 8_000); // correct row is accepted
  await insert(100_000, 100_000, 800, 0); // rate without money is fine (e.g. base 0 / rounding)
});

test('raw SQL: orders reject a wrong total and VAT money without a rate', { skip: !hasDb }, async () => {
  const insert = (total: number, vatRateBps: number, vatAmount: number) => query(
    `insert into orders (order_number, customer_name, customer_phone, subtotal, shipping_fee, cod_fee, discount, total, vat_rate_bps, vat_amount)
     values ($1, 'VAT Order Test', '0900000000', 100000, 20000, 0, 0, $2, $3, $4)`,
    [`ORD-VAT${randomUUID().slice(0, 8).toUpperCase()}`, total, vatRateBps, vatAmount],
  );
  await assert.rejects(insert(120_000, 800, 9_600), /orders_total_with_vat/);
  await assert.rejects(insert(129_600, 0, 9_600), /orders_total_with_vat/);
  await insert(129_600, 800, 9_600);
  await insert(120_000, 0, 0);
});

test('existing createOrder still works and stores VAT 0/0', { skip: !hasDb }, async () => {
  const productId = randomUUID();
  const variantId = randomUUID();
  await query(`insert into products (id, name, slug, product_type, status) values ($1, 'VAT Order Product', $2, 'READY_STOCK', 'ACTIVE')`, [productId, `vat-order-${productId.slice(0, 8)}`]);
  await query(`insert into product_variants (id, product_id, sku, name, price) values ($1, $2, $3, 'One', 50000)`, [variantId, productId, `TEST-VAT-${productId.slice(0, 8).toUpperCase()}`]);
  const warehouseId = randomUUID();
  await query(`insert into warehouses (id, name, code) values ($1, 'VAT Test Warehouse', $2)`, [warehouseId, `TV${productId.slice(0, 8).toUpperCase()}`]);
  await query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ($1, $2, 'PRODUCTION_IN', 2, 'VAT test stock')`, [warehouseId, variantId]);
  const order = await createOrder({ customerName: 'VAT Order Test', customerPhone: '0900000000', shippingFee: 20_000, items: [{ variantId, quantity: 1 }] }, ACTOR_ID);
  const row = (await query<{ total: string; vat_amount: string; vat_rate_bps: number }>('select total, vat_amount, vat_rate_bps from orders where id = $1', [order.id])).rows[0];
  assert.equal(Number(row.total), 70_000);
  assert.equal(Number(row.vat_amount), 0);
  assert.equal(row.vat_rate_bps, 0);
});
