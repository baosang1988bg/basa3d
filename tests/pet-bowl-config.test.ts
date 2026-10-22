import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isPetBowlEnabled } from '../src/config/pet-bowl';
import * as C from '../src/lib/3d-tools/pet-bowl-stand/pet-bowl-stand-constants';
import { PRINTER_PROFILES } from '../src/lib/pricing/printer-profiles';

test('pet bowl flag is off unless exactly "true"', () => {
  assert.equal(isPetBowlEnabled({}), false);
  assert.equal(isPetBowlEnabled({ NEXT_PUBLIC_PET_BOWL_ENABLED: 'false' }), false);
  assert.equal(isPetBowlEnabled({ NEXT_PUBLIC_PET_BOWL_ENABLED: '1' }), false);
  assert.equal(isPetBowlEnabled({ NEXT_PUBLIC_PET_BOWL_ENABLED: 'true' }), true);
});

test('.env.example keeps the flag false while ADR-0050 values are unconfirmed', () => {
  const line = readFileSync('.env.example', 'utf8').split('\n').find(l => l.startsWith('NEXT_PUBLIC_PET_BOWL_ENABLED='));
  assert.ok(line, '.env.example must declare NEXT_PUBLIC_PET_BOWL_ENABLED');
  if (C.PET_BOWL_UNCONFIRMED.length > 0) assert.equal(line, 'NEXT_PUBLIC_PET_BOWL_ENABLED=false');
  assert.equal(C.BOWL_SIZES.every(b => b.measured), C.PET_BOWL_UNCONFIRMED.every(k => !k.startsWith('BOWL_SIZES')));
});

test('ADR-0050 constants are internally consistent', () => {
  for (const b of C.BOWL_SIZES) {
    const hole = b.bodyBelowLipDiameterMm + C.HOLE_CLEARANCE_MM;
    assert.ok(b.lipDiameterMm - hole >= 2 * C.MIN_LEDGE_WIDTH_MM, `${b.id}: lip must overhang the hole`);
    assert.ok(b.depthMm > 0 && b.capacityMl > 0 && b.emptyMassG > 0);
  }
  for (const rule of Object.values(C.HEIGHT_RULES)) {
    assert.ok(rule.k > 0 && rule.minMm > 0 && rule.minMm < rule.maxMm);
    // Phase 47 rule: never reuse the reference's coefficients.
    assert.ok(![0.3, 0.35].includes(rule.k));
  }
  assert.ok(C.PET_BOWL_MAIN_PRINTER_ID === null || C.PET_BOWL_MAIN_PRINTER_ID in PRINTER_PROFILES);
  assert.ok(C.MAX_OVERHANG_DEG <= 45);
  assert.ok(C.GDV_WARNING.vi.length > 0 && C.GDV_WARNING.en.length > 0);
});

test('bed check uses the smallest build volume across every printer profile', () => {
  const all = Object.values(PRINTER_PROFILES);
  const v = C.petBowlBuildVolumeMm();
  for (const axis of ['x', 'y', 'z'] as const) {
    assert.equal(v[axis], Math.min(...all.map(p => p.buildVolumeMm[axis])));
    for (const p of all) assert.ok(v[axis] <= p.buildVolumeMm[axis]);
  }
  assert.deepEqual(v, { x: 256, y: 256, z: 256 }); // today: Bambu P2S < Snapmaker U1
});
