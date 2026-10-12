// makerworld-profile-verification Phase A — multi-profile resolver, image sanitizer, spec-text
// parser, snapshot v1|v2 schema, B10 consistency check, tiers, AMS-aware waste, scoped auto-reject.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, mock } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import {
  MAKERWORLD_LIMITS,
  classifyMakerWorldLicense,
  MakerWorldBlockedOrTimeoutError,
  MakerWorldProfileNotFoundError,
  resolveMakerWorldUrl,
  type FetchLike,
} from '../src/lib/parsers/makerworld-resolver.js';
import { sanitizeMakerWorldImageUrl } from '../src/lib/parsers/makerworld-image.js';
import { parseMakerWorldSpecText } from '../src/lib/parsers/makerworld-spec-text.js';
import { quoteInputSchema, quoteModelSnapshotSchema } from '../src/domain/schemas.js';
import {
  acceptQuote,
  createQuote,
  derivePrintMinutesFromBreakdown,
  isPrintMinutesConsistent,
  readQuoteModelSnapshot,
} from '../src/services/quote.service.js';
import { computePricingBreakdown, type PricingConfigInput } from '../src/services/pricing.service.js';
import { ASSEMBLY_TIERS } from '../src/lib/pricing/assembly-tiers.js';
import { PRINT_SERVICE_POLICY } from '../src/lib/copyright/print-service-policy.js';
import { defaultWasteRatioPctForProfile } from '../src/lib/pricing/smart-waste-estimator.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const MODEL_URL_NO_HASH = 'https://makerworld.com/en/models/3246150-frankenstein-s-monster';
const MODEL_URL_170G = `${MODEL_URL_NO_HASH}#profileId-3678340`;

// Frankenstein's Monster (3246150): the 170g No-AMS P1S/P2S profile vs a 285g profile.
function frankensteinInstances() {
  return [
    {
      id: 3678340,
      title: '0.2mm layer, 2 walls, 15% infill',
      cover: 'https://image.makerworld.com/profiles/3678340-no-ams.jpg',
      printers: ['P1S', 'P2S'],
      plateCount: 6,
      printTimeMinutes: 450,
      needAms: false,
      filaments: [
        { name: 'PLA Basic Green', colorHex: '#3A7D44', type: 'PLA', weightGrams: 120 },
        { name: 'PLA Basic Black', colorHex: '#000000', type: 'PLA', weightGrams: 50 },
      ],
    },
    {
      id: 3600001,
      name: '0.16mm layer, 3 walls, 20% infill',
      coverUrl: 'https://evil.example.com/pixel.gif',
      printerName: 'X1C',
      plateCount: 4,
      printTimeMinutes: 690,
      needAms: true,
      filaments: [{ name: 'PLA Basic Green', colorHex: '#3A7D44', type: 'PLA', weightGrams: 285 }],
    },
  ];
}

function pageHtml(instances: unknown, extra: Record<string, unknown> = {}): string {
  const nextData = { props: { pageProps: { designDetail: { title: "Frankenstein's Monster", coverUrl: 'https://makerworld.com/covers/frank.jpg', instances, ...extra } } } };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;
}

const okFetch = (html: string): FetchLike => async () => new Response(html, { status: 200 });

const config: PricingConfigInput = {
  electricityVndPerKwh: 3_500,
  machinePriceVnd: 15_000_000,
  machineLifetimeHours: 10_000,
  printerPowerKw: 0.2,
  laborVndPerHour: 35_000,
  failureBufferPct: 10,
  marginPct: 40,
  packagingFeeVnd: 5_000,
};

function validV2Snapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    sourceUrl: MODEL_URL_170G,
    title: "Frankenstein's Monster",
    coverImageUrl: 'https://makerworld.com/covers/frank.jpg',
    platesCount: 6,
    totalPrintMinutes: 450,
    colorsCount: 2,
    dataSource: 'RESOLVER',
    profileId: '3678340',
    profileTitle: '0.2mm layer, 2 walls, 15% infill',
    profileCoverImageUrl: 'https://image.makerworld.com/profiles/3678340-no-ams.jpg',
    printerTarget: 'P1S/P2S',
    netWeightGrams: 170,
    amsRequired: false,
    tier: 'ASSEMBLED',
    profileVerified: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------
// Resolver — REAL payload shape (verified on the live page of model 3246150, 2026-10-12)
// ---------------------------------------------------------------------------------------------

