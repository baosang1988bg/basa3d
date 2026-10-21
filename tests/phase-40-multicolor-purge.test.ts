// Phase 40 (ADR-0043): unsliced multi-color Bambu/Orca projects get an AMS purge + color-change
// estimate; anything the parser doesn't understand prices exactly as before.
// NOTE: fixtures follow Bambu Studio's project layout as documented in the ADR. Replace/extend with a
// real exported project (e.g. gengar-keycap.3mf) once the OWNER provides one.
import assert from 'node:assert/strict';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { decodePaintStates, parseThreeMfProjectInfo } from '../src/lib/parsers/threemf-project-info.js';
import { estimateFileBytes } from '../src/services/file-estimate.service.js';
import { COLOR_CHANGE_SECONDS, estimateColorPurge, roundInstant, type PricingContext } from '../src/services/instant-estimate.service.js';

const ctx: PricingContext = {
  config: { electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000 },
  medians: new Map([['PLA', 300], ['PETG', 350]]),
};

const NS = 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"';

/** Axis-aligned box mesh; optional paint_color on every triangle. */
function box(id: number, [x0, y0, z0]: number[], [x1, y1, z1]: number[], paint?: string) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const p = paint ? ` paint_color="${paint}"` : '';
  return `<object id="${id}" type="model"><mesh><vertices>${v.map(([a, b, c]) => `<vertex x="${a}" y="${b}" z="${c}"/>`).join('')}</vertices>`
    + `<triangles>${f.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"${p}/>`).join('')}</triangles></mesh></object>`;
}

function project(opts: {
  parts: { id: number; extruder: number; from: number[]; to: number[]; paint?: string }[];
  colours?: string[];
  flush?: number[];
  layerHeight?: string;
  primeTower?: boolean;
  withSettings?: boolean;
}) {
  const colours = opts.colours ?? ['#FFFFFF', '#000000', '#7B2FBE', '#E53935'];
  const objects = `<?xml version="1.0"?><model unit="millimeter" ${NS}><resources>${opts.parts.map((p) => box(p.id, p.from, p.to, p.paint)).join('')}</resources><build/></model>`;
  const main = `<?xml version="1.0"?><model unit="millimeter" ${NS}><resources><object id="10" type="model"><components>`
    + opts.parts.map((p) => `<component p:path="/3D/Objects/object_1.model" objectid="${p.id}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`).join('')
    + `</components></object></resources><build><item objectid="10" transform="1 0 0 0 1 0 0 0 1 128 128 0"/></build></model>`;
  const modelSettings = `<?xml version="1.0"?><config><object id="10"><metadata key="name" value="keycap"/><metadata key="extruder" value="1"/>`
    + opts.parts.map((p) => `<part id="${p.id}" subtype="normal_part"><metadata key="extruder" value="${p.extruder}"/></part>`).join('')
    + `</object><plate><metadata key="plater_id" value="1"/><model_instance><metadata key="object_id" value="10"/><metadata key="instance_id" value="0"/></model_instance></plate></config>`;
  const settings = {
    filament_colour: colours, filament_type: colours.map(() => 'PLA'),
    flush_volumes_matrix: opts.flush ?? colours.flatMap((_, i) => colours.map((__, j) => (i === j ? '0' : '200'))),
    flush_multiplier: '1', layer_height: opts.layerHeight ?? '0.2', enable_prime_tower: opts.primeTower === false ? '0' : '1',
    prime_volume: '45', printer_model: 'Bambu Lab P2S',
  };
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types/>'),
    '3D/3dmodel.model': strToU8(main),
    '3D/Objects/object_1.model': strToU8(objects),
    'Metadata/model_settings.config': strToU8(modelSettings),
  };
  if (opts.withSettings !== false) files['Metadata/project_settings.config'] = strToU8(JSON.stringify(settings));
  return zipSync(files);
}

// A 20 mm tall keycap: white base + 3 colored parts stacked across the full height (4 colors every layer).
const fourColor = project({ parts: [
  { id: 1, extruder: 1, from: [0, 0, 0], to: [18, 18, 20] },
  { id: 2, extruder: 2, from: [2, 2, 0], to: [6, 6, 20] },
  { id: 3, extruder: 3, from: [8, 8, 0], to: [12, 12, 20] },
  { id: 4, extruder: 4, from: [13, 13, 0], to: [16, 16, 20] },
] });
const oneColor = project({ parts: [{ id: 1, extruder: 1, from: [0, 0, 0], to: [18, 18, 20] }] });

test('decodePaintStates: Bambu TriangleSelector nibbles (leaf states, split nodes, extended state)', () => {
  assert.deepEqual([...decodePaintStates('4')], [1]);
  assert.deepEqual([...decodePaintStates('8')], [2]);
  assert.deepEqual([...decodePaintStates('0C')], [3]); // 3 + 0
  assert.deepEqual([...decodePaintStates('1C')], [4]); // 3 + 1
  assert.deepEqual([...decodePaintStates('843')].sort(), [1, 2]); // split node (3) then two leaves
  assert.deepEqual([...decodePaintStates('zz')], []); // garbage → nothing, never throws
});

