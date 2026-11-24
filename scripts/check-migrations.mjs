import process from 'node:process';
import console from 'node:console';
import { readdir } from 'node:fs/promises';
import pg from 'pg';

// QA-001/QA-002 (docs/qa/2026-11-24-user-test-performance-audit.md): search and "Đăng sản phẩm mới"
// returned 500 because the UAT database was behind the code. This READ-ONLY script tells you which
// recent migrations are missing before you deploy.
//
//   node --env-file=.env scripts/check-migrations.mjs        (or: npm run db:check-migrations)
//
// Two checks, because UAT migrations are often pasted into the Supabase SQL editor (which does not
// record them in supabase_migrations.schema_migrations):
//   1. PROBES — look for the objects that recent migrations create (works however they were applied).
//   2. LEDGER — if supabase_migrations.schema_migrations exists, list files it has no row for.
// Exit code 1 when a probe fails, so it can gate a deploy.

const PROBES = [
  { migration: '20261027000000_quick_restock_idempotency', sql: "select to_regclass('public.admin_request_keys') is not null as ok" },
  { migration: '20261101000000_blog_post_media', sql: "select exists (select 1 from information_schema.columns where table_schema='public' and table_name='blog_posts' and column_name='media') as ok" },
  { migration: '20261112000000_product_print_files', sql: "select exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='print_local_path') as ok" },
  { migration: '20261124000000_trend_watch_items', sql: "select to_regclass('public.trend_watch_items') is not null as ok" },
  { migration: '20261125000000_trend_radar_upgrades', sql: "select exists (select 1 from information_schema.columns where table_schema='public' and table_name='trend_watch_items' and column_name='product_id') as ok" },
  { migration: '20261126000000_storefront_search_fold', sql: "select exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='basa3d_search_fold') as ok" },
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run: node --env-file=.env scripts/check-migrations.mjs');
  process.exit(2);
}

const client = new pg.Client({ connectionString: url, ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false } });
await client.connect();
let failed = 0;
try {
  await client.query('set default_transaction_read_only = on');

  console.log('Probes (objects created by recent migrations):');
  for (const probe of PROBES) {
    const { rows } = await client.query(probe.sql);
    const ok = rows[0]?.ok === true;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'OK     ' : 'MISSING'}  ${probe.migration}.sql`);
  }

  const ledger = await client.query("select to_regclass('supabase_migrations.schema_migrations') is not null as ok");
  if (ledger.rows[0]?.ok) {
    const applied = new Set((await client.query('select version from supabase_migrations.schema_migrations')).rows.map((row) => String(row.version)));
    const files = (await readdir('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
    const pending = files.filter((file) => !applied.has(file.split('_')[0]));
    console.log(`\nLedger supabase_migrations.schema_migrations: ${pending.length} file(s) without a row.`);
    for (const file of pending.slice(-20)) console.log(`  - ${file}`);
    if (pending.length) console.log('  (A file applied by hand in the SQL editor also shows here — trust the probes above.)');
  } else {
    console.log('\nNo supabase_migrations.schema_migrations table — only the probes above apply.');
  }
} finally {
  await client.end();
}

if (failed) {
  console.error(`\n${failed} migration(s) missing. Apply them (oldest first) before deploying this build.`);
  process.exit(1);
}
console.log('\nAll probed migrations are present.');
