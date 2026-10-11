// Phase 32 spike — offline preview generator for the model library (NOT production code).
//
// Walks a folder of .stl/.3mf files (e.g. the Google Drive for desktop mount), and for each file:
//   - .3mf: extracts the thumbnail the slicer already embedded (Bambu/Orca: Metadata/plate_1.png …)
//   - .stl (or .3mf without thumbnail): renders it headless with three.js inside Playwright Chromium
// Writes square WebP previews + manifest.json + gallery.html into --out. Touches no DB, no Supabase,
// no app code. Re-running skips files already processed (same size + mtime), so it can be stopped
// and resumed — important when the source is a 200 GB Drive folder.
//
// Usage (from repo root, Mac or Windows):
//   node scripts/model-library-spike/generate-previews.mjs --in "<folder>" --out ./.model-previews --limit 50
// Options: --size 800  --quality 0.85  --max-mb 300  --timeout 120  --retry-errors  --force-render
import { chromium } from 'playwright';
import { unzipSync, strFromU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { URL, fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import { setTimeout, clearTimeout } from 'node:timers';
/* global window -- referenced only inside page.evaluate callbacks, which run in Chromium */

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const inputRoot = opt('in');
if (!inputRoot) {
  console.error('Missing --in <folder>. See header comment for usage.');
  process.exit(1);
}
const outRoot = path.resolve(opt('out', './.model-previews'));
const limit = Number(opt('limit', 'Infinity'));
const size = Number(opt('size', '800'));
const quality = Number(opt('quality', '0.85'));
const maxBytes = Number(opt('max-mb', '300')) * 1024 * 1024;
const timeoutMs = Number(opt('timeout', '120')) * 1000;
const retryErrors = flag('retry-errors');
const forceRender = flag('force-render'); // ignore embedded 3MF thumbnails (useful to compare)
const RECYCLE_EVERY = 40; // reload the page periodically so WebGL/JS memory cannot creep up

const here = path.dirname(fileURLToPath(import.meta.url));
const threeRoot = path.resolve(path.dirname(createRequire(import.meta.url).resolve('three')), '..');
const ORIGIN = 'http://spike.local';

// ---------- 3MF thumbnail lookup ----------
// Order matters. plate_N.png is rendered by the user's own slicer from the actual plate, so it is
// the safest to publish. Auxiliaries/.thumbnails/* is usually the designer's MakerWorld cover photo:
// usable for a demo, but flagged because the image itself is someone else's work (Phase 29).
const THUMB_CANDIDATES = [
  { re: /^Metadata\/plate_1\.png$/i, designerCover: false },
  { re: /^Metadata\/plate_\d+\.png$/i, designerCover: false },
  { re: /^Metadata\/thumbnail\.png$/i, designerCover: false },
  { re: /^Auxiliaries\/\.thumbnails\/thumbnail_3mf\.png$/i, designerCover: true },
  { re: /^Auxiliaries\/\.thumbnails\/thumbnail_middle\.png$/i, designerCover: true },
];

function findEmbeddedThumbnail(bytes) {
  const wanted = (name) => /\.(png|jpe?g)$/i.test(name) || name === '_rels/.rels';
  const entries = unzipSync(bytes, { filter: (f) => wanted(f.name) });
  const names = Object.keys(entries);
  // OPC-declared package thumbnail (any 3MF producer may set this).
  let relsTarget = null;
  if (entries['_rels/.rels']) {
    const m = strFromU8(entries['_rels/.rels']).match(/Target="\/?([^"]+)"[^>]*Type="[^"]*\/metadata\/thumbnail"|Type="[^"]*\/metadata\/thumbnail"[^>]*Target="\/?([^"]+)"/i);
    relsTarget = m ? m[1] || m[2] : null;
  }
  for (const c of THUMB_CANDIDATES) {
    const name = names.find((n) => c.re.test(n));
    if (name) return { name, bytes: entries[name], designerCover: c.designerCover };
  }
  if (relsTarget && entries[relsTarget]) return { name: relsTarget, bytes: entries[relsTarget], designerCover: false };
  return null;
}

// ---------- file walk ----------
async function* walk(dir) {
  let list;
  try {
    list = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`! cannot read ${dir}: ${err.message}`);
    return;
  }
  for (const d of list) {
    if (d.name.startsWith('.')) continue;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(full);
    else if (/\.(stl|3mf)$/i.test(d.name)) yield full;
  }
}

// ---------- browser ----------
const blobs = new Map(); // url path -> Buffer served to the page
async function openPage(browser) {
  const page = await browser.newPage();
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({ path: path.join(here, 'render-page.html'), contentType: 'text/html' });
    if (url.pathname.startsWith('/three/')) {
      const file = path.join(threeRoot, ...url.pathname.slice('/three/'.length).split('/'));
      if (!file.startsWith(threeRoot)) return route.abort();
      return route.fulfill({ path: file, contentType: 'text/javascript' });
    }
    const blob = blobs.get(url.pathname);
    return blob ? route.fulfill({ body: blob, contentType: 'application/octet-stream' }) : route.abort();
  });
  page.on('pageerror', (e) => console.warn('  [page]', e.message));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.__ready === true);
  return page;
}

