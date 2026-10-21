// Feature 003 — admin review service (FR-016..FR-024, SC-003): role checks, bulk approve/reject with
// per-item reasons, optimistic lock, filters, rerender request, audit. DB-backed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { cleanupImported, createStaff, deleteStaff, seedImportedProduct, uncategorizedId, type ImportedFixture } from './helpers/stl-import-fixtures';
import { getPool } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import type { StaffSession } from '../src/lib/auth/require-admin.js';
import {
  approveImportItems, listImportItems, quickEditImportItem, rejectImportItems, requestRerender,
} from '../src/services/stl-import.service.js';
import { findImportItem, planImport } from '../src/services/stl-import-write.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
const fixtures: ImportedFixture[] = [];
let owner: StaffSession;
let staff: StaffSession;
before(async () => {
  if (!hasDb) return;
  owner = { actorId: await createStaff(getPool(), 'OWNER'), role: 'OWNER' };
  staff = { actorId: await createStaff(getPool(), 'STAFF'), role: 'STAFF' };
});
after(async () => {
  if (!hasDb) return;
  await cleanupImported(getPool(), fixtures);
  await getPool().query('delete from audit_logs where actor_id = any($1::uuid[])', [[owner.actorId, staff.actorId]]).catch(() => undefined);
  await deleteStaff(getPool(), [owner.actorId, staff.actorId]).catch(() => undefined);
  await getPool().end();
});

async function seed(options: Parameters<typeof seedImportedProduct>[1] = {}) {
  const fixture = await seedImportedProduct(getPool(), options);
  fixtures.push(fixture);
  return fixture;
}

