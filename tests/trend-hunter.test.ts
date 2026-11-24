import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTrendPlatform,
  trendWatchInputSchema,
  evaluateLicenseSafety,
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

test('evaluateLicenseSafety correctly classifies license types', () => {
  // Standard MakerWorld license
  const standard = evaluateLicenseSafety('Standard Digital File License');
  assert.equal(standard.status, 'NON_COMMERCIAL');
  assert.equal(standard.canDirectSell, false);

  // Creative Commons Non-Commercial
  const ccNc = evaluateLicenseSafety('Creative Commons (4.0 International) Attribution-NonCommercial');
  assert.equal(ccNc.status, 'NON_COMMERCIAL');
  assert.equal(ccNc.canDirectSell, false);

  // CC-BY (Allowed with attribution)
  const ccBy = evaluateLicenseSafety('Creative Commons (4.0 International License) Attribution');
  assert.equal(ccBy.status, 'COMMERCIAL_ALLOWED');
  assert.equal(ccBy.canDirectSell, true);
  assert.equal(ccBy.requiresAttribution, true);

  // CC0 Public Domain
  const cc0 = evaluateLicenseSafety('CC0 1.0 Universal Public Domain');
  assert.equal(cc0.status, 'COMMERCIAL_ALLOWED');
  assert.equal(cc0.canDirectSell, true);

  // Commercial Club / Patreon
  const club = evaluateLicenseSafety('Standard', 'Commercial license available via Patreon or Printables Club');
  assert.equal(club.status, 'COMMERCIAL_SUBSCRIPTION');
  assert.equal(club.canDirectSell, false);

  // Unknown / Missing
  const unknown = evaluateLicenseSafety(null);
  assert.equal(unknown.status, 'UNKNOWN');
  assert.equal(unknown.canDirectSell, false);
});
