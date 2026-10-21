// Feature 003 (FR-008): manifest.json + a self-contained report.html for each run
// (contracts/cli-import-stl.md §Đầu ra). File and folder names come from the Drive library, so every
// string is HTML-escaped; the page loads nothing from the network.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ManifestItem = {
  sourceKey: string;
  sourceRelPath: string;
  action: 'CREATE' | 'RERENDER' | 'SOURCE_CHANGED' | 'SKIP' | 'ERROR';
  name: string;
  slug: string | null;
  sku: string | null;
  categorySlug: string;
  bboxMm: { x: number; y: number; z: number } | null;
  volumeCm3: number | null;
  triangles: number | null;
  basePrice: number | null;
  warnings: string[];
  error: string | null;
  images: string[];
  ms: number;
};

export type Manifest = {
  runAt: string;
  mode: 'dry-run' | 'apply';
  groupBy: 'folder' | 'file';
  totals: { items: number; created: number; rerendered: number; sourceChanged: number; skipped: number; errors: number; warnings: number };
  avgMsPerItem: number;
  bucketUsageBytesBefore: number | null;
  bucketUsageBytesAfterEstimate: number | null;
  storageWarning: string | null;
  items: ManifestItem[];
};

export function totalsOf(items: ManifestItem[]): Manifest['totals'] {
  return {
    items: items.length,
    created: items.filter((item) => item.action === 'CREATE').length,
    rerendered: items.filter((item) => item.action === 'RERENDER').length,
    sourceChanged: items.filter((item) => item.action === 'SOURCE_CHANGED').length,
    skipped: items.filter((item) => item.action === 'SKIP').length,
    errors: items.filter((item) => item.action === 'ERROR').length,
    warnings: items.filter((item) => item.warnings.length > 0).length,
  };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
}

const mb = (bytes: number | null) => (bytes === null ? '—' : `${(bytes / 1024 ** 2).toFixed(0)} MB`);
const vnd = (value: number | null) => (value === null ? 'chưa có giá' : `${value.toLocaleString('vi-VN')} đ`);

function card(item: ManifestItem): string {
  const cover = item.images[0] ? `<img src="${escapeHtml(item.images[0])}" alt="" loading="lazy">` : '<div class="noimg">không có ảnh</div>';
  const size = item.bboxMm ? `${item.bboxMm.x} × ${item.bboxMm.y} × ${item.bboxMm.z} mm` : '—';
  const flags = [...item.warnings.map((w) => `<span class="w">${escapeHtml(w)}</span>`), item.error ? `<span class="e">${escapeHtml(item.error)}</span>` : ''].join(' ');
  return `<article class="card" data-action="${escapeHtml(item.action)}" data-flag="${item.error ? 'error' : item.warnings.length ? 'warning' : 'ok'}">
  ${cover}
  <h3>${escapeHtml(item.name)}</h3>
  <p class="meta">${escapeHtml(item.action)} · ${escapeHtml(item.categorySlug)} · ${escapeHtml(size)} · ${escapeHtml(vnd(item.basePrice))}</p>
  <p class="path">${escapeHtml(item.sourceRelPath)}</p>
  <p>${flags}</p>
</article>`;
}

export function renderReportHtml(manifest: Manifest): string {
  const t = manifest.totals;
  const errorRate = t.items ? ((t.errors / t.items) * 100).toFixed(1) : '0.0';
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Báo cáo nhập STL — ${escapeHtml(manifest.runAt)}</title>
<style>
body{font:14px system-ui,sans-serif;margin:16px;background:#f7f8fa;color:#111}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}.stats div{background:#fff;border-radius:8px;padding:8px 12px}
.banner{background:#fff3cd;border:1px solid #f0c36d;padding:8px 12px;border-radius:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.card{background:#fff;border-radius:8px;padding:8px}.card img,.noimg{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;background:#eef1f4}
.noimg{display:flex;align-items:center;justify-content:center;color:#888}
.card h3{font-size:15px;margin:6px 0}.meta,.path{color:#555;margin:2px 0;word-break:break-all}.path{font-size:12px}
.w{background:#fde68a;border-radius:4px;padding:0 4px;font-size:12px}.e{background:#fecaca;border-radius:4px;padding:0 4px;font-size:12px}
nav button{margin-right:6px}
</style></head><body>
<h1>Báo cáo nhập STL (${escapeHtml(manifest.mode === 'apply' ? 'ĐÃ GHI' : 'chạy thử — chưa ghi gì')})</h1>
${manifest.storageWarning ? `<p class="banner">${escapeHtml(manifest.storageWarning)}</p>` : ''}
<div class="stats">
<div>Số mẫu: <b>${t.items}</b></div><div>Tạo mới: <b>${t.created}</b></div><div>Làm lại ảnh: <b>${t.rerendered}</b></div>
<div>Nguồn đổi (đã lên web): <b>${t.sourceChanged}</b></div><div>Bỏ qua: <b>${t.skipped}</b></div>
<div>Lỗi: <b>${t.errors}</b> (${errorRate}%)</div><div>Có cảnh báo: <b>${t.warnings}</b></div>
<div>TB mỗi mẫu: <b>${(manifest.avgMsPerItem / 1000).toFixed(1)} s</b></div>
<div>Dung lượng ảnh: <b>${mb(manifest.bucketUsageBytesBefore)}</b> → ~<b>${mb(manifest.bucketUsageBytesAfterEstimate)}</b></div>
</div>
<nav><button data-f="all">Tất cả</button><button data-f="error">Lỗi</button><button data-f="warning">Cảnh báo</button></nav>
<section class="grid">${manifest.items.map(card).join('\n')}</section>
<script>
document.querySelectorAll('nav button').forEach(function (b) { b.onclick = function () {
  var f = b.dataset.f; document.querySelectorAll('.card').forEach(function (c) { c.hidden = f !== 'all' && c.dataset.flag !== f; });
}; });
</script>
</body></html>
`;
}

export async function writeReport(outDir: string, manifest: Manifest): Promise<void> {
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(outDir, 'report.html'), renderReportHtml(manifest));
}
