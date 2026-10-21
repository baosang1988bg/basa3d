// Feature 003 — script write service (FR-009..FR-014, SC-005, SC-006). DB-backed with an in-memory
// ImageStore: no Supabase Storage, no real bucket, nothing uploaded anywhere.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool } from '../src/lib/db.js';
import { analyzeModel } from '../src/lib/stl-import/metrics.js';
import { sourceKey, type SourceFile } from '../src/lib/stl-import/source-key.js';
import { describeModel } from '../src/lib/stl-import/naming.js';
import type { ImportPrice } from '../src/lib/stl-import/pricing.js';
import { applyImport, findImportItem, planImport, type ImageStore, type ImportModelInput } from '../src/services/stl-import-write.service.js';
import { getBucketUsageBytes } from '../src/services/storage-usage.service.js';
import { binaryStl, boxTriangles } from './fixtures/stl-import/build-fixtures';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
const createdKeys: string[] = [];
after(async () => {
  if (!hasDb) return;
  const db = getPool();
  const items = await db.query<{ id: string; product_id: string | null }>('select id, product_id from product_import_items where source_key = any($1::text[])', [createdKeys]);
  const productIds = items.rows.map((row) => row.product_id).filter(Boolean);
  await db.query('delete from product_import_items where source_key = any($1::text[])', [createdKeys]);
  await db.query('delete from product_images where product_id = any($1::uuid[])', [productIds]);
  await db.query('delete from product_variants where product_id = any($1::uuid[])', [productIds]);
  await db.query('delete from products where id = any($1::uuid[])', [productIds]);
  await db.query(`delete from storage.objects where bucket_id = 'stl-test-bucket'`);
  await db.end();
});

class MemoryStore implements ImageStore {
  objects = new Map<string, number>();
  uploads: string[] = [];
  failAfter = Infinity;
  async upload(path: string, bytes: Uint8Array) {
    if (this.uploads.length >= this.failAfter) throw new Error('simulated upload failure');
    this.uploads.push(path);
    this.objects.set(path, bytes.byteLength);
  }
  async remove(paths: string[]) { for (const path of paths) this.objects.delete(path); }
}

const PRICE: ImportPrice = { priced: false, reason: 'NO_PRICING_CONFIG' };
const webp = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3]);

function model(tag: string, overrides: Partial<ImportModelInput> & { files?: SourceFile[] } = {}): ImportModelInput {
  const rel = `WriteTest/${tag}`;
  const analysis = analyzeModel([{ relPath: `${rel}/a.stl`, bytes: binaryStl(boxTriangles([0, 0, 0], [20, 10, 5])) }]);
  const key = sourceKey(rel);
  if (!createdKeys.includes(key)) createdKeys.push(key);
  return {
    sourceKey: key, sourceRelPath: rel, sourceDir: 'WriteTest', groupMode: 'FOLDER',
    files: [{ relPath: `${rel}/a.stl`, bytes: 684, mtimeMs: 1_000 }],
    analysis, extraWarnings: [], name: `Mẫu ghi ${tag}`, description: describeModel(analysis.ok ? analysis.bboxMm : null),
    categorySlug: 'khong-ton-tai', skuCode: 'TST', price: PRICE, images: [webp(), webp(), webp(), webp()],
    ...overrides,
  };
}

async function run(store: ImageStore, input: ImportModelInput, options: { retryErrors?: boolean } = {}) {
  const action = planImport(await findImportItem(getPool(), input.sourceKey), input.files, options);
  return applyImport(getPool(), store, input, action);
}

async function counts(productId: string) {
  const db = getPool();
  const [variants, images, movements] = await Promise.all([
    db.query('select count(*)::int as n from product_variants where product_id = $1', [productId]),
    db.query('select count(*)::int as n from product_images where product_id = $1', [productId]),
    db.query('select count(*)::int as n from inventory_movements m join product_variants v on v.id = m.product_variant_id where v.product_id = $1', [productId]),
  ]);
  return { variants: variants.rows[0].n, images: images.rows[0].n, movements: movements.rows[0].n };
}

