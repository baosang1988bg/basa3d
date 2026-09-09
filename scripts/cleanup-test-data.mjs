import process from 'node:process';
import console from 'node:console';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Run with node --env-file=.env scripts/cleanup-test-data.mjs [--apply].
// Default is a full transactional rehearsal followed by ROLLBACK.
const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some((arg) => arg !== '--apply')) throw new Error('Unknown argument');
const version = '20260905000000';
const name = 'remove_accumulated_test_data';
const sql = await readFile(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '10s'");
  const tables = (await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map((r) => r.tablename);
  await client.query(`LOCK TABLE ${tables.map((t) => `public.${quote(t)}`).join(', ')} IN SHARE ROW EXCLUSIVE MODE`);
  const before = {};
  for (const table of tables) before[table] = (await client.query(`select * from public.${quote(table)} r order by row_to_json(r)::text`)).rows;
  await mkdir('.local-backups', { recursive: true, mode: 0o700 });
  const backupPath = `.local-backups/test-cleanup-${Date.now()}.json`;
  const backup = JSON.stringify({ version, createdAt: new Date().toISOString(), data: before });
  await writeFile(backupPath, backup, { mode: 0o600, flag: 'wx' });
  if (await readFile(backupPath, 'utf8') !== backup) throw new Error('Backup verification failed');
  console.log('Backup:', backupPath, 'sha256:', createHash('sha256').update(backup).digest('hex'));
  await client.query(sql);
  const targets = (await client.query('select table_name, id from cleanup_targets')).rows;
  const report = {};
  for (const table of tables) {
    const selected = new Set(targets.filter((r) => r.table_name === table).map((r) => r.id));
    const expected = before[table].filter((r) => !selected.has(r.id));
    const after = (await client.query(`select * from public.${quote(table)} r order by row_to_json(r)::text`)).rows;
    if (JSON.stringify(expected) !== JSON.stringify(after)) throw new Error(`Retained data changed or unexpected deletion: ${table} (before=${before[table].length}, selected=${selected.size}, expected=${expected.length}, after=${after.length})`);
    report[table] = { before: before[table].length, deleted: selected.size, after: after.length };
  }
  const triggers = (await client.query("select tgname, tgenabled from pg_trigger where tgname in ('inventory_movements_no_update','material_movements_no_update','audit_logs_no_update')")).rows;
  if (triggers.length !== 3 || triggers.some((r) => r.tgenabled !== 'O')) throw new Error('Ledger protection not restored');
  if (apply) {
    const history = (await client.query("select to_regclass('supabase_migrations.schema_migrations') as name")).rows[0].name;
    if (history) await client.query('insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3) on conflict (version) do nothing', [version, [sql], name]);
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(apply ? 'COMMITTED' : 'DRY RUN: ROLLED BACK', JSON.stringify(report, null, 2));
  await writeFile(`${backupPath}.report.json`, JSON.stringify({ applied: apply, report, triggers }, null, 2), { mode: 0o600, flag: 'wx' });
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