// Trimmed copy of the real `props.pageProps.design` shape: `#profileId-<n>` matches instance.id
// (NOT instance.profileId), prediction is SECONDS, weight is total grams, usedG is a string, plates
// live under extention.modelInfo.plates, images on makerworld.bblmw.com.
function realShapeHtml(): string {
  const plates = (n: number) => Array.from({ length: n }, (_, i) => ({ index: i + 1 }));
  const design = {
    title: "Frankenstein's Monster Halloween Version / NO AMS",
    coverUrl: 'https://makerworld.bblmw.com/makerworld/model/USb58f2ee542afc6/design/76e5fa370a72b6c2.png',
    license: 'Standard Digital File License',
    defaultInstanceId: 3678340,
    instances: [
      {
        id: 3678340, profileId: 970500765, title: '0.2mm layer, 2 walls, 15% infill',
        cover: 'https://makerworld.bblmw.com/makerworld/model/USb58f2ee542afc6/970500765/instance/76e5fa370a72b6c2.png',
        prediction: 26571, weight: 168, needAms: false,
        instanceFilaments: [
          { type: 'PLA', color: '#6F5034', usedM: '7.54', usedG: '23' },
          { type: 'PLA', color: '#68724D', usedM: '28.04', usedG: '90' },
          { type: 'PLA', color: '#8E9089', usedM: '8.07', usedG: '25' },
          { type: 'PLA', color: '#042F56', usedM: '6.39', usedG: '21' },
          { type: 'PLA', color: '#000000', usedM: '1.59', usedG: '6' },
          { type: 'PLA', color: '#D1D3D5', usedM: '0.79', usedG: '3' },
        ],
        extention: { modelInfo: { plates: plates(6), compatibility: { devModelName: 'C12', devProductName: 'P1S', nozzleDiameter: 0.4 } } },
      },
      {
        id: 3678348, profileId: 970556084, title: 'a1 mini (0.2mm layer, 2 walls, 15% infill)',
        cover: 'https://makerworld.bblmw.com/makerworld/model/USb58f2ee542afc6/970556084/instance/797bfd0f4c99bc74.png',
        prediction: 31624, weight: 167, needAms: false, instanceFilaments: [{ type: 'PLA', color: '#68724D', usedG: '167' }],
        extention: { modelInfo: { plates: plates(6), compatibility: { devProductName: 'A1 mini' } } },
      },
      {
        id: 3685714, profileId: 973603885, title: 'bolts (0.2mm layer, 2 walls, 15% infill)',
        cover: 'https://makerworld.bblmw.com/makerworld/model/USb58f2ee542afc6/973603885/instance/1571d014bcfe3d4c.jpg',
        prediction: 529, weight: 1, needAms: false, instanceFilaments: [{ type: 'PLA', color: '#000000', usedG: '1' }],
        extention: { modelInfo: { plates: plates(1), compatibility: { devProductName: 'P1S' } } },
      },
    ],
  };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { design } } })}</script>`;
}

test('resolver parses the REAL MakerWorld payload shape (props.pageProps.design, seconds, usedG strings, bblmw CDN)', async () => {
  const resolution = await resolveMakerWorldUrl('https://makerworld.com/en/models/3246150-frankenstein#profileId-3678340', { fetchImpl: okFetch(realShapeHtml()) });
  assert.equal(resolution.modelTitle, "Frankenstein's Monster Halloween Version / NO AMS");
  assert.equal(resolution.modelCoverImageUrl, 'https://makerworld.bblmw.com/makerworld/model/USb58f2ee542afc6/design/76e5fa370a72b6c2.png');
  assert.equal(resolution.activeProfileId, '3678340', '#profileId matches instance.id, not instance.profileId');
  assert.equal(resolution.profiles.length, 3);
  const main = resolution.profiles[0];
  assert.equal(main.profileTitle, '0.2mm layer, 2 walls, 15% infill');
  assert.equal(main.printTimeMinutes, 443); // 26571 s ≈ 7.4 h
  assert.equal(main.platesCount, 6);
  assert.equal(main.netWeightGrams, 168);
  assert.equal(main.amsRequired, false);
  assert.equal(main.printerTarget, 'P1S');
  assert.equal(main.filaments.length, 6);
  assert.equal(main.filaments[1].netWeightGrams, 90);
  assert.equal(main.filaments[1].name, 'PLA #68724D');
  assert.ok(main.profileCoverImageUrl?.startsWith('https://makerworld.bblmw.com/'));
  assert.equal(resolution.license, 'Standard Digital File License');
  assert.equal(resolution.licenseCommercialUse, 'NOT_ALLOWED');
});

test('classifyMakerWorldLicense never claims commercial use is allowed', () => {
  assert.equal(classifyMakerWorldLicense('Standard Digital File License'), 'NOT_ALLOWED');
  assert.equal(classifyMakerWorldLicense('CC BY-NC-SA 4.0'), 'NOT_ALLOWED');
  assert.equal(classifyMakerWorldLicense('CC BY 4.0'), 'UNKNOWN');
  assert.equal(classifyMakerWorldLicense(null), 'UNKNOWN');
});

// ---------------------------------------------------------------------------------------------
// Resolver — multi-profile extraction
// ---------------------------------------------------------------------------------------------

test('resolver returns every profile with profile-specific title/image/printer/AMS and selects the #profileId one', async () => {
  const resolution = await resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: okFetch(pageHtml(frankensteinInstances())) });
  assert.equal(resolution.modelId, '3246150');
  assert.equal(resolution.profiles.length, 2);
  assert.equal(resolution.activeProfileId, '3678340');
  assert.equal(resolution.requestedProfileMissing, false);

  const noAms = resolution.profiles[0];
  assert.equal(noAms.profileId, '3678340');
  assert.equal(noAms.profileTitle, '0.2mm layer, 2 walls, 15% infill');
  assert.equal(noAms.profileCoverImageUrl, 'https://image.makerworld.com/profiles/3678340-no-ams.jpg');
  assert.equal(noAms.printerTarget, 'P1S/P2S');
  assert.equal(noAms.platesCount, 6);
  assert.equal(noAms.printTimeMinutes, 450);
  assert.equal(noAms.netWeightGrams, 170);
  assert.equal(noAms.amsRequired, false);

  const other = resolution.profiles[1];
  assert.equal(other.profileTitle, '0.16mm layer, 3 walls, 20% infill');
  assert.equal(other.profileCoverImageUrl, null, 'non-allowlisted image host must be dropped');
  assert.equal(other.printerTarget, 'X1C');
  assert.equal(other.netWeightGrams, 285);
  assert.equal(other.amsRequired, true);
});

test('resolver does NOT silently pick instances[0] when the URL has no #profileId and the model has >1 profile', async () => {
  const resolution = await resolveMakerWorldUrl(MODEL_URL_NO_HASH, { fetchImpl: okFetch(pageHtml(frankensteinInstances())) });
  assert.equal(resolution.activeProfileId, null);
  assert.equal(resolution.requestedProfileMissing, false);
  assert.equal(resolution.profiles.length, 2);
});

test('resolver auto-selects the only profile when the URL has no #profileId and the model has exactly 1 profile', async () => {
  const resolution = await resolveMakerWorldUrl(MODEL_URL_NO_HASH, { fetchImpl: okFetch(pageHtml([frankensteinInstances()[0]])) });
  assert.equal(resolution.activeProfileId, '3678340');
});

test('resolver marks a profile dataIncomplete when print time or filament grams are missing (no silent 0đ lines)', async () => {
  const noTime = { ...frankensteinInstances()[0], printTimeMinutes: undefined };
  const zeroGram = { ...frankensteinInstances()[1], filaments: [{ name: 'PLA', type: 'PLA' }] };
  const resolution = await resolveMakerWorldUrl(MODEL_URL_NO_HASH, { fetchImpl: okFetch(pageHtml([noTime, zeroGram])) });
  assert.equal(resolution.profiles[0].dataIncomplete, true);
  assert.equal(resolution.profiles[1].dataIncomplete, true);
  const complete = await resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: okFetch(pageHtml(frankensteinInstances())) });
  assert.equal(complete.profiles[0].dataIncomplete, false);
});

test('resolver leaves amsRequired null when the payload does not say', async () => {
  const instance = { ...frankensteinInstances()[0], needAms: undefined };
  const resolution = await resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: okFetch(pageHtml([instance])) });
  assert.equal(resolution.profiles[0].amsRequired, null);
});

test('resolver strips control characters from third-party titles and caps their length', async () => {
  const instance = { ...frankensteinInstances()[0], title: `Evil\u0000\u001b[31m title ${'x'.repeat(500)}` };
  const resolution = await resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: okFetch(pageHtml([instance])) });
  const title = resolution.profiles[0].profileTitle;
  assert.equal([...title].some((char) => char.charCodeAt(0) < 0x20), false);
  assert.ok(title.length <= MAKERWORLD_LIMITS.maxTitleLength);
});

test('resolver rejects non-numeric print time (would be NaN in pricing) with PROFILE_NOT_FOUND, not a crash', async () => {
  const instance = { ...frankensteinInstances()[0], printTimeMinutes: 'abc' };
  await assert.rejects(resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: okFetch(pageHtml([instance])) }), MakerWorldProfileNotFoundError);
});

test('resolver rejects out-of-bounds values (print time > limit)', async () => {
  const instance = { ...frankensteinInstances()[0], printTimeMinutes: MAKERWORLD_LIMITS.maxPrintMinutes + 1 };
  await assert.rejects(resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: okFetch(pageHtml([instance])) }), MakerWorldProfileNotFoundError);
});

test('resolver rejects a model with more profiles than the limit', async () => {
  const instances = Array.from({ length: MAKERWORLD_LIMITS.maxProfiles + 1 }, (_, i) => ({ ...frankensteinInstances()[0], id: 1000 + i }));
  await assert.rejects(resolveMakerWorldUrl(MODEL_URL_NO_HASH, { fetchImpl: okFetch(pageHtml(instances)) }), MakerWorldProfileNotFoundError);
});

test('resolver rejects a profile with more filaments than the limit', async () => {
  const filaments = Array.from({ length: MAKERWORLD_LIMITS.maxFilaments + 1 }, () => ({ name: 'PLA', type: 'PLA', weightGrams: 1 }));
  const instance = { ...frankensteinInstances()[0], filaments };
  await assert.rejects(resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: okFetch(pageHtml([instance])) }), MakerWorldProfileNotFoundError);
});

test('resolver refuses a response body larger than the cap', async () => {
  const html = pageHtml(frankensteinInstances()) + ' '.repeat(5_000);
  await assert.rejects(
    resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: okFetch(html), maxBytes: 1_000 }),
    MakerWorldBlockedOrTimeoutError,
  );
});

test('resolver enforces ONE deadline for the whole redirect chain, not per hop', async () => {
  let calls = 0;
  const slowRedirect: FetchLike = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 40));
    return new Response(null, { status: 302, headers: { location: MODEL_URL_170G } });
  };
  const started = Date.now();
  await assert.rejects(resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: slowRedirect, deadlineMs: 60 }), MakerWorldBlockedOrTimeoutError);
  assert.ok(calls <= 2, `expected the deadline to stop the chain early, got ${calls} hops`);
  assert.ok(Date.now() - started < 1_000);
});

test('resolver deadline fires even when fetch never settles', async () => {
  const hanging: FetchLike = () => new Promise<Response>(() => undefined);
  await assert.rejects(resolveMakerWorldUrl(MODEL_URL_170G, { fetchImpl: hanging, deadlineMs: 30 }), MakerWorldBlockedOrTimeoutError);
});

// ---------------------------------------------------------------------------------------------
// Image sanitizer (B2)
// ---------------------------------------------------------------------------------------------

test('sanitizeMakerWorldImageUrl accepts only the exact allowlisted MakerWorld image hosts', () => {
  assert.equal(sanitizeMakerWorldImageUrl('https://makerworld.com/a.jpg'), 'https://makerworld.com/a.jpg');
  assert.equal(sanitizeMakerWorldImageUrl('https://image.makerworld.com/a.jpg'), 'https://image.makerworld.com/a.jpg');
  const cdn = 'https://makerworld.bblmw.com/makerworld/model/X/design/a.png?x-oss-process=image/resize,w_400';
  assert.ok(sanitizeMakerWorldImageUrl(cdn)?.startsWith('https://makerworld.bblmw.com/'));
});

test('sanitizeMakerWorldImageUrl rejects everything else', () => {
  const rejected = [
    'http://makerworld.com/a.jpg',
    'https://evil.com/makerworld.com/a.jpg',
    'https://makerworld.com.evil.com/a.jpg',
    'https://xmakerworld.com/a.jpg',
    'https://bambulab.com.attacker.net/a.jpg',
    'https://user:pass@makerworld.com/a.jpg',
    'https://makerworld.com:8443/a.jpg',
    'https://attacker-bucket.oss-cn-hangzhou.aliyuncs.com/a.jpg', // owner decision: no shared-cloud wildcard
    'https://other.bblmw.com/a.jpg', // only the exact verified CDN host
    'https://forum.bambulab.com/uploads/fake-bank.png', // user-upload hosts: no *.bambulab.com wildcard
    'https://wiki.bambulab.com/x.png',
    'https://evil.makerworld.com/x.png', // no *.makerworld.com wildcard either
    'https://makerworld.com./a.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    `https://makerworld.com/${'a'.repeat(2_100)}`,
    '',
    null,
    42,
  ];
  for (const value of rejected) assert.equal(sanitizeMakerWorldImageUrl(value), null, `should reject ${String(value).slice(0, 60)}`);
});

