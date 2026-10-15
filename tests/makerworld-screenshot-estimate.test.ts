// ADR-0039 — MakerWorld estimate from a customer screenshot
// (docs/exec-plans/active/makerworld-screenshot-estimate.md §5).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { MakerWorldNotFoundError } from '../src/lib/parsers/makerworld-resolver.js';
import {
  matchScreenshotToUrl,
  normalizeVisionOutput,
  parseDurationText,
  profileSpecLine,
  titleTokens,
  type ScreenshotProfile,
} from '../src/lib/parsers/makerworld-screenshot.js';
import { parseMakerWorldSpecText } from '../src/lib/parsers/makerworld-spec-text.js';
import { DEFAULT_VISION_MODEL, extractMakerWorldScreenshotJson, VisionUnavailableError, type FetchLike } from '../src/lib/vision/gemini-vision.js';
import type { PricingContext } from '../src/services/instant-estimate.service.js';
import {
  buildScreenshotSubmission,
  estimateMakerWorldScreenshot,
  isScreenshotEstimateEnabled,
  loadScreenshotSubmission,
  SCREENSHOT_MAX_BYTES,
  type ScreenshotEstimateDeps,
  type StoredScreenshotProfile,
} from '../src/services/makerworld-screenshot-estimate.service.js';
import { publicCustomRequestInputSchema } from '../src/domain/schemas.js';
import { createCustomRequest } from '../src/services/custom-request.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const ctx: PricingContext = {
  config: { electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000 },
  medians: new Map([['PLA', 300]]),
};

const URL_WITH_SLUG = 'https://makerworld.com/en/models/3246150-frankenstein-s-monster-halloween-version-no-ams#profileId-3678340';
const PATH = 'requests/2b1c4c1e-8f0a-4f4e-9a55-0d3f3b7f1a11.png';
const FORBIDDEN_DTO_KEYS = ['unitCost', 'margin', 'pricingConfig', 'breakdown', 'materialCost', 'laborCost', 'materialId'];

const visionProfile = (overrides: Record<string, unknown> = {}) => ({
  title: '0.2mm layer, 2 walls, 15% infill', printerTarget: 'P1S', printTimeText: '7.4 h', weightText: '168 g',
  platesCount: 6, colorsCount: 1, ams: 'NO', ...overrides,
});
const visionOutput = (overrides: Record<string, unknown> = {}) => ({
  isMakerWorldScreenshot: true, modelTitle: "Frankenstein's Monster - Halloween", modelIdInImage: null,
  profiles: [visionProfile()], ...overrides,
});

// ---------------------------------------------------------------- pure parsing

test('vision output: values are parsed from the copied text and bounded', () => {
  const result = normalizeVisionOutput(visionOutput());
  assert.ok(result);
  assert.deepEqual(result.profiles[0], {
    key: 'p0', title: '0.2mm layer, 2 walls, 15% infill', printerTarget: 'P1S', printMinutes: 444, netWeightGrams: 168,
    platesCount: 6, amsRequired: false, colorsCount: 1, dataIncomplete: false,
  });
});

test('vision output: missing time or grams → dataIncomplete, never 0; junk values are dropped', () => {
  const result = normalizeVisionOutput(visionOutput({
    profiles: [
      visionProfile({ weightText: null }),
      visionProfile({ printTimeText: 'soon' }),
      visionProfile({ printTimeText: '-5 h', weightText: '99999 kg', platesCount: -1, colorsCount: 999, ams: 'MAYBE', title: 'x'.repeat(1_000) }),
    ],
  }));
  assert.ok(result);
  assert.equal(result.profiles[0].dataIncomplete, true);
  assert.equal(result.profiles[0].netWeightGrams, null);
  assert.equal(result.profiles[1].printMinutes, null);
  const junk = result.profiles[2];
  assert.equal(junk.netWeightGrams, null, '99999 kg is over the cap');
  assert.equal(junk.platesCount, null);
  assert.equal(junk.colorsCount, null);
  assert.equal(junk.amsRequired, null);
  assert.ok(junk.title.length <= 300 || junk.title === 'Profile 3');
});

