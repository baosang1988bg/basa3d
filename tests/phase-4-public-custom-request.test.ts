import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { type ChildProcess, spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

const PORT = 3413;
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

before(async () => {
  if (!process.env.DATABASE_URL) return;
  serverProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });
  await waitForServer(30_000);
});

after(async () => { if (serverProcess) serverProcess.kill('SIGTERM'); });

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: 'Test Customer',
    customerPhone: `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
    description: 'Cần in 1 mô hình test',
    quantity: 1,
    attachmentUrl: 'https://drive.google.com/file/d/abc123',
    // NOTE: no sourceChannel here — publicCustomRequestInputSchema is .strict() and has no
    // sourceChannel field (see domain/schemas.ts), so a client-sent sourceChannel is rejected
    // with a 400 VALIDATION_ERROR before it ever reaches the route/service layer, not silently
    // overridden. The server always hardcodes 'WEBSITE' server-side (route.ts) regardless.
    ...overrides,
  };
}

test('valid submission returns 201 and persists source_channel = WEBSITE and the given attachment_url', { skip: !process.env.DATABASE_URL }, async () => {
  const payload = validPayload();
  const response = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.ok(body.id);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select source_channel, attachment_url from custom_requests where id = $1', [body.id]);
    assert.equal(row.rows[0].source_channel, 'WEBSITE');
    assert.equal(row.rows[0].attachment_url, payload.attachmentUrl);

    const auditRow = await client.query(`select actor_id, action from audit_logs where entity_id = $1 and entity_type = 'custom_request'`, [body.id]);
    assert.equal(auditRow.rows[0].actor_id, null);
    assert.equal(auditRow.rows[0].action, 'CUSTOM_REQUEST_CREATED_PUBLIC');
  } finally {
    await client.end();
  }
});

test('a filled honeypot returns a 201-shaped response but inserts no row', { skip: !process.env.DATABASE_URL }, async () => {
  const payload = validPayload({ honeypot: 'i-am-a-bot', customerPhone: `08${randomUUID().replace(/\D/g, '').slice(0, 8)}` });
  const response = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.ok(body.id);
  assert.ok(body.requestNumber);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select id from custom_requests where customer_phone = $1', [payload.customerPhone]);
    assert.equal(row.rowCount, 0);
  } finally {
    await client.end();
  }
});

test('submitting more than the rate limit for one phone number is rejected without inserting', { skip: !process.env.DATABASE_URL }, async () => {
  const phone = `07${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
  for (let i = 0; i < 3; i += 1) {
    const response = await fetch(`${BASE_URL}/api/public/custom-requests`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload({ customerPhone: phone })),
    });
    assert.equal(response.status, 201);
  }
  const fourth = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload({ customerPhone: phone })),
  });
  assert.equal(fourth.status, 429);
  const body = await fourth.json();
  assert.equal(body.code, 'RATE_LIMITED');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select count(*) from custom_requests where customer_phone = $1', [phone]);
    assert.equal(Number(row.rows[0].count), 3);
  } finally {
    await client.end();
  }
});
