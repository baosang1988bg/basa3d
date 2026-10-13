// Phase 33 S3 — shared mesh metrics + FDM gram/time model + one price per item (plan §5, T2, T3).
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  checkMeshConsistency,
  computeMeshMetrics,
  parseObjMetrics,
  parseStlMetrics,
  scaleMeshMetrics,
  type MeshMetrics,
} from '../src/lib/pricing/mesh-metrics.js';
import {
  FDM_CONSTANTS,
  MIN_ITEM_PRICE_VND,
  estimateFdmPrint,
  lineSubtotalVnd,
} from '../src/lib/pricing/fdm-estimate-model.js';
import { calculateMeshVolumeCm3 } from '../src/lib/pricing/mesh-estimator.js';
import { parseStlVolume } from '../src/lib/parsers/mesh-volume.js';
import { estimateFromMeshMetrics, type PricingContext } from '../src/services/instant-estimate.service.js';
import { estimatePrintMinutes } from '../src/lib/pricing/mesh-estimator.js';

const box = (x: number, y: number, z: number): MeshMetrics => ({
  volumeMm3: x * y * z, surfaceMm2: 2 * (x * y + y * z + x * z), sizeMm: { x, y, z }, triangles: 12,
});

function boxTriangles(x: number, y: number, z: number): number[] {
  const v = [[0, 0, 0], [x, 0, 0], [x, y, 0], [0, y, 0], [0, 0, z], [x, 0, z], [x, y, z], [0, y, z]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 6, 2], [3, 7, 6], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  return t.flatMap((tri) => tri.flatMap((i) => v[i]));
}

function binaryStl(positions: number[]): Uint8Array {
  const triangles = positions.length / 9;
  const view = new DataView(new ArrayBuffer(84 + triangles * 50));
  view.setUint32(80, triangles, true);
  for (let t = 0; t < triangles; t += 1) for (let k = 0; k < 9; k += 1) view.setFloat32(84 + t * 50 + 12 + k * 4, positions[t * 9 + k], true);
  return new Uint8Array(view.buffer);
}

const ctx: PricingContext = {
  config: { electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000 },
  medians: new Map([['PLA', 300], ['PETG', 350]]),
};

// ---------------------------------------------------------------------------------------------
// mesh-metrics
// ---------------------------------------------------------------------------------------------

test('mesh-metrics: 40 mm cube → V 64 000 mm³, A 9 600 mm², size 40³ — STL binary, ASCII, OBJ and BufferGeometry agree', () => {
  const positions = boxTriangles(40, 40, 40);
  const fromArray = computeMeshMetrics(positions);
  assert.ok(Math.abs(fromArray.volumeMm3 - 64_000) < 1e-6);
  assert.ok(Math.abs(fromArray.surfaceMm2 - 9_600) < 1e-6);
  assert.deepEqual(fromArray.sizeMm, { x: 40, y: 40, z: 40 });
  assert.equal(fromArray.triangles, 12);

  const fromStl = parseStlMetrics(binaryStl(positions));
  assert.ok(Math.abs(fromStl.volumeMm3 - 64_000) < 1e-3);

  const ascii = 'solid cube\n' + Array.from({ length: 12 }, (_, t) => `facet normal 0 0 0\nouter loop\n${[0, 1, 2].map((k) => `vertex ${positions.slice(t * 9 + k * 3, t * 9 + k * 3 + 3).join(' ')}`).join('\n')}\nendloop\nendfacet`).join('\n') + '\nendsolid';
  assert.ok(Math.abs(parseStlMetrics(new TextEncoder().encode(ascii)).surfaceMm2 - 9_600) < 1e-6);

  const obj = 'v 0 0 0\nv 40 0 0\nv 40 40 0\nv 0 40 0\nv 0 0 40\nv 40 0 40\nv 40 40 40\nv 0 40 40\n'
    + 'f 1 3 2\nf 1 4 3\nf 5 6 7\nf 5 7 8\nf 1 2 6\nf 1 6 5\nf 4 7 3\nf 4 8 7\nf 1 5 8\nf 1 8 4\nf 2 3 7\nf 2 7 6\n';
  assert.ok(Math.abs(parseObjMetrics(new TextEncoder().encode(obj)).volumeMm3 - 64_000) < 1e-6);

  const geometry = new THREE.BoxGeometry(40, 40, 40);
  assert.ok(Math.abs(calculateMeshVolumeCm3(geometry) - 64) < 1e-6);
  // Old ADR-0034 wrapper still returns cm³ + rounded box.
  assert.deepEqual(parseStlVolume(binaryStl(positions)).sizeMm, { x: 40, y: 40, z: 40 });
});

