import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

test('PostgreSQL rejects invalid order totals and invalid inventory adjustments', { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await assert.rejects(client.query(`
      insert into orders (order_number, customer_name, customer_phone, subtotal, shipping_fee, discount, cod_fee, total)
      values ('TEST-INVALID-TOTAL', 'Test', '0900000000', 100000, 0, 0, 0, 99999)
    `));
    await assert.rejects(client.query(`
      insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity)
      values ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000201', 'ADJUSTMENT_IN', 1)
    `));
  } finally {
    await client.end();
  }
});
