import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

const PORT = 3411;
const BASE_URL = `http://localhost:${PORT}`;

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: 'Test Customer',
    customerPhone: `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
    description: 'Cần in 1 mô hình test',
    quantity: 1,
    attachmentPath: `requests/${randomUUID()}.stl`,
    // NOTE: no sourceChannel here — publicCustomRequestInputSchema is .strict() and has no
    // sourceChannel field (see domain/schemas.ts), so a client-sent sourceChannel is rejected
    // with a 400 VALIDATION_ERROR before it ever reaches the route/service layer, not silently
    // overridden. The server always hardcodes 'WEBSITE' server-side (route.ts) regardless.
    ...overrides,
  };
}

test('valid submission returns 201 and persists source_channel = WEBSITE and the private attachment_path', { skip: !process.env.DATABASE_URL }, async () => {
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
    const row = await client.query('select source_channel, attachment_path from custom_requests where id = $1', [body.id]);
    assert.equal(row.rows[0].source_channel, 'WEBSITE');
    assert.equal(row.rows[0].attachment_path, payload.attachmentPath);

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

test('a client-sent sourceChannel is rejected, not silently accepted or overridden', { skip: !process.env.DATABASE_URL }, async () => {
  const response = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validPayload({ sourceChannel: 'ZALO', customerPhone: `06${randomUUID().replace(/\D/g, '').slice(0, 8)}` })),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, 'VALIDATION_ERROR');
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
