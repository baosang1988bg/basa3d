// Phase 33 S5 — multi-item /bao-gia request (plan §6.3, T8): re-measure + re-price on the server,
// one transaction for request + items.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { Client } from 'pg';
import { configureTestEnvironment } from './helpers/test-environment';
import { purgeCustomRequest } from './helpers/purge-custom-request';
import { DomainError } from '../src/lib/domain-error.js';
import { publicBaoGiaRequestSchema, publicCustomRequestInputSchema } from '../src/domain/schemas.js';
import {
  describeBaoGiaRequest,
  listCustomRequestItems,
  prepareCustomRequestItems,
  type BaoGiaItemInput,
  type ItemFileAccess,
} from '../src/services/custom-request-items.service.js';
import { createCustomRequest } from '../src/services/custom-request.service.js';
import { computeMeshMetrics, type MeshMetrics } from '../src/lib/pricing/mesh-metrics.js';
import type { PricingContext } from '../src/services/instant-estimate.service.js';
import { getPool } from '../src/lib/db.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const ctx: PricingContext = {
  config: { electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000 },
  medians: new Map([['PLA', 300], ['PETG', 350]]),
  pricingConfigId: '00000000-0000-4000-8000-0000000000c1',
};

function boxPositions(x: number, y: number, z: number): number[] {
  const v = [[0, 0, 0], [x, 0, 0], [x, y, 0], [0, y, 0], [0, 0, z], [x, 0, z], [x, y, z], [0, y, z]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 6, 2], [3, 7, 6], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  return t.flatMap((tri) => tri.flatMap((i) => v[i]));
}
function binaryStl(positions: number[]): Uint8Array {
  const triangles = positions.length / 9;
  const view = new DataView(new ArrayBuffer(84 + triangles * 50));
  view.setUint32(80, triangles, true);
  for (let t = 0; t < triangles; t += 1) for (let k = 0; k < 9; k += 1) view.setFloat32(84 + t * 50 + 12 + k * 4, positions[t * 9 + k], true);
  return new Uint8Array(view.buffer);
}

const cube40 = binaryStl(boxPositions(40, 40, 40));
const metrics40: MeshMetrics = computeMeshMetrics(boxPositions(40, 40, 40));

function fakeFiles(objects: Record<string, Uint8Array>): ItemFileAccess & { downloads: string[] } {
  const downloads: string[] = [];
  return {
    downloads,
    async inspect(path) {
      if (!objects[path]) throw new DomainError('ATTACHMENT_NOT_FOUND', 'missing', 400);
      return { sizeBytes: objects[path].length };
    },
    async download(path) { downloads.push(path); return objects[path]; },
  };
}

const pathFor = () => `requests/${randomUUID()}.stl`;
const itemFor = (attachmentPath: string, overrides: Partial<BaoGiaItemInput> = {}): BaoGiaItemInput => ({
  attachmentPath, displayName: 'cube.stl', materialType: 'PLA', infillPct: 15, scalePermille: 1000, quantity: 2, clientMetrics: metrics40, ...overrides,
});

// ---------------------------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------------------------

test('publicBaoGiaRequestSchema: no price fields, STL/OBJ only, unique paths, ≤ 10 items, mutually exclusive with the old branch', () => {
  const base = { customerName: 'A', customerPhone: '0900000000', copyrightConfirmed: true, tosVersion: 'v1' };
  const item = { ...itemFor(pathFor()), clientMetrics: { ...metrics40 } };
  assert.equal(publicBaoGiaRequestSchema.safeParse({ ...base, items: [item] }).success, true);
  assert.equal(publicBaoGiaRequestSchema.safeParse({ ...base, items: [{ ...item, unitPriceVnd: 1 }] }).success, false);
  assert.equal(publicBaoGiaRequestSchema.safeParse({ ...base, items: [{ ...item, attachmentPath: `requests/${randomUUID()}.3mf` }] }).success, false);
  assert.equal(publicBaoGiaRequestSchema.safeParse({ ...base, items: [item, item] }).success, false);
  assert.equal(publicBaoGiaRequestSchema.safeParse({ ...base, items: Array.from({ length: 11 }, () => ({ ...item, attachmentPath: pathFor() })) }).success, false);
  assert.equal(publicBaoGiaRequestSchema.safeParse({ ...base, items: [item], attachmentPath: pathFor() }).success, false);
  assert.equal(publicBaoGiaRequestSchema.safeParse({ ...base, items: [item], quantity: 3 }).success, false);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, description: 'x', quantity: 1, items: [item] }).success, false);
  // Client metrics must be physically possible.
  assert.equal(publicBaoGiaRequestSchema.safeParse({ ...base, items: [{ ...item, clientMetrics: { ...metrics40, volumeMm3: 10_000_000 } }] }).success, false);
});

