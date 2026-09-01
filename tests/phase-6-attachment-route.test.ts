import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { type ChildProcess, spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

const PORT = 3411;
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess: ChildProcess | undefined;

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.ok) return;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server did not become ready on ${BASE_URL} within ${timeoutMs}ms`);
}

const canRunLiveServer = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

before(async () => {
  if (!canRunLiveServer) return;
  try {
    if ((await fetch(`${BASE_URL}/admin/login`)).ok) return;
  } catch { /* start a dedicated server below */ }
  serverProcess = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });
  await waitForServer(30_000);
});

after(async () => { if (serverProcess) serverProcess.kill('SIGTERM'); });

test('valid file upload returns a private storage path, not a public URL', { skip: !canRunLiveServer }, async () => {
  const body = new FormData();
  body.set('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'model/stl' }), 'e2e-test.stl');
  const response = await fetch(`${BASE_URL}/api/public/custom-requests/attachments`, { method: 'POST', body });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.match(result.path, /^requests\/.+\.stl$/);
  assert.equal('url' in result, false);
});

test('an unsupported extension is rejected with 400, not uploaded', { skip: !canRunLiveServer }, async () => {
  const body = new FormData();
  body.set('file', new Blob([new Uint8Array([1, 2, 3])]), 'model.blend');
  const response = await fetch(`${BASE_URL}/api/public/custom-requests/attachments`, { method: 'POST', body });
  assert.equal(response.status, 400);
  const responseBody = await response.json();
  assert.equal(responseBody.code, 'INVALID_FILE_TYPE');
});

test('uploading a real file then submitting the custom request persists its private storage path', { skip: !canRunLiveServer }, async () => {
  const uploadBody = new FormData();
  uploadBody.set('file', new Blob([new Uint8Array([9, 9, 9])], { type: 'image/png' }), 'sample.png');
  const uploadResponse = await fetch(`${BASE_URL}/api/public/custom-requests/attachments`, { method: 'POST', body: uploadBody });
  assert.equal(uploadResponse.status, 201);
  const { path: attachmentPath } = await uploadResponse.json();

  const phone = `05${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
  const submitResponse = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Attachment Flow Test', customerPhone: phone, description: 'test full flow',
      quantity: 1, attachmentPath,
    }),
  });
  assert.equal(submitResponse.status, 201);
  const { id } = await submitResponse.json();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select attachment_path from custom_requests where id = $1', [id]);
    assert.equal(row.rows[0].attachment_path, attachmentPath);
    assert.doesNotMatch(row.rows[0].attachment_path, /^https?:/);
  } finally {
    await client.end();
  }
});

test('exceeding the per-IP upload rate limit returns 429', { skip: !canRunLiveServer }, async () => {
  // x-forwarded-for is absent on a direct localhost call, so all requests in this test share the
  // same 'unknown' bucket the route falls back to — good enough to exercise the counter itself.
  let lastStatus = 0;
  for (let i = 0; i < 11; i += 1) {
    const body = new FormData();
    body.set('file', new Blob([new Uint8Array([i])]), `rl-${i}.png`);
    const response = await fetch(`${BASE_URL}/api/public/custom-requests/attachments`, { method: 'POST', body });
    lastStatus = response.status;
    if (response.status === 429) break;
  }
  assert.equal(lastStatus, 429);
});
