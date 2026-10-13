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
const migrationSql = await readFile(`supabase/migrations/${version}_${name}.sql`, 'utf8');
// Phase 33 S2 (T6): custom_request_items (added after this migration was written) are immutable
// and FK-restrict their custom request, so a selected fixture request that has items would make the
// cleanup refuse. Extend the in-memory SQL (the applied migration file itself is never edited):
// select the items of selected requests, and delete them after their quotes and before their
// requests, with the session purge flag set LOCAL to this transaction only.
function withItemPurge(text) {
  const selectMarker = '-- Refuse to mutate ANY retained child';
  const deleteMarker = "delete from public.custom_requests where id in";
  if (!text.includes(selectMarker) || !text.includes(deleteMarker)) throw new Error('cleanup SQL markers not found — review withItemPurge()');
  const selectItems = `do $items$ begin
  if to_regclass('public.custom_request_items') is not null then
    insert into cleanup_targets select 'custom_request_items', i.id from public.custom_request_items i
    where i.custom_request_id in (select id from cleanup_targets where table_name='custom_requests');
  end if;
end $items$;

`;
  const deleteItems = `set local basa3d.allow_item_purge = 'on';
do $items$ begin
  if to_regclass('public.custom_request_items') is not null then
    delete from public.custom_request_items where id in (select id from cleanup_targets where table_name='custom_request_items');
  end if;
end $items$;
`;
  return text.replace(selectMarker, selectItems + selectMarker).replace(deleteMarker, deleteItems + deleteMarker);
}
const sql = withItemPurge(migrationSql);
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
    if (history) await client.query('insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3) on conflict (version) do nothing', [version, [migrationSql], name]);
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
