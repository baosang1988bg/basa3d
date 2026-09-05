'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { Font } from 'opentype.js';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { StorefrontButton } from '@/components/storefront/button';
import {
  disposeCarScene,
  generateCarNameplateScene,
  getCarExportParts,
  loadCarFont,
  mergeCarGeometry,
  type CarFont,
} from '@/lib/3d-tools/car-nameplate/car-nameplate-engine';
import * as C from '@/lib/3d-tools/car-nameplate/car-nameplate-constants';
import { write3mf } from '@/lib/3d-tools/common/3mf-writer';
import { exportKeychainStl } from '@/lib/keychain/keychain-engine';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { trackCarExportDownload, trackCarExportToRequest, trackCarPreview } from '@/lib/analytics';

const Canvas = dynamic(() => import('./car-nameplate-canvas'), { ssr: false, loading: () => <p>Đang mở bản xem trước 3D...</p> });

type SizePreset = keyof typeof C.NAMEPLATE_SIZE_PRESETS_MM;

export default function CarNameplateWorkbench() {
  const [name, setName] = useState('LEO');
  const [fontName, setFontName] = useState<CarFont>('Anton');
  const [font, setFont] = useState<{ name: CarFont; value: Font } | null>(null);
  const [sizePreset, setSizePreset] = useState<SizePreset>('medium');
  const [customWidth, setCustomWidth] = useState<number>(C.NAMEPLATE_SIZE_PRESETS_MM.medium);
  const [useCustomWidth, setUseCustomWidth] = useState(false);
  const [addBase, setAddBase] = useState(true);
  const [baseThickness, setBaseThickness] = useState(C.DEFAULT_BASE_THICKNESS_MM);
  const [baseOverlap, setBaseOverlap] = useState(C.DEFAULT_BASE_OVERLAP_MM);
  const [addKeyring, setAddKeyring] = useState(false);
  const [nameplateColor, setNameplateColor] = useState(C.DEFAULT_NAMEPLATE_COLOR);
  const [baseColor, setBaseColor] = useState(C.DEFAULT_BASE_COLOR);
  const [fontError, setFontError] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);

  const totalWidthMm = useCustomWidth ? customWidth : C.NAMEPLATE_SIZE_PRESETS_MM[sizePreset];

  useEffect(() => {
    let active = true; setFontError('');
    void loadCarFont(fontName).then(value => { if (active) setFont({ name: fontName, value }); })
      .catch(reason => { if (active) setFontError(reason instanceof Error ? reason.message : 'Không tải được font.'); });
    return () => { active = false; };
  }, [fontName]);

  const result = useMemo(() => {
    if (!font || font.name !== fontName) return { group: null, error: '' };
    try {
      return {
        group: generateCarNameplateScene(name, font.value, {
          totalWidthMm, addBase, baseThicknessMm: baseThickness, baseOverlapMm: baseOverlap,
          addKeyring: addBase && addKeyring, nameplateColor, baseColor,
        }),
        error: '',
      };
    } catch (reason) {
      return { group: null, error: reason instanceof Error ? reason.message : 'Không thể dựng mẫu.' };
    }
  }, [name, font, fontName, totalWidthMm, addBase, baseThickness, baseOverlap, addKeyring, nameplateColor, baseColor]);
  const group = result.group;
  useEffect(() => () => { if (group) disposeCarScene(group); }, [group]);

  useEffect(() => {
    setPrice(null); if (!group) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      trackCarPreview({ widthMm: totalWidthMm });
      const parts = getCarExportParts(group);
      const volume = parts.reduce((sum, p) => sum + calculateMeshVolumeCm3(p.geometry), 0); parts.forEach(p => p.geometry.dispose());
      const weightGrams = estimateMeshWeightGrams(volume);
      try {
        const response = await fetch('/api/public/tool-price-estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ weightGrams, printMinutes: estimatePrintMinutes(weightGrams) }) });
        const value = response.ok ? await response.json() : null; if (!controller.signal.aborted) setPrice(value);
      } catch { /* Advisory pricing does not prevent export. */ }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [group, totalWidthMm]);

  function download(format: 'stl' | '3mf') {
    if (!group) return;
    const parts = getCarExportParts(group);
    try {
      let blob: Blob;
      if (format === '3mf') {
        blob = new Blob([new Uint8Array(write3mf(parts))], { type: 'model/3mf' });
      } else {
        const geometry = mergeCarGeometry(parts);
        try { blob = exportKeychainStl(geometry); } finally { geometry.dispose(); }
      }
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `bang-ten-xe.${format}`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      trackCarExportDownload({ widthMm: totalWidthMm, format }); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể xuất file.'); }
    finally { parts.forEach(p => p.geometry.dispose()); }
  }

  async function sendRequest() {
    if (!group) return; setUploading(true); setError('');
    const parts = getCarExportParts(group);
    try {
      const geometry = mergeCarGeometry(parts);
      let blob: Blob; try { blob = exportKeychainStl(geometry); } finally { geometry.dispose(); }
      const fileName = 'bang-ten-xe.stl'; const body = new FormData(); body.set('file', blob, fileName);
      const response = await fetch('/api/public/custom-requests/attachments', { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? 'Không thể tải STL lên.');
      const { path } = await response.json() as { path: string };
      setPrefill({
        attachmentPath: path,
        attachmentFileName: fileName,
        requestedMaterial: 'PLA',
        requestedColor: `Bảng tên ${nameplateColor}${addBase ? ` - Đế ${baseColor}` : ''}`,
        description: `Bảng tên xe ảo ảnh (Sedan): "${name}"; font ${fontName}; kích thước ${totalWidthMm}mm${addBase ? `; có đế phẳng ${baseThickness}mm` : ''}${addBase && addKeyring ? '; có móc khoá' : ''}.`,
      });
      trackCarExportToRequest({ widthMm: totalWidthMm });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể chuẩn bị yêu cầu.'); }
    finally { parts.forEach(p => p.geometry.dispose()); setUploading(false); }
  }

  useEffect(() => { if (prefill) document.getElementById('car-nameplate-request-form')?.scrollIntoView({ behavior: 'smooth' }); }, [prefill]);

  return <>
    <div className="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="h-[50dvh] min-h-[360px] bg-slate-900 lg:h-full lg:min-h-0">{group ? <Canvas group={group} /> : <p className="p-6 text-white">{fontError || result.error ? 'Điều chỉnh nội dung để xem mẫu.' : 'Đang tải font...'}</p>}</div>
      <aside className="space-y-4 border-l p-5 lg:overflow-y-auto">
        <h1 className="text-2xl font-bold">Flex Car</h1>
        <p className="text-sm">Xe + tên → 1 khối ảo ảnh: nhìn thẳng thấy xe, xoay 90° thấy tên.</p>
        <fieldset disabled={uploading} className="space-y-3">
          <p className="text-sm font-medium">Chọn xe: Sedan (v1 chỉ 1 mẫu)</p>
          <label className="block text-sm">Tên<input className="mt-1 h-10 w-full rounded border bg-background px-2" value={name} onChange={e => setName(e.target.value.toUpperCase())} /></label>
          <label className="block text-sm">Phông chữ<select className="mt-1 h-10 w-full rounded border bg-background px-2" value={fontName} onChange={e => setFontName(e.target.value as CarFont)}>{Object.keys(C.FONTS).map(f => <option key={f}>{f}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(C.NAMEPLATE_SIZE_PRESETS_MM) as SizePreset[]).map(preset => (
              <button key={preset} type="button" disabled={useCustomWidth} onClick={() => setSizePreset(preset)}
                className={`rounded border px-2 py-1 text-sm ${!useCustomWidth && sizePreset === preset ? 'border-primary bg-primary/10' : ''}`}>
                {preset} {C.NAMEPLATE_SIZE_PRESETS_MM[preset]}mm
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useCustomWidth} onChange={e => setUseCustomWidth(e.target.checked)} />Tuỳ chỉnh kích thước</label>
          {useCustomWidth ? (
            <div className="text-sm">
              <div className="flex justify-between"><label htmlFor="car-custom-width">Kích thước (mm)</label><span className="text-muted-foreground">{customWidth}</span></div>
              <input id="car-custom-width" type="range" min={C.MIN_NAMEPLATE_WIDTH_MM} max={C.MAX_NAMEPLATE_WIDTH_MM} value={customWidth} onChange={e => setCustomWidth(Number(e.target.value))} className="block w-full" />
            </div>
          ) : null}
          <div className="text-sm">
            <div className="flex justify-between"><label htmlFor="car-overlap">Độ nối chữ (mm)</label><span className="text-muted-foreground">{baseOverlap}</span></div>
            <input id="car-overlap" type="range" min={C.MIN_BASE_OVERLAP_MM} max={C.MAX_BASE_OVERLAP_MM} step={0.05} value={baseOverlap} onChange={e => setBaseOverlap(Number(e.target.value))} className="block w-full" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addBase} onChange={e => setAddBase(e.target.checked)} />Thêm đế phẳng</label>
          {addBase ? (
            <>
              <div className="text-sm">
                <div className="flex justify-between"><label htmlFor="car-base-thickness">Độ dày đế (mm)</label><span className="text-muted-foreground">{baseThickness}</span></div>
                <input id="car-base-thickness" type="range" min={C.MIN_BASE_THICKNESS_MM} max={C.MAX_BASE_THICKNESS_MM} step={0.5} value={baseThickness} onChange={e => setBaseThickness(Number(e.target.value))} className="block w-full" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addKeyring} onChange={e => setAddKeyring(e.target.checked)} />Thêm móc khoá</label>
            </>
          ) : <p className="text-xs text-muted-foreground">Tắt đế phẳng có thể khiến vài tổ hợp tên/xe rã mảnh; không có tuỳ chọn móc khoá khi tắt đế.</p>}
          <label className="flex items-center justify-between text-sm">Màu bảng tên<input type="color" value={nameplateColor} onChange={e => setNameplateColor(e.target.value)} /></label>
          {addBase ? <label className="flex items-center justify-between text-sm">Màu đế<input type="color" value={baseColor} onChange={e => setBaseColor(e.target.value)} /></label> : null}
        </fieldset>
        {error || fontError || result.error ? <p role="alert" className="text-sm text-destructive">{error || fontError || result.error}</p> : null}
        {price ? <p>Ước tính: {price.minPriceVnd.toLocaleString('vi-VN')}đ – {price.maxPriceVnd.toLocaleString('vi-VN')}đ / chiếc</p> : <p className="text-sm">Chưa có giá ước tính.</p>}
        <p className="text-xs text-muted-foreground">Giá tham khảo cho PLA. Xưởng sẽ gửi báo giá chính xác sau khi kiểm tra mẫu.</p>
        <div className="grid gap-2">
          <StorefrontButton disabled={!group || uploading} onClick={() => download('stl')}>Tải STL</StorefrontButton>
          <StorefrontButton disabled={!group || uploading} onClick={() => download('3mf')}>Tải 3MF (có màu)</StorefrontButton>
          <StorefrontButton disabled={!group || uploading} onClick={() => void sendRequest()}>{uploading ? 'Đang chuẩn bị file...' : 'Gửi yêu cầu báo giá'}</StorefrontButton>
        </div>
      </aside>
    </div>
    {prefill ? <section id="car-nameplate-request-form" className="mx-auto max-w-3xl p-6"><h2 className="mb-4 text-2xl font-bold">Hoàn tất yêu cầu báo giá</h2><CustomRequestForm key={prefill.attachmentPath} prefill={prefill} /></section> : null}
  </>;
}
