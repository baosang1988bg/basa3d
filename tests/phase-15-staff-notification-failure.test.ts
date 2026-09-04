import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, mock } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { getPool } from '../src/lib/db.js';
import { mintStaffAccount } from './helpers/rbac-accounts.js';

nextEnv.loadEnvConfig(process.cwd());
process.env.RESEND_API_KEY ??= 'test-resend-key';
process.env.RESEND_FROM_EMAIL ??= 'staff@example.test';
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

const WAREHOUSE_ID = '00000000-0000-4000-8000-000000000010'; // seeded warehouse, used by other test files too

// Mirrors seedVariant() in tests/phase-5-public-orders.test.ts — isolated per-test by random slug/sku.
async function seedVariant(client: Client, opts: { price: number; stock: number }): Promise<{ variantId: string }> {
  const productId = randomUUID();
  const variantId = randomUUID();
  const suffix = productId.slice(0, 8);
  await client.query(`insert into products (id, name, slug, product_type, status) values ($1, 'Notify Failure Test', $2, 'READY_STOCK', 'ACTIVE')`, [productId, `notify-failure-test-${suffix}`]);
  await client.query(`insert into product_variants (id, product_id, sku, name, price) values ($1, $2, $3, 'Default', $4)`, [variantId, productId, `TEST-NOTIFY-${suffix.toUpperCase()}`, opts.price]);
  if (opts.stock > 0) {
    await client.query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ($1, $2, 'PRODUCTION_IN', $3, 'notify failure test stock')`, [WAREHOUSE_ID, variantId, opts.stock]);
  }
  return { variantId };
}

test('createOrder and createCustomRequest still succeed and return normally when the Resend API call throws', { skip: !process.env.DATABASE_URL }, async () => {
  // Registered before the first import of order.service.ts/custom-request.service.ts below, so
  // their transitive `import { Resend } from 'resend'` (inside send-staff-notification.ts)
  // resolves to this throwing stand-in instead of the real SDK — no real network call is made.
  mock.module('resend', {
    namedExports: {
      Resend: class {
        emails = { send: async () => { throw new Error('Resend boom'); } };
      },
    },
  });

  const { createOrder } = await import('../src/services/order.service.js');
  const { createCustomRequest } = await import('../src/services/custom-request.service.js');

  const staff = await mintStaffAccount('STAFF');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { variantId } = await seedVariant(client, { price: 30_000, stock: 3 });

    const order = await createOrder({
      customerName: 'Notify Failure Customer',
      customerPhone: `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
      shippingAddress: { line1: '1 Test St', ward: 'Test Ward', city: 'Test City' },
      items: [{ variantId, quantity: 1 }],
    }, null);
    assert.ok(order.id);
    assert.ok(order.orderNumber);

    const customRequest = await createCustomRequest({
      sourceChannel: 'WEBSITE',
      customerName: 'Notify Failure Customer',
      customerPhone: `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
      description: 'Notify failure isolation test',
      quantity: 1,
    }, null);
    assert.ok(customRequest.id);
    assert.ok(customRequest.requestNumber);
  } finally {
    await client.end();
    await staff.cleanup();
  }
});
