import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'manifold-3d';
import { buildOrganizer, sampleRoundedRect, texturedOutline, type ManifoldApi } from '../src/lib/3d-tools/organizer/organizer-geometry';
import { meshToStl } from '../src/lib/3d-tools/organizer/organizer-export';
import {
  DEFAULT_LABEL_PARAMS, DEFAULT_ORGANIZER_PARAMS as defaults, normalizeOrganizerParams, ORGANIZER_PRESETS, type OrganizerParams,
} from '../src/lib/3d-tools/organizer/organizer-params';

const api: Promise<ManifoldApi> = Module().then((module) => { module.setup(); return module; });
const build = async (input: Partial<OrganizerParams>) => buildOrganizer(await api, normalizeOrganizerParams({ ...defaults, ...input }).params, null, null);
const near = (actual: number, expected: number, relative: number) => Math.abs(actual - expected) <= Math.abs(expected) * relative;

test('default bin matches the reference model info (65.6 cm³, 81.3 g, ~1,900 triangles)', async () => {
  const result = await build({});
  assert.equal(result.status, 'NoError');
  assert.ok(near(result.info.volumeCm3, 65.6, 0.01), `volume ${result.info.volumeCm3}`);
  assert.ok(near(result.info.weightPlaG, 81.3, 0.01), `weight ${result.info.weightPlaG}`);
  assert.ok(near(result.info.triangles, 1900, 0.05), `triangles ${result.info.triangles}`);
  assert.equal(result.info.compartments, 6);
  assert.deepEqual(result.info.bbox, [120, 80, 40]);
  assert.equal(result.bin.indices.length / 3, result.info.triangles);
});

test('every preset and every feature builds a watertight manifold', async () => {
  const variants: Partial<OrganizerParams>[] = [
    ...ORGANIZER_PRESETS.map((preset) => preset.params),
    { stackingLip: true }, { labelTab: true }, { fingerScoops: true }, { floorHoles: true },
    ...(['fluted', 'reeded', 'ribbed', 'wavy', 'faceted'] as const).map((wallTexture) => ({ wallTexture })),
    { cols: 12, rows: 12, width: 300, depth: 300, stackingLip: true, fingerScoops: true, floorHoles: true, labelTab: true, wallTexture: 'wavy' as const },
    { columnWidths: [20, 30, 62.8], rowDepths: [50, 24.4] },
  ];
  for (const variant of variants) {
    const result = await build(variant);
    assert.equal(result.status, 'NoError', JSON.stringify(variant));
    assert.ok(result.info.volumeCm3 > 0 && result.info.triangles > 0, JSON.stringify(variant));
  }
});

test('features move the material volume in the expected direction', async () => {
  const base = (await build({})).info.volumeCm3;
  assert.ok((await build({ floorHoles: true })).info.volumeCm3 < base);
  assert.ok((await build({ fingerScoops: true })).info.volumeCm3 > base);
  assert.ok((await build({ labelTab: true })).info.volumeCm3 > base);
  assert.ok((await build({ wallTexture: 'reeded' })).info.volumeCm3 > base);
  assert.ok((await build({ wallTexture: 'fluted' })).info.volumeCm3 < base);
});

test('texture sampling stays within [120, 2400] points on the rounded outline', () => {
  const { points, perimeter } = sampleRoundedRect(120, 80, 3, 400);
  assert.equal(points.length, 400);
  assert.ok(Math.abs(perimeter - (2 * 114 + 2 * 74 + 2 * Math.PI * 3)) < 1e-9);
  assert.deepEqual([points[0].x, points[0].nx], [60, 1]);
  const low = texturedOutline(normalizeOrganizerParams({ ...defaults, wallTexture: 'faceted', textureCount: 4 }).params)!;
  assert.equal(low.length, 120);
  const high = texturedOutline(normalizeOrganizerParams({ ...defaults, width: 300, depth: 300, wallTexture: 'reeded', textureCount: 120, textureDepth: 0.2 }).params)!;
  assert.equal(high.length, 1680);
  assert.equal(texturedOutline(defaults), null);
});

test('snap-on label adds a boss to the bin and returns plate + text parts', async () => {
  const params = normalizeOrganizerParams(defaults).params;
  const square: [number, number][] = [[0, 0], [4, 0], [4, 6], [0, 6]];
  const hole: [number, number][] = [[1, 1], [1, 5], [3, 5], [3, 1]];
  const plain = buildOrganizer(await api, params, null, null);
  const labelled = buildOrganizer(await api, params, { ...DEFAULT_LABEL_PARAMS, enabled: true }, [square, hole]);
  assert.equal(labelled.status, 'NoError');
  assert.ok(labelled.label && labelled.label.text, 'label parts');
  assert.ok(labelled.info.volumeCm3 > plain.info.volumeCm3);
  assert.ok(labelled.labelFits);
  // Plate thickness = pocket 2.2 − lip 0.5 − gap 0.1 = 1.6 mm, text sticks out by the emboss depth.
  assert.ok(Math.abs(labelled.label!.size[2] - (1.6 + 0.6)) < 1e-6, `depth ${labelled.label!.size[2]}`);
  // Tag height is capped by the bin height (reference rule), so a 40 mm tag on a 12 mm bin still builds.
  const short = buildOrganizer(await api, normalizeOrganizerParams({ ...defaults, height: 12 }).params, { ...DEFAULT_LABEL_PARAMS, enabled: true, plateHeight: 40 }, null);
  assert.equal(short.status, 'NoError');
  assert.ok(short.label && short.label.text === null);
});

test('binary STL from the arrays has the right size and triangle count', async () => {
  const result = await build({});
  const data = new DataView(await meshToStl(result.bin).arrayBuffer());
  assert.equal(data.getUint32(80, true), result.info.triangles);
  assert.equal(data.byteLength, 84 + result.info.triangles * 50);
});
