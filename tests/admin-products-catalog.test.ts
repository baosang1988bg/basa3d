import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before, mock } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { cleanupImported, createStaff, deleteStaff, seedImportedProduct, type ImportedFixture } from './helpers/stl-import-fixtures';
import { catalogBulkActionSchema, catalogQuickEditSchema, mergeCatalogProductsSchema, productUpdateInputSchema } from '../src/domain/schemas';
import { DomainError } from '../src/lib/domain-error';
import { getPool } from '../src/lib/db';
import type { StaffSession } from '../src/lib/auth/require-admin';
import { createProductWithVariants } from '../src/services/product-onboarding.service';
import { bulkCatalogAction, listCatalogProducts, quickUpdateCatalogProduct } from '../src/services/product-onboarding.service';
import { deleteProduct } from '../src/services/product.service';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
const ID = '00000000-0000-4000-8000-000000000001';

// ---------------------------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------------------------

test('productUpdateInputSchema accepts productType and leaves it omitted when absent', () => {
  const partial = productUpdateInputSchema.parse({ name: 'Test' });
  assert.equal('productType' in partial, false);
  const withType = productUpdateInputSchema.parse({ productType: 'READY_STOCK' });
  assert.equal(withType.productType, 'READY_STOCK');
});

test('catalogQuickEditSchema and catalogBulkActionSchema validate inputs and reject javascript: URLs', () => {
  const ok = catalogQuickEditSchema.parse({
    productId: ID,
    name: 'Móc khoá mới',
    basePrice: 35_000,
    licenseType: 'COMMERCIAL_LICENSE',
    licenseSourceUrl: 'https://makerworld.com/en/models/123',
    licenseReviewed: true,
    status: 'ACTIVE',
  });
  assert.equal(ok.syncSingleVariantPrice, true);
  assert.throws(() => catalogQuickEditSchema.parse({ productId: ID, licenseSourceUrl: 'javascript:alert(1)' }));

  const bulk = catalogBulkActionSchema.parse({
    action: 'APPLY_LICENSE',
    productIds: [ID],
    licenseType: 'OWN_DESIGN',
    licenseReviewed: true,
    publish: true,
  });
  assert.equal(bulk.action, 'APPLY_LICENSE');
  assert.throws(() => catalogBulkActionSchema.parse({ action: 'DELETE', productIds: [] }));

  const id2 = '00000000-0000-4000-8000-000000000002';
  const merged = mergeCatalogProductsSchema.parse({
    name: 'Clicker Động Vật Mini',
    categoryId: ID,
    licenseType: 'OWN_DESIGN',
    items: [
      { sourceProductId: ID, variantName: 'Mèo v8', price: 25_000 },
      { sourceProductId: id2, variantName: 'Ếch v9', price: 36_000 },
    ],
    comboVariant: { enabled: true, name: 'Combo 2 mẫu', price: 55_000 },
  });
  assert.equal(merged.items.length, 2);
  assert.throws(() => mergeCatalogProductsSchema.parse({
    name: 'Single', categoryId: ID, licenseType: 'OWN_DESIGN',
    items: [{ sourceProductId: ID, variantName: 'Only 1', price: 25_000 }],
  }));
});

// ---------------------------------------------------------------------------------------------
// Server actions role & error boundary (mocked auth/services)
// ---------------------------------------------------------------------------------------------

