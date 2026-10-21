// Prepare a LOCAL, disposable PostgreSQL database for `npm test` (docs/operations/local-testing.md).
//
//   npm run test:db:setup            # apply any migrations not yet applied
//   npm run test:db:setup -- --reset # drop + recreate the test database first
//
// Safety: reads ONLY `TEST_DATABASE_URL` and reuses tests/helpers/test-environment.ts's guard, so it
// refuses any non-localhost host and refuses a URL equal to the app's DATABASE_URL. It never touches
// the Development/Production Supabase projects.
//
// On a plain PostgreSQL (Homebrew / Postgres.app) the Supabase-managed `auth` and `storage` schemas
// don't exist; minimal stubs are created so migrations that reference `auth.users` /
// `storage.buckets` apply. On a local Supabase (`supabase start`) the real schemas already exist and
// the stubs are skipped.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { isolatedTestEnvironment } from '../tests/helpers/test-environment';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not set. Add e.g. TEST_DATABASE_URL=postgresql://localhost:5432/basa3d_test to .env (see docs/operations/local-testing.md).');
  }
  // Throws for non-local hosts or a URL pointing at the app database.
  isolatedTestEnvironment(process.env);

  const target = new URL(testUrl);
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, '')) || 'postgres';

  if (process.argv.includes('--reset')) {
    if (databaseName === 'postgres') throw new Error('--reset refuses to drop the "postgres" database. Use a dedicated test database name.');
    const admin = new URL(testUrl);
    admin.pathname = '/postgres';
    const adminClient = new Client({ connectionString: admin.toString() });
    await adminClient.connect();
    try {
      await adminClient.query(`drop database if exists "${databaseName.replaceAll('"', '""')}" with (force)`);
      await adminClient.query(`create database "${databaseName.replaceAll('"', '""')}"`);
      console.log(`Recreated database ${databaseName}`);
    } finally {
      await adminClient.end();
    }
  }

  const client = new Client({ connectionString: testUrl });
  await client.connect();
  try {
    const hasAuth = await client.query(`select 1 from information_schema.schemata where schema_name = 'auth'`);
    if (!hasAuth.rowCount) {
      await client.query(`
        create schema auth;
        create table auth.users (id uuid primary key);
        create schema if not exists storage;
        create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
      console.log('Created minimal auth/storage stubs (plain PostgreSQL).');
    }
    // Phase 33 S2: the orphan-upload cron reads storage.objects. Real local Supabase has it; on plain
    // PostgreSQL create a minimal stub (marked by its comment so tests know it is a stub).
    const hasObjects = await client.query(`select to_regclass('storage.objects') as name`);
    if (!hasObjects.rows[0].name) {
      await client.query(`
        create schema if not exists storage;
        create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, metadata jsonb, created_at timestamptz not null default now());
        comment on table storage.objects is 'basa3d local test stub';`);
      console.log('Created minimal storage.objects stub (plain PostgreSQL).');
    } else {
      // Feature 003: bucket usage sums storage.objects.metadata->>'size'; older stubs lack the column.
      const isStub = await client.query(`select obj_description('storage.objects'::regclass) = 'basa3d local test stub' as stub`);
      if (isStub.rows[0].stub) await client.query('alter table storage.objects add column if not exists metadata jsonb');
    }
    await client.query(`create table if not exists public._local_test_migrations (name text primary key, applied_at timestamptz not null default now())`);
    const applied = new Set((await client.query<{ name: string }>('select name from public._local_test_migrations')).rows.map((row) => row.name));

    const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort();
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public._local_test_migrations (name) values ($1)', [file]);
        await client.query('commit');
        console.log(`applied ${file}`);
        count += 1;
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }
    console.log(count ? `Done — ${count} migration(s) applied to ${databaseName}.` : `Up to date — ${databaseName}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
