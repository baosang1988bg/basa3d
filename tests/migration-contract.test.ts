import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260830000000_initial_domain_schema.sql', import.meta.url);

test('initial migration defines every Phase 1 core table', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  for (const table of [
    'categories', 'products', 'product_variants', 'product_images', 'materials', 'warehouses',
    'inventory_movements', 'material_movements', 'carts', 'cart_items', 'orders', 'order_items',
    'custom_requests', 'quotes', 'print_jobs', 'audit_logs',
  ]) {
    assert.match(migration, new RegExp(`create table ${table} \\(`));
  }
});

test('migration enforces monetary, snapshot, and immutable-ledger constraints', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /total = subtotal \+ shipping_fee \+ cod_fee - discount/);
  assert.match(migration, /line_total = quantity \* unit_price/);
  assert.match(migration, /create trigger inventory_movements_no_update/);
  assert.match(migration, /create trigger material_movements_no_update/);
  assert.match(migration, /product_name_snapshot/);
  assert.match(migration, /'DEPOSIT_PAID'/);
});
