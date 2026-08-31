import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { type ChildProcess, spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

const PORT = 3414;
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
  serverProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });
  await waitForServer(30_000);
});

after(async () => { if (serverProcess) serverProcess.kill('SIGTERM'); });

test('valid file upload returns 201 with a resolvable URL', { skip: !canRunLiveServer }, async () => {
  const body = new FormData();
  body.set('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'model/stl' }), 'e2e-test.stl');
  const response = await fetch(`${BASE_URL}/api/public/custom-requests/attachments`, { method: 'POST', body });
  assert.equal(response.status, 201);
  const { url } = await response.json();
  assert.ok(url);
  const fileResponse = await fetch(url);
  assert.equal(fileResponse.status, 200);
});

test('an unsupported extension is rejected with 400, not uploaded', { skip: !canRunLiveServer }, async () => {
  const body = new FormData();
  body.set('file', new Blob([new Uint8Array([1, 2, 3])]), 'model.blend');
  const response = await fetch(`${BASE_URL}/api/public/custom-requests/attachments`, { method: 'POST', body });
  assert.equal(response.status, 400);
  const responseBody = await response.json();
  assert.equal(responseBody.code, 'INVALID_FILE_TYPE');
});

test('uploading a real file then submitting the custom request with the returned URL persists a real Storage URL, not base64', { skip: !canRunLiveServer }, async () => {
  const uploadBody = new FormData();
  uploadBody.set('file', new Blob([new Uint8Array([9, 9, 9])], { type: 'image/png' }), 'sample.png');
  const uploadResponse = await fetch(`${BASE_URL}/api/public/custom-requests/attachments`, { method: 'POST', body: uploadBody });
  assert.equal(uploadResponse.status, 201);
  const { url: attachmentUrl } = await uploadResponse.json();

  const phone = `05${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
  const submitResponse = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Attachment Flow Test', customerPhone: phone, description: 'test full flow',
      quantity: 1, attachmentUrl,
    }),
  });
  assert.equal(submitResponse.status, 201);
  const { id } = await submitResponse.json();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select attachment_url from custom_requests where id = $1', [id]);
    assert.equal(row.rows[0].attachment_url, attachmentUrl);
    assert.doesNotMatch(row.rows[0].attachment_url, /^data:/);
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
