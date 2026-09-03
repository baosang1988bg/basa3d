import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MakerWorldBlockedOrTimeoutError,
  MakerWorldNotFoundError,
  MakerWorldProfileNotFoundError,
  parseMakerWorldUrl,
  resolveMakerWorldUrl,
  type FetchLike,
} from '../src/lib/parsers/makerworld-resolver.js';

const ACE_SNAIL_URL = 'https://makerworld.com/en/models/2851863-ace-snail-controller-stand#profileId-3334843';

// Ace Snail Controller Stand fixture: 8 plates, 13.2h (792 minutes) total print time, 7 filaments —
// the sample scenario named in phase-13.md. Shape follows the resolver's documented assumption
// (Next.js `__NEXT_DATA__` hydration payload) — see makerworld-resolver.ts's file header comment.
function buildAceSnailFixtureHtml(): string {
  const filaments = [
    { name: 'PLA Basic Black', colorHex: '#000000', type: 'PLA', weightGrams: 42 },
    { name: 'PLA Basic White', colorHex: '#FFFFFF', type: 'PLA', weightGrams: 38 },
    { name: 'PLA Basic Red', colorHex: '#FF0000', type: 'PLA', weightGrams: 21 },
    { name: 'PLA Basic Yellow', colorHex: '#FFFF00', type: 'PLA', weightGrams: 15 },
    { name: 'PLA Basic Green', colorHex: '#00FF00', type: 'PLA', weightGrams: 12 },
    { name: 'PLA Basic Blue', colorHex: '#0000FF', type: 'PLA', weightGrams: 9 },
    { name: 'PLA Basic Orange', colorHex: '#FFA500', type: 'PLA', weightGrams: 6 },
  ];
  const nextData = {
    props: {
      pageProps: {
        designDetail: {
          title: 'Ace Snail Controller Stand',
          coverUrl: 'https://makerworld.com/covers/ace-snail.jpg',
          instances: [
            { id: '3334843', plateCount: 8, printTimeMinutes: 792, filaments },
          ],
        },
      },
    },
  };
  return `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;
}

function fetchImplReturning(response: Response): FetchLike {
  return async () => response;
}

function fetchImplThrowingAbort(): FetchLike {
  return async () => {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    throw error;
  };
}

test('parseMakerWorldUrl extracts modelId and profileId from a valid URL', () => {
  const parsed = parseMakerWorldUrl(ACE_SNAIL_URL);
  assert.equal(parsed.modelId, '2851863');
  assert.equal(parsed.profileId, '3334843');
});

test('parseMakerWorldUrl rejects a non-makerworld.com hostname', () => {
  assert.throws(() => parseMakerWorldUrl('https://evil.com/models/123'), MakerWorldNotFoundError);
});

test('parseMakerWorldUrl accepts a makerworld.com subdomain', () => {
  const parsed = parseMakerWorldUrl('https://www.makerworld.com/en/models/999#profileId-1');
  assert.equal(parsed.modelId, '999');
});

test('parseMakerWorldUrl rejects a URL without a /models/<id> path', () => {
  assert.throws(() => parseMakerWorldUrl('https://makerworld.com/en/collections/123'), MakerWorldNotFoundError);
});

test('parseMakerWorldUrl rejects http:// (non-https)', () => {
  assert.throws(() => parseMakerWorldUrl('http://makerworld.com/en/models/123'), MakerWorldNotFoundError);
});

test('parseMakerWorldUrl rejects a malformed URL string', () => {
  assert.throws(() => parseMakerWorldUrl('not a url'), MakerWorldNotFoundError);
});

test('resolveMakerWorldUrl parses the Ace Snail fixture into 8 plates / 792 minutes (13.2h) / 7 filaments', async () => {
  const html = buildAceSnailFixtureHtml();
  const profile = await resolveMakerWorldUrl(ACE_SNAIL_URL, {
    fetchImpl: fetchImplReturning(new Response(html, { status: 200 })),
  });
  assert.equal(profile.title, 'Ace Snail Controller Stand');
  assert.equal(profile.platesCount, 8);
  assert.equal(profile.totalPrintMinutes, 792);
  assert.equal(profile.totalPrintMinutes / 60, 13.2);
  assert.equal(profile.filaments.length, 7);
  assert.equal(profile.filaments[0].materialType, 'PLA');
  assert.equal(profile.coverImageUrl, 'https://makerworld.com/covers/ace-snail.jpg');
});

test('resolveMakerWorldUrl throws MakerWorldBlockedOrTimeoutError on fetch abort (timeout)', async () => {
  await assert.rejects(
    resolveMakerWorldUrl(ACE_SNAIL_URL, { fetchImpl: fetchImplThrowingAbort() }),
    MakerWorldBlockedOrTimeoutError,
  );
});

test('resolveMakerWorldUrl throws MakerWorldBlockedOrTimeoutError on a Cloudflare-style 403 block', async () => {
  await assert.rejects(
    resolveMakerWorldUrl(ACE_SNAIL_URL, { fetchImpl: fetchImplReturning(new Response('blocked', { status: 403 })) }),
    MakerWorldBlockedOrTimeoutError,
  );
});

test('resolveMakerWorldUrl throws MakerWorldNotFoundError on a 404', async () => {
  await assert.rejects(
    resolveMakerWorldUrl(ACE_SNAIL_URL, { fetchImpl: fetchImplReturning(new Response('not found', { status: 404 })) }),
    MakerWorldNotFoundError,
  );
});

test('resolveMakerWorldUrl throws MakerWorldProfileNotFoundError when the page has no matching profileId', async () => {
  const nextData = {
    props: { pageProps: { designDetail: { title: 'Some model', coverUrl: null, instances: [{ id: '999999', plateCount: 1, printTimeMinutes: 10, filaments: [] }] } } },
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`;
  await assert.rejects(
    resolveMakerWorldUrl(ACE_SNAIL_URL, { fetchImpl: fetchImplReturning(new Response(html, { status: 200 })) }),
    MakerWorldProfileNotFoundError,
  );
});

