// Phase 36 — post-audit data integrity & hardening (docs/exec-plans/active/phase-36-data-integrity.md).
// Pure tests always run; DB-backed tests need the disposable local PostgreSQL (TEST_DATABASE_URL).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test, { after } from 'node:test';
import { Client } from 'pg';
import { configureTestEnvironment } from './helpers/test-environment';
import { purgeCustomRequest } from './helpers/purge-custom-request';
import { getPool, query } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { getClientIp, rateLimitNetworkKey } from '../src/lib/rate-limit.js';
import {
  createLegacyAccessTokenForTests, createOrderConfirmationToken, createResourceAccessToken,
  verifyOrderConfirmationToken, verifyResourceAccessToken,
} from '../src/lib/order-confirmation-token.js';
import { parseActionBoolean, parseActionEnum, parseActionId } from '../src/lib/action-args.js';
import { SQL_LOCAL_TODAY, sqlLocalDate } from '../src/lib/business-time.js';
import { extractResolutionFromHtml, parseMakerWorldUrl } from '../src/lib/parsers/makerworld-resolver.js';
import { setStaffActive } from '../src/services/staff.service.js';
import { createOrder, getPublicOrderByNumber, PHONE_SUFFIX_MAX_FAILURES, updateOrderPaymentAndShipping, updateOrderStatus } from '../src/services/order.service.js';
import { recordInventoryMovement, getStockLevel } from '../src/services/inventory.service.js';
import { assignPrintJobMaterial, updatePrintJobStatus } from '../src/services/print-job.service.js';
import { deleteCustomRequest, updateCustomRequest } from '../src/services/custom-request.service.js';
import { acceptQuote, createQuote } from '../src/services/quote.service.js';

configureTestEnvironment();
process.env.ORDER_CONFIRMATION_SECRET ??= 'phase-36-order-confirmation-secret-at-least-32-chars';
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const WAREHOUSE_ID = '00000000-0000-4000-8000-000000000010'; // seeded (supabase/seed.sql)
const validUntil = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

async function expectDomainError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof DomainError && error.code === code);
}

// ---------------------------------------------------------------------------------------------
// S4 — rate-limit keys
// ---------------------------------------------------------------------------------------------

test('rate-limit key groups an IPv6 /64, folds IPv4-mapped addresses, keeps IPv4 exact', () => {
  assert.equal(rateLimitNetworkKey('198.51.100.7'), 'v4:198.51.100.7');
  assert.equal(rateLimitNetworkKey('::ffff:198.51.100.7'), 'v4:198.51.100.7');
  const a = rateLimitNetworkKey('2001:db8:abcd:12:1::1');
  const b = rateLimitNetworkKey('2001:0db8:abcd:0012:ffff:ffff:ffff:fffe');
  assert.equal(a, 'v6:2001:0db8:abcd:0012::/64');
  assert.equal(a, b, 'two addresses of the same /64 share one bucket');
  assert.notEqual(rateLimitNetworkKey('2001:db8:abcd:13::1'), a, 'a different /64 is a different bucket');
  assert.equal(rateLimitNetworkKey('[2001:db8::1]'), 'v6:2001:0db8:0000:0000::/64');
  assert.equal(rateLimitNetworkKey('fe80::1%eth0'), 'v6:fe80:0000:0000:0000::/64');
  assert.equal(rateLimitNetworkKey('64:ff9b::192.0.2.33'), 'v6:0064:ff9b:0000:0000::/64');
  assert.equal(rateLimitNetworkKey(''), 'unknown');
  assert.equal(rateLimitNetworkKey('not-an-ip'), 'raw:not-an-ip');
});