test('vision output: at most 10 profiles with server keys p0..p9; garbage payloads → null', () => {
  const result = normalizeVisionOutput(visionOutput({ profiles: Array.from({ length: 14 }, () => visionProfile({ title: 'same' })) }));
  assert.equal(result?.profiles.length, 10);
  assert.deepEqual(result?.profiles.map((p) => p.key), ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']);
  assert.equal(normalizeVisionOutput(null), null);
  assert.equal(normalizeVisionOutput({ profiles: 'nope' }), null);
  assert.equal(normalizeVisionOutput(visionOutput({ modelIdInImage: '12abc' }))?.modelIdInImage, null);
});

test('print time text: hours, h+m, minutes, days (never read "1d 2h" as 2 h)', () => {
  assert.equal(parseDurationText('7.4 h'), 444);
  assert.equal(parseDurationText('3h 20m'), 200);
  assert.equal(parseDurationText('45 min'), 45);
  assert.equal(parseDurationText('1d 2h'), 26 * 60);
  assert.equal(parseDurationText('1 ngày 2 giờ 30 phút'), 26 * 60 + 30);
  assert.equal(parseDurationText('2 days'), 48 * 60);
  assert.equal(parseDurationText('soon'), null);
  assert.equal(parseDurationText(null), null);
  assert.equal(normalizeVisionOutput(visionOutput({ profiles: [visionProfile({ printTimeText: '1d 3.5h' })] }))?.profiles[0].printMinutes, 27 * 60 + 30);
});

test('link ↔ screenshot match: model id wins, then slug vs title, else UNKNOWN', () => {
  const base = { modelId: '3246150', sourceUrl: URL_WITH_SLUG };
  assert.equal(matchScreenshotToUrl({ ...base, modelIdInImage: '3246150', modelTitle: 'Totally different' }), 'MATCH');
  assert.equal(matchScreenshotToUrl({ ...base, modelIdInImage: '999', modelTitle: "Frankenstein's Monster" }), 'MISMATCH');
  assert.equal(matchScreenshotToUrl({ ...base, modelIdInImage: null, modelTitle: "Frankenstein's Monster" }), 'MATCH');
  assert.equal(matchScreenshotToUrl({ ...base, modelIdInImage: null, modelTitle: 'Articulated Dragon' }), 'MISMATCH');
  assert.equal(matchScreenshotToUrl({ ...base, modelIdInImage: null, modelTitle: null }), 'UNKNOWN');
  assert.equal(matchScreenshotToUrl({ ...base, modelIdInImage: null, modelTitle: 'Dragon' }), 'UNKNOWN', 'a one-word title is too weak to hide the price');
  assert.equal(matchScreenshotToUrl({ ...base, modelIdInImage: null, modelTitle: '弗兰肯斯坦' }), 'UNKNOWN', 'non-Latin title cannot be compared');
  assert.equal(matchScreenshotToUrl({ modelId: '1', sourceUrl: 'https://makerworld.com/en/models/1', modelIdInImage: null, modelTitle: 'Anything' }), 'UNKNOWN', 'no slug');
  assert.equal(matchScreenshotToUrl({ modelId: '1', sourceUrl: 'https://makerworld.com/en/models/1-den-ngu-mat-trang', modelIdInImage: null, modelTitle: 'Đèn ngủ mặt trăng' }), 'MATCH');
  assert.deepEqual([...titleTokens('Đèn Ngủ')], ['den', 'ngu']);
});

test('spec line round-trips through the admin spec parser, title last', () => {
  const profile: ScreenshotProfile = {
    key: 'p0', title: '50 g edition', printerTarget: 'P1S', printMinutes: 445, netWeightGrams: 168, platesCount: 6,
    amsRequired: false, colorsCount: 1, dataIncomplete: false,
  };
  const parsed = parseMakerWorldSpecText(profileSpecLine(profile));
  assert.equal(parsed.printMinutes, 445);
  assert.equal(parsed.netWeightGrams, 168, 'the title "50 g" must not shadow the real grams');
  assert.equal(parsed.platesCount, 6);
  assert.equal(parsed.amsRequired, false);
});

// ---------------------------------------------------------------- vision client

const image = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' as const };

test('vision client: default model is one Google still offers to new projects', () => {
  assert.doesNotMatch(DEFAULT_VISION_MODEL, /^gemini-2\./, 'Google limits 2.x models to existing users');
});

test('vision client: thought-summary parts are skipped', async () => {
  const fetchImpl: FetchLike = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [
    { text: 'thinking about it…', thought: true },
    { text: JSON.stringify(visionOutput()) },
  ] } }] }), { status: 200 });
  const result = await extractMakerWorldScreenshotJson(image, { apiKey: 'k', fetchImpl });
  assert.equal((result as { isMakerWorldScreenshot: boolean }).isMakerWorldScreenshot, true);
});

