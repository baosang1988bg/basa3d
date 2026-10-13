// Phase 33 S2 — custom_request_items schema (plan §4B, T4–T6) on a real database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from 'pg';
import { configureTestEnvironment } from './helpers/test-environment';
import { purgeCustomRequest } from './helpers/purge-custom-request';
import { findOrphanUploadPaths } from '../src/services/orphan-upload-cleanup.service.js';
import { getPool } from '../src/lib/db.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);

async function withClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}

async function insertRequest(client: Client): Promise<string> {
  const id = randomUUID();
  await client.query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
     values ($1, $2, 'WEBSITE', 'Items Test', '0900000000', 'phase 33 items test', 1)`,
    [id, `CR-ITM${id.slice(0, 8).toUpperCase()}`],
  );
  return id;
}

async function insertItem(client: Client, customRequestId: string, position = 1, overrides: Record<string, unknown> = {}): Promise<string> {
  const row = {
    attachment_path: `requests/${randomUUID()}.stl`, display_name: 'cube.stl', file_size_bytes: 1234,
    source_kind: 'MESH', material_type: 'PLA', infill_pct: 15, scale_permille: 1000, quantity: 2,
    verification: 'VERIFIED', estimate_snapshot: JSON.stringify({ schemaVersion: 1 }), ...overrides,
  };
  const result = await client.query<{ id: string }>(
    `insert into custom_request_items (custom_request_id, position, attachment_path, display_name, file_size_bytes, source_kind,
       material_type, infill_pct, scale_permille, quantity, verification, estimate_snapshot)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
    [customRequestId, position, row.attachment_path, row.display_name, row.file_size_bytes, row.source_kind,
      row.material_type, row.infill_pct, row.scale_permille, row.quantity, row.verification, row.estimate_snapshot],
  );
  return result.rows[0].id;
}

async function insertQuote(client: Client, customRequestId: string, itemId: string | null) {
  return client.query(
    `insert into quotes (custom_request_id, custom_request_item_id, quote_number, subtotal, total, valid_until)
     values ($1, $2, $3, 100000, 100000, now() + interval '1 day') returning id`,
    [customRequestId, itemId, `Q-ITM${randomUUID().slice(0, 8).toUpperCase()}`],
  );
}

test('migration contract: items table, trigger function, composite FK, bucket limits, RLS', async () => {
  const sql = await readFile('supabase/migrations/20261015000001_custom_request_items.sql', 'utf8');
  assert.match(sql, /create table custom_request_items \(/);
  assert.match(sql, /unique \(id, custom_request_id\)/);
  assert.match(sql, /create function prevent_custom_request_item_mutation\(\)/);
  assert.match(sql, /current_setting\('basa3d\.allow_item_purge', true\) = 'on'/);
  assert.match(sql, /add constraint quotes_item_same_request\s+foreign key \(custom_request_item_id, custom_request_id\)\s+references custom_request_items\(id, custom_request_id\)/);
  assert.match(sql, /file_size_limit = 52428800/);
  assert.match(sql, /alter table custom_request_items enable row level security/);
});

test('custom_request_items: UPDATE is always rejected', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const requestId = await insertRequest(client);
    const itemId = await insertItem(client, requestId);
    await assert.rejects(client.query('update custom_request_items set quantity = 5 where id = $1', [itemId]), /immutable/);
    // Even with the purge flag, UPDATE stays blocked.
    await client.query('begin');
    await client.query("set local basa3d.allow_item_purge = 'on'");
    await assert.rejects(client.query('update custom_request_items set quantity = 5 where id = $1', [itemId]), /immutable/);
    await client.query('rollback');
    await purgeCustomRequest(client, requestId);
  });
});

