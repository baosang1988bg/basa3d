import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as opentype from 'opentype.js';
import { buildCompactBaseMesh, buildGlyphShape, buildModularBaseMesh, buildSingleBlockMesh, disposeBlocksScene, generateKeychainBlocksScene, getBlocksExportParts, validateColor } from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-engine';
import * as C from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-constants';

const font = opentype.parse(readFileSync('public/fonts/BeVietnamPro-Regular.ttf').buffer as ArrayBuffer);

test('icon set matches the reference tool\'s 17 sourceable icons, each a non-degenerate shape', () => {
  const expected = ['airplane', 'apple', 'banana', 'cat', 'clover', 'cloud', 'coffee', 'fire', 'flower', 'grape', 'heart', 'lightning', 'moon', 'music', 'paw', 'ribbon', 'star'];
  assert.deepEqual(Object.keys(C.ICON_PATHS).sort(), [...expected].sort());
  for (const id of expected) {
    const shapes = buildGlyphShape(`icon:${id}`, font);
    assert.ok(shapes.length > 0, id);
    for (const shape of shapes) assert.ok(shape.getPoints().length >= 3, id);
  }
});

test('a blank char produces no glyph shapes and a single-mesh (cap only) block group', () => {
  assert.deepEqual(buildGlyphShape('', font), []);
  const group = buildSingleBlockMesh({ id: 'slot-1', char: '', blockColor: '#f59e0b', glyphColor: '#ffffff' }, font);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].name, 'slot-1-block');
});

test('symbol chars (? ! & @ $) validate and render like any other glyph', () => {
  for (const char of C.SYMBOL_CHARS) {
    const group = buildSingleBlockMesh({ id: 'slot-1', char, blockColor: '#f59e0b', glyphColor: '#ffffff' }, font);
    assert.equal(group.children.length, 2, char);
  }
});

test('rejects unsupported characters and unknown icon ids, still', () => {
  assert.throws(() => buildGlyphShape('icon:basketball', font));
  assert.throws(() => buildGlyphShape('€', font));
  assert.throws(() => validateColor('orange'));
});

test('modular base keeps the same footprint as compact but is a visibly different (higher-vertex) mesh', () => {
  const compact = buildCompactBaseMesh(4, '#334155');
  const modular = buildModularBaseMesh(4, '#334155');
  try {
    compact.geometry.computeBoundingBox(); modular.geometry.computeBoundingBox();
    const compactSize = compact.geometry.boundingBox!.getSize(new (Object.getPrototypeOf(compact.geometry.boundingBox!.min).constructor)());
    const modularSize = modular.geometry.boundingBox!.getSize(new (Object.getPrototypeOf(modular.geometry.boundingBox!.min).constructor)());
    assert.ok(Math.abs(compactSize.x - modularSize.x) < 1e-6);
    assert.ok(Math.abs(compactSize.y - modularSize.y) < 1e-6);
    assert.ok(modular.geometry.getAttribute('position').count > compact.geometry.getAttribute('position').count);
  } finally {
    compact.geometry.dispose(); modular.geometry.dispose();
  }
});

test('generateKeychainBlocksScene defaults to compact and accepts an explicit modular baseType', () => {
  for (const [char1] of [['A']]) {
    const sceneCompact = generateKeychainBlocksScene([{ id: 's1', char: char1, blockColor: '#f59e0b', glyphColor: '#ffffff' }], font, '#334155');
    const sceneModular = generateKeychainBlocksScene([{ id: 's1', char: char1, blockColor: '#f59e0b', glyphColor: '#ffffff' }], font, '#334155', 'modular');
    try {
      assert.equal(sceneCompact.children[0].name, 'compact-base');
      assert.equal(sceneModular.children[0].name, 'modular-base');
      getBlocksExportParts(sceneCompact).forEach(p => p.geometry.dispose());
      getBlocksExportParts(sceneModular).forEach(p => p.geometry.dispose());
    } finally {
      disposeBlocksScene(sceneCompact); disposeBlocksScene(sceneModular);
    }
  }
});
