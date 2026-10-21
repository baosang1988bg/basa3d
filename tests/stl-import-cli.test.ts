// Feature 003 — scripts/stl-import/import-stl.ts end to end on self-made fixtures (FR-002..FR-008,
// FR-015). Every run gets an EXPLICIT environment: no inherited credentials, never --apply for real.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { chromium } from '@playwright/test';
import { configureTestEnvironment } from './helpers/test-environment';
import { buildStlFixtures } from './fixtures/stl-import/build-fixtures';
import type { Manifest } from '../scripts/stl-import/report';

configureTestEnvironment();
const testDatabaseUrl = process.env.DATABASE_URL ?? '';
let root = '';
let fixtures = '';
before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'basa3d-stl-cli-'));
  fixtures = path.join(root, 'library');
  await buildStlFixtures(fixtures);
});
after(async () => { if (root) await rm(root, { recursive: true, force: true }); });

function runCli(args: string[], env: Record<string, string> = {}): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/stl-import/import-stl.ts', ...args], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', USER: process.env.USER ?? '', BASA3D_TEST_ENVIRONMENT: 'isolated', DATABASE_URL: '', ...env } as unknown as NodeJS.ProcessEnv,
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('exit', (code) => resolve({ code: code ?? 1, output }));
  });
}

async function manifestOf(out: string): Promise<Manifest> {
  return JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8'));
}

test('dry-run without a database: report + manifest, broken model does not stop the batch', async () => {
  const out = path.join(root, 'out-dry');
  const { code, output } = await runCli(['--in', fixtures, '--out', out, '--no-render']);
  assert.equal(code, 0, output);
  const manifest = await manifestOf(out);
  assert.equal(manifest.mode, 'dry-run');
  assert.equal(manifest.groupBy, 'folder');
  const byPath = new Map(manifest.items.map((item) => [item.sourceRelPath, item]));
  assert.equal(manifest.totals.items, 6);
  assert.equal(byPath.get('Broken')?.action, 'ERROR');
  assert.match(byPath.get('Broken')?.error ?? '', /MESH_EMPTY/);
  const cat = byPath.get('Figures/Cat');
  assert.equal(cat?.action, 'CREATE');
  assert.equal(cat?.categorySlug, 'figure-model', 'mapped through category-map.json');
  assert.deepEqual(cat?.bboxMm, { x: 45, y: 20, z: 25 });
  assert.equal(cat?.sku, 'FIG-CAT');
  assert.equal(byPath.get('Figures/Ếch_xanh_v2.stl')?.name, 'Ếch xanh');
  assert.equal(byPath.get('Tools')?.name, 'Tools', 'FOLDER mode names the model after its leaf folder');
  assert.ok(byPath.get('Tiny')?.warnings.includes('UNIT_TOO_SMALL'));
  assert.equal(byPath.get('Tiny')?.categorySlug, 'chua-phan-loai');
  assert.ok(manifest.items.every((item) => item.action === 'ERROR' || item.warnings.includes('UNPRICED')), 'no DB → no pricing config → unpriced, never guessed');
  const html = await readFile(path.join(out, 'report.html'), 'utf8');
  assert.match(html, /chạy thử/);
  assert.match(html, /Lỗi: <b>1<\/b> \(16\.7%\)/);
});

test('FILE mode and --limit / --only', async () => {
  const out = path.join(root, 'out-file');
  assert.equal((await runCli(['--in', fixtures, '--out', out, '--no-render', '--group-by', 'file'])).code, 0);
  const fileManifest = await manifestOf(out);
  assert.equal(fileManifest.totals.items, 8);
  assert.equal(fileManifest.items.find((item) => item.sourceRelPath === 'Tools/12345.stl')?.name, 'Mẫu 12345');
  const limited = path.join(root, 'out-limit');
  assert.equal((await runCli(['--in', fixtures, '--out', limited, '--no-render', '--only', 'Figures/**', '--limit', '1'])).code, 0);
  assert.equal((await manifestOf(limited)).totals.items, 1);
});

test('file names are escaped in report.html', async () => {
  const library = path.join(root, 'xss');
  await buildStlFixtures(library);
  const { mkdir, copyFile } = await import('node:fs/promises');
  await mkdir(path.join(library, '<img src=x onerror=alert(1)>'), { recursive: true });
  await copyFile(path.join(library, 'root-cube.stl'), path.join(library, '<img src=x onerror=alert(1)>', 'a.stl'));
  const out = path.join(root, 'out-xss');
  assert.equal((await runCli(['--in', library, '--out', out, '--no-render'])).code, 0);
  const html = await readFile(path.join(out, 'report.html'), 'utf8');
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('bad flags exit 2; --apply without DATABASE_URL exits 1; --apply with --no-render exits 2', async () => {
  assert.equal((await runCli(['--in', fixtures, '--bogus'])).code, 2);
  assert.equal((await runCli([])).code, 2);
  assert.equal((await runCli(['--in', fixtures, '--views', '3'])).code, 2);
  assert.equal((await runCli(['--in', fixtures, '--apply', '--no-render'])).code, 2);
  const apply = await runCli(['--in', fixtures, '--out', path.join(root, 'out-apply'), '--apply']);
  assert.equal(apply.code, 1);
  assert.match(apply.output, /DATABASE_URL/);
});

test('in the isolated test environment a non-local DATABASE_URL is refused before any connection', async () => {
  const { code, output } = await runCli(['--in', fixtures, '--out', path.join(root, 'out-hosted'), '--no-render'], { DATABASE_URL: 'postgresql://user:pw@db.example.invalid:5432/postgres' });
  assert.equal(code, 1);
  assert.match(output, /database local/);
});

test('dry-run against the local test DB reads only: no row is written', { skip: !testDatabaseUrl }, async () => {
  const { getPool } = await import('../src/lib/db.js');
  const count = async () => (await getPool().query<{ items: number; products: number }>(
    'select (select count(*)::int from product_import_items) as items, (select count(*)::int from products) as products')).rows[0];
  const before = await count();
  const out = path.join(root, 'out-dry-db');
  const { code, output } = await runCli(['--in', fixtures, '--out', out, '--no-render'], { DATABASE_URL: testDatabaseUrl });
  assert.equal(code, 0, output);
  assert.deepEqual(await count(), before);
  assert.equal((await manifestOf(out)).totals.created, 5);
  await getPool().end();
});

test('rendering: 4 WebP views of 1200 px per model (skipped when Playwright Chromium is not installed)', { skip: !existsSync(chromium.executablePath()) }, async () => {
  const out = path.join(root, 'out-render');
  const { code, output } = await runCli(['--in', fixtures, '--out', out, '--only', 'Figures/Cat/**']);
  assert.equal(code, 0, output);
  const images = (await readdir(path.join(out, 'images'))).sort();
  assert.equal(images.length, 4);
  const cover = await readFile(path.join(out, 'images', images[0]));
  assert.equal(cover.subarray(0, 4).toString(), 'RIFF');
  assert.equal(cover.subarray(8, 12).toString(), 'WEBP');
  assert.equal(cover.subarray(12, 16).toString(), 'VP8X');
  assert.equal(cover.readUIntLE(24, 3) + 1, 1200);
  assert.equal(cover.readUIntLE(27, 3) + 1, 1200);
});
