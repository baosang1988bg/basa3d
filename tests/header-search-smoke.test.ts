// ADR-0064 — end-to-end smoke against the real `next start` server that `npm test` boots on :3411 (needs
// TEST_DATABASE_URL). Catches what unit tests cannot: SSR errors, wrong routing of the quote links, header wiring.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
const skip = !hasDb && 'TEST_DATABASE_URL not set (server not started)';
const BASE = 'http://localhost:3411';
const suffix = randomUUID().slice(0, 8);
let productId: string | null = null;

after(async () => {
  if (!hasDb) return;
  const { getPool } = await import('../src/lib/db');
  if (productId) await getPool().query('delete from products where id = $1', [productId]);
  await getPool().end();
  globalThis.__basa3d_pool = undefined;
});

async function get(path: string) {
  const res = await fetch(BASE + path, { redirect: 'follow' });
  return { status: res.status, body: await res.text() };
}

test('header search: SSR pages, accent-insensitive catalog search, suggest API, quote-link landing pages', { skip }, async () => {
  const { query } = await import('../src/lib/db');
  const row = await query<{ id: string }>(
    `insert into products (name, slug, product_type, status, base_price) values ($1, $2, 'MADE_TO_ORDER', 'ACTIVE', 120000) returning id`,
    [`Giá đỡ tai nghe ${suffix}`, `gia-do-tai-nghe-${suffix}`],
  );
  productId = row.rows[0].id;

  const home = await get('/vi/home');
  assert.equal(home.status, 200);
  assert.ok(home.body.includes('Mở tìm kiếm'), 'header renders the search button');

  const listing = await get(`/vi/products?q=${encodeURIComponent(`gia do ${suffix}`)}`);
  assert.equal(listing.status, 200);
  assert.ok(listing.body.includes(`Giá đỡ tai nghe ${suffix}`), '/products?q= is accent-insensitive');

  const empty = await get(`/vi/products?q=${encodeURIComponent(`khong-co-${suffix}`)}`);
  assert.equal(empty.status, 200);
  assert.ok(empty.body.includes('trên kho mẫu 3D mạng'), 'zero results offer the online 3D search');

  assert.equal((await get('/vi/products?q=%25')).status, 200, '% is literal, no 500');

  const suggest = await get(`/api/public/products/suggest?q=${encodeURIComponent(`gia do ${suffix}`)}`);
  assert.equal(suggest.status, 200);
  assert.equal((JSON.parse(suggest.body) as { data: { items: { id: string }[] } }).data.items[0]?.id, productId);

  const ref = await get('/vi/bao-gia?tab=file&ref=https%3A%2F%2Fwww.printables.com%2Fmodel%2F3161-3d-benchy');
  assert.equal(ref.status, 200);
  assert.ok(ref.body.includes('Bạn đang báo giá mẫu từ link'), 'non-MakerWorld link lands on /bao-gia file tab with guidance');

  const bad = await get('/vi/bao-gia?tab=file&ref=javascript%3Aalert(1)');
  assert.equal(bad.status, 200);
  assert.ok(!bad.body.includes('Bạn đang báo giá mẫu từ link'));
  assert.doesNotMatch(bad.body, /href="javascript:/);

  assert.equal((await get('/vi/bao-gia?tab=link&url=https%3A%2F%2Fmakerworld.com%2Fen%2Fmodels%2F1')).status, 200);

  const custom = await get('/vi/custom-print?ref=https%3A%2F%2Fwww.printables.com%2Fmodel%2F1');
  assert.equal(custom.status, 200);
  assert.ok(custom.body.includes('href="https://www.printables.com/model/1"'), '/custom-print fallback shows the reference link');
});