test('catalog actions enforce auth, OWNER-only delete, and clean DomainError handling', async () => {
  let role: 'OWNER' | 'STAFF' | null = 'STAFF';
  let serviceError: Error | undefined;
  const calls: string[] = [];

  mock.module('../src/lib/auth/require-admin.ts', {
    namedExports: {
      requireAdmin: async () => {
        if (!role) throw new DomainError('AUTH_REQUIRED', 'Bạn cần đăng nhập.', 401);
        return { actorId: 'actor-1', role };
      },
      requireOwner: async () => {
        if (!role) throw new DomainError('AUTH_REQUIRED', 'Bạn cần đăng nhập.', 401);
        if (role !== 'OWNER') throw new DomainError('FORBIDDEN', 'Chỉ OWNER mới có quyền.', 403);
        return { actorId: 'actor-1', role };
      },
    },
  });
  mock.module('next/cache', { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
  mock.module('next/navigation', { namedExports: { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } } });
  mock.module('../src/services/product.service.ts', {
    namedExports: {
      createCategory: async () => ({ id: ID }),
      createProduct: async () => ({ id: ID }),
      createVariant: async () => ({ id: ID }),
      deleteProduct: async () => { calls.push('deleteProduct'); if (serviceError) throw serviceError; return { id: ID }; },
      deleteProductImage: async () => ({ id: ID }),
      deleteVariant: async () => ({ id: ID }),
      updateProduct: async () => ({ id: ID }),
      updateVariant: async () => ({ id: ID }),
      uploadProductImage: async () => ({ id: ID, url: '' }),
    },
  });
  mock.module('../src/services/product-onboarding.service.ts', {
    namedExports: {
      generateVariantSku: async () => 'SKU-1',
      publishProductIfReady: async () => ({ published: true, reasons: [] }),
      quickUpdateCatalogProduct: async () => { calls.push('quickUpdate'); if (serviceError) throw serviceError; return { id: ID, name: 'Test', status: 'ACTIVE' }; },
      bulkCatalogAction: async () => { calls.push('bulk'); if (serviceError) throw serviceError; return { done: [ID], blocked: [] }; },
      mergeCatalogProducts: async () => { calls.push('merge'); if (serviceError) throw serviceError; return { productId: ID, slug: 'merged', name: 'Merged', status: 'ACTIVE', variantCount: 2 }; },
    },
  });

  const actions = await import('../src/app/admin/(protected)/products/actions');

  // Unauthenticated
  role = null;
  await assert.rejects(actions.quickUpdateCatalogProductAction({ productId: ID }), (e: unknown) => e instanceof DomainError && e.status === 401);
  await assert.rejects(actions.deleteCatalogProductAction(ID), (e: unknown) => e instanceof DomainError && e.status === 401);

  // STAFF cannot delete
  role = 'STAFF';
  await assert.rejects(actions.deleteCatalogProductAction(ID), (e: unknown) => e instanceof DomainError && e.status === 403);
  assert.equal(calls.length, 0);

  // STAFF can quickUpdate; DomainError returns { ok: false }
  const ok = await actions.quickUpdateCatalogProductAction({ productId: ID, name: 'Updated' });
  assert.equal(ok.ok, true);
  serviceError = new DomainError('PUBLISH_BLOCKED', 'Thiếu ảnh', 409);
  const blocked = await actions.quickUpdateCatalogProductAction({ productId: ID, status: 'ACTIVE' });
  assert.deepEqual(blocked, { ok: false, code: 'PUBLISH_BLOCKED', error: 'Thiếu ảnh' });

  // OWNER can delete
  role = 'OWNER';
  serviceError = undefined;
  const deleted = await actions.deleteCatalogProductAction(ID);
  assert.deepEqual(deleted, { ok: true, data: { id: ID } });
  assert.ok(calls.includes('deleteProduct'));
});

// ---------------------------------------------------------------------------------------------
// DB-backed integration tests (runs when DATABASE_URL is available)
// ---------------------------------------------------------------------------------------------

const fixtures: ImportedFixture[] = [];
const createdProductIds: string[] = [];
let owner: StaffSession;
let staff: StaffSession;

before(async () => {
  if (!hasDb) return;
  const db = getPool();
  owner = { actorId: await createStaff(db, 'OWNER'), role: 'OWNER' };
  staff = { actorId: await createStaff(db, 'STAFF'), role: 'STAFF' };
});

after(async () => {
  if (!hasDb) return;
  const db = getPool();
  for (const id of createdProductIds) {
    await db.query('delete from inventory_movements where product_variant_id in (select id from product_variants where product_id = $1)', [id]).catch(() => undefined);
    await db.query('delete from product_images where product_id = $1', [id]).catch(() => undefined);
    await db.query('delete from product_variants where product_id = $1', [id]).catch(() => undefined);
    await db.query('delete from products where id = $1', [id]).catch(() => undefined);
  }
  await cleanupImported(db, fixtures);
  await db.query('delete from audit_logs where actor_id = any($1::uuid[])', [[owner.actorId, staff.actorId]]).catch(() => undefined);
  await deleteStaff(db, [owner.actorId, staff.actorId]).catch(() => undefined);
  await db.end();
});

test('DB: deleteProduct deletes product + default variants cleanly, and blocks when inventory movement exists', { skip: !hasDb }, async () => {
  const db = getPool();
  const cat = (await db.query<{ id: string }>("select id from categories where is_active = true and slug <> 'chua-phan-loai' limit 1")).rows[0];
  assert.ok(cat);

  const deletable = await createProductWithVariants({
    requestId: randomUUID(),
    name: `Xoa duoc ${randomUUID().slice(0, 6)}`,
    categoryId: cat.id,
    productType: 'MADE_TO_ORDER',
    basePrice: 25_000,
    licenseType: 'OWN_DESIGN',
    variants: [{ name: 'Mặc định', openingStock: 0 }],
    isFeatured: false,
  }, owner.actorId);
  createdProductIds.push(deletable.productId);

  await deleteProduct(deletable.productId, owner.actorId);
  const exists = await db.query('select 1 from products where id = $1', [deletable.productId]);
  assert.equal(exists.rowCount, 0);

  const wh = (await db.query<{ id: string }>('select id from warehouses where is_active = true limit 1')).rows[0];
  if (wh) {
    const stocked = await createProductWithVariants({
      requestId: randomUUID(),
      name: `Co ton kho ${randomUUID().slice(0, 6)}`,
      categoryId: cat.id,
      productType: 'READY_STOCK',
      basePrice: 50_000,
      licenseType: 'OWN_DESIGN',
      warehouseId: wh.id,
      variants: [{ name: 'Đen', color: 'Đen', openingStock: 3 }],
      isFeatured: false,
    }, owner.actorId);
    createdProductIds.push(stocked.productId);

    await assert.rejects(
      deleteProduct(stocked.productId, owner.actorId),
      (e: unknown) => e instanceof DomainError && e.code === 'PRODUCT_IN_USE',
    );
  }
});

test('DB: quickUpdateCatalogProduct & bulkCatalogAction sync variant prices, enforce STL OWNER approval, and report partial blocks', { skip: !hasDb }, async () => {
  const f1 = await seedImportedProduct(getPool(), { licenseReviewed: false, basePrice: 25_000 });
  const f2 = await seedImportedProduct(getPool(), { licenseReviewed: false, withImage: false, basePrice: 30_000 });
  fixtures.push(f1, f2);

  // STAFF cannot approve STL draft to ACTIVE
  await assert.rejects(
    quickUpdateCatalogProduct(staff, {
      productId: f1.productId,
      licenseType: 'OWN_DESIGN',
      licenseReviewed: true,
      status: 'ACTIVE',
    }),
    (e: unknown) => e instanceof DomainError && e.code === 'FORBIDDEN',
  );

  // OWNER updates price & approves STL draft in one shot, syncing default variant price
  await quickUpdateCatalogProduct(owner, {
    productId: f1.productId,
    basePrice: 42_000,
    licenseType: 'OWN_DESIGN',
    licenseReviewed: true,
    isFeatured: true,
    status: 'ACTIVE',
  });

  const prodRow = (await getPool().query('select status, base_price, is_featured from products where id = $1', [f1.productId])).rows[0];
  assert.equal(prodRow.status, 'ACTIVE');
  assert.equal(Number(prodRow.base_price), 42_000);
  assert.equal(prodRow.is_featured, true);
  const varRow = (await getPool().query('select price from product_variants where product_id = $1', [f1.productId])).rows[0];
  assert.equal(Number(varRow.price), 42_000);

  // Bulk apply license + publish: f1 already ACTIVE, f2 blocked by NO_IMAGE
  const bulk = await bulkCatalogAction(owner, {
    action: 'APPLY_LICENSE',
    productIds: [f1.productId, f2.productId],
    licenseType: 'CC0',
    licenseSourceUrl: 'https://makerworld.com/en/models/99',
    licenseReviewed: true,
    publish: true,
  });
  assert.deepEqual(bulk.done, [f1.productId]);
  assert.equal(bulk.blocked.length, 1);
  assert.equal(bulk.blocked[0].productId, f2.productId);

  const list = await listCatalogProducts({ search: f1.tag });
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].importReviewStatus, 'APPROVED');
  assert.equal(list.items[0].importLicenseReviewed, true);
});
