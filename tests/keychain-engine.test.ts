import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as opentype from 'opentype.js';
import { buildKeychainModel, exportKeychainStl } from '../src/lib/keychain/keychain-engine';

async function loadFont() {
  const bytes = await readFile('public/fonts/BeVietnamPro-Regular.ttf');
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

test('keychain geometry responds to typography, padding, thickness, rounding, and hole controls', async () => {
  const font = await loadFont();
  const compact = buildKeychainModel({
    text: 'Nguyễn', baseThicknessMm: 2, includeKeyringHole: true,
    fontSizeMm: 9, letterSpacing: 0.8, horizontalPaddingMm: 4, verticalPaddingMm: 3,
    cornerRadiusMm: 2, textThicknessMm: 0.8, keyringHoleDiameterMm: 3,
  }, font);
  const roomy = buildKeychainModel({
    text: 'Nguyễn', baseThicknessMm: 4, includeKeyringHole: true,
    fontSizeMm: 15, letterSpacing: 1.5, horizontalPaddingMm: 12, verticalPaddingMm: 9,
    cornerRadiusMm: 8, textThicknessMm: 2.4, keyringHoleDiameterMm: 7,
  }, font);

  assert.ok(roomy.widthMm > compact.widthMm);
  assert.ok(roomy.heightMm > compact.heightMm);
  assert.ok(exportKeychainStl(roomy.mergedGeometry).size > 84);

  compact.baseGeometry.dispose(); compact.textGeometry.dispose(); compact.mergedGeometry.dispose();
  roomy.baseGeometry.dispose(); roomy.textGeometry.dispose(); roomy.mergedGeometry.dispose();
});
