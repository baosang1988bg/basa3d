// Instant (quote-first) estimates — ADR-0034.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseObjVolume, parseStlVolume } from '../src/lib/parsers/mesh-volume.js';
import { estimateFromMesh, estimateFromSliceInfo, estimateFromSpec, type PricingContext } from '../src/services/instant-estimate.service.js';
import { parseMakerWorldSpecText } from '../src/lib/parsers/makerworld-spec-text.js';
import { DomainError } from '../src/lib/domain-error.js';

const ctx: PricingContext = {
  config: { electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000 },
  medians: new Map([['PLA', 300], ['PETG', 350]]),
};

// 10 mm cube = 1 cm³, 12 triangles.
const CUBE: [number, number, number][][] = (() => {
  const v = (x: number, y: number, z: number): [number, number, number] => [x * 10, y * 10, z * 10];
  const quads = [
    [v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)], [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)],
    [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)], [v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0)],
    [v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)], [v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)],
  ];
  return quads.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]]);
})();

function binaryStl(triangles: number[][][]): Uint8Array {
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triangles.length, true);
  triangles.forEach((tri, t) => tri.forEach((p, k) => p.forEach((value, i) => view.setFloat32(84 + t * 50 + 12 + k * 12 + i * 4, value, true))));
  return new Uint8Array(buffer);
}

test('binary and ASCII STL of a 10 mm cube = 1 cm³ with the right bounding box', () => {
  const bin = parseStlVolume(binaryStl(CUBE));
  assert.ok(Math.abs(bin.volumeCm3 - 1) < 1e-6);
  assert.deepEqual(bin.sizeMm, { x: 10, y: 10, z: 10 });
  const ascii = `solid cube\n${CUBE.map((t) => `facet normal 0 0 0\nouter loop\n${t.map((p) => `vertex ${p.join(' ')}`).join('\n')}\nendloop\nendfacet`).join('\n')}\nendsolid`;
  assert.ok(Math.abs(parseStlVolume(new TextEncoder().encode(ascii)).volumeCm3 - 1) < 1e-6);
});

test('OBJ cube (quads, 1-based and negative indices) = 1 cm³', () => {
  const obj = ['v 0 0 0', 'v 10 0 0', 'v 10 10 0', 'v 0 10 0', 'v 0 0 10', 'v 10 0 10', 'v 10 10 10', 'v 0 10 10',
    'f 1 4 3 2', 'f 5 6 7 8', 'f 1 2 6 5', 'f 4 8 7 3', 'f 1 5 8 4', 'f -7 -6 -2 -3'].join('\n');
  assert.ok(Math.abs(parseObjVolume(new TextEncoder().encode(obj)).volumeCm3 - 1) < 1e-6);
});

test('garbage and empty meshes are rejected with a DomainError, not a crash', () => {
  assert.throws(() => parseStlVolume(new TextEncoder().encode('hello')), DomainError);
  assert.throws(() => parseObjVolume(new TextEncoder().encode('f 1 2 3')), DomainError);
});

test('SPEC: pasted MakerWorld line → two tier prices (multi-plate), rounded to 5.000đ', () => {
  const spec = parseMakerWorldSpecText('0.2mm layer, 2 walls, 15% infill · P1S · 7.4 h · 6 plates · 168 g · No AMS');
  const estimate = estimateFromSpec(ctx, spec)!;
  assert.equal(estimate.kind, 'SPEC');
  assert.deepEqual(estimate.options.map((o) => o.key), ['ASSEMBLED', 'KIT']);
  for (const option of estimate.options) assert.ok(option.priceVnd! > 0 && option.priceVnd! % 5_000 === 0);
  assert.ok(estimate.options[1].priceVnd! <= estimate.options[0].priceVnd!);
});

test('SPEC: missing time or grams, or absurd values → no price', () => {
  assert.equal(estimateFromSpec(ctx, { printMinutes: 300, netWeightGrams: null, platesCount: 1, amsRequired: null }), null);
  assert.equal(estimateFromSpec(ctx, { printMinutes: null, netWeightGrams: 50, platesCount: 1, amsRequired: null }), null);
  assert.equal(estimateFromSpec(ctx, { printMinutes: 999_999, netWeightGrams: 50, platesCount: 1, amsRequired: null }), null);
});

test('SPEC: material without a priced active spool → no price (never a guessed cost)', () => {
  const estimate = estimateFromSpec(ctx, { printMinutes: 60, netWeightGrams: 20, platesCount: 1, amsRequired: false, materialType: 'TPU' })!;
  assert.equal(estimate.options[0].priceVnd, null);
});

test('SLICED: single plate → one STANDARD price; grams used as-is (no extra waste)', () => {
  const parsed = { plateCount: 1, totalPrintMinutes: 90, plates: [], filaments: [{ filamentId: '1', type: 'PLA', color: '#000000', totalGrams: 40 }] };
  const estimate = estimateFromSliceInfo(ctx, parsed)!;
  assert.deepEqual(estimate.options.map((o) => o.key), ['STANDARD']);
  assert.equal(estimate.specs.netWeightGrams, 40);
  const heavier = estimateFromSliceInfo(ctx, { ...parsed, filaments: [{ ...parsed.filaments[0], totalGrams: 400 }] })!;
  assert.ok(heavier.options[0].priceVnd! > estimate.options[0].priceVnd!);
});

test('MESH: price range min < max, multiples of 5.000đ', () => {
  const estimate = estimateFromMesh(ctx, { volumeCm3: 120, triangles: 12, sizeMm: { x: 50, y: 50, z: 48 } })!;
  const [option] = estimate.options;
  assert.equal(option.priceVnd, null);
  assert.ok(option.minVnd! < option.maxVnd!);
  assert.equal(option.minVnd! % 5_000, 0);
});