// ---------------------------------------------------------------------------------------------
// "Dán đoạn thông số" parser
// ---------------------------------------------------------------------------------------------

test('parseMakerWorldSpecText extracts the Frankenstein No-AMS profile block', () => {
  const result = parseMakerWorldSpecText('0.2mm layer, 2 walls, 15% infill · P1S/P2S · 7.5 h · 6 plates · 170 g · No AMS');
  assert.equal(result.profileTitle, '0.2mm layer, 2 walls, 15% infill');
  assert.equal(result.printMinutes, 450);
  assert.equal(result.platesCount, 6);
  assert.equal(result.netWeightGrams, 170);
  assert.equal(result.amsRequired, false);
  assert.equal(result.printerTarget, 'P1S/P2S');
});

test('parseMakerWorldSpecText does not read the plate count as minutes ("7.5 h 6 plates")', () => {
  assert.equal(parseMakerWorldSpecText('7.5 h 6 plates 170g').printMinutes, 450);
});

test('parseMakerWorldSpecText handles common time/weight formats', () => {
  assert.equal(parseMakerWorldSpecText('7h30m').printMinutes, 450);
  assert.equal(parseMakerWorldSpecText('7h30').printMinutes, 450);
  assert.equal(parseMakerWorldSpecText('7 h 30 min').printMinutes, 450);
  assert.equal(parseMakerWorldSpecText('7,5 giờ').printMinutes, 450);
  assert.equal(parseMakerWorldSpecText('450 min').printMinutes, 450);
  assert.equal(parseMakerWorldSpecText('1.2 kg').netWeightGrams, 1200);
  assert.equal(parseMakerWorldSpecText('170.5g').netWeightGrams, 170.5);
  assert.equal(parseMakerWorldSpecText('1,170 g').netWeightGrams, 1170, 'thousands separator, not 1.17 g');
  assert.equal(parseMakerWorldSpecText('170,5 g').netWeightGrams, 170.5);
  assert.equal(parseMakerWorldSpecText('Requires AMS, 4 colors').amsRequired, true);
});