test('plan: new → CREATE, unchanged → SKIP, changed/rerender → RERENDER, approved+changed → SOURCE_CHANGED, rejected → SKIP', () => {
  const files = [{ relPath: 'a.stl', bytes: 1, mtimeMs: 1 }];
  const base = { id: 'i', productId: 'p', reviewStatus: 'PENDING' as const, renderStatus: 'RENDERED' as const, needsRerender: false, sourceFiles: files };
  assert.equal(planImport(null, files), 'CREATE');
  assert.equal(planImport(base, files), 'SKIP');
  assert.equal(planImport({ ...base, needsRerender: true }, files), 'RERENDER');
  assert.equal(planImport(base, [{ ...files[0], bytes: 2 }]), 'RERENDER');
  assert.equal(planImport({ ...base, productId: null }, files), 'CREATE');
  assert.equal(planImport({ ...base, productId: null, renderStatus: 'ERROR' }, files), 'SKIP', 'a failed model is retried only on request or when its files change');
  assert.equal(planImport({ ...base, productId: null, renderStatus: 'ERROR' }, files, { retryErrors: true }), 'CREATE');
  assert.equal(planImport({ ...base, productId: null, renderStatus: 'ERROR' }, [{ ...files[0], bytes: 2 }]), 'CREATE');
  assert.equal(planImport({ ...base, renderStatus: 'ERROR' }, files), 'SKIP');
  assert.equal(planImport({ ...base, renderStatus: 'ERROR' }, files, { retryErrors: true }), 'RERENDER');
  assert.equal(planImport({ ...base, reviewStatus: 'APPROVED' }, [{ ...files[0], bytes: 2 }]), 'SOURCE_CHANGED');
  assert.equal(planImport({ ...base, reviewStatus: 'APPROVED', needsRerender: true }, files), 'SKIP');
  assert.equal(planImport({ ...base, reviewStatus: 'REJECTED' }, [{ ...files[0], bytes: 2 }]), 'SKIP');
});

test('CREATE: one DRAFT MADE_TO_ORDER product, UNKNOWN license, one variant, 4 images, 0 movements, audit by system import', { skip: !hasDb }, async () => {
  const store = new MemoryStore();
  const tag = randomUUID().slice(0, 8);
  const result = await run(store, model(tag));
  assert.equal(result.action, 'CREATE');
  assert.ok(result.productId && result.itemId);
  const product = (await getPool().query(
    `select p.status, p.product_type, p.license_type, p.base_price, p.pricing_breakdown, p.pricing_config_id, p.description, c.slug as category
     from products p left join categories c on c.id = p.category_id where p.id = $1`, [result.productId])).rows[0];
  assert.equal(product.status, 'DRAFT');
  assert.equal(product.product_type, 'MADE_TO_ORDER');
  assert.equal(product.license_type, 'UNKNOWN');
  assert.equal(product.base_price, null, 'unpriced → null price, never a guess');
  assert.equal(product.pricing_breakdown, null);
  assert.equal(product.category, 'chua-phan-loai', 'unknown mapped category falls back to "Chưa phân loại"');
  assert.match(product.description, /20 × 10 × 5 mm/);
  assert.deepEqual(await counts(result.productId), { variants: 1, images: 4, movements: 0 });
  assert.equal(store.objects.size, 4);
  assert.ok([...store.objects.keys()].every((path) => path.startsWith(`${result.productId}/`) && path.endsWith('.webp')), 'only rendered .webp images are uploaded (FR-012)');
  const item = (await getPool().query('select review_status, needs_price_review, license_reviewed, warnings, render_status from product_import_items where id = $1', [result.itemId])).rows[0];
  assert.deepEqual(item, { review_status: 'PENDING', needs_price_review: true, license_reviewed: false, warnings: ['UNPRICED'], render_status: 'RENDERED' });
  const audit = await getPool().query(`select actor_id, after_data from audit_logs where action = 'STL_IMPORT_ITEM_CREATED' and entity_id = $1`, [result.itemId]);
  assert.equal(audit.rows[0].actor_id, null);
  assert.equal(audit.rows[0].after_data.actor, 'system-import');
});

