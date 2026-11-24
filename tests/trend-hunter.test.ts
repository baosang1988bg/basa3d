import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTrendPlatform,
  trendWatchInputSchema,
} from '../src/services/trend-hunter.service';

test('detectTrendPlatform correctly classifies URLs', () => {
  assert.equal(
    detectTrendPlatform('https://makerworld.com.cn/zh/models/700000'),
    'MAKERWORLD_CN'
  );
  assert.equal(
    detectTrendPlatform('https://makerworld.com/en/models/2851863#profileId-3334843'),
    'MAKERWORLD'
  );
  assert.equal(
    detectTrendPlatform('https://www.printables.com/model/500000-dummy'),
    'PRINTABLES'
  );
  assert.equal(
    detectTrendPlatform('https://www.thingiverse.com/thing:6000000'),
    'THINGIVERSE'
  );
  assert.equal(
    detectTrendPlatform('https://thangs.com/m/800000'),
    'THANGS'
  );
  assert.equal(
    detectTrendPlatform('https://www.douyin.com/video/7300000000000000000'),
    'DOUYIN'
  );
  assert.equal(
    detectTrendPlatform('https://example.com/some/model'),
    'OTHER'
  );
});

test('trendWatchInputSchema validates proper inputs and rejects invalid ones', () => {
  const valid = {
    sourceUrl: 'https://makerworld.com.cn/zh/models/700000',
    platform: 'MAKERWORLD_CN',
    title: 'Hộp lọc cà phê V60',
    estimatedGrams: 145.5,
    estimatedPrintMinutes: 240,
    plateCount: 2,
    categoryTag: 'Gia dụng',
  };

  const parsed = trendWatchInputSchema.safeParse(valid);
  assert.ok(parsed.success);

  // Negative weight rejected
  const invalidWeight = { ...valid, estimatedGrams: -10 };
  const resWeight = trendWatchInputSchema.safeParse(invalidWeight);
  assert.equal(resWeight.success, false);

  // Invalid URL rejected
  const invalidUrl = { ...valid, sourceUrl: 'not-a-valid-url' };
  const resUrl = trendWatchInputSchema.safeParse(invalidUrl);
  assert.equal(resUrl.success, false);
});