const TS = `to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
async function stamps(fixture: ImportedFixture) {
  const item = (await getPool().query(`select ${TS} as t from product_import_items where id = $1`, [fixture.itemId])).rows[0].t as string;
  const product = (await getPool().query(`select ${TS} as t from products where id = $1`, [fixture.productId])).rows[0].t as string;
  return { item, product };
}
async function ref(fixture: ImportedFixture) {
  const s = await stamps(fixture);
  return { itemId: fixture.itemId, expectedItemUpdatedAt: s.item, expectedProductUpdatedAt: s.product };
}
async function itemRef(fixture: ImportedFixture) {
  return { itemId: fixture.itemId, expectedItemUpdatedAt: (await stamps(fixture)).item };
}
async function productStatus(fixture: ImportedFixture) {
  return (await getPool().query('select status from products where id = $1', [fixture.productId])).rows[0].status as string;
}
function editInput(fixture: ImportedFixture, s: { item: string; product: string }, overrides: Record<string, unknown> = {}) {
  return {
    itemId: fixture.itemId, productId: fixture.productId, expectedItemUpdatedAt: s.item, expectedProductUpdatedAt: s.product,
    name: `Đã sửa ${fixture.tag}`, categoryId: fixture.categoryId, basePrice: 99_000, licenseType: 'CC0', licenseSourceUrl: null, licenseReviewed: true,
    ...overrides,
  };
}
const isDomain = (code: string, status?: number) => (error: unknown) => error instanceof DomainError && error.code === code && (status === undefined || error.status === status);

test('STAFF cannot approve or reject (403) and nothing changes; STAFF can quick-edit', { skip: !hasDb }, async () => {
  const fixture = await seed();
  await assert.rejects(approveImportItems(staff, { items: [await ref(fixture)] }), isDomain('FORBIDDEN', 403));
  await assert.rejects(rejectImportItems(staff, { items: [await ref(fixture)] }), isDomain('FORBIDDEN', 403));
  assert.equal(await productStatus(fixture), 'DRAFT');
  const saved = await quickEditImportItem(staff, editInput(fixture, await stamps(fixture)));
  assert.match(saved.itemUpdatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  const product = (await getPool().query('select name, base_price, pricing_breakdown, license_type from products where id = $1', [fixture.productId])).rows[0];
  assert.deepEqual(product, { name: `Đã sửa ${fixture.tag}`, base_price: '99000', pricing_breakdown: null, license_type: 'CC0' });
  const variant = (await getPool().query('select price from product_variants where product_id = $1', [fixture.productId])).rows[0];
  assert.equal(Number(variant.price), 99_000);
  const item = (await getPool().query('select license_reviewed_by, needs_price_review from product_import_items where id = $1', [fixture.itemId])).rows[0];
  assert.equal(item.needs_price_review, false);
});

test('bulk approve: 5 selected, 2 without license check → 3 ACTIVE, 2 blocked with reasons (SC-003)', { skip: !hasDb }, async () => {
  const ok = await Promise.all([seed(), seed(), seed()]);
  const unchecked = await Promise.all([seed({ licenseReviewed: false }), seed({ licenseReviewed: false })]);
  const result = await approveImportItems(owner, { items: await Promise.all([...ok, ...unchecked].map(ref)) });
  assert.deepEqual(new Set(result.done), new Set(ok.map((f) => f.itemId)));
  assert.equal(result.blocked.length, 2);
  for (const entry of result.blocked) assert.deepEqual(entry.reasons, ['LICENSE_NOT_REVIEWED']);
  for (const fixture of ok) assert.equal(await productStatus(fixture), 'ACTIVE');
  for (const fixture of unchecked) assert.equal(await productStatus(fixture), 'DRAFT');
  const audit = await getPool().query(`select count(*)::int as n from audit_logs where action = 'STL_IMPORT_APPROVED' and actor_id = $1 and entity_id = any($2::uuid[])`, [owner.actorId, ok.map((f) => f.itemId)]);
  assert.equal(audit.rows[0].n, 3);
  const reviewed = (await getPool().query('select reviewed_by from product_import_items where id = $1', [ok[0].itemId])).rows[0];
  assert.equal(reviewed.reviewed_by, owner.actorId);
});

test('bulk approve: 10 items with 3 different failures → 7 approved, 3 blocked with their own reasons', { skip: !hasDb }, async () => {
  const good = await Promise.all(Array.from({ length: 7 }, () => seed()));
  const noImage = await seed({ withImage: false });
  const noPrice = await seed({ basePrice: null });
  const uncategorized = await seed({ uncategorized: true });
  const result = await approveImportItems(owner, { items: await Promise.all([...good, noImage, noPrice, uncategorized].map(ref)) });
  assert.equal(result.done.length, 7);
  const reasons = new Map(result.blocked.map((entry) => [entry.itemId, entry.reasons]));
  assert.deepEqual(reasons.get(noImage.itemId), ['NO_IMAGE']);
  assert.deepEqual(reasons.get(noPrice.itemId), ['NO_PRICE']);
  assert.deepEqual(reasons.get(uncategorized.itemId), ['UNCATEGORIZED']);
});

test('approve twice / stale timestamp / already approved → STALE or NOT_PENDING, never a second decision', { skip: !hasDb }, async () => {
  const fixture = await seed();
  const first = await ref(fixture);
  assert.deepEqual((await approveImportItems(owner, { items: [first] })).done, [fixture.itemId]);
  const again = await approveImportItems(owner, { items: [first] });
  assert.deepEqual(again.blocked, [{ itemId: fixture.itemId, reasons: ['STALE'] }]);
  const fresh = await approveImportItems(owner, { items: [await ref(fixture)] });
  assert.deepEqual(fresh.blocked, [{ itemId: fixture.itemId, reasons: ['NOT_PENDING'] }]);
  const reject = await rejectImportItems(owner, { items: [await ref(fixture)] });
  assert.deepEqual(reject.blocked, [{ itemId: fixture.itemId, reasons: ['NOT_PENDING'] }], 'an approved item is not rejected (un-approve is out of scope)');
});

test('approve is refused as STALE when the product was edited elsewhere after the grid loaded', { skip: !hasDb }, async () => {
  const fixture = await seed();
  const seen = await ref(fixture);
  await getPool().query(`update products set description = 'sửa ở trang sản phẩm' where id = $1`, [fixture.productId]);
  const result = await approveImportItems(owner, { items: [seen] });
  assert.deepEqual(result, { done: [], blocked: [{ itemId: fixture.itemId, reasons: ['STALE'] }] });
  assert.equal(await productStatus(fixture), 'DRAFT');
});

test('an unexpected failure on one item is reported as ERROR, committed items stay, the batch goes on', { skip: !hasDb }, async () => {
  const [first, broken, last] = (await Promise.all([seed(), seed(), seed()])).sort((x, y) => (x.itemId < y.itemId ? -1 : 1));
  const db = getPool();
  // A non-gate failure (stands in for a deadlock / dropped connection) on the middle item only.
  await db.query(`create or replace function public.stl_test_boom() returns trigger language plpgsql as $$
    begin if new.id = '${broken.itemId}' then raise exception 'boom'; end if; return new; end $$`);
  await db.query('create trigger stl_test_boom before update on product_import_items for each row execute function public.stl_test_boom()');
  try {
    const result = await approveImportItems(owner, { items: await Promise.all([first, broken, last].map(ref)) });
    assert.deepEqual(result.done, [first.itemId, last.itemId]);
    assert.deepEqual(result.blocked, [{ itemId: broken.itemId, reasons: ['ERROR'] }]);
  } finally {
    await db.query('drop trigger if exists stl_test_boom on product_import_items');
    await db.query('drop function if exists public.stl_test_boom()');
  }
  assert.equal(await productStatus(first), 'ACTIVE');
  assert.equal(await productStatus(broken), 'DRAFT');
  assert.equal(await productStatus(last), 'ACTIVE');
});

test('reject → product ARCHIVED, and the next import run skips it (FR-022)', { skip: !hasDb }, async () => {
  const fixture = await seed();
  const result = await rejectImportItems(owner, { items: [await ref(fixture)] });
  assert.deepEqual(result.done, [fixture.itemId]);
  assert.equal(await productStatus(fixture), 'ARCHIVED');
  const item = await findImportItem(getPool(), (await getPool().query('select source_key from product_import_items where id = $1', [fixture.itemId])).rows[0].source_key);
  assert.ok(item);
  assert.equal(planImport(item, [{ relPath: 'changed.stl', bytes: 1, mtimeMs: 1 }]), 'SKIP');
  const audit = await getPool().query(`select count(*)::int as n from audit_logs where action = 'STL_IMPORT_REJECTED' and entity_id = $1`, [fixture.itemId]);
  assert.equal(audit.rows[0].n, 1);
});

test('optimistic lock: two devices edit the same card — the second save is refused and the first is kept', { skip: !hasDb }, async () => {
  const fixture = await seed();
  const seen = await stamps(fixture);
  await quickEditImportItem(staff, editInput(fixture, seen, { name: 'Thiết bị 1' }));
  await assert.rejects(quickEditImportItem(owner, editInput(fixture, seen, { name: 'Thiết bị 2' })), isDomain('STALE_WRITE', 409));
  const name = (await getPool().query('select name from products where id = $1', [fixture.productId])).rows[0].name;
  assert.equal(name, 'Thiết bị 1');
  // A product edited elsewhere (product page) also makes the card stale.
  const next = await stamps(fixture);
  await getPool().query(`update products set short_description = 'edited elsewhere' where id = $1`, [fixture.productId]);
  await assert.rejects(quickEditImportItem(owner, editInput(fixture, next)), isDomain('STALE_WRITE', 409));
});

test('a published import keeps its gate conditions: no un-ticking the license, no "Chưa phân loại", no zero price', { skip: !hasDb }, async () => {
  const fixture = await seed();
  await approveImportItems(owner, { items: [await ref(fixture)] });
  const unc = await uncategorizedId(getPool());
  for (const overrides of [{ licenseReviewed: false }, { categoryId: unc }, { categoryId: null }, { basePrice: 0 }, { basePrice: null }]) {
    await assert.rejects(quickEditImportItem(owner, editInput(fixture, await stamps(fixture), overrides)), isDomain('IMPORT_APPROVED_LOCKED', 409));
  }
  await quickEditImportItem(owner, editInput(fixture, await stamps(fixture), { name: 'Đổi tên khi đang bán' }));
  assert.equal(await productStatus(fixture), 'ACTIVE');
});

test('rerender request: only for PENDING items, optimistic-locked, picked up by the next import run', { skip: !hasDb }, async () => {
  const fixture = await seed();
  await requestRerender(staff, await itemRef(fixture));
  const key = (await getPool().query('select source_key, source_files from product_import_items where id = $1', [fixture.itemId])).rows[0];
  const item = await findImportItem(getPool(), key.source_key);
  assert.equal(planImport(item, key.source_files), 'RERENDER');
  await assert.rejects(requestRerender(staff, { itemId: fixture.itemId, expectedItemUpdatedAt: '2000-01-01T00:00:00.000000Z' }), isDomain('STALE_WRITE', 409));
  const approved = await seed();
  await approveImportItems(owner, { items: [await ref(approved)] });
  await assert.rejects(requestRerender(owner, await itemRef(approved)), isDomain('NOT_PENDING', 409));
});

test('list: filter by status, ERROR, category, source folder, name search; paginated by 24', { skip: !hasDb }, async () => {
  const dir = `ListTest-${randomUUID().slice(0, 6)}`;
  const many = [];
  for (let i = 0; i < 25; i += 1) many.push(await seed({ sourceDir: `${dir}/Figures` }));
  const errored = await seed({ sourceDir: `${dir}/Broken` });
  await getPool().query(`update product_import_items set render_status = 'ERROR', process_error = 'MESH_EMPTY' where id = $1`, [errored.itemId]);
  const page1 = await listImportItems(staff, { status: 'PENDING', sourceDir: dir, page: 1 });
  assert.equal(page1.items.length, 24);
  assert.ok(page1.hasNext);
  const page2 = await listImportItems(staff, { status: 'PENDING', sourceDir: dir, page: 2 });
  assert.equal(page2.items.length, 1);
  assert.ok(!page2.hasNext);
  assert.ok(![...page1.items, ...page2.items].some((item) => item.itemId === errored.itemId), 'errored items live under the ERROR tab');
  const errors = await listImportItems(staff, { status: 'ERROR', sourceDir: dir, page: 1 });
  assert.deepEqual(errors.items.map((item) => item.itemId), [errored.itemId]);
  assert.equal(errors.items[0].processError, 'MESH_EMPTY');
  const byCategory = await listImportItems(staff, { status: 'PENDING', categoryId: many[3].categoryId, page: 1 });
  assert.deepEqual(byCategory.items.map((item) => item.itemId), [many[3].itemId]);
  const byName = await listImportItems(staff, { status: 'PENDING', q: many[5].tag, page: 1 });
  assert.deepEqual(byName.items.map((item) => item.itemId), [many[5].itemId]);
  assert.equal(byName.items[0].sourceRelPath, many[5].sourceRelPath, 'admins see the source path');
  assert.ok(page1.sourceDirs.includes(`${dir}/Figures`));
  await assert.rejects(listImportItems(staff, { status: 'BOGUS', page: 1 }));
});