test('parseMakerWorldSpecText returns nulls for text without specs, never throws', () => {
  const result = parseMakerWorldSpecText('hello world');
  assert.deepEqual(result, { profileTitle: null, printMinutes: null, platesCount: null, netWeightGrams: null, amsRequired: null, printerTarget: null });
  assert.doesNotThrow(() => parseMakerWorldSpecText(undefined as unknown as string));
});

// ---------------------------------------------------------------------------------------------
// Snapshot schema v1 | v2 (B9) + profileVerified hard gate
// ---------------------------------------------------------------------------------------------

test('legacy Phase 13 snapshot (no schemaVersion) still parses as v1', () => {
  const legacy = { sourceUrl: 'https://makerworld.com/en/models/123#profileId-456', title: 'Ace Snail', coverImageUrl: null, platesCount: 8, totalPrintMinutes: 792, colorsCount: 7 };
  const parsed = quoteModelSnapshotSchema.safeParse(legacy);
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.schemaVersion, 1);
});

test('v2 snapshot with profileVerified: true parses', () => {
  const parsed = quoteModelSnapshotSchema.safeParse(validV2Snapshot());
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues));
});

test('v2 snapshot with profileVerified false or missing is rejected with a precise error (not a v1 "unrecognized keys" error)', () => {
  for (const snapshot of [validV2Snapshot({ profileVerified: false }), { ...validV2Snapshot(), profileVerified: undefined }]) {
    const parsed = quoteModelSnapshotSchema.safeParse(snapshot);
    assert.equal(parsed.success, false);
    if (!parsed.success) assert.deepEqual(parsed.error.issues.map((issue) => issue.path.join('.')), ['profileVerified']);
  }
});

