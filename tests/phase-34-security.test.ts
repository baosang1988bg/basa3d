import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { createUploadClaim, verifyUploadClaim } from '../src/lib/upload-claim.js';
import { hashCheckoutRequest } from '../src/services/order.service.js';
import { createOrder } from '../src/services/order.service.js';
import { DomainError } from '../src/lib/domain-error.js';
import { Client } from 'pg';
import { readFile } from 'node:fs/promises';
import { createDatabaseRateLimiter } from '../src/lib/rate-limit.js';
import { getPool, query } from '../src/lib/db.js';

const previousUploadSecret = process.env.UPLOAD_CLAIM_SECRET;
process.env.UPLOAD_CLAIM_SECRET = 'phase-34-upload-claim-secret-for-tests';
const hasDb = Boolean(process.env.DATABASE_URL);

after(async () => {
  if (previousUploadSecret === undefined) delete process.env.UPLOAD_CLAIM_SECRET;
  else process.env.UPLOAD_CLAIM_SECRET = previousUploadSecret;
  if (hasDb) await getPool().end();
});

test('upload claims bind path and expiry and reject tampering', () => {
  const path = `requests/${randomUUID()}.stl`;
  const claim = createUploadClaim(path, 60);
  assert.equal(verifyUploadClaim(path, claim), true);
  assert.equal(verifyUploadClaim(path.replace('.stl', '.obj'), claim), false);
  // Tamper a character in the MIDDLE of the signature: the last base64url char carries 2 padding
  // bits, so swapping it can decode to the same bytes (flaky ~1/16) — verify also rejects that now.
  const sigStart = claim.lastIndexOf('.') + 1;
  const flipped = claim[sigStart + 5] === 'A' ? 'B' : 'A';
  assert.equal(verifyUploadClaim(path, `${claim.slice(0, sigStart + 5)}${flipped}${claim.slice(sigStart + 6)}`), false);
  const lastChar = claim.at(-1)!;
  const sameBitsLastChar = String.fromCharCode(lastChar.charCodeAt(0) ^ 1);
  assert.equal(verifyUploadClaim(path, `${claim.slice(0, -1)}${sameBitsLastChar}`), false, 'non-canonical base64url signature is rejected');
  assert.equal(verifyUploadClaim(path, createUploadClaim(path, -1)), false);
});

test('checkout request hash is stable across item and object-key order but changes with payload', () => {
  const a = randomUUID(); const b = randomUUID();
  const base = { checkoutRequestId: randomUUID(), customerName: ' Customer ', customerPhone: ' 0900 ', shippingAddress: { city: 'HCM', line1: '1' }, items: [{ variantId: b, quantity: 2 }, { variantId: a, quantity: 1 }] };
  assert.equal(hashCheckoutRequest(base), hashCheckoutRequest({ ...base, customerName: 'Customer', shippingAddress: { line1: '1', city: 'HCM' }, items: [...base.items].reverse() }));
  assert.notEqual(hashCheckoutRequest(base), hashCheckoutRequest({ ...base, items: [{ variantId: b, quantity: 3 }, { variantId: a, quantity: 1 }] }));
});

test('Phase 34 migration enforces paired checkout fields and a partial unique key', async () => {
  const sql = await readFile('supabase/migrations/20261016000000_phase_34_security_hardening.sql', 'utf8');
  assert.match(sql, /add column checkout_request_id uuid/);
  assert.match(sql, /add column checkout_request_hash varchar\(64\)/);
  assert.match(sql, /orders_checkout_request_pair/);
  assert.match(sql, /create unique index orders_checkout_request_id_idx[\s\S]*where checkout_request_id is not null/);
  assert.match(sql, /idx_rate_limit_expires_at/);
});

test('rate limiter atomically allows only maxRequests under parallel calls', { skip: !hasDb }, async () => {
  const scope = `phase-34-${randomUUID()}`;
  const key = randomUUID();
  const limiter = createDatabaseRateLimiter({ scope, maxRequests: 10, windowMs: 60_000 });
  try {
    const results = await Promise.all(Array.from({ length: 25 }, () => limiter(key)));
    assert.equal(results.filter(Boolean).length, 15);
    const row = await query<{ attempt_count: number }>('select attempt_count from rate_limit_attempts where scope = $1', [scope]);
    assert.equal(row.rows[0].attempt_count, 25);
  } finally {
    await query('delete from rate_limit_attempts where scope = $1', [scope]);
  }
});

test('concurrent checkout retries create one order and notify once; changed payload conflicts', { skip: !hasDb }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const productId = randomUUID(); const variantId = randomUUID(); const checkoutRequestId = randomUUID();
  let notifications = 0;
  const notify = async () => { notifications += 1; };
  const input = { checkoutRequestId, customerName: 'Phase 34', customerPhone: '0900000034', items: [{ variantId, quantity: 1 }] };
  try {
    await client.query("insert into products (id,name,slug,product_type,status) values ($1,'Phase 34',$2,'MADE_TO_ORDER','ACTIVE')", [productId, `phase-34-${productId}`]);
    await client.query("insert into product_variants (id,product_id,sku,name,price) values ($1,$2,$3,'Default',34000)", [variantId, productId, `PHASE34-${variantId.slice(0, 8).toUpperCase()}`]);
    const [first, second] = await Promise.all([createOrder(input, null, { notify }), createOrder(input, null, { notify })]);
    assert.equal(first.id, second.id);
    assert.equal(first.orderNumber, second.orderNumber);
    assert.equal(notifications, 1);
    assert.equal(Number((await client.query('select count(*) from orders where checkout_request_id = $1', [checkoutRequestId])).rows[0].count), 1);
    await assert.rejects(
      createOrder({ ...input, customerName: 'Different payload' }, null, { notify }),
      (error: unknown) => error instanceof DomainError && error.code === 'IDEMPOTENCY_CONFLICT' && error.status === 409,
    );
    assert.equal(notifications, 1);
  } finally {
    await client.query('delete from order_items where order_id in (select id from orders where checkout_request_id = $1)', [checkoutRequestId]);
    await client.query('delete from orders where checkout_request_id = $1', [checkoutRequestId]);
    await client.query('delete from product_variants where id = $1', [variantId]);
    await client.query('delete from products where id = $1', [productId]);
    await client.end();
  }
});
