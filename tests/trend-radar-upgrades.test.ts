// ADR-0063 — Trend Radar upgrades: platform license adapters, velocity, cache hash, publish-gate mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { FetchLike } from '../src/lib/net/safe-fetch';
import {
  extractPrintablesModelId,
  extractThingiverseThingId,
  fetchPrintablesMetadata,
  fetchThingiverseMetadata,
  formatPrintablesLicense,
} from '../src/lib/trend/platform-sources';
import { captureModelFromUrl, computePopularity } from '../src/services/trend-hunter.service';
import { visualSearchImageHash } from '../src/services/visual-search-cache.service';
import { translateImportGateError } from '../src/lib/stl-import/publish-gate';
import { DomainError } from '../src/lib/domain-error';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('id extraction for Printables / Thingiverse URLs', () => {
  assert.equal(extractPrintablesModelId('https://www.printables.com/model/123456-flexi-dragon'), '123456');
  assert.equal(extractPrintablesModelId('https://www.printables.com/model/123456/files'), '123456');
  assert.equal(extractPrintablesModelId('https://www.printables.com/social/1/about'), null);
  assert.equal(extractThingiverseThingId('https://www.thingiverse.com/thing:6000000'), '6000000');
  assert.equal(extractThingiverseThingId('https://www.thingiverse.com/thing:6000000/files'), '6000000');
  assert.equal(extractThingiverseThingId('https://www.thingiverse.com/user/x'), null);
});

test('formatPrintablesLicense keeps name + abbreviation for the classifier', () => {
  assert.equal(formatPrintablesLicense({ name: 'Creative Commons — Attribution — Noncommercial', abbreviation: 'CC BY-NC' }), 'Creative Commons — Attribution — Noncommercial (CC BY-NC)');
  assert.equal(formatPrintablesLicense({ name: null, abbreviation: 'CC0' }), 'CC0');
  assert.equal(formatPrintablesLicense(null), null);
});

test('Printables adapter: POSTs GraphQL to the allowlisted host; stats failure does not lose the license', async () => {
  const calls: { url: string; body: string }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url: url.href, body: String(init.body) });
    assert.equal(init.method, 'POST');
    const op = JSON.parse(String(init.body)).operationName;
    if (op === 'PrintDetail') return json({ data: { print: { id: '42', name: 'Gear Box', license: { id: '7', name: 'Creative Commons — Attribution', abbreviation: 'CC BY' } } } });
    return json({ errors: [{ message: 'Cannot query field "makesCount"' }] }, 400);
  };
  const meta = await fetchPrintablesMetadata('42', { fetchImpl });
  assert.ok(meta);
  assert.equal(meta.title, 'Gear Box');
  assert.equal(meta.license, 'Creative Commons — Attribution (CC BY)');
  assert.equal(meta.stats, null);
  assert.ok(calls.every((call) => call.url === 'https://api.printables.com/graphql/'));
});

test('Printables adapter: schema drift → null (never "allowed")', async () => {
  const fetchImpl: FetchLike = async () => json({ data: { print: { license: 'oops-a-string' } } });
  assert.equal(await fetchPrintablesMetadata('1', { fetchImpl }), null);
  const missing: FetchLike = async () => json({ data: { print: null } });
  assert.equal(await fetchPrintablesMetadata('1', { fetchImpl: missing }), null);
});

test('Thingiverse adapter: skipped without token, parses license/stats with token', async () => {
  let calls = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    calls += 1;
    assert.equal(url.hostname, 'api.thingiverse.com');
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer tv-token');
    return json({ name: 'Cable Clip', license: 'Creative Commons - Attribution - Non-Commercial', thumbnail: 'https://cdn.thingiverse.com/x.jpg', like_count: 120, download_count: '5400', creator: { name: 'maker' } });
  };
  assert.equal(await fetchThingiverseMetadata('9', { fetchImpl, token: '' }), null);
  assert.equal(calls, 0);
  const meta = await fetchThingiverseMetadata('9', { fetchImpl, token: 'tv-token' });
  assert.ok(meta);
  assert.equal(meta.license, 'Creative Commons - Attribution - Non-Commercial');
  assert.deepEqual(meta.stats, { downloads: 5400, likes: 120, prints: null });
  assert.equal(meta.coverUrl, 'https://cdn.thingiverse.com/x.jpg');
});