test('snapshot rejects a non-MakerWorld sourceUrl and non-allowlisted image URLs (B2)', () => {
  assert.equal(quoteModelSnapshotSchema.safeParse(validV2Snapshot({ sourceUrl: 'https://evil.com/models/1' })).success, false);
  assert.equal(quoteModelSnapshotSchema.safeParse(validV2Snapshot({ coverImageUrl: 'https://evil.com/fake-bank.png' })).success, false);
  assert.equal(quoteModelSnapshotSchema.safeParse(validV2Snapshot({ profileCoverImageUrl: 'https://evil.com/pixel.gif' })).success, false);
  const legacyEvil = { sourceUrl: MODEL_URL_170G, title: 'x', coverImageUrl: 'https://evil.com/x.png', platesCount: 1, totalPrintMinutes: 1, colorsCount: 1 };
  assert.equal(quoteModelSnapshotSchema.safeParse(legacyEvil).success, false);
});

test('v2 snapshot of a non-commercial-license design must record the shop policy basis (B6 audit trail)', () => {
  const restricted = validV2Snapshot({ license: 'Standard Digital File License' });
  const missing = quoteModelSnapshotSchema.safeParse(restricted);
  assert.equal(missing.success, false);
  if (!missing.success) assert.deepEqual(missing.error.issues.map((issue) => issue.path.join('.')), ['licenseBasis']);
  // acknowledged without a basis is still incomplete
  assert.equal(quoteModelSnapshotSchema.safeParse({ ...restricted, licenseAcknowledged: true }).success, false);
  // what the admin panel writes automatically under PRINT_SERVICE_POLICY → quoting is allowed directly
  assert.equal(quoteModelSnapshotSchema.safeParse({ ...restricted, licenseAcknowledged: true, licenseBasis: PRINT_SERVICE_POLICY.licenseBasis }).success, true);
  assert.equal(quoteModelSnapshotSchema.safeParse({ ...restricted, licenseAcknowledged: true, licenseBasis: 'SOMETHING_ELSE' }).success, false);
  // permissive / unknown licenses need nothing extra
  assert.equal(quoteModelSnapshotSchema.safeParse(validV2Snapshot({ license: 'CC BY 4.0' })).success, true);
});

