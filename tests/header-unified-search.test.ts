// ADR-0064 — header unified search: pure helpers + route validation (no DB needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchSql, searchTokens, SEARCH_MAX_TOKENS } from '../src/lib/catalog/search-terms';
import { quoteHrefForModelUrl } from '../src/lib/search/quote-link';

test('searchTokens: NFC, whitespace split, dedupe, capped', () => {
  assert.deepEqual(searchTokens('  giá   đỡ  tai nghe '), ['giá', 'đỡ', 'tai', 'nghe']);
  assert.deepEqual(searchTokens('gia'.normalize('NFD')), ['gia']);
  assert.deepEqual(searchTokens('đỡ'.normalize('NFD')), ['đỡ'.normalize('NFC')]);
  assert.deepEqual(searchTokens('a a a'), ['a']);
  assert.equal(searchTokens('1 2 3 4 5 6 7 8 9').length, SEARCH_MAX_TOKENS);
  assert.deepEqual(searchTokens(''), []);
  assert.deepEqual(searchTokens(undefined), []);
});

test('buildSearchSql: one folded LIKE per token, metacharacters escaped, values appended', () => {
  const values: unknown[] = ['existing'];
  const sql = buildSearchSql('50% off_x', values);
  assert.deepEqual(values, ['existing', '%50\\%%', '%off\\_x%']);
  assert.equal(sql, ' and public.basa3d_search_fold(p.name) like public.basa3d_search_fold($2) and public.basa3d_search_fold(p.name) like public.basa3d_search_fold($3)');
  assert.equal(buildSearchSql('   ', []), '');
});

test('fold map in the migration covers every Vietnamese vowel (upper + lower) and đ/Đ', () => {
  const sql = readFileSync('supabase/migrations/20261126000000_storefront_search_fold.sql', 'utf8');
  const [, from, to] = sql.match(/translate\(input,\s*'([^']+)',\s*'([^']+)'\)/) ?? [];
  assert.ok(from && to);
  assert.equal([...from].length, [...to].length, 'translate() needs equal-length maps');
  for (const ch of 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ') {
    assert.ok(from.includes(ch) && from.includes(ch.toUpperCase()), `missing ${ch}`);
  }
  assert.match(sql, /immutable/i);
});

test('quoteHrefForModelUrl sends every link to the quote page (/bao-gia); falls back when /bao-gia is off', () => {
  const mw = 'https://makerworld.com/en/models/749527-x#profileId-1';
  assert.equal(quoteHrefForModelUrl(mw), '/bao-gia?tab=link&url=https%3A%2F%2Fmakerworld.com%2Fen%2Fmodels%2F749527-x%23profileId-1');
  assert.equal(quoteHrefForModelUrl(' https://makerworld.com.cn/zh/models/12 '), '/bao-gia?tab=link&url=https%3A%2F%2Fmakerworld.com.cn%2Fzh%2Fmodels%2F12');
  assert.equal(quoteHrefForModelUrl('makerworld.com/en/models/1'), '/bao-gia?tab=link&url=https%3A%2F%2Fmakerworld.com%2Fen%2Fmodels%2F1');
  assert.equal(quoteHrefForModelUrl('https://www.printables.com/model/3161-3d-benchy'), '/bao-gia?tab=file&ref=https%3A%2F%2Fwww.printables.com%2Fmodel%2F3161-3d-benchy');
  assert.equal(quoteHrefForModelUrl('https://makerworld.com.evil.io/en/models/1'), '/bao-gia?tab=file&ref=https%3A%2F%2Fmakerworld.com.evil.io%2Fen%2Fmodels%2F1');
  // /bao-gia disabled → previous destinations
  assert.equal(quoteHrefForModelUrl(mw, { baoGiaEnabled: false }), '/tools/makerworld-cn?url=https%3A%2F%2Fmakerworld.com%2Fen%2Fmodels%2F749527-x%23profileId-1');
  assert.equal(quoteHrefForModelUrl('https://www.printables.com/model/1', { baoGiaEnabled: false }), '/custom-print?ref=https%3A%2F%2Fwww.printables.com%2Fmodel%2F1');
  assert.equal(quoteHrefForModelUrl('javascript:alert(1)'), null);
  assert.equal(quoteHrefForModelUrl('not a url'), null);
  assert.equal(quoteHrefForModelUrl(''), null);
  assert.equal(quoteHrefForModelUrl(`https://x.com/${'a'.repeat(2100)}`), null);
});

