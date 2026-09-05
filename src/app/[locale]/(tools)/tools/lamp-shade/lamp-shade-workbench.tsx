'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { StorefrontButton } from '@/components/storefront/button';
import {
  computeShadeDimensions,
  disposeLampShadeScene,
  generateLampShadeScene,
  getLampShadeExportParts,
} from '@/lib/3d-tools/lamp-shade/lamp-shade-engine';
import * as C from '@/lib/3d-tools/lamp-shade/lamp-shade-constants';
import { write3mf } from '@/lib/3d-tools/common/3mf-writer';
import { exportKeychainStl } from '@/lib/keychain/keychain-engine';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { trackLampExportDownload, trackLampExportToRequest, trackLampPreview } from '@/lib/analytics';

const Canvas = dynamic(() => import('./lamp-shade-canvas'), { ssr: false, loading: () => <p>Đang mở bản xem trước 3D...</p> });

const PATTERN_LABELS: Record<C.PatternType, string> = {
  circle: 'Hình tròn',
  hexagon: 'Lục giác',
  'vertical-slit': 'Khe dọc',
  diamond: 'Kim cương',
  wave: 'Sóng',
};

export default function LampShadeWorkbench() {
  const [pattern, setPattern] = useState<C.PatternType>('circle');
  const [around, setAround] = useState(C.DEFAULT_AROUND);
  const [rows, setRows] = useState(C.DEFAULT_ROWS);
  const [cellSizeMm, setCellSizeMm] = useState(C.DEFAULT_CELL_SIZE_MM);
  const [rotationDeg, setRotationDeg] = useState(C.DEFAULT_ROTATION_DEG);
  const [color, setColor] = useState(C.DEFAULT_SHADE_COLOR);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);

  const dims = useMemo(() => computeShadeDimensions({ around, rows, cellSizeMm }), [around, rows, cellSizeMm]);
  const socketWarning = dims.radius * 2 < C.SOCKET_MIN_INNER_DIAMETER_MM;

  const result = useMemo(() => {
    try {
      return { group: generateLampShadeScene({ pattern, around, rows, cellSizeMm, rotationDeg }, color), error: '' };
    } catch (reason) {
      return { group: null, error: reason instanceof Error ? reason.message : 'Không thể dựng mẫu.' };
    }
  }, [pattern, around, rows, cellSizeMm, rotationDeg, color]);
  const group = result.group;
  useEffect(() => () => { if (group) disposeLampShadeScene(group); }, [group]);

  useEffect(() => {
    setPrice(null); if (!group) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      trackLampPreview({ pattern });
      const parts = getLampShadeExportParts(group);
      const volume = parts.reduce((sum, p) => sum + calculateMeshVolumeCm3(p.geometry), 0); parts.forEach(p => p.geometry.dispose());
      const weightGrams = estimateMeshWeightGrams(volume);
      try {
        const response = await fetch('/api/public/tool-price-estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ weightGrams, printMinutes: estimatePrintMinutes(weightGrams) }) });
        const value = response.ok ? await response.json() : null; if (!controller.signal.aborted) setPrice(value);
      } catch { /* Advisory pricing does not prevent export. */ }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [group, pattern]);

  function download(format: 'stl' | '3mf') {
    if (!group) return;
    const parts = getLampShadeExportParts(group);
    try {
      const blob = format === '3mf'
        ? new Blob([new Uint8Array(write3mf(parts))], { type: 'model/3mf' })
        : exportKeychainStl(parts[0].geometry);
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `chup-den.${format}`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      trackLampExportDownload({ pattern, format }); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể xuất file.'); }
    finally { parts.forEach(p => p.geometry.dispose()); }
  }

  async function sendRequest() {
    if (!group) return; setUploading(true); setError('');
    const parts = getLampShadeExportParts(group);
    try {
      const blob = exportKeychainStl(parts[0].geometry);
      const fileName = 'chup-den.stl'; const body = new FormData(); body.set('file', blob, fileName);
      const response = await fetch('/api/public/custom-requests/attachments', { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? 'Không thể tải STL lên.');
      const { path } = await response.json() as { path: string };
      setPrefill({
        attachmentPath: path,
        attachmentFileName: fileName,
        requestedMaterial: 'PLA',
        requestedColor: color,
        description: `Chụp đèn hoa văn "${PATTERN_LABELS[pattern]}": ${around} quanh vòng × ${rows} hàng, ô ${cellSizeMm}mm, xoay ${rotationDeg}°, đường kính trong ~${Math.round(dims.radius * 2)}mm, cao ${dims.height}mm. Lắp vừa đế socket ngoài (bộ kit) — xưởng cần xác nhận khớp kit thật trước khi in hàng loạt.`,
      });
      trackLampExportToRequest({ pattern });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể chuẩn bị yêu cầu.'); }
    finally { parts.forEach(p => p.geometry.dispose()); setUploading(false); }
  }

  useEffect(() => { if (prefill) document.getElementById('lamp-shade-request-form')?.scrollIntoView({ behavior: 'smooth' }); }, [prefill]);

  return <>
    <div className="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="h-[50dvh] min-h-[360px] bg-slate-900 lg:h-full lg:min-h-0">{group ? <Canvas group={group} /> : <p className="p-6 text-white">{result.error || 'Điều chỉnh nội dung để xem mẫu.'}</p>}</div>
      <aside className="space-y-4 border-l p-5 lg:overflow-y-auto">
        <h1 className="text-2xl font-bold">Flex Lamp</h1>
        <p className="text-sm">Chụp đèn hoa văn — lắp vừa đế socket ngoài (bộ kit), không tự in đế.</p>
        <fieldset disabled={uploading} className="space-y-3">
          <label className="block text-sm">Kiểu hoa văn<select className="mt-1 h-10 w-full rounded border bg-background px-2" value={pattern} onChange={e => setPattern(e.target.value as C.PatternType)}>{C.PATTERN_TYPES.map(p => <option key={p} value={p}>{PATTERN_LABELS[p]}</option>)}</select></label>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="lamp-around">Quanh vòng</label><span className="text-muted-foreground">{around}</span></div><input id="lamp-around" type="range" min={C.MIN_AROUND} max={C.MAX_AROUND} value={around} onChange={e => setAround(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="lamp-rows">Hàng</label><span className="text-muted-foreground">{rows}</span></div><input id="lamp-rows" type="range" min={C.MIN_ROWS} max={C.MAX_ROWS} value={rows} onChange={e => setRows(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="lamp-cell-size">Kích thước ô (mm)</label><span className="text-muted-foreground">{cellSizeMm}</span></div><input id="lamp-cell-size" type="range" min={C.MIN_CELL_SIZE_MM} max={C.MAX_CELL_SIZE_MM} step={0.5} value={cellSizeMm} onChange={e => setCellSizeMm(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="lamp-rotation">Xoay (°)</label><span className="text-muted-foreground">{rotationDeg}</span></div><input id="lamp-rotation" type="range" min={C.MIN_ROTATION_DEG} max={C.MAX_ROTATION_DEG} value={rotationDeg} onChange={e => setRotationDeg(Number(e.target.value))} className="block w-full" /></div>
          <label className="flex items-center justify-between text-sm">Màu<input type="color" value={color} onChange={e => setColor(e.target.value)} /></label>
        </fieldset>
        <p className="text-xs text-muted-foreground">Đường kính trong ~{Math.round(dims.radius * 2)}mm, cao {dims.height}mm.</p>
        {socketWarning ? <p role="alert" className="text-sm text-amber-600">Đường kính trong nhỏ hơn {C.SOCKET_MIN_INNER_DIAMETER_MM}mm — có thể không lắp vừa đế socket phổ biến. Tăng "Quanh vòng" hoặc "Kích thước ô" để mở rộng, hoặc xác nhận kích thước đế thật với xưởng.</p> : null}
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
    {prefill ? <section id="lamp-shade-request-form" className="mx-auto max-w-3xl p-6"><h2 className="mb-4 text-2xl font-bold">Hoàn tất yêu cầu báo giá</h2><CustomRequestForm key={prefill.attachmentPath} prefill={prefill} /></section> : null}
  </>;
}