function withTimeout(promise, ms) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`TIMEOUT_${ms / 1000}s`)), ms); })]).finally(() => clearTimeout(t));
}

// ---------- main ----------
await mkdir(path.join(outRoot, 'previews'), { recursive: true });
const manifestPath = path.join(outRoot, 'manifest.json');
const manifest = existsSync(manifestPath)
  ? JSON.parse(await readFile(manifestPath, 'utf8'))
  : { version: 1, items: {} };
manifest.inputRoot = path.resolve(inputRoot);

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let page = await openPage(browser);
let renders = 0;
const stats = { seen: 0, skipped: 0, embedded: 0, rendered: 0, errors: 0, tooLarge: 0 };
const started = Date.now();

try {
  for await (const full of walk(path.resolve(inputRoot))) {
    if (stats.embedded + stats.rendered + stats.errors >= limit) break;
    stats.seen++;
    const relPath = path.relative(path.resolve(inputRoot), full).split(path.sep).join('/');
    const st = await stat(full);
    const prev = manifest.items[relPath];
    const unchanged = prev && prev.bytes === st.size && prev.mtimeMs === Math.round(st.mtimeMs);
    if (unchanged && (!prev.error || !retryErrors) && (prev.error || existsSync(path.join(outRoot, prev.previewFile)))) {
      stats.skipped++;
      continue;
    }

    const kind = full.toLowerCase().endsWith('.3mf') ? '3mf' : 'stl';
    const id = createHash('sha1').update(relPath).digest('hex').slice(0, 16);
    const previewFile = `previews/${id}.webp`;
    const item = { relPath, name: path.basename(full), kind, bytes: st.size, mtimeMs: Math.round(st.mtimeMs), previewFile, processedAt: new Date().toISOString() };
    const t0 = Date.now();

    try {
      if (st.size > maxBytes) {
        stats.tooLarge++;
        throw new Error(`TOO_LARGE_${(st.size / 1048576).toFixed(0)}MB`);
      }
      const bytes = await readFile(full); // Drive for desktop downloads the file on first read
      let result;
      const embedded = kind === '3mf' && !forceRender ? findEmbeddedThumbnail(new Uint8Array(bytes)) : null;
      if (embedded) {
        blobs.set(`/blob/${id}`, Buffer.from(embedded.bytes));
        result = await withTimeout(page.evaluate(([u, s, q]) => window.imageToWebp(u, s, q), [`/blob/${id}`, size, quality]), timeoutMs);
        Object.assign(item, { thumbnailSource: 'embedded', embeddedPath: embedded.name, designerCover: embedded.designerCover });
        stats.embedded++;
      } else {
        blobs.set(`/blob/${id}`, bytes);
        result = await withTimeout(page.evaluate(([u, k, s, q]) => window.renderModel(u, k, s, q), [`/blob/${id}`, kind, size, quality]), timeoutMs);
        Object.assign(item, { thumbnailSource: 'rendered', triangles: result.triangles, bboxMm: result.bboxMm });
        stats.rendered++;
        renders++;
      }
      blobs.delete(`/blob/${id}`);
      const webp = Buffer.from(result.dataUrl.split(',')[1], 'base64');
      await writeFile(path.join(outRoot, previewFile), webp);
      item.previewBytes = webp.length;
    } catch (err) {
      blobs.delete(`/blob/${id}`);
      item.error = String(err.message || err).replace(/^page\.evaluate:\s*/, '').split('\n')[0].slice(0, 300);
      if (!item.error.startsWith('TOO_LARGE')) stats.errors++;
      // A timeout or crash can leave the page unusable — start fresh.
      await page.close().catch(() => {});
      page = await openPage(browser);
    }
    item.ms = Date.now() - t0;
    manifest.items[relPath] = item;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const tag = item.error ? `ERROR ${item.error}` : `${item.thumbnailSource}${item.triangles ? ` ${item.triangles.toLocaleString()} tris` : ''}`;
    console.log(`${String(stats.embedded + stats.rendered + stats.errors).padStart(5)}  ${(item.ms / 1000).toFixed(1).padStart(5)}s  ${(st.size / 1048576).toFixed(1).padStart(7)}MB  ${tag}  ${relPath}`);

    if (renders && renders % RECYCLE_EVERY === 0) {
      await page.close();
      page = await openPage(browser);
    }
  }
} finally {
  await browser.close();
}

