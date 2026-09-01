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

test('Phase 4 migration adds attachment_url, WEBSITE channel, and reverts actor_id nullability', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/20260831000000_public_custom_request_support.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /add column attachment_url text/);
  assert.match(migration, /add value 'WEBSITE'/);
  assert.match(migration, /alter column actor_id drop not null/);
});

test('hardening migrations make attachments private and staff deletion restrictive', async () => {
  const attachmentMigration = await readFile(new URL('../supabase/migrations/20260901000000_hardening_private_attachments.sql', import.meta.url), 'utf8');
  assert.match(attachmentMigration, /add column (?:if not exists )?attachment_path text/);
  assert.match(attachmentMigration, /set public = false/);
  assert.doesNotMatch(attachmentMigration, /drop column attachment_url/);
  const staffMigration = await readFile(new URL('../supabase/migrations/20260901000001_staff_profiles_delete_restrict.sql', import.meta.url), 'utf8');
  assert.match(staffMigration, /foreign key \(id\).*on delete restrict/);
});
