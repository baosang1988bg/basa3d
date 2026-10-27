// Phase 52 P2/P3 — "Đăng sản phẩm mới" + product image upload (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md).
// Pure tests always run; DB-backed tests need the disposable local PostgreSQL (TEST_DATABASE_URL).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { Client } from 'pg';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { buildSku, skuCodeForCategory, slugify } from '../src/lib/catalog/naming.js';
import { buildSku as legacyBuildSku, slugify as legacySlugify } from '../src/lib/stl-import/naming.js';
import { fitWithin } from '../src/lib/uploads/image-fit.js';
import { productImageRegisterSchema, productImageUploadRequestSchema, productOnboardingInputSchema, type ProductOnboardingInput } from '../src/domain/schemas.js';
import {
  OPENING_STOCK_NOTE,
  createProductImageUploadTargets,
  createProductWithVariants,
  generateVariantSku,
  getPublishReadiness,
  listCatalogProducts,
  publishProductIfReady,
  registerProductImages,
  setProductCoverImage,
} from '../src/services/product-onboarding.service.js';
import { findOrphanProductImagePaths } from '../src/services/orphan-upload-cleanup.service.js';
import { getStockLevel } from '../src/services/inventory.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const WAREHOUSE_ID = '00000000-0000-4000-8000-000000000010'; // seeded (supabase/seed.sql)

async function expectDomainError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof DomainError && error.code === code);
}

// ---------------------------------------------------------------------------------------------
// Pure
// ---------------------------------------------------------------------------------------------

test('catalog naming: moved helpers behave the same through the old import path', () => {
  assert.equal(slugify('Móc khoá Mèo Đen'), 'moc-khoa-meo-den');
  assert.equal(legacySlugify, slugify);
  assert.equal(legacyBuildSku, buildSku);
  assert.equal(buildSku('KEY', 'moc-khoa-meo-den-pla-black', () => false), 'KEY-MOC-KHOA-MEO-DEN-PLA-BLACK');
  assert.equal(skuCodeForCategory('keychain'), 'KEY');
  assert.equal(skuCodeForCategory('den-ngu'), 'DEN');
  assert.equal(skuCodeForCategory(null), 'BSA');
});

test('fitWithin keeps aspect ratio, never upscales', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(3000, 4000, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
});

function onboardingInput(categoryId: string, patch: Record<string, unknown> = {}): ProductOnboardingInput {
  return productOnboardingInputSchema.parse({
    requestId: randomUUID(), name: 'Móc khoá Phase 52', categoryId, productType: 'MADE_TO_ORDER', basePrice: 89000,
    licenseType: 'OWN_DESIGN', variants: [{ name: 'Mặc định' }], ...patch,
  });
}

test('onboarding schema: licence explicit, source link for licensed models, no stock for made-to-order, unique variant names', () => {
  const base = { requestId: randomUUID(), name: 'X', categoryId: randomUUID(), productType: 'MADE_TO_ORDER', basePrice: 1000, variants: [{ name: 'A' }] };
  assert.equal(productOnboardingInputSchema.safeParse(base).success, false, 'licenseType has no silent default');
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'OWN_DESIGN' }).success, true);
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'COMMERCIAL_LICENSE' }).success, false);
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'COMMERCIAL_LICENSE', licenseSourceUrl: 'https://makerworld.com/x' }).success, true);
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'UNKNOWN' }).success, true);
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'OWN_DESIGN', variants: [{ name: 'A', openingStock: 3 }] }).success, false);
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'OWN_DESIGN', productType: 'READY_STOCK', variants: [{ name: 'A', openingStock: 3 }] }).success, true);
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'OWN_DESIGN', variants: [{ name: 'Đen' }, { name: 'đen ' }] }).success, false);
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'OWN_DESIGN', basePrice: 0 }).success, false);
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'OWN_DESIGN', basePrice: 1000.5 }).success, false, 'VND integer');
  assert.equal(productOnboardingInputSchema.safeParse({ ...base, licenseType: 'OWN_DESIGN', slug: 'x' }).success, false, 'slug is not accepted from the client');
  assert.equal(productImageUploadRequestSchema.safeParse({ productId: randomUUID(), files: [{ contentType: 'image/gif', sizeBytes: 10 }] }).success, false);
  assert.equal(productImageUploadRequestSchema.safeParse({ productId: randomUUID(), files: [{ contentType: 'image/webp', sizeBytes: 6 * 1024 * 1024 }] }).success, false);
  assert.equal(productImageRegisterSchema.safeParse({ productId: randomUUID(), storagePaths: [] }).success, false);
});

