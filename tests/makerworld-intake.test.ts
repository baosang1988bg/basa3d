// Phase B storefront intake (makerworld-phase-b-storefront-estimate.md §4).
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool } from '../src/lib/db.js';
import { publicCustomRequestInputSchema } from '../src/domain/schemas.js';
import { createCustomRequest, getCustomRequestById, type CustomRequestMakerWorldSnapshot } from '../src/services/custom-request.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const base = {
  customerName: 'Khách MakerWorld', customerPhone: '0912345678', description: '[MakerWorld] Frankenstein', quantity: 1,
  copyrightConfirmed: true as const, tosVersion: '2026-09-08',
};
const makerworld = { sourceUrl: 'https://makerworld.com/en/models/3246150#profileId-3678340', profileId: '3678340', tier: 'KIT' as const, profileConfirmed: true as const };

test('public intake accepts the MakerWorld choice', () => {
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld }).success, true);
  assert.equal(publicCustomRequestInputSchema.safeParse(base).success, true, 'makerworld stays optional for the normal form');
});

test('public intake rejects unconfirmed profile, a price from the browser, and non-MakerWorld links', () => {
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld: { ...makerworld, profileConfirmed: false } }).success, false);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld: { ...makerworld, estimatedPriceVnd: 1 } }).success, false);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld: { ...makerworld, sourceUrl: 'https://evil.com/makerworld.com/en/models/1' } }).success, false);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, copyrightConfirmed: false, makerworld }).success, false);
});

test('createCustomRequest persists the server-built MakerWorld snapshot and the Phase 29 consent', { skip: !hasDb }, async () => {
  const snapshot: CustomRequestMakerWorldSnapshot = {
    sourceUrl: makerworld.sourceUrl, modelId: '3246150', profileId: '3678340', modelTitle: 'Frankenstein', profileTitle: '0.2mm layer',
    tier: 'KIT', profileConfirmed: true, estimateSource: 'VERIFIED', estimatedPriceVnd: 131_000, estimatedAt: new Date().toISOString(),
  };
  const created = await createCustomRequest({ ...base, makerworldSnapshot: snapshot, sourceChannel: 'WEBSITE' }, null);
  const detail = await getCustomRequestById(created.id);
  assert.deepEqual(detail?.makerworldSnapshot, snapshot);
  assert.equal(detail?.copyrightConfirmed, true);
  assert.equal(detail?.tosVersion, '2026-09-08');
});
