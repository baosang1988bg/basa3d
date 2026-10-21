import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

// EN-off routing (NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED != 'true'). The test runner and Playwright
// force the flag on so e2e/i18n.spec.ts keeps covering EN; this file covers the production default.
// The flag is read at module load, so it is set before the dynamic import. node --test runs each
// file in its own process, so this does not leak into other test files.
process.env.NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED = 'false';
const { middleware } = await import('../src/middleware.js');
const { routing } = await import('../src/i18n/routing.js');

const BASE = 'http://localhost:3000';
const run = (path: string) => middleware(new NextRequest(new URL(path, BASE)));

test('only VI is routable while EN is disabled', () => {
  assert.deepEqual(routing.locales, ['vi']);
});

for (const [from, to] of [
  ['/en', '/home'],
  ['/en/', '/'],
  ['/en/products', '/products'],
  ['/en/products/abc-123', '/products/abc-123'],
  ['/en/privacy-policy?utm_source=x', '/privacy-policy?utm_source=x'],
] as const) {
  test(`${from} 308-redirects to ${to}`, async () => {
    const response = await run(from);
    assert.equal(response.status, 308);
    const location = new URL(response.headers.get('location') ?? '');
    assert.equal(location.pathname + location.search, to);
  });
}

test('/english-* and unprefixed VI paths are not treated as EN', async () => {
  for (const path of ['/english-guide', '/products']) {
    const response = await run(path);
    assert.ok(response.status < 300 || response.status >= 400, `${path} must not redirect (got ${response.status})`);
  }
});