// ---------------------------------------------------------------------------------------------
// prepareCustomRequestItems
// ---------------------------------------------------------------------------------------------

test('VERIFIED: server re-measures the stored file, prices it, snapshot has no client metrics', async () => {
  const path = pathFor();
  const [item] = await prepareCustomRequestItems([itemFor(path)], ctx, { files: fakeFiles({ [path]: cube40 }) });
  assert.equal(item.verification, 'VERIFIED');
  assert.equal(item.position, 1);
  assert.equal(item.fileSizeBytes, cube40.length);
  assert.equal(item.estimateSnapshot.status, 'OK');
  assert.ok((item.estimateSnapshot.unitPriceVnd ?? 0) > 0);
  assert.equal(item.estimateSnapshot.pricingConfigId, ctx.pricingConfigId);
  assert.equal(item.estimateSnapshot.clientMetrics, undefined);
  assert.equal(item.estimateSnapshot.mismatchPct, 0);
});

test('MISMATCH: fake (smaller) client metrics cannot lower the stored price — server numbers win', async () => {
  const path = pathFor();
  const honest = await prepareCustomRequestItems([itemFor(path)], ctx, { files: fakeFiles({ [path]: cube40 }) });
  const lying = await prepareCustomRequestItems([itemFor(path, { clientMetrics: computeMeshMetrics(boxPositions(10, 10, 10)) })], ctx, { files: fakeFiles({ [path]: cube40 }) });
  assert.equal(lying[0].verification, 'MISMATCH');
  assert.ok((lying[0].estimateSnapshot.mismatchPct ?? 0) > 90);
  assert.equal(lying[0].estimateSnapshot.unitPriceVnd, honest[0].estimateSnapshot.unitPriceVnd);
  assert.ok(lying[0].estimateSnapshot.clientMetrics);
});

test('CLIENT_REPORTED: beyond the verify budget the file is not downloaded and client numbers are kept + flagged', async () => {
  const first = pathFor(); const second = pathFor();
  const files = fakeFiles({ [first]: cube40, [second]: cube40 });
  const items = await prepareCustomRequestItems([itemFor(first), itemFor(second)], ctx, { files, budgetBytes: cube40.length + 10 });
  assert.deepEqual(items.map((item) => item.verification), ['VERIFIED', 'CLIENT_REPORTED']);
  assert.deepEqual(files.downloads, [first]);
  assert.equal(items[1].position, 2);
  assert.ok(items[1].estimateSnapshot.clientMetrics);
  assert.equal(items[1].estimateSnapshot.status, 'OK');
});

