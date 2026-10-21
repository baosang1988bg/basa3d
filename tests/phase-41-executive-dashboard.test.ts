import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import {
  averageOrderValue, filamentThresholdGrams, formatPctChange, formatVndCompact, isFilamentBelowThreshold,
  niceAxisTicks, pctChange, resolveDashboardTab, weekdayLabel,
} from '../src/lib/executive-metrics.js';
import { warningTier } from '../src/services/filament.service.js';
import { getExecutiveBusinessMetrics, type ExecutiveBusinessMetrics } from '../src/services/dashboard.service.js';

configureTestEnvironment();
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

// ---------------------------------------------------------------------------------------------
// Pure helpers (no DB)
// ---------------------------------------------------------------------------------------------

test('pctChange: previous 0 has no base (null), never Infinity or a misleading 0%', () => {
  assert.equal(pctChange(5_000_000, 0), null);
  assert.equal(pctChange(0, 0), null);
  assert.equal(pctChange(120, 100), 20);
  assert.equal(pctChange(80, 100), -20);
  assert.equal(pctChange(100, 100), 0);
  assert.equal(pctChange(1_226_000, 1_021_000), 20.1);
  assert.equal(formatPctChange(null), '—');
  assert.equal(formatPctChange(20.1), '+20,1%');
  assert.equal(formatPctChange(-3), '-3%');
  assert.equal(formatPctChange(0), '0%');
});

test('averageOrderValue stays integer VND and is 0 for 0 orders', () => {
  assert.equal(averageOrderValue(0, 0), 0);
  assert.equal(averageOrderValue(1_000_000, 0), 0);
  assert.equal(averageOrderValue(1_000_000, 3), 333_333);
  assert.ok(Number.isInteger(averageOrderValue(2, 3)));
});

test('formatVndCompact', () => {
  assert.equal(formatVndCompact(0), '0₫');
  assert.equal(formatVndCompact(850), '850₫');
  assert.equal(formatVndCompact(215_000), '215k₫');
  assert.equal(formatVndCompact(999_600), '1 tr₫');
  assert.equal(formatVndCompact(122_600_000), '122,6 tr₫');
  assert.equal(formatVndCompact(999_960_000), '1 tỷ₫');
  assert.equal(formatVndCompact(1_250_000_000), '1,25 tỷ₫');
});

test('niceAxisTicks uses a 1-2-5 step from 0 and covers the max', () => {
  assert.deepEqual(niceAxisTicks(7_300_000), [0, 2_000_000, 4_000_000, 6_000_000, 8_000_000]);
  assert.deepEqual(niceAxisTicks(0), [0]);
  assert.deepEqual(niceAxisTicks(4_100_000), [0, 2_000_000, 4_000_000, 6_000_000]);
  assert.deepEqual(niceAxisTicks(1_000_001), [0, 500_000, 1_000_000, 1_500_000]);
  assert.deepEqual(niceAxisTicks(3), [0, 1, 2, 3]);
  for (const max of [1, 9, 55, 999, 123_456, 98_765_432]) {
    const ticks = niceAxisTicks(max);
    assert.ok(ticks[ticks.length - 1] >= max, `ticks for ${max} must reach the max`);
    assert.ok(ticks[ticks.length - 2] < max, `ticks for ${max} must not overshoot by a whole step`);
    assert.ok(ticks.every(Number.isInteger));
  }
});

test('resolveDashboardTab: STAFF can never resolve to the business tab (ADR-0011 boundary #2)', () => {
  for (const raw of [undefined, 'business', 'operations', ['business'], 'BUSINESS', '', 42]) {
    assert.equal(resolveDashboardTab('STAFF', raw), 'operations');
  }
  assert.equal(resolveDashboardTab('OWNER', undefined), 'business');
  assert.equal(resolveDashboardTab('OWNER', 'business'), 'business');
  assert.equal(resolveDashboardTab('OWNER', 'operations'), 'operations');
  assert.equal(resolveDashboardTab('OWNER', ['operations']), 'business');
  assert.equal(resolveDashboardTab('OWNER', 'garbage'), 'business');
});

test('filament threshold is the same SAP_HET cutoff as filament.service.ts warningTier()', () => {
  for (const used of [0, 500, 790, 799, 800, 801, 950, 1000]) {
    const remaining = 1000 - used;
    const tier = warningTier(1000, used);
    assert.equal(isFilamentBelowThreshold(remaining, 1000), tier === 'SAP_HET' || tier === 'DA_HET', `used ${used}g`);
  }
  assert.equal(filamentThresholdGrams(2000), 400);
  assert.equal(isFilamentBelowThreshold(400, 2000), true);
  assert.equal(isFilamentBelowThreshold(401, 2000), false);
});

