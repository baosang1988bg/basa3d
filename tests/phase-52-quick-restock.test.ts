// Phase 52 — "Nhập kho nhanh" (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md, P0).
// Pure tests always run; DB-backed tests need the disposable local PostgreSQL (TEST_DATABASE_URL).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { Client } from 'pg';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { planStockEvent } from '../src/lib/inventory/quick-restock-plan.js';
import { quickRestockBatchInputSchema, quickRestockInputSchema, type QuickRestockInput } from '../src/domain/schemas.js';
import { getQuickRestockContext, listStockTrackedVariants, recordStockEvent, recordStockEventBatch } from '../src/services/quick-restock.service.js';
import { getStockLevel, listInventoryLedger } from '../src/services/inventory.service.js';
import { createOrder } from '../src/services/order.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const WAREHOUSE_ID = '00000000-0000-4000-8000-000000000010'; // seeded (supabase/seed.sql)

async function expectDomainError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof DomainError && error.code === code);
}

// ---------------------------------------------------------------------------------------------
// Pure — intent → movement type and sign (D1, D2, D4)
// ---------------------------------------------------------------------------------------------

test('planStockEvent: staff always type a positive number, the server owns the sign', () => {
  assert.deepEqual(planStockEvent('PRINTED', 5, 8), { kind: 'MOVE', movementType: 'PRODUCTION_IN', signedQuantity: 5, onHandAfter: 13 });
  assert.deepEqual(planStockEvent('PURCHASED', 3, 0), { kind: 'MOVE', movementType: 'PURCHASE', signedQuantity: 3, onHandAfter: 3 });
  assert.deepEqual(planStockEvent('DAMAGED', 2, 8), { kind: 'MOVE', movementType: 'DAMAGE_OUT', signedQuantity: -2, onHandAfter: 6 });
});

test('planStockEvent: a stock count becomes the delta against current on-hand; equal count writes nothing', () => {
  assert.deepEqual(planStockEvent('COUNTED', 10, 8), { kind: 'MOVE', movementType: 'ADJUSTMENT_IN', signedQuantity: 2, onHandAfter: 10 });
  assert.deepEqual(planStockEvent('COUNTED', 5, 8), { kind: 'MOVE', movementType: 'ADJUSTMENT_OUT', signedQuantity: -3, onHandAfter: 5 });
  assert.deepEqual(planStockEvent('COUNTED', 0, 4), { kind: 'MOVE', movementType: 'ADJUSTMENT_OUT', signedQuantity: -4, onHandAfter: 0 });
  assert.deepEqual(planStockEvent('COUNTED', 8, 8), { kind: 'NO_CHANGE', onHandAfter: 8 });
  assert.throws(() => planStockEvent('PRINTED', -1, 0), RangeError);
  assert.throws(() => planStockEvent('PRINTED', 1.5, 0), RangeError);
});

test('quickRestockInputSchema: zero only for a count; count needs expectedOnHand + note; unit cost only for purchases', () => {
  const base = { idempotencyKey: randomUUID(), productVariantId: randomUUID(), warehouseId: randomUUID() };
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'PRINTED', quantity: 0 }).success, false);
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'PRINTED', quantity: -2 }).success, false);
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'PRINTED', quantity: 5 }).success, true);
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'COUNTED', quantity: 0, expectedOnHand: 3 }).success, false, 'note required');
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'COUNTED', quantity: 0, note: 'vỡ 3' }).success, false, 'expectedOnHand required');
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'COUNTED', quantity: 0, expectedOnHand: 3, note: 'vỡ 3' }).success, true);
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'PRINTED', quantity: 1, unitCost: 1000 }).success, false);
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'PURCHASED', quantity: 1, unitCost: 1000 }).success, true);
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'PURCHASED', quantity: 1, unitCost: 10.5 }).success, false, 'VND is an integer');
  assert.equal(quickRestockInputSchema.safeParse({ ...base, intent: 'PRINTED', quantity: 1, movementType: 'PURCHASE' }).success, false, 'strict');
});

// ---------------------------------------------------------------------------------------------
// DB-backed
// ---------------------------------------------------------------------------------------------

async function withClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}

