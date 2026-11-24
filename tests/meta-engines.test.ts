import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_ENGINES,
  optimizeSearchKeywords,
  buildGoogle3dSearchUrl,
  CURATED_TREND_FEEDS,
} from '../src/lib/search/meta-engines';

test('MODEL_ENGINES contains core ecosystems and valid search generators', () => {
  const ids = MODEL_ENGINES.map((e) => e.id);
  assert.ok(ids.includes('makerworld-cn'));
  assert.ok(ids.includes('makerworld-global'));
  assert.ok(ids.includes('yeggi'));
  assert.ok(ids.includes('thangs'));
  assert.ok(ids.includes('printables'));
  assert.ok(ids.includes('thingiverse'));

  // Test search url generator with special characters
  const mw = MODEL_ENGINES.find((e) => e.id === 'makerworld-cn');
  assert.ok(mw);
  const searchUrl = mw.buildSearchUrl('phone stand & holder');
  assert.ok(searchUrl.includes('keyword=phone%20stand%20%26%20holder'));
});

test('optimizeSearchKeywords translates Vietnamese terms to EN and ZH keywords', () => {
  const res1 = optimizeSearchKeywords('giá đỡ tai nghe');
  assert.ok(res1.suggestedEn?.includes('headphone stand'));
  assert.ok(res1.suggestedZh?.includes('耳机'));

  const res2 = optimizeSearchKeywords('đồ chơi xả stress');
  assert.ok(res2.suggestedEn?.includes('fidget'));
  assert.ok(res2.suggestedZh?.includes('解压'));

  const res3 = optimizeSearchKeywords('custom non existing 123');
  assert.equal(res3.normalized, 'custom non existing 123');
  assert.equal(res3.suggestedEn, undefined);
});

test('buildGoogle3dSearchUrl appends 3D model site restrictions', () => {
  const url = buildGoogle3dSearchUrl('dragon articulated');
  assert.ok(url.includes('google.com/search?q='));
  assert.ok(url.includes('makerworld.com'));
  assert.ok(url.includes('thingiverse.com'));
});

test('CURATED_TREND_FEEDS has working feeds with valid URLs', () => {
  assert.ok(CURATED_TREND_FEEDS.length >= 6);
  for (const feed of CURATED_TREND_FEEDS) {
    assert.ok(feed.url.startsWith('https://'));
    assert.ok(feed.title.length > 0);
  }
});
