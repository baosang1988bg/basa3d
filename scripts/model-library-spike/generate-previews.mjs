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
const channel = opt('channel', process.platform === 'win32' ? 'chrome' : undefined);
const bedSize = Number(opt('bed-size', '256')); // Bambu Lab P1S/P2S/X1C/A1: 256x256x256mm
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

function get3mfSliceSummary(bytes) {
  try {
    const entries = unzipSync(bytes, { filter: (f) => f.name === 'Metadata/slice_info.config' || f.name === 'Metadata/slice_info.xml' });
    const configPath = entries['Metadata/slice_info.config'] ? 'Metadata/slice_info.config' : entries['Metadata/slice_info.xml'] ? 'Metadata/slice_info.xml' : null;
    if (!configPath) return null;
    const text = strFromU8(entries[configPath]);
    const timeMatch = text.match(/prediction="([^"]+)"/);
    const timeSec = timeMatch ? parseInt(timeMatch[1], 10) : null;
    let totalGrams = 0;
    const filamentMatches = text.matchAll(/weight="([^"]+)"/g);
    for (const m of filamentMatches) {
      totalGrams += parseFloat(m[1]) || 0;
    }
    return {
      timeMinutes: timeSec ? Math.round(timeSec / 60) : null,
      filamentGrams: totalGrams > 0 ? Math.round(totalGrams * 10) / 10 : null,
    };
  } catch {
    return null;
  }
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