test('UNPRICED: unreadable stored file, file beyond build volume, or no pricing config', async () => {
  const garbage = pathFor(); const big = pathFor(); const ok = pathFor();
  const bigStl = binaryStl(boxPositions(300, 20, 20));
  const files = fakeFiles({ [garbage]: new TextEncoder().encode('solid nothing here'), [big]: bigStl, [ok]: cube40 });
  const items = await prepareCustomRequestItems([
    itemFor(garbage),
    itemFor(big, { clientMetrics: computeMeshMetrics(boxPositions(300, 20, 20)) }),
  ], ctx, { files });
  assert.deepEqual(items.map((item) => item.verification), ['UNPRICED', 'UNPRICED']);
  assert.equal(items[0].estimateSnapshot.unpricedReason, 'SERVER_UNREADABLE');
  assert.equal(items[1].estimateSnapshot.unpricedReason, 'EXCEEDS_BUILD_VOLUME');
  const [noConfig] = await prepareCustomRequestItems([itemFor(ok)], null, { files });
  assert.equal(noConfig.verification, 'UNPRICED');
  assert.equal(noConfig.estimateSnapshot.status, 'NO_PRICING_CONFIG');
});

test('a path with no stored object stops the whole request with a 400', async () => {
  await assert.rejects(
    prepareCustomRequestItems([itemFor(pathFor())], ctx, { files: fakeFiles({}) }),
    (error: unknown) => error instanceof DomainError && error.code === 'ATTACHMENT_NOT_FOUND' && error.status === 400,
  );
});

test('describeBaoGiaRequest writes the NOT NULL description when the customer typed none', () => {
  assert.equal(describeBaoGiaRequest([{ displayName: 'a.stl' }, { displayName: 'b.obj' }], ''), 'Báo giá từ /bao-gia: 2 file (a.stl, b.obj)');
  assert.match(describeBaoGiaRequest([{ displayName: 'a.stl' }], 'Màu đỏ'), /^Màu đỏ\n\nBáo giá từ \/bao-gia: 1 file/);
});

// ---------------------------------------------------------------------------------------------
// Integration: one transaction for request + items (real DB)
// ---------------------------------------------------------------------------------------------

test('createCustomRequest stores the request (attachment_path NULL, quantity = Σ items) and immutable items', { skip: !hasDb }, async () => {
  const a = pathFor(); const b = pathFor();
  const items = await prepareCustomRequestItems([itemFor(a), itemFor(b, { quantity: 5, materialType: 'PETG', displayName: 'b.stl' })], ctx, { files: fakeFiles({ [a]: cube40, [b]: cube40 }) });
  const created = await createCustomRequest({
    customerName: 'Bao Gia Test', customerPhone: '0900000000', description: describeBaoGiaRequest(items),
    quantity: 7, attachmentPath: null, items, copyrightConfirmed: true, tosVersion: 'v1', sourceChannel: 'WEBSITE',
  }, null);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = (await client.query('select attachment_path, quantity from custom_requests where id = $1', [created.id])).rows[0];
    assert.equal(row.attachment_path, null);
    assert.equal(row.quantity, 7);
    const stored = await listCustomRequestItems(created.id);
    assert.deepEqual(stored.map((item) => [item.position, item.attachmentPath, item.quantity, item.verification]), [[1, a, 2, 'VERIFIED'], [2, b, 5, 'VERIFIED']]);
    assert.equal(stored[1].estimateSnapshot?.status, 'OK');
    await assert.rejects(client.query('update custom_request_items set quantity = 1 where custom_request_id = $1', [created.id]), /immutable/);
  } finally {
    await purgeCustomRequest(client, created.id);
    await client.end();
  }
});

test('a bad item rolls back the whole request (no orphan request row)', { skip: !hasDb }, async () => {
  const a = pathFor();
  const [item] = await prepareCustomRequestItems([itemFor(a)], ctx, { files: fakeFiles({ [a]: cube40 }) });
  const phone = `07${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
  await assert.rejects(createCustomRequest({
    customerName: 'Bao Gia Rollback', customerPhone: phone, description: 'x', quantity: 2, attachmentPath: null,
    items: [item, { ...item, position: 1 }], copyrightConfirmed: true, tosVersion: 'v1', sourceChannel: 'WEBSITE',
  }, null));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    assert.equal((await client.query('select count(*)::int as n from custom_requests where customer_phone = $1', [phone])).rows[0].n, 0);
  } finally {
    await client.end();
  }
});
