import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test, { after } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { Client } from 'pg';
import { serializeJsonLd } from '../src/lib/json-ld.js';
import { sanitizeAnalyticsUrl } from '../src/lib/analytics.js';
import { DomainError } from '../src/lib/domain-error.js';
import { parseThreeMfSliceInfo, MAX_SLICE_INFO_BYTES } from '../src/lib/parsers/threemf-slice-info.js';
import { parseThreeMfMeshVolume } from '../src/lib/parsers/mesh-volume.js';
import { publicCheckoutOrderInputSchema, PUBLIC_CHECKOUT_MAX_ITEMS } from '../src/domain/schemas.js';

const hasDb = Boolean(process.env.DATABASE_URL);

after(async () => {
  if (hasDb) {
    const { getPool } = await import('../src/lib/db.js');
    await getPool().end();
  }
});

const isDomainError = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;

// ---------------------------------------------------------------- S1
test('every protected admin page enforces requireAdmin/requireOwner itself (not only the layout)', async () => {
  const root = path.join(process.cwd(), 'src/app/admin/(protected)');
  const pages: string[] = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === 'page.tsx') pages.push(full);
    }
  };
  await walk(root);
  assert.ok(pages.length >= 20, `expected many admin pages, found ${pages.length}`);
  for (const page of pages) {
    const source = await readFile(page, 'utf8');
    assert.match(source, /await (?:requireAdmin|requireOwner)\(\)|\b(?:requireAdmin|requireOwner)\(\),/, `${path.relative(root, page)} must call requireAdmin()/requireOwner()`);
  }
});

// ---------------------------------------------------------------- S2
test('serializeJsonLd cannot be broken out of a <script> block and stays valid JSON', () => {
  const value = { name: '</script><script>alert(1)</script>', note: 'a & b \u2028 c <!--' };
  const serialized = serializeJsonLd(value);
  assert.doesNotMatch(serialized, /<|>|&|\u2028|\u2029/);
  assert.deepEqual(JSON.parse(serialized), value);
});

test('sanitizeAnalyticsUrl strips bearer tokens and phone digits, keeps other params', () => {
  assert.equal(
    sanitizeAnalyticsUrl('https://basa3d.vn/order-confirmation/ORD-ABC?token=secret.sig&utm_source=zalo#x'),
    'https://basa3d.vn/order-confirmation/ORD-ABC?utm_source=zalo',
  );
  assert.equal(sanitizeAnalyticsUrl('/quotes/Q-1?phoneSuffix=1234&token=t'), '/quotes/Q-1');
  assert.equal(sanitizeAnalyticsUrl('/products?page=2'), '/products?page=2');
  assert.equal(sanitizeAnalyticsUrl(''), '');
});

// ---------------------------------------------------------------- S3
test('slice_info larger than the cap is rejected before allocation (zip bomb)', () => {
  const huge = new Uint8Array(MAX_SLICE_INFO_BYTES + 1); // zeros compress to a few KB
  const archive = zipSync({ 'Metadata/slice_info.config': huge });
  assert.ok(archive.length < 100_000, 'fixture must be a small compressed file');
  assert.throws(() => parseThreeMfSliceInfo(archive), isDomainError('3MF_SLICE_INFO_TOO_LARGE'));
});

test('slice_info XML entities are not expanded', () => {
  const xml = `<?xml version="1.0"?><!DOCTYPE c [<!ENTITY a "aaaaaaaaaa">]><config><plate><metadata key="index" value="1"/><metadata key="prediction" value="60"/><filament id="1" type="PLA" color="&a;" used_g="5"/></plate></config>`;
  const parsed = parseThreeMfSliceInfo(zipSync({ 'Metadata/slice_info.config': strToU8(xml) }));
  assert.equal(parsed.plates[0].filaments[0].color, '&a;');
});

