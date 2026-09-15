import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as opentype from 'opentype.js';
import { buildGlyphShape, buildSingleBlockMesh, validateColor } from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-engine';
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