// ---------------------------------------------------------------------------------------------
// DB-backed
// ---------------------------------------------------------------------------------------------

async function withClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}

async function seedCategory(client: Client, slug = `phase52-${randomUUID().slice(0, 8)}`): Promise<string> {
  const result = await client.query<{ id: string }>(`insert into categories (name, slug) values ($1, $1) returning id`, [slug]);
  return result.rows[0].id;
}

async function keychainCategory(client: Client): Promise<string> {
  const existing = await client.query<{ id: string }>(`select id from categories where slug = 'keychain'`);
  return existing.rows[0]?.id ?? seedCategory(client, 'keychain');
}

async function fakeUpload(client: Client, path: string, metadata: Record<string, unknown> = { size: 120_000, mimetype: 'image/webp' }, ageHours = 0) {
  await client.query(`insert into storage.objects (bucket_id, name, metadata, created_at) values ('product-images', $1, $2, now() - ($3::int * interval '1 hour'))`, [path, metadata, ageHours]);
}

test('DB: made-to-order without colours → DRAFT product, one default variant, generated slug/SKU, no stock', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await keychainCategory(client);
    const name = `Móc khoá Mèo ${randomUUID().slice(0, 6)}`;
    const result = await createProductWithVariants(onboardingInput(categoryId, { name }), ACTOR_ID);
    assert.equal(result.slug, slugify(name));
    assert.equal(result.variants.length, 1);
    assert.equal(result.variants[0].sku, buildSku('KEY', result.slug, () => false));
    const product = await client.query('select status, product_type, license_type, base_price from products where id = $1', [result.productId]);
    assert.deepEqual({ ...product.rows[0], base_price: Number(product.rows[0].base_price) }, { status: 'DRAFT', product_type: 'MADE_TO_ORDER', license_type: 'OWN_DESIGN', base_price: 89000 });
    const variant = await client.query('select price from product_variants where id = $1', [result.variants[0].id]);
    assert.equal(Number(variant.rows[0].price), 89000);
    assert.equal((await client.query('select 1 from inventory_movements where product_variant_id = $1', [result.variants[0].id])).rowCount, 0);
  });
});

test('DB: ready-stock with colours → one variant per colour, own price override, opening stock as audited ADJUSTMENT_IN', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await seedCategory(client);
    const result = await createProductWithVariants(onboardingInput(categoryId, {
      name: `Kệ điện thoại ${randomUUID().slice(0, 6)}`, productType: 'READY_STOCK', warehouseId: WAREHOUSE_ID,
      variants: [
        { name: 'PLA Black', color: 'Black', material: 'PLA', price: null, openingStock: 5 },
        { name: 'PLA Silk Đồng', color: 'Silk Đồng', material: 'PLA', price: 99000, openingStock: 0 },
      ],
    }), ACTOR_ID);
    assert.equal(result.variants.length, 2);
    assert.notEqual(result.variants[0].sku, result.variants[1].sku);
    for (const variant of result.variants) assert.match(variant.sku, /^[A-Z0-9]+(-[A-Z0-9]+)*$/);
    const rows = await client.query<{ name: string; price: string; attributes: Record<string, string> }>('select name, price, attributes from product_variants where product_id = $1 order by name', [result.productId]);
    assert.deepEqual(rows.rows.map((row) => [row.name, Number(row.price), row.attributes.color]), [['PLA Black', 89000, 'Black'], ['PLA Silk Đồng', 99000, 'Silk Đồng']]);
    const black = result.variants.find((v) => v.name === 'PLA Black')!;
    const movement = await client.query('select movement_type, quantity, note, created_by from inventory_movements where product_variant_id = $1', [black.id]);
    assert.deepEqual(movement.rows, [{ movement_type: 'ADJUSTMENT_IN', quantity: 5, note: OPENING_STOCK_NOTE, created_by: ACTOR_ID }]);
    assert.equal((await getStockLevel(black.id)).onHand, 5);
  });
});