function cubeModel(size: number): string {
  const s = size;
  const v = [[0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0], [0, 0, s], [s, 0, s], [s, s, s], [0, s, s]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return `<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${
    v.map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join('')
  }</vertices><triangles>${t.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join('')}</triangles></mesh></object><components/></resources><build><item objectid="1"/></build></model>`;
}

test('3mf mesh volume still computes a simple cube correctly after the scanner rewrite', () => {
  const result = parseThreeMfMeshVolume(zipSync({ '3D/3dmodel.model': strToU8(cubeModel(20)) }));
  assert.ok(Math.abs(result.volumeCm3 - 8) < 1e-9, `got ${result.volumeCm3}`);
  assert.equal(result.triangles, 12);
});

test('3mf with many unclosed <object> tags fails fast instead of O(n²) regex scanning', () => {
  const xml = `<model><resources>${'<object id="1"><mesh>'.repeat(200_000)}</resources></model>`;
  const startedAt = performance.now();
  assert.throws(() => parseThreeMfMeshVolume(zipSync({ '3D/3dmodel.model': strToU8(xml) })), isDomainError('MESH_INVALID'));
  assert.ok(performance.now() - startedAt < 2_000, 'must not be quadratic');
});

test('3mf triangle referencing a missing vertex is rejected', () => {
  const xml = cubeModel(10).replace('<triangle v1="0" v2="2" v3="1"/>', '<triangle v1="0" v2="2" v3="99"/>');
  assert.throws(() => parseThreeMfMeshVolume(zipSync({ '3D/3dmodel.model': strToU8(xml) })), isDomainError('MESH_INVALID'));
});

// ---------------------------------------------------------------- S4
test('public checkout schema caps the number of cart lines', () => {
  const base = { checkoutRequestId: randomUUID(), customerName: 'A', customerPhone: '0900000000' };
  const line = () => ({ variantId: randomUUID(), quantity: 1 });
  assert.equal(publicCheckoutOrderInputSchema.safeParse({ ...base, items: Array.from({ length: PUBLIC_CHECKOUT_MAX_ITEMS }, line) }).success, true);
  assert.equal(publicCheckoutOrderInputSchema.safeParse({ ...base, items: Array.from({ length: PUBLIC_CHECKOUT_MAX_ITEMS + 1 }, line) }).success, false);
});

test('public order route refuses requests while the cart is disabled', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/app/api/public/orders/route.ts'), 'utf8');
  assert.match(source, /if \(!SITE_CONFIG\.cartEnabled\) return NextResponse\.json\([^)]*\{ status: 404/);
});

test('anonymous checkout rejects DRAFT/ARCHIVED products and inactive variants', { skip: !hasDb }, async () => {
  const { createOrder } = await import('../src/services/order.service.js');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const productId = randomUUID(); const variantId = randomUUID();
  const notify = async () => {};
  try {
    await client.query("insert into products (id,name,slug,product_type,status) values ($1,'Phase 35 Draft',$2,'MADE_TO_ORDER','DRAFT')", [productId, `phase-35-${productId}`]);
    await client.query("insert into product_variants (id,product_id,sku,name,price) values ($1,$2,$3,'Default',35000)", [variantId, productId, `PHASE35-${variantId.slice(0, 8)}`]);
    const input = { checkoutRequestId: randomUUID(), customerName: 'Phase 35', customerPhone: '0900000035', items: [{ variantId, quantity: 1 }] };
    await assert.rejects(createOrder(input, null, { notify }), isDomainError('VARIANT_NOT_FOUND'));

    await client.query("update products set status = 'ACTIVE' where id = $1", [productId]);
    await client.query('update product_variants set is_active = false where id = $1', [variantId]);
    await assert.rejects(createOrder({ ...input, checkoutRequestId: randomUUID() }, null, { notify }), isDomainError('VARIANT_NOT_FOUND'));
    assert.equal(Number((await client.query('select count(*) from order_items where variant_id = $1', [variantId])).rows[0].count), 0);
  } finally {
    await client.query('delete from product_variants where id = $1', [variantId]);
    await client.query('delete from products where id = $1', [productId]);
    await client.end();
  }
});

// ---------------------------------------------------------------- S5
test('phase 35 migration creates product-images bucket, TRUNCATE guards and revokes function EXECUTE', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261017000000_phase_35_db_hardening.sql', import.meta.url), 'utf8');
  assert.match(migration, /values \('product-images', 'product-images', true\)\s+on conflict \(id\) do nothing/);
  for (const table of ['inventory_movements', 'material_movements', 'audit_logs', 'custom_request_items']) {
    assert.match(migration, new RegExp(`before truncate on ${table}\\s+for each statement`));
  }
  assert.match(migration, /revoke execute on all functions in schema public from public;/);
  assert.match(migration, /alter function prevent_ledger_mutation\(\) set search_path = ''/);
});

test('ledger tables reject TRUNCATE once phase 35 migration is applied', { skip: !hasDb }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    await assert.rejects(client.query('truncate audit_logs'), /immutable/);
  } finally {
    await client.query('rollback').catch(() => {});
    await client.end();
  }
});
