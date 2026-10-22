// Feature 003 — .3mf support in the STL importer (KeyCap3D: some models ship only as .3mf). Self-made
// fixtures only: a .3mf is turned into STL geometry, never into the author's embedded thumbnails.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { chromium } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { analyzeModel, toStlParts } from '../src/lib/stl-import/metrics';
import { groupModels, walkDir } from '../src/lib/stl-import/scan';
import { threeMfToBinaryStl } from '../src/lib/stl-import/threemf-mesh';
import { MeshMetricsError } from '../src/lib/pricing/mesh-metrics';
import type { Manifest } from '../scripts/stl-import/report';
import { binaryStl, boxTriangles, buildThreeMfFixtures, THREE_MF_LAYOUT, threeMf, threeMfBoxObject, threeMfKeycap } from './fixtures/stl-import/build-fixtures';

let root = '';
let library = '';
before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'basa3d-3mf-'));
  library = path.join(root, 'library');
  await buildThreeMfFixtures(library);
});
after(async () => { if (root) await rm(root, { recursive: true, force: true }); });

function measure(bytes: Uint8Array) {
  const analysis = analyzeModel([{ relPath: 'x.stl', bytes: threeMfToBinaryStl(bytes) }]);
  assert.ok(analysis.ok, analysis.ok ? '' : analysis.error);
  return analysis;
}

function rejectsWith(bytes: Uint8Array, code: MeshMetricsError['code']) {
  assert.throws(() => threeMfToBinaryStl(bytes), (error: unknown) => error instanceof MeshMetricsError && error.code === code);
}

test('3MF → STL: a plain box measures like the same STL', () => {
  const analysis = measure(threeMfKeycap());
  assert.deepEqual(analysis.bboxMm, { x: 20, y: 20, z: 10 });
  assert.equal(analysis.volumeCm3, 4);
  assert.equal(analysis.triangles, 12);
  assert.ok(!analysis.warnings.includes('MESH_NOT_WATERTIGHT'));
});

test('3MF → STL: model unit is converted to mm', () => {
  const analysis = measure(threeMf(`<resources>${threeMfBoxObject(1, [0, 0, 0], [2, 2, 1])}</resources><build><item objectid="1"/></build>`, { unit: 'centimeter' }));
  assert.deepEqual(analysis.bboxMm, { x: 20, y: 20, z: 10 });
});

test('3MF → STL: Bambu components in 3D/Objects/*.model, item transforms, and a mirrored copy keep a positive volume', () => {
  const objectModel = `<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${threeMfBoxObject(7, [0, 0, 0], [20, 20, 10])}</resources><build/></model>`;
  const bytes = threeMf(
    '<resources><object id="2" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="7"/></components></object></resources>'
    + '<build><item objectid="2"/><item objectid="2" transform="-1 0 0 0 1 0 0 0 1 50 0 0"/></build>',
    { extra: { '3D/Objects/object_1.model': objectModel } },
  );
  const analysis = measure(bytes);
  assert.deepEqual(analysis.bboxMm, { x: 50, y: 20, z: 10 });
  assert.equal(analysis.volumeCm3, 8, 'two boxes; the mirrored one must not cancel the other');
});

test('3MF → STL: unreadable files fail with a mesh error code', () => {
  rejectsWith(new Uint8Array(Buffer.from('PK not really a zip')), 'MESH_INVALID');
  rejectsWith(zipSync({ 'Metadata/plate_1.png': new Uint8Array([1, 2, 3]) }), 'MESH_EMPTY');
  rejectsWith(threeMf('<resources><object id="1"><mesh><vertices><vertex x="0" y="0" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources><build><item objectid="1"/></build>'), 'MESH_INVALID');
  rejectsWith(threeMf('<resources/><build/>'), 'MESH_EMPTY');
  rejectsWith(zipSync({ '3D/3dmodel.model': strToU8('<model><resources><object id="1"><mesh>') }), 'MESH_INVALID');
});