const launchOptions = { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] };
if (channel) launchOptions.channel = channel;
const browser = await chromium.launch(launchOptions);
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
        const sliceInfo = get3mfSliceSummary(new Uint8Array(bytes));
        Object.assign(item, {
          thumbnailSource: 'embedded',
          embeddedPath: embedded.name,
          designerCover: embedded.designerCover,
          sliceInfo,
          printable: true, // File 3MF từ slicer đã được xác nhận khả thi in
        });
        stats.embedded++;
      } else {
        blobs.set(`/blob/${id}`, bytes);
        result = await withTimeout(page.evaluate(([u, k, s, q]) => window.renderModel(u, k, s, q), [`/blob/${id}`, kind, size, quality]), timeoutMs);
        const isPrintable = result.bboxMm.x <= bedSize && result.bboxMm.y <= bedSize && result.bboxMm.z <= bedSize;
        const estimatedGrams = result.volumeCm3 ? +(result.volumeCm3 * 1.24 * 0.35).toFixed(1) : null;
        Object.assign(item, {
          thumbnailSource: 'rendered',
          triangles: result.triangles,
          volumeCm3: result.volumeCm3,
          estimatedGrams,
          bboxMm: result.bboxMm,
          printable: isPrintable,
        });
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
    const printableTag = item.printable ? '[IN ĐƯỢC]' : '[VƯỢT KHỔ]';
    const tag = item.error ? `ERROR ${item.error}` : `${printableTag} ${item.thumbnailSource}${item.triangles ? ` ${item.triangles.toLocaleString()} tris` : ''}`;
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
const cards = items.map((it) => {
  const isOk = it.printable;
  const statusBadge = it.error
    ? '<span class="tag err">Lỗi đọc file</span>'
    : isOk
    ? `<span class="tag ok">✓ IN ĐƯỢC (≤ ${bedSize}mm)</span>`
    : `<span class="tag warn">⚠ VƯỢT KHỔ (> ${bedSize}mm)</span>`;

  let specInfo = '';
  if (it.sliceInfo && it.sliceInfo.timeMinutes) {
    const hours = Math.floor(it.sliceInfo.timeMinutes / 60);
    const mins = it.sliceInfo.timeMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}p` : `${mins} phút`;
    specInfo += `<span class="tag info">⏱ ${timeStr}</span> `;
  }
  if (it.sliceInfo && it.sliceInfo.filamentGrams) {
    specInfo += `<span class="tag info">⚖ ${it.sliceInfo.filamentGrams}g nhựa</span> `;
  } else if (it.estimatedGrams) {
    specInfo += `<span class="tag info">⚖ ~${it.estimatedGrams}g nhựa</span> `;
  }

  const dimInfo = it.bboxMm ? `${it.bboxMm.x} × ${it.bboxMm.y} × ${it.bboxMm.z} mm` : '';

  return `
  <figure data-q="${esc(it.relPath.toLowerCase())}" data-printable="${isOk ? 'true' : 'false'}" class="${it.error ? 'err' : isOk ? 'is-ok' : 'is-warn'}">
    ${it.error ? `<div class="ph">${esc(it.error)}</div>` : `<a href="${esc(it.previewFile)}" target="_blank" title="Xem ảnh gốc"><img loading="lazy" src="${esc(it.previewFile)}" alt="${esc(it.name)}"></a>`}
    <figcaption>
      <div class="title" title="${esc(it.name)}">${esc(it.name)}</div>
      <div class="badges">
        ${statusBadge}
        <span class="tag">${it.kind.toUpperCase()}</span>
      </div>
      ${specInfo ? `<div class="specs">${specInfo}</div>` : ''}
      <div class="meta">
        ${dimInfo ? `<b>Kích thước:</b> ${dimInfo}<br>` : ''}
        <b>Dung lượng:</b> ${(it.bytes / 1048576).toFixed(1)} MB ${it.triangles ? `· ${it.triangles.toLocaleString()} tam giác` : ''}
      </div>
    </figcaption>
  </figure>`;
}).join('');

await writeFile(path.join(outRoot, 'gallery.html'), `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>BaSa3D — Thư Viện Mẫu & Thẩm Định In 3D (Khổ P2S/256mm)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; background: #f1f5f9; color: #1e293b; }
    header { max-width: 1200px; margin: 0 auto 24px; }
    h1 { margin: 0 0 8px; font-size: 24px; color: #0f172a; display: flex; align-items: center; gap: 10px; }
    p.sub { margin: 0 0 16px; color: #64748b; font-size: 14px; }
    .toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 20px; }
    input.search { flex: 1; min-width: 260px; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; background: #fff; }
    .btn-filter { padding: 9px 16px; border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 500; transition: all 0.2s; }
    .btn-filter.active { background: #2563eb; color: #fff; border-color: #2563eb; }
    .g { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; max-width: 1200px; margin: 0 auto; }
    figure { margin: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; }
    figure:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.08); }
    figure a { display: block; overflow: hidden; background: #f8fafc; }
    img, .ph { width: 100%; aspect-ratio: 1; object-fit: contain; display: block; background: #f8fafc; transition: transform 0.3s; }
    figure:hover img { transform: scale(1.03); }
    .ph { display: flex; align-items: center; justify-content: center; color: #ef4444; padding: 16px; box-sizing: border-box; text-align: center; font-size: 13px; font-weight: 500; }
    figcaption { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
    .title { font-weight: 600; font-size: 15px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badges, .specs { display: flex; gap: 6px; flex-wrap: wrap; }
    .tag { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; background: #e2e8f0; color: #334155; }
    .tag.ok { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; font-weight: 600; }
    .tag.warn { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 600; }
    .tag.err { background: #fee2e2; color: #b91c1c; }
    .tag.info { background: #e0f2fe; color: #0369a1; }
    .meta { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: auto; padding-top: 8px; border-top: 1px dashed #e2e8f0; }
  </style>
</head>
<body>
  <header>
    <h1>🏷️ BaSa3D — Thư Viện Mẫu & Bộ Lọc Khả Thi In 3D</h1>
    <p class="sub">Tiêu chuẩn máy in: Bambu Lab P2S / Khổ in tiêu chuẩn <b>${bedSize} × ${bedSize} × ${bedSize} mm</b> · Đã kiểm tra ${items.length} file</p>
    <div class="toolbar">
      <input class="search" placeholder="🔍 Tìm kiếm theo tên mẫu hoặc đuôi file…" oninput="filterCards()">
      <button class="btn-filter active" onclick="setFilter('all', this)">Tất cả (${items.length})</button>
      <button class="btn-filter" onclick="setFilter('ok', this)">✓ In được ngay (≤ ${bedSize}mm)</button>
      <button class="btn-filter" onclick="setFilter('warn', this)">⚠ Cảnh báo vượt khổ</button>
    </div>
  </header>
  <div class="g">${cards}</div>
  <script>
    let currentFilter = 'all';
    function setFilter(filter, el) {
      currentFilter = filter;
      document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      filterCards();
    }
    function filterCards() {
      const q = document.querySelector('input.search').value.toLowerCase();
      document.querySelectorAll('figure').forEach(f => {
        const matchText = f.dataset.q.includes(q);
        const isOk = f.dataset.printable === 'true';
        let matchFilter = true;
        if (currentFilter === 'ok') matchFilter = isOk;
        if (currentFilter === 'warn') matchFilter = !isOk;
        f.hidden = !(matchText && matchFilter);
      });
    }
  </script>
</body>
</html>`);

const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\nDone in ${secs}s — seen ${stats.seen}, skipped(unchanged) ${stats.skipped}, embedded ${stats.embedded}, rendered ${stats.rendered}, errors ${stats.errors}, too large ${stats.tooLarge}`);
console.log(`Open: ${path.join(outRoot, 'gallery.html')}`);
