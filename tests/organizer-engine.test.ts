import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { autoFitOrganizerCells, buildOrganizerModel, DEFAULT_ORGANIZER_OPTIONS as defaults, exportOrganizerStl, resolveOrganizerGrid } from '../src/lib/3d-tools/organizer/organizer-engine';

test('equal grid, 1x1 and maximum grid export bounded binary STL', async () => {
  for (const [rows, cols] of [[3, 4], [1, 1], [12, 12]]) {
    const model = buildOrganizerModel({ ...defaults, mode: 'equal', rows, cols });
    try {
      model.mergedGeometry.computeBoundingBox();
      const size = model.mergedGeometry.boundingBox!.getSize(new Vector3());
      assert.deepEqual(size.toArray(), [180, 120, 35]);
      assert.equal(model.rows, rows); assert.equal(model.cols, cols);
      assert.ok(Math.abs(model.columnWidthsMm.reduce((a, b) => a + b, 0) + (cols + 1) * 1.6 - 180) < 1e-8);
      const data = new DataView(await exportOrganizerStl(model.mergedGeometry).arrayBuffer());
      assert.equal(data.getUint32(80, true), (5 + rows - 1 + cols - 1) * 12);
      assert.equal(data.byteLength, 84 + data.getUint32(80, true) * 50);
    } finally { model.mergedGeometry.dispose(); }
  }
});
test('custom sizes build a merged tray with unequal compartments', () => {
  const model = buildOrganizerModel({ ...defaults, mode: 'custom', columnWidthsMm: [80, 95.2], rowHeightsMm: [40, 75.2] });
  try { assert.equal(model.cols, 2); assert.equal(model.rows, 2); assert.ok(model.mergedGeometry.getIndex()!.count > 0); }
  finally { model.mergedGeometry.dispose(); }
});
test('custom sizes accept both tolerance edges, absorb rounding only in last cell', () => {
  for (const delta of [-0.5, 0, 0.5]) {
    const grid = resolveOrganizerGrid({ ...defaults, mode: 'custom', columnWidthsMm: [80, 95.2 + delta], rowHeightsMm: [116.8] });
    assert.equal(grid.columnWidthsMm[0], 80);
    assert.ok(Math.abs(grid.columnWidthsMm[1] - 95.2) < 1e-8);
  }
  for (const delta of [-0.5001, 0.5001]) {
    assert.throws(() => resolveOrganizerGrid({ ...defaults, mode: 'custom', columnWidthsMm: [80, 95.2 + delta], rowHeightsMm: [116.8] }));
    assert.throws(() => resolveOrganizerGrid({ ...defaults, mode: 'custom', columnWidthsMm: [176.8], rowHeightsMm: [116.8 + delta] }));
  }
});
test('Auto-fit fills the last cell and rejects impossible or invalid cells', () => {
  assert.deepEqual(autoFitOrganizerCells(100, 2, [20, 20, 1]), [20, 20, 52]);
  assert.deepEqual(autoFitOrganizerCells(100, 2, [1]), [96]);
  for (const sizes of [[], [0], [-1], [NaN], [Infinity], [100, 1], Array(13).fill(1)]) assert.throws(() => autoFitOrganizerCells(100, 2, sizes));
});
test('all dimension and thickness bounds are enforced by engine', () => {
  for (const [key, min, max] of [
    ['widthMm', 30, 250], ['depthMm', 30, 250], ['heightMm', 30, 120],
    ['wallThicknessMm', 1, 4], ['bottomThicknessMm', 1.2, 5],
  ] as const) {
    for (const value of [min - 0.001, max + 0.001, NaN, Infinity]) assert.throws(() => buildOrganizerModel({ ...defaults, [key]: value }), `${key}=${value}`);
    for (const value of [min, max]) buildOrganizerModel({ ...defaults, [key]: value }).mergedGeometry.dispose();
  }
  for (const key of ['rows', 'cols'] as const) {
    for (const value of [0, -1, 1.5, 13, NaN, Infinity]) assert.throws(() => buildOrganizerModel({ ...defaults, mode: 'equal', rows: 3, cols: 4, [key]: value }));
  }
  for (const key of ['columnWidthsMm', 'rowHeightsMm'] as const) {
    for (const value of [[], Array(13).fill(1), [0], [-1], [NaN], [Infinity]]) assert.throws(() => buildOrganizerModel({ ...defaults, mode: 'custom', columnWidthsMm: [176.8], rowHeightsMm: [116.8], [key]: value }));
  }
  assert.throws(() => buildOrganizerModel({ ...defaults, widthMm: 30, wallThicknessMm: 4, mode: 'equal', rows: 1, cols: 12 }));
});
test('divider shells overlap the floor and perimeter by 0.2mm', () => {
  const model = buildOrganizerModel({ ...defaults, mode: 'equal', rows: 2, cols: 2 });
  try {
    const position = model.mergedGeometry.getAttribute('position');
    // Each BoxGeometry contributes 24 vertices; first divider follows floor + 4 perimeter walls.
    const points = Array.from({ length: 24 }, (_, i) => new Vector3().fromBufferAttribute(position, 5 * 24 + i));
    assert.ok(Math.abs(Math.min(...points.map(p => p.z)) - 1.8) < 1e-5);
    assert.ok(Math.abs(Math.max(...points.map(p => p.y)) - (60 - 1.6 + 0.2)) < 1e-5);
  } finally { model.mergedGeometry.dispose(); }
});
