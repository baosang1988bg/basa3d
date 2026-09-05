'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { StorefrontButton } from '@/components/storefront/button';
import {
  buildJigsawPieces,
  disposeJigsawPieces,
  disposePreviewScene,
  getJigsawExportParts,
  layoutPiecesForPreview,
  loadUploadedMesh,
  mergeJigsawGeometry,
  type JigsawPiece,
} from '@/lib/3d-tools/jigsaw/jigsaw-engine';
import * as C from '@/lib/3d-tools/jigsaw/jigsaw-constants';
import { write3mf, exportBlocksStlZip } from '@/lib/3d-tools/common/3mf-writer';
import { exportKeychainStl } from '@/lib/keychain/keychain-engine';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { trackJigsawExportDownload, trackJigsawExportToRequest, trackJigsawPreview } from '@/lib/analytics';

const Canvas = dynamic(() => import('./jigsaw-canvas'), { ssr: false, loading: () => <p>Đang mở bản xem trước 3D...</p> });

export default function JigsawWorkbench() {
  const [sourceGeometry, setSourceGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [color, setColor] = useState(C.DEFAULT_COLOR);
  const [uploadError, setUploadError] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);

  useEffect(() => () => { sourceGeometry?.dispose(); }, [sourceGeometry]);

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    setUploadError(''); setError('');
    try {
      const geometry = await loadUploadedMesh(file);
      sourceGeometry?.dispose();
      setSourceGeometry(geometry);
      setFileName(file.name);
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : 'Không thể đọc file mô hình.');
    }
  }

  const result = useMemo(() => {
    if (!sourceGeometry) return { pieces: null as JigsawPiece[] | null, error: '' };
    try {
      return { pieces: buildJigsawPieces(sourceGeometry, rows, cols), error: '' };
    } catch (reason) {
      return { pieces: null, error: reason instanceof Error ? reason.message : 'Không thể cắt mô hình.' };
    }
  }, [sourceGeometry, rows, cols]);
  const pieces = result.pieces;
  useEffect(() => () => { if (pieces) disposeJigsawPieces(pieces); }, [pieces]);

  const previewGroup = useMemo(() => (pieces ? layoutPiecesForPreview(pieces, rows, cols, color) : null), [pieces, rows, cols, color]);
  useEffect(() => () => { if (previewGroup) disposePreviewScene(previewGroup); }, [previewGroup]);

  useEffect(() => {
    setPrice(null); if (!pieces) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      trackJigsawPreview({ pieceCount: pieces.length });
      const volume = pieces.reduce((sum, p) => sum + calculateMeshVolumeCm3(p.geometry), 0);
      const weightGrams = estimateMeshWeightGrams(volume);
      try {
        const response = await fetch('/api/public/tool-price-estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ weightGrams, printMinutes: estimatePrintMinutes(weightGrams) }) });
        const value = response.ok ? await response.json() : null; if (!controller.signal.aborted) setPrice(value);
      } catch { /* Advisory pricing does not prevent export. */ }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [pieces]);

  function download(format: 'stl' | 'stl-zip' | '3mf') {
    if (!pieces) return;
    const parts = getJigsawExportParts(pieces, color);
    try {
      let blob: Blob;
      if (format === '3mf') blob = new Blob([new Uint8Array(write3mf(parts))], { type: 'model/3mf' });
      else if (format === 'stl-zip') blob = new Blob([new Uint8Array(exportBlocksStlZip(parts))], { type: 'application/zip' });
      else {
        const geometry = mergeJigsawGeometry(parts);
        try { blob = exportKeychainStl(geometry); } finally { geometry.dispose(); }
      }
      const extension = format === 'stl-zip' ? 'zip' : format;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `manh-ghep.${extension}`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      trackJigsawExportDownload({ pieceCount: pieces.length, format: format === 'stl' ? 'stl-zip' : format }); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể xuất file.'); }
    finally { parts.forEach(p => p.geometry.dispose()); }
  }

  async function sendRequest() {
    if (!pieces) return; setUploading(true); setError('');
    const parts = getJigsawExportParts(pieces, color);
    try {
      const geometry = mergeJigsawGeometry(parts);
      let blob: Blob; try { blob = exportKeychainStl(geometry); } finally { geometry.dispose(); }
      const requestFileName = 'manh-ghep.stl'; const body = new FormData(); body.set('file', blob, requestFileName);
      const response = await fetch('/api/public/custom-requests/attachments', { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? 'Không thể tải STL lên.');
      const { path } = await response.json() as { path: string };
      setPrefill({
        attachmentPath: path,
        attachmentFileName: requestFileName,
        requestedMaterial: 'PLA',
        requestedColor: color,
        description: `Mảnh ghép 3D cắt từ "${fileName}": lưới ${rows}×${cols}, ${pieces.length} mảnh. Khớp nối chưa qua kiểm chứng in thật — xưởng cần in thử trước khi sản xuất hàng loạt.`,
      });
      trackJigsawExportToRequest({ pieceCount: pieces.length });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể chuẩn bị yêu cầu.'); }
    finally { parts.forEach(p => p.geometry.dispose()); setUploading(false); }
  }

  useEffect(() => { if (prefill) document.getElementById('jigsaw-request-form')?.scrollIntoView({ behavior: 'smooth' }); }, [prefill]);

  return <>
    <div className="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="h-[50dvh] min-h-[360px] bg-slate-100 lg:h-full lg:min-h-0">
        {previewGroup ? <Canvas group={previewGroup} /> : <p className="p-6">{uploadError || result.error || 'Tải lên 1 file .stl hoặc .obj để bắt đầu.'}</p>}
      </div>
      <aside className="space-y-4 border-l p-5 lg:overflow-y-auto">
        <h1 className="text-2xl font-bold">Jigsaw Studio</h1>
        <p className="text-sm">Cắt mô hình 3D tải lên thành lưới mảnh ghép lồng khớp. Tối đa {C.MAX_TRIANGLES.toLocaleString('vi-VN')} tam giác, lưới tối đa {C.MAX_GRID}×{C.MAX_GRID}.</p>
        <fieldset disabled={uploading} className="space-y-3">
          <label className="block text-sm">Tải mô hình (.stl, .obj)<input type="file" accept=".stl,.obj" className="mt-1 block w-full text-sm" onChange={e => void onFileChange(e.target.files?.[0])} /></label>
          {fileName ? <p className="text-xs text-muted-foreground">Đã tải: {fileName}</p> : null}
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="jigsaw-rows">Hàng</label><span className="text-muted-foreground">{rows}</span></div><input id="jigsaw-rows" type="range" min={1} max={C.MAX_GRID} value={rows} onChange={e => setRows(Number(e.target.value))} className="block w-full" /></div>
          <div className="text-sm"><div className="flex justify-between"><label htmlFor="jigsaw-cols">Cột</label><span className="text-muted-foreground">{cols}</span></div><input id="jigsaw-cols" type="range" min={1} max={C.MAX_GRID} value={cols} onChange={e => setCols(Number(e.target.value))} className="block w-full" /></div>
          <label className="flex items-center justify-between text-sm">Màu<input type="color" value={color} onChange={e => setColor(e.target.value)} /></label>
        </fieldset>
        <p role="alert" className="text-sm text-amber-600">Khớp nối lồi/lõm chưa được kiểm chứng bằng in thật trong công cụ này — in thử 1 cặp mảnh trước khi sản xuất hàng loạt.</p>
        {uploadError || error || result.error ? <p role="alert" className="text-sm text-destructive">{uploadError || error || result.error}</p> : null}
        {price ? <p>Ước tính: {price.minPriceVnd.toLocaleString('vi-VN')}đ – {price.maxPriceVnd.toLocaleString('vi-VN')}đ / bộ</p> : <p className="text-sm">Chưa có giá ước tính.</p>}
        <p className="text-xs text-muted-foreground">Giá tham khảo cho PLA. Xưởng sẽ gửi báo giá chính xác sau khi kiểm tra mẫu.</p>
        <div className="grid gap-2">
          <StorefrontButton disabled={!pieces || uploading} onClick={() => download('stl')}>Tải 1 STL gộp</StorefrontButton>
          <StorefrontButton disabled={!pieces || uploading} onClick={() => download('stl-zip')}>Tải STL Zip (mỗi mảnh 1 file)</StorefrontButton>
          <StorefrontButton disabled={!pieces || uploading} onClick={() => download('3mf')}>Tải 3MF</StorefrontButton>
          <StorefrontButton disabled={!pieces || uploading} onClick={() => void sendRequest()}>{uploading ? 'Đang chuẩn bị file...' : 'Gửi yêu cầu báo giá'}</StorefrontButton>
        </div>
      </aside>
    </div>
    {prefill ? <section id="jigsaw-request-form" className="mx-auto max-w-3xl p-6"><h2 className="mb-4 text-2xl font-bold">Hoàn tất yêu cầu báo giá</h2><CustomRequestForm key={prefill.attachmentPath} prefill={prefill} /></section> : null}
  </>;
}
