import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as opentype from 'opentype.js';
import { arcLengthMm, findMissingGlyphs, fitTextOnArc, graphemeCount, graphemes, normalizeText, textWidthMm } from '../src/lib/3d-tools/common/text-metrics';

const bytes = readFileSync('public/fonts/BeVietnamPro-Bold.ttf');
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

test('normalizeText: NFC, whitespace runs collapse, trimmed; blank becomes empty', () => {
  assert.equal(normalizeText('  Bông \n\t Gòn  '), 'Bông Gòn');
  assert.equal(normalizeText('Bông').length, 4);
  assert.equal(normalizeText('   '), '');
  assert.equal(normalizeText('\n'), '');
});

test('graphemeCount counts what a person sees, not code units or code points', () => {
  assert.equal(graphemeCount('ĐẠT'), 3);
  assert.equal(graphemeCount('Bông Gòn'), 8);
  assert.equal(graphemeCount('Đạt'), 3); // decomposed ạ → 1
  assert.equal(graphemeCount('Mít Ướt Ữ ỹ'), 11);
  assert.equal(graphemeCount('🐶Mimi'), 5);
  assert.equal(graphemeCount('👨‍👩‍👧'), 1);
  assert.equal(graphemeCount('🇻🇳'), 1);
  assert.equal(graphemeCount(''), 0);
  assert.deepEqual(graphemes('A B'), ['A', ' ', 'B']);
});

test('findMissingGlyphs: full Vietnamese is drawable; emoji and CJK are reported once each', () => {
  const vowels = 'aăâeêioôơuưy';
  const tones = ['', '̀', '́', '̃', '̉', '̣'];
  const vietnamese = [...vowels].flatMap(v => tones.map(t => (v + t).normalize('NFC'))).join('');
  assert.deepEqual(findMissingGlyphs(font, vietnamese + vietnamese.toUpperCase() + 'Đđ'), []);
  assert.deepEqual(findMissingGlyphs(font, 'Bông Gòn'), []);
  assert.deepEqual(findMissingGlyphs(font, '   '), []);
  assert.deepEqual(findMissingGlyphs(font, '🐶Mimi🐶'), ['🐶']);
  assert.deepEqual(findMissingGlyphs(font, '👨‍👩‍👧'), ['👨‍👩‍👧']);
  assert.deepEqual(findMissingGlyphs(font, '小白'), ['小', '白']);
});

test('textWidthMm scales linearly with size and grows with length', () => {
  const w10 = textWidthMm(font, 'Bông Gòn', 10);
  assert.ok(w10 > 0);
  assert.ok(Math.abs(textWidthMm(font, 'Bông Gòn', 20) - 2 * w10) < 1e-9);
  assert.ok(textWidthMm(font, 'Bông Gòn Bông Gòn', 10) > w10);
  assert.equal(textWidthMm(font, '', 10), 0);
  assert.throws(() => textWidthMm(font, 'A', 0), RangeError);
  assert.throws(() => textWidthMm(font, 'A', Number.NaN), RangeError);
});

test('arcLengthMm and fitTextOnArc: fits the free arc minus both margins', () => {
  assert.ok(Math.abs(arcLengthMm(50, 180) - 50 * Math.PI) < 1e-9);
  assert.equal(arcLengthMm(50, 0), 0);
  assert.throws(() => arcLengthMm(0, 90), RangeError);
  assert.throws(() => arcLengthMm(50, 361), RangeError);
  const w = textWidthMm(font, 'ĐẠT', 12);
  const exact = (w / 60) * (180 / Math.PI); // angle that exactly holds the text at r = 60
  assert.equal(fitTextOnArc(font, 'ĐẠT', 12, 60, exact + 0.01).fits, true);
  assert.equal(fitTextOnArc(font, 'ĐẠT', 12, 60, exact - 0.01).fits, false);
  const withMargin = fitTextOnArc(font, 'ĐẠT', 12, 60, exact + 0.01, 3);
  assert.equal(withMargin.fits, false);
  assert.ok(Math.abs(withMargin.usedAngleDeg - exact) < 1e-9);
  assert.equal(fitTextOnArc(font, 'ĐẠT', 12, 60, 10, 1000).availableMm, 0);
});