test('capture: Printables structured license drives the verdict; description cannot loosen it', async () => {
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.hostname === 'api.printables.com') {
      const op = JSON.parse(String(init.body)).operationName;
      if (op === 'PrintDetail') return json({ data: { print: { id: '5', name: 'Hinge', license: { name: 'Creative Commons — Attribution — Noncommercial', abbreviation: 'CC BY-NC' } } } });
      return json({ data: { print: { id: '5', likesCount: 10, downloadCount: 300, makesCount: 4 } } });
    }
    return new Response('<meta property="og:image" content="https://media.printables.com/h.jpg"><meta property="og:description" content="Free for commercial use! CC0">', { status: 200 });
  };
  const draft = await captureModelFromUrl('https://www.printables.com/model/5-hinge', { fetchImpl });
  assert.equal(draft.title, 'Hinge');
  assert.equal(draft.licenseSource, 'PLATFORM_API');
  assert.equal(draft.licenseSafety.status, 'NON_COMMERCIAL');
  assert.equal(draft.coverUrl, 'https://media.printables.com/h.jpg');
  assert.deepEqual(draft.stats, { downloads: 300, likes: 10, prints: 4 });
});

test('capture: Printables API down → license NONE, stays not-sellable', async () => {
  const fetchImpl: FetchLike = async (url) => (url.hostname === 'api.printables.com' ? new Response('x', { status: 503 }) : new Response('<title>X | Printables</title>', { status: 200 }));
  const draft = await captureModelFromUrl('https://www.printables.com/model/6-x', { fetchImpl });
  assert.equal(draft.licenseSource, 'NONE');
  assert.equal(draft.licenseSafety.canDirectSell, false);
  assert.equal(draft.title, 'X');
});

test('computePopularity: per-day velocity needs two snapshots', () => {
  assert.equal(computePopularity({ snap_on: null, snap_downloads: null, snap_likes: null, snap_prints: null, base_on: null, base_downloads: null, base_likes: null }), null);
  const single = computePopularity({ snap_on: '2026-11-25', snap_downloads: 500, snap_likes: 10, snap_prints: null, base_on: null, base_downloads: null, base_likes: null });
  assert.equal(single?.downloadsPerDay, null);
  const week = computePopularity({ snap_on: '2026-11-25', snap_downloads: 1200, snap_likes: 80, snap_prints: 3, base_on: '2026-11-18', base_downloads: 500, base_likes: 10 });
  assert.equal(week?.windowDays, 7);
  assert.equal(week?.downloadsPerDay, 100);
  assert.equal(week?.likesPerDay, 10);
});

test('visualSearchImageHash ignores the data-URL prefix and is stable', () => {
  const raw = Buffer.from('fake-jpeg-bytes').toString('base64');
  const a = visualSearchImageHash(raw);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(visualSearchImageHash(`data:image/jpeg;base64,${raw}`), a);
  assert.notEqual(visualSearchImageHash(Buffer.from('other').toString('base64')), a);
});

test('trend publish-gate exception becomes a readable 409', () => {
  const translated = translateImportGateError({ code: 'P0001', message: 'TREND_PUBLISH_BLOCKED:LICENSE_PROOF_REQUIRED' });
  assert.ok(translated instanceof DomainError);
  assert.equal(translated.status, 409);
  assert.equal(translated.code, 'TREND_PUBLISH_BLOCKED');
});

// Real license strings captured live on 2026-11-25: Printables `licenses` GraphQL query (formatted as
// "name (abbreviation)" like formatPrintablesLicense does) and MakerWorld __NEXT_DATA__ design.license.
test('license classifier against every live Printables license + MakerWorld codes', async () => {
  const { evaluateLicenseSafety } = await import('../src/lib/trend/license-safety');
  const expected: [string, string][] = [
    ['Creative Commons — Public Domain (CC0)', 'COMMERCIAL_ALLOWED'],
    ['Creative Commons — Attribution (CC-BY)', 'COMMERCIAL_ALLOWED'],
    ['Creative Commons — Attribution  — Share Alike (CC-BY-SA)', 'COMMERCIAL_ALLOWED'],
    ['Creative Commons — Attribution — NoDerivatives (CC-BY-ND)', 'COMMERCIAL_ALLOWED'],
    ['Creative Commons — Attribution  — Noncommercial (CC-BY-NC)', 'NON_COMMERCIAL'],
    ['Creative Commons — Attribution  — Noncommercial  —  Share Alike (CC-BY-NC-SA)', 'NON_COMMERCIAL'],
    ['Creative Commons — Attribution  — Noncommercial  —  NoDerivatives (CC-BY-NC-ND)', 'NON_COMMERCIAL'],
    ['GNU General Public License v2.0 (GPL 2.0)', 'UNKNOWN'],
    ['GNU General Public License v3.0 (GPL 3.0)', 'UNKNOWN'],
    ['GNU Lesser General Public License (LGPL)', 'UNKNOWN'],
    ['BSD License (BSD)', 'UNKNOWN'],
    ['Standard Digital File License (Standard Digital File)', 'NON_COMMERCIAL'],
    ['Commercial Use - No Derivative (Comm. - No Derivative)', 'COMMERCIAL_SUBSCRIPTION'],
    ['Commercial Use', 'COMMERCIAL_SUBSCRIPTION'],
    ['Open Community License v1 (OCL v1)', 'UNKNOWN'],
    ['Open Community License v1.1 + Micro Business v1 (OCL v1.1 + Micro v1)', 'UNKNOWN'],
    ['Open Community License v1.1 (OCL v1.1)', 'UNKNOWN'],
    ['Open Community License v1.1 + General Attribution v1 (OCL v1.1 + GAtt v1)', 'UNKNOWN'],
    ['Open Community License v1.1 + Research & Development v1 (OCL v1.1 + RnD v1)', 'UNKNOWN'],
    ['Open Community License v1.1 + GAtt v1 + Micro v1 (OCL v1.1 + GAtt v1 + Micro v1)', 'UNKNOWN'],
    ['Open Community License v1.1 + GAtt v1 + RnD v1 (OCL v1.1 + GAtt v1 + RnD v1)', 'UNKNOWN'],
    ['CERN Open Hardware Licence Version 2 - Strongly Reciprocal (CERN-OHL-S v2)', 'UNKNOWN'],
    ['Apache License 2.0 (Apache-2.0)', 'UNKNOWN'],
    ['Standard Digital File License', 'NON_COMMERCIAL'],
    ['BY-NC-SA', 'NON_COMMERCIAL'],
    ['BY-SA', 'COMMERCIAL_ALLOWED'],
  ];
  for (const [license, status] of expected) {
    assert.equal(evaluateLicenseSafety(license).status, status, license);
  }
});

