import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachInstantEstimates,
  type MakerWorldCnModelDetail,
} from '../src/services/makerworld-cn-pricing.service';
import type { PricingContext } from '../src/services/instant-estimate.service';

const mockPricingContext: PricingContext = {
  config: {
    electricityVndPerKwh: 3500,
    machinePriceVnd: 20_000_000,
    machineLifetimeHours: 5000,
    printerPowerKw: 0.35,
    laborVndPerHour: 40_000,
    failureBufferPct: 10,
    marginPct: 35,
    packagingFeeVnd: 5_000,
  },
  medians: new Map([
    ['PLA', 450],
    ['PETG', 500],
  ]),
  vat: { enabled: false, rateBps: 0 },
};

function createSampleDetail(): MakerWorldCnModelDetail {
  return {
    modelId: '800000',
    isChinaModel: true,
    title: 'Mô hình súng R301',
    coverImageUrl: 'https://makerworld.bblmw.cn/cover.jpg',
    author: 'MakerCN',
    license: 'CC BY-NC',
    sourceUrl: 'https://makerworld.com.cn/zh/models/800000',
    summary: 'R301 mô hình tỉ lệ 1:1',
    profiles: [
      {
        profileId: '101',
        title: 'Bàn 1: Thân súng (Đơn bàn)',
        coverImageUrl: null,
        printerTarget: 'Bambu Lab P1S',
        printTimeMinutes: 180, // 3h
        weightGrams: 120,
        platesCount: 1,
        amsRequired: false,
        filaments: [{ name: 'PLA Matte', colorHex: '#000000', type: 'PLA', weightGrams: 120 }],
      },
      {
        profileId: '102',
        title: 'Bàn 2: Bộ chi tiết ráp (Đa bàn)',
        coverImageUrl: null,
        printerTarget: 'Bambu Lab X1C',
        printTimeMinutes: 360, // 6h
        weightGrams: 280,
        platesCount: 4,
        amsRequired: true,
        filaments: [
          { name: 'PLA Đen', colorHex: '#000000', type: 'PLA', weightGrams: 200 },
          { name: 'PLA Cam', colorHex: '#ff6600', type: 'PLA', weightGrams: 80 },
        ],
      },
      {
        profileId: '103',
        title: 'Bàn 3: Thiếu thông số gram',
        coverImageUrl: null,
        printerTarget: null,
        printTimeMinutes: 0,
        weightGrams: 0,
        platesCount: 1,
        amsRequired: null,
        filaments: [],
      },
    ],
  };
}

test('attachInstantEstimates calculates rounded VND prices for single and multi-plate profiles', async () => {
  const detail = createSampleDetail();
  const enriched = await attachInstantEstimates(detail, async () => mockPricingContext);

  // Profile 1: Single plate
  const p1 = enriched.profiles[0];
  assert.ok(typeof p1.estimatedPriceVnd === 'number' && p1.estimatedPriceVnd > 0);
  // Must be rounded to 5.000đ (ADR-0033 / ADR-0034)
  assert.equal(p1.estimatedPriceVnd % 5_000, 0);
  assert.equal(p1.priceTiers, undefined);

  // Profile 2: Multi-plate (4 plates)
  const p2 = enriched.profiles[1];
  assert.ok(typeof p2.estimatedPriceVnd === 'number' && p2.estimatedPriceVnd > 0);
  assert.equal(p2.estimatedPriceVnd % 5_000, 0);
  assert.ok(p2.priceTiers);
  assert.ok(typeof p2.priceTiers.assembledVnd === 'number');
  assert.ok(typeof p2.priceTiers.kitVnd === 'number');
  // Assembled price should be >= Kit price due to assembly labor
  assert.ok(p2.priceTiers.assembledVnd >= p2.priceTiers.kitVnd);

  // Profile 3: Incomplete specs (0 minutes / 0 grams) -> should not have price
  const p3 = enriched.profiles[2];
  assert.equal(p3.estimatedPriceVnd, undefined);
  assert.equal(p3.priceTiers, undefined);
});

test('attachInstantEstimates gracefully handles missing pricing context without crashing', async () => {
  const detail = createSampleDetail();
  const enriched = await attachInstantEstimates(detail, async () => null);

  assert.equal(enriched.profiles[0].estimatedPriceVnd, undefined);
  assert.equal(enriched.profiles[1].estimatedPriceVnd, undefined);
});