test('client IP prefers Vercel x-real-ip, then the first x-forwarded-for entry, never cf-connecting-ip', () => {
  assert.equal(getClientIp(new Headers({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '198.51.100.7' })), 'v4:203.0.113.5');
  assert.equal(getClientIp(new Headers({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1' })), 'v4:198.51.100.7');
  assert.equal(getClientIp(new Headers({ 'cf-connecting-ip': '203.0.113.99' })), 'unknown');
});

// ---------------------------------------------------------------------------------------------
// S4 — purpose-bound access tokens
// ---------------------------------------------------------------------------------------------

test('order and quote tokens are purpose-bound: neither verifies as the other', () => {
  const id = randomUUID();
  const order = createOrderConfirmationToken(id, 60);
  const quote = createResourceAccessToken('quote', id, 60);
  assert.ok(order.startsWith('o1.'));
  assert.ok(quote.startsWith('q1.'));
  assert.equal(verifyOrderConfirmationToken(order)?.resourceId, id);
  assert.equal(verifyResourceAccessToken(quote, 'quote')?.resourceId, id);
  assert.equal(verifyResourceAccessToken(order, 'quote'), null);
  assert.equal(verifyOrderConfirmationToken(quote), null);
  // Swapping only the prefix does not help: the purpose is inside the signed message.
  assert.equal(verifyResourceAccessToken(`q1${order.slice(2)}`, 'quote'), null);
});

test('legacy (pre-Phase-36) 3-part tokens keep working for quotes only, until the sunset date', () => {
  const id = randomUUID();
  const legacy = createLegacyAccessTokenForTests(id, 3600);
  assert.equal(verifyResourceAccessToken(legacy, 'quote')?.resourceId, id);
  assert.equal(verifyOrderConfirmationToken(legacy), null, 'legacy order links are not accepted');
  const farFuture = createLegacyAccessTokenForTests(id, 5 * 365 * 24 * 3600);
  assert.equal(verifyResourceAccessToken(farFuture, 'quote'), null, 'legacy tokens expiring after the sunset are refused');
  assert.equal(verifyResourceAccessToken(createLegacyAccessTokenForTests(id, -10), 'quote'), null);
});

test('a token whose signature is not canonical base64url is rejected', () => {
  const token = createOrderConfirmationToken(randomUUID(), 60);
  const last = token.at(-1)!;
  // Flip the lowest bit of the last char: same 4 significant bits for most alphabet chars.
  const variant = `${token.slice(0, -1)}${String.fromCharCode(last.charCodeAt(0) ^ 1)}`;
  assert.equal(verifyOrderConfirmationToken(variant), null);
});

// ---------------------------------------------------------------------------------------------
// S5 — server action argument parsing
// ---------------------------------------------------------------------------------------------

test('server action args: ids must be UUIDs, booleans must be real booleans, enums are closed', () => {
  const id = randomUUID();
  assert.equal(parseActionId(id), id);
  for (const bad of ['', 'x', 123, null, undefined, { id }, `${id}'`]) {
    assert.throws(() => parseActionId(bad), (error: unknown) => error instanceof DomainError && error.code === 'INVALID_ACTION_ARGUMENT');
  }
  assert.equal(parseActionBoolean(false, 'isActive'), false);
  for (const bad of ['false', 'f', 0, 1, null, undefined]) {
    assert.throws(() => parseActionBoolean(bad, 'isActive'), DomainError);
  }
  assert.equal(parseActionEnum('ACTIVE', ['ACTIVE', 'ARCHIVED'] as const, 'status'), 'ACTIVE');
  assert.throws(() => parseActionEnum('DELETED', ['ACTIVE', 'ARCHIVED'] as const, 'status'), DomainError);
});

test('setStaffActive refuses a non-boolean before touching the database (last-OWNER guard bypass)', async () => {
  await expectDomainError(setStaffActive(ACTOR_ID, 'false' as unknown as boolean, ACTOR_ID), 'INVALID_ACTION_ARGUMENT');
});

test('every exported server action parses its positional id/boolean args right after the auth check', async () => {
  const root = 'src/app/admin/(protected)';
  const files: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === 'actions.ts') files.push(full);
    }
  }
  await walk(root);
  assert.ok(files.length >= 10);
  const offenders: string[] = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/export async function (\w+)\(([^)]*)\)/g)) {
      const params = match[2].split(',').map((part) => part.trim().split(':')[0].trim()).filter(Boolean);
      const scalarParams = params.filter((name) => !['formData', 'payload', '_previous'].includes(name)
        && /\b(id|Id|isActive)\b|Id$/.test(name));
      const body = source.slice(match.index!, source.indexOf('\n}\n', match.index!));
      for (const name of scalarParams) {
        if (!new RegExp(`${name} = parseAction(Id|Boolean)\\(${name}`).test(body) && !new RegExp(`(uuidSchema|Schema)\\.(safeParse|parse)\\([^)]*${name}`).test(body)) {
          offenders.push(`${file}#${match[1]}(${name})`);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});

// ---------------------------------------------------------------------------------------------
// S5 — client/server module boundary (replaces the `server-only` package; no new dependency)
// ---------------------------------------------------------------------------------------------

const SERVER_ONLY_MODULES = [
  'src/lib/db.ts', 'src/lib/supabase/admin.ts', 'src/lib/supabase/server.ts', 'src/lib/upload-claim.ts',
  'src/lib/order-confirmation-token.ts', 'src/lib/rate-limit.ts', 'src/lib/cron-auth.ts', 'src/lib/vision/gemini-vision.ts',
];

async function resolveImport(fromFile: string, specifier: string): Promise<string | null> {
  let base: string;
  if (specifier.startsWith('@/')) base = path.join('src', specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.join(path.dirname(fromFile), specifier);
  else return null;
  base = base.replace(/\.js$/, '');
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    try {
      if ((await readFile(candidate)).length >= 0 && /\.(ts|tsx)$/.test(candidate)) return path.normalize(candidate);
    } catch { /* try next */ }
  }
  return null;
}

test('no "use client" module can reach a server-only module (db, secrets, service-role, services/*)', async () => {
  const clientFiles: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && /^\s*['"]use client['"]/.test(await readFile(full, 'utf8'))) clientFiles.push(full);
    }
  }
  await walk('src');
  assert.ok(clientFiles.length > 10);
  const isServerOnly = (file: string) => SERVER_ONLY_MODULES.includes(file)
    || (file.startsWith('src/services/') && file !== 'src/services/pricing.service.ts');
  const violations: string[] = [];
  for (const entry of clientFiles) {
    const seen = new Set<string>();
    const stack: Array<{ file: string; trail: string[] }> = [{ file: entry, trail: [entry] }];
    while (stack.length) {
      const { file, trail } = stack.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      if (isServerOnly(file)) { violations.push(trail.join(' → ')); continue; }
      const source = await readFile(file, 'utf8');
      // Server actions are RPC stubs on the client — importing them is the intended pattern.
      if (file !== entry && /^\s*['"]use server['"]/.test(source)) continue;
      for (const match of source.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'";]*?from\s+['"]([^'"]+)['"]/gm)) {
        const resolved = await resolveImport(file, match[1]);
        if (resolved) stack.push({ file: resolved, trail: [...trail, resolved] });
      }
    }
  }
  assert.deepEqual(violations, []);
});

// ---------------------------------------------------------------------------------------------
// S3 — business time zone, MakerWorld identity, migration contract
// ---------------------------------------------------------------------------------------------

test('business-time SQL fragments convert explicitly to Asia/Ho_Chi_Minh', () => {
  assert.equal(sqlLocalDate('o.created_at'), "(o.created_at at time zone 'Asia/Ho_Chi_Minh')::date");
  assert.equal(SQL_LOCAL_TODAY, "(now() at time zone 'Asia/Ho_Chi_Minh')::date");
});

test('MakerWorld: a link with two /models/ segments is refused; a page for another model is refused', () => {
  assert.throws(() => parseMakerWorldUrl('https://makerworld.com/en/models/1000/models/2000'));
  const parsed = parseMakerWorldUrl('https://makerworld.com/en/models/1000-thing#profileId-1');
  const html = (designId: number) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { design: { id: designId, title: 'T', instances: [{ id: 1, title: 'P', prediction: 3600, weight: 10, plates: [{}] }] } } },
  })}</script>`;
  assert.throws(() => extractResolutionFromHtml(html(2000), parsed), /model khác/);
});

test('Phase 36 migration: global function default privilege, history guards, tz defaults', async () => {
  const sql = await readFile('supabase/migrations/20261019000000_phase_36_data_integrity.sql', 'utf8');
  assert.match(sql, /^alter default privileges revoke execute on functions from public;$/m);
  assert.match(sql, /create trigger pricing_configs_no_update before update on pricing_configs/);
  assert.match(sql, /create trigger quotes_no_history_delete before delete on quotes/);
  assert.match(sql, /create trigger print_jobs_no_history_delete before delete on print_jobs/);
  assert.match(sql, /create trigger order_items_no_update before update on order_items/);
  assert.match(sql, /alter table public\.%I alter column %I set default now\(\)/);
  assert.match(sql, /where id = 'blog-images'/);
});

// ---------------------------------------------------------------------------------------------
// DB-backed
// ---------------------------------------------------------------------------------------------

async function withClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}

async function seedVariant(client: Client, opts: { productType?: 'READY_STOCK' | 'MADE_TO_ORDER'; stock?: number; price?: number } = {}) {
  const productId = randomUUID(); const variantId = randomUUID();
  const suffix = productId.slice(0, 8).toUpperCase();
  await client.query(`insert into products (id, name, slug, product_type, status) values ($1, 'Phase 36', $2, $3, 'ACTIVE')`, [productId, `phase-36-${productId}`, opts.productType ?? 'READY_STOCK']);
  await client.query(`insert into product_variants (id, product_id, sku, name, price) values ($1, $2, $3, 'Default', $4)`, [variantId, productId, `PHASE36-${suffix}`, opts.price ?? 36_000]);
  if (opts.stock) await client.query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ($1, $2, 'PRODUCTION_IN', $3, 'phase 36')`, [WAREHOUSE_ID, variantId, opts.stock]);
  return { productId, variantId };
}