test('re-running the same source creates nothing (SC-005) and duplicate names get a -2 slug', { skip: !hasDb }, async () => {
  const store = new MemoryStore();
  const tag = randomUUID().slice(0, 8);
  const first = await run(store, model(tag));
  const again = await run(store, model(tag));
  assert.equal(again.action, 'SKIP');
  assert.equal(store.uploads.length, 4, 'a skipped model is not even rendered/uploaded');
  const twin = await run(store, model(`${tag}-twin`, { name: `Mẫu ghi ${tag}` }));
  assert.equal(twin.action, 'CREATE');
  assert.equal(twin.slug, `${first.slug}-2`);
  assert.notEqual(twin.sku, first.sku);
});

test('a failing DB write removes the images it just uploaded (SC-006)', { skip: !hasDb }, async () => {
  const store = new MemoryStore();
  const tag = randomUUID().slice(0, 8);
  // A name the products CHECK refuses (blank after trim) makes the insert fail after the uploads.
  await assert.rejects(run(store, model(tag, { name: '   ' })));
  assert.equal(store.uploads.length, 4);
  assert.equal(store.objects.size, 0);
  assert.equal(await findImportItem(getPool(), sourceKey(`WriteTest/${tag}`)), null);
});

test('a failing upload removes the earlier uploads of the same model', { skip: !hasDb }, async () => {
  const store = new MemoryStore();
  store.failAfter = 2;
  await assert.rejects(run(store, model(randomUUID().slice(0, 8))), /simulated upload failure/);
  assert.equal(store.objects.size, 0);
});

test('an unreadable mesh is recorded as an ERROR item without a product; --retry-errors picks it up again', { skip: !hasDb }, async () => {
  const store = new MemoryStore();
  const tag = randomUUID().slice(0, 8);
  const broken = model(tag, { analysis: { ok: false, error: 'MESH_EMPTY: empty' }, images: [] });
  const result = await run(store, broken);
  assert.equal(result.action, 'ERROR');
  const item = (await getPool().query('select product_id, render_status, process_error from product_import_items where id = $1', [result.itemId])).rows[0];
  assert.deepEqual(item, { product_id: null, render_status: 'ERROR', process_error: 'MESH_EMPTY: empty' });
  assert.equal(store.uploads.length, 0);
  const fixed = await run(store, model(tag), { retryErrors: true });
  assert.equal(fixed.action, 'CREATE', 'an item without product is (re)created');
  assert.equal(fixed.itemId, result.itemId);
});

test('process_error is cut to 2000 characters', { skip: !hasDb }, async () => {
  const result = await run(new MemoryStore(), model(randomUUID().slice(0, 8), { analysis: { ok: false, error: 'x'.repeat(5_000) }, images: [] }));
  const row = (await getPool().query('select length(process_error) as n from product_import_items where id = $1', [result.itemId])).rows[0];
  assert.equal(row.n, 2000);
});

test('bucket usage sums storage.objects metadata sizes', { skip: !hasDb }, async () => {
  const db = getPool();
  await db.query(`insert into storage.objects (bucket_id, name, metadata) values ('stl-test-bucket', 'a', '{"size": 1000}'), ('stl-test-bucket', 'b', '{"size": 234}'), ('stl-test-bucket', 'c', null)`);
  assert.equal(await getBucketUsageBytes('stl-test-bucket'), 1234);
  assert.equal(await getBucketUsageBytes('stl-no-such-bucket'), 0);
});