test('v2 snapshot rejects unknown keys (still .strict())', () => {
  assert.equal(quoteModelSnapshotSchema.safeParse(validV2Snapshot({ marginPct: 40 })).success, false);
});

test('quoteInputSchema accepts a v2 snapshot alongside a pricing breakdown', () => {
  const breakdown = computePricingBreakdown({ materials: [{ label: 'PLA', gram: 180, unitCostVndPerGram: 300 }], printMinutes: 450, laborMinutes: 50, config });
  const parsed = quoteInputSchema.safeParse({
    customRequestId: randomUUID(), subtotal: breakdown.finalPriceVnd, total: breakdown.finalPriceVnd,
    validUntil: new Date(Date.now() + 86_400_000).toISOString(), pricingBreakdown: breakdown, pricingConfigId: randomUUID(),
    modelSnapshot: validV2Snapshot(),
  });
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues));
});

test('readQuoteModelSnapshot returns null and logs on a corrupted snapshot instead of throwing', () => {
  const errorSpy = mock.method(console, 'error', () => undefined);
  try {
    assert.equal(readQuoteModelSnapshot({ title: 42 }, { quoteId: 'q1' }), null);
    assert.equal(readQuoteModelSnapshot('not-an-object'), null);
    assert.equal(errorSpy.mock.callCount(), 2);
    assert.equal(errorSpy.mock.calls[0].arguments[0], '[QUOTE_SNAPSHOT_CORRUPTED]');
  } finally {
    errorSpy.mock.restore();
  }
  assert.equal(readQuoteModelSnapshot(null), null);
});

test('readQuoteModelSnapshot keeps a legacy snapshot but drops a now-untrusted image URL', () => {
  const legacy = { sourceUrl: MODEL_URL_170G, title: 'Old quote', coverImageUrl: 'https://some-old-cdn.example.net/x.jpg', platesCount: 2, totalPrintMinutes: 60, colorsCount: 1 };
  const snapshot = readQuoteModelSnapshot(legacy);
  assert.ok(snapshot);
  assert.equal(snapshot.title, 'Old quote');
  assert.equal(snapshot.coverImageUrl, null);
});

// ---------------------------------------------------------------------------------------------
// B10 consistency check (pure part)
// ---------------------------------------------------------------------------------------------

test('derivePrintMinutesFromBreakdown recovers the print minutes the breakdown was computed from', () => {
  for (const minutes of [30, 450, 690, 792, 3_000]) {
    const breakdown = computePricingBreakdown({ materials: [{ label: 'PLA', gram: 100, unitCostVndPerGram: 300 }], printMinutes: minutes, laborMinutes: 20, config });
    const derived = derivePrintMinutesFromBreakdown(breakdown, config);
    assert.ok(derived !== null);
    assert.ok(isPrintMinutesConsistent(derived, minutes), `derived ${derived} vs ${minutes}`);
  }
});

test('isPrintMinutesConsistent flags a breakdown from the 690-min profile saved with the 450-min snapshot', () => {
  const breakdown = computePricingBreakdown({ materials: [{ label: 'PLA', gram: 300, unitCostVndPerGram: 300 }], printMinutes: 690, laborMinutes: 20, config });
  const derived = derivePrintMinutesFromBreakdown(breakdown, config)!;
  assert.equal(isPrintMinutesConsistent(derived, 450), false);
});

test('derivePrintMinutesFromBreakdown returns null when the config has no per-minute machine cost', () => {
  assert.equal(derivePrintMinutesFromBreakdown({ machineDepreciationVnd: 0, electricityCostVnd: 0 }, { ...config, machinePriceVnd: 0, electricityVndPerKwh: 0 }), null);
});

// ---------------------------------------------------------------------------------------------
// Tiers + AMS-aware waste
// ---------------------------------------------------------------------------------------------

test('ASSEMBLY_TIERS: KIT labor is lower than ASSEMBLED, so its price is never higher (same config, integer VND, ADR-0010)', () => {
  const base = { materials: [{ label: 'PLA', gram: 178.5, unitCostVndPerGram: 300 }], printMinutes: 450, config };
  const assembled = computePricingBreakdown({ ...base, laborMinutes: ASSEMBLY_TIERS.ASSEMBLED.laborMinutes });
  const kit = computePricingBreakdown({ ...base, laborMinutes: ASSEMBLY_TIERS.KIT.laborMinutes });
  assert.ok(kit.finalPriceVnd < assembled.finalPriceVnd);
  assert.equal(assembled.finalPriceVnd % 1000, 0);
  assert.equal(kit.finalPriceVnd % 1000, 0);
  assert.equal(ASSEMBLY_TIERS.ASSEMBLED.consumableLine, true);
  assert.equal(ASSEMBLY_TIERS.KIT.consumableLine, false);
});