test('vision client: key in header (not URL), JSON schema requested, text part parsed', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;
  const fetchImpl: FetchLike = async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(visionOutput()) }] } }] }), { status: 200 });
  };
  const result = await extractMakerWorldScreenshotJson(image, { apiKey: 'secret-key', fetchImpl });
  assert.equal((result as { modelTitle: string }).modelTitle, "Frankenstein's Monster - Halloween");
  assert.ok(!seenUrl.includes('secret-key'));
  assert.equal((seenInit?.headers as Record<string, string>)['x-goog-api-key'], 'secret-key');
  const body = JSON.parse(String(seenInit?.body));
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.contents[0].parts[1].inline_data.mime_type, 'image/png');
});

test('vision client: HTTP error, bad JSON, timeout and missing key → VisionUnavailableError', async () => {
  await assert.rejects(() => extractMakerWorldScreenshotJson(image, { apiKey: 'k', fetchImpl: async () => new Response('x', { status: 500 }) }), VisionUnavailableError);
  await assert.rejects(() => extractMakerWorldScreenshotJson(image, { apiKey: 'k', fetchImpl: async () => new Response('{not json', { status: 200 }) }), VisionUnavailableError);
  await assert.rejects(() => extractMakerWorldScreenshotJson(image, { apiKey: 'k', fetchImpl: async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }) }), VisionUnavailableError);
  const hanging: FetchLike = (_url, init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  await assert.rejects(() => extractMakerWorldScreenshotJson(image, { apiKey: 'k', fetchImpl: hanging, timeoutMs: 20 }), VisionUnavailableError);
  await assert.rejects(() => extractMakerWorldScreenshotJson(image, { apiKey: '', fetchImpl: async () => new Response('{}') }), VisionUnavailableError);
});

// ---------------------------------------------------------------- service (fake deps)

function fakeDeps(overrides: Partial<ScreenshotEstimateDeps> = {}): ScreenshotEstimateDeps & { stored: unknown[] } {
  const stored: unknown[] = [];
  return {
    stored,
    inspect: async () => ({ sizeBytes: 1_000 }),
    download: async () => new Uint8Array([137, 80, 78, 71]),
    extract: async () => visionOutput(),
    pricingContext: async () => ctx,
    overBudget: async () => false,
    alreadyUsed: async () => false,
    store: async (input) => { stored.push(input); return '11111111-1111-4111-8111-111111111111'; },
    ...overrides,
  };
}

test('feature flag needs both the switch and an API key', () => {
  assert.equal(isScreenshotEstimateEnabled({}), false);
  assert.equal(isScreenshotEstimateEnabled({ MAKERWORLD_SCREENSHOT_ESTIMATE_ENABLED: 'true' }), false);
  assert.equal(isScreenshotEstimateEnabled({ GEMINI_API_KEY: 'k' }), false);
  assert.equal(isScreenshotEstimateEnabled({ MAKERWORLD_SCREENSHOT_ESTIMATE_ENABLED: 'true', GEMINI_API_KEY: 'k' }), true);
});

