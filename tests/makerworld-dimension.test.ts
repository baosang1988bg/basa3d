import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAuthorDimensions,
  formatDimensionsMm,
  formatDimensionsCm,
} from '../src/lib/parsers/makerworld-dimension';

test('extractAuthorDimensions - strictly rejects slicer settings', () => {
  assert.equal(extractAuthorDimensions('0.2mm layer, 2 walls, 5% infill'), null);
  assert.equal(extractAuthorDimensions('0.2mm layer height, P1S'), null);
  assert.equal(extractAuthorDimensions('Printed with 0.4mm nozzle and 0.16mm layer'), null);
  assert.equal(extractAuthorDimensions('0.8mm wall thickness'), null);
  assert.equal(extractAuthorDimensions('2mm screws and 5mm magnets'), null);
});

test('extractAuthorDimensions - handles valid 3D dimensions', () => {
  assert.equal(
    extractAuthorDimensions('Model size is 150x120x80mm with 2 walls'),
    '150 × 120 × 80 mm'
  );
  assert.equal(
    extractAuthorDimensions('Dimensions: 15.5 x 12 x 8 cm'),
    '15.5 × 12 × 8 cm'
  );
  assert.equal(
    extractAuthorDimensions('<p>Size: 100*100*50mm</p>'),
    '100 × 100 × 50 mm'
  );
});

test('extractAuthorDimensions - handles valid 2D dimensions', () => {
  assert.equal(
    extractAuthorDimensions('Coaster diameter 100x100mm'),
    '100 × 100 mm'
  );
  assert.equal(
    extractAuthorDimensions('Photo frame 15 x 20 cm'),
    '15 × 20 cm'
  );
});

test('extractAuthorDimensions - handles valid model height >= 20mm', () => {
  assert.equal(
    extractAuthorDimensions('<h2>Frankenstein&#39;s Monster / NO AMS</h2><p>&nbsp;</p><h2>24 cm  Height </h2>'),
    '24 cm (Cao)'
  );
  assert.equal(
    extractAuthorDimensions('Action figure 180mm tall'),
    '180 mm (Cao)'
  );
  assert.equal(
    extractAuthorDimensions('Mẫu cao 15cm'),
    '15 cm (Cao)'
  );
});

test('formatDimensionsMm and formatDimensionsCm', () => {
  const dim = { x: 150.24, y: 120.76, z: 85.0 };
  assert.equal(formatDimensionsMm(dim), '150.2 × 120.8 × 85 mm');
  assert.equal(formatDimensionsCm(dim), '15.0 × 12.1 × 8.5 cm');
});
