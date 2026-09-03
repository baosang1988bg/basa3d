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

test('hardening follow-up migration creates the shared rate-limit store', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260901000002_rate_limit_attempts.sql', import.meta.url), 'utf8');
  assert.match(migration, /create table rate_limit_attempts/);
  assert.match(migration, /primary key \(scope, limiter_key\)/);
  assert.match(migration, /window_expires_at/);
});

test('Phase 10 migration adds the nullable GA4 purchase idempotency marker', async () => {
  const sql = await readFile('supabase/migrations/20260901000003_order_analytics_purchase_sent_at.sql', 'utf8');
  assert.match(sql, /alter table orders add column analytics_purchase_sent_at timestamptz null/i);
  assert.doesNotMatch(sql, /not null/i);
});

test('Phase 12 migration adds filament_spools/expenses tables and per-spool ledger linkage', async () => {
  const sql = await readFile('supabase/migrations/20260903000000_filament_spools_and_expenses.sql', 'utf8');
  assert.match(sql, /create table filament_spools \(/);
  assert.match(sql, /create table expenses \(/);
  assert.match(sql, /alter table material_movements add column spool_id uuid references filament_spools\(id\) on delete restrict/);
  assert.match(sql, /create index material_movements_spool_id_idx on material_movements\(spool_id, created_at desc\)/);
  assert.match(sql, /alter table print_jobs add column spool_id uuid references filament_spools\(id\) on delete restrict/);
  // Q5: status is a 2-value manual flag only — the 4-tier warning display is computed at query
  // time from the weight columns, never stored, so it must not leak into the CHECK constraint.
  assert.match(sql, /status in \('ACTIVE', 'ARCHIVED'\)/);
  assert.doesNotMatch(sql, /LOW_STOCK|'EMPTY'/);
});

test('Phase 12 seed migration links material_movements to filament_spools via a single CTE with RETURNING, not an independent insert', async () => {
  const sql = await readFile('supabase/migrations/20260903000001_filament_spools_and_expenses_seed.sql', 'utf8');
  // Q3: the material_movements PURCHASE rows must be SELECTed from the filament_spools insert's
  // RETURNING clause (same CTE), so a re-run naturally skips both tables together — material_movements
  // has no unique constraint of its own and is immutable (prevent_ledger_mutation), so an independent
  // second INSERT would silently duplicate PURCHASE rows on every re-run.
  assert.match(sql, /with inserted_spools as \(/i);
  assert.match(sql, /insert into filament_spools[\s\S]*?on conflict \(spool_code\) do nothing[\s\S]*?returning id, initial_weight_grams/i);
  assert.match(sql, /insert into material_movements[\s\S]*?select[\s\S]*?from inserted_spools/i);
  assert.match(sql, /reference_type/i);
  assert.match(sql, /'SEED_MIGRATION'/);
  assert.match(sql, /insert into expenses[\s\S]*?on conflict \(expense_code\) do nothing/i);
});
