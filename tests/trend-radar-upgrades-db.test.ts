// ADR-0063 — DB-level checks: publish gate, product link, audit rows, snapshots/velocity, visual cache.
// Runs only when TEST_DATABASE_URL points to a local disposable Postgres with all migrations applied.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
const skip = !hasDb && 'TEST_DATABASE_URL not set';

const cleanup: { items: string[]; products: string[]; categories: string[]; staff: string[]; hashes: string[] } = { items: [], products: [], categories: [], staff: [], hashes: [] };

after(async () => {
  if (!hasDb) return;
  const { getPool } = await import('../src/lib/db');
  const db = getPool();
  await db.query('delete from trend_watch_items where id = any($1::uuid[])', [cleanup.items]);
  await db.query('delete from products where id = any($1::uuid[])', [cleanup.products]);
  await db.query('delete from categories where id = any($1::uuid[])', [cleanup.categories]);
  await db.query('delete from visual_search_cache where image_sha256 = any($1::text[])', [cleanup.hashes]);
  await db.query('delete from staff_profiles where id = any($1::uuid[])', [cleanup.staff]);
  await db.query('delete from auth.users where id = any($1::uuid[])', [cleanup.staff]);
  await db.end();
  globalThis.__basa3d_pool = undefined;
});

async function seedProduct() {
  const { getPool } = await import('../src/lib/db');
  const db = getPool();
  const suffix = randomUUID().slice(0, 8);
  const category = await db.query<{ id: string }>(`insert into categories (name, slug) values ($1, $2) returning id`, [`Trend ${suffix}`, `trend-${suffix}`]);
  cleanup.categories.push(category.rows[0].id);
  const product = await db.query<{ id: string }>(
    `insert into products (category_id, name, slug, product_type, status, base_price, license_type)
     values ($1, $2, $3, 'MADE_TO_ORDER', 'DRAFT', 50000, 'UNKNOWN') returning id`,
    [category.rows[0].id, `Trend product ${suffix}`, `trend-product-${suffix}`],
  );
  cleanup.products.push(product.rows[0].id);
  return product.rows[0].id;
}

async function seedStaff() {
  const { getPool } = await import('../src/lib/db');
  const id = randomUUID();
  await getPool().query('insert into auth.users (id) values ($1)', [id]);
  await getPool().query(`insert into staff_profiles (id, full_name, role) values ($1, 'Trend tester', 'OWNER')`, [id]);
  cleanup.staff.push(id);
  return id;
}

test('non-commercial trend product cannot go ACTIVE without license type + proof', { skip }, async () => {
  const { getPool, withTransaction } = await import('../src/lib/db');
  const svc = await import('../src/services/trend-hunter.service');
  const db = getPool();
  const actorId = await seedStaff();
  const productId = await seedProduct();
  const { id: itemId } = await svc.saveTrendWatchItem({
    sourceUrl: `https://www.printables.com/model/${Date.now()}-nc`, platform: 'PRINTABLES', title: 'NC model',
    license: 'Creative Commons — Attribution — Noncommercial (CC BY-NC)', licenseSource: 'PLATFORM_API',
    stats: { downloads: 100, likes: 5, prints: null },
  }, actorId);
  cleanup.items.push(itemId);

  const saved = await db.query<{ license_status: string; license_source: string }>('select license_status, license_source from trend_watch_items where id = $1', [itemId]);
  assert.deepEqual(saved.rows[0], { license_status: 'NON_COMMERCIAL', license_source: 'PLATFORM_API' });

  await withTransaction((client) => svc.linkTrendItemToProduct(client, { trendItemId: itemId, productId, actorId }));
  const linked = await db.query<{ status: string; product_id: string }>('select status, product_id from trend_watch_items where id = $1', [itemId]);
  assert.deepEqual(linked.rows[0], { status: 'CONVERTED_DRAFT', product_id: productId });

  await assert.rejects(db.query(`update products set status = 'ACTIVE' where id = $1`, [productId]), /TREND_PUBLISH_BLOCKED:LICENSE_PROOF_REQUIRED/);
  await assert.rejects(db.query(`update products set status = 'ACTIVE', license_type = 'COMMERCIAL_LICENSE' where id = $1`, [productId]), /TREND_PUBLISH_BLOCKED/);
  await db.query(`update products set status = 'ACTIVE', license_type = 'COMMERCIAL_LICENSE', license_proof_url = 'https://example.com/receipt.pdf' where id = $1`, [productId]);
  // Removing the proof while ACTIVE is blocked too.
  await assert.rejects(db.query(`update products set license_proof_url = null where id = $1`, [productId]), /TREND_PUBLISH_BLOCKED/);

  // A second product cannot be linked to the same trend item.
  const otherProduct = await seedProduct();
  await assert.rejects(
    withTransaction((client) => svc.linkTrendItemToProduct(client, { trendItemId: itemId, productId: otherProduct, actorId })),
    (e: unknown) => (e as { code?: string }).code === 'TREND_ALREADY_CONVERTED',
  );

  const audit = await db.query<{ action: string }>(`select action from audit_logs where entity_type = 'trend_watch_item' and entity_id = $1 order by created_at`, [itemId]);
  assert.deepEqual(audit.rows.map((row) => row.action), ['TREND_ITEM_CREATED', 'TREND_ITEM_CONVERTED']);
});

