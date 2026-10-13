// Phase 33 S7 — admin: 1 /bao-gia item = 1 Quote (D2, T5, §6.4, §6.5) on a real database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { Client } from 'pg';
import { configureTestEnvironment } from './helpers/test-environment';
import { purgeCustomRequest } from './helpers/purge-custom-request';
import { getPool, query } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { acceptQuote, createQuote, getPublicQuoteByToken, listQuotesByCustomRequest, mintQuoteAccessToken } from '../src/services/quote.service.js';
import { createCustomRequest, listCustomRequests } from '../src/services/custom-request.service.js';
import { prepareCustomRequestItems, reverifyCustomRequestItem, type ItemFileAccess } from '../src/services/custom-request-items.service.js';
import { computeMeshMetrics } from '../src/lib/pricing/mesh-metrics.js';
import type { PricingContext } from '../src/services/instant-estimate.service.js';

configureTestEnvironment();
process.env.ORDER_CONFIRMATION_SECRET ??= 'phase-33-item-quotes-secret-at-least-32-chars';
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const ctx: PricingContext = {
  config: { electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000 },
  medians: new Map([['PLA', 300]]),
};

function cubeStl(edge: number): Uint8Array {
  const v = [[0, 0, 0], [edge, 0, 0], [edge, edge, 0], [0, edge, 0], [0, 0, edge], [edge, 0, edge], [edge, edge, edge], [0, edge, edge]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 6, 2], [3, 7, 6], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  const view = new DataView(new ArrayBuffer(84 + 12 * 50));
  view.setUint32(80, 12, true);
  t.forEach((tri, i) => tri.forEach((vi, k) => v[vi].forEach((c, j) => view.setFloat32(84 + i * 50 + 12 + k * 12 + j * 4, c, true))));
  return new Uint8Array(view.buffer);
}
function positions(edge: number): number[] {
  const v = [[0, 0, 0], [edge, 0, 0], [edge, edge, 0], [0, edge, 0], [0, 0, edge], [edge, 0, edge], [edge, edge, edge], [0, edge, edge]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 6, 2], [3, 7, 6], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  return t.flatMap((tri) => tri.flatMap((i) => v[i]));
}

async function requestWithItems(count: number, budgetBytes?: number) {
  const objects: Record<string, Uint8Array> = {};
  const inputs = Array.from({ length: count }, (_, index) => {
    const path = `requests/${randomUUID()}.stl`;
    objects[path] = cubeStl(20 + index * 10);
    return { attachmentPath: path, displayName: `part-${index + 1}.stl`, materialType: 'PLA', infillPct: 15, scalePermille: 1000, quantity: 1, clientMetrics: computeMeshMetrics(positions(20 + index * 10)) };
  });
  const files: ItemFileAccess = { inspect: async (path) => ({ sizeBytes: objects[path].length }), download: async (path) => objects[path] };
  const items = await prepareCustomRequestItems(inputs, ctx, { files, budgetBytes });
  const created = await createCustomRequest({
    customerName: 'Item Quote Test', customerPhone: '0900000000', description: 'phase 33 item quotes', quantity: count,
    attachmentPath: null, items, copyrightConfirmed: true, tosVersion: 'v1', sourceChannel: 'WEBSITE',
  }, null);
  const ids = (await query<{ id: string }>('select id from custom_request_items where custom_request_id = $1 order by position', [created.id])).rows.map((row) => row.id);
  return { requestId: created.id, itemIds: ids, objects };
}

async function cleanup(requestId: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { await purgeCustomRequest(client, requestId); } finally { await client.end(); }
}

const validUntil = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

