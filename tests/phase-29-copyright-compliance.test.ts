import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { detectIpRiskKeywords } from '../src/lib/copyright/ip-risk-keywords.js';
import { productInputSchema, productUpdateInputSchema, publicCustomRequestInputSchema, quoteInputSchema } from '../src/domain/schemas.js';
import { createCustomRequest, getCustomRequestById } from '../src/services/custom-request.service.js';
import { createQuote } from '../src/services/quote.service.js';
import { createProduct, updateProduct } from '../src/services/product.service.js';

configureTestEnvironment();
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000bb';

// --- Unit: detectIpRiskKeywords ---------------------------------------------------------------

test('detectIpRiskKeywords matches a known brand/character case-insensitively and accent-insensitively', () => {
  assert.equal(detectIpRiskKeywords('In hộ mình móc khoá logo Pokemon nhé'), true);
  assert.equal(detectIpRiskKeywords('IN MÓC KHOÁ BMW MÀU ĐEN'), true);
  assert.equal(detectIpRiskKeywords('làm giúp mình mô hình Iron Man'), true);
});

test('detectIpRiskKeywords does not false-positive when the keyword is only a substring of another word', () => {
  // "bmw" must not match inside an unrelated word — word-boundary matching, not includes().
  assert.equal(detectIpRiskKeywords('cambodianwear là một thương hiệu quần áo'), false);
  assert.equal(detectIpRiskKeywords('In một cái giá đỡ điện thoại đơn giản, màu trắng'), false);
});

// --- Unit: schemas -----------------------------------------------------------------------------

function basePublicPayload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: 'Test', customerPhone: '0900000000', description: 'Test request', quantity: 1,
    copyrightConfirmed: true as const, tosVersion: '2026-09-08',
    ...overrides,
  };
}

test('publicCustomRequestInputSchema rejects a missing or false copyrightConfirmed', () => {
  const withoutField: Record<string, unknown> = basePublicPayload();
  delete withoutField.copyrightConfirmed;
  assert.equal(publicCustomRequestInputSchema.safeParse(withoutField).success, false);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...basePublicPayload(), copyrightConfirmed: false }).success, false);
});

test('publicCustomRequestInputSchema rejects a missing tosVersion', () => {
  const withoutField: Record<string, unknown> = basePublicPayload();
  delete withoutField.tosVersion;
  assert.equal(publicCustomRequestInputSchema.safeParse(withoutField).success, false);
});

test('publicCustomRequestInputSchema accepts a valid payload with copyrightConfirmed/tosVersion', () => {
  assert.equal(publicCustomRequestInputSchema.safeParse(basePublicPayload()).success, true);
});

test('productInputSchema defaults licenseType to OWN_DESIGN and rejects an unknown license type', () => {
  const base = { categoryId: null, name: 'Test', slug: 'test-product', productType: 'READY_STOCK' as const };
  const parsed = productInputSchema.safeParse(base);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.licenseType, 'OWN_DESIGN');
  assert.equal(productInputSchema.safeParse({ ...base, licenseType: 'SOMETHING_ELSE' }).success, false);
});

test('productInputSchema rejects a non-URL licenseSourceUrl/licenseProofUrl but accepts a valid one', () => {
  const base = { categoryId: null, name: 'Test', slug: 'test-product', productType: 'READY_STOCK' as const };
  assert.equal(productInputSchema.safeParse({ ...base, licenseSourceUrl: 'not-a-url' }).success, false);
  assert.equal(productInputSchema.safeParse({ ...base, licenseSourceUrl: 'https://makerworld.com/en/models/1' }).success, true);
});

test('productUpdateInputSchema leaves license fields untouched when omitted (partial update)', () => {
  const parsed = productUpdateInputSchema.safeParse({ name: 'Renamed' });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal('licenseType' in parsed.data, false);
});

test('quoteInputSchema.ipRiskAcknowledged defaults to false and accepts true', () => {
  const base = { customRequestId: '9f0db9c1-6cc5-4655-9c29-e9208933586a', subtotal: 100_000, total: 100_000, validUntil: new Date() };
  const parsed = quoteInputSchema.safeParse(base);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.ipRiskAcknowledged, false);
  const parsedTrue = quoteInputSchema.safeParse({ ...base, ipRiskAcknowledged: true });
  assert.equal(parsedTrue.success, true);
  if (parsedTrue.success) assert.equal(parsedTrue.data.ipRiskAcknowledged, true);
});

// --- Integration ---------------------------------------------------------------------------

