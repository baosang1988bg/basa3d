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
