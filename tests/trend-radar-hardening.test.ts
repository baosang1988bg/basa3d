// ADR-0062 — regression tests for the Trend Radar review findings (B2, B3, I1, I3, I4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { safeFetchText, SafeFetchError, type FetchLike } from '../src/lib/net/safe-fetch';
import { evaluateLicenseSafety } from '../src/lib/trend/license-safety';
import { canTransitionTrendStatus } from '../src/lib/trend/watch-status';
import { captureModelFromUrl, detectTrendPlatform, parseOpenGraph, trendWatchInputSchema } from '../src/services/trend-hunter.service';

const PRINTABLES = ['printables.com'];

function htmlResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html' }, ...init });
}

// ---------- B2: SSRF-safe fetch ----------

test('safeFetchText rejects non-allowlisted hosts, http, ports and credentials before any request', async () => {
  let calls = 0;
  const fetchImpl: FetchLike = async () => { calls += 1; return htmlResponse('x'); };
  for (const url of [
    'https://169.254.169.254/latest/meta-data',
    'http://www.printables.com/model/1',
    'https://www.printables.com:8443/model/1',
    'https://user:pw@www.printables.com/model/1',
    'https://printables.com.evil.io/model/1',
    'https://localhost/model/1',
  ]) {
    await assert.rejects(safeFetchText(url, { allowedHostSuffixes: PRINTABLES, fetchImpl }), (e: unknown) => e instanceof SafeFetchError && e.reason === 'HOST_NOT_ALLOWED', url);
  }
  assert.equal(calls, 0);
});

test('safeFetchText re-validates every redirect hop', async () => {
  const fetchImpl: FetchLike = async (url) => {
    if (url.hostname === 'www.printables.com') return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:6379/' } });
    return htmlResponse('internal');
  };
  await assert.rejects(safeFetchText('https://www.printables.com/model/1', { allowedHostSuffixes: PRINTABLES, fetchImpl }), (e: unknown) => e instanceof SafeFetchError && e.reason === 'HOST_NOT_ALLOWED');
});

test('safeFetchText follows allowlisted redirects with manual mode and caps hops', async () => {
  const seen: string[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    assert.equal(init.redirect, 'manual');
    seen.push(url.href);
    if (url.pathname === '/a') return new Response(null, { status: 301, headers: { location: '/b' } });
    return htmlResponse('<title>ok</title>');
  };
  assert.equal(await safeFetchText('https://www.printables.com/a', { allowedHostSuffixes: PRINTABLES, fetchImpl }), '<title>ok</title>');
  assert.deepEqual(seen, ['https://www.printables.com/a', 'https://www.printables.com/b']);

  const loop: FetchLike = async () => new Response(null, { status: 302, headers: { location: '/again' } });
  await assert.rejects(safeFetchText('https://www.printables.com/a', { allowedHostSuffixes: PRINTABLES, fetchImpl: loop }), (e: unknown) => e instanceof SafeFetchError && e.reason === 'TOO_MANY_REDIRECTS');
});

test('safeFetchText enforces the body cap (declared and streamed)', async () => {
  const declared: FetchLike = async () => htmlResponse('x', { headers: { 'content-length': String(10_000_000) } });
  await assert.rejects(safeFetchText('https://www.printables.com/', { allowedHostSuffixes: PRINTABLES, maxBytes: 1024, fetchImpl: declared }), (e: unknown) => e instanceof SafeFetchError && e.reason === 'TOO_LARGE');
  const streamed: FetchLike = async () => htmlResponse('y'.repeat(5000));
  await assert.rejects(safeFetchText('https://www.printables.com/', { allowedHostSuffixes: PRINTABLES, maxBytes: 1024, fetchImpl: streamed }), (e: unknown) => e instanceof SafeFetchError && e.reason === 'TOO_LARGE');
});

test('safeFetchText deadline also covers a slow body after headers arrive', async () => {
  const slowBody: FetchLike = async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('<html>')); /* never closes */ },
  }), { status: 200 });
  const started = Date.now();
  await assert.rejects(safeFetchText('https://www.printables.com/', { allowedHostSuffixes: PRINTABLES, deadlineMs: 150, fetchImpl: slowBody }), (e: unknown) => e instanceof SafeFetchError && e.reason === 'TIMEOUT');
  assert.ok(Date.now() - started < 2_000);
});

test('captureModelFromUrl never fetches unknown hosts and degrades to a URL-only draft', async () => {
  let calls = 0;
  const fetchImpl: FetchLike = async () => { calls += 1; return htmlResponse(''); };
  const other = await captureModelFromUrl('https://internal.example.local/admin', { fetchImpl });
  assert.equal(other.platform, 'OTHER');
  assert.equal(calls, 0);
  assert.equal(other.licenseSafety.canDirectSell, false);

  const failing: FetchLike = async () => new Response('nope', { status: 503 });
  const printables = await captureModelFromUrl('https://www.printables.com/model/1-test', { fetchImpl: failing });
  assert.equal(printables.platform, 'PRINTABLES');
  assert.equal(printables.title, 'PRINTABLES Model');
});