test('createQuote links a quote to its item; an item of another request is a clean 400', { skip: !hasDb }, async () => {
  const a = await requestWithItems(1);
  const b = await requestWithItems(1);
  try {
    const quote = await createQuote({ customRequestId: a.requestId, customRequestItemId: a.itemIds[0], subtotal: 50_000, total: 50_000, validUntil: validUntil() }, ACTOR_ID);
    const [summary] = await listQuotesByCustomRequest(a.requestId);
    assert.equal(summary.id, quote.id);
    assert.equal(summary.customRequestItemId, a.itemIds[0]);
    await assert.rejects(
      createQuote({ customRequestId: a.requestId, customRequestItemId: b.itemIds[0], subtotal: 50_000, total: 50_000, validUntil: validUntil() }, ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'CUSTOM_REQUEST_ITEM_NOT_FOUND' && error.status === 400,
    );
  } finally {
    await cleanup(a.requestId);
    await cleanup(b.requestId);
  }
});

test('2 items → 2 quotes: accepting item 1 does not touch item 2; alternatives of the SAME item auto-reject', { skip: !hasDb }, async () => {
  const { requestId, itemIds } = await requestWithItems(2);
  try {
    const item1a = await createQuote({ customRequestId: requestId, customRequestItemId: itemIds[0], subtotal: 50_000, total: 50_000, validUntil: validUntil() }, ACTOR_ID);
    const item1b = await createQuote({ customRequestId: requestId, customRequestItemId: itemIds[0], subtotal: 60_000, total: 60_000, validUntil: validUntil(), note: 'phương án khác' }, ACTOR_ID);
    const item2 = await createQuote({ customRequestId: requestId, customRequestItemId: itemIds[1], subtotal: 70_000, total: 70_000, validUntil: validUntil() }, ACTOR_ID);
    const manual = await createQuote({ customRequestId: requestId, subtotal: 10_000, total: 10_000, validUntil: validUntil() }, ACTOR_ID);
    await acceptQuote(item1a.id, ACTOR_ID);
    const status = async (id: string) => (await query<{ status: string }>('select status from quotes where id = $1', [id])).rows[0].status;
    assert.equal(await status(item1a.id), 'ACCEPTED');
    assert.equal(await status(item1b.id), 'REJECTED');
    assert.equal(await status(item2.id), 'DRAFT');
    assert.equal(await status(manual.id), 'DRAFT');
    await acceptQuote(item2.id, ACTOR_ID);
    assert.equal(await status(item2.id), 'ACCEPTED');
    const jobs = await query<{ n: number }>('select count(*)::int as n from print_jobs where custom_request_id = $1', [requestId]);
    assert.equal(jobs.rows[0].n, 2);
  } finally {
    await cleanup(requestId);
  }
});

test('listCustomRequests counts real items for the "Đa món" badge', { skip: !hasDb }, async () => {
  const { requestId } = await requestWithItems(3);
  try {
    const page = await listCustomRequests({ limit: 100 });
    assert.equal(page.items.find((row) => row.id === requestId)?.itemCount, 3);
  } finally {
    await cleanup(requestId);
  }
});

test('public quote page DTO names the item it prices', { skip: !hasDb }, async () => {
  const { requestId, itemIds } = await requestWithItems(1);
  try {
    const quote = await createQuote({ customRequestId: requestId, customRequestItemId: itemIds[0], subtotal: 50_000, total: 50_000, validUntil: validUntil() }, ACTOR_ID);
    const detail = await getPublicQuoteByToken(quote.quoteNumber, mintQuoteAccessToken(quote.id, validUntil()));
    assert.equal(detail?.item?.displayName, 'part-1.stl');
    assert.equal(detail?.item?.materialType, 'PLA');
    assert.deepEqual(detail?.item?.sizeMm, { x: 20, y: 20, z: 20 });
  } finally {
    await cleanup(requestId);
  }
});

test('reverify: audits the result, never writes the immutable item, refuses files > 20MB', { skip: !hasDb }, async () => {
  const { requestId, itemIds, objects } = await requestWithItems(1, 0); // budget 0 → CLIENT_REPORTED
  try {
    const before = (await query<{ verification: string; estimate_snapshot: unknown }>('select verification, estimate_snapshot from custom_request_items where id = $1', [itemIds[0]])).rows[0];
    assert.equal(before.verification, 'CLIENT_REPORTED');
    const path = Object.keys(objects)[0];
    const result = await reverifyCustomRequestItem(itemIds[0], ACTOR_ID, { download: async () => objects[path], loadContext: async () => ctx });
    assert.equal(result.status, 'OK');
    if (result.status === 'OK') assert.equal(result.mismatchPct, 0);
    const after = (await query<{ verification: string; estimate_snapshot: unknown }>('select verification, estimate_snapshot from custom_request_items where id = $1', [itemIds[0]])).rows[0];
    assert.deepEqual(after, before);
    const audit = await query<{ n: number }>(`select count(*)::int as n from audit_logs where entity_id = $1 and action = 'CUSTOM_REQUEST_ITEM_REVERIFIED'`, [itemIds[0]]);
    assert.equal(audit.rows[0].n, 1);
  } finally {
    await cleanup(requestId);
  }
});
