import assert from 'node:assert/strict';
import test from 'node:test';
import { englishPath, localeAlternates } from '../src/i18n/seo.js';

test('englishPath prefixes /en and maps the root to /en', () => {
  assert.equal(englishPath('/'), '/en');
  assert.equal(englishPath('/products/abc'), '/en/products/abc');
});

test('localeAlternates emits hreflang only while EN is enabled', () => {
  assert.deepEqual(localeAlternates('/products', false), { canonical: '/products' });
  assert.deepEqual(localeAlternates('/products', true), {
    canonical: '/products',
    languages: { vi: '/products', en: '/en/products' },
  });
  assert.deepEqual(localeAlternates('/', true).languages, { vi: '/', en: '/en' });
});
