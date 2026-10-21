// Feature 003 — migration 20261022000000_stl_bulk_import: product_import_items constraints and the
// publish-gate triggers (FR-021, SC-003). DB-backed: needs the disposable local PostgreSQL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { cleanupImported, seedImportedProduct, type ImportedFixture } from './helpers/stl-import-fixtures';
import { getPool } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { PublishBlockedError } from '../src/lib/stl-import/publish-gate.js';
import { updateProduct } from '../src/services/product.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const fixtures: ImportedFixture[] = [];
after(async () => {
  if (!hasDb) return;
  await cleanupImported(getPool(), fixtures);
  await getPool().end();
});

async function seed(options: Parameters<typeof seedImportedProduct>[1] = {}) {
  const fixture = await seedImportedProduct(getPool(), options);
  fixtures.push(fixture);
  return fixture;
}

async function activate(productId: string) {
  return getPool().query(`update products set status = 'ACTIVE' where id = $1`, [productId]);
}

async function expectBlocked(promise: Promise<unknown>, reasons: string[]) {
  await assert.rejects(promise, (error: { code?: string; message?: string }) => {
    assert.equal(error.code, 'P0001');
    assert.equal(error.message, `IMPORT_PUBLISH_BLOCKED:${reasons.join(',')}`);
    return true;
  });
}

test('migration is additive and documents UNKNOWN on license_type (no CHECK, Phase 29 kept)', async () => {
  const sql = await readFile('supabase/migrations/20261022000000_stl_bulk_import.sql', 'utf8');
  assert.match(sql, /create table if not exists public\.product_import_items/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /UNKNOWN/);
  assert.doesNotMatch(sql, /drop table|alter table public\.products (add|drop)|delete from/i);
});

test('constraints: source_key format, review pair, process_error length, jsonb shapes', { skip: !hasDb }, async () => {
  const fixture = await seed();
  const db = getPool();
  await assert.rejects(db.query(`update product_import_items set source_key = 'NOT-HEX' where id = $1`, [fixture.itemId]), /check constraint/);
  await assert.rejects(db.query(`update product_import_items set review_status = 'REJECTED' where id = $1`, [fixture.itemId]), /product_import_items_review_pair/);
  await assert.rejects(db.query(`update product_import_items set process_error = repeat('x', 2001) where id = $1`, [fixture.itemId]), /check constraint/);
  await assert.rejects(db.query(`update product_import_items set warnings = '{}' where id = $1`, [fixture.itemId]), /check constraint/);
  await assert.rejects(db.query(`update product_import_items set group_mode = 'ZIP' where id = $1`, [fixture.itemId]), /check constraint/);
});

test('updated_at moves on every update (optimistic lock depends on it)', { skip: !hasDb }, async () => {
  const fixture = await seed();
  const db = getPool();
  const before = (await db.query(`select updated_at::text as t from product_import_items where id = $1`, [fixture.itemId])).rows[0].t;
  await db.query(`update product_import_items set needs_rerender = true where id = $1`, [fixture.itemId]);
  const afterUpdate = (await db.query(`select updated_at::text as t from product_import_items where id = $1`, [fixture.itemId])).rows[0].t;
  assert.notEqual(afterUpdate, before);
});

test('"Chưa phân loại" exists and is hidden from the storefront category list', { skip: !hasDb }, async () => {
  const row = (await getPool().query(`select is_active from categories where slug = 'chua-phan-loai'`)).rows[0];
  assert.equal(row?.is_active, false);
});

test('gate: an approved, reviewed, imaged, priced, categorised import goes ACTIVE', { skip: !hasDb }, async () => {
  const fixture = await seed({ reviewStatus: 'APPROVED' });
  await activate(fixture.productId);
  assert.equal((await getPool().query('select status from products where id = $1', [fixture.productId])).rows[0].status, 'ACTIVE');
});

test('gate: each condition blocks on its own, with its reason', { skip: !hasDb }, async () => {
  await expectBlocked(activate((await seed()).productId), ['NOT_APPROVED']);
  await expectBlocked(activate((await seed({ reviewStatus: 'APPROVED', licenseReviewed: false })).productId), ['LICENSE_NOT_REVIEWED']);
  await expectBlocked(activate((await seed({ reviewStatus: 'APPROVED', withImage: false })).productId), ['NO_IMAGE']);
  await expectBlocked(activate((await seed({ reviewStatus: 'APPROVED', basePrice: 0 })).productId), ['NO_PRICE']);
  await expectBlocked(activate((await seed({ reviewStatus: 'APPROVED', basePrice: null })).productId), ['NO_PRICE']);
  await expectBlocked(activate((await seed({ reviewStatus: 'APPROVED', variantPrice: 0 })).productId), ['NO_PRICE']);
  await expectBlocked(activate((await seed({ reviewStatus: 'APPROVED', uncategorized: true })).productId), ['UNCATEGORIZED']);
});

