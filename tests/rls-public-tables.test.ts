// Guards supabase/migrations/20261012000000_enable_rls_public_tables.sql: every table in `public`
// must have RLS enabled, otherwise Supabase's REST API exposes it to anyone holding the public anon
// key. Fails as soon as a future migration adds a table without `enable row level security`.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

test('every table in the public schema has row level security enabled', { skip: !hasDb }, async () => {
  const result = await query<{ relname: string }>(`
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
      -- local-only bookkeeping table created by scripts/test-db-setup.ts, never exists in Supabase
      and c.relname <> '_local_test_migrations'
    order by c.relname`);
  assert.deepEqual(result.rows.map((row) => row.relname), [], 'tables without RLS — add `alter table ... enable row level security` in the migration');
});

test('the Supabase API roles hold no privileges on public tables (when those roles exist)', { skip: !hasDb }, async () => {
  const roles = await query<{ rolname: string }>(`select rolname from pg_roles where rolname in ('anon', 'authenticated')`);
  if (!roles.rowCount) return; // plain PostgreSQL test database — nothing to check
  const grants = await query<{ grantee: string; table_name: string; privilege_type: string }>(`
    select grantee, table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
    order by table_name, grantee, privilege_type`);
  assert.deepEqual(grants.rows, []);
});