test('DB: same name twice gets a free slug; the same requestId replays instead of creating twice', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await seedCategory(client);
    const name = `Đèn ngủ ${randomUUID().slice(0, 6)}`;
    const first = await createProductWithVariants(onboardingInput(categoryId, { name }), ACTOR_ID);
    const second = await createProductWithVariants(onboardingInput(categoryId, { name }), ACTOR_ID);
    assert.equal(second.slug, `${first.slug}-2`);

    const input = onboardingInput(categoryId, { name: `${name} X` });
    const results = await Promise.all([createProductWithVariants(input, ACTOR_ID), createProductWithVariants(input, ACTOR_ID)]);
    assert.equal(results[0].productId, results[1].productId);
    assert.deepEqual(results.map((r) => r.replayed).sort(), [false, true]);
    assert.equal((await client.query('select 1 from products where name = $1', [`${name} X`])).rowCount, 1);
    await expectDomainError(createProductWithVariants({ ...input, name: 'Khác hẳn' }, ACTOR_ID), 'IDEMPOTENCY_CONFLICT');
    // Any other change (price, licence…) under the used key is refused too — never "saved" silently.
    await expectDomainError(createProductWithVariants({ ...input, basePrice: input.basePrice + 1000 }, ACTOR_ID), 'IDEMPOTENCY_CONFLICT');
    await expectDomainError(createProductWithVariants({ ...input, licenseType: 'UNKNOWN' }, ACTOR_ID), 'IDEMPOTENCY_CONFLICT');
  });
});

test('DB: unknown category / warehouse are refused and nothing is written', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const name = `Không tồn tại ${randomUUID().slice(0, 6)}`;
    await expectDomainError(createProductWithVariants(onboardingInput(randomUUID(), { name }), ACTOR_ID), 'CATEGORY_NOT_FOUND');
    const categoryId = await seedCategory(client);
    await expectDomainError(createProductWithVariants(onboardingInput(categoryId, {
      name, productType: 'READY_STOCK', warehouseId: randomUUID(), variants: [{ name: 'A', openingStock: 1 }],
    }), ACTOR_ID), 'WAREHOUSE_NOT_FOUND');
    assert.equal((await client.query('select 1 from products where name = $1', [name])).rowCount, 0);
  });
});

