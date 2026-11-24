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

test('quoteHrefForModelUrl routes MakerWorld to the quote tool, other https links to /custom-print', () => {
  assert.equal(quoteHrefForModelUrl('https://makerworld.com/en/models/749527-x#profileId-1'), '/tools/makerworld-cn?url=https%3A%2F%2Fmakerworld.com%2Fen%2Fmodels%2F749527-x%23profileId-1');
  assert.equal(quoteHrefForModelUrl(' https://makerworld.com.cn/zh/models/12 '), '/tools/makerworld-cn?url=https%3A%2F%2Fmakerworld.com.cn%2Fzh%2Fmodels%2F12');
  assert.equal(quoteHrefForModelUrl('makerworld.com/en/models/1'), '/tools/makerworld-cn?url=https%3A%2F%2Fmakerworld.com%2Fen%2Fmodels%2F1');
  assert.equal(quoteHrefForModelUrl('https://www.printables.com/model/3161-3d-benchy'), '/custom-print?ref=https%3A%2F%2Fwww.printables.com%2Fmodel%2F3161-3d-benchy');
  assert.equal(quoteHrefForModelUrl('https://makerworld.com.evil.io/en/models/1'), '/custom-print?ref=https%3A%2F%2Fmakerworld.com.evil.io%2Fen%2Fmodels%2F1');
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
