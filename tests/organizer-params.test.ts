import assert from 'node:assert/strict';
import test from 'node:test';
import {
  autoFitCells, cellLayout, DEFAULT_ORGANIZER_PARAMS as defaults, fitsPrinter, normalizeLabelParams,
  normalizeOrganizerParams, ORGANIZER_PRESETS, PRINTERS,
} from '../src/lib/3d-tools/organizer/organizer-params';
import { decodeOrganizerQuery, encodeOrganizerQuery, hasOrganizerQuery } from '../src/lib/3d-tools/organizer/organizer-share-url';

test('defaults and presets match the reference values', () => {
  assert.deepEqual(
    [defaults.width, defaults.depth, defaults.height, defaults.cols, defaults.rows, defaults.wall, defaults.floor, defaults.divider, defaults.radius],
    [120, 80, 40, 3, 2, 2, 2, 1.6, 3],
  );
  assert.equal(ORGANIZER_PRESETS.length, 6);
  const drawer = ORGANIZER_PRESETS.find((preset) => preset.id === 'drawerInsert')!.params;
  assert.deepEqual([drawer.width, drawer.depth, drawer.height, drawer.cols, drawer.rows], [220, 160, 40, 5, 4]);
  assert.deepEqual(PRINTERS.map((printer) => printer.bed), [[256, 256], [270, 270]]);
  for (const preset of ORGANIZER_PRESETS) {
    const { warnings } = normalizeOrganizerParams(preset.params);
    assert.deepEqual(warnings.filter((key) => key !== 'warn.thinWalls'), [], preset.id);
  }
});

test('default cell layout is 37.6 × 37.2 mm, as shown by the reference', () => {
  const layout = cellLayout(normalizeOrganizerParams(defaults).params);
  assert.ok(Math.abs(layout.cellWidths[0] - 37.6) < 1e-9);
  assert.ok(Math.abs(layout.cellDepths[0] - 37.2) < 1e-9);
  assert.equal(layout.cavityHeight, 38);
  assert.ok(Math.abs(layout.xs[0] - (-60 + 2 + 37.6 / 2)) < 1e-9);
});

test('normalization clamps like the reference and reports warnings', () => {
  let r = normalizeOrganizerParams({ ...defaults, height: 2, floor: 2 });
  assert.equal(r.params.height, 5); // UI minimum 5 > floor + 1
  r = normalizeOrganizerParams({ ...defaults, height: 5, floor: 6 });
  assert.equal(r.params.height, 7); assert.ok(r.warnings.includes('warn.heightRaised'));
  r = normalizeOrganizerParams({ ...defaults, width: 20, cols: 12, wall: 2, divider: 1.6 });
  // floor((20 - 4 + 1.6) / 2.6) = 6 columns of ≥ 1 mm
  assert.equal(r.params.cols, 6); assert.ok(r.warnings.includes('warn.colsReduced'));
  r = normalizeOrganizerParams({ ...defaults, cols: 2.6, rows: 0 });
  assert.equal(r.params.cols, 3); assert.equal(r.params.rows, 1);
  r = normalizeOrganizerParams({ ...defaults, width: 20, depth: 20, wall: 2, radius: 15 });
  assert.equal(r.params.radius, 8); assert.ok(r.warnings.includes('warn.radiusClamped'));
  r = normalizeOrganizerParams({ ...defaults, wall: 0.7, stackingLip: true });
  assert.ok(r.warnings.includes('warn.lipWallThin'));
  assert.ok(r.warnings.includes('warn.thinWalls'));
});

test('texture depth and density are clamped to the wall and perimeter', () => {
  let r = normalizeOrganizerParams({ ...defaults, wallTexture: 'fluted', textureDepth: 3, wall: 2, radius: 3 });
  assert.ok(Math.abs(r.params.textureDepth - 1.6) < 1e-9); // wall − 0.4
  assert.ok(r.warnings.includes('warn.textureClamped'));
  r = normalizeOrganizerParams({ ...defaults, wallTexture: 'fluted', textureDepth: 3, wall: 6, radius: 1 });
  assert.ok(Math.abs(r.params.textureDepth - 0.8) < 1e-9); // 0.8 × radius
  r = normalizeOrganizerParams({ ...defaults, wallTexture: 'reeded', textureDepth: 3 });
  assert.equal(r.params.textureDepth, 3); assert.ok(!r.warnings.includes('warn.textureClamped'));
  r = normalizeOrganizerParams({ ...defaults, width: 20, depth: 20, radius: 0, wallTexture: 'reeded', textureDepth: 3, textureCount: 120 });
  assert.equal(r.params.textureCount, Math.floor(80 / 6)); assert.ok(r.warnings.includes('warn.textureClamped'));
  r = normalizeOrganizerParams({ ...defaults, wallTexture: 'bogus' as never });
  assert.equal(r.params.wallTexture, 'none');
});

