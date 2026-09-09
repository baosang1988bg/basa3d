import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { DomainError } from '../src/lib/domain-error';

let authError: Error | undefined;
let serviceError: Error | undefined;
const writes: unknown[][] = [];
const revalidated: string[] = [];
const write = async (...args: unknown[]) => { if (serviceError) throw serviceError; writes.push(args); };
mock.module('../src/lib/auth/require-admin.ts', { namedExports: {
  requireAdmin: async () => { if (authError) throw authError; return { actorId: 'actor', role: 'STAFF' }; },
} });
mock.module('next/cache', { namedExports: { revalidatePath: (path: string) => revalidated.push(path) } });
mock.module('../src/services/order.service.ts', { namedExports: { updateOrderStatus: write, updateOrderPaymentAndShipping: write } });
mock.module('../src/services/custom-request.service.ts', { namedExports: { createCustomRequest: write, updateCustomRequestStatus: write } });
mock.module('../src/services/quote.service.ts', { namedExports: { acceptQuote: write, createQuote: write } });
mock.module('../src/services/print-job.service.ts', { namedExports: { updatePrintJobStatus: write, assignPrintJobMaterial: write, assignPrintJobSpool: write, recordPrintJobActuals: write } });
const orders = await import('../src/app/admin/(protected)/orders/actions');
const requests = await import('../src/app/admin/(protected)/custom-requests/actions');
const jobs = await import('../src/app/admin/(protected)/print-jobs/actions');
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }

test('invalid status returns an inline error without invoking a writer', async () => {
  for (const action of [orders.updateOrderStatusAction, requests.updateCustomRequestStatusAction, requests.updatePrintJobStatusAction]) {
    const before = writes.length;
    assert.ok((await action('id', form({ status: 'INVALID' }))).error);
    assert.equal(writes.length, before);
  }
});
test('material/spool/actual input validation is handled before writes', async () => {
  const before = writes.length;
  assert.ok((await jobs.assignPrintJobMaterialAction('id', form({ materialId: 'invalid', estimatedWeightGrams: '-1' }))).error);
  assert.ok((await jobs.assignPrintJobSpoolAction('id', form({ spoolId: 'invalid' }))).error);
  assert.ok((await jobs.recordPrintJobActualsAction('id', form({ actualWeightGrams: '-1' }))).error);
  assert.equal(writes.length, before);
});
test('domain failures are returned while unexpected failures reach the boundary', async () => {
  try {
    serviceError = new DomainError('INVALID_TRANSITION', 'Không thể chuyển trạng thái.', 409);
    assert.deepEqual(await orders.updateOrderStatusAction('id', form({ status: 'CONFIRMED' })), { error: serviceError.message });
    serviceError = new Error('private database detail');
    await assert.rejects(orders.updateOrderStatusAction('id', form({ status: 'CONFIRMED' })), /private database detail/);
  } finally { serviceError = undefined; }
});
test('authentication remains outside handled domain errors', async () => {
  try {
    authError = new DomainError('AUTH_REQUIRED', 'Login required', 401);
    await assert.rejects(orders.updateOrderStatusAction('id', form({ status: 'CONFIRMED' })), /Login required/);
  } finally { authError = undefined; }
});
test('valid status keeps actor/role and success invalidation', async () => {
  assert.deepEqual(await requests.updatePrintJobStatusAction('id', form({ status: 'PRINTING' })), { saved: true });
  assert.deepEqual(writes.at(-1), ['id', 'PRINTING', 'actor', { role: 'STAFF', overrideReason: undefined }]);
  assert.ok(revalidated.includes('/admin/print-jobs'));
});
test('malformed quote JSON is handled without a write', async () => {
  const before = writes.length;
  assert.ok((await requests.createQuoteAction('id', form({ pricingBreakdown: '{broken' }))).error);
  assert.equal(writes.length, before);
});
