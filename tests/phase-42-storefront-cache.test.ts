import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  invalidateStorefrontCatalog,
  invalidatesStorefrontCatalog,
  STOREFRONT_CATALOG_TTL_SECONDS,
} from '../src/lib/cache/storefront-cache-tags';
import { isCacheableListing, MAX_CACHED_LISTING_PAGE } from '../src/lib/cache/storefront-cache';

// Phase 42 (ADR-0045) — storefront page/data caching.

const read = (path: string) => readFileSync(path, 'utf8');
// Strip comments so a guard can't be satisfied (or tripped) by explanatory prose.
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('invalidation is a silent no-op outside a Next.js request (services are called directly by tests/scripts)', () => {
  assert.doesNotThrow(() => invalidateStorefrontCatalog());
});

test('invalidatesStorefrontCatalog passes the committed result through and propagates a rolled-back write', async () => {
  assert.deepEqual(await invalidatesStorefrontCatalog(Promise.resolve({ id: 'x' })), { id: 'x' });
  await assert.rejects(invalidatesStorefrontCatalog(Promise.reject(new Error('rolled back'))), /rolled back/);
});

test('only bounded listing queries are cached (no free-text search, no deep pages)', () => {
  assert.equal(isCacheableListing({ limit: 8, featuredOnly: true }), true);
  assert.equal(isCacheableListing({ categoryId: '00000000-0000-0000-0000-000000000000', page: 2 }), true);
  assert.equal(isCacheableListing({ search: 'móc khoá' }), false);
  assert.equal(isCacheableListing({ search: '   ' }), true);
  assert.equal(isCacheableListing({ page: MAX_CACHED_LISTING_PAGE + 1 }), false);
  assert.equal(isCacheableListing({ page: Number.NaN }), false);
});

test('the root layout never reads the request — that alone made every route dynamic', () => {
  const layout = code('src/app/layout.tsx');
  assert.doesNotMatch(layout, /getLocale|headers\(|cookies\(|<html/);
});

test('[locale] layout renders the html shell from params and prerenders both locales (rewritten VI URLs are only cached when prerendered)', () => {
  const layout = code('src/app/[locale]/layout.tsx');
  assert.match(layout, /<HtmlShell lang=\{locale\}>/);
  assert.match(layout, /generateStaticParams\(\)\s*\{\s*return routing\.locales\.map/);
  assert.match(code('src/app/admin/layout.tsx'), /<HtmlShell lang="vi">/);
});

test('the root not-found boundary never reads the request (Next.js renders it into every page)', () => {
  const notFound = code('src/app/not-found.tsx');
  assert.match(notFound, /<HtmlShell lang="vi">/);
  assert.doesNotMatch(notFound, /getLocale|useLocale|useTranslations|getTranslations|headers\(|cookies\(/);
});

test('layouts rendered in parallel with pages set the request locale (next-intl static rendering)', () => {
  for (const path of [
    'src/app/[locale]/(storefront)/layout.tsx',
    'src/app/[locale]/(tools)/layout.tsx',
    'src/app/[locale]/(storefront)/custom-print/layout.tsx',
    'src/app/[locale]/(storefront)/privacy-policy/page.tsx',
  ]) assert.match(code(path), /await applyRequestLocale\(params\)/, path);
});

test('home is ISR with the catalog TTL, in both route files (segment config is not followed through re-exports)', () => {
  for (const path of ['src/app/[locale]/(storefront)/page.tsx', 'src/app/[locale]/(storefront)/home/page.tsx']) {
    const source = code(path);
    assert.doesNotMatch(source, /force-dynamic|export const dynamic/, path);
    assert.match(source, new RegExp(`export const revalidate = ${STOREFRONT_CATALOG_TTL_SECONDS};`), path);
  }
  const home = code('src/app/[locale]/(storefront)/page.tsx');
  assert.match(home, /applyRequestLocale\(params\)/);
  assert.match(home, /getCachedStorefrontProducts\(/);
  assert.doesNotMatch(home, /listStorefrontProducts\(|listCategories\(/);
  // A build without a reachable DB degrades Home to per-request rendering instead of failing.
  assert.match(home, /process\.env\.NEXT_PHASE === 'phase-production-build'\) await connection\(\)/);
});

test('every catalog/stock write invalidates the storefront cache after commit', () => {
  const expectations: Record<string, string[]> = {
    'src/services/product.service.ts': ['createCategory', 'createProduct', 'createVariant', 'updateVariant', 'deleteVariant', 'updateProduct', 'uploadProductImage', 'deleteProductImage', 'deleteProduct'],
    'src/services/inventory.service.ts': ['recordInventoryMovement'],
    'src/services/order.service.ts': ['updateOrderStatus', 'createOrder'],
  };
  for (const [path, functions] of Object.entries(expectations)) {
    const source = code(path);
    for (const name of functions) {
      const start = source.indexOf(`export async function ${name}(`);
      assert.ok(start >= 0, `${path}: ${name} not found`);
      const next = source.indexOf('\nexport ', start + 1);
      const body = source.slice(start, next === -1 ? undefined : next);
      assert.match(body, /invalidatesStorefrontCatalog\(withTransaction|invalidateStorefrontCatalog\(\)/, `${path}: ${name} must invalidate the storefront cache`);
    }
  }
});

test('the locale-less revalidatePath("/products") calls are gone (they never matched /[locale]/products)', () => {
  assert.doesNotMatch(code('src/app/admin/(protected)/product-inventory/actions.ts'), /revalidatePath\('\/products'\)/);
});
