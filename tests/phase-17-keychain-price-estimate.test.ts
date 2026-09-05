import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateToolPriceRange } from '../src/lib/pricing/tool-price-range';

const config = {
  electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000,
  printerPowerKw: 0.12, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40,
  packagingFeeVnd: 5_000,
};

test('valid keychain measurements produce a rounded advisory range', () => {
  assert.deepEqual(calculateToolPriceRange({ weightGrams: 10, printMinutes: 30, unitCostVndPerGram: 160, config }), {
    minPriceVnd: 15_000,
    maxPriceVnd: 21_000,
  });
});

test('price-estimate route validates strict reasonable bounds and returns an allowlisted DTO', async () => {
  const source = await readFile('src/app/api/public/tool-price-estimate/route.ts', 'utf8');
  assert.match(source, /\.positive\(\)\.max\(2_000\)/);
  assert.match(source, /\.positive\(\)\.max\(7 \* 24 \* 60\)/);
  const responseKeys = Object.keys(calculateToolPriceRange({ weightGrams: 10, printMinutes: 30, unitCostVndPerGram: 160, config }));
  assert.deepEqual(responseKeys.sort(), ['maxPriceVnd', 'minPriceVnd']);
  for (const forbidden of ['marginPct', 'laborVndPerHour', 'electricityVndPerKwh', 'machinePriceVnd']) assert.equal(responseKeys.includes(forbidden), false);
});