test('captureModelFromUrl: og:description can never unlock selling', async () => {
  const fetchImpl: FetchLike = async () => htmlResponse(
    '<meta property="og:title" content="Flexi Dragon | Printables"><meta property="og:image" content="https://media.printables.com/x.jpg">' +
    '<meta property="og:description" content="Remix of a classic, attribution to the original author. CC BY 4.0">',
  );
  const draft = await captureModelFromUrl('https://www.printables.com/model/2-dragon', { fetchImpl });
  assert.equal(draft.title, 'Flexi Dragon');
  assert.equal(draft.coverUrl, 'https://media.printables.com/x.jpg');
  assert.equal(draft.licenseSafety.canDirectSell, false);
});

test('detectTrendPlatform uses suffix match, not substring', () => {
  assert.equal(detectTrendPlatform('https://makerworld.com.evil.io/en/models/1'), 'OTHER');
  assert.equal(detectTrendPlatform('https://evilprintables.com/model/1'), 'OTHER');
  assert.equal(detectTrendPlatform('https://www.printables.com/model/1'), 'PRINTABLES');
});

test('parseOpenGraph handles attribute order, entities and rejects non-https images', () => {
  const og = parseOpenGraph('<meta content="Tom &amp; Jerry" property="og:title"><meta property="og:image" content="http://insecure/x.png">');
  assert.equal(og.title, 'Tom & Jerry');
  assert.equal(og.image, undefined);
});

// ---------- I1: license classifier ----------

test('license: free text only tightens, never loosens', () => {
  assert.equal(evaluateLicenseSafety(null, 'Remix of a model, attribution to original author').canDirectSell, false);
  assert.equal(evaluateLicenseSafety(null, 'CC0 public domain').canDirectSell, false);
  assert.equal(evaluateLicenseSafety('CC BY 4.0', 'Personal use only, no selling — non-commercial').status, 'NON_COMMERCIAL');
  assert.equal(evaluateLicenseSafety('CC0', 'Get the commercial license via Patreon').status, 'COMMERCIAL_SUBSCRIPTION');
});

test('license: NC wins over "commercial license" wording', () => {
  assert.equal(evaluateLicenseSafety('Creative Commons Non-commercial license').status, 'NON_COMMERCIAL');
  assert.equal(evaluateLicenseSafety('Creative Commons - Attribution - Non-Commercial - Share Alike').status, 'NON_COMMERCIAL');
  assert.equal(evaluateLicenseSafety('BY-NC-SA').status, 'NON_COMMERCIAL');
  assert.equal(evaluateLicenseSafety('Standard Digital File License').status, 'NON_COMMERCIAL');
});

test('license: MakerWorld short codes and CC long names', () => {
  for (const code of ['BY', 'BY-SA', 'BY-ND', 'CC BY-SA 4.0', 'Creative Commons - Attribution - Share Alike']) {
    const r = evaluateLicenseSafety(code);
    assert.equal(r.status, 'COMMERCIAL_ALLOWED', code);
    assert.equal(r.requiresAttribution, true, code);
  }
  const cc0 = evaluateLicenseSafety('CC0');
  assert.equal(cc0.canDirectSell, true);
  assert.equal(cc0.requiresAttribution, false);
  assert.equal(evaluateLicenseSafety('GNU GPL v3').status, 'UNKNOWN');
  assert.equal(evaluateLicenseSafety('   ').status, 'UNKNOWN');
});

// ---------- I3: transitions ----------

test('watchlist transitions follow ADR-0062 §4', () => {
  assert.equal(canTransitionTrendStatus('WATCHING', 'PRINT_TESTING'), true);
  assert.equal(canTransitionTrendStatus('WATCHING', 'CONVERTED_DRAFT'), true);
  assert.equal(canTransitionTrendStatus('CONVERTED_DRAFT', 'WATCHING'), false);
  assert.equal(canTransitionTrendStatus('CONVERTED_DRAFT', 'PRINT_TESTING'), false);
  assert.equal(canTransitionTrendStatus('ARCHIVED', 'CONVERTED_DRAFT'), false);
  assert.equal(canTransitionTrendStatus('ARCHIVED', 'WATCHING'), true);
  assert.equal(canTransitionTrendStatus('PRINT_TESTING', 'PRINT_TESTING'), true);
});

test('trendWatchInputSchema rejects non-http(s) source and non-https cover', () => {
  const base = { sourceUrl: 'https://www.printables.com/model/1', platform: 'PRINTABLES', title: 'X' };
  assert.equal(trendWatchInputSchema.safeParse(base).success, true);
  assert.equal(trendWatchInputSchema.safeParse({ ...base, sourceUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(trendWatchInputSchema.safeParse({ ...base, coverUrl: 'http://x/y.png' }).success, false);
});