test('scale ×2 → V × 8, A × 4, size × 2', () => {
  const scaled = scaleMeshMetrics(box(10, 20, 30), 2000);
  assert.equal(scaled.volumeMm3, 6_000 * 8);
  assert.equal(scaled.surfaceMm2, 2_200 * 4);
  assert.deepEqual(scaled.sizeMm, { x: 20, y: 40, z: 60 });
});

test('checkMeshConsistency: box limit and isoperimetric inequality', () => {
  assert.deepEqual(checkMeshConsistency(box(10, 10, 10)), { ok: true });
  assert.deepEqual(checkMeshConsistency({ volumeMm3: 2_000, surfaceMm2: 600, sizeMm: { x: 10, y: 10, z: 10 } }), { ok: false, reason: 'VOLUME_EXCEEDS_BOX' });
  // A 1 000 mm³ solid needs at least ~483.6 mm² of surface (sphere).
  assert.deepEqual(checkMeshConsistency({ volumeMm3: 1_000, surfaceMm2: 400, sizeMm: { x: 20, y: 20, z: 20 } }), { ok: false, reason: 'AREA_TOO_SMALL' });
  assert.deepEqual(checkMeshConsistency({ volumeMm3: 0, surfaceMm2: 100, sizeMm: { x: 10, y: 10, z: 0 } }), { ok: false, reason: 'ZERO_VOLUME' });
});

// ---------------------------------------------------------------------------------------------
// fdm-estimate-model
// ---------------------------------------------------------------------------------------------

test('§5.1: 40 mm cube grams match the plan’s worked numbers (no support)', () => {
  const noSupport = { ...FDM_CONSTANTS, SUPPORT_FACTOR: 0 };
  const grams = (infillPct: number, materialType: string) => {
    const result = estimateFdmPrint({ metrics: box(40, 40, 40), scalePermille: 1000, infillPct, materialType }, noSupport);
    assert.equal(result.status, 'OK');
    return result.status === 'OK' ? result.grams : 0;
  };
  assert.equal(grams(10, 'PETG'), 18.0);
  assert.equal(grams(15, 'PETG'), 21.5);
  assert.equal(grams(30, 'PETG'), 32.1);
  assert.equal(grams(10, 'PLA'), 17.6); // 1.24 g/cm³ (codebase PLA density), plan used 1.25 → 17.7
});

test('§5.2: a tall slender column is layer-limited — far more minutes than the old 12 + 1.8·g rule', () => {
  // 6 × 6 × 200 mm column ≈ 12 g PLA at 15% with support.
  const result = estimateFdmPrint({ metrics: box(6, 6, 200), scalePermille: 1000, infillPct: 15, materialType: 'PLA' });
  assert.equal(result.status, 'OK');
  if (result.status !== 'OK') return;
  assert.equal(result.layers, 1000);
  assert.ok(result.grams < 15);
  assert.ok(result.printMinutes > 2 * estimatePrintMinutes(result.grams), `${result.printMinutes} min vs ${estimatePrintMinutes(result.grams)}`);
});

test('scale changes grams and minutes; infill raises grams', () => {
  const at = (scalePermille: number, infillPct = 15) => {
    const r = estimateFdmPrint({ metrics: box(20, 20, 20), scalePermille, infillPct, materialType: 'PLA' });
    assert.equal(r.status, 'OK');
    return r.status === 'OK' ? r : null;
  };
  assert.ok(at(2000)!.grams > at(1000)!.grams * 4);
  assert.ok(at(2000)!.printMinutes > at(1000)!.printMinutes);
  assert.ok(at(1000, 50)!.grams > at(1000, 15)!.grams);
  assert.deepEqual(at(500)!.sizeMm, { x: 10, y: 10, z: 10 });
});

test('broken mesh (zero volume / impossible numbers) → UNPRICED INVALID_MESH', () => {
  const flat = computeMeshMetrics([0, 0, 0, 10, 0, 0, 0, 10, 0]); // a single triangle: open, zero volume
  const result = estimateFdmPrint({ metrics: flat, scalePermille: 1000, infillPct: 15, materialType: 'PLA' });
  assert.deepEqual({ status: result.status, reason: result.status === 'UNPRICED' ? result.reason : null }, { status: 'UNPRICED', reason: 'INVALID_MESH' });
});