test('weekdayLabel maps Postgres isodow', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(weekdayLabel), ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
});

// ---------------------------------------------------------------------------------------------
// Integration (local test DB) — assertions are deltas, because the test DB is shared.
// ---------------------------------------------------------------------------------------------

const needsDb = { skip: !process.env.DATABASE_URL };

async function insertOrder(input: {
  tag: string; total: number; shippingFee?: number; daysAgo: number;
  status?: string; paymentStatus?: string; items: { variantId: string | null; lineTotal: number }[];
}): Promise<void> {
  const shippingFee = input.shippingFee ?? 0;
  const order = await query<{ id: string }>(
    `insert into orders (order_number, customer_name, customer_phone, subtotal, shipping_fee, total, status, payment_status, created_at)
     values ($1, 'Phase 41 test', '0900000041', $2, $3, $4, $5::order_status, $6::payment_status, now() - make_interval(days => $7))
     returning id`,
    [`P41-${input.tag}-${randomUUID().slice(0, 8)}`, input.total - shippingFee, shippingFee, input.total,
      input.status ?? 'COMPLETED', input.paymentStatus ?? 'PAID', input.daysAgo],
  );
  for (const item of input.items) {
    await query(
      `insert into order_items (order_id, variant_id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total)
       values ($1, $2, 'P41 product', 'P41 variant', 'P41-SKU', 1, $3, $3)`,
      [order.rows[0].id, item.variantId, item.lineTotal],
    );
  }
}

function uncategorized(metrics: ExecutiveBusinessMetrics) {
  return metrics.categoryRevenue.find((row) => row.categoryId === null) ?? { revenue: 0, orderCount: 0 };
}

