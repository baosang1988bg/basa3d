// Phase 55 (D4, D5, D7) — duplicate product, bulk publish/archive, and the description-wipe fix
// (docs/exec-plans/active/phase-55-admin-staff-ux.md).
// Pure tests always run; DB-backed tests need the disposable local PostgreSQL (TEST_DATABASE_URL).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { Client } from 'pg';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { productOnboardingInputSchema, type ProductOnboardingInput } from '../src/domain/schemas.js';
import {
  DUPLICATE_NAME_SUFFIX,
  bulkArchiveProducts,
  bulkPublishDrafts,
  createProductWithVariants,
  duplicateProduct,
  duplicateProductName,
} from '../src/services/product-onboarding.service.js';
import { getStockLevel } from '../src/services/inventory.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const WAREHOUSE_ID = '00000000-0000-4000-8000-000000000010'; // seeded (supabase/seed.sql)

test('duplicateProductName appends the suffix and still fits varchar(200)', () => {
  assert.equal(duplicateProductName('Móc khoá mèo'), `Móc khoá mèo${DUPLICATE_NAME_SUFFIX}`);
  const long = duplicateProductName('x'.repeat(200));
  assert.equal(long.length, 200);
  assert.ok(long.endsWith(DUPLICATE_NAME_SUFFIX));
});

async function withClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}

async function seedCategory(client: Client): Promise<string> {
  const slug = `phase55-${randomUUID().slice(0, 8)}`;
  const result = await client.query<{ id: string }>('insert into categories (name, slug) values ($1, $1) returning id', [slug]);
  return result.rows[0].id;
}

function onboardingInput(categoryId: string, patch: Record<string, unknown> = {}): ProductOnboardingInput {
  return productOnboardingInputSchema.parse({
    requestId: randomUUID(), name: `Kệ Phase 55 ${randomUUID().slice(0, 6)}`, categoryId, productType: 'READY_STOCK', basePrice: 120000,
    licenseType: 'OWN_DESIGN', warehouseId: WAREHOUSE_ID, description: 'Mô tả dài của bản gốc',
    variants: [
      { name: 'PLA Black', color: 'Black', material: 'PLA', price: null, openingStock: 4 },
      { name: 'PLA White', color: 'White', material: 'PLA', price: 135000, openingStock: 0 },
    ],
    ...patch,
  });
}

async function addImage(client: Client, productId: string): Promise<void> {
  await client.query('insert into product_images (product_id, storage_path, sort_order) values ($1, $2, 0)', [productId, `phase55/${randomUUID()}.webp`]);
}

test('DB: duplicate → new DRAFT with copied fields and variants, but no images, no stock, licence reset', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await seedCategory(client);
    const source = await createProductWithVariants(onboardingInput(categoryId), ACTOR_ID);
    await addImage(client, source.productId);

    const copy = await duplicateProduct({ sourceProductId: source.productId, requestId: randomUUID() }, ACTOR_ID);
    assert.equal(copy.replayed, false);
    assert.notEqual(copy.productId, source.productId);
    assert.notEqual(copy.slug, source.slug);

    const rows = await client.query<{ id: string; name: string; status: string; license_type: string; category_id: string; description: string; base_price: string; product_type: string; is_featured: boolean }>(
      'select id, name, status, license_type, category_id, description, base_price, product_type, is_featured from products where id = any($1::uuid[])', [[source.productId, copy.productId]]);
    const original = rows.rows.find((row) => row.id === source.productId)!;
    const duplicate = rows.rows.find((row) => row.id === copy.productId)!;
    assert.equal(duplicate.name, duplicateProductName(original.name));
    assert.equal(duplicate.status, 'DRAFT');
    assert.equal(duplicate.license_type, 'UNKNOWN', 'licence must be confirmed again for the copy');
    assert.equal(original.license_type, 'OWN_DESIGN', 'the original is untouched');
    assert.deepEqual([duplicate.category_id, duplicate.description, Number(duplicate.base_price), duplicate.product_type, duplicate.is_featured],
      [categoryId, 'Mô tả dài của bản gốc', 120000, 'READY_STOCK', false]);

    const variants = await client.query<{ id: string; sku: string; name: string; price: string; attributes: Record<string, string> }>(
      'select id, sku, name, price, attributes from product_variants where product_id = $1 order by name', [copy.productId]);
    assert.deepEqual(variants.rows.map((row) => [row.name, Number(row.price), row.attributes.color]), [['PLA Black', 120000, 'Black'], ['PLA White', 135000, 'White']]);
    const sourceSkus = new Set(source.variants.map((variant) => variant.sku));
    for (const variant of variants.rows) {
      assert.match(variant.sku, /^[A-Z0-9]+(-[A-Z0-9]+)*$/);
      assert.ok(!sourceSkus.has(variant.sku), 'copied variants get their own SKUs');
      assert.equal((await getStockLevel(variant.id)).onHand, 0, 'stock is never copied');
    }
    assert.equal((await client.query('select 1 from product_images where product_id = $1', [copy.productId])).rowCount, 0, 'images are never copied');
    assert.equal((await client.query('select 1 from product_images where product_id = $1', [source.productId])).rowCount, 1);
    const audit = await client.query<{ after_data: { duplicateOf?: string; source?: string } }>(
      `select after_data from audit_logs where entity_type = 'product' and entity_id = $1 and action = 'PRODUCT_CREATED'`, [copy.productId]);
    assert.deepEqual([audit.rows[0]?.after_data.duplicateOf, audit.rows[0]?.after_data.source], [source.productId, 'duplicate']);
  });
});

