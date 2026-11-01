import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePhotoBookPrice,
  resolveFormatTier,
  BOOK_MARGIN_MULTIPLIER,
} from '../src/lib/3d-tools/book-maker/book-maker-pricing';

test('resolveFormatTier categorizes sizes accurately', () => {
  assert.equal(resolveFormatTier('V-MINI'), 'MINI');
  assert.equal(resolveFormatTier('H-GO'), 'MINI');
  assert.equal(resolveFormatTier('V-SQUARE'), 'MEDIUM');
  assert.equal(resolveFormatTier('H-WIDE'), 'MEDIUM');
  assert.equal(resolveFormatTier('V-69'), 'LARGE');
  assert.equal(resolveFormatTier('V-1015'), 'LARGE');
  assert.equal(resolveFormatTier('V-PHOTOBOX'), 'LARGE');
});

test('calculatePhotoBookPrice applies 40% margin over base production cost', () => {
  assert.equal(BOOK_MARGIN_MULTIPLIER, 1.4);

  // Mini 8 pages blank cover:
  // base cover price: round(36k * 1.4) = 50k
  // per frame: round(4.3k * 1.4) = 6k
  // 8 frames = 48k
  // total = 98k (range ~95k - 105k)
  const mini8Blank = calculatePhotoBookPrice({
    formatId: 'V-MINI',
    pageCount: 8,
    frontCoverType: 'blank',
  });

  assert.equal(mini8Blank.formatTier, 'MINI');
  assert.equal(mini8Blank.baseCoverPriceVnd, 50_000);
  assert.equal(mini8Blank.perFramePriceVnd, 6_000);
  assert.equal(mini8Blank.framesTotalPriceVnd, 48_000);
  assert.equal(mini8Blank.photoCoverPriceVnd, 0);
  assert.equal(mini8Blank.totalEstimatedVnd, 98_000);
  assert.ok(mini8Blank.minPriceVnd >= 90_000 && mini8Blank.minPriceVnd <= 95_000);
  assert.ok(mini8Blank.maxPriceVnd >= 100_000 && mini8Blank.maxPriceVnd <= 105_000);
});

test('calculatePhotoBookPrice dynamically increments per frame added', () => {
  const mini8 = calculatePhotoBookPrice({
    formatId: 'V-MINI',
    pageCount: 8,
    frontCoverType: 'blank',
  });

  const mini9 = calculatePhotoBookPrice({
    formatId: 'V-MINI',
    pageCount: 9,
    frontCoverType: 'blank',
  });

  // Adding 1 frame increases total by exactly 1 perFramePrice (6.000₫ for Mini at 40% margin)
  assert.equal(mini9.totalEstimatedVnd - mini8.totalEstimatedVnd, 6_000);
});

test('calculatePhotoBookPrice dynamically adjusts when cover has photo pocket', () => {
  const blank = calculatePhotoBookPrice({
    formatId: 'V-MINI',
    pageCount: 8,
    frontCoverType: 'blank',
  });

  const withPhoto = calculatePhotoBookPrice({
    formatId: 'V-MINI',
    pageCount: 8,
    frontCoverType: 'photo',
  });

  // Photo cover surcharge: round(5.7k * 1.4) = 8.000₫
  assert.equal(withPhoto.photoCoverPriceVnd, 8_000);
  assert.equal(withPhoto.totalEstimatedVnd - blank.totalEstimatedVnd, 8_000);
});

test('calculatePhotoBookPrice dynamically adjusts when custom design AMS is added', () => {
  const plain = calculatePhotoBookPrice({
    formatId: 'V-MINI',
    pageCount: 10,
    hasCustomDesign: false,
  });

  const withAms = calculatePhotoBookPrice({
    formatId: 'V-MINI',
    pageCount: 10,
    hasCustomDesign: true,
  });

  // AMS design surcharge: round(7.1k * 1.4) = 10.000₫
  assert.equal(withAms.designPriceVnd, 10_000);
  assert.equal(withAms.totalEstimatedVnd - plain.totalEstimatedVnd, 10_000);
});