test('gate: several failures are reported together', { skip: !hasDb }, async () => {
  const fixture = await seed({ licenseReviewed: false, withImage: false, basePrice: null, uncategorized: true });
  await expectBlocked(activate(fixture.productId), ['NOT_APPROVED', 'LICENSE_NOT_REVIEWED', 'NO_IMAGE', 'NO_PRICE', 'UNCATEGORIZED']);
});

test('gate: non-imported products and harmless ACTIVE → ACTIVE updates are untouched', { skip: !hasDb }, async () => {
  const db = getPool();
  const plain = (await db.query<{ id: string }>(`insert into products (name, slug, product_type, status) values ('stl plain', $1, 'READY_STOCK', 'DRAFT') returning id`, [`stl-plain-${Date.now()}`])).rows[0].id;
  try {
    await activate(plain);
    const fixture = await seed({ reviewStatus: 'APPROVED' });
    await activate(fixture.productId);
    await db.query(`update products set status = 'ACTIVE', name = 'renamed' where id = $1`, [fixture.productId]);
  } finally {
    await db.query('delete from products where id = $1', [plain]);
  }
});

test('gate while ACTIVE: editing price or category of a live import may not break the rules (product page, PATCH)', { skip: !hasDb }, async () => {
  const fixture = await seed({ reviewStatus: 'APPROVED' });
  await activate(fixture.productId);
  const db = getPool();
  const unc = (await db.query(`select id from categories where slug = 'chua-phan-loai'`)).rows[0].id;
  await expectBlocked(db.query('update products set category_id = $2 where id = $1', [fixture.productId, unc]), ['UNCATEGORIZED']);
  await expectBlocked(db.query('update products set base_price = null where id = $1', [fixture.productId]), ['NO_PRICE']);
  const inactive = (await db.query<{ id: string }>(`insert into categories (name, slug, is_active) values ($1, $1, false) returning id`, [`${fixture.tag}-off`])).rows[0].id;
  try {
    await expectBlocked(db.query('update products set category_id = $2 where id = $1', [fixture.productId, inactive]), ['UNCATEGORIZED']);
  } finally {
    await db.query('delete from categories where id = $1', [inactive]);
  }
  await assert.rejects(updateProduct(fixture.productId, { basePrice: null }, ACTOR_ID), (error: unknown) => error instanceof PublishBlockedError);
  await db.query('update products set base_price = 60000 where id = $1', [fixture.productId]);
  assert.equal((await db.query('select status from products where id = $1', [fixture.productId])).rows[0].status, 'ACTIVE');
});

test('license-review pair: ticked ⇔ timestamp', { skip: !hasDb }, async () => {
  const fixture = await seed({ licenseReviewed: false });
  await assert.rejects(getPool().query('update product_import_items set license_reviewed = true where id = $1', [fixture.itemId]), /product_import_items_license_pair/);
});

test('link gate: a pending item cannot be attached to an ACTIVE product, nor un-reviewed while it is ACTIVE', { skip: !hasDb }, async () => {
  const db = getPool();
  const approved = await seed({ reviewStatus: 'APPROVED' });
  await activate(approved.productId);
  await assert.rejects(db.query(`update product_import_items set license_reviewed = false where id = $1`, [approved.itemId]), /IMPORT_LINK_BLOCKED/);
  await assert.rejects(db.query(`update product_import_items set review_status = 'PENDING', reviewed_at = null where id = $1`, [approved.itemId]), /IMPORT_LINK_BLOCKED/);
  const pending = await seed();
  await assert.rejects(db.query(`update product_import_items set product_id = $1 where id = $2`, [approved.productId, pending.itemId]), /IMPORT_LINK_BLOCKED|unique/);
  const plain = (await db.query<{ id: string }>(`insert into products (name, slug, product_type, status) values ('stl active', $1, 'READY_STOCK', 'ACTIVE') returning id`, [`stl-active-${Date.now()}`])).rows[0].id;
  try {
    await assert.rejects(db.query(`update product_import_items set product_id = $1 where id = $2`, [plain, pending.itemId]), /IMPORT_LINK_BLOCKED/);
  } finally {
    await db.query('delete from products where id = $1', [plain]);
  }
});

test('every existing write path is gated: updateProduct (product page save, unarchive, PATCH /api/products/[id]) → 409 with reasons', { skip: !hasDb }, async () => {
  const fixture = await seed({ licenseReviewed: false });
  await assert.rejects(updateProduct(fixture.productId, { status: 'ACTIVE' }, ACTOR_ID), (error: unknown) => {
    assert.ok(error instanceof PublishBlockedError);
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, 409);
    assert.deepEqual(error.reasons, ['NOT_APPROVED', 'LICENSE_NOT_REVIEWED']);
    return true;
  });
  const archived = await seed({ status: 'ARCHIVED' });
  await assert.rejects(updateProduct(archived.productId, { status: 'ACTIVE' }, ACTOR_ID), (error: unknown) => error instanceof PublishBlockedError);
  const status = (await getPool().query('select status from products where id = $1', [fixture.productId])).rows[0].status;
  assert.equal(status, 'DRAFT');
});