test('project info: 4 filaments on one plate, every layer multi-color → (4-1) changes per layer', () => {
  const info = parseThreeMfProjectInfo(fourColor);
  assert.ok(info);
  assert.equal(info.printerModel, 'Bambu Lab P2S');
  assert.equal(info.plates.length, 1);
  assert.deepEqual(info.plates[0].filaments, [1, 2, 3, 4]);
  assert.equal(info.plates[0].multiColorLayers, 100); // 20 mm / 0.2 mm
  assert.equal(info.plates[0].colorChanges, 300);
  assert.deepEqual(info.plates[0].sizeMm, { x: 18, y: 18, z: 20 });
});

test('project info: painted triangles count as their filament; partial height → fewer changes', () => {
  // Part 1 (extruder 1) full height; part 2 painted with filament 2 only on its top 5 mm.
  const info = parseThreeMfProjectInfo(project({ parts: [
    { id: 1, extruder: 1, from: [0, 0, 0], to: [18, 18, 20] },
    { id: 2, extruder: 1, from: [4, 4, 15], to: [8, 8, 20], paint: '8' },
  ] }));
  assert.deepEqual(info?.plates[0].filaments, [1, 2]);
  assert.equal(info?.plates[0].colorChanges, 25); // 5 mm / 0.2 mm, 1 change per layer
});

test('project info: single color → 0 changes; non-project / garbage → null (estimate unchanged)', () => {
  assert.equal(parseThreeMfProjectInfo(oneColor)?.plates[0].colorChanges, 0);
  assert.equal(parseThreeMfProjectInfo(project({ parts: [{ id: 1, extruder: 1, from: [0, 0, 0], to: [5, 5, 5] }], withSettings: false })), null);
  assert.equal(parseThreeMfProjectInfo(strToU8('not a zip')), null);
});

test('estimateColorPurge: changes × (avg flush × multiplier + prime) → grams PLA; changes × 40 s', () => {
  const purge = estimateColorPurge(parseThreeMfProjectInfo(fourColor)!);
  assert.ok(purge);
  assert.equal(purge.colorChanges, 300);
  // 300 × (200 + 45) mm³ = 73.5 cm³ × 1.24 g/cm³ = 91.1 g
  assert.equal(purge.purgeGrams, 91.1);
  assert.equal(purge.extraMinutes, Math.round((300 * COLOR_CHANGE_SECONDS) / 60));
  assert.deepEqual(purge.colors, ['#FFFFFF', '#000000', '#7B2FBE', '#E53935']);
  // Prime tower off → flush only.
  const noTower = estimateColorPurge(parseThreeMfProjectInfo(project({ parts: [
    { id: 1, extruder: 1, from: [0, 0, 0], to: [10, 10, 2] }, { id: 2, extruder: 2, from: [0, 0, 0], to: [2, 2, 2] },
  ], primeTower: false }))!);
  assert.equal(noTower?.purgeGrams, Math.round(((10 * 200) / 1000) * 1.24 * 10) / 10);
});

test('file estimate: 4-color keycap costs clearly more than the same model in 1 color, with transparent specs', () => {
  const multi = estimateFileBytes(ctx, { fileName: 'keycap.3mf', bytes: fourColor });
  const single = estimateFileBytes(ctx, { fileName: 'keycap.3mf', bytes: oneColor });
  assert.equal(multi.status, 'OK');
  assert.equal(single.status, 'OK');
  const m = multi.estimate!; const s = single.estimate!;
  assert.ok(m.options[0].minVnd! > s.options[0].maxVnd!, `multi ${m.options[0].minVnd} should exceed single ${s.options[0].maxVnd}`);
  assert.equal(m.specs.colorChanges, 300);
  assert.equal(m.specs.purgeGrams, 91.1);
  assert.equal(m.specs.colorsCount, 4);
  assert.deepEqual(m.specs.sizeMm, { x: 18, y: 18, z: 20 });
  assert.ok(m.specs.modelGrams && m.specs.modelGrams.min < m.specs.modelGrams.max);
  assert.ok(m.specs.printMinutesRange!.min >= 200, 'adds ~200 min of color changes');
  assert.equal(s.specs.purgeGrams, undefined);
  assert.equal(s.specs.colorChanges, undefined);
});

test('roundInstant rounds UP to 5.000đ — never below the ADR-0010 price', () => {
  assert.equal(roundInstant(26_000), 30_000);
  assert.equal(roundInstant(25_000), 25_000);
  assert.equal(roundInstant(1), 5_000);
});