test('custom cell lists auto-fit the last cell or reset to an equal grid', () => {
  assert.deepEqual(autoFitCells(100, [20, 20, 1]), [20, 20, 60]);
  for (const sizes of [[], [0.5], [NaN], [Infinity], [100, 1], Array(13).fill(1)]) assert.equal(autoFitCells(100, sizes), null);
  let r = normalizeOrganizerParams({ ...defaults, columnWidths: [50, 10], rowDepths: [30, 44.4] });
  assert.equal(r.params.cols, 2); assert.equal(r.params.rows, 2);
  assert.ok(Math.abs(r.params.columnWidths![1] - (120 - 4 - 1.6 - 50)) < 1e-9);
  assert.ok(r.warnings.includes('warn.customAutoFit'));
  r = normalizeOrganizerParams({ ...defaults, columnWidths: [200, 10] });
  assert.equal(r.params.columnWidths, null); assert.ok(r.warnings.includes('warn.customReset'));
});

test('hostile values from a shared URL are clamped to the UI ranges', () => {
  const r = normalizeOrganizerParams({ ...defaults, width: 1e9, depth: -5, height: NaN, cols: 1e6, color: 'red' });
  assert.equal(r.params.width, 300); assert.equal(r.params.depth, 20); assert.equal(r.params.height, 40);
  assert.ok(r.params.cols <= 12); assert.equal(r.params.color, defaults.color);
  const label = normalizeLabelParams({ enabled: true, text: 'x'.repeat(100), fontSize: 999, plateColor: '#zzzzzz' });
  assert.equal(label.text.length, 24); assert.equal(label.fontSize, 40); assert.equal(label.plateColor, '#e2b23a');
});

test('printer fit adds twice the outward texture depth, no rotation', () => {
  assert.equal(fitsPrinter({ ...defaults, width: 256, depth: 256 }, 'p2s'), true);
  assert.equal(fitsPrinter({ ...defaults, width: 256, depth: 256, wallTexture: 'reeded', textureDepth: 1 }, 'p2s'), false);
  assert.equal(fitsPrinter({ ...defaults, width: 256, depth: 256, wallTexture: 'fluted', textureDepth: 1 }, 'p2s'), true);
  assert.equal(fitsPrinter({ ...defaults, width: 260, depth: 260 }, 'p2s'), false);
  assert.equal(fitsPrinter({ ...defaults, width: 260, depth: 260 }, 'u1'), true);
  assert.equal(fitsPrinter({ ...defaults, width: 275, depth: 275 }, 'u1'), false);
});

test('share URL uses the reference keys and round-trips', () => {
  const params = { ...defaults, width: 150, stackingLip: true, wallTexture: 'wavy' as const, color: '#ff0000' };
  const query = encodeOrganizerQuery(params);
  assert.match(query, /(^|&)w=150(&|$)/); assert.match(query, /lip=1/); assert.match(query, /wt=wavy/); assert.match(query, /col=ff0000/);
  assert.ok(hasOrganizerQuery(`?${query}`));
  const decoded = decodeOrganizerQuery(`?${query}`);
  assert.equal(decoded.width, 150); assert.equal(decoded.stackingLip, true); assert.equal(decoded.labelTab, false);
  assert.equal(decoded.color, '#ff0000');
  const custom = decodeOrganizerQuery(encodeOrganizerQuery({ ...defaults, columnWidths: [30, 52.4] }));
  assert.deepEqual(custom.columnWidths, [30, 52.4]);
  assert.equal(hasOrganizerQuery('?utm_source=x'), false);
});