test('beyond the 256 mm build volume → UNPRICED EXCEEDS_BUILD_VOLUME; any orientation that fits is accepted', () => {
  const tooBig = estimateFdmPrint({ metrics: box(100, 100, 300), scalePermille: 1000, infillPct: 15, materialType: 'PLA' });
  assert.equal(tooBig.status === 'UNPRICED' && tooBig.reason, 'EXCEEDS_BUILD_VOLUME');
  const scaledUp = estimateFdmPrint({ metrics: box(100, 100, 100), scalePermille: 3000, infillPct: 15, materialType: 'PLA' });
  assert.equal(scaledUp.status, 'UNPRICED');
  assert.equal(estimateFdmPrint({ metrics: box(250, 20, 20), scalePermille: 1000, infillPct: 15, materialType: 'PLA' }).status, 'OK');
});

test('estimateFdmPrint rejects out-of-range scale and non-offered infill', () => {
  assert.throws(() => estimateFdmPrint({ metrics: box(10, 10, 10), scalePermille: 50, infillPct: 15, materialType: 'PLA' }), RangeError);
  assert.throws(() => estimateFdmPrint({ metrics: box(10, 10, 10), scalePermille: 1000, infillPct: 25, materialType: 'PLA' }), RangeError);
});

test('line floor applies per LINE (item × quantity), not per unit', () => {
  assert.deepEqual(lineSubtotalVnd(5_000, 1), { lineSubtotalVnd: MIN_ITEM_PRICE_VND, floorApplied: true });
  assert.deepEqual(lineSubtotalVnd(5_000, 100), { lineSubtotalVnd: 500_000, floorApplied: false });
  assert.deepEqual(lineSubtotalVnd(30_000, 1), { lineSubtotalVnd: 30_000, floorApplied: false });
});

// ---------------------------------------------------------------------------------------------
// estimateFromMeshMetrics (one price per item, VAT per item)
// ---------------------------------------------------------------------------------------------

test('estimateFromMeshMetrics: one rounded unit price, line subtotal, VAT off by default', () => {
  const result = estimateFromMeshMetrics(ctx, { metrics: box(40, 40, 40), scalePermille: 1000, infillPct: 15, materialType: 'pla', quantity: 3 });
  assert.equal(result.status, 'OK');
  if (result.status !== 'OK') return;
  assert.equal(result.unitPriceVnd % 5_000, 0);
  assert.equal(result.lineSubtotalVnd, Math.max(MIN_ITEM_PRICE_VND, result.unitPriceVnd * 3));
  assert.equal(result.vatVnd, 0);
  assert.equal(result.lineTotalVnd, result.lineSubtotalVnd);
  // B1: no cost/margin fields leak into the item DTO.
  for (const key of Object.keys(result)) assert.doesNotMatch(key, /cost|margin|labor|breakdown/i);
});

test('estimateFromMeshMetrics: VAT per item uses computeVat on the line subtotal', () => {
  const result = estimateFromMeshMetrics({ ...ctx, vat: { enabled: true, rateBps: 800 } }, { metrics: box(40, 40, 40), scalePermille: 1000, infillPct: 15, materialType: 'PLA', quantity: 1 });
  assert.equal(result.status, 'OK');
  if (result.status !== 'OK') return;
  assert.equal(result.vatRateBps, 800);
  assert.equal(result.vatVnd, Math.round((result.lineSubtotalVnd * 800) / 10_000));
  assert.equal(result.lineTotalVnd, result.lineSubtotalVnd + result.vatVnd);
});

test('estimateFromMeshMetrics: material without a priced active spool → NO_MATERIAL_PRICE; too big → UNPRICED', () => {
  assert.equal(estimateFromMeshMetrics(ctx, { metrics: box(20, 20, 20), scalePermille: 1000, infillPct: 15, materialType: 'TPU', quantity: 1 }).status, 'NO_MATERIAL_PRICE');
  assert.equal(estimateFromMeshMetrics(ctx, { metrics: box(300, 20, 20), scalePermille: 1000, infillPct: 15, materialType: 'PLA', quantity: 1 }).status, 'UNPRICED');
  assert.throws(() => estimateFromMeshMetrics(ctx, { metrics: box(20, 20, 20), scalePermille: 1000, infillPct: 15, materialType: 'PLA', quantity: 0 }), RangeError);
});
