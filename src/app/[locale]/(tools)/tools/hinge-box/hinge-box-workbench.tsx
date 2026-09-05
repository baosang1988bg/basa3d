'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { StorefrontButton } from '@/components/storefront/button';
import {
  disposeHingeBoxScene,
  generateHingeBoxScene,
  getHingeBoxExportParts,
  mergeHingeBoxGeometry,
} from '@/lib/3d-tools/hinge-box/hinge-box-engine';
import * as C from '@/lib/3d-tools/hinge-box/hinge-box-constants';
import { write3mf } from '@/lib/3d-tools/common/3mf-writer';
import { exportKeychainStl } from '@/lib/keychain/keychain-engine';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { trackHingeBoxExportDownload, trackHingeBoxExportToRequest, trackHingeBoxPreview } from '@/lib/analytics';

const Canvas = dynamic(() => import('./hinge-box-canvas'), { ssr: false, loading: () => <p>Đang mở bản xem trước 3D...</p> });

export default function HingeBoxWorkbench() {
  const [widthMm, setWidthMm] = useState(C.DEFAULT_WIDTH_MM);
  const [depthMm, setDepthMm] = useState(C.DEFAULT_DEPTH_MM);
  const [closedHeightMm, setClosedHeightMm] = useState(C.DEFAULT_CLOSED_HEIGHT_MM);
  const [rows, setRows] = useState(1);
  const [cols, setCols] = useState(1);
  const [dividerThicknessMm, setDividerThicknessMm] = useState(C.DEFAULT_DIVIDER_THICKNESS_MM);
  const [color, setColor] = useState(C.DEFAULT_COLOR);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);

  const result = useMemo(() => {
    try {
      return { group: generateHingeBoxScene({ widthMm, depthMm, closedHeightMm, rows, cols, dividerThicknessMm }, color), error: '' };
    } catch (reason) {
      return { group: null, error: reason instanceof Error ? reason.message : 'Không thể dựng mẫu.' };
    }
  }, [widthMm, depthMm, closedHeightMm, rows, cols, dividerThicknessMm, color]);
  const group = result.group;
  useEffect(() => () => { if (group) disposeHingeBoxScene(group); }, [group]);

  useEffect(() => {
    setPrice(null); if (!group) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      trackHingeBoxPreview({ rows, cols });
      const parts = getHingeBoxExportParts(group);
      const volume = parts.reduce((sum, p) => sum + calculateMeshVolumeCm3(p.geometry), 0); parts.forEach(p => p.geometry.dispose());
      const weightGrams = estimateMeshWeightGrams(volume);
      try {
        const response = await fetch('/api/public/tool-price-estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ weightGrams, printMinutes: estimatePrintMinutes(weightGrams) }) });
        const value = response.ok ? await response.json() : null; if (!controller.signal.aborted) setPrice(value);
      } catch { /* Advisory pricing does not prevent export. */ }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [group, rows, cols]);

  function download(format: 'stl' | '3mf') {
    if (!group) return;
    const parts = getHingeBoxExportParts(group);
    try {
      let blob: Blob;
      if (format === '3mf') {
        blob = new Blob([new Uint8Array(write3mf(parts))], { type: 'model/3mf' });
      } else {
        const geometry = mergeHingeBoxGeometry(parts);
        try { blob = exportKeychainStl(geometry); } finally { geometry.dispose(); }
      }
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `hop-ban-le.${format}`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      trackHingeBoxExportDownload({ rows, cols, format }); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể xuất file.'); }
    finally { parts.forEach(p => p.geometry.dispose()); }
  }

  async function sendRequest() {
    if (!group) return; setUploading(true); setError('');
    const parts = getHingeBoxExportParts(group);
    try {
      const geometry = mergeHingeBoxGeometry(parts);
      let blob: Blob; try { blob = exportKeychainStl(geometry); } finally { geometry.dispose(); }
      const fileName = 'hop-ban-le.stl'; const body = new FormData(); body.set('file', blob, fileName);
      const response = await fetch('/api/public/custom-requests/attachments', { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? 'Không thể tải STL lên.');
      const { path } = await response.json() as { path: string };
      setPrefill({
        attachmentPath: path,
        attachmentFileName: fileName,
        requestedMaterial: 'PLA',
        requestedColor: color,
        description: `Hộp có bản lề liền khối: ${widthMm}×${depthMm}×${closedHeightMm}mm (khi đóng), vách ngăn ${rows}×${cols}, độ dày vách ${dividerThicknessMm}mm. Bản lề/chốt chưa qua kiểm chứng in thật — xưởng cần in thử trước khi sản xuất hàng loạt.`,
      });
      trackHingeBoxExportToRequest({ rows, cols });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể chuẩn bị yêu cầu.'); }
    finally { parts.forEach(p => p.geometry.dispose()); setUploading(false); }
  }

  useEffect(() => { if (prefill) document.getElementById('hinge-box-request-form')?.scrollIntoView({ behavior: 'smooth' }); }, [prefill]);

  return <>
    <div className="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="h-[50dvh] min-h-[360px] bg-slate-100 lg:h-full lg:min-h-0">{group ? <Canvas group={group} /> : <p className="p-6">{result.error || 'Điều chỉnh nội dung để xem mẫu.'}</p>}</div>
      <aside className="space-y-4 border-l p-5 lg:overflow-y-auto">
        <h1 className="text-2xl font-bold">Hinge Box Studio</h1>
        <p className="text-sm">Hộp có bản lề liền khối, in phẳng 1 lần. Bản lề/chốt chưa qua kiểm chứng in thật — xem cảnh báo bên dưới.</p>
        <fieldset disabled={uploading} className="space-y-3">
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="hinge-width">Rộng (mm)</label><span className="text-muted-foreground">{widthMm}</span></div><input id="hinge-width" type="range" min={C.MIN_WIDTH_MM} max={C.MAX_WIDTH_MM} value={widthMm} onChange={e => setWidthMm(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="hinge-depth">Sâu (mm)</label><span className="text-muted-foreground">{depthMm}</span></div><input id="hinge-depth" type="range" min={C.MIN_DEPTH_MM} max={C.MAX_DEPTH_MM} step={0.5} value={depthMm} onChange={e => setDepthMm(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="hinge-height">Cao khi đóng (mm)</label><span className="text-muted-foreground">{closedHeightMm}</span></div><input id="hinge-height" type="range" min={C.MIN_CLOSED_HEIGHT_MM} max={C.MAX_CLOSED_HEIGHT_MM} value={closedHeightMm} onChange={e => setClosedHeightMm(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="hinge-rows">Hàng</label><span className="text-muted-foreground">{rows}</span></div><input id="hinge-rows" type="range" min={1} max={C.MAX_GRID_ROWS} value={rows} onChange={e => setRows(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="hinge-cols">Cột</label><span className="text-muted-foreground">{cols}</span></div><input id="hinge-cols" type="range" min={1} max={C.MAX_GRID_COLS} value={cols} onChange={e => setCols(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="hinge-divider-thickness">Độ dày vách (mm)</label><span className="text-muted-foreground">{dividerThicknessMm}</span></div><input id="hinge-divider-thickness" type="range" min={C.MIN_DIVIDER_THICKNESS_MM} max={C.MAX_DIVIDER_THICKNESS_MM} step={0.1} value={dividerThicknessMm} onChange={e => setDividerThicknessMm(Number(e.target.value))} className="block w-full" /></div>
          <label className="flex items-center justify-between text-sm">Màu<input type="color" value={color} onChange={e => setColor(e.target.value)} /></label>
        </fieldset>
        <p role="alert" className="text-sm text-amber-600">Bản lề (living hinge) khuyến nghị in bằng PETG hoặc Tough PLA (layer height 0.2mm) để đảm bảo độ dẻo khi gập. Hãy in thử 1 mẫu trước khi sản xuất hàng loạt. Chốt chỉ là gờ ma sát nhẹ, không phải khớp cài bật/tách.</p>
        {error || result.error ? <p role="alert" className="text-sm text-destructive">{error || result.error}</p> : null}
        {price ? <p>Ước tính: {price.minPriceVnd.toLocaleString('vi-VN')}đ – {price.maxPriceVnd.toLocaleString('vi-VN')}đ / chiếc</p> : <p className="text-sm">Chưa có giá ước tính.</p>}
        <p className="text-xs text-muted-foreground">Giá tham khảo cho PLA. Xưởng sẽ gửi báo giá chính xác sau khi kiểm tra mẫu.</p>
        <div className="grid gap-2">
          <StorefrontButton disabled={!group || uploading} onClick={() => download('stl')}>Tải STL</StorefrontButton>
          <StorefrontButton disabled={!group || uploading} onClick={() => download('3mf')}>Tải 3MF</StorefrontButton>
          <StorefrontButton disabled={!group || uploading} onClick={() => void sendRequest()}>{uploading ? 'Đang chuẩn bị file...' : 'Gửi yêu cầu báo giá'}</StorefrontButton>
        </div>
      </aside>
    </div>
    {prefill ? <section id="hinge-box-request-form" className="mx-auto max-w-3xl p-6"><h2 className="mb-4 text-2xl font-bold">Hoàn tất yêu cầu báo giá</h2><CustomRequestForm key={prefill.attachmentPath} prefill={prefill} /></section> : null}
  </>;
}
