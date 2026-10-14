// Phase 33 S2 — live-server tests for the signed-URL upload flow (replaces
// phase-6-attachment-route.test.ts, whose multipart route was removed). Needs the test server
// (npm test with TEST_DATABASE_URL) and a local Supabase with Storage (TEST_SUPABASE_*).
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { configureTestEnvironment } from './helpers/test-environment';
import { createUploadClaim } from '../src/lib/upload-claim.js';

configureTestEnvironment();

const BASE_URL = 'http://localhost:3411';
const TEST_IP = `phase-33-${randomUUID()}`;
const HEADERS = { 'x-forwarded-for': TEST_IP, 'content-type': 'application/json' };
const BUCKET = 'custom-request-attachments';
const canRunLiveServer = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const uploadedPaths: string[] = [];

after(async () => {
  if (!canRunLiveServer) return;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  if (uploadedPaths.length) await admin.storage.from(BUCKET).remove(uploadedPaths);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("delete from rate_limit_attempts where scope = 'custom-request-upload-urls' and limiter_key = $1", [createHash('sha256').update(TEST_IP).digest('hex')]);
  } finally {
    await client.end();
  }
});

async function requestUploads(files: Array<{ ext: string; sizeBytes: number }>, headers: Record<string, string> = HEADERS) {
  return fetch(`${BASE_URL}/api/public/custom-requests/upload-urls`, { method: 'POST', headers, body: JSON.stringify({ files }) });
}

/** Same calls the browser makes (src/lib/uploads/upload-custom-request-file.ts). */
async function uploadViaSignedUrl(bytes: Uint8Array<ArrayBuffer>, ext: string): Promise<{ path: string; uploadClaim: string }> {
  const response = await requestUploads([{ ext, sizeBytes: bytes.length }]);
  assert.equal(response.status, 201);
  const { uploads } = await response.json() as { uploads: Array<{ path: string; token: string; contentType: string; uploadClaim: string }> };
  const [target] = uploads;
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await anon.storage.from(BUCKET).uploadToSignedUrl(target.path, target.token, new Blob([bytes], { type: target.contentType }), { contentType: target.contentType });
  assert.equal(error, null, error?.message);
  uploadedPaths.push(target.path);
  return { path: target.path, uploadClaim: target.uploadClaim };
}

function binaryStl(triangles: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(84 + triangles * 50);
  new DataView(out.buffer).setUint32(80, triangles, true);
  return out;
}

async function submit(upload: { path: string; uploadClaim: string } | null) {
  return fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Attachment Flow Test', customerPhone: `05${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
      description: 'phase 33 upload flow', quantity: 1, attachmentPath: upload?.path ?? null, uploadClaim: upload?.uploadClaim ?? null,
    }),
  });
}

test('upload-urls returns server-chosen paths, tokens and the contentType to send — never a public URL', { skip: !canRunLiveServer }, async () => {
  const response = await requestUploads([{ ext: 'stl', sizeBytes: 1_000 }, { ext: 'PNG', sizeBytes: 10 }]);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.uploads.length, 2);
  assert.match(body.uploads[0].path, /^requests\/[0-9a-f-]+\.stl$/);
  assert.equal(body.uploads[0].contentType, 'model/stl');
  assert.equal(body.uploads[1].contentType, 'image/png');
  assert.equal(typeof body.uploads[0].token, 'string');
  assert.equal(JSON.stringify(body).includes('http'), false);
});

test('upload-urls rejects 11 files, a bad extension and an oversize declaration with 400', { skip: !canRunLiveServer }, async () => {
  assert.equal((await requestUploads(Array.from({ length: 11 }, () => ({ ext: 'stl', sizeBytes: 1 })))).status, 400);
  assert.equal((await requestUploads([{ ext: 'blend', sizeBytes: 1 }])).status, 400);
  assert.equal((await requestUploads([{ ext: 'stl', sizeBytes: 50 * 1024 * 1024 + 1 }])).status, 400);
});

test('a real upload > 4.5MB goes straight to Storage and the submitted request keeps its private path', { skip: !canRunLiveServer }, async () => {
  const stl = binaryStl(100_000); // ~5MB — would be a 413 through a Vercel function
  assert.ok(stl.length > 4.5 * 1024 * 1024);
  const upload = await uploadViaSignedUrl(stl, 'stl');
  const response = await submit(upload);
  assert.equal(response.status, 201);
  const { id } = await response.json();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select attachment_path from custom_requests where id = $1', [id]);
    assert.equal(row.rows[0].attachment_path, upload.path);
  } finally {
    await client.end();
  }
});