test('Printables adapter parses the exact live responses (model 3161, captured 2026-11-25)', async () => {
  const live: Record<string, unknown> = {
    PrintDetail: { data: { print: { id: '3161', name: '3D BENCHY', license: { id: '7', name: 'Creative Commons — Public Domain', abbreviation: 'CC0' } } } },
    PrintStats: { data: { print: { id: '3161', likesCount: 22972, downloadCount: 602593, makesCount: 9137 } } },
  };
  const fetchImpl: FetchLike = async (_url, init) => json(live[JSON.parse(String(init.body)).operationName]);
  const meta = await fetchPrintablesMetadata('3161', { fetchImpl });
  assert.deepEqual(meta, {
    title: '3D BENCHY', coverUrl: null, author: null,
    license: 'Creative Commons — Public Domain (CC0)',
    stats: { downloads: 602593, likes: 22972, prints: 9137 },
  });
});

test('visual search uses the shared vision helper: supported default model, header key, thought parts skipped', async () => {
  const { analyzeImageForModelSearch } = await import('../src/lib/search/visual-search');
  const { DEFAULT_VISION_MODEL } = await import('../src/lib/vision/gemini-vision');
  const calls: { url: string; headers: Record<string, string>; body: { contents: { parts: { inline_data?: { data: string } }[] }[] } }[] = [];
  const fetchImpl = async (input: string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [
      { text: 'thinking...', thought: true },
      { text: JSON.stringify({ objectName: 'Flexi Cat', keywordsEn: ['flexi cat', 'articulated cat'], keywordsZh: ['关节猫'], category: 'Fidget Toy' }) },
    ] } }] }), { status: 200 });
  };
  const raw = Buffer.from('jpeg').toString('base64');
  const result = await analyzeImageForModelSearch(`data:image/jpeg;base64,${raw}`, 'image/jpeg', { apiKey: 'k', fetchImpl });
  assert.equal(result?.objectName, 'Flexi Cat');
  assert.equal(result?.aiUsed, true);
  assert.ok(calls[0].url.includes(`/models/${DEFAULT_VISION_MODEL}:generateContent`));
  assert.ok(!calls[0].url.includes('key='));
  assert.equal(calls[0].headers['x-goog-api-key'], 'k');
  assert.equal(calls[0].body.contents[0].parts[1].inline_data?.data, raw);

  const failing = async () => new Response('nope', { status: 404 });
  assert.equal(await analyzeImageForModelSearch(raw, 'image/jpeg', { apiKey: 'k', fetchImpl: failing }), null);
  const injected = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ objectName: 'x', keywordsEn: [] }) }] } }] }), { status: 200 });
  assert.equal(await analyzeImageForModelSearch(raw, 'image/jpeg', { apiKey: 'k', fetchImpl: injected }), null);
});

test('trend-snapshots cron route fails closed without the bearer secret', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'trend-cron-secret-0123456789';
  try {
    const { GET } = await import('../src/app/api/cron/trend-snapshots/route');
    assert.equal((await GET(new Request('https://x/api/cron/trend-snapshots'))).status, 401);
    assert.equal((await GET(new Request('https://x/api/cron/trend-snapshots', { headers: { authorization: 'Bearer wrong-secret-0123456789' } }))).status, 401);
  } finally {
    process.env.CRON_SECRET = previous;
  }
});
