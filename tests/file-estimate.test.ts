// Option 2 (ADR-0034): quote-first estimate for uploaded files.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { estimateAttachment, estimateFileBytes } from '../src/services/file-estimate.service.js';
import type { PricingContext } from '../src/services/instant-estimate.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const ctx: PricingContext = {
  config: { electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000 },
  medians: new Map([['PLA', 300], ['PETG', 350]]),
};

const sliceInfo = readFileSync(new URL('./fixtures/bambu-studio-slice-info.config', import.meta.url), 'utf8');
const sliced3mf = zipSync({ 'Metadata/slice_info.config': strToU8(sliceInfo), '3D/3dmodel.model': strToU8('<model/>') });
const unsliced3mf = zipSync({ '3D/3dmodel.model': strToU8('<model/>') });
const asciiCube = (() => {
  const v = (x: number, y: number, z: number) => `vertex ${x * 20} ${y * 20} ${z * 20}`;
  const quads = [[[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]];
  const tris = quads.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]]);
  return strToU8(`solid c\n${tris.map((t) => `facet normal 0 0 0\nouter loop\n${t.map((p) => v(p[0], p[1], p[2])).join('\n')}\nendloop\nendfacet`).join('\n')}\nendsolid`);
})();

test('sliced .3mf → SLICED estimate with real time/grams', () => {
  const result = estimateFileBytes(ctx, { fileName: 'part.3mf', bytes: sliced3mf });
  assert.equal(result.status, 'OK');
  assert.equal(result.estimate?.kind, 'SLICED');
  assert.ok((result.estimate?.specs.printMinutes ?? 0) > 0);
  for (const option of result.estimate!.options) assert.ok(option.priceVnd! > 0 && option.priceVnd! % 5_000 === 0);
});

test('unsliced .3mf without readable geometry → NOT_SLICED (customer is told how to export a sliced file)', () => {
  assert.deepEqual(estimateFileBytes(ctx, { fileName: 'part.3mf', bytes: unsliced3mf }), { status: 'NOT_SLICED', estimate: null });
});

test('.stl → MESH price range with bounding box (20 mm cube)', () => {
  const result = estimateFileBytes(ctx, { fileName: 'cube.stl', bytes: asciiCube });
  assert.equal(result.status, 'OK');
  assert.deepEqual(result.estimate?.specs.sizeMm, { x: 20, y: 20, z: 20 });
  const [option] = result.estimate!.options;
  assert.ok(option.minVnd! <= option.maxVnd!);
});

test('unsupported formats/materials and garbage files never throw', () => {
  assert.equal(estimateFileBytes(ctx, { fileName: 'part.step', bytes: strToU8('ISO-10303') }).status, 'UNSUPPORTED');
  assert.equal(estimateFileBytes(ctx, { fileName: 'cube.stl', bytes: asciiCube, materialType: 'RESIN' }).status, 'UNSUPPORTED');
  assert.equal(estimateFileBytes(ctx, { fileName: 'junk.stl', bytes: strToU8('not a mesh') }).status, 'UNREADABLE');
  assert.equal(estimateFileBytes(ctx, { fileName: 'junk.3mf', bytes: strToU8('not a zip') }).status, 'UNREADABLE');
  assert.equal(estimateFileBytes(ctx, { fileName: 'cube.stl', bytes: asciiCube, materialType: 'TPU' }).status, 'NO_MATERIAL_PRICE');
});

test('estimateAttachment rejects paths outside the private requests/ folder before downloading', async () => {
  let downloaded = false;
  const download = async () => { downloaded = true; return asciiCube; };
  for (const path of ['../secret.stl', 'requests/../../x.stl', 'products/abc.stl', 'requests/abc.exe']) {
    await assert.rejects(() => estimateAttachment(path, null, { download }), (error: unknown) => error instanceof DomainError && error.code === 'INVALID_ATTACHMENT_PATH');
  }
  assert.equal(downloaded, false);
  assert.deepEqual(await estimateAttachment('requests/0f0e0d0c-0b0a-4908-8706-050403020100.png', null, { download }), { status: 'UNSUPPORTED', estimate: null });
});

test('estimateAttachment prices a stored STL with the shop’s current config', { skip: !hasDb }, async () => {
  await query(`insert into pricing_configs (electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw, labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd, effective_from)
    values (3500, 15000000, 10000, 0.2, 35000, 10, 40, 5000, timezone('utc', now()) - interval '1 second')`);
  await query(`insert into materials (name, material_type, unit, current_unit_cost, is_active) values ('File estimate PLA', 'PLA', 'GRAM', 300, true)`);
  const result = await estimateAttachment('requests/0f0e0d0c-0b0a-4908-8706-050403020100.stl', null, { download: async () => asciiCube });
  assert.equal(result.status, 'OK');
  assert.equal(result.estimate?.kind, 'MESH');
});

// Unsliced Bambu-style project: main model with components pointing into 3D/Objects/*.model.
function cubeMeshXml(size: number): string {
  const v = [[0, 0, 0], [size, 0, 0], [size, size, 0], [0, size, 0], [0, 0, size], [size, 0, size], [size, size, size], [0, size, size]];
  const t = [[0, 3, 2], [0, 2, 1], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  return `<mesh><vertices>${v.map((p) => `<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`).join('')}</vertices><triangles>${t.map((x) => `<triangle v1="${x[0]}" v2="${x[1]}" v3="${x[2]}"/>`).join('')}</triangles></mesh>`;
}
const projectMain = `<?xml version="1.0"?><model unit="millimeter" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><resources>
  <object id="2" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1" transform="2 0 0 0 2 0 0 0 2 0 0 0"/></components></object>
</resources><build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 10 10 0"/><item objectid="2" transform="1 0 0 0 1 0 0 0 1 60 10 0"/></build></model>`;
const projectObject = `<?xml version="1.0"?><model unit="millimeter"><resources><object id="1" type="model">${cubeMeshXml(10)}</object></resources><build/></model>`;
const project3mf = zipSync({ '3D/3dmodel.model': strToU8(projectMain), '3D/Objects/object_1.model': strToU8(projectObject), 'Metadata/project_settings.config': strToU8('{}') });

test('unsliced .3mf project → geometry volume (components + scale + copies) → price range with SLICE_FOR_EXACT hint', async () => {
  const { parseThreeMfMeshVolume } = await import('../src/lib/parsers/mesh-volume.js');
  // 10 mm cube scaled ×2 → 8 cm³, placed twice → 16 cm³
  assert.ok(Math.abs(parseThreeMfMeshVolume(project3mf).volumeCm3 - 16) < 1e-6);
  const result = estimateFileBytes(ctx, { fileName: 'raposa.3mf', bytes: project3mf });
  assert.equal(result.status, 'OK');
  assert.equal(result.hint, 'SLICE_FOR_EXACT');
  assert.equal(result.estimate?.kind, 'MESH');
  assert.ok(result.estimate!.options[0].minVnd! > 0);
});