test('commercial-allowed trend product publishes without proof; linking an ACTIVE unproven product is refused', { skip }, async () => {
  const { getPool, withTransaction } = await import('../src/lib/db');
  const svc = await import('../src/services/trend-hunter.service');
  const db = getPool();
  const actorId = await seedStaff();

  const okProduct = await seedProduct();
  const { id: okItem } = await svc.saveTrendWatchItem({ sourceUrl: `https://makerworld.com/en/models/${Date.now()}`, platform: 'MAKERWORLD', title: 'BY model', license: 'BY', licenseSource: 'PAGE_DATA' }, actorId);
  cleanup.items.push(okItem);
  await withTransaction((client) => svc.linkTrendItemToProduct(client, { trendItemId: okItem, productId: okProduct, actorId }));
  await db.query(`update products set status = 'ACTIVE', license_type = 'CC_BY' where id = $1`, [okProduct]);

  const activeProduct = await seedProduct();
  await db.query(`update products set status = 'ACTIVE' where id = $1`, [activeProduct]);
  const { id: ncItem } = await svc.saveTrendWatchItem({ sourceUrl: `https://makerworld.com/en/models/${Date.now() + 1}`, platform: 'MAKERWORLD', title: 'SDFL model', license: 'Standard Digital File License' }, actorId);
  cleanup.items.push(ncItem);
  await assert.rejects(
    withTransaction((client) => svc.linkTrendItemToProduct(client, { trendItemId: ncItem, productId: activeProduct, actorId })),
    /TREND_PUBLISH_BLOCKED/,
  );
});

test('snapshots: one row per day, velocity from the ≤7-day baseline', { skip }, async () => {
  const { getPool } = await import('../src/lib/db');
  const svc = await import('../src/services/trend-hunter.service');
  const db = getPool();
  const { id } = await svc.saveTrendWatchItem({ sourceUrl: `https://www.printables.com/model/${(Date.now() % 1_000_000_000) + 2}-v`, platform: 'PRINTABLES', title: 'Velocity', stats: { downloads: 1000, likes: 50, prints: 2 } });
  cleanup.items.push(id);
  // Backdate a baseline 7 days earlier and an older one outside the window.
  await db.query(`insert into trend_watch_snapshots (item_id, captured_on, downloads, likes) values ($1, (timezone('utc', now()))::date - 7, 300, 20), ($1, (timezone('utc', now()))::date - 20, 10, 1)`, [id]);

  const item = (await svc.listTrendWatchItems()).find((row) => row.id === id);
  assert.ok(item?.popularity);
  assert.equal(item.popularity.downloads, 1000);
  assert.equal(item.popularity.windowDays, 7);
  assert.equal(item.popularity.downloadsPerDay, 100);
  assert.equal(item.popularity.likesPerDay, 4.3);

  // Cron run: Printables stats from a fake API overwrite today's row instead of duplicating it.
  const fetchImpl = async () => new Response(JSON.stringify({ data: { print: { id: '1', likesCount: 60, downloadCount: 1100, makesCount: 3 } } }), { status: 200 });
  await db.query(`delete from trend_watch_snapshots where item_id = $1 and captured_on = (timezone('utc', now()))::date`, [id]);
  const run = await svc.captureTrendSnapshots({ limit: 500, deps: { fetchImpl } });
  assert.ok(run.captured >= 1);
  const today = await db.query<{ n: string; downloads: number }>(`select count(*) as n, max(downloads) as downloads from trend_watch_snapshots where item_id = $1 and captured_on = (timezone('utc', now()))::date`, [id]);
  assert.equal(Number(today.rows[0].n), 1);
  assert.equal(today.rows[0].downloads, 1100);
});

test('visual search cache: write, hit counter, TTL prune', { skip }, async () => {
  const { getPool } = await import('../src/lib/db');
  const cache = await import('../src/services/visual-search-cache.service');
  const hash = cache.visualSearchImageHash(Buffer.from(randomUUID()).toString('base64'));
  cleanup.hashes.push(hash);
  assert.equal(await cache.readVisualSearchCache(hash), null);
  await cache.writeVisualSearchCache(hash, { objectName: 'gear', keywordsEn: ['gear'], aiUsed: true });
  assert.deepEqual(await cache.readVisualSearchCache(hash), { objectName: 'gear', keywordsEn: ['gear'], aiUsed: true });
  const row = await getPool().query<{ hit_count: number }>('select hit_count from visual_search_cache where image_sha256 = $1', [hash]);
  assert.equal(row.rows[0].hit_count, 1);
  await getPool().query(`update visual_search_cache set created_at = created_at - interval '31 days' where image_sha256 = $1`, [hash]);
  assert.equal(await cache.readVisualSearchCache(hash), null);
  assert.ok((await cache.pruneVisualSearchCache()) >= 1);
});