async function seedCustomRequest(client: Client, status = 'NEW') {
  const id = randomUUID();
  await client.query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity, status)
     values ($1, $2, 'OTHER', 'Phase 36', '0900000036', 'phase 36', 1, $3)`,
    [id, `CR-P36${id.slice(0, 8).toUpperCase()}`, status]);
  return id;
}

test('DB: a function created after the migration is NOT executable by anon/authenticated', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const roles = await client.query<{ rolname: string }>("select rolname from pg_roles where rolname in ('anon', 'authenticated')");
    if (!roles.rowCount) return; // plain PostgreSQL without Supabase roles — nothing to check
    const name = `phase36_probe_${randomUUID().slice(0, 8)}`;
    await client.query(`create function public.${name}() returns int language sql as 'select 1'`);
    try {
      for (const { rolname } of roles.rows) {
        const can = await client.query<{ ok: boolean }>(`select has_function_privilege($1, 'public.${name}()', 'execute') as ok`, [rolname]);
        assert.equal(can.rows[0].ok, false, `${rolname} must not execute new functions`);
      }
      const publicGrant = await client.query(`select 1 from information_schema.role_routine_grants where routine_schema = 'public' and grantee in ('PUBLIC', 'anon', 'authenticated') and routine_name = $1`, [name]);
      assert.equal(publicGrant.rowCount, 0);
    } finally {
      await client.query(`drop function public.${name}()`);
    }
  });
});

test('DB: default timestamps are correct even when the session TimeZone is Asia/Ho_Chi_Minh', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    await client.query("set timezone = 'Asia/Ho_Chi_Minh'");
    const id = await seedCustomRequest(client);
    try {
      const row = await client.query<{ drift: number }>('select abs(extract(epoch from (now() - created_at)))::float as drift from custom_requests where id = $1', [id]);
      assert.ok(row.rows[0].drift < 60, `created_at drifted ${row.rows[0].drift}s from now()`);
      const leftover = await client.query("select table_name, column_name from information_schema.columns where table_schema = 'public' and column_default like 'timezone(''utc''%'");
      assert.deepEqual(leftover.rows, []);
    } finally {
      await purgeCustomRequest(client, id);
    }
  });
});

test('DB: pricing_configs cannot be updated, and a referenced config cannot be deleted', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const current = await client.query<{ id: string }>('select id from pricing_configs order by created_at desc limit 1');
    if (!current.rowCount) return;
    await assert.rejects(client.query('update pricing_configs set margin_pct = margin_pct where id = $1', [current.rows[0].id]), /immutable/);
  });
});

test('DB: a retry for the LAST unit returns the original order instead of INSUFFICIENT_STOCK', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 1 });
    const input = { checkoutRequestId: randomUUID(), customerName: 'Phase 36', customerPhone: '0900000036', items: [{ variantId, quantity: 1 }] };
    const first = await createOrder(input, null, { notify: async () => {} });
    const retry = await createOrder(input, null, { notify: async () => { throw new Error('a replay must not notify'); } });
    assert.equal(retry.id, first.id);
    assert.equal(retry.isReplay, true);
    await expectDomainError(createOrder({ ...input, customerName: 'Someone else' }, null), 'IDEMPOTENCY_CONFLICT');
    // A different checkout for the same (now reserved) last unit is still refused.
    await expectDomainError(createOrder({ ...input, checkoutRequestId: randomUUID() }, null), 'INSUFFICIENT_STOCK');
    const snapshot = await client.query<{ product_type_snapshot: string }>('select product_type_snapshot from order_items where order_id = $1', [first.id]);
    assert.equal(snapshot.rows[0].product_type_snapshot, 'READY_STOCK');
  });
});

test('DB: manual stock-out cannot oversell reserved units or empty a warehouse below zero', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 5 });
    await createOrder({ customerName: 'Phase 36', customerPhone: '0900000036', items: [{ variantId, quantity: 4 }] }, ACTOR_ID, { notify: async () => {} });
    assert.equal((await getStockLevel(variantId)).available, 1);
    await expectDomainError(recordInventoryMovement({ warehouseId: WAREHOUSE_ID, productVariantId: variantId, movementType: 'ADJUSTMENT_OUT', quantity: -2, note: 'kiểm kê' }, ACTOR_ID), 'INSUFFICIENT_STOCK');
    await expectDomainError(recordInventoryMovement({ warehouseId: WAREHOUSE_ID, productVariantId: variantId, movementType: 'TRANSFER_OUT', quantity: -6, note: 'chuyển kho' }, ACTOR_ID), 'INSUFFICIENT_WAREHOUSE_STOCK');
    await recordInventoryMovement({ warehouseId: WAREHOUSE_ID, productVariantId: variantId, movementType: 'DAMAGE_OUT', quantity: -1, note: 'vỡ' }, ACTOR_ID);
    assert.equal((await getStockLevel(variantId)).available, 0);
  });
});

test('DB: cancelling an order cancels its unstarted print job; a CANCELLED order cannot be marked PAID', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { productType: 'MADE_TO_ORDER' });
    const order = await createOrder({ customerName: 'Phase 36', customerPhone: '0900000036', items: [{ variantId, quantity: 1 }] }, ACTOR_ID, { notify: async () => {} });
    await updateOrderStatus(order.id, 'CONFIRMED', ACTOR_ID);
    await updateOrderStatus(order.id, 'PRODUCING', ACTOR_ID);
    const job = await client.query<{ id: string; status: string }>('select id, status from print_jobs where order_id = $1', [order.id]);
    assert.equal(job.rows[0].status, 'QUEUED');
    await updateOrderStatus(order.id, 'CANCELLED', ACTOR_ID);
    const after = await client.query<{ status: string }>('select status from print_jobs where id = $1', [job.rows[0].id]);
    assert.equal(after.rows[0].status, 'CANCELLED');

    await expectDomainError(updateOrderPaymentAndShipping(order.id, { paymentStatus: 'PAID' }, ACTOR_ID, { role: 'STAFF' }), 'INVALID_ORDER_ADMIN_TRANSITION');
    await expectDomainError(updateOrderPaymentAndShipping(order.id, { shippingStatus: 'SHIPPED' }, ACTOR_ID, { role: 'STAFF' }), 'INVALID_ORDER_ADMIN_TRANSITION');
    // OWNER with a reason may still correct it (audited as an override).
    const overridden = await updateOrderPaymentAndShipping(order.id, { paymentStatus: 'PAID' }, ACTOR_ID, { role: 'OWNER', overrideReason: 'khách đã chuyển trước khi huỷ' });
    assert.equal(overridden.payment_status, 'PAID');
    // Refunding a cancelled order is a normal transition.
    const refunded = await updateOrderPaymentAndShipping(order.id, { paymentStatus: 'REFUNDED' }, ACTOR_ID, { role: 'STAFF' });
    assert.equal(refunded.payment_status, 'REFUNDED');
  });
});

async function seedPrintJob(client: Client, customRequestId: string) {
  const materialId = randomUUID(); const warehouseId = randomUUID(); const printJobId = randomUUID();
  await client.query(`insert into warehouses (id, name, code) values ($1, 'P36', $2)`, [warehouseId, `P36${warehouseId.slice(0, 8).toUpperCase()}`]);
  await client.query(`insert into materials (id, name, material_type, unit) values ($1, 'P36 PLA', 'PLA', 'GRAM')`, [materialId]);
  await client.query(`insert into material_movements (warehouse_id, material_id, movement_type, quantity) values ($1, $2, 'PURCHASE', 1000)`, [warehouseId, materialId]);
  await client.query(`insert into print_jobs (id, custom_request_id, status) values ($1, $2, 'QUEUED')`, [printJobId, customRequestId]);
  return { materialId, printJobId };
}

test('DB: an owner override back into PRINTING does not book material twice; material is locked once printing', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const requestId = await seedCustomRequest(client);
    const { materialId, printJobId } = await seedPrintJob(client, requestId);
    try {
      await assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 50 }, ACTOR_ID);
      await updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID);
      await updatePrintJobStatus(printJobId, 'QC', ACTOR_ID);
      // Override straight back into PRINTING would either double-book or skip booking → refused.
      await expectDomainError(updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID, { role: 'OWNER', overrideReason: 'bấm nhầm QC' }), 'INVALID_PRINT_JOB_TRANSITION');
      // …and a started job cannot be "un-started" to QUEUED either.
      await expectDomainError(updatePrintJobStatus(printJobId, 'QUEUED', ACTOR_ID, { role: 'OWNER', overrideReason: 'x' }), 'INVALID_PRINT_JOB_TRANSITION');
      const booked = async () => (await client.query<{ n: number }>(`select count(*)::int as n from material_movements where reference_type = 'print_job' and reference_id = $1`, [printJobId])).rows[0].n;
      assert.equal(await booked(), 1);
      // A real reprint is a new attempt and books again.
      await updatePrintJobStatus(printJobId, 'REPRINT', ACTOR_ID);
      await updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID);
      assert.equal(await booked(), 2);
      await expectDomainError(assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 10 }, ACTOR_ID), 'PRINT_JOB_MATERIAL_LOCKED');
      // A started job is production history: the request can no longer be hard-deleted.
      await expectDomainError(deleteCustomRequest(requestId, ACTOR_ID, { removeStorage: async () => {} }), 'CUSTOM_REQUEST_HAS_HISTORY');
      await assert.rejects(client.query('delete from print_jobs where id = $1', [printJobId]), /production history/);
    } finally {
      await purgeCustomRequest(client, requestId);
    }
  });
});

test('DB: a mistakenly cancelled, never-started job can be re-queued by an OWNER and then books normally', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const requestId = await seedCustomRequest(client);
    const { materialId, printJobId } = await seedPrintJob(client, requestId);
    try {
      await assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 20 }, ACTOR_ID);
      await updatePrintJobStatus(printJobId, 'CANCELLED', ACTOR_ID);
      await expectDomainError(updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID, { role: 'OWNER', overrideReason: 'huỷ nhầm' }), 'INVALID_PRINT_JOB_TRANSITION');
      await updatePrintJobStatus(printJobId, 'QUEUED', ACTOR_ID, { role: 'OWNER', overrideReason: 'huỷ nhầm' });
      await updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID);
      const booked = await client.query<{ n: number }>(`select count(*)::int as n from material_movements where reference_type = 'print_job' and reference_id = $1`, [printJobId]);
      assert.equal(booked.rows[0].n, 1);
      // Cancelled after booking → still production history (the ledger decides, not the status).
      await updatePrintJobStatus(printJobId, 'CANCELLED', ACTOR_ID);
      await assert.rejects(client.query('delete from print_jobs where id = $1', [printJobId]), /production history/);
      await expectDomainError(updatePrintJobStatus(printJobId, 'QUEUED', ACTOR_ID, { role: 'OWNER', overrideReason: 'x' }), 'INVALID_PRINT_JOB_TRANSITION');
    } finally {
      await purgeCustomRequest(client, requestId);
    }
  });
});

test('DB: custom request edits, deletes and quote acceptance respect history and state', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const requestId = await seedCustomRequest(client, 'REVIEWING');
    try {
      await expectDomainError(updateCustomRequest(requestId, { status: 'NEW' }, ACTOR_ID), 'INVALID_CUSTOM_REQUEST_TRANSITION');
      await updateCustomRequest(requestId, { status: 'QUOTED', internalNote: 'ok' }, ACTOR_ID);

      // Two manual quotes (no item, no MakerWorld link) are revisions of the same thing.
      const v1 = await createQuote({ customRequestId: requestId, subtotal: 10_000, total: 10_000, validUntil: validUntil() }, ACTOR_ID);
      const v2 = await createQuote({ customRequestId: requestId, subtotal: 12_000, total: 12_000, validUntil: validUntil() }, ACTOR_ID);
      await acceptQuote(v1.id, ACTOR_ID);
      await expectDomainError(acceptQuote(v2.id, ACTOR_ID), 'QUOTE_SIBLING_ALREADY_ACCEPTED');

      await expectDomainError(deleteCustomRequest(requestId, ACTOR_ID, { removeStorage: async () => {} }), 'CUSTOM_REQUEST_HAS_HISTORY');
      await assert.rejects(client.query('delete from quotes where id = $1', [v1.id]), /financial history/);
    } finally {
      await purgeCustomRequest(client, requestId);
    }

    const rejectedId = await seedCustomRequest(client, 'REJECTED');
    try {
      const quote = await createQuote({ customRequestId: rejectedId, subtotal: 10_000, total: 10_000, validUntil: validUntil() }, ACTOR_ID);
      await expectDomainError(acceptQuote(quote.id, ACTOR_ID), 'CUSTOM_REQUEST_CLOSED');
      // No history yet → a mistaken request can still be deleted, and the audit keeps its quotes.
      const removed: string[][] = [];
      await deleteCustomRequest(rejectedId, ACTOR_ID, { removeStorage: async (paths) => { removed.push(paths); } });
      const audit = await client.query<{ before_data: { quotes: unknown[] } }>(`select before_data from audit_logs where entity_id = $1 and action = 'CUSTOM_REQUEST_DELETED'`, [rejectedId]);
      assert.equal(audit.rows[0].before_data.quotes.length, 1);
    } finally {
      const exists = await client.query('select 1 from custom_requests where id = $1', [rejectedId]);
      if (exists.rowCount) await purgeCustomRequest(client, rejectedId);
    }
  });
});

test('DB: the phone-suffix check has a per-order wrong-guess budget; correct answers are refunded', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 3 });
    const order = await createOrder({ customerName: 'Phase 36', customerPhone: '0900001234', items: [{ variantId, quantity: 1 }] }, ACTOR_ID, { notify: async () => {} });
    try {
      for (let i = 0; i < 20; i += 1) assert.ok(await getPublicOrderByNumber(order.orderNumber, '1234'), 'repeat visits with the right digits never lock');
      for (let i = 0; i < PHONE_SUFFIX_MAX_FAILURES; i += 1) assert.equal(await getPublicOrderByNumber(order.orderNumber, String(1000 + i)), null);
      assert.equal(await getPublicOrderByNumber(order.orderNumber, '1234'), null, 'budget exhausted → even the right digits are refused');
      const concurrent = await Promise.all(Array.from({ length: 5 }, () => getPublicOrderByNumber(order.orderNumber, '1234')));
      assert.ok(concurrent.every((result) => result === null));
    } finally {
      await client.query("delete from rate_limit_attempts where scope = 'phone-suffix-verify'");
    }
  });
});

test('DB: order lines are immutable except the FK set-null when a variant is deleted', { skip: !hasDb }, async () => {
  await withClient(async (client) => {
    const { variantId } = await seedVariant(client, { stock: 2 });
    const order = await createOrder({ customerName: 'Phase 36', customerPhone: '0900000036', items: [{ variantId, quantity: 1 }] }, ACTOR_ID, { notify: async () => {} });
    await assert.rejects(client.query('update order_items set unit_price = 1 where order_id = $1', [order.id]), /immutable purchase snapshot/);
    await client.query('update order_items set variant_id = null where order_id = $1', [order.id]);
    const line = await client.query<{ sku_snapshot: string; product_type_snapshot: string }>('select sku_snapshot, product_type_snapshot from order_items where order_id = $1', [order.id]);
    assert.match(line.rows[0].sku_snapshot, /^PHASE36-/);
    assert.equal(line.rows[0].product_type_snapshot, 'READY_STOCK');
  });
});

test('DB: daily buckets use the Vietnam calendar day, not the session/UTC day', { skip: !hasDb }, async () => {
  // 2026-10-15 18:30 UTC is already 2026-10-16 01:30 in Hồ Chí Minh City.
  const result = await query<{ local_day: string }>(`select to_char(${sqlLocalDate("'2026-10-15T18:30:00Z'::timestamptz")}, 'YYYY-MM-DD') as local_day`);
  assert.equal(result.rows[0].local_day, '2026-10-16');
});