test('toStlParts: .stl passes through, .3mf is converted, a broken .3mf names its file', () => {
  const stl = { relPath: 'a/base.stl', bytes: new Uint8Array(binaryStl(boxTriangles([0, 0, 0], [5, 5, 5]))) };
  const converted = toStlParts([stl, { relPath: 'a/cap.3mf', bytes: new Uint8Array(threeMfKeycap()) }]);
  assert.ok(converted.ok);
  assert.equal(converted.parts[0], stl);
  assert.equal(analyzeModel(converted.parts).ok, true);
  const broken = toStlParts([stl, { relPath: 'a/broken.3mf', bytes: new Uint8Array([1, 2, 3]) }]);
  assert.deepEqual(broken.ok, false);
  assert.match(broken.ok ? '' : broken.error, /^a\/broken\.3mf — MESH_INVALID: /);
});

test('scan: .stl and .3mf in one leaf folder are one model; other files are skipped and counted', async () => {
  const ignored: string[] = [];
  const files = await walkDir(library, ignored);
  assert.deepEqual(files.map((file) => file.relPath).sort(), [
    'KeyCap3D/Broken 3mf/broken.3mf', 'KeyCap3D/Gengar/gengar-keycap.3mf', 'KeyCap3D/Mixed set/base.stl', 'KeyCap3D/Mixed set/cap.3mf',
  ]);
  assert.deepEqual(ignored.sort(), ['KeyCap3D/Gengar/cover.jpg', 'KeyCap3D/Gengar/notes.txt', 'KeyCap3D/Mixed set/preview.png']);
  const mixed = groupModels(files, 'FOLDER', { maxBytes: 1024 ** 3 }).find((group) => group.sourceRelPath === THREE_MF_LAYOUT.mixed);
  assert.equal(mixed?.files.length, 2);
});

function runCli(args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/stl-import/import-stl.ts', ...args], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', USER: process.env.USER ?? '', BASA3D_TEST_ENVIRONMENT: 'isolated', DATABASE_URL: '' } as unknown as NodeJS.ProcessEnv,
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('exit', (code) => resolve({ code: code ?? 1, output }));
  });
}

test('CLI dry-run: mixed and 3MF-only folders import, a broken 3MF is an ERROR without stopping the batch', async () => {
  const out = path.join(root, 'out');
  const { code, output } = await runCli(['--in', library, '--out', out, '--no-render']);
  assert.equal(code, 0, output);
  const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8')) as Manifest;
  const byPath = new Map(manifest.items.map((item) => [item.sourceRelPath, item]));
  assert.equal(manifest.totals.items, 3);
  assert.deepEqual(byPath.get(THREE_MF_LAYOUT.mixed)?.bboxMm, { x: 18, y: 18, z: 14 }, 'STL base + 3MF cap stacked on it');
  const gengar = byPath.get(THREE_MF_LAYOUT.only3mf);
  assert.equal(gengar?.action, 'CREATE');
  assert.deepEqual(gengar?.bboxMm, { x: 20, y: 20, z: 10 });
  assert.equal(gengar?.categorySlug, 'keycap');
  assert.equal(gengar?.sku, 'KCP-GENGAR');
  assert.equal(gengar?.sourceDir, 'KeyCap3D');
  const broken = byPath.get(THREE_MF_LAYOUT.broken);
  assert.equal(broken?.action, 'ERROR');
  assert.match(broken?.error ?? '', /broken\.3mf — MESH_INVALID/);
  assert.equal(manifest.ignoredFiles, 3);
  const html = await readFile(path.join(out, 'report.html'), 'utf8');
  assert.match(html, /File bỏ qua \(không phải \.stl\/\.3mf\): <b>3<\/b>/);
  assert.match(html, /Thư mục nguồn: <b>KeyCap3D<\/b>/);
  assert.match(html, /data-f="unit">Nghi sai đơn vị \(0\)/);
  assert.match(html, /data-f="overlap">Nghi gộp sai \(\d+\)/);
  assert.match(html, /data-f="error">Lỗi \(1\)/);
  assert.match(html, /<option value="KeyCap3D">KeyCap3D<\/option>/);
});

test('CLI render: a 3MF-only model gets the same 4 rendered views (skipped when Playwright Chromium is not installed)', { skip: !existsSync(chromium.executablePath()) }, async () => {
  const out = path.join(root, 'out-render');
  const { code, output } = await runCli(['--in', library, '--out', out, '--only', 'KeyCap3D/Gengar/**']);
  assert.equal(code, 0, output);
  const images = await readdir(path.join(out, 'images'));
  assert.equal(images.length, 4);
  for (const image of images) assert.equal((await readFile(path.join(out, 'images', image))).subarray(8, 12).toString(), 'WEBP');
});
