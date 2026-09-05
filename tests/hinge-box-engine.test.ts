import assert from 'node:assert/strict';
import test from 'node:test';
import {
  disposeHingeBoxScene,
  generateHingeBoxScene,
  getHingeBoxExportParts,
  mergeHingeBoxGeometry,
  validateColor,
} from '../src/lib/3d-tools/hinge-box/hinge-box-engine';
import * as C from '../src/lib/3d-tools/hinge-box/hinge-box-constants';

const baseConfig = { widthMm: 100, depthMm: 65.5, closedHeightMm: 35, rows: 1, cols: 1, dividerThicknessMm: 1.6 };

test('generateHingeBoxScene builds base, lid and hinge parts with a finite, positive-volume solid', () => {
  const scene = generateHingeBoxScene(baseConfig);
  try {
    assert.deepEqual(scene.children.map(c => c.name), ['hinge-box-base', 'hinge-box-lid', 'hinge-box-hinge']);
    const parts = getHingeBoxExportParts(scene);
    try {
      assert.equal(parts.length, 3);
      for (const part of parts) {
        const position = part.geometry.getAttribute('position');
        assert.ok(position.count > 0, part.name);
        for (let i = 0; i < position.count; i++) assert.ok([position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite), part.name);
      }
      const merged = mergeHingeBoxGeometry(parts);
      try { assert.ok(merged.getAttribute('position').count > 0); } finally { merged.dispose(); }
    } finally {
      parts.forEach(p => p.geometry.dispose());
    }
  } finally {
    disposeHingeBoxScene(scene);
  }
});

test('base and lid sit side by side across the hinge gap, base taller than lid per BASE_HEIGHT_RATIO', () => {
  const scene = generateHingeBoxScene(baseConfig);
  try {
    const [base, lid] = getHingeBoxExportParts(scene);
    base.geometry.computeBoundingBox();
    lid.geometry.computeBoundingBox();
    const baseBox = base.geometry.boundingBox!;
    const lidBox = lid.geometry.boundingBox!;
    assert.ok(Math.abs(baseBox.max.x - baseBox.min.x - baseConfig.widthMm) < 1e-4);
    assert.ok(lidBox.min.x > baseBox.max.x, 'lid must start after the base ends (hinge gap between them)');
    const baseHeight = baseBox.max.y - baseBox.min.y;
    const lidHeight = lidBox.max.y - lidBox.min.y;
    assert.ok(baseHeight > lidHeight, 'base tray should be taller than the lid tray');
    [base, lid].forEach(p => p.geometry.dispose());
  } finally {
    disposeHingeBoxScene(scene);
  }
});

test('a 2x2 divider grid adds internal walls, changing the base part vertex count vs 1x1', () => {
  const noDividers = generateHingeBoxScene(baseConfig);
  const withDividers = generateHingeBoxScene({ ...baseConfig, rows: 2, cols: 2 });
  try {
    const [baseNoDividers] = getHingeBoxExportParts(noDividers);
    const [baseWithDividers] = getHingeBoxExportParts(withDividers);
    assert.ok(baseWithDividers.geometry.getAttribute('position').count > baseNoDividers.geometry.getAttribute('position').count);
    baseNoDividers.geometry.dispose();
    baseWithDividers.geometry.dispose();
  } finally {
    disposeHingeBoxScene(noDividers);
    disposeHingeBoxScene(withDividers);
  }
});

test('rejects an invalid color and dimensions/grid values outside the constants envelope', () => {
  assert.throws(() => validateColor('#fff'));
  assert.throws(() => generateHingeBoxScene({ ...baseConfig, widthMm: C.MIN_WIDTH_MM - 1 }));
  assert.throws(() => generateHingeBoxScene({ ...baseConfig, widthMm: C.MAX_WIDTH_MM + 1 }));
  assert.throws(() => generateHingeBoxScene({ ...baseConfig, closedHeightMm: C.MIN_CLOSED_HEIGHT_MM - 1 }));
  assert.throws(() => generateHingeBoxScene({ ...baseConfig, rows: C.MAX_GRID_ROWS + 1 }));
  assert.throws(() => generateHingeBoxScene({ ...baseConfig, cols: 0 }));
  assert.throws(() => generateHingeBoxScene({ ...baseConfig, dividerThicknessMm: C.MAX_DIVIDER_THICKNESS_MM + 1 }));
  assert.throws(() => generateHingeBoxScene(baseConfig, 'red'));
});