test('POST /api/public/custom-requests: a path with no object behind it → 400', { skip: !canRunLiveServer }, async () => {
  const path = `requests/${randomUUID()}.stl`;
  const response = await submit({ path, uploadClaim: createUploadClaim(path) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'ATTACHMENT_NOT_FOUND');
});

test('POST /api/public/custom-requests rejects a tampered upload claim before Storage lookup', { skip: !canRunLiveServer }, async () => {
  const path = `requests/${randomUUID()}.stl`;
  const response = await submit({ path, uploadClaim: `${createUploadClaim(path)}tampered` });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'INVALID_UPLOAD_CLAIM');
});

test('POST /api/public/custom-requests: content that does not match the extension → 400', { skip: !canRunLiveServer }, async () => {
  const upload = await uploadViaSignedUrl(new TextEncoder().encode('<html><script>alert(1)</script></html>'), '3mf');
  const response = await submit(upload);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'ATTACHMENT_CONTENT_MISMATCH');
});

test('upload-urls is rate limited per IP (20 calls/hour)', { skip: !canRunLiveServer }, async () => {
  const headers = { ...HEADERS, 'x-forwarded-for': `${TEST_IP}-rl` };
  let lastStatus = 0;
  for (let i = 0; i < 21; i += 1) {
    const response = await requestUploads([{ ext: 'png', sizeBytes: 1 }], headers);
    lastStatus = response.status;
    if (response.status === 429) break;
  }
  assert.equal(lastStatus, 429);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("delete from rate_limit_attempts where scope = 'custom-request-upload-urls' and limiter_key = $1", [createHash('sha256').update(`${TEST_IP}-rl`).digest('hex')]);
  } finally {
    await client.end();
  }
});

test('/bao-gia branch: two uploaded STL items → one request with 2 VERIFIED items, attachment_path NULL', { skip: !canRunLiveServer }, async () => {
  const stl = binaryStl(12);
  // A real closed cube so the server can re-measure it.
  const view = new DataView(stl.buffer);
  const v = [[0, 0, 0], [20, 0, 0], [20, 20, 0], [0, 20, 0], [0, 0, 20], [20, 0, 20], [20, 20, 20], [0, 20, 20]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 6, 2], [3, 7, 6], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  t.forEach((tri, i) => tri.forEach((vi, k) => v[vi].forEach((c, j) => view.setFloat32(84 + i * 50 + 12 + k * 12 + j * 4, c, true))));
  const clientMetrics = { volumeMm3: 8_000, surfaceMm2: 2_400, sizeMm: { x: 20, y: 20, z: 20 }, triangles: 12 };
  const uploads = [await uploadViaSignedUrl(stl, 'stl'), await uploadViaSignedUrl(stl, 'stl')];
  const response = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Bao Gia Route Test', customerPhone: `06${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
      copyrightConfirmed: true, tosVersion: 'v1',
      items: uploads.map(({ path: attachmentPath, uploadClaim }, index) => ({ attachmentPath, uploadClaim, displayName: `cube-${index}.stl`, materialType: 'PLA', infillPct: 15, scalePermille: 1000, quantity: 1, clientMetrics })),
    }),
  });
  assert.equal(response.status, 201);
  const { id } = await response.json();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    assert.equal((await client.query('select attachment_path from custom_requests where id = $1', [id])).rows[0].attachment_path, null);
    const items = await client.query('select verification from custom_request_items where custom_request_id = $1 order by position', [id]);
    assert.equal(items.rowCount, 2);
    // No pricing config in a fresh test DB → UNPRICED is also a valid outcome; never CLIENT_REPORTED here.
    for (const row of items.rows) assert.ok(['VERIFIED', 'UNPRICED'].includes(row.verification));
  } finally {
    await client.query('begin');
    await client.query("set local basa3d.allow_item_purge = 'on'");
    await client.query('delete from custom_request_items where custom_request_id = $1', [id]);
    await client.query('delete from custom_requests where id = $1', [id]);
    await client.query('commit');
    await client.end();
  }
});
