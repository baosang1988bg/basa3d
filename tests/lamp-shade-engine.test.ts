import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLampShadeGeometry,
  computeShadeDimensions,
  disposeLampShadeScene,
  generateLampShadeScene,
  getLampShadeExportParts,
  validateColor,
} from '../src/lib/3d-tools/lamp-shade/lamp-shade-engine';
import * as C from '../src/lib/3d-tools/lamp-shade/lamp-shade-constants';

test('computeShadeDimensions derives circumference/radius/height from the grid parameters', () => {
  const dims = computeShadeDimensions({ around: 18, rows: 9, cellSizeMm: 12 });
  assert.equal(dims.circumference, 216);
  assert.ok(Math.abs(dims.radius - 216 / (2 * Math.PI)) < 1e-9);
  assert.equal(dims.height, 108);
});

test('every curated pattern produces a finite, positive-volume, bounded tube', () => {
  for (const pattern of C.PATTERN_TYPES) {
    const geometry = buildLampShadeGeometry({ pattern, around: 18, rows: 9, cellSizeMm: 12 });
    try {
      const position = geometry.getAttribute('position');
      assert.ok(position.count > 0, pattern);
      for (let i = 0; i < position.count; i++) assert.ok([position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite), pattern);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const { radius, height } = computeShadeDimensions({ around: 18, rows: 9, cellSizeMm: 12 });
      const maxSpan = radius + C.WALL_THICKNESS_MM;
      assert.ok(box.max.x <= maxSpan + 1e-6 && box.min.x >= -maxSpan - 1e-6, pattern);
      assert.ok(box.max.z <= maxSpan + 1e-6 && box.min.z >= -maxSpan - 1e-6, pattern);
      assert.ok(Math.abs(box.max.y - box.min.y - height) < 1e-6, pattern);
    } finally {
      geometry.dispose();
    }
  }
});

test('rotationDeg rotates the hole grid without changing the tube envelope', () => {
  const base = buildLampShadeGeometry({ pattern: 'circle', around: 18, rows: 9, cellSizeMm: 12 });
  const rotated = buildLampShadeGeometry({ pattern: 'circle', around: 18, rows: 9, cellSizeMm: 12, rotationDeg: 90 });
  try {
    base.computeBoundingBox();
    rotated.computeBoundingBox();
    assert.ok(Math.abs((base.boundingBox!.max.x - base.boundingBox!.min.x) - (rotated.boundingBox!.max.x - rotated.boundingBox!.min.x)) < 1);
    assert.notDeepEqual(Array.from(base.getAttribute('position').array).slice(0, 30), Array.from(rotated.getAttribute('position').array).slice(0, 30));
  } finally {
    base.dispose();
    rotated.dispose();
  }
});

test('generateLampShadeScene builds 1 mesh part and rejects an invalid color', () => {
  const scene = generateLampShadeScene({ pattern: 'hexagon', around: 12, rows: 6, cellSizeMm: 10 });
  try {
    assert.equal(scene.children.length, 1);
    const parts = getLampShadeExportParts(scene);
    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'lamp-shade');
    parts.forEach(p => p.geometry.dispose());
  } finally {
    disposeLampShadeScene(scene);
  }
  assert.throws(() => generateLampShadeScene({ pattern: 'circle', around: 18, rows: 9, cellSizeMm: 12 }, 'red'));
  assert.throws(() => validateColor('#fff'));
});

test('rejects grid parameters outside the constants envelope, including the total-hole cap', () => {
  assert.throws(() => buildLampShadeGeometry({ pattern: 'circle', around: C.MIN_AROUND - 1, rows: 9, cellSizeMm: 12 }));
  assert.throws(() => buildLampShadeGeometry({ pattern: 'circle', around: C.MAX_AROUND + 1, rows: 9, cellSizeMm: 12 }));
  assert.throws(() => buildLampShadeGeometry({ pattern: 'circle', around: 18, rows: C.MIN_ROWS - 1, cellSizeMm: 12 }));
  assert.throws(() => buildLampShadeGeometry({ pattern: 'circle', around: 18, rows: 9, cellSizeMm: C.MAX_CELL_SIZE_MM + 1 }));
  assert.throws(() => buildLampShadeGeometry({ pattern: 'circle', around: C.MAX_AROUND, rows: C.MAX_ROWS, cellSizeMm: C.MAX_CELL_SIZE_MM }));
  assert.throws(() => buildLampShadeGeometry({ pattern: 'circle', around: 18, rows: 9, cellSizeMm: 12, rotationDeg: 400 }));
});