test('one complete profile: priced (5.000đ rounding), pre-selected, stored with the link, no cost fields leak', async () => {
  const deps = fakeDeps();
  const result = await estimateMakerWorldScreenshot({ url: URL_WITH_SLUG, attachmentPath: PATH }, deps);
  assert.equal(result.source, 'SCREENSHOT');
  assert.equal(result.reason, 'OK');
  assert.equal(result.matchStatus, 'MATCH');
  assert.equal(result.selectedProfileId, 'p0');
  assert.equal(result.requestedProfileId, '3678340');
  assert.equal(result.screenshotEstimateId, '11111111-1111-4111-8111-111111111111');
  for (const price of Object.values(result.profiles[0].prices)) {
    assert.ok(price !== null && price > 0 && price % 5_000 === 0);
  }
  const json = JSON.stringify(result);
  for (const key of FORBIDDEN_DTO_KEYS) assert.ok(!json.includes(`"${key}"`), key);
  assert.equal(deps.stored.length, 1);
  assert.equal((deps.stored[0] as { attachmentPath: string }).attachmentPath, PATH);
  assert.equal((deps.stored[0] as { sourceUrl: string }).sourceUrl, 'https://makerworld.com/en/models/3246150-frankenstein-s-monster-halloween-version-no-ams#profileId-3678340');
});

test('several profiles: nothing pre-selected; incomplete profile has no price', async () => {
  const deps = fakeDeps({ extract: async () => visionOutput({ profiles: [visionProfile(), visionProfile({ title: 'No gram', weightText: null })] }) });
  const result = await estimateMakerWorldScreenshot({ url: URL_WITH_SLUG, attachmentPath: PATH }, deps);
  assert.equal(result.selectedProfileId, null);
  assert.equal(result.profiles[1].dataIncomplete, true);
  assert.deepEqual(result.profiles[1].prices, { ASSEMBLED: null, KIT: null });
});

test('MISMATCH hides every price but keeps the profiles and the stored id', async () => {
  const deps = fakeDeps({ extract: async () => visionOutput({ modelTitle: 'Articulated Dragon' }) });
  const result = await estimateMakerWorldScreenshot({ url: URL_WITH_SLUG, attachmentPath: PATH }, deps);
  assert.equal(result.matchStatus, 'MISMATCH');
  assert.equal(result.reason, 'SCREENSHOT_MISMATCH');
  assert.equal(result.source, 'NONE');
  assert.deepEqual(result.profiles[0].prices, { ASSEMBLED: null, KIT: null });
  assert.ok(result.screenshotEstimateId);
});

test('vision down / unreadable / not MakerWorld / busy / no config → reason, nothing stored', async () => {
  const cases: Array<[Partial<ScreenshotEstimateDeps>, string]> = [
    [{ extract: async () => { throw new VisionUnavailableError(); } }, 'SCREENSHOT_UNAVAILABLE'],
    [{ extract: async () => ({ hello: 'world' }) }, 'SCREENSHOT_UNREADABLE'],
    [{ extract: async () => visionOutput({ isMakerWorldScreenshot: false }) }, 'SCREENSHOT_UNREADABLE'],
    [{ extract: async () => visionOutput({ profiles: [] }) }, 'SCREENSHOT_UNREADABLE'],
    [{ overBudget: async () => true }, 'BUSY'],
    [{ pricingContext: async () => null }, 'NO_PRICING_CONFIG'],
  ];
  for (const [override, reason] of cases) {
    const deps = fakeDeps(override);
    const result = await estimateMakerWorldScreenshot({ url: URL_WITH_SLUG, attachmentPath: PATH }, deps);
    assert.equal(result.reason, reason);
    assert.equal(result.screenshotEstimateId, null);
    assert.equal(deps.stored.length, 0, reason);
  }
});

