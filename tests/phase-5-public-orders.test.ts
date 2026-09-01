import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { createOrderConfirmationToken } from '../src/lib/order-confirmation-token.js';

nextEnv.loadEnvConfig(process.cwd());

const PORT = 3411;
const BASE_URL = `http://localhost:${PORT}`;
const WAREHOUSE_ID = '00000000-0000-4000-8000-000000000010'; // seeded warehouse, used by other test files too

// Creates a fresh product + variant + a fixed on-hand stock, isolated per-test by random slug/sku,
// mirroring the pattern already used in tests/phase-2-services.test.ts.
async function seedVariant(client: Client, opts: { price: number; stock: number }): Promise<{ productId: string; variantId: string }> {
  const productId = randomUUID();
  const variantId = randomUUID();
  const suffix = productId.slice(0, 8);
  await client.query(`insert into products (id, name, slug, product_type, status) values ($1, 'Public Order Test', $2, 'READY_STOCK', 'ACTIVE')`, [productId, `public-order-test-${suffix}`]);
  await client.query(`insert into product_variants (id, product_id, sku, name, price) values ($1, $2, $3, 'Default', $4)`, [variantId, productId, `TEST-PUBLIC-ORDER-${suffix.toUpperCase()}`, opts.price]);
  if (opts.stock > 0) {
    await client.query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ($1, $2, 'PRODUCTION_IN', $3, 'Public order test stock')`, [WAREHOUSE_ID, variantId, opts.stock]);
  }
  return { productId, variantId };
}

function validPayload(variantId: string, overrides: Record<string, unknown> = {}) {
  return {
    customerName: 'Test Customer',
    customerPhone: `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
    shippingAddress: { line1: '123 Test St', ward: 'Test Ward', city: 'Test City' },
    paymentMethod: 'COD',
    items: [{ variantId, quantity: 1 }],
    ...overrides,
  };
}

test('valid submission returns 201, recomputes price from the DB, and audit-logs ORDER_CREATED_PUBLIC with a null actor', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { variantId } = await seedVariant(client, { price: 50_000, stock: 5 });
    const response = await fetch(`${BASE_URL}/api/public/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload(variantId)),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.ok(body.id);
    // pg returns bigint columns as strings by default (no custom type parser configured for OID 20,
    // see lib/db.ts) — Number() here mirrors how the rest of the app relies on JS's automatic
    // numeric coercion (Intl.NumberFormat, `*`) rather than strict typing for these values.
    assert.equal(Number(body.total), 50_000);

    const itemRow = await client.query('select unit_price, line_total from order_items where order_id = $1', [body.id]);
    assert.equal(Number(itemRow.rows[0].unit_price), 50_000);
    assert.equal(Number(itemRow.rows[0].line_total), 50_000);

    const auditRow = await client.query(`select actor_id, action from audit_logs where entity_id = $1 and entity_type = 'order'`, [body.id]);
    assert.equal(auditRow.rows[0].actor_id, null);
    assert.equal(auditRow.rows[0].action, 'ORDER_CREATED_PUBLIC');
  } finally {
    await client.end();
  }
});

test('a client-sent discount/shippingFee/codFee is rejected, never silently zeroing the total', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { variantId } = await seedVariant(client, { price: 50_000, stock: 5 });
    const response = await fetch(`${BASE_URL}/api/public/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload(variantId, { discount: 49_999 })),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
  } finally {
    await client.end();
  }
});

test('a filled honeypot returns a 201-shaped response but inserts no order', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { variantId } = await seedVariant(client, { price: 50_000, stock: 5 });
    const phone = `08${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
    const response = await fetch(`${BASE_URL}/api/public/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload(variantId, { customerPhone: phone, honeypot: 'i-am-a-bot' })),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.ok(body.orderNumber);

    const row = await client.query('select id from orders where customer_phone = $1', [phone]);
    assert.equal(row.rowCount, 0);
  } finally {
    await client.end();
  }
});

