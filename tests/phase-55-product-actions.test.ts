// Phase 55 (D4, D5, D7) — product server actions: argument validation and what reaches the services
// (docs/exec-plans/active/phase-55-admin-staff-ux.md). No database: services are mocked.
import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { DomainError } from '../src/lib/domain-error';

const calls: { name: string; args: unknown[] }[] = [];
const record = (name: string, result: unknown = undefined) => async (...args: unknown[]) => { calls.push({ name, args }); return result; };
class Redirect extends Error { constructor(public readonly url: string) { super(`redirect:${url}`); } }

mock.module('../src/lib/auth/require-admin.ts', { namedExports: {
  requireAdmin: async () => ({ actorId: 'actor', role: 'STAFF' }),
  requireOwner: async () => ({ actorId: 'actor', role: 'OWNER' }),
} });
mock.module('next/cache', { namedExports: { revalidatePath: () => undefined } });
mock.module('next/navigation', { namedExports: { redirect: (url: string) => { throw new Redirect(url); } } });
mock.module('../src/services/product.service.ts', { namedExports: {
  createCategory: record('createCategory'), createProduct: record('createProduct'), createVariant: record('createVariant'),
  deleteProduct: record('deleteProduct'), deleteProductImage: record('deleteProductImage'), deleteVariant: record('deleteVariant'),
  updateProduct: record('updateProduct'), updateVariant: record('updateVariant'), uploadProductImage: record('uploadProductImage'),
  assignProductImageVariant: record('assignProductImageVariant'),
} });
const NEW_ID = '00000000-0000-4000-8000-0000000000c0';
mock.module('../src/services/product-onboarding.service.ts', { namedExports: {
  BULK_PRODUCT_MAX: 100,
  bulkArchiveProducts: record('bulkArchiveProducts', { done: 2, skipped: 1 }),
  bulkPublishDrafts: record('bulkPublishDrafts', { done: 1, skipped: 0 }),
  duplicateProduct: record('duplicateProduct', { productId: NEW_ID, slug: 'x', variants: [], replayed: false }),
  generateVariantSku: record('generateVariantSku', 'SKU-1'),
  publishProductIfReady: record('publishProductIfReady', { published: true, reasons: [] }),
  bulkCatalogAction: record('bulkCatalogAction', { done: [], blocked: [] }),
  mergeCatalogProducts: record('mergeCatalogProducts'),
  quickUpdateCatalogProduct: record('quickUpdateCatalogProduct'),
  setProductCoverImage: record('setProductCoverImage'),
  duplicateVariant: record('duplicateVariant'),
  splitVariantToProduct: record('splitVariantToProduct'),
} });

// Admin moved from /admin to /basaadmin (merge of origin/dev, 2026-11).
const actions = await import('../src/app/basaadmin/(protected)/products/actions');
const ID = '00000000-0000-4000-8000-000000000001';
const ID_2 = '00000000-0000-4000-8000-000000000002';

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const item of [value].flat()) data.append(key, item);
  return data;
}
function lastCall(name: string) { return calls.filter((call) => call.name === name).at(-1); }
async function redirectUrl(promise: Promise<unknown>): Promise<string> {
  try { await promise; } catch (error) { if (error instanceof Redirect) return error.url; throw error; }
  throw new Error('expected a redirect');
}

test('D7: saving the detail form without a description field leaves the description untouched', async () => {
  await actions.updateProductAction(ID, form({ name: 'Tên mới', status: 'DRAFT' }));
  const patch = lastCall('updateProduct')!.args[1] as Record<string, unknown>;
  assert.equal(patch.description, undefined, 'absent field must not be turned into null (that wiped the column)');
  assert.equal(patch.categoryId, undefined, 'absent category is left unchanged too');
  assert.equal(patch.name, 'Tên mới');
});

test('D7/D6: description and category are written when the form sends them; empty description clears it', async () => {
  await actions.updateProductAction(ID, form({ name: 'A', description: 'Mô tả **dài**', categoryId: ID_2 }));
  let patch = lastCall('updateProduct')!.args[1] as Record<string, unknown>;
  assert.deepEqual([patch.description, patch.categoryId], ['Mô tả **dài**', ID_2]);
  await actions.updateProductAction(ID, form({ name: 'A', description: '' }));
  patch = lastCall('updateProduct')!.args[1] as Record<string, unknown>;
  assert.equal(patch.description, null);
  await assert.rejects(actions.updateProductAction(ID, form({ name: 'A', categoryId: 'not-a-uuid' })));
});

test('D4: duplicate validates both ids, then opens the copy', async () => {
  const before = calls.length;
  await assert.rejects(actions.duplicateProductAction('nope', ID_2), (error: unknown) => error instanceof DomainError && error.code === 'INVALID_ACTION_ARGUMENT');
  await assert.rejects(actions.duplicateProductAction(ID, 'nope'), (error: unknown) => error instanceof DomainError && error.code === 'INVALID_ACTION_ARGUMENT');
  assert.equal(calls.length, before, 'no service call for malformed arguments');
  assert.equal(await redirectUrl(actions.duplicateProductAction(ID, ID_2)), `/basaadmin/products/${NEW_ID}?duplicated=1`);
  assert.deepEqual(lastCall('duplicateProduct')!.args, [{ sourceProductId: ID, requestId: ID_2 }, 'actor']);
});

test('D5: bulk actions dedupe ids, report counts, and only echo a whitelisted status', async () => {
  const url = await redirectUrl(actions.bulkArchiveProductsAction(form({ ids: [ID, ID_2, ID], status: 'ACTIVE' })));
  assert.deepEqual(lastCall('bulkArchiveProducts')!.args, [[ID, ID_2], 'actor']);
  assert.equal(url, '/basaadmin/products?bulk=archived&done=2&skipped=1&status=ACTIVE');
  const published = await redirectUrl(actions.bulkPublishProductsAction(form({ ids: [ID], status: 'https://evil.example' })));
  assert.equal(published, '/basaadmin/products?bulk=published&done=1&skipped=0');
});

test('D5: nothing ticked, a malformed id, or more than the cap never reaches the service', async () => {
  const before = calls.length;
  assert.equal(await redirectUrl(actions.bulkPublishProductsAction(form({}))), '/basaadmin/products?bulk=published&done=0&skipped=0');
  await assert.rejects(actions.bulkPublishProductsAction(form({ ids: [ID, 'x'] })), (error: unknown) => error instanceof DomainError && error.code === 'INVALID_ACTION_ARGUMENT');
  const tooMany = Array.from({ length: 101 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
  await assert.rejects(actions.bulkArchiveProductsAction(form({ ids: tooMany })), (error: unknown) => error instanceof DomainError && error.code === 'TOO_MANY_ITEMS');
  assert.equal(calls.length, before);
});
