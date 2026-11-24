// ADR-0064 — DB checks for accent-insensitive catalog search, the suggest route and the admin hot-trend card.
// Runs only with TEST_DATABASE_URL (local disposable Postgres with all migrations).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
const skip = !hasDb && 'TEST_DATABASE_URL not set';
const suffix = randomUUID().slice(0, 8);
const productIds: string[] = [];
const trendIds: string[] = [];

after(async () => {
  if (!hasDb) return;
  const { getPool } = await import('../src/lib/db');
  await getPool().query('delete from products where id = any($1::uuid[])', [productIds]);
  await getPool().query('delete from trend_watch_items where id = any($1::uuid[])', [trendIds]);
  await getPool().end();
  globalThis.__basa3d_pool = undefined;
});

async function seed(name: string, status: 'ACTIVE' | 'DRAFT' = 'ACTIVE') {
  const { getPool } = await import('../src/lib/db');
  const slug = `${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${suffix}-${productIds.length}`;
  const row = await getPool().query<{ id: string }>(
    `insert into products (name, slug, product_type, status, base_price) values ($1, $2, 'MADE_TO_ORDER', $3, 50000) returning id`,
    [`${name} ${suffix}`, slug, status],
  );
  productIds.push(row.rows[0].id);
  return row.rows[0].id;
}

test('fold function strips Vietnamese diacritics (upper + lower) and đ', { skip }, async () => {
  const { query } = await import('../src/lib/db');
  const r = await query<{ a: string; b: string }>(`select public.basa3d_search_fold('Giá Đỡ Tai Nghe ỨNG DỤNG') as a, public.basa3d_search_fold('ĐỒ CHƠI Ếch') as b`);
  assert.deepEqual(r.rows[0], { a: 'gia do tai nghe ung dung', b: 'do choi ech' });
});

test('listing search: accent-insensitive, every word must match, DRAFT hidden, % and _ literal', { skip }, async () => {
  const { listStorefrontProducts } = await import('../src/services/storefront-catalog.service');
  await seed('Giá đỡ tai nghe');
  await seed('Giá đỡ điện thoại');
  await seed('Giá đỡ bí mật', 'DRAFT');
  await seed('Khay 100% gọn_gàng');
  const names = async (search: string) => (await listStorefrontProducts({ search: `${search} ${suffix}`, limit: 50 })).items.map((i) => i.name.replace(` ${suffix}`, '')).sort();

  assert.deepEqual(await names('gia do'), ['Giá đỡ tai nghe', 'Giá đỡ điện thoại']);
  assert.deepEqual(await names('GIA DO TAI'), ['Giá đỡ tai nghe']);
  assert.deepEqual(await names('giá đỡ nghe'), ['Giá đỡ tai nghe']);
  assert.deepEqual(await names('dien thoai'), ['Giá đỡ điện thoại']);
  assert.deepEqual(await names('bi mat'), [], 'DRAFT products never appear');
  assert.deepEqual(await names('100%'), ['Khay 100% gọn_gàng']);
  assert.deepEqual(await names('%'), ['Khay 100% gọn_gàng'], '% is literal');
  assert.deepEqual(await names('gon_gang'), ['Khay 100% gọn_gàng']);
  assert.deepEqual(await names('gonxgang'), [], '_ is literal');
});

test('suggest route returns ≤ 6 ACTIVE products with the public shape', { skip }, async () => {
  const { GET } = await import('../src/app/api/public/products/suggest/route');
  for (let i = 0; i < 8; i += 1) await seed(`Móc khoá mèo ${i}`);
  const res = await GET(new Request(`https://x/api/public/products/suggest?q=${encodeURIComponent(`moc khoa ${suffix}`)}`));
  assert.equal(res.status, 200);
  const body = await res.json() as { data: { items: Record<string, unknown>[]; query: string } };
  assert.equal(body.data.items.length, 6);
  assert.deepEqual(Object.keys(body.data.items[0]).sort(), ['basePrice', 'id', 'imageUrl', 'inStock', 'maxPrice', 'minPrice', 'name', 'productType', 'slug']);
});

test('getHotTrendItems ranks active trend items by downloads/day', { skip }, async () => {
  const { query } = await import('../src/lib/db');
  const svc = await import('../src/services/trend-hunter.service');
  const make = async (title: string, status: string, today: number, weekAgo: number) => {
    const row = await query<{ id: string }>(
      `insert into trend_watch_items (source_url, platform, title, status) values ($1, 'PRINTABLES', $2, $3) returning id`,
      [`https://www.printables.com/model/${Math.floor(Math.random() * 1e9)}-${suffix}`, `${title} ${suffix}`, status],
    );
    const id = row.rows[0].id;
    trendIds.push(id);
    await query(`insert into trend_watch_snapshots (item_id, captured_on, downloads, likes) values
      ($1, (timezone('utc', now()))::date, $2, 10), ($1, (timezone('utc', now()))::date - 7, $3, 3)`, [id, today, weekAgo]);
  };
  await make('Slow', 'WATCHING', 170, 100);
  await make('Fast', 'PRINT_TESTING', 1100, 400);
  await make('Archived fast', 'ARCHIVED', 99999, 0);
  const hot = (await svc.getHotTrendItems(50)).filter((item) => item.title.endsWith(suffix)).map((item) => item.title.replace(` ${suffix}`, ''));
  assert.deepEqual(hot, ['Fast', 'Slow']);
});