test('resolveMakerWorldUrl throws MakerWorldProfileNotFoundError when the page has no __NEXT_DATA__ at all', async () => {
  await assert.rejects(
    resolveMakerWorldUrl(ACE_SNAIL_URL, { fetchImpl: fetchImplReturning(new Response('<html><body>no data here</body></html>', { status: 200 })) }),
    MakerWorldProfileNotFoundError,
  );
});

test('resolveMakerWorldUrl follows a redirect to an allowlisted makerworld.com host and re-validates it', async () => {
  const html = buildAceSnailFixtureHtml();
  let callCount = 0;
  const fetchImpl: FetchLike = async (_input, init) => {
    callCount += 1;
    if (callCount === 1) {
      return new Response(null, { status: 302, headers: { location: 'https://www.makerworld.com/en/models/2851863-ace-snail-controller-stand#profileId-3334843' } });
    }
    assert.equal(init?.redirect, 'manual');
    return new Response(html, { status: 200 });
  };
  const profile = await resolveMakerWorldUrl(ACE_SNAIL_URL, { fetchImpl });
  assert.equal(callCount, 2);
  assert.equal(profile.platesCount, 8);
});

test('resolveMakerWorldUrl refuses to follow a redirect to a non-allowlisted host (SSRF-via-redirect)', async () => {
  const fetchImpl: FetchLike = async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
  await assert.rejects(
    resolveMakerWorldUrl(ACE_SNAIL_URL, { fetchImpl }),
    MakerWorldNotFoundError,
  );
});

test('resolveMakerWorldUrl refuses to follow a redirect to an external domain even when it looks like makerworld.com in the path', async () => {
  const fetchImpl: FetchLike = async () => new Response(null, { status: 302, headers: { location: 'https://evil.com/makerworld.com/steal' } });
  await assert.rejects(
    resolveMakerWorldUrl(ACE_SNAIL_URL, { fetchImpl }),
    MakerWorldNotFoundError,
  );
});

test('resolveMakerWorldUrl gives up after too many redirect hops', async () => {
  const fetchImpl: FetchLike = async () => new Response(null, { status: 302, headers: { location: 'https://makerworld.com/en/models/2851863#profileId-3334843' } });
  await assert.rejects(
    resolveMakerWorldUrl(ACE_SNAIL_URL, { fetchImpl }),
    MakerWorldBlockedOrTimeoutError,
  );
});
