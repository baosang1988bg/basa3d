import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { requireAdmin } from '../src/lib/auth/require-admin.js';
import { availableStock, recordInventoryMovement } from '../src/services/inventory.service.js';
import { canTransitionOrderStatus, createOrder, reconcileOrderTotal, updateOrderStatus } from '../src/services/order.service.js';
import { canAcceptQuote } from '../src/services/quote.service.js';
import { DomainError } from '../src/lib/domain-error.js';
import { getPool } from '../src/lib/db.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test('available stock subtracts only NEW and CONFIRMED reservations', () => {
  assert.equal(availableStock(10, 3), 7);
  assert.equal(availableStock(10, 0), 10);
});

test('order totals reconcile using integer VND', () => {
  assert.equal(reconcileOrderTotal(99_000, 20_000, 5_000, 0), 114_000);
});

test('expired quotes cannot be accepted', () => {
  assert.equal(canAcceptQuote(new Date('2020-01-01T00:00:00Z'), new Date('2020-01-02T00:00:00Z')), false);
  assert.equal(canAcceptQuote(new Date('2020-01-03T00:00:00Z'), new Date('2020-01-02T00:00:00Z')), true);
});

test('order status transitions are forward-only, with CANCELLED reachable until SHIPPED', () => {
  assert.equal(canTransitionOrderStatus('NEW', 'CONFIRMED'), true);
  assert.equal(canTransitionOrderStatus('CONFIRMED', 'PRODUCING'), true);
  assert.equal(canTransitionOrderStatus('PRODUCING', 'READY_TO_SHIP'), true);
  assert.equal(canTransitionOrderStatus('READY_TO_SHIP', 'SHIPPED'), true);
  assert.equal(canTransitionOrderStatus('SHIPPED', 'COMPLETED'), true);
  assert.equal(canTransitionOrderStatus('NEW', 'PRODUCING'), false); // cannot skip CONFIRMED
  assert.equal(canTransitionOrderStatus('CONFIRMED', 'NEW'), false); // no rollback
  assert.equal(canTransitionOrderStatus('NEW', 'CANCELLED'), true);
  assert.equal(canTransitionOrderStatus('READY_TO_SHIP', 'CANCELLED'), true);
  assert.equal(canTransitionOrderStatus('SHIPPED', 'CANCELLED'), false); // no cancel after shipped
  assert.equal(canTransitionOrderStatus('COMPLETED', 'CANCELLED'), false);
});

test('requireAdmin fails closed in production', () => {
  const previous = Object.getOwnPropertyDescriptor(process.env, 'NODE_ENV');
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true, writable: true, enumerable: true });
  assert.throws(requireAdmin, /Admin auth not implemented — see Phase 3/);
  if (previous) Object.defineProperty(process.env, 'NODE_ENV', previous);
  else delete (process.env as Record<string, string | undefined>).NODE_ENV;
});

test('two overlapping order creations reserve stock exactly once', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const productId = randomUUID();
  const variantId = randomUUID();
  const slug = `concurrency-${productId.slice(0, 8)}`;
  const sku = `TEST-CONCURRENCY-${productId.slice(0, 8).toUpperCase()}`;
  try {
    await client.query(`insert into products (id, name, slug, product_type, status) values ($1, 'Concurrency Test', $2, 'READY_STOCK', 'ACTIVE')`, [productId, slug]);
    await client.query(`insert into product_variants (id, product_id, sku, name, price) values ($1, $2, $3, 'Only one', 1000)`, [variantId, productId, sku]);
    await client.query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ('00000000-0000-4000-8000-000000000010', $1, 'PRODUCTION_IN', 1, 'Concurrency test stock')`, [variantId]);
    const order = { customerName: 'Concurrency Test', customerPhone: '0900000000', items: [{ variantId, quantity: 1 }] };
    const results = await Promise.allSettled([createOrder(order, '00000000-0000-4000-8000-0000000000aa'), createOrder(order, '00000000-0000-4000-8000-0000000000aa')]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof DomainError);
    assert.equal(rejected[0].reason.code, 'INSUFFICIENT_STOCK');
  } finally {
    await client.end();
  }
});

test('transitioning an order to PRODUCING records exactly one SALE_OUT movement and an audit log entry', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const productId = randomUUID();
  const variantId = randomUUID();
  const warehouseId = randomUUID();
  const actorId = '00000000-0000-4000-8000-0000000000aa';
  const slug = `sale-out-${productId.slice(0, 8)}`;
  const sku = `TEST-SALE-OUT-${productId.slice(0, 8).toUpperCase()}`;
  try {
    await client.query(`insert into warehouses (id, name, code) values ($1, 'Test Warehouse', $2)`, [warehouseId, `TEST${productId.slice(0, 8).toUpperCase()}`]);
    await client.query(`insert into products (id, name, slug, product_type, status) values ($1, 'Sale Out Test', $2, 'READY_STOCK', 'ACTIVE')`, [productId, slug]);
    await client.query(`insert into product_variants (id, product_id, sku, name, price) values ($1, $2, $3, 'Only one', 1000)`, [variantId, productId, sku]);
    await client.query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ($1, $2, 'PRODUCTION_IN', 5, 'Sale out test stock')`, [warehouseId, variantId]);

    const order = await createOrder({ customerName: 'Sale Out Test', customerPhone: '0900000000', items: [{ variantId, quantity: 2 }] }, actorId);
    const confirmed = await updateOrderStatus(order.id, 'CONFIRMED', actorId);
    assert.equal(confirmed.status, 'CONFIRMED');
    const producing = await updateOrderStatus(order.id, 'PRODUCING', actorId);
    assert.equal(producing.status, 'PRODUCING');

    const movements = await client.query(`select quantity, warehouse_id from inventory_movements where product_variant_id = $1 and movement_type = 'SALE_OUT'`, [variantId]);
    assert.equal(movements.rowCount, 1);
    assert.equal(movements.rows[0].quantity, -2);
    assert.equal(movements.rows[0].warehouse_id, warehouseId);

    const auditRows = await client.query(`select before_data, after_data from audit_logs where entity_id = $1 and action = 'ORDER_STATUS_CHANGED' order by created_at`, [order.id]);
    assert.equal(auditRows.rowCount, 2);
    assert.deepEqual(auditRows.rows[1].before_data, { status: 'CONFIRMED' });
    assert.deepEqual(auditRows.rows[1].after_data, { status: 'PRODUCING' });
  } finally {
    await client.end();
  }
});

test('recordInventoryMovement rejects an unknown variant instead of silently writing an orphan movement', { skip: !process.env.DATABASE_URL }, async () => {
  await assert.rejects(
    () => recordInventoryMovement({ warehouseId: '00000000-0000-4000-8000-000000000010', productVariantId: randomUUID(), movementType: 'ADJUSTMENT_OUT', quantity: -1, note: 'test' }, '00000000-0000-4000-8000-0000000000aa'),
    (error: unknown) => error instanceof DomainError && error.code === 'VARIANT_NOT_FOUND',
  );
});