test('DB: images — signed targets under onboarding/<productId>/, registered only if really uploaded, cover first, idempotent', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await seedCategory(client);
    const { productId } = await createProductWithVariants(onboardingInput(categoryId, { name: `Ảnh ${randomUUID().slice(0, 6)}` }), ACTOR_ID);
    const signed: string[] = [];
    const targets = await createProductImageUploadTargets(
      { productId, files: [{ contentType: 'image/webp', sizeBytes: 1000 }, { contentType: 'image/jpeg', sizeBytes: 2000 }, { contentType: 'image/png', sizeBytes: 3000 }] },
      async (path) => { signed.push(path); return { token: 't', signedUrl: `https://example.test/${path}` }; });
    assert.equal(targets.length, 3);
    assert.deepEqual(signed, targets.map((t) => t.path));
    for (const target of targets) assert.match(target.path, new RegExp(`^onboarding/${productId}/[0-9a-f-]{36}\\.(webp|jpg|png)$`));
    await expectDomainError(createProductImageUploadTargets({ productId: randomUUID(), files: [{ contentType: 'image/webp', sizeBytes: 1 }] }, async () => ({ token: '', signedUrl: '' })), 'PRODUCT_NOT_FOUND');

    const [a, b, c] = targets.map((t) => t.path);
    // Not uploaded yet → refused.
    await expectDomainError(registerProductImages({ productId, storagePaths: [a] }, ACTOR_ID), 'IMAGE_NOT_UPLOADED');
    await fakeUpload(client, a);
    await fakeUpload(client, b, { size: 2000, mimetype: 'image/jpeg' });
    await fakeUpload(client, c, { size: 6 * 1024 * 1024, mimetype: 'image/png' });
    await expectDomainError(registerProductImages({ productId, storagePaths: [a, b, c] }, ACTOR_ID), 'FILE_TOO_LARGE');
    // Someone else's path / a legacy path are refused.
    await expectDomainError(registerProductImages({ productId, storagePaths: [`onboarding/${randomUUID()}/${randomUUID()}.webp`] }, ACTOR_ID), 'INVALID_IMAGE_PATH');
    await expectDomainError(registerProductImages({ productId, storagePaths: [`${productId}/${randomUUID()}.webp`] }, ACTOR_ID), 'INVALID_IMAGE_PATH');

    const registered = await registerProductImages({ productId, storagePaths: [a, b], coverPath: b }, ACTOR_ID);
    assert.deepEqual(registered, { added: 2, total: 2, coverPath: b });
    const retry = await registerProductImages({ productId, storagePaths: [a, b], coverPath: b }, ACTOR_ID);
    assert.equal(retry.added, 0, 'a retry does not duplicate rows');
    const order = await client.query<{ id: string; storage_path: string }>('select id, storage_path from product_images where product_id = $1 order by sort_order', [productId]);
    assert.deepEqual(order.rows.map((row) => row.storage_path), [b, a]);

    await setProductCoverImage(productId, order.rows[1].id);
    const reordered = await client.query<{ storage_path: string }>('select storage_path from product_images where product_id = $1 order by sort_order', [productId]);
    assert.deepEqual(reordered.rows.map((row) => row.storage_path), [a, b]);
  });
});

test('DB: publishing needs a known licence, an image, a price and a real category', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await seedCategory(client);
    const unknown = await createProductWithVariants(onboardingInput(categoryId, { name: `Chưa rõ ${randomUUID().slice(0, 6)}`, licenseType: 'UNKNOWN' }), ACTOR_ID);
    assert.deepEqual(await getPublishReadiness(unknown.productId), ['LICENSE_UNKNOWN', 'NO_IMAGE']);
    const blocked = await publishProductIfReady(unknown.productId, ACTOR_ID);
    assert.equal(blocked.published, false);
    assert.equal((await client.query('select status from products where id = $1', [unknown.productId])).rows[0].status, 'DRAFT');

    const ok = await createProductWithVariants(onboardingInput(categoryId, { name: `Đăng được ${randomUUID().slice(0, 6)}` }), ACTOR_ID);
    const [target] = await createProductImageUploadTargets({ productId: ok.productId, files: [{ contentType: 'image/webp', sizeBytes: 10 }] }, async () => ({ token: 't', signedUrl: 'u' }));
    await fakeUpload(client, target.path);
    await registerProductImages({ productId: ok.productId, storagePaths: [target.path], coverPath: target.path }, ACTOR_ID);
    assert.deepEqual(await publishProductIfReady(ok.productId, ACTOR_ID), { published: true, reasons: [] });
    assert.equal((await client.query('select status from products where id = $1', [ok.productId])).rows[0].status, 'ACTIVE');
  });
});

