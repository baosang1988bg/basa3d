import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inventoryMovementInputSchema,
  orderInputSchema,
  productVariantInputSchema,
  publicCustomRequestInputSchema,
  vndSchema,
} from '../src/domain/schemas.js';

const id = '9f0db9c1-6cc5-4655-9c29-e9208933586a';

test('VND values are non-negative safe integers', () => {
  assert.equal(vndSchema.safeParse(120_000).success, true);
  assert.equal(vndSchema.safeParse(12.5).success, false);
  assert.equal(vndSchema.safeParse(-1).success, false);
});

test('product variants require an uppercase immutable-style SKU and integer price', () => {
  assert.equal(productVariantInputSchema.safeParse({
    productId: id, sku: 'ACC-PHONE-STAND-BLK', name: 'Black', price: 99_000,
  }).success, true);
  assert.equal(productVariantInputSchema.safeParse({
    productId: id, sku: 'acc-phone-stand', name: 'Black', price: 99_000.5,
  }).success, false);
});

test('order total must reconcile to its monetary components', () => {
  const order = {
    customerName: 'Test Customer', customerPhone: '0900000000', subtotal: 100_000,
    shippingFee: 20_000, discount: 5_000, codFee: 0, total: 115_000,
  };
  assert.equal(orderInputSchema.safeParse(order).success, true);
  assert.equal(orderInputSchema.safeParse({ ...order, total: 114_999 }).success, false);
});

test('inventory movements reject zero and a sign inconsistent with the ledger type', () => {
  const movement = { warehouseId: id, productVariantId: id, movementType: 'SALE_OUT' as const, quantity: -1 };
  assert.equal(inventoryMovementInputSchema.safeParse(movement).success, true);
  assert.equal(inventoryMovementInputSchema.safeParse({ ...movement, quantity: 1 }).success, false);
  assert.equal(inventoryMovementInputSchema.safeParse({ ...movement, quantity: 0 }).success, false);
});

test('publicCustomRequestInputSchema rejects a client-supplied sourceChannel', () => {
  const result = publicCustomRequestInputSchema.safeParse({
    customerName: 'Test', customerPhone: '0900000000', description: 'Test request', quantity: 1,
    sourceChannel: 'ZALO',
  });
  assert.equal(result.success, false);
});

test('publicCustomRequestInputSchema accepts a valid attachmentUrl and rejects a non-URL one', () => {
  const base = { customerName: 'Test', customerPhone: '0900000000', description: 'Test request', quantity: 1 };
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, attachmentUrl: 'https://drive.google.com/file/d/abc' }).success, true);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, attachmentUrl: 'not-a-url' }).success, false);
});
