import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { createOrderConfirmationToken, verifyOrderConfirmationToken } from '../src/lib/order-confirmation-token.js';
import { createDatabaseRateLimiter } from '../src/lib/rate-limit.js';
import { getOrderConfirmationByToken, getPublicOrderByNumber } from '../src/services/order.service.js';
import { getPool } from '../src/lib/db.js';

nextEnv.loadEnvConfig(process.cwd());
process.env.ORDER_CONFIRMATION_SECRET ??= 'hardening-followup-test-secret-at-least-32-characters';
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test('order confirmation token accepts a valid token and rejects expired or modified tokens', () => {
  const orderId = randomUUID();
  const valid = createOrderConfirmationToken(orderId, 60);
  assert.equal(verifyOrderConfirmationToken(valid)?.orderId, orderId);
  assert.equal(verifyOrderConfirmationToken(createOrderConfirmationToken(orderId, -10)), null);
  assert.equal(verifyOrderConfirmationToken(`${valid.slice(0, -1)}x`), null);
});

test('valid token returns unmasked order details while invalid token cannot bypass masked public lookup', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const orderId = randomUUID();
  const orderNumber = `ORD-${orderId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  try {
    await client.query(`
      insert into orders (id, order_number, customer_name, customer_phone, shipping_address, subtotal, total)
      values ($1,$2,'Nguyen Van An','0987654321',$3,1000,1000)`,
    [orderId, orderNumber, { line1: '123 Duong Test', ward: 'Phuong Test', city: 'TP HCM' }]);

    const full = await getOrderConfirmationByToken(orderNumber, createOrderConfirmationToken(orderId));
    assert.equal(full?.customerName, 'Nguyen Van An');
    assert.equal(full?.customerPhone, '0987654321');
    assert.equal(full?.shippingAddress.line1, '123 Duong Test');

    assert.equal(await getOrderConfirmationByToken(orderNumber, createOrderConfirmationToken(randomUUID())), null);
    assert.equal(await getOrderConfirmationByToken(orderNumber, 'invalid'), null);
    const masked = await getPublicOrderByNumber(orderNumber, '4321');
    assert.notEqual(masked?.customerName, 'Nguyen Van An');
    assert.match(masked?.customerPhone ?? '', /^\d{3}\*{3}\d{4}$/);
    assert.equal('line1' in (masked?.shippingAddress ?? {}), false);
  } finally {
    await client.query('delete from orders where id = $1', [orderId]);
    await client.end();
  }
});

test('two database limiter instances share one atomic counter', { skip: !process.env.DATABASE_URL }, async () => {
  const scope = `test-${randomUUID()}`;
  const key = 'same-client';
  const firstInstance = createDatabaseRateLimiter({ scope, maxRequests: 2, windowMs: 60_000 });
  const secondInstance = createDatabaseRateLimiter({ scope, maxRequests: 2, windowMs: 60_000 });
  try {
    assert.equal(await firstInstance(key), false);
    assert.equal(await secondInstance(key), false);
    assert.equal(await firstInstance(key), true);
  } finally {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query('delete from rate_limit_attempts where scope = $1', [scope]);
    await client.end();
  }
});
