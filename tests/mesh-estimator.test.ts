import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '../src/lib/pricing/mesh-estimator';

test('calculateMeshVolumeCm3 returns one cm3 for a 10mm cube', () => {
  const geometry = new THREE.BoxGeometry(10, 10, 10);
  assert.ok(Math.abs(calculateMeshVolumeCm3(geometry) - 1) < 1e-9);
});

test('calculateMeshVolumeCm3 works for non-indexed geometry', () => {
  const geometry = new THREE.BoxGeometry(20, 10, 5).toNonIndexed();
  assert.ok(Math.abs(calculateMeshVolumeCm3(geometry) - 1) < 1e-9);
});

test('estimateMeshWeightGrams uses PLA density and accepts an explicit density', () => {
  assert.equal(estimateMeshWeightGrams(10), 12.4);
  assert.equal(estimateMeshWeightGrams(10, 1), 10);
  assert.throws(() => estimateMeshWeightGrams(-1), RangeError);
});

test('estimatePrintMinutes applies fixed overhead and per-gram time', () => {
  assert.equal(estimatePrintMinutes(0), 12);
  assert.equal(estimatePrintMinutes(10), 30);
  assert.throws(() => estimatePrintMinutes(Number.NaN), RangeError);
});