test('custom_request_items: DELETE rejected without the session flag, allowed with it (scoped to the transaction)', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const requestId = await insertRequest(client);
    const itemId = await insertItem(client, requestId);
    await assert.rejects(client.query('delete from custom_request_items where id = $1', [itemId]), /immutable/);
    await client.query("set basa3d.allow_item_purge = 'off'");
    await assert.rejects(client.query('delete from custom_request_items where id = $1', [itemId]), /immutable/);

    await client.query('begin');
    await client.query("set local basa3d.allow_item_purge = 'on'");
    const deleted = await client.query('delete from custom_request_items where id = $1', [itemId]);
    assert.equal(deleted.rowCount, 1);
    await client.query('commit');

    // `set local` ended with the transaction — a new item cannot be deleted without the flag again.
    const second = await insertItem(client, requestId, 2);
    await assert.rejects(client.query('delete from custom_request_items where id = $1', [second]), /immutable/);
    await purgeCustomRequest(client, requestId);
    const left = await client.query('select count(*)::int as n from custom_requests where id = $1', [requestId]);
    assert.equal(left.rows[0].n, 0);
  });
});

test('custom_request_items checks: SLICED needs no infill/scale, path shape, positions unique', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const requestId = await insertRequest(client);
    await insertItem(client, requestId, 1, { source_kind: 'SLICED', infill_pct: null, attachment_path: `requests/${randomUUID()}.3mf` });
    await assert.rejects(insertItem(client, requestId, 2, { source_kind: 'SLICED', infill_pct: 15 }), /check/);
    await assert.rejects(insertItem(client, requestId, 3, { attachment_path: 'requests/../x.stl' }), /check/);
    await assert.rejects(insertItem(client, requestId, 4, { attachment_path: `requests/${randomUUID()}.png` }), /check/);
    await assert.rejects(insertItem(client, requestId, 1), /unique|duplicate/);
    await assert.rejects(insertItem(client, requestId, 11), /check/);
    await purgeCustomRequest(client, requestId);
  });
});

test('quotes_item_same_request: a quote cannot point at another request’s item; null item id still inserts', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const requestA = await insertRequest(client);
    const requestB = await insertRequest(client);
    const itemA = await insertItem(client, requestA);
    await assert.rejects(insertQuote(client, requestB, itemA), /quotes_item_same_request/);
    const ok = await insertQuote(client, requestA, itemA);
    assert.equal(ok.rowCount, 1);
    const manual = await insertQuote(client, requestB, null);
    assert.equal(manual.rowCount, 1);
    // An item with a quote cannot be purged out from under it except through the helper's order.
    await purgeCustomRequest(client, requestA);
    await purgeCustomRequest(client, requestB);
  });
});

test('orphan finder: old unreferenced objects only (stub storage.objects)', { skip: !hasDb }, async () => {
  const isStub = await withClient(async (client) => (await client.query(
    `select obj_description(to_regclass('storage.objects'), 'pg_class') = 'basa3d local test stub' as stub`)).rows[0]?.stub === true);
  if (!isStub) return; // never write into a real Supabase storage.objects table from a test
  await withClient(async (client) => {
    const requestId = await insertRequest(client);
    const referencedByRequest = `requests/${randomUUID()}.png`;
    const referencedByItem = `requests/${randomUUID()}.stl`;
    const orphan = `requests/${randomUUID()}.stl`;
    const recent = `requests/${randomUUID()}.stl`;
    const otherBucket = `requests/${randomUUID()}.stl`;
    await client.query('update custom_requests set attachment_path = $2 where id = $1', [requestId, referencedByRequest]);
    await insertItem(client, requestId, 1, { attachment_path: referencedByItem });
    const old = "now() - interval '25 hours'";
    await client.query(`insert into storage.objects (bucket_id, name, created_at) values
      ('custom-request-attachments', $1, ${old}), ('custom-request-attachments', $2, ${old}),
      ('custom-request-attachments', $3, ${old}), ('custom-request-attachments', $4, now() - interval '1 hour'),
      ('product-images', $5, ${old})`, [referencedByRequest, referencedByItem, orphan, recent, otherBucket]);
    try {
      const found = await findOrphanUploadPaths(10_000);
      assert.ok(found.includes(orphan));
      for (const kept of [referencedByRequest, referencedByItem, recent, otherBucket]) assert.equal(found.includes(kept), false, kept);
    } finally {
      await client.query('delete from storage.objects where name = any($1::text[])', [[referencedByRequest, referencedByItem, orphan, recent, otherBucket]]);
      await purgeCustomRequest(client, requestId);
      await getPool().end();
    }
  });
});