test('DB: orphan sweep only picks old, unregistered onboarding/ images', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const productId = randomUUID();
    const orphan = `onboarding/${productId}/${randomUUID()}.webp`;
    const fresh = `onboarding/${productId}/${randomUUID()}.webp`;
    const legacy = `${productId}/${randomUUID()}.webp`;
    await fakeUpload(client, orphan, undefined, 30);
    await fakeUpload(client, fresh, undefined, 1);
    await fakeUpload(client, legacy, undefined, 30);
    const found = await findOrphanProductImagePaths(10_000);
    assert.ok(found.includes(orphan));
    assert.ok(!found.includes(fresh), 'younger than 24h');
    assert.ok(!found.includes(legacy), 'outside the onboarding/ prefix');

    // A registered image is never an orphan.
    const categoryId = await seedCategory(client);
    const created = await createProductWithVariants(onboardingInput(categoryId, { name: `Orphan ${randomUUID().slice(0, 6)}` }), ACTOR_ID);
    const kept = `onboarding/${created.productId}/${randomUUID()}.webp`;
    await fakeUpload(client, kept, undefined, 30);
    await registerProductImages({ productId: created.productId, storagePaths: [kept] }, ACTOR_ID);
    assert.ok(!(await findOrphanProductImagePaths(10_000)).includes(kept));
  });
});

test('DB: a variant added later without a SKU gets a free generated one', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await keychainCategory(client);
    const created = await createProductWithVariants(onboardingInput(categoryId, { name: `Sku ${randomUUID().slice(0, 6)}`, variants: [{ name: 'PLA Đỏ', color: 'Đỏ' }] }), ACTOR_ID);
    const sku = await generateVariantSku(created.productId, 'PLA Đỏ');
    assert.notEqual(sku, created.variants[0].sku, 'existing SKU is taken → suffix');
    assert.match(sku, /^KEY-.*-2$/);
    await expectDomainError(generateVariantSku(randomUUID(), 'x'), 'PRODUCT_NOT_FOUND');
  });
});

test('DB: catalogue list shows what each draft lacks, counts per status, and filters by search/status', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const categoryId = await seedCategory(client);
    const tag = randomUUID().slice(0, 6);
    const draft = await createProductWithVariants(onboardingInput(categoryId, { name: `Catalog nháp ${tag}`, licenseType: 'UNKNOWN' }), ACTOR_ID);
    const live = await createProductWithVariants(onboardingInput(categoryId, { name: `Catalog bán ${tag}`, variants: [{ name: 'Đen', color: 'Đen', price: 90000 }, { name: 'Trắng', color: 'Trắng' }] }), ACTOR_ID);
    const [target] = await createProductImageUploadTargets({ productId: live.productId, files: [{ contentType: 'image/webp', sizeBytes: 10 }] }, async () => ({ token: 't', signedUrl: 'u' }));
    await fakeUpload(client, target.path);
    await registerProductImages({ productId: live.productId, storagePaths: [target.path], coverPath: target.path }, ACTOR_ID);
    await publishProductIfReady(live.productId, ACTOR_ID);

    const all = await listCatalogProducts({ search: tag });
    assert.equal(all.items.length, 2);
    assert.deepEqual(all.statusCounts, { ACTIVE: 1, DRAFT: 1, ARCHIVED: 0 });
    assert.equal(all.items[0].id, draft.productId, 'drafts first');
    assert.deepEqual(all.items[0].missing, ['LICENSE_UNKNOWN', 'NO_IMAGE']);
    const liveRow = all.items.find((item) => item.id === live.productId)!;
    assert.deepEqual([liveRow.minPrice, liveRow.maxPrice, liveRow.variantCount], [89000, 90000, 2]);
    assert.equal(liveRow.coverStoragePath, target.path);
    const onlyActive = await listCatalogProducts({ search: tag, status: 'ACTIVE' });
    assert.deepEqual(onlyActive.items.map((item) => item.id), [live.productId]);
    assert.deepEqual(onlyActive.statusCounts, { ACTIVE: 1, DRAFT: 1, ARCHIVED: 0 }, 'tab counts ignore the status filter');
    assert.equal((await listCatalogProducts({ search: '%' })).items.every((item) => item.name.includes('%')), true, 'LIKE wildcards escaped');
  });
});