test('executive revenue: 30d vs previous 30d, excludes CANCELLED/REFUNDED, buckets categories', needsDb, async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const category = await query<{ id: string }>(`insert into categories (name, slug) values ($1, $2) returning id`, [`P41 Danh mục ${suffix}`, `p41-${suffix}`]);
  const product = await query<{ id: string }>(
    `insert into products (category_id, name, slug, product_type) values ($1, 'P41 sản phẩm', $2, 'READY_STOCK') returning id`,
    [category.rows[0].id, `p41-product-${suffix}`],
  );
  const variant = await query<{ id: string }>(
    `insert into product_variants (product_id, sku, name, price) values ($1, $2, 'Mặc định', 100000) returning id`,
    [product.rows[0].id, `P41-${suffix.toUpperCase()}`],
  );
  const variantId = variant.rows[0].id;

  const before = await getExecutiveBusinessMetrics();
  await insertOrder({ tag: 'current', total: 250_000, shippingFee: 50_000, daysAgo: 2, items: [{ variantId, lineTotal: 200_000 }] });
  await insertOrder({ tag: 'no-variant', total: 50_000, daysAgo: 3, items: [{ variantId: null, lineTotal: 50_000 }] });
  await insertOrder({ tag: 'cancelled', total: 999_000, daysAgo: 0, status: 'CANCELLED', items: [{ variantId, lineTotal: 999_000 }] });
  await insertOrder({ tag: 'refunded', total: 777_000, daysAgo: 1, paymentStatus: 'REFUNDED', items: [{ variantId, lineTotal: 777_000 }] });
  await insertOrder({ tag: 'previous', total: 300_000, daysAgo: 40, items: [{ variantId, lineTotal: 300_000 }] });
  await insertOrder({ tag: 'too-old', total: 123_000, daysAgo: 61, items: [{ variantId, lineTotal: 123_000 }] });
  const afterMetrics = await getExecutiveBusinessMetrics();

  assert.equal(afterMetrics.revenue30d.current - before.revenue30d.current, 300_000);
  assert.equal(afterMetrics.revenue30d.previous - before.revenue30d.previous, 300_000);
  assert.equal(afterMetrics.orders30d.current - before.orders30d.current, 2);
  assert.equal(afterMetrics.orders30d.previous - before.orders30d.previous, 1);
  assert.equal(afterMetrics.aov30d.current, averageOrderValue(afterMetrics.revenue30d.current, afterMetrics.orders30d.current));
  assert.equal(afterMetrics.revenue30d.pctChange, pctChange(afterMetrics.revenue30d.current, afterMetrics.revenue30d.previous));

  // Category = merchandise line_total of eligible orders in the current period only.
  const testCategory = afterMetrics.categoryRevenue.find((row) => row.categoryId === category.rows[0].id);
  assert.deepEqual(testCategory && { revenue: testCategory.revenue, orderCount: testCategory.orderCount }, { revenue: 200_000, orderCount: 1 });
  assert.equal(uncategorized(afterMetrics).revenue - uncategorized(before).revenue, 50_000);
  assert.equal(uncategorized(afterMetrics).orderCount - uncategorized(before).orderCount, 1);
  assert.equal(afterMetrics.categoryRevenue.find((row) => row.categoryId === null)?.categoryName, 'Chưa phân loại');

  // 30 contiguous local days ending today, weekend flags consistent, daily sum = KPI.
  const days = afterMetrics.dailyTrends30d;
  assert.equal(days.length, 30);
  const today = await query<{ today: string }>(`select to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') as today`);
  assert.equal(days[days.length - 1].date, today.rows[0].today);
  for (let index = 1; index < days.length; index++) {
    const gap = (Date.parse(`${days[index].date}T00:00:00Z`) - Date.parse(`${days[index - 1].date}T00:00:00Z`)) / 86_400_000;
    assert.equal(gap, 1, `gap before ${days[index].date}`);
  }
  for (const day of days) {
    const isoDow = ((new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    assert.equal(day.weekdayLabel, weekdayLabel(isoDow));
    assert.equal(day.isWeekend, isoDow >= 6);
  }
  assert.equal(days.reduce((sum, day) => sum + day.revenue, 0), afterMetrics.revenue30d.current);
  assert.equal(days.reduce((sum, day) => sum + day.orderCount, 0), afterMetrics.orders30d.current);
});

test('executive filament: PRODUCTION_OUT ledger (GRAM only) and per-material SAP_HET threshold', needsDb, async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const warehouse = await query<{ id: string }>(`insert into warehouses (name, code) values ('P41 kho', $1) returning id`, [`P41_${suffix.toUpperCase()}`]);
  const warehouseId = warehouse.rows[0].id;
  const material = async (name: string, unit: 'GRAM' | 'SPOOL') => (await query<{ id: string }>(
    `insert into materials (name, material_type, color, unit) values ($1, 'PLA', 'Thử', $2::material_unit) returning id`, [`${name} ${suffix}`, unit],
  )).rows[0].id;
  const spool = (materialId: string, code: string, usedGrams: number) => query(
    `insert into filament_spools (spool_code, material_id, warehouse_id, initial_weight_grams, used_weight_grams, purchase_cost)
     values ($1, $2, $3, 1000, $4, 350000)`, [`P41-${code}-${suffix}`, materialId, warehouseId, usedGrams],
  );
  const movement = (materialId: string, grams: number, daysAgo: number) => query(
    `insert into material_movements (warehouse_id, material_id, movement_type, quantity, created_at)
     values ($1, $2, 'PRODUCTION_OUT', $3, now() - make_interval(days => $4))`, [warehouseId, materialId, -grams, daysAgo],
  );

  const lowMaterial = await material('P41 low', 'GRAM');
  const okMaterial = await material('P41 ok', 'GRAM');
  const spoolUnitMaterial = await material('P41 spool-unit', 'SPOOL');

  const before = await getExecutiveBusinessMetrics();
  await spool(lowMaterial, 'A', 900); // 100 g left
  await spool(lowMaterial, 'B', 700); // 300 g left → 400 / 2000 = exactly 20% → low
  await spool(okMaterial, 'C', 790); // 210 / 1000 → not low
  await movement(lowMaterial, 500, 1);
  await movement(lowMaterial, 300, 45);
  await movement(spoolUnitMaterial, 7, 1); // unit SPOOL: not grams, excluded
  const afterMetrics = await getExecutiveBusinessMetrics();

  assert.equal(afterMetrics.filamentUsedGrams30d.current - before.filamentUsedGrams30d.current, 500);
  assert.equal(afterMetrics.filamentUsedGrams30d.previous - before.filamentUsedGrams30d.previous, 300);

  const low = afterMetrics.filamentStock.find((row) => row.materialId === lowMaterial);
  const ok = afterMetrics.filamentStock.find((row) => row.materialId === okMaterial);
  assert.deepEqual(low && [low.spoolCount, low.capacityGrams, low.remainingGrams, low.thresholdGrams, low.isLow], [2, 2000, 400, 400, true]);
  assert.deepEqual(ok && [ok.remainingGrams, ok.thresholdGrams, ok.isLow], [210, 200, false]);
  const firstOk = afterMetrics.filamentStock.findIndex((row) => !row.isLow);
  const lastLow = afterMetrics.filamentStock.map((row) => row.isLow).lastIndexOf(true);
  assert.ok(firstOk === -1 || lastLow < firstOk, 'low materials are listed first');

  // STAFF-safe shape: spools above carry purchase_cost, but no money field may come through.
  for (const row of afterMetrics.filamentStock) {
    assert.deepEqual(Object.keys(row).filter((key) => /cost|price|vnd|revenue/i.test(key)), []);
  }
  assert.ok(!JSON.stringify(afterMetrics.filamentStock).includes('350000'));
});

