import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as opentype from 'opentype.js';
import {
  buildDualTextBlock,
  disposeDualTextScene,
  generateDualTextScene,
  getDualTextExportParts,
  validateColor,
  validateWord,
} from '../src/lib/3d-tools/dual-text/dual-text-engine';
import * as C from '../src/lib/3d-tools/dual-text/dual-text-constants';

const font = opentype.parse(readFileSync('public/fonts/Anton-Regular.ttf').buffer as ArrayBuffer);

test('all three curated fonts cover Vietnamese vowel/tone combinations and Đ/đ', () => {
  const vowels = 'aăâeêioôơuưy';
  const tones = ['', '̀', '́', '̃', '̉', '̣'];
  const chars = [...vowels].flatMap(v => tones.flatMap(t => [(v + t).normalize('NFC'), (v + t).normalize('NFC').toUpperCase()])).concat(['đ', 'Đ']);
  for (const file of Object.values(C.FONTS)) {
    const bytes = readFileSync(`public${file}`);
    const f = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    for (const char of chars) assert.ok(f.charToGlyphIndex(char) > 0, `${file}: ${char}`);
  }
});

test('a block with one blank face equals the other face carved through the full cube', () => {
  const geometry = buildDualTextBlock({ char1: 'I', char2: ' ' }, font, 20);
  try {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    // The blank face is a full solid cube, so intersecting leaves char1's silhouette untouched
    // along z (full depth) while x/y stay narrower than the 20mm cube (a real glyph, not a box).
    assert.ok(Math.abs(box.max.z - box.min.z - 20) < 1e-4);
    assert.ok(box.max.x - box.min.x < 20);
    assert.ok(box.max.y - box.min.y <= 20 + 1e-6);
  } finally {
    geometry.dispose();
  }
});

test('both faces present produce a finite, positive-volume, bounded solid', () => {
  for (const [char1, char2] of [
    ['S', 'T'],
    ['O', 'I'],
    ['Đ', 'ộ'],
  ]) {
    const geometry = buildDualTextBlock({ char1, char2 }, font, 20);
    try {
      const position = geometry.getAttribute('position');
      assert.ok(position.count > 0);
      for (let i = 0; i < position.count; i++) assert.ok([position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite));
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      assert.ok(box.max.x - box.min.x <= 20 + 1e-6);
      assert.ok(box.max.y - box.min.y <= 20 + 1e-6);
      assert.ok(box.max.z - box.min.z <= 20 + 1e-6);
    } finally {
      geometry.dispose();
    }
  }
});

test('generateDualTextScene builds one base plus one block per max(word length), 1 and MAX_DUAL_TEXT_BLOCKS', () => {
  for (const [word1, word2] of [
    ['A', 'B'],
    ['X'.repeat(C.MAX_DUAL_TEXT_BLOCKS), 'Y'.repeat(C.MAX_DUAL_TEXT_BLOCKS)],
  ]) {
    const scene = generateDualTextScene(word1, word2, font, {});
    try {
      const expectedBlocks = Math.max(word1.length, word2.length);
      assert.equal(scene.children.length, 1 + expectedBlocks);
      const parts = getDualTextExportParts(scene);
      assert.equal(parts.length, 1 + expectedBlocks);
      assert.equal(parts[0].name, 'dual-text-base');
      parts.forEach(p => p.geometry.dispose());
    } finally {
      disposeDualTextScene(scene);
    }
  }
});

test('rejects words longer than MAX_DUAL_TEXT_BLOCKS, unsupported characters and invalid colors', () => {
  assert.throws(() => generateDualTextScene('X'.repeat(C.MAX_DUAL_TEXT_BLOCKS + 1), 'Y', font, {}));
  assert.throws(() => validateWord('emoji😀'));
  assert.throws(() => validateWord('Ж'));
  assert.throws(() => generateDualTextScene('OK', 'OK', font, { textColor: 'red' }));
  assert.throws(() => validateColor('#fff'));
  assert.throws(() => validateColor('red'));
});

test('rejects size/gap/margin/height/corner values outside the constants envelope', () => {
  assert.throws(() => generateDualTextScene('AB', 'CD', font, { blockSize: C.MIN_BLOCK_SIZE_MM - 1 }));
  assert.throws(() => generateDualTextScene('AB', 'CD', font, { blockSize: C.MAX_BLOCK_SIZE_MM + 1 }));
  assert.throws(() => generateDualTextScene('AB', 'CD', font, { gap: C.MAX_BLOCK_GAP_MM + 1 }));
  assert.throws(() => generateDualTextScene('AB', 'CD', font, { margin: C.MAX_BASE_MARGIN_MM + 1 }));
  assert.throws(() => generateDualTextScene('AB', 'CD', font, { baseHeight: C.MIN_BASE_HEIGHT_MM - 1 }));
  assert.throws(() => generateDualTextScene('AB', 'CD', font, { cornerPercent: 101 }));
});
