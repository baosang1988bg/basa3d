// Apply the pending Supabase migrations to the database in DATABASE_URL (.env), for a QC/production
// release. There is no migration-tracking table on the hosted DBs (migrations were applied by hand
// via psql / SQL Editor, see README), and most migration files are NOT idempotent — so this script
// decides "already applied?" by probing the schema object each migration creates.
//
//   node scripts/deploy/apply-pending-migrations.mjs           # dry run: report only, writes nothing
//   node scripts/deploy/apply-pending-migrations.mjs --apply   # apply pending ones, one transaction each
//
// Safety:
// - Refuses to run unless every migration up to and including the BASELINE probe is present (i.e.
//   the DB really is a BaSa3D DB that already went through the pre-October migrations).
// - Refuses if a migration file exists that has no probe below (forces a human to add one rather
//   than guessing).
// - Each migration runs in its own BEGIN/COMMIT; a failure rolls that one back and stops.
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

const columnExists = (table, column) => ({
  sql: `select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2`,
  values: [table, column],
});
const tableExists = (table) => ({ sql: `select 1 where to_regclass($1) is not null`, values: [`public.${table}`] });

// Baseline: the last migration before the October batch. Everything at or before it must already be
// applied on the target DB; this script does not bootstrap an empty database.
const BASELINE = { file: '20260908000000_copyright_compliance.sql', probe: columnExists('products', 'license_type') };

const PROBES = {
  // Idempotent (loops over tables without RLS + revokes) — "applied" when no public table lacks RLS.
  '20261012000000_enable_rls_public_tables.sql': {
    sql: `select 1 where not exists (
            select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity)`,
    values: [],
  },
  '20261013000000_makerworld_storefront_pricing.sql': tableExists('makerworld_price_presets'),
  '20261014000000_custom_request_quote_estimate.sql': columnExists('custom_requests', 'quote_estimate_snapshot'),
  '20261015000000_vat_versioned.sql': columnExists('pricing_configs', 'vat_enabled'),
  '20261015000001_custom_request_items.sql': tableExists('custom_request_items'),
};

async function probe(client, { sql, values }) {
  return (await client.query(sql, values)).rowCount > 0;
}

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (.env).');
  const host = new URL(url).hostname;

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const after = files.filter((f) => f > BASELINE.file);
  const unknown = after.filter((f) => !PROBES[f]);
  if (unknown.length) {
    throw new Error(`No probe defined for: ${unknown.join(', ')} — add one to PROBES before running.`);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    console.log(`Target DB host: ${host}`);
    if (!(await probe(client, BASELINE.probe))) {
      throw new Error(`Baseline ${BASELINE.file} is not applied on this DB — refusing (not a migrated BaSa3D DB?).`);
    }
    console.log(`baseline OK   ${BASELINE.file}`);

    // Pre-flight for the last migration: it raises if the storage bucket is missing.
    const bucket = await client.query(`select 1 from storage.buckets where id = 'custom-request-attachments'`).catch(() => ({ rowCount: 0 }));
    if (!bucket.rowCount) console.warn('WARN  storage bucket custom-request-attachments not found — 20261015000001 will fail.');

    const pending = [];
    for (const file of after) {
      const done = await probe(client, PROBES[file]);
      console.log(`${done ? 'applied       ' : 'PENDING       '}${file}`);
      if (!done) pending.push(file);
    }

    if (!pending.length) return console.log('Up to date — nothing to apply.');
    if (!apply) return console.log(`\nDry run: ${pending.length} pending. Re-run with --apply to execute.`);

    for (const file of pending) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        if (!(await probe(client, PROBES[file]))) throw new Error('probe still fails after running the file');
        await client.query('commit');
        console.log(`APPLIED       ${file}`);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed and was rolled back: ${error.message}`);
      }
    }
    console.log(`Done — ${pending.length} migration(s) applied.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
