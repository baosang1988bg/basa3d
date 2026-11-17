// Phase 56 — security/legal hardening (docs/exec-plans/active/phase-56-security-legal-hardening.md).
// Pure tests always run; DB-backed tests need the disposable local PostgreSQL (TEST_DATABASE_URL).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import { Client } from 'pg';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool } from '../src/lib/db.js';
import { publicSiteUrl } from '../src/config/site-url.js';
import { LISTING_MAX_PAGE, LISTING_SEARCH_MAX_LENGTH, sanitizeListingParams } from '../src/lib/catalog/listing-params.js';
import { BLOG_CACHE_TTL_SECONDS, invalidateBlogCache, isPlausibleBlogSlug } from '../src/lib/cache/blog-cache.js';
import { listStorefrontProducts } from '../src/services/storefront-catalog.service.js';
import sitemap from '../src/app/sitemap.js';
import viMessages from '../messages/vi.json' with { type: 'json' };

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const read = (path: string) => readFileSync(path, 'utf8');

test('publicSiteUrl: configured origin wins, trailing slash/path dropped, junk falls back', () => {
  assert.equal(publicSiteUrl('https://basain3d.com/'), 'https://basain3d.com');
  assert.equal(publicSiteUrl('https://basain3d.com/some/path'), 'https://basain3d.com');
  assert.equal(publicSiteUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(publicSiteUrl(''), 'https://basa3d.vn');
  assert.equal(publicSiteUrl('javascript:alert(1)'), 'https://basa3d.vn');
  assert.equal(publicSiteUrl('not a url'), 'https://basa3d.vn');
});

test('customer-facing links are built from publicSiteUrl(), never a hard-coded domain', () => {
  for (const path of [
    'src/app/[locale]/(storefront)/order-confirmation/[orderNumber]/page.tsx',
    'src/components/admin/copy-zalo-quote-button.tsx',
    'src/app/admin/(protected)/custom-requests/[id]/page.tsx',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /https:\/\/basa3d\.vn\/(quotes|order-confirmation)/, path);
    assert.match(source, /publicSiteUrl\(\)/, path);
  }
});

test('sanitizeListingParams: only real filters survive', () => {
  assert.deepEqual(sanitizeListingParams({}), { search: undefined, productType: undefined, categoryId: undefined, page: 1 });
  const id = randomUUID();
  assert.deepEqual(sanitizeListingParams({ q: '  mèo  ', type: 'READY_STOCK', categoryId: id.toUpperCase(), page: '3' }),
    { search: 'mèo', productType: 'READY_STOCK', categoryId: id, page: 3 });
  assert.equal(sanitizeListingParams({ q: 'x'.repeat(5000) }).search?.length, LISTING_SEARCH_MAX_LENGTH);
  assert.equal(sanitizeListingParams({ categoryId: "1' or '1'='1" }).categoryId, undefined, 'used to reach PostgreSQL and fail the uuid cast');
  assert.equal(sanitizeListingParams({ type: 'ANYTHING' }).productType, undefined);
  assert.equal(sanitizeListingParams({ q: ['a', 'b'], categoryId: [id] }).search, undefined, 'repeated query keys are not filters');
  for (const page of ['0', '-4', '1.5', 'abc', '1e9']) assert.ok(sanitizeListingParams({ page }).page >= 1 && sanitizeListingParams({ page }).page <= LISTING_MAX_PAGE, page);
  assert.equal(sanitizeListingParams({ page: '999999' }).page, LISTING_MAX_PAGE);
});

test('blog cache: implausible slugs never reach the database; invalidation is silent outside Next.js', () => {
  assert.equal(isPlausibleBlogSlug('diem-tin-in-3d-2026-11-17'), true);
  for (const slug of ['', 'Has-Upper', 'a b', '../admin', 'a--b', '-a', "x'; drop table", 'a'.repeat(201)]) assert.equal(isPlausibleBlogSlug(slug), false, slug);
  assert.ok(BLOG_CACHE_TTL_SECONDS > 0 && BLOG_CACHE_TTL_SECONDS <= 300);
  assert.doesNotThrow(() => invalidateBlogCache());
});

test('public blog pages read through the cache, and every blog admin write invalidates it', () => {
  for (const path of ['src/app/[locale]/(storefront)/blog/page.tsx', 'src/app/[locale]/(storefront)/blog/[slug]/page.tsx']) {
    const source = read(path);
    assert.doesNotMatch(source, /from '@\/services\/blog\.service'/, `${path} must not query the service directly`);
    assert.match(source, /getCachedPublished/, path);
  }
  const actions = read('src/app/admin/(protected)/blog/actions.ts');
  const writes = actions.match(/await (createBlogPostWithCover|updateBlogPostWithCover|createBlogPost|updateBlogPost)\(/g) ?? [];
  const invalidations = actions.match(/invalidateBlogCache\(\)/g) ?? [];
  assert.ok(writes.length > 0 && invalidations.length >= writes.length, `${writes.length} writes, ${invalidations.length} invalidations`);
  assert.match(read('src/app/admin/(protected)/blog/review/actions.ts'), /invalidateBlogCache\(\)/);
});

test('privacy policy names the processors the code really uses, and the footer no longer over-promises', () => {
  const privacy = viMessages.policies.privacy as Record<string, string>;
  const text = Object.values(privacy).join(' ');
  for (const name of ['Google Analytics', 'Supabase', 'Gemini', 'ngoài Việt Nam']) assert.ok(text.includes(name), name);
  for (const key of ['rightsItem1', 'rightsItem2', 'rightsItem3', 'storageBody']) assert.ok(privacy[key], key);
  assert.doesNotMatch(viMessages.footer.commitment1, /tuyệt đối/);
  const page = read('src/app/[locale]/(storefront)/privacy-policy/page.tsx');
  for (const key of Object.keys(privacy).filter((name) => !name.startsWith('meta') && name !== 'title')) assert.ok(page.includes(`t('${key}'`), `privacy page must render ${key}`);
});

test('next is on a release without the published critical advisories', () => {
  const [major, minor, patch] = JSON.parse(read('package.json')).dependencies.next.split('.').map(Number);
  assert.ok(major > 15 || (major === 15 && (minor > 5 || (minor === 5 && patch >= 29))), 'GHSA-2464-fhr4-w9xw / GHSA-p3m5-59mp-jv5r are fixed in 15.5.29');
  const locked = JSON.parse(read('package-lock.json')).packages['node_modules/next'].version;
  assert.equal(locked, JSON.parse(read('package.json')).dependencies.next, 'lockfile and package.json agree');
});

test('DB: storefront search treats % and _ literally', { skip: !hasDb }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const tag = randomUUID().slice(0, 8);
    await client.query(
      `insert into products (name, slug, product_type, status, base_price) values ($1, $2, 'MADE_TO_ORDER', 'ACTIVE', 1000), ($3, $4, 'MADE_TO_ORDER', 'ACTIVE', 1000)`,
      [`Giảm 100% ${tag}`, `p56-a-${tag}`, `Kệ thường ${tag}`, `p56-b-${tag}`]);
    const names = async (search: string) => (await listStorefrontProducts({ search, limit: 50 })).items.map((item) => item.name);
    assert.deepEqual(await names(`100% ${tag}`), [`Giảm 100% ${tag}`]);
    assert.deepEqual((await names(tag)).sort(), [`Giảm 100% ${tag}`, `Kệ thường ${tag}`].sort());
    assert.deepEqual(await names(`%${tag}`), [], 'a leading % is a literal character, not "match anything"');
    assert.deepEqual(await names(`K_ thường ${tag}`), [], '_ is a literal character, not "any one character"');
  } finally {
    await client.end();
  }
});

test('DB: sitemap is memoised between calls (one read per TTL, not per request)', { skip: !hasDb }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const first = await sitemap();
    const slug = `p56-sitemap-${randomUUID().slice(0, 8)}`;
    await client.query(`insert into products (name, slug, product_type, status, base_price) values ($1, $1, 'MADE_TO_ORDER', 'ACTIVE', 1000)`, [slug]);
    const second = await sitemap();
    assert.equal(second.length, first.length);
    assert.equal(second.some((entry) => entry.url.endsWith(`/products/${slug}`)), false, 'served from the memo, no second DB read');
    assert.equal(first.some((entry) => entry.url.includes('/admin')), false);
  } finally {
    await client.end();
  }
});
