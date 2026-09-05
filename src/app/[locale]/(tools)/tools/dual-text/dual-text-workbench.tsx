'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { Font } from 'opentype.js';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { StorefrontButton } from '@/components/storefront/button';
import {
  disposeDualTextScene,
  generateDualTextScene,
  getDualTextExportParts,
  loadDualTextFont,
  mergeDualTextGeometry,
  type DualTextFont,
} from '@/lib/3d-tools/dual-text/dual-text-engine';
import * as C from '@/lib/3d-tools/dual-text/dual-text-constants';
import { write3mf } from '@/lib/3d-tools/common/3mf-writer';
import { exportKeychainStl } from '@/lib/keychain/keychain-engine';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { trackDualTextExportDownload, trackDualTextExportToRequest, trackDualTextPreview } from '@/lib/analytics';

const Canvas = dynamic(() => import('./dual-text-canvas'), { ssr: false, loading: () => <p>Đang mở bản xem trước 3D...</p> });

export default function DualTextWorkbench() {
  const [word1, setWord1] = useState('STOP');
  const [word2, setWord2] = useState('WORK');
  const [fontName, setFontName] = useState<DualTextFont>('Anton');
  const [font, setFont] = useState<{ name: DualTextFont; value: Font } | null>(null);
  const [blockSize, setBlockSize] = useState(C.DEFAULT_BLOCK_SIZE_MM);
  const [gap, setGap] = useState(C.DEFAULT_BLOCK_GAP_MM);
  const [margin, setMargin] = useState(C.DEFAULT_BASE_MARGIN_MM);
  const [baseHeight, setBaseHeight] = useState(C.DEFAULT_BASE_HEIGHT_MM);
  const [cornerPercent, setCornerPercent] = useState(C.DEFAULT_BASE_CORNER_PERCENT);
  const [textColor, setTextColor] = useState(C.DEFAULT_TEXT_COLOR);
  const [baseColor, setBaseColor] = useState(C.DEFAULT_BASE_COLOR);
  const [fontError, setFontError] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);

  useEffect(() => {
    let active = true; setFontError('');
    void loadDualTextFont(fontName).then(value => { if (active) setFont({ name: fontName, value }); })
      .catch(reason => { if (active) setFontError(reason instanceof Error ? reason.message : 'Không tải được font.'); });
    return () => { active = false; };
  }, [fontName]);

  const result = useMemo(() => {
    if (!font || font.name !== fontName) return { group: null, error: '' };
    try {
      return { group: generateDualTextScene(word1, word2, font.value, { blockSize, gap, margin, baseHeight, cornerPercent, textColor, baseColor }), error: '' };
    } catch (reason) {
      return { group: null, error: reason instanceof Error ? reason.message : 'Không thể dựng mẫu.' };
    }
  }, [word1, word2, font, fontName, blockSize, gap, margin, baseHeight, cornerPercent, textColor, baseColor]);
  const group = result.group;
  const blockCount = Math.max(word1.length, word2.length, 1);
  useEffect(() => () => { if (group) disposeDualTextScene(group); }, [group]);

  useEffect(() => {
    setPrice(null); if (!group) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      trackDualTextPreview({ blockCount });
      const parts = getDualTextExportParts(group);
      const volume = parts.reduce((sum, p) => sum + calculateMeshVolumeCm3(p.geometry), 0); parts.forEach(p => p.geometry.dispose());
      const weightGrams = estimateMeshWeightGrams(volume);
      try {
        const response = await fetch('/api/public/tool-price-estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ weightGrams, printMinutes: estimatePrintMinutes(weightGrams) }) });
        const value = response.ok ? await response.json() : null; if (!controller.signal.aborted) setPrice(value);
      } catch { /* Advisory pricing does not prevent export. */ }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [group, blockCount]);

  function download(format: 'stl' | '3mf') {
    if (!group) return;
    const parts = getDualTextExportParts(group);
    try {
      let blob: Blob;
      if (format === '3mf') {
        blob = new Blob([new Uint8Array(write3mf(parts))], { type: 'model/3mf' });
      } else {
        const geometry = mergeDualTextGeometry(parts);
        try { blob = exportKeychainStl(geometry); } finally { geometry.dispose(); }
      }
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `chu-ao-anh.${format}`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      trackDualTextExportDownload({ blockCount, format }); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể xuất file.'); }
    finally { parts.forEach(p => p.geometry.dispose()); }
  }

  async function sendRequest() {
    if (!group) return; setUploading(true); setError('');
    const parts = getDualTextExportParts(group);
    try {
      const geometry = mergeDualTextGeometry(parts);
      let blob: Blob; try { blob = exportKeychainStl(geometry); } finally { geometry.dispose(); }
      const fileName = 'chu-ao-anh.stl'; const body = new FormData(); body.set('file', blob, fileName);
      const response = await fetch('/api/public/custom-requests/attachments', { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? 'Không thể tải STL lên.');
      const { path } = await response.json() as { path: string };
      setPrefill({
        attachmentPath: path,
        attachmentFileName: fileName,
        requestedMaterial: 'PLA',
        requestedColor: `Chữ ${textColor} - Đế ${baseColor}`,
        description: `Chữ ảo ảnh 2 góc nhìn: "${word1}" / "${word2}"; font ${fontName}; cỡ chữ ${blockSize}mm; ${blockCount} khối.`,
      });
      trackDualTextExportToRequest({ blockCount });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể chuẩn bị yêu cầu.'); }
    finally { parts.forEach(p => p.geometry.dispose()); setUploading(false); }
  }

  useEffect(() => { if (prefill) document.getElementById('dual-text-request-form')?.scrollIntoView({ behavior: 'smooth' }); }, [prefill]);

  return <>
    <div className="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="h-[50dvh] min-h-[360px] bg-slate-900 lg:h-full lg:min-h-0">{group ? <Canvas group={group} /> : <p className="p-6 text-white">{fontError || result.error ? 'Điều chỉnh nội dung để xem mẫu.' : 'Đang tải font...'}</p>}</div>
      <aside className="space-y-4 border-l p-5 lg:overflow-y-auto">
        <h1 className="text-2xl font-bold">Flex Dual Text</h1>
        <p className="text-sm">Hai từ → một hàng khối, mỗi khối đọc ra chữ khác nhau từ hai góc 45°. Tối đa {C.MAX_DUAL_TEXT_BLOCKS} khối.</p>
        <fieldset disabled={uploading} className="space-y-3">
          <label className="block text-sm">Từ 1 (góc nhìn 1)<input className="mt-1 h-10 w-full rounded border bg-background px-2" value={word1} onChange={e => setWord1(e.target.value.toUpperCase())} /></label>
          <label className="block text-sm">Từ 2 (góc nhìn 2)<input className="mt-1 h-10 w-full rounded border bg-background px-2" value={word2} onChange={e => setWord2(e.target.value.toUpperCase())} /></label>
          <label className="block text-sm">Phông chữ<select className="mt-1 h-10 w-full rounded border bg-background px-2" value={fontName} onChange={e => setFontName(e.target.value as DualTextFont)}>{Object.keys(C.FONTS).map(f => <option key={f}>{f}</option>)}</select></label>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="dual-text-block-size">Cỡ chữ (mm)</label><span className="text-muted-foreground">{blockSize}</span></div><input id="dual-text-block-size" type="range" min={C.MIN_BLOCK_SIZE_MM} max={C.MAX_BLOCK_SIZE_MM} value={blockSize} onChange={e => setBlockSize(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="dual-text-gap">Khoảng cách khối (mm)</label><span className="text-muted-foreground">{gap}</span></div><input id="dual-text-gap" type="range" min={C.MIN_BLOCK_GAP_MM} max={C.MAX_BLOCK_GAP_MM} step={0.1} value={gap} onChange={e => setGap(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="dual-text-margin">Lề đế (mm)</label><span className="text-muted-foreground">{margin}</span></div><input id="dual-text-margin" type="range" min={C.MIN_BASE_MARGIN_MM} max={C.MAX_BASE_MARGIN_MM} value={margin} onChange={e => setMargin(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="dual-text-base-height">Cao đế (mm)</label><span className="text-muted-foreground">{baseHeight}</span></div><input id="dual-text-base-height" type="range" min={C.MIN_BASE_HEIGHT_MM} max={C.MAX_BASE_HEIGHT_MM} step={0.5} value={baseHeight} onChange={e => setBaseHeight(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="dual-text-corner">Bo góc đế (%)</label><span className="text-muted-foreground">{cornerPercent}</span></div><input id="dual-text-corner" type="range" min={0} max={100} value={cornerPercent} onChange={e => setCornerPercent(Number(e.target.value))} className="block w-full" /></div>
          <label className="flex items-center justify-between text-sm">Màu chữ<input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} /></label>
          <label className="flex items-center justify-between text-sm">Màu đế<input type="color" value={baseColor} onChange={e => setBaseColor(e.target.value)} /></label>
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
    {prefill ? <section id="dual-text-request-form" className="mx-auto max-w-3xl p-6"><h2 className="mb-4 text-2xl font-bold">Hoàn tất yêu cầu báo giá</h2><CustomRequestForm key={prefill.attachmentPath} prefill={prefill} /></section> : null}
  </>;
}
