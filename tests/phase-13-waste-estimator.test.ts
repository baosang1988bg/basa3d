import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultWasteRatioPctForColorCount,
  estimateWaste,
  estimateWasteWithCustomGrams,
  estimateWasteWithDefaultRatio,
  WASTE_RATIO_OVERRIDE_PRESETS,
} from '../src/lib/pricing/smart-waste-estimator.js';
import { matchAllFilaments, matchMaterialsByType } from '../src/lib/pricing/material-auto-match.js';

test('defaultWasteRatioPctForColorCount: 1 color -> 5%, 2-4 colors -> 20%, >=5 colors -> 35%', () => {
  assert.equal(defaultWasteRatioPctForColorCount(1), 5);
  assert.equal(defaultWasteRatioPctForColorCount(2), 20);
  assert.equal(defaultWasteRatioPctForColorCount(4), 20);
  assert.equal(defaultWasteRatioPctForColorCount(5), 35);
  assert.equal(defaultWasteRatioPctForColorCount(7), 35); // Ace Snail
});

test('estimateWaste applies W_total_waste = W_net * waste_ratio', () => {
  const result = estimateWaste({ netWeightGrams: 100, wasteRatioPct: 20 });
  assert.equal(result.wasteWeightGrams, 20);
  assert.equal(result.totalWeightGrams, 120);
});

test('estimateWasteWithDefaultRatio picks the ratio from color count automatically', () => {
  const singleColor = estimateWasteWithDefaultRatio(200, 1);
  assert.equal(singleColor.wasteRatioPct, 5);
  assert.equal(singleColor.totalWeightGrams, 210);

  const aceSnail = estimateWasteWithDefaultRatio(42, 7);
  assert.equal(aceSnail.wasteRatioPct, 35);
  assert.equal(aceSnail.totalWeightGrams, 42 * 1.35);
});

test('override presets expose the documented quick-select values', () => {
  assert.deepEqual(WASTE_RATIO_OVERRIDE_PRESETS, { LOW: 15, STANDARD: 30, HIGH: 50 });
});

test('estimateWaste rejects negative inputs', () => {
  assert.throws(() => estimateWaste({ netWeightGrams: -1, wasteRatioPct: 10 }), RangeError);
  assert.throws(() => estimateWaste({ netWeightGrams: 10, wasteRatioPct: -1 }), RangeError);
});

test('estimateWasteWithCustomGrams bypasses the ratio and back-computes an informational percentage', () => {
  const result = estimateWasteWithCustomGrams(100, 30);
  assert.equal(result.wasteWeightGrams, 30);
  assert.equal(result.totalWeightGrams, 130);
  assert.equal(result.wasteRatioPct, 30);
});

test('estimateWasteWithCustomGrams handles zero net weight without dividing by zero', () => {
  const result = estimateWasteWithCustomGrams(0, 10);
  assert.equal(result.wasteRatioPct, 0);
  assert.equal(result.totalWeightGrams, 10);
});

test('matchMaterialsByType matches only on materialType, never attempting color/hex similarity', () => {
  const materials = [
    { id: 'm1', name: 'PLA Đỏ', materialType: 'PLA', color: 'Đỏ', unit: 'SPOOL' },
    { id: 'm2', name: 'PLA Xanh dương', materialType: 'PLA', color: 'Xanh dương', unit: 'SPOOL' },
    { id: 'm3', name: 'PETG Trắng', materialType: 'PETG', color: 'Trắng', unit: 'SPOOL' },
  ];
  const result = matchMaterialsByType('PLA', materials);
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates.map((c) => c.id), ['m1', 'm2']);
  assert.equal(result.suggestedMaterialId, 'm1');

  const petgResult = matchMaterialsByType('petg', materials); // case-insensitive
  assert.equal(petgResult.candidates.length, 1);
  assert.equal(petgResult.candidates[0].id, 'm3');
});

test('matchMaterialsByType returns no candidates and a null suggestion when the type has no active material', () => {
  const result = matchMaterialsByType('TPU', [{ id: 'm1', name: 'PLA Đỏ', materialType: 'PLA', color: 'Đỏ', unit: 'SPOOL' }]);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.suggestedMaterialId, null);
});

test('matchAllFilaments zips one result per requested material type', () => {
  const materials = [{ id: 'm1', name: 'PLA Đỏ', materialType: 'PLA', color: 'Đỏ', unit: 'SPOOL' }];
  const results = matchAllFilaments(['PLA', 'PETG'], materials);
  assert.equal(results.length, 2);
  assert.equal(results[0].suggestedMaterialId, 'm1');
  assert.equal(results[1].suggestedMaterialId, null);
});