test('bad link, non-image path and oversized image are rejected before the vision call', async () => {
  let calls = 0;
  const deps = fakeDeps({ extract: async () => { calls += 1; return visionOutput(); } });
  await assert.rejects(() => estimateMakerWorldScreenshot({ url: 'https://evil.com/models/1', attachmentPath: PATH }, deps), MakerWorldNotFoundError);
  await assert.rejects(() => estimateMakerWorldScreenshot({ url: URL_WITH_SLUG, attachmentPath: 'requests/2b1c4c1e.stl' }, deps), DomainError);
  await assert.rejects(() => estimateMakerWorldScreenshot({ url: URL_WITH_SLUG, attachmentPath: '../secret.png' }, deps), DomainError);
  await assert.rejects(
    () => estimateMakerWorldScreenshot({ url: URL_WITH_SLUG, attachmentPath: PATH }, fakeDeps({ inspect: async () => ({ sizeBytes: SCREENSHOT_MAX_BYTES + 1 }) })),
    (error: unknown) => error instanceof DomainError && error.code === 'SCREENSHOT_TOO_LARGE',
  );
  await assert.rejects(
    () => estimateMakerWorldScreenshot({ url: URL_WITH_SLUG, attachmentPath: PATH }, fakeDeps({ alreadyUsed: async () => true, extract: async () => { calls += 1; return visionOutput(); } })),
    (error: unknown) => error instanceof DomainError && error.code === 'SCREENSHOT_ALREADY_USED',
  );
  assert.equal(calls, 0);
});

// ---------------------------------------------------------------- submission

const storedProfile = (key: string, prices = { ASSEMBLED: 250_000, KIT: 200_000 }): StoredScreenshotProfile => ({
  key, title: `Profile ${key}`, printerTarget: 'P1S', printMinutes: 444, netWeightGrams: 168, platesCount: 6,
  amsRequired: false, colorsCount: 1, dataIncomplete: false, prices,
});
const row = (overrides: Record<string, unknown> = {}) => ({
  id: '22222222-2222-4222-8222-222222222222', model_id: '3246150',
  source_url: 'https://makerworld.com/en/models/3246150-frankenstein-s-monster-halloween-version-no-ams#profileId-3678340',
  requested_profile_id: '3678340', attachment_path: PATH, model_title_extracted: 'Frankenstein', match_status: 'MATCH' as const,
  profiles: [storedProfile('p0'), storedProfile('p1')], ...overrides,
});

test('submission snapshot: price from the stored row for the chosen key + tier, image path from the row', () => {
  const submission = buildScreenshotSubmission(row(), { sourceUrl: URL_WITH_SLUG, profileKey: 'p1', tier: 'KIT' });
  assert.equal(submission.attachmentPath, PATH);
  assert.equal(submission.snapshot.estimateSource, 'SCREENSHOT');
  assert.equal(submission.snapshot.estimatedPriceVnd, 200_000);
  assert.equal(submission.snapshot.profileTitle, 'Profile p1');
  assert.equal(submission.snapshot.profileId, '3678340', 'MakerWorld #profileId from the link, not the p-key');
  assert.equal(submission.snapshot.screenshot?.selectedProfileKey, 'p1');
  assert.equal(parseMakerWorldSpecText(submission.snapshot.specText ?? '').printMinutes, 444);
});

test('submission: other link, unknown key → 400; MISMATCH → no price', () => {
  assert.throws(() => buildScreenshotSubmission(row(), { sourceUrl: 'https://makerworld.com/en/models/999', profileKey: 'p0', tier: 'KIT' }),
    (error: unknown) => error instanceof DomainError && error.code === 'SCREENSHOT_URL_MISMATCH');
  assert.throws(() => buildScreenshotSubmission(row(), { sourceUrl: URL_WITH_SLUG, profileKey: 'p7', tier: 'KIT' }),
    (error: unknown) => error instanceof DomainError && error.code === 'SCREENSHOT_PROFILE_NOT_FOUND');
  const mismatch = buildScreenshotSubmission(row({ match_status: 'MISMATCH' }), { sourceUrl: URL_WITH_SLUG, profileKey: 'p0', tier: 'KIT' });
  assert.equal(mismatch.snapshot.estimatedPriceVnd, null);
  assert.equal(mismatch.snapshot.estimateSource, 'NONE');
});