test('suggest route: short, empty and repeated q return [] without touching the DB', async () => {
  const { GET } = await import('../src/app/api/public/products/suggest/route');
  for (const qs of ['', '?q=', '?q=a', '?q=%20%20', '?q=ab&q=cd']) {
    const res = await GET(new Request(`https://x/api/public/products/suggest${qs}`));
    assert.equal(res.status, 200, qs);
    assert.deepEqual((await res.json()).data.items, [], qs);
    assert.match(res.headers.get('cache-control') ?? '', /s-maxage=60/);
  }
});

test('sanitizeReferenceUrl only accepts plain http(s) URLs ≤ 2000 chars', async () => {
  const { sanitizeReferenceUrl } = await import('../src/lib/search/quote-link');
  assert.equal(sanitizeReferenceUrl('https://www.printables.com/model/1'), 'https://www.printables.com/model/1');
  assert.equal(sanitizeReferenceUrl(' http://x.test/a '), 'http://x.test/a');
  assert.equal(sanitizeReferenceUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeReferenceUrl(['https://a.test']), null);
  assert.equal(sanitizeReferenceUrl(undefined), null);
  assert.equal(sanitizeReferenceUrl(`https://a.test/${'x'.repeat(2000)}`), null);
});

test('Ctrl/⌘+K opens search; other combos do not', async () => {
  const { isOpenSearchShortcut } = await import('../src/components/storefront/search/search-events');
  const k = (o: Partial<KeyboardEvent>) => ({ key: 'k', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });
  assert.equal(isOpenSearchShortcut(k({ ctrlKey: true })), true);
  assert.equal(isOpenSearchShortcut(k({ metaKey: true, key: 'K' })), true);
  assert.equal(isOpenSearchShortcut(k({})), false);
  assert.equal(isOpenSearchShortcut(k({ ctrlKey: true, shiftKey: true })), false);
  assert.equal(isOpenSearchShortcut(k({ ctrlKey: true, key: 'j' })), false);
});

test('wiring: header renders HeaderSearch, dialog is lazy, /products empty state and /custom-print ?ref are connected', () => {
  const header = readFileSync('src/components/storefront/header.tsx', 'utf8');
  assert.match(header, /<HeaderSearch \/>/);
  const headerSearch = readFileSync('src/components/storefront/search/header-search.tsx', 'utf8');
  assert.match(headerSearch, /dynamic\(\(\) => import\('\.\/unified-search-dialog'\)/);
  assert.match(headerSearch, /ssr: false/);
  assert.doesNotMatch(header, /unified-search-dialog/, 'header must not import the dialog eagerly');
  assert.match(readFileSync('src/app/[locale]/(storefront)/products/page.tsx', 'utf8'), /<OpenModelSearchButton query=\{filters\.search\} \/>/);
  assert.match(readFileSync('src/app/[locale]/(storefront)/custom-print/page.tsx', 'utf8'), /sanitizeReferenceUrl\(resolved\?\.ref\)/);
  // Every external-library path ends with a way back to a quote.
  assert.match(readFileSync('src/components/storefront/search/model-search-panel.tsx', 'utf8'), /<QuoteLinkBox/);
});

test('owner feedback 2026-11-25: links land on /bao-gia, Zalo help on every search dialog, clearer wording', () => {
  const unified = readFileSync('src/components/storefront/search/unified-search-dialog.tsx', 'utf8');
  assert.match(unified, /<ZaloHelpBox placement=/);
  assert.match(unified, /<SearchHowItWorks \/>/);
  assert.match(readFileSync('src/components/storefront/model-search-dialog.tsx', 'utf8'), /<ZaloHelpBox placement=/);
  assert.match(readFileSync('src/components/storefront/search/quote-link-box.tsx', 'utf8'), /baoGiaEnabled: BAO_GIA_ENABLED_IN_BROWSER/);
  assert.match(readFileSync('src/app/[locale]/(storefront)/bao-gia/page.tsx', 'utf8'), /sanitizeReferenceUrl\(resolvedSearchParams\?\.ref\)/);
  const workspace = readFileSync('src/components/bao-gia/quote-workspace.tsx', 'utf8');
  assert.match(workspace, /if \(!isMakerWorldUrl\(parsed\)\)/, 'non-MakerWorld links switch to the file tab instead of a dead-end error');
  assert.match(workspace, /SITE_CONFIG\.zaloUrl/);
  const vi = JSON.parse(readFileSync('messages/vi.json', 'utf8')) as { headerSearch: Record<string, string> };
  assert.equal(vi.headerSearch.tabLibrary, 'Tìm mẫu 3D trên mạng');
  assert.ok(vi.headerSearch.zaloButton && vi.headerSearch.step1 && vi.headerSearch.libraryIntro);
});
