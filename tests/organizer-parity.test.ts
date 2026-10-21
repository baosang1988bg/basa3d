import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Module from 'manifold-3d';
import * as opentype from 'opentype.js';
import { buildOrganizer, type ManifoldApi } from '../src/lib/3d-tools/organizer/organizer-geometry';
import { textToPolygons } from '../src/lib/3d-tools/organizer/organizer-label-text';
import {
  DEFAULT_LABEL_PARAMS, normalizeLabelParams, normalizeOrganizerParams, type LabelParams, type OrganizerParams,
} from '../src/lib/3d-tools/organizer/organizer-params';
import { DEFAULT_LABEL_FONT_URL } from '../src/lib/3d-tools/organizer/organizer-worker-protocol';

/**
 * Phase 45 lát G — golden values measured on the reference page (tests/fixtures/organizer-parity.json).
 * manifold-3d is pinned to the reference's exact WASM build and the label font is the reference's own
 * Inter file, so volumes and triangle counts match exactly; the tolerances only absorb float printing.
 */
type ParityCase = {
  id: string;
  params: Partial<OrganizerParams>;
  label: Partial<LabelParams> | null;
  expected: {
    volumeCm3: number; weightPlaG: number; triangles: number; compartments: number;
    bbox: [number, number, number]; cellInner: [number, number]; warnings: string[];
    label: { volumeCm3: number; triangles: number; size: [number, number, number] } | null;
  };
};
const fixture = JSON.parse(readFileSync('tests/fixtures/organizer-parity.json', 'utf8')) as { cases: ParityCase[] };
const fontBytes = readFileSync(`public${DEFAULT_LABEL_FONT_URL}`);
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
const api: Promise<ManifoldApi> = Module().then((module) => { module.setup(); return module; });
/** Warnings that only BaSa3D emits (phase-45 D8/D4); the reference never reports them. */
const BASA3D_ONLY_WARNINGS = new Set(['warn.thinWalls', 'warn.customAutoFit', 'warn.customReset', 'warn.labelNoFit']);
const near = (actual: number, expected: number, relative = 1e-4) => Math.abs(actual - expected) <= Math.max(1e-6, Math.abs(expected) * relative);

test('parity fixture covers the default bin, 6 presets, 5 textures, 4 toggles and the snap-on label', () => {
  const ids = fixture.cases.map((item) => item.id);
  assert.ok(ids.includes('default'));
  assert.equal(ids.filter((id) => id.startsWith('preset:')).length, 6);
  assert.equal(ids.filter((id) => id.startsWith('texture:')).length, 5);
  assert.equal(ids.filter((id) => id.startsWith('toggle:')).length, 4);
  assert.ok(ids.some((id) => id.startsWith('label:')));
});

for (const item of fixture.cases) {
  test(`parity with the reference: ${item.id}`, async () => {
    const { params, warnings } = normalizeOrganizerParams(item.params);
    const label = item.label ? normalizeLabelParams({ ...DEFAULT_LABEL_PARAMS, ...item.label }) : null;
    const polygons = label?.enabled && label.text.trim() ? textToPolygons(font, label.text, label.fontSize) : null;
    const result = buildOrganizer(await api, params, label, polygons);
    const want = item.expected;

    assert.equal(result.status, 'NoError');
    assert.ok(near(result.info.volumeCm3, want.volumeCm3), `volume ${result.info.volumeCm3} vs ${want.volumeCm3}`);
    assert.ok(near(result.info.weightPlaG, want.weightPlaG), `weight ${result.info.weightPlaG} vs ${want.weightPlaG}`);
    assert.equal(result.info.triangles, want.triangles);
    assert.equal(result.info.compartments, want.compartments);
    assert.deepEqual(result.info.bbox, want.bbox);
    result.info.cellInner.forEach((value, index) => assert.ok(near(value, want.cellInner[index]), `cell ${value} vs ${want.cellInner[index]}`));
    assert.deepEqual(warnings.filter((key) => !BASA3D_ONLY_WARNINGS.has(key)), want.warnings);

    if (want.label) {
      assert.ok(result.label, 'label parts');
      assert.ok(near(result.label.volumeCm3, want.label.volumeCm3), `label volume ${result.label.volumeCm3} vs ${want.label.volumeCm3}`);
      assert.equal(result.label.triangles, want.label.triangles);
      result.label.size.forEach((value, index) => assert.ok(near(value, want.label!.size[index]), `label size ${value} vs ${want.label!.size[index]}`));
    } else {
      assert.equal(result.label, null);
    }
  });
}