test('defaultWasteRatioPctForProfile: No-AMS multi-color uses the single-color baseline, not AMS purge waste', () => {
  assert.equal(defaultWasteRatioPctForProfile(2, false), 5);
  assert.equal(defaultWasteRatioPctForProfile(7, false), 5);
  assert.equal(defaultWasteRatioPctForProfile(3, true), 20);
  assert.equal(defaultWasteRatioPctForProfile(7, null), 35);
  assert.equal(defaultWasteRatioPctForProfile(1, null), 5);
});

// ---------------------------------------------------------------------------------------------
// DB-backed: createQuote B10 + MANUAL_PRICE_OVERRIDE, acceptQuote scoped sibling auto-reject (B8)
// ---------------------------------------------------------------------------------------------

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';

async function seedCustomRequest(): Promise<string> {
  const id = randomUUID();
  await query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
     values ($1, $2, 'OTHER', 'Profile Verification Test', '0900000000', 'test', 1)`,
    [id, `CR-${id.slice(0, 8).toUpperCase()}`],
  );
  return id;
}

async function seedPricingConfig(): Promise<string> {
  const id = randomUUID();
  await query(`
    insert into pricing_configs (id, electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw, labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [id, config.electricityVndPerKwh, config.machinePriceVnd, config.machineLifetimeHours, config.printerPowerKw, config.laborVndPerHour, config.failureBufferPct, config.marginPct, config.packagingFeeVnd]);
  return id;
}

const validUntil = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

test('createQuote rejects a breakdown computed for a different print time than the snapshot (B10)', { skip: !hasDb }, async () => {
  const customRequestId = await seedCustomRequest();
  const pricingConfigId = await seedPricingConfig();
  const breakdown = computePricingBreakdown({ materials: [{ label: 'PLA', gram: 300, unitCostVndPerGram: 300 }], printMinutes: 690, laborMinutes: 50, config });
  await assert.rejects(
    () => createQuote({
      customRequestId, subtotal: breakdown.finalPriceVnd, total: breakdown.finalPriceVnd, validUntil: validUntil(),
      pricingBreakdown: breakdown, pricingConfigId, modelSnapshot: quoteModelSnapshotSchema.parse(validV2Snapshot()),
    }, ACTOR_ID),
    (error: unknown) => error instanceof DomainError && error.code === 'QUOTE_SNAPSHOT_MISMATCH',
  );
});

test('createQuote rejects a breakdown whose material grams are far below the snapshot net weight (B10 grams check)', { skip: !hasDb }, async () => {
  const customRequestId = await seedCustomRequest();
  const pricingConfigId = await seedPricingConfig();
  // Same print time as the snapshot (450 min) but priced on 100 g while the profile is 170 g net.
  const breakdown = computePricingBreakdown({ materials: [{ label: 'PLA', gram: 100, unitCostVndPerGram: 300 }], printMinutes: 450, laborMinutes: 50, config });
  await assert.rejects(
    () => createQuote({
      customRequestId, subtotal: breakdown.finalPriceVnd, total: breakdown.finalPriceVnd, validUntil: validUntil(),
      pricingBreakdown: breakdown, pricingConfigId, modelSnapshot: quoteModelSnapshotSchema.parse(validV2Snapshot()),
    }, ACTOR_ID),
    (error: unknown) => error instanceof DomainError && error.code === 'QUOTE_SNAPSHOT_MISMATCH',
  );
});

test('createQuote audits MANUAL_PRICE_OVERRIDE when staff edits the computed price', { skip: !hasDb }, async () => {
  const customRequestId = await seedCustomRequest();
  const pricingConfigId = await seedPricingConfig();
  const breakdown = computePricingBreakdown({ materials: [{ label: 'PLA', gram: 180, unitCostVndPerGram: 300 }], printMinutes: 450, laborMinutes: 50, config });
  const subtotal = breakdown.finalPriceVnd - 9_000;
  const quote = await createQuote({
    customRequestId, subtotal, total: subtotal, validUntil: validUntil(),
    pricingBreakdown: breakdown, pricingConfigId, modelSnapshot: quoteModelSnapshotSchema.parse(validV2Snapshot()),
  }, ACTOR_ID);
  const audit = await query<{ after_data: { deltaVnd: number } }>(
    `select after_data from audit_logs where action = 'MANUAL_PRICE_OVERRIDE' and entity_id = $1`, [quote.id]);
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].after_data.deltaVnd, -9_000);
});