async function seedVariant(client: Client, opts: { productType?: 'READY_STOCK' | 'MADE_TO_ORDER'; stock?: number } = {}) {
  const productId = randomUUID(); const variantId = randomUUID();
  const suffix = productId.slice(0, 8).toUpperCase();
  await client.query(`insert into products (id, name, slug, product_type, status) values ($1, 'Phase 52', $2, $3, 'ACTIVE')`, [productId, `phase-52-${productId}`, opts.productType ?? 'READY_STOCK']);
  await client.query(`insert into product_variants (id, product_id, sku, name, price) values ($1, $2, $3, 'Default', 52000)`, [variantId, productId, `PHASE52-${suffix}`]);
  if (opts.stock) await client.query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ($1, $2, 'PRODUCTION_IN', $3, 'phase 52')`, [WAREHOUSE_ID, variantId, opts.stock]);
  return { productId, variantId };
}

function event(variantId: string, patch: Partial<QuickRestockInput>): QuickRestockInput {
  return quickRestockInputSchema.parse({ idempotencyKey: randomUUID(), productVariantId: variantId, warehouseId: WAREHOUSE_ID, intent: 'PRINTED', quantity: 1, ...patch });
}

async function ledgerRows(client: Client, variantId: string) {
  return (await client.query<{ movement_type: string; quantity: number; reference_type: string | null; created_by: string | null }>(
    'select movement_type, quantity, reference_type, created_by from inventory_movements where product_variant_id = $1 order by created_at', [variantId])).rows;
}

test('DB: "in xong" adds +5 as PRODUCTION_IN with actor and quick_restock reference', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 8 });
    const result = await recordStockEvent(event(variantId, { intent: 'PRINTED', quantity: 5 }), ACTOR_ID);
    assert.equal(result.status, 'RECORDED');
    assert.equal(result.onHandBefore, 8);
    assert.equal(result.onHandAfter, 13);
    assert.equal((await getStockLevel(variantId)).onHand, 13);
    const last = (await ledgerRows(client, variantId)).at(-1)!;
    assert.deepEqual(last, { movement_type: 'PRODUCTION_IN', quantity: 5, reference_type: 'quick_restock', created_by: ACTOR_ID });
  });
});

test('DB: the same idempotency key replays instead of writing twice; a different payload is a conflict', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client);
    const input = event(variantId, { intent: 'PURCHASED', quantity: 4, unitCost: 15000 });
    const first = await recordStockEvent(input, ACTOR_ID);
    const retry = await recordStockEvent(input, ACTOR_ID);
    assert.equal(retry.status, 'REPLAYED');
    assert.equal(retry.movementId, first.movementId);
    assert.equal((await getStockLevel(variantId)).onHand, 4);
    await expectDomainError(recordStockEvent({ ...input, quantity: 5 }, ACTOR_ID), 'IDEMPOTENCY_CONFLICT');
    await expectDomainError(recordStockEvent({ ...input, intent: 'PRINTED', unitCost: null }, ACTOR_ID), 'IDEMPOTENCY_CONFLICT');
    // The same key reused for another variant is refused too.
    const other = await seedVariant(client);
    await expectDomainError(recordStockEvent({ ...input, productVariantId: other.variantId }, ACTOR_ID), 'IDEMPOTENCY_CONFLICT');
    assert.equal((await ledgerRows(client, other.variantId)).length, 0);
  });
});

test('DB: a double-click (two concurrent submits, same key) writes exactly one ledger row', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client);
    const input = event(variantId, { intent: 'PRINTED', quantity: 3 });
    const results = await Promise.all([recordStockEvent(input, ACTOR_ID), recordStockEvent(input, ACTOR_ID)]);
    assert.deepEqual(results.map((r) => r.status).sort(), ['RECORDED', 'REPLAYED']);
    assert.equal((await ledgerRows(client, variantId)).length, 1);
    assert.equal((await getStockLevel(variantId)).onHand, 3);
  });
});

test('DB: a stock count writes the server-computed delta (with the required note), or nothing when equal', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 8 });
    const down = await recordStockEvent(event(variantId, { intent: 'COUNTED', quantity: 5, expectedOnHand: 8, note: 'đếm lại kệ A' }), ACTOR_ID);
    assert.equal(down.movementType, 'ADJUSTMENT_OUT');
    assert.equal(down.signedQuantity, -3);
    const up = await recordStockEvent(event(variantId, { intent: 'COUNTED', quantity: 7, expectedOnHand: 5, note: 'tìm thấy 2' }), ACTOR_ID);
    assert.equal(up.movementType, 'ADJUSTMENT_IN');
    assert.equal(up.signedQuantity, 2);
    const same = await recordStockEvent(event(variantId, { intent: 'COUNTED', quantity: 7, expectedOnHand: 7, note: 'khớp' }), ACTOR_ID);
    assert.equal(same.status, 'NO_CHANGE');
    assert.equal((await getStockLevel(variantId)).onHand, 7);
    assert.equal((await ledgerRows(client, variantId)).length, 3, 'seed + 2 adjustments, nothing for the matching count');
    const audit = await client.query('select 1 from audit_logs where entity_id = $1 and action = $2', [down.movementId, 'INVENTORY_ADJUSTED']);
    assert.equal(audit.rowCount, 1, 'Rule #6: adjustments are audited');
  });
});

test('DB: a count against a stale on-hand is refused (STOCK_CHANGED) instead of writing a wrong delta', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 8 });
    // Someone finishes a print run while staff are counting.
    await recordStockEvent(event(variantId, { intent: 'PRINTED', quantity: 2 }), ACTOR_ID);
    await expectDomainError(recordStockEvent(event(variantId, { intent: 'COUNTED', quantity: 8, expectedOnHand: 8, note: 'đếm' }), ACTOR_ID), 'STOCK_CHANGED');
    assert.equal((await getStockLevel(variantId)).onHand, 10);
  });
});

test('DB: damaged stock goes through Rule #23 — it cannot eat units reserved by open orders', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 5 });
    await createOrder({ customerName: 'Phase 52', customerPhone: '0900000052', items: [{ variantId, quantity: 4 }] }, ACTOR_ID, { notify: async () => {} });
    await expectDomainError(recordStockEvent(event(variantId, { intent: 'DAMAGED', quantity: 2 }), ACTOR_ID), 'INSUFFICIENT_STOCK');
    await expectDomainError(recordStockEvent(event(variantId, { intent: 'COUNTED', quantity: 3, expectedOnHand: 5, note: 'mất 2' }), ACTOR_ID), 'INSUFFICIENT_STOCK');
    const ok = await recordStockEvent(event(variantId, { intent: 'DAMAGED', quantity: 1 }), ACTOR_ID);
    assert.equal(ok.signedQuantity, -1);
    assert.equal((await getStockLevel(variantId)).available, 0);
  });
});

test('DB: made-to-order products and unknown variants/warehouses are refused (Rule #9)', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { productType: 'MADE_TO_ORDER' });
    await expectDomainError(recordStockEvent(event(variantId, { intent: 'PRINTED', quantity: 1 }), ACTOR_ID), 'NOT_STOCK_TRACKED');
    await expectDomainError(recordStockEvent(event(randomUUID(), { intent: 'PRINTED', quantity: 1 }), ACTOR_ID), 'VARIANT_NOT_FOUND');
    const ready = await seedVariant(client);
    await expectDomainError(recordStockEvent(event(ready.variantId, { warehouseId: randomUUID() }), ACTOR_ID), 'WAREHOUSE_NOT_FOUND');
    assert.equal((await ledgerRows(client, variantId)).length, 0);
  });
});

test('DB: the dialog context reports per-warehouse on-hand, reserved and available', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 6 });
    await createOrder({ customerName: 'Phase 52', customerPhone: '0900000052', items: [{ variantId, quantity: 2 }] }, ACTOR_ID, { notify: async () => {} });
    const context = await getQuickRestockContext(variantId);
    assert.ok(context);
    assert.equal(context.productType, 'READY_STOCK');
    assert.equal(context.onHand, 6);
    assert.equal(context.reserved, 2);
    assert.equal(context.available, 4);
    assert.equal(context.warehouses.find((w) => w.id === WAREHOUSE_ID)?.onHand, 6);
    assert.equal(await getQuickRestockContext(randomUUID()), null);
  });
});

// ---------------------------------------------------------------------------------------------
// P4 — batch + ledger
// ---------------------------------------------------------------------------------------------

test('batch schema: no duplicate variant, per-line rules from the single schema, note once for counts', () => {
  const variantId = randomUUID();
  const base = { batchKey: randomUUID(), warehouseId: randomUUID(), intent: 'PRINTED' };
  assert.equal(quickRestockBatchInputSchema.safeParse({ ...base, lines: [{ productVariantId: variantId, quantity: 2 }] }).success, true);
  assert.equal(quickRestockBatchInputSchema.safeParse({ ...base, lines: [] }).success, false);
  assert.equal(quickRestockBatchInputSchema.safeParse({ ...base, lines: [{ productVariantId: variantId, quantity: 2 }, { productVariantId: variantId, quantity: 1 }] }).success, false);
  assert.equal(quickRestockBatchInputSchema.safeParse({ ...base, lines: [{ productVariantId: variantId, quantity: 0 }] }).success, false);
  const counted = quickRestockBatchInputSchema.safeParse({ ...base, intent: 'COUNTED', lines: [{ productVariantId: randomUUID(), quantity: 1, expectedOnHand: 1 }, { productVariantId: randomUUID(), quantity: 0, expectedOnHand: 2 }] });
  assert.equal(counted.success, false);
  assert.equal(counted.error!.issues.filter((issue) => issue.path[0] === 'note').length, 1);
});

test('DB: a batch writes every line in one go, replays on retry, and rolls back entirely when one line fails', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const a = await seedVariant(client, { stock: 2 });
    const b = await seedVariant(client);
    const input = quickRestockBatchInputSchema.parse({ batchKey: randomUUID(), warehouseId: WAREHOUSE_ID, intent: 'PRINTED', note: 'mẻ sáng', lines: [
      { productVariantId: a.variantId, quantity: 5 }, { productVariantId: b.variantId, quantity: 3 },
    ] });
    const first = await recordStockEventBatch(input, ACTOR_ID);
    assert.equal(first.status, 'RECORDED');
    assert.equal((await getStockLevel(a.variantId)).onHand, 7);
    assert.equal((await getStockLevel(b.variantId)).onHand, 3);
    const retry = await recordStockEventBatch(input, ACTOR_ID);
    assert.equal(retry.status, 'REPLAYED');
    assert.equal((await getStockLevel(a.variantId)).onHand, 7, 'no double write');
    await expectDomainError(recordStockEventBatch({ ...input, lines: [{ productVariantId: a.variantId, quantity: 9 }] }, ACTOR_ID), 'IDEMPOTENCY_CONFLICT');

    // One bad line (damage more than on the shelf) → nothing from the batch is written.
    const c = await seedVariant(client, { stock: 1 });
    const failing = quickRestockBatchInputSchema.parse({ batchKey: randomUUID(), warehouseId: WAREHOUSE_ID, intent: 'DAMAGED', lines: [
      { productVariantId: a.variantId, quantity: 1 }, { productVariantId: c.variantId, quantity: 4 },
    ] });
    await assert.rejects(recordStockEventBatch(failing, ACTOR_ID), (error: unknown) => error instanceof DomainError && /Chưa ghi dòng nào/.test(error.message));
    assert.equal((await getStockLevel(a.variantId)).onHand, 7);
    assert.equal((await getStockLevel(c.variantId)).onHand, 1);

    // A made-to-order variant in the batch is refused as a whole.
    const mto = await seedVariant(client, { productType: 'MADE_TO_ORDER' });
    await expectDomainError(recordStockEventBatch(quickRestockBatchInputSchema.parse({ batchKey: randomUUID(), warehouseId: WAREHOUSE_ID, intent: 'PRINTED', lines: [
      { productVariantId: b.variantId, quantity: 1 }, { productVariantId: mto.variantId, quantity: 1 },
    ] }), ACTOR_ID), 'NOT_STOCK_TRACKED');
    assert.equal((await getStockLevel(b.variantId)).onHand, 3);
  });
});

test('DB: two overlapping batches (variants in opposite order) both complete — no deadlock', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const variants = await Promise.all([1, 2, 3].map(() => seedVariant(client)));
    const ids = variants.map((v) => v.variantId);
    const batch = (order: string[]) => quickRestockBatchInputSchema.parse({ batchKey: randomUUID(), warehouseId: WAREHOUSE_ID, intent: 'PRINTED', lines: order.map((id) => ({ productVariantId: id, quantity: 1 })) });
    const runs = await Promise.all([
      recordStockEventBatch(batch(ids), ACTOR_ID),
      recordStockEventBatch(batch([...ids].reverse()), ACTOR_ID),
      recordStockEventBatch(batch([ids[1], ids[2], ids[0]]), ACTOR_ID),
    ]);
    assert.ok(runs.every((run) => run.status === 'RECORDED'));
    for (const id of ids) assert.equal((await getStockLevel(id)).onHand, 3);
  });
});

test('DB: batch picker lists only READY_STOCK variants with per-warehouse on-hand', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const ready = await seedVariant(client, { stock: 4 });
    const mto = await seedVariant(client, { productType: 'MADE_TO_ORDER' });
    const list = await listStockTrackedVariants();
    const found = list.find((v) => v.id === ready.variantId);
    assert.ok(found);
    assert.equal(found.onHandByWarehouse[WAREHOUSE_ID], 4);
    assert.ok(!list.some((v) => v.id === mto.variantId));
  });
});

test('DB: ledger filters by SKU, type and local date; newest first', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 2 });
    await recordStockEvent(event(variantId, { intent: 'DAMAGED', quantity: 1, note: 'rơi vỡ' }), ACTOR_ID);
    const sku = (await client.query<{ sku: string }>('select sku from product_variants where id = $1', [variantId])).rows[0].sku;
    const all = await listInventoryLedger({ search: sku });
    assert.deepEqual(all.items.map((row) => row.movementType), ['DAMAGE_OUT', 'PRODUCTION_IN']);
    assert.equal(all.items[0].referenceType, 'quick_restock');
    const damage = await listInventoryLedger({ search: sku, movementType: 'DAMAGE_OUT' });
    assert.equal(damage.items.length, 1);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    assert.equal((await listInventoryLedger({ search: sku, from: today, to: today })).items.length, 2);
    assert.equal((await listInventoryLedger({ search: sku, to: '2020-01-01' })).items.length, 0);
    assert.equal((await listInventoryLedger({ search: sku, from: 'not-a-date' })).items.length, 2, 'malformed dates are ignored');
    assert.equal((await listInventoryLedger({ search: '%' })).items.every((row) => row.sku.includes('%') || row.productName.includes('%') || row.variantName.includes('%')), true, 'LIKE wildcards are escaped');
  });
});

// ---------------------------------------------------------------------------------------------
// Review follow-ups — a used key replays ONLY the identical request
// ---------------------------------------------------------------------------------------------

test('DB: retrying a batch key with an extra line is a conflict, not a silent partial replay', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const a = await seedVariant(client);
    const b = await seedVariant(client);
    const batchKey = randomUUID();
    const base = { batchKey, warehouseId: WAREHOUSE_ID, intent: 'PRINTED' };
    await recordStockEventBatch(quickRestockBatchInputSchema.parse({ ...base, lines: [{ productVariantId: a.variantId, quantity: 2 }] }), ACTOR_ID);
    await assert.rejects(
      recordStockEventBatch(quickRestockBatchInputSchema.parse({ ...base, lines: [{ productVariantId: a.variantId, quantity: 2 }, { productVariantId: b.variantId, quantity: 1 }] }), ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'IDEMPOTENCY_CONFLICT' && /ĐÃ ghi vào sổ kho/.test(error.message) && /\+2/.test(error.message));
    assert.equal((await getStockLevel(b.variantId)).onHand, 0);
    // Upper-case ids are the same variant (no duplicate lock / write).
    const replay = await recordStockEventBatch(quickRestockBatchInputSchema.parse({ ...base, lines: [{ productVariantId: a.variantId.toUpperCase(), quantity: 2 }] }), ACTOR_ID);
    assert.equal(replay.status, 'REPLAYED');
  });
});

test('DB: a COUNTED retry with a different count under the same key is refused (the count is part of the request)', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 8 });
    const first = event(variantId, { intent: 'COUNTED', quantity: 6, expectedOnHand: 8, note: 'đếm' });
    await recordStockEvent(first, ACTOR_ID);
    await expectDomainError(recordStockEvent({ ...first, quantity: 5 }, ACTOR_ID), 'IDEMPOTENCY_CONFLICT');
    const replay = await recordStockEvent(first, ACTOR_ID);
    assert.equal(replay.status, 'REPLAYED');
    assert.equal((await getStockLevel(variantId)).onHand, 6);
    // A matching count (no ledger row) also replays cleanly under its key.
    const matching = event(variantId, { intent: 'COUNTED', quantity: 6, expectedOnHand: 6, note: 'khớp' });
    assert.equal((await recordStockEvent(matching, ACTOR_ID)).status, 'NO_CHANGE');
    assert.equal((await recordStockEvent(matching, ACTOR_ID)).status, 'NO_CHANGE');
  });
});

test('DB: the same key sent concurrently for two different variants writes only one of them', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const a = await seedVariant(client);
    const b = await seedVariant(client);
    const key = randomUUID();
    const results = await Promise.allSettled([
      recordStockEvent(event(a.variantId, { idempotencyKey: key, quantity: 1 }), ACTOR_ID),
      recordStockEvent(event(b.variantId, { idempotencyKey: key, quantity: 1 }), ACTOR_ID),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.ok(rejected.reason instanceof DomainError && rejected.reason.code === 'IDEMPOTENCY_CONFLICT');
    const total = (await getStockLevel(a.variantId)).onHand + (await getStockLevel(b.variantId)).onHand;
    assert.equal(total, 1);
  });
});