test('public intake schema: screenshot id + key go together and exclude specText', () => {
  const base = { customerName: 'Khách', customerPhone: '0912345678', description: 'x', quantity: 1, copyrightConfirmed: true as const, tosVersion: '2026-09-08' };
  const mw = { sourceUrl: URL_WITH_SLUG, profileId: '3678340', tier: 'KIT' as const, profileConfirmed: true as const };
  const id = randomUUID();
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld: { ...mw, screenshotEstimateId: id, profileKey: 'p0' } }).success, true);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld: { ...mw, screenshotEstimateId: id } }).success, false);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld: { ...mw, profileKey: 'p0' } }).success, false);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld: { ...mw, screenshotEstimateId: id, profileKey: 'zz' } }).success, false);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld: { ...mw, screenshotEstimateId: id, profileKey: 'p0', specText: '7 h 100 g' } }).success, false);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, makerworld: { ...mw, screenshotEstimateId: 'not-a-uuid', profileKey: 'p0' } }).success, false);
});

// ---------------------------------------------------------------- DB

async function insertEstimate(overrides: { expiresInMinutes?: number } = {}): Promise<string> {
  const path = `requests/${randomUUID()}.png`;
  const result = await query<{ id: string }>(`
    insert into makerworld_screenshot_estimates (model_id, source_url, requested_profile_id, attachment_path, model_title_extracted, match_status, profiles, created_at, expires_at)
    values ('3246150', $1, '3678340', $2, 'Frankenstein', 'MATCH', $3, now() - interval '1 hour', now() + ($4::int * interval '1 minute')) returning id`,
  [row().source_url, path, JSON.stringify([storedProfile('p0')]), overrides.expiresInMinutes ?? 60]);
  return result.rows[0].id;
}

test('DB: an estimate is single use, even under two concurrent submissions', { skip: !hasDb }, async () => {
  const id = await insertEstimate();
  const submission = await loadScreenshotSubmission({ screenshotEstimateId: id, sourceUrl: URL_WITH_SLUG, profileKey: 'p0', tier: 'KIT' });
  const create = () => createCustomRequest({
    customerName: 'Khách ảnh', customerPhone: `09${String(Date.now()).slice(-8)}`, description: '[MakerWorld] test', quantity: 1,
    attachmentPath: submission.attachmentPath, makerworldSnapshot: submission.snapshot, screenshotEstimateId: id,
    copyrightConfirmed: true, tosVersion: '2026-09-08', sourceChannel: 'WEBSITE',
  }, null);
  const results = await Promise.allSettled([create(), create()]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.ok(rejected.reason instanceof DomainError && rejected.reason.code === 'SCREENSHOT_ESTIMATE_USED');
  const stored = await query<{ consumed_at: Date | null; custom_request_id: string | null }>('select consumed_at, custom_request_id from makerworld_screenshot_estimates where id = $1', [id]);
  assert.ok(stored.rows[0].consumed_at && stored.rows[0].custom_request_id);
  await assert.rejects(() => loadScreenshotSubmission({ screenshotEstimateId: id, sourceUrl: URL_WITH_SLUG, profileKey: 'p0', tier: 'KIT' }),
    (error: unknown) => error instanceof DomainError && error.code === 'SCREENSHOT_ESTIMATE_USED');
});

test('DB: an expired estimate cannot be submitted', { skip: !hasDb }, async () => {
  const id = await insertEstimate({ expiresInMinutes: -1 });
  await assert.rejects(() => loadScreenshotSubmission({ screenshotEstimateId: id, sourceUrl: URL_WITH_SLUG, profileKey: 'p0', tier: 'KIT' }),
    (error: unknown) => error instanceof DomainError && error.code === 'SCREENSHOT_ESTIMATE_USED');
});
