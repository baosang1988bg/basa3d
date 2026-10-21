// Feature 003 — "Kho nhập STL" server actions: authentication/authorisation happen before any service
// call and are never swallowed into `{ ok: false }` (FR-016, US2 scenario 5). Services are mocked.
import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { DomainError } from '../src/lib/domain-error';

let role: 'OWNER' | 'STAFF' | null = 'STAFF';
let serviceError: Error | undefined;
const calls: string[] = [];
const record = (name: string) => async () => { calls.push(name); if (serviceError) throw serviceError; return { done: [], blocked: [] }; };
mock.module('../src/lib/auth/require-admin.ts', { namedExports: {
  requireAdmin: async () => {
    if (!role) throw new DomainError('AUTH_REQUIRED', 'Bạn cần đăng nhập để thực hiện thao tác này.', 401);
    return { actorId: 'actor', role };
  },
  requireOwner: async () => {
    if (!role) throw new DomainError('AUTH_REQUIRED', 'Bạn cần đăng nhập để thực hiện thao tác này.', 401);
    if (role !== 'OWNER') throw new DomainError('FORBIDDEN', 'Chỉ OWNER mới có quyền thực hiện thao tác này.', 403);
    return { actorId: 'actor', role };
  },
} });
mock.module('next/cache', { namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined } });
mock.module('../src/services/stl-import.service.ts', { namedExports: {
  quickEditImportItem: record('quickEdit'), requestRerender: record('rerender'),
  approveImportItems: record('approve'), rejectImportItems: record('reject'),
} });
const actions = await import('../src/app/admin/(protected)/stl-import/actions');

const ITEM = { itemId: '00000000-0000-4000-8000-000000000001', expectedItemUpdatedAt: '2026-10-21T00:00:00.000000Z' };

test('signed-out callers get 401 from every action and no service runs', async () => {
  role = null;
  try {
    for (const action of [actions.quickEditImportItemAction, actions.requestRerenderAction, actions.approveImportItemsAction, actions.rejectImportItemsAction]) {
      await assert.rejects(action({ items: [ITEM] }), (error: unknown) => error instanceof DomainError && error.status === 401);
    }
    assert.deepEqual(calls, []);
  } finally { role = 'STAFF'; }
});

test('STAFF gets 403 on approve/reject (server-side, not just a hidden button) but may edit and request rerender', async () => {
  calls.length = 0;
  await assert.rejects(actions.approveImportItemsAction({ items: [ITEM] }), (error: unknown) => error instanceof DomainError && error.status === 403);
  await assert.rejects(actions.rejectImportItemsAction({ items: [ITEM] }), (error: unknown) => error instanceof DomainError && error.status === 403);
  assert.deepEqual(calls, []);
  assert.equal((await actions.quickEditImportItemAction({})).ok, true);
  assert.equal((await actions.requestRerenderAction(ITEM)).ok, true);
  assert.deepEqual(calls, ['quickEdit', 'rerender']);
});

test('OWNER reaches approve/reject; domain errors come back as { ok: false, code }, unexpected ones are rethrown', async () => {
  role = 'OWNER';
  try {
    assert.equal((await actions.approveImportItemsAction({ items: [ITEM] })).ok, true);
    serviceError = new DomainError('STALE_WRITE', 'Dữ liệu đã thay đổi.', 409);
    assert.deepEqual(await actions.quickEditImportItemAction({}), { ok: false, code: 'STALE_WRITE', error: 'Dữ liệu đã thay đổi.' });
    serviceError = new Error('private database detail');
    await assert.rejects(actions.rejectImportItemsAction({ items: [ITEM] }), /private database detail/);
  } finally { role = 'STAFF'; serviceError = undefined; }
});