test('acceptQuote auto-rejects only open sibling quotes with the SAME sourceUrl (B8)', { skip: !hasDb }, async () => {
  const customRequestId = await seedCustomRequest();
  const assembledSnapshot = quoteModelSnapshotSchema.parse(validV2Snapshot({ tier: 'ASSEMBLED' }));
  const kitSnapshot = quoteModelSnapshotSchema.parse(validV2Snapshot({ tier: 'KIT' }));
  const otherItemSnapshot = quoteModelSnapshotSchema.parse(validV2Snapshot({ sourceUrl: 'https://makerworld.com/en/models/999-other#profileId-1', profileId: '1' }));

  const assembled = await createQuote({ customRequestId, subtotal: 175_000, total: 175_000, validUntil: validUntil(), modelSnapshot: assembledSnapshot }, ACTOR_ID);
  const kit = await createQuote({ customRequestId, subtotal: 135_000, total: 135_000, validUntil: validUntil(), modelSnapshot: kitSnapshot }, ACTOR_ID);
  const otherItem = await createQuote({ customRequestId, subtotal: 90_000, total: 90_000, validUntil: validUntil(), modelSnapshot: otherItemSnapshot }, ACTOR_ID);
  const manual = await createQuote({ customRequestId, subtotal: 50_000, total: 50_000, validUntil: validUntil() }, ACTOR_ID);

  const accepted = await acceptQuote(kit.id, ACTOR_ID);
  assert.equal(accepted.status, 'ACCEPTED');

  const statuses = await query<{ id: string; status: string }>('select id, status from quotes where custom_request_id = $1', [customRequestId]);
  const byId = new Map(statuses.rows.map((row) => [row.id, row.status]));
  assert.equal(byId.get(kit.id), 'ACCEPTED');
  assert.equal(byId.get(assembled.id), 'REJECTED', 'same-link tier alternative must be auto-rejected');
  assert.notEqual(byId.get(otherItem.id), 'REJECTED', 'a different item in the same request must not be touched');
  assert.notEqual(byId.get(manual.id), 'REJECTED', 'a quote without a snapshot must not be touched');

  const printJobs = await query('select id from print_jobs where custom_request_id = $1', [customRequestId]);
  assert.equal(printJobs.rowCount, 1);
  const audit = await query(`select id from audit_logs where action = 'QUOTE_AUTO_REJECTED_SIBLING' and entity_id = $1`, [assembled.id]);
  assert.equal(audit.rowCount, 1);
});

test('acceptQuote refuses a same-link sibling created after another tier was already accepted', { skip: !hasDb }, async () => {
  const customRequestId = await seedCustomRequest();
  const kit = await createQuote({ customRequestId, subtotal: 135_000, total: 135_000, validUntil: validUntil(), modelSnapshot: quoteModelSnapshotSchema.parse(validV2Snapshot({ tier: 'KIT' })) }, ACTOR_ID);
  await acceptQuote(kit.id, ACTOR_ID);
  const lateAssembled = await createQuote({ customRequestId, subtotal: 175_000, total: 175_000, validUntil: validUntil(), modelSnapshot: quoteModelSnapshotSchema.parse(validV2Snapshot({ tier: 'ASSEMBLED' })) }, ACTOR_ID);
  await assert.rejects(
    () => acceptQuote(lateAssembled.id, ACTOR_ID),
    (error: unknown) => error instanceof DomainError && error.code === 'QUOTE_SIBLING_ALREADY_ACCEPTED',
  );
  const printJobs = await query('select id from print_jobs where custom_request_id = $1', [customRequestId]);
  assert.equal(printJobs.rowCount, 1);
});

test('two concurrent accepts of tier siblings do not deadlock: exactly one wins', { skip: !hasDb }, async () => {
  const customRequestId = await seedCustomRequest();
  const a = await createQuote({ customRequestId, subtotal: 175_000, total: 175_000, validUntil: validUntil(), modelSnapshot: quoteModelSnapshotSchema.parse(validV2Snapshot({ tier: 'ASSEMBLED' })) }, ACTOR_ID);
  const b = await createQuote({ customRequestId, subtotal: 135_000, total: 135_000, validUntil: validUntil(), modelSnapshot: quoteModelSnapshotSchema.parse(validV2Snapshot({ tier: 'KIT' })) }, ACTOR_ID);
  const results = await Promise.allSettled([acceptQuote(a.id, ACTOR_ID), acceptQuote(b.id, ACTOR_ID)]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof DomainError, `expected a DomainError, got ${String(rejected[0].reason)}`);
  const printJobs = await query('select id from print_jobs where custom_request_id = $1', [customRequestId]);
  assert.equal(printJobs.rowCount, 1);
});