test('DB: duplicate is idempotent per requestId; a reused key for another product is refused; unknown source → 404', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await seedCategory(client);
    const source = await createProductWithVariants(onboardingInput(categoryId), ACTOR_ID);
    const other = await createProductWithVariants(onboardingInput(categoryId), ACTOR_ID);
    const requestId = randomUUID();
    const first = await duplicateProduct({ sourceProductId: source.productId, requestId }, ACTOR_ID);
    const again = await duplicateProduct({ sourceProductId: source.productId, requestId }, ACTOR_ID);
    assert.equal(again.replayed, true);
    assert.equal(again.productId, first.productId);
    const copies = await client.query('select 1 from products where name = $1', [duplicateProductName((await client.query('select name from products where id = $1', [source.productId])).rows[0].name)]);
    assert.equal(copies.rowCount, 1, 'double click creates one copy');

    await assert.rejects(duplicateProduct({ sourceProductId: other.productId, requestId }, ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'IDEMPOTENCY_CONFLICT');
    await assert.rejects(duplicateProduct({ sourceProductId: randomUUID(), requestId: randomUUID() }, ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'PRODUCT_NOT_FOUND');

    // Copying twice (two separate clicks, two keys) gives two distinct slugs.
    const second = await duplicateProduct({ sourceProductId: source.productId, requestId: randomUUID() }, ACTOR_ID);
    assert.notEqual(second.slug, first.slug);
  });
});

test('DB: bulk publish only publishes ready drafts; bulk archive skips already-archived', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await seedCategory(client);
    const ready = await createProductWithVariants(onboardingInput(categoryId), ACTOR_ID);
    await addImage(client, ready.productId);
    const noImage = await createProductWithVariants(onboardingInput(categoryId), ACTOR_ID);
    const copy = await duplicateProduct({ sourceProductId: ready.productId, requestId: randomUUID() }, ACTOR_ID); // licence UNKNOWN, no image
    const missingId = randomUUID();

    const published = await bulkPublishDrafts([ready.productId, noImage.productId, copy.productId, missingId], ACTOR_ID);
    assert.deepEqual(published, { done: 1, skipped: 3 });
    const statuses = async () => Object.fromEntries((await client.query<{ id: string; status: string }>(
      'select id, status from products where id = any($1::uuid[])', [[ready.productId, noImage.productId, copy.productId]])).rows.map((row) => [row.id, row.status]));
    assert.deepEqual(await statuses(), { [ready.productId]: 'ACTIVE', [noImage.productId]: 'DRAFT', [copy.productId]: 'DRAFT' });

    // Publishing again skips the product that is already live (no duplicate audit noise).
    assert.deepEqual(await bulkPublishDrafts([ready.productId], ACTOR_ID), { done: 0, skipped: 1 });

    assert.deepEqual(await bulkArchiveProducts([ready.productId, noImage.productId, missingId], ACTOR_ID), { done: 2, skipped: 1 });
    assert.deepEqual(await bulkArchiveProducts([ready.productId], ACTOR_ID), { done: 0, skipped: 1 });
    assert.deepEqual(await statuses(), { [ready.productId]: 'ARCHIVED', [noImage.productId]: 'ARCHIVED', [copy.productId]: 'DRAFT' });
  });
});
