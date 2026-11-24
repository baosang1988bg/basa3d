// ADR-0062 §1/§4 — trend_watch_items through pg.Pool against a real (local, disposable) database.
// Runs only when TEST_DATABASE_URL is set (see tests/helpers/test-environment.ts).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);

const created: string[] = [];

after(async () => {
  if (!hasDb) return;
  const { getPool } = await import('../src/lib/db');
  if (created.length) await getPool().query('delete from trend_watch_items where id = any($1::uuid[])', [created]);
  await getPool().end();
  globalThis.__basa3d_pool = undefined;
});

test('trend watchlist: save, duplicate, list, transitions, delete', { skip: !hasDb && 'TEST_DATABASE_URL not set' }, async () => {
  const svc = await import('../src/services/trend-hunter.service');
  const { DomainError } = await import('../src/lib/domain-error');
  const sourceUrl = `https://www.printables.com/model/${randomUUID()}`;

  const { id } = await svc.saveTrendWatchItem({ sourceUrl, platform: 'PRINTABLES', title: 'Flexi', license: 'BY-NC', estimatedGrams: 42.5 });
  created.push(id);

  await assert.rejects(
    svc.saveTrendWatchItem({ sourceUrl, platform: 'PRINTABLES', title: 'Flexi again' }),
    (e: unknown) => e instanceof DomainError && e.status === 409 && e.code === 'TREND_DUPLICATE',
  );

  const items = await svc.listTrendWatchItems();
  const item = items.find((row) => row.id === id);
  assert.ok(item);
  assert.equal(item.status, 'WATCHING');
  assert.equal(item.estimatedGrams, 42.5);
  assert.equal(item.licenseSafety.status, 'NON_COMMERCIAL');

  await svc.updateTrendWatchItemStatus(id, 'PRINT_TESTING');
  await svc.updateTrendWatchItemStatus(id, 'CONVERTED_DRAFT');
  await assert.rejects(
    svc.updateTrendWatchItemStatus(id, 'WATCHING'),
    (e: unknown) => e instanceof DomainError && e.code === 'TREND_INVALID_TRANSITION',
  );
  await svc.updateTrendWatchItemStatus(id, 'CONVERTED_DRAFT'); // same-status no-op

  await assert.rejects(svc.updateTrendWatchItemStatus(randomUUID(), 'ARCHIVED'), (e: unknown) => e instanceof DomainError && e.status === 404);
  await assert.rejects(svc.deleteTrendWatchItem(randomUUID()), (e: unknown) => e instanceof DomainError && e.status === 404);

  await svc.deleteTrendWatchItem(id);
  created.splice(created.indexOf(id), 1);
});

test('trend_watch_items: DB constraints back up the schema', { skip: !hasDb && 'TEST_DATABASE_URL not set' }, async () => {
  const { getPool } = await import('../src/lib/db');
  const pool = getPool();
  await assert.rejects(pool.query(`insert into trend_watch_items (source_url, platform, title, status) values ('https://x.test/1', 'PRINTABLES', 'x', 'SOLD')`));
  await assert.rejects(pool.query(`insert into trend_watch_items (source_url, platform, title) values ('https://x.test/2', 'PRINTABLES', '   ')`));
  await assert.rejects(pool.query(`insert into trend_watch_items (source_url, platform, title, plate_count) values ('https://x.test/3', 'PRINTABLES', 'x', 0)`));
});
