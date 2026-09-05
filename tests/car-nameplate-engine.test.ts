import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as opentype from 'opentype.js';
import {
  buildCarNameplate,
  disposeCarScene,
  generateCarNameplateScene,
  getCarExportParts,
  validateColor,
  validateName,
} from '../src/lib/3d-tools/car-nameplate/car-nameplate-engine';
import * as C from '../src/lib/3d-tools/car-nameplate/car-nameplate-constants';

const font = opentype.parse(readFileSync('public/fonts/Anton-Regular.ttf').buffer as ArrayBuffer);

test('the 3 curated fonts cover Vietnamese vowel/tone combinations and Đ/đ', () => {
  const vowels = 'aăâeêioôơuưy';
  const tones = ['', '̀', '́', '̃', '̉', '̣'];
  const chars = [...vowels].flatMap(v => tones.flatMap(t => [(v + t).normalize('NFC'), (v + t).normalize('NFC').toUpperCase()])).concat(['đ', 'Đ']);
  for (const file of Object.values(C.FONTS)) {
    const bytes = readFileSync(`public${file}`);
    const f = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    for (const char of chars) assert.ok(f.charToGlyphIndex(char) > 0, `${file}: ${char}`);
  }
});

test('buildCarNameplate produces a finite, positive-volume solid bounded by the requested width', () => {
  for (const [name, width] of [['LEO', C.NAMEPLATE_SIZE_PRESETS_MM.keychain], ['MINH ANH', C.NAMEPLATE_SIZE_PRESETS_MM.large]] as const) {
    const geometry = buildCarNameplate(name, font, { totalWidthMm: width });
    try {
      const position = geometry.getAttribute('position');
      assert.ok(position.count > 0);
      for (let i = 0; i < position.count; i++) assert.ok([position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite));
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      assert.ok(box.max.x - box.min.x <= width + 1e-6);
      assert.ok(box.max.y - box.min.y <= width * 0.42 + 1e-6);
      assert.ok(box.max.z - box.min.z <= width + 1e-6);
    } finally {
      geometry.dispose();
    }
  }
});

test('generateCarNameplateScene: base is optional, keyring tab only meaningful with a base', () => {
  const withBase = generateCarNameplateScene('LEO', font, { addBase: true, addKeyring: true });
  try {
    assert.deepEqual(withBase.children.map(c => c.name), ['car-base', 'car-nameplate']);
    const parts = getCarExportParts(withBase);
    assert.equal(parts.length, 2);
    parts.forEach(p => p.geometry.dispose());
  } finally {
    disposeCarScene(withBase);
  }
  const withoutBase = generateCarNameplateScene('LEO', font, { addBase: false });
  try {
    assert.deepEqual(withoutBase.children.map(c => c.name), ['car-nameplate']);
  } finally {
    disposeCarScene(withoutBase);
  }
});

test('rejects names outside 1..MAX_NAME_LENGTH, unsupported characters and invalid colors', () => {
  assert.throws(() => validateName(''));
  assert.throws(() => validateName('X'.repeat(C.MAX_NAME_LENGTH + 1)));
  assert.throws(() => validateName('😀'));
  assert.throws(() => validateName('Ж'));
  assert.throws(() => generateCarNameplateScene('OK', font, { nameplateColor: 'red' }));
  assert.throws(() => validateColor('#fff'));
});

test('rejects width/overlap/base-thickness values outside the constants envelope', () => {
  assert.throws(() => generateCarNameplateScene('OK', font, { totalWidthMm: C.MIN_NAMEPLATE_WIDTH_MM - 1 }));
  assert.throws(() => generateCarNameplateScene('OK', font, { totalWidthMm: C.MAX_NAMEPLATE_WIDTH_MM + 1 }));
  assert.throws(() => generateCarNameplateScene('OK', font, { baseOverlapMm: C.MAX_BASE_OVERLAP_MM + 1 }));
  assert.throws(() => generateCarNameplateScene('OK', font, { addBase: true, baseThicknessMm: C.MIN_BASE_THICKNESS_MM - 1 }));
});