test('executive periods: exact local-midnight boundaries of today-29 and today-59 (ADR-0044 §5)', needsDb, async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const tz = 'Asia/Ho_Chi_Minh';
  const startOf = (daysBack: number) => `(((now() at time zone '${tz}')::date - ${daysBack})::timestamp at time zone '${tz}')`;
  const at = {
    currentStart: startOf(29), // first instant of the current period
    justBeforeCurrent: `${startOf(29)} - interval '1 microsecond'`, // last instant of the previous period
    previousStart: startOf(59), // first instant of the previous period
    justBeforePrevious: `${startOf(59)} - interval '1 microsecond'`, // outside both periods
  };
  const amounts = { currentStart: 11_000, justBeforeCurrent: 22_000, previousStart: 44_000, justBeforePrevious: 88_000 } as const;

  const category = await query<{ id: string }>(`insert into categories (name, slug) values ($1, $2) returning id`, [`P41 biên ${suffix}`, `p41-edge-${suffix}`]);
  const product = await query<{ id: string }>(`insert into products (category_id, name, slug, product_type) values ($1, 'P41 biên', $2, 'READY_STOCK') returning id`, [category.rows[0].id, `p41-edge-product-${suffix}`]);
  const variant = await query<{ id: string }>(`insert into product_variants (product_id, sku, name, price) values ($1, $2, 'Mặc định', 1000) returning id`, [product.rows[0].id, `P41-EDGE-${suffix.toUpperCase()}`]);
  const warehouse = await query<{ id: string }>(`insert into warehouses (name, code) values ('P41 biên', $1) returning id`, [`P41E_${suffix.toUpperCase()}`]);
  const material = await query<{ id: string }>(`insert into materials (name, material_type, unit) values ($1, 'PLA', 'GRAM') returning id`, [`P41 biên ${suffix}`]);

  const before = await getExecutiveBusinessMetrics();
  for (const key of Object.keys(at) as (keyof typeof at)[]) {
    const order = await query<{ id: string }>(
      `insert into orders (order_number, customer_name, customer_phone, subtotal, total, status, payment_status, created_at)
       values ($1, 'Phase 41 edge', '0900000041', $2, $2, 'COMPLETED', 'PAID', ${at[key]}) returning id`,
      [`P41-EDGE-${key}-${suffix}`, amounts[key]],
    );
    await query(
      `insert into order_items (order_id, variant_id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total)
       values ($1, $2, 'P41 biên', 'Mặc định', 'P41-EDGE', 1, $3, $3)`, [order.rows[0].id, variant.rows[0].id, amounts[key]],
    );
    await query(
      `insert into material_movements (warehouse_id, material_id, movement_type, quantity, created_at)
       values ($1, $2, 'PRODUCTION_OUT', $3, ${at[key]})`, [warehouse.rows[0].id, material.rows[0].id, -amounts[key] / 1000],
    );
  }
  const afterMetrics = await getExecutiveBusinessMetrics();

  assert.equal(afterMetrics.revenue30d.current - before.revenue30d.current, 11_000);
  assert.equal(afterMetrics.revenue30d.previous - before.revenue30d.previous, 22_000 + 44_000);
  assert.equal(afterMetrics.orders30d.current - before.orders30d.current, 1);
  assert.equal(afterMetrics.orders30d.previous - before.orders30d.previous, 2);
  assert.equal(afterMetrics.dailyTrends30d[0].revenue - before.dailyTrends30d[0].revenue, 11_000);
  assert.equal(afterMetrics.categoryRevenue.find((row) => row.categoryId === category.rows[0].id)?.revenue, 11_000);
  assert.equal(afterMetrics.filamentUsedGrams30d.current - before.filamentUsedGrams30d.current, 11);
  assert.equal(afterMetrics.filamentUsedGrams30d.previous - before.filamentUsedGrams30d.previous, 22 + 44);
});