test('submitting more than the rate limit for one phone number is rejected without inserting', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { variantId } = await seedVariant(client, { price: 10_000, stock: 100 });
    const phone = `07${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
    for (let i = 0; i < 5; i += 1) {
      const response = await fetch(`${BASE_URL}/api/public/orders`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload(variantId, { customerPhone: phone })),
      });
      assert.equal(response.status, 201);
    }
    const sixth = await fetch(`${BASE_URL}/api/public/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload(variantId, { customerPhone: phone })),
    });
    assert.equal(sixth.status, 429);
    const body = await sixth.json();
    assert.equal(body.code, 'RATE_LIMITED');

    const row = await client.query('select count(*) from orders where customer_phone = $1', [phone]);
    assert.equal(Number(row.rows[0].count), 5);
  } finally {
    await client.end();
  }
});

test('two concurrent public checkouts for the last unit of stock: exactly one succeeds', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { variantId } = await seedVariant(client, { price: 10_000, stock: 1 });
    const payload = validPayload(variantId);
    const responses = await Promise.all([
      fetch(`${BASE_URL}/api/public/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
      fetch(`${BASE_URL}/api/public/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, customerPhone: `06${randomUUID().replace(/\D/g, '').slice(0, 8)}` }) }),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    assert.deepEqual(statuses, [201, 409]);

    const orderCount = await client.query('select count(*) from order_items where variant_id = $1', [variantId]);
    assert.equal(Number(orderCount.rows[0].count), 1);
  } finally {
    await client.end();
  }
});

test('GET /api/public/orders/[orderNumber] returns minimal fields for a real order and 404 for an unknown one', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { variantId } = await seedVariant(client, { price: 25_000, stock: 5 });
    const created = await fetch(`${BASE_URL}/api/public/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload(variantId)),
    });
    const createdBody = await created.json();
    const orderNumber = createdBody.orderNumber;
    const phoneRow = await client.query('select customer_phone from orders where id = $1', [createdBody.id]);
    const phoneSuffix = phoneRow.rows[0].customer_phone.replace(/\D/g, '').slice(-4);

    assert.equal(typeof createdBody.confirmationToken, 'string');
    const confirmed = await fetch(`${BASE_URL}/order-confirmation/${orderNumber}?token=${encodeURIComponent(createdBody.confirmationToken)}&phoneSuffix=${phoneSuffix}`);
    assert.equal(confirmed.status, 200);
    const confirmedHtml = await confirmed.text();
    assert.match(confirmedHtml, /Test Customer/);
    assert.match(confirmedHtml, new RegExp(phoneRow.rows[0].customer_phone));
    assert.match(confirmedHtml, /123 Test St/);

    for (const fallbackToken of ['invalid', createOrderConfirmationToken(createdBody.id, -10)]) {
      const fallback = await fetch(`${BASE_URL}/order-confirmation/${orderNumber}?token=${encodeURIComponent(fallbackToken)}&phoneSuffix=${phoneSuffix}`);
      assert.equal(fallback.status, 200);
      const fallbackHtml = await fallback.text();
      assert.doesNotMatch(fallbackHtml, new RegExp(phoneRow.rows[0].customer_phone));
      assert.doesNotMatch(fallbackHtml, /123 Test St/);
    }

    const unverified = await fetch(`${BASE_URL}/api/public/orders/${orderNumber}`);
    assert.equal(unverified.status, 400);
    const wrongPhone = await fetch(`${BASE_URL}/api/public/orders/${orderNumber}?phoneSuffix=0000`);
    assert.equal(wrongPhone.status, 404);
    const found = await fetch(`${BASE_URL}/api/public/orders/${orderNumber}?phoneSuffix=${phoneSuffix}`);
    assert.equal(found.status, 200);
    const body = await found.json();
    assert.equal(body.orderNumber, orderNumber);
    assert.equal(Number(body.total), 25_000);
    assert.equal('customerEmail' in body, false);
    assert.equal('adminNote' in body, false);
    assert.equal('customerNote' in body, false);
    assert.match(body.customerPhone, /^\d{3}\*{3}\d{4}$/);
    assert.equal('line1' in body.shippingAddress, false);
    assert.ok(Array.isArray(body.items) && body.items.length === 1);

    const missing = await fetch(`${BASE_URL}/api/public/orders/ORD-DOESNOTEXIST?phoneSuffix=1234`);
    assert.equal(missing.status, 404);
  } finally {
    await client.end();
  }
});