test('US4: a changed source re-renders a DRAFT but keeps every admin edit (FR-010)', { skip: !hasDb }, async () => {
  const store = new MemoryStore();
  const tag = randomUUID().slice(0, 8);
  const created = await run(store, model(tag));
  assert.ok(created.productId);
  const db = getPool();
  await db.query(`update products set name = 'Tên admin sửa', base_price = 77000, license_type = 'CC0', description = 'Mô tả admin' where id = $1`, [created.productId]);
  const firstImages = [...store.objects.keys()];
  const bigger = analyzeModel([{ relPath: 'a.stl', bytes: binaryStl(boxTriangles([0, 0, 0], [40, 10, 5])) }]);
  const result = await run(store, model(tag, { analysis: bigger, files: [{ relPath: `WriteTest/${tag}/a.stl`, bytes: 999, mtimeMs: 2_000 }] }));
  assert.equal(result.action, 'RERENDER');
  const product = (await db.query('select name, base_price, license_type, description, status from products where id = $1', [created.productId])).rows[0];
  assert.deepEqual(product, { name: 'Tên admin sửa', base_price: '77000', license_type: 'CC0', description: 'Mô tả admin', status: 'DRAFT' });
  const item = (await db.query('select bbox_mm, needs_price_review, source_bytes from product_import_items where id = $1', [created.itemId])).rows[0];
  assert.deepEqual(item.bbox_mm, { x: 40, y: 10, z: 5 });
  assert.equal(item.needs_price_review, true);
  assert.equal(Number(item.source_bytes), 999);
  assert.ok(firstImages.every((path) => !store.objects.has(path)), 'old images removed after commit');
  assert.equal((await counts(created.productId)).images, 4);
});

test('US4: a changed source of a PUBLISHED product changes nothing public, only flags it (FR-011)', { skip: !hasDb }, async () => {
  const store = new MemoryStore();
  const tag = randomUUID().slice(0, 8);
  const created = await run(store, model(tag));
  assert.ok(created.productId);
  const db = getPool();
  await db.query(`update product_variants set price = 50000 where product_id = $1`, [created.productId]);
  await db.query(`update products set base_price = 50000, category_id = (select id from categories where slug <> 'chua-phan-loai' order by slug limit 1) where id = $1`, [created.productId]);
  await db.query(`update product_import_items set license_reviewed = true, license_reviewed_at = now(), review_status = 'APPROVED', reviewed_at = now() where id = $1`, [created.itemId]);
  await db.query(`update products set status = 'ACTIVE' where id = $1`, [created.productId]);
  const imagesBefore = (await db.query('select storage_path from product_images where product_id = $1 order by sort_order', [created.productId])).rows;
  const uploadsBefore = store.uploads.length;
  const result = await run(store, model(tag, { files: [{ relPath: `WriteTest/${tag}/a.stl`, bytes: 1234, mtimeMs: 3_000 }] }));
  assert.equal(result.action, 'SOURCE_CHANGED');
  assert.equal(store.uploads.length, uploadsBefore, 'no image is rendered or uploaded for a published product');
  assert.deepEqual((await db.query('select storage_path from product_images where product_id = $1 order by sort_order', [created.productId])).rows, imagesBefore);
  const product = (await db.query('select base_price, status from products where id = $1', [created.productId])).rows[0];
  assert.deepEqual(product, { base_price: '50000', status: 'ACTIVE' });
  const item = (await db.query('select source_changed_at, review_status from product_import_items where id = $1', [created.itemId])).rows[0];
  assert.ok(item.source_changed_at instanceof Date);
  assert.equal(item.review_status, 'APPROVED');
  assert.equal((await run(store, model(tag, { files: [{ relPath: `WriteTest/${tag}/a.stl`, bytes: 1234, mtimeMs: 3_000 }] }))).action, 'SKIP', 'flagged once, not on every run');
});