test('createCustomRequest sets ip_risk_flag from the description, and persists copyright_confirmed/tos_version', { skip: !process.env.DATABASE_URL }, async () => {
  const flagged = await createCustomRequest({
    sourceChannel: 'WEBSITE', customerName: 'Test', customerPhone: '0911111111',
    description: 'Làm giúp mình móc khoá logo Pokemon', quantity: 1,
    copyrightConfirmed: true, tosVersion: '2026-09-08',
  }, null);
  const flaggedDetail = await getCustomRequestById(flagged.id);
  assert.equal(flaggedDetail?.ipRiskFlag, true);
  assert.equal(flaggedDetail?.copyrightConfirmed, true);
  assert.equal(flaggedDetail?.tosVersion, '2026-09-08');

  const normal = await createCustomRequest({
    sourceChannel: 'WEBSITE', customerName: 'Test', customerPhone: '0922222222',
    description: 'Cần in một cái giá đỡ điện thoại đơn giản', quantity: 1,
    copyrightConfirmed: true, tosVersion: '2026-09-08',
  }, null);
  const normalDetail = await getCustomRequestById(normal.id);
  assert.equal(normalDetail?.ipRiskFlag, false);
});

test('createQuote rejects a flagged custom request without ipRiskAcknowledged, and accepts it with the flag set', { skip: !process.env.DATABASE_URL }, async () => {
  const customRequestId = randomUUID();
  const suffix = customRequestId.slice(0, 8).toUpperCase();
  await query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity, ip_risk_flag)
     values ($1, $2, 'OTHER', 'IP Risk Test', '0900000000', 'test', 1, true)`,
    [customRequestId, `CR-${suffix}`],
  );
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await assert.rejects(
    createQuote({ customRequestId, subtotal: 100_000, total: 100_000, validUntil }, ACTOR_ID),
    (error: unknown) => error instanceof DomainError && error.code === 'IP_RISK_ACKNOWLEDGEMENT_REQUIRED',
  );

  const quote = await createQuote({ customRequestId, subtotal: 100_000, total: 100_000, validUntil, ipRiskAcknowledged: true }, ACTOR_ID);
  assert.ok(quote.id);
});

test('createQuote for a non-flagged custom request is unaffected (no regression) whether or not ipRiskAcknowledged is sent', { skip: !process.env.DATABASE_URL }, async () => {
  const customRequestId = randomUUID();
  const suffix = customRequestId.slice(0, 8).toUpperCase();
  await query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
     values ($1, $2, 'OTHER', 'Non-flagged Test', '0900000000', 'test', 1)`,
    [customRequestId, `CR-${suffix}`],
  );
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const quote = await createQuote({ customRequestId, subtotal: 50_000, total: 50_000, validUntil }, ACTOR_ID);
  assert.ok(quote.id);
});

test('createProduct/updateProduct persist license fields and default to OWN_DESIGN when omitted', { skip: !process.env.DATABASE_URL }, async () => {
  const slugSuffix = randomUUID().slice(0, 8);
  const product = await createProduct({
    name: `License Test Product ${slugSuffix}`, slug: `license-test-product-${slugSuffix}`,
    productType: 'READY_STOCK', status: 'DRAFT',
    licenseType: 'CC_BY', licenseSourceUrl: 'https://makerworld.com/en/models/1', licenseProofUrl: 'https://example.com/proof.png',
  }, ACTOR_ID);
  const stored = await query<{ license_type: string; license_source_url: string | null; license_proof_url: string | null }>(
    'select license_type, license_source_url, license_proof_url from products where id = $1', [product.id],
  );
  assert.equal(stored.rows[0].license_type, 'CC_BY');
  assert.equal(stored.rows[0].license_source_url, 'https://makerworld.com/en/models/1');
  assert.equal(stored.rows[0].license_proof_url, 'https://example.com/proof.png');

  const defaultProduct = await createProduct({
    name: `License Default Product ${slugSuffix}`, slug: `license-default-product-${slugSuffix}`,
    productType: 'READY_STOCK', status: 'DRAFT',
  }, ACTOR_ID);
  const defaultStored = await query<{ license_type: string }>('select license_type from products where id = $1', [defaultProduct.id]);
  assert.equal(defaultStored.rows[0].license_type, 'OWN_DESIGN');

  await updateProduct(defaultProduct.id, { licenseType: 'COMMERCIAL_LICENSE' }, ACTOR_ID);
  const updated = await query<{ license_type: string }>('select license_type from products where id = $1', [defaultProduct.id]);
  assert.equal(updated.rows[0].license_type, 'COMMERCIAL_LICENSE');
});
