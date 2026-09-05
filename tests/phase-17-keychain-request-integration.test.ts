import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import * as opentype from 'opentype.js';
import { buildKeychainModel, exportKeychainStl } from '../src/lib/keychain/keychain-engine';

nextEnv.loadEnvConfig(process.cwd());
const BASE_URL = 'http://localhost:3411';
const TEST_IP = `phase-17-${randomUUID()}`;
const HEADERS = { 'x-forwarded-for': TEST_IP };
const canRun = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

after(async () => {
  if (!canRun) return;
  const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
  try {
    await client.query("delete from rate_limit_attempts where scope in ('custom-request-attachment-upload', 'tool-price-estimate') and limiter_key = $1", [createHash('sha256').update(TEST_IP).digest('hex')]);
  } finally { await client.end(); }
});

test('generated merged STL uploads and creates a request with a private attachment path', { skip: !canRun }, async () => {
  const fontBytes = await readFile('public/fonts/BeVietnamPro-Regular.ttf');
  const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
  const model = buildKeychainModel({ text: 'Đặng Quốc Trưởng', baseThicknessMm: 3, includeKeyringHole: true }, font);
  const stl = exportKeychainStl(model.mergedGeometry);
  assert.ok(stl.size > 84, 'binary STL must contain a header and triangles');

  const upload = new FormData(); upload.set('file', stl, 'moc-khoa.stl');
  const uploadResponse = await fetch(`${BASE_URL}/api/public/custom-requests/attachments`, { method: 'POST', headers: HEADERS, body: upload });
  assert.equal(uploadResponse.status, 201);
  const { path: attachmentPath } = await uploadResponse.json();
  assert.match(attachmentPath, /^requests\/[0-9a-f-]+\.stl$/);

  const response = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      customerName: 'Phase 17 Integration', customerPhone: `08${Date.now().toString().slice(-8)}`,
      description: 'Móc khoá khắc tên: Đặng Quốc Trưởng', quantity: 1, requestedMaterial: 'PLA',
      requestedColor: 'Đế đen (#000000) - Chữ vàng (#FFD700)', attachmentPath,
    }),
  });
  assert.equal(response.status, 201);
});

test('public estimate route accepts valid measurements, rejects invalid input, and never leaks raw config', { skip: !canRun }, async () => {
  const valid = await fetch(`${BASE_URL}/api/public/tool-price-estimate`, {
    method: 'POST', headers: { ...HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify({ weightGrams: 10, printMinutes: 30 }),
  });
  assert.equal(valid.status, 200);
  const body = await valid.json();
  assert.deepEqual(Object.keys(body).sort(), ['maxPriceVnd', 'minPriceVnd']);
  assert.ok(Number.isSafeInteger(body.minPriceVnd) && body.minPriceVnd > 0);
  assert.ok(body.maxPriceVnd >= body.minPriceVnd);
  for (const forbidden of ['marginPct', 'laborVndPerHour', 'electricityVndPerKwh', 'machinePriceVnd']) assert.equal(forbidden in body, false);

  const invalid = await fetch(`${BASE_URL}/api/public/tool-price-estimate`, {
    method: 'POST', headers: { ...HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify({ weightGrams: -1, printMinutes: 30, marginPct: 0 }),
  });
  assert.equal(invalid.status, 400);
});


test('shared tool estimate rate limit permits 60 requests per IP and blocks the next', { skip: !canRun }, async () => {
  const ip = `tool-limit-${randomUUID()}`;
  try {
    for (let i = 0; i < 61; i++) {
      const response = await fetch(`${BASE_URL}/api/public/tool-price-estimate`, {
        method: 'POST', headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
        body: JSON.stringify({ weightGrams: -1, printMinutes: 30 }),
      });
      assert.equal(response.status, i < 60 ? 400 : 429);
    }
  } finally {
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try { await client.query("delete from rate_limit_attempts where scope = 'tool-price-estimate' and limiter_key = $1", [createHash('sha256').update(ip).digest('hex')]); }
    finally { await client.end(); }
  }
});
