// Feature 003 — FR-026/FR-027, SC-004: an approved import shows up on the storefront and sitemap,
// and nothing from product_import_items (source path, folder, review state) reaches public data.
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { cleanupImported, createStaff, deleteStaff, seedImportedProduct, type ImportedFixture } from './helpers/stl-import-fixtures';
import { getPool } from '../src/lib/db.js';
import { approveImportItems } from '../src/services/stl-import.service.js';
import { getStorefrontProductBySlug, listAllActiveProductSlugs, listStorefrontProducts } from '../src/services/storefront-catalog.service.js';
import { listProducts } from '../src/services/product.service.js';

configureTestEnvironment();
// Public image URLs are plain string concatenation on this base (no Storage call is made).
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
const hasDb = Boolean(process.env.DATABASE_URL);
let fixture: ImportedFixture | undefined;
let ownerId = '';
let slug = '';

before(async () => {
  if (!hasDb) return;
  ownerId = await createStaff(getPool(), 'OWNER');
  fixture = await seedImportedProduct(getPool());
  const TS = `to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
  const stamp = (await getPool().query(`select ${TS} as t from product_import_items where id = $1`, [fixture.itemId])).rows[0].t;
  const productStamp = (await getPool().query(`select ${TS} as t from products where id = $1`, [fixture.productId])).rows[0].t;
  const result = await approveImportItems({ actorId: ownerId, role: 'OWNER' }, { items: [{ itemId: fixture.itemId, expectedItemUpdatedAt: stamp, expectedProductUpdatedAt: productStamp }] });
  assert.deepEqual(result.done, [fixture.itemId]);
  slug = (await getPool().query('select slug from products where id = $1', [fixture.productId])).rows[0].slug;
});
after(async () => {
  if (!hasDb) return;
  if (fixture) await cleanupImported(getPool(), [fixture]);
  await getPool().query('delete from audit_logs where actor_id = $1', [ownerId]).catch(() => undefined);
  await deleteStaff(getPool(), [ownerId]).catch(() => undefined);
  await getPool().end();
});

function assertNoSource(payload: unknown) {
  const text = JSON.stringify(payload);
  assert.ok(fixture);
  assert.ok(!text.includes('SECRET-SOURCE'), 'source_rel_path leaked');
  assert.ok(!text.includes(`Fixtures/${fixture.tag}`), 'source_dir leaked');
  for (const key of ['sourceRelPath', 'source_rel_path', 'sourceDir', 'reviewStatus', 'review_status', 'licenseReviewed', 'license_reviewed', 'needsPriceReview']) {
    assert.ok(!text.includes(key), `${key} leaked`);
  }
}

test('approved import is listed on the storefront, has a detail page and is in the sitemap slugs', { skip: !hasDb }, async () => {
  const detail = await getStorefrontProductBySlug(slug);
  assert.ok(detail, 'product detail is public');
  assert.equal(detail.images.length, 1);
  assertNoSource(detail);
  const slugs = await listAllActiveProductSlugs();
  assert.ok(JSON.stringify(slugs).includes(slug));
  assertNoSource(slugs);
});

test('storefront listing and the public GET /api/products payload expose no import data', { skip: !hasDb }, async () => {
  assert.ok(fixture);
  const listing = await listStorefrontProducts({ categoryId: fixture.categoryId });
  assert.ok(JSON.stringify(listing).includes(slug));
  assertNoSource(listing);
  // GET /api/products is public and calls listProducts({ status: 'ACTIVE' }).
  const api = await listProducts({ limit: 100, status: 'ACTIVE' });
  assertNoSource(api);
});

test('the API roles cannot read product_import_items (RLS on, no grant)', { skip: !hasDb }, async () => {
  const rls = await getPool().query(`select relrowsecurity from pg_class where oid = 'public.product_import_items'::regclass`);
  assert.equal(rls.rows[0].relrowsecurity, true);
  const roles = await getPool().query(`select rolname from pg_roles where rolname in ('anon', 'authenticated')`);
  for (const { rolname } of roles.rows) {
    const grant = await getPool().query(`select has_table_privilege($1, 'public.product_import_items', 'select') as ok`, [rolname]);
    assert.equal(grant.rows[0].ok, false, `${rolname} can read product_import_items`);
  }
});