// ---------- gallery.html (local review only) ----------
const items = Object.values(manifest.items).sort((a, b) => a.relPath.localeCompare(b.relPath));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cards = items.map((it) => `
  <figure data-q="${esc(it.relPath.toLowerCase())}" class="${it.error ? 'err' : ''}">
    ${it.error ? `<div class="ph">${esc(it.error)}</div>` : `<img loading="lazy" src="${esc(it.previewFile)}" alt="">`}
    <figcaption><b>${esc(it.name)}</b><br><small>${esc(it.relPath)}</small><br>
      <span class="tag">${it.kind}</span> <span class="tag ${it.designerCover ? 'warn' : ''}">${it.thumbnailSource ?? '—'}${it.designerCover ? ' · ảnh của tác giả' : ''}</span>
      <small>${(it.bytes / 1048576).toFixed(1)} MB${it.triangles ? ` · ${it.triangles.toLocaleString()} tris` : ''}${it.bboxMm ? ` · ${it.bboxMm.x}×${it.bboxMm.y}×${it.bboxMm.z} mm` : ''}</small>
    </figcaption>
  </figure>`).join('');
await writeFile(path.join(outRoot, 'gallery.html'), `<!doctype html><meta charset="utf-8"><title>Model library spike</title>
<style>body{font:14px system-ui;margin:16px;background:#f6f7f9}input{width:100%;max-width:420px;padding:8px;margin-bottom:12px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}figure{margin:0;background:#fff;border:1px solid #ddd;border-radius:10px;overflow:hidden}
img,.ph{width:100%;aspect-ratio:1;object-fit:contain;display:block;background:#fff}.ph{display:flex;align-items:center;justify-content:center;color:#b00;padding:8px;box-sizing:border-box;text-align:center}
figcaption{padding:8px;word-break:break-all}.tag{display:inline-block;background:#eef;border-radius:4px;padding:0 4px;font-size:12px}.warn{background:#fde68a}</style>
<h1>Model library spike — ${items.length} file</h1>
<input placeholder="Lọc theo tên/thư mục…" oninput="for(const f of document.querySelectorAll('figure'))f.hidden=!f.dataset.q.includes(this.value.toLowerCase())">
<div class="g">${cards}</div>`);

const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\nDone in ${secs}s — seen ${stats.seen}, skipped(unchanged) ${stats.skipped}, embedded ${stats.embedded}, rendered ${stats.rendered}, errors ${stats.errors}, too large ${stats.tooLarge}`);
console.log(`Open: ${path.join(outRoot, 'gallery.html')}`);
