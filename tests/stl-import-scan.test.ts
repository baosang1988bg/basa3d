// Feature 003 — scan, grouping, metrics and price estimate of imported models (FR-001..FR-005).
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { groupModels, walkDir } from '../src/lib/stl-import/scan';
import { analyzeModel } from '../src/lib/stl-import/metrics';
import { estimateImportPrice } from '../src/lib/stl-import/pricing';
import { binaryStl, boxTriangles, buildStlFixtures } from './fixtures/stl-import/build-fixtures';
import type { PricingConfigInput } from '../src/services/pricing.service';

let root = '';
before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'basa3d-stl-'));
  await buildStlFixtures(root);
});
after(async () => { if (root) await rm(root, { recursive: true, force: true }); });

const GiB = 1024 ** 3;

test('walkDir lists only STL files, relative and NFC-normalised', async () => {
  const files = await walkDir(root);
  const paths = files.map((file) => file.relPath).sort();
  assert.ok(paths.includes('Figures/Ếch_xanh_v2.stl'), 'NFD name on disk comes back as NFC');
  assert.ok(!paths.some((relPath) => relPath.endsWith('.txt')));
  assert.equal(paths.length, 8);
});

test('FOLDER mode (default): one leaf folder = one model; a root-level file is its own model', async () => {
  const groups = groupModels(await walkDir(root), 'FOLDER', { maxBytes: GiB });
  const byPath = new Map(groups.map((group) => [group.sourceRelPath, group]));
  const cat = byPath.get('Figures/Cat');
  assert.ok(cat);
  assert.equal(cat.files.length, 2);
  assert.equal(cat.sourceDir, 'Figures');
  assert.equal(cat.groupMode, 'FOLDER');
  assert.equal(cat.nameSource, 'Cat');
  // Figures/ is not a leaf (it holds Cat/), so its loose file is a model of its own.
  assert.equal(byPath.get('Figures'), undefined);
  assert.equal(byPath.get('Figures/Ếch_xanh_v2.stl')?.groupMode, 'FILE');
  assert.equal(byPath.get('Figures/Ếch_xanh_v2.stl')?.sourceDir, 'Figures');
  assert.equal(byPath.get('Broken')?.files.length, 2, 'a leaf folder of broken parts is still one model');
  const rootModel = byPath.get('root-cube.stl');
  assert.equal(rootModel?.groupMode, 'FILE');
  assert.equal(rootModel?.sourceDir, '');
});

test('FILE mode: one STL = one model; --only and --max-mb filter files', async () => {
  const files = await walkDir(root);
  const groups = groupModels(files, 'FILE', { maxBytes: GiB });
  assert.equal(groups.length, 8);
  assert.equal(groups.find((group) => group.sourceRelPath === 'Figures/Cat/cat-body.stl')?.sourceDir, 'Figures/Cat');
  assert.deepEqual(groupModels(files, 'FILE', { maxBytes: GiB, only: 'Tools/**' }).map((group) => group.sourceRelPath), ['Tools/12345.stl']);
  const capped = groupModels(files, 'FOLDER', { maxBytes: 100 }).find((group) => group.sourceRelPath === 'Figures/Cat');
  assert.equal(capped?.files.length, 0);
  assert.equal(capped?.oversizeSkipped.length, 2);
});

test('metrics: multi-part bbox is the union, volume the sum; binary and ASCII STL both parse', async () => {
  const body = new Uint8Array(await readFile(path.join(root, 'Figures/Cat/cat-body.stl')));
  const tail = new Uint8Array(await readFile(path.join(root, 'Figures/Cat/cat-tail.stl')));
  const result = analyzeModel([{ relPath: 'body', bytes: body }, { relPath: 'tail', bytes: tail }]);
  assert.ok(result.ok);
  assert.deepEqual(result.bboxMm, { x: 45, y: 20, z: 25 });
  assert.equal(result.volumeCm3, (30 * 20 * 25 + 17 * 5 * 5) / 1000);
  assert.equal(result.triangles, 24);
  assert.deepEqual(result.warnings, []);
  const frog = new Uint8Array(await readFile(path.join(root, 'Figures/Ếch_xanh_v2.stl'.normalize('NFD'))));
  const ascii = analyzeModel([{ relPath: 'frog', bytes: frog }]);
  assert.ok(ascii.ok);
  assert.deepEqual(ascii.bboxMm, { x: 20, y: 15, z: 12 });
});

test('metrics: empty and garbage files fail softly; tiny/huge models are flagged; overlapping parts warn', async () => {
  const empty = analyzeModel([{ relPath: 'empty.stl', bytes: new Uint8Array() }]);
  assert.ok(!empty.ok && /MESH_EMPTY/.test(empty.error) && empty.error.startsWith('empty.stl'));
  const garbage = analyzeModel([{ relPath: 'g.stl', bytes: new TextEncoder().encode('nope') }]);
  assert.ok(!garbage.ok);
  assert.ok(!analyzeModel([]).ok);
  const coin = analyzeModel([{ relPath: 'coin', bytes: binaryStl(boxTriangles([0, 0, 0], [3, 3, 1])) }]);
  assert.ok(coin.ok && coin.warnings.includes('UNIT_TOO_SMALL'));
  const huge = analyzeModel([{ relPath: 'huge', bytes: binaryStl(boxTriangles([0, 0, 0], [500, 10, 10])) }]);
  assert.ok(huge.ok && huge.warnings.includes('UNIT_TOO_LARGE'));
  const twin = binaryStl(boxTriangles([0, 0, 0], [20, 20, 20]));
  const overlap = analyzeModel([{ relPath: 'a', bytes: twin }, { relPath: 'b', bytes: twin }]);
  assert.ok(overlap.ok && overlap.warnings.includes('PARTS_OVERLAP'));
});

const config: PricingConfigInput = {
  electricityVndPerKwh: 3_000, machinePriceVnd: 20_000_000, machineLifetimeHours: 5_000, printerPowerKw: 0.15,
  laborVndPerHour: 60_000, failureBufferPct: 10, marginPct: 30, packagingFeeVnd: 5_000,
};

test('price estimate uses the shop config + PLA median; unpriced cases never guess', () => {
  const cube = analyzeModel([{ relPath: 'cube', bytes: binaryStl(boxTriangles([0, 0, 0], [30, 30, 30])) }]);
  assert.ok(cube.ok);
  const medians = new Map([['PLA', 400]]);
  const priced = estimateImportPrice(cube.metrics, { config, medians, pricingConfigId: '00000000-0000-4000-8000-000000000001' });
  assert.ok(priced.priced);
  assert.ok(Number.isInteger(priced.basePrice) && priced.basePrice >= 25_000);
  assert.equal(priced.basePrice, Math.max(25_000, priced.breakdown.finalPriceVnd));
  assert.equal(priced.pricingConfigId, '00000000-0000-4000-8000-000000000001');
  assert.deepEqual(estimateImportPrice(cube.metrics, null), { priced: false, reason: 'NO_PRICING_CONFIG' });
  assert.deepEqual(estimateImportPrice(cube.metrics, { config, medians: new Map(), pricingConfigId: 'x' }), { priced: false, reason: 'NO_MATERIAL_COST' });
  const tooBig = analyzeModel([{ relPath: 'big', bytes: binaryStl(boxTriangles([0, 0, 0], [300, 300, 300])) }]);
  assert.ok(tooBig.ok);
  assert.deepEqual(estimateImportPrice(tooBig.metrics, { config, medians, pricingConfigId: 'x' }), { priced: false, reason: 'EXCEEDS_BUILD_VOLUME' });
});
