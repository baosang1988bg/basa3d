'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { StorefrontButton } from '@/components/storefront/button';
import { autoFitOrganizerCells, buildOrganizerModel, DEFAULT_ORGANIZER_OPTIONS, exportOrganizerStl, resolveOrganizerGrid, type OrganizerOptions } from '@/lib/3d-tools/organizer/organizer-engine';
import * as C from '@/lib/3d-tools/organizer/organizer-constants';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { trackOrganizerExportDownload, trackOrganizerExportToRequest, trackOrganizerPreview } from '@/lib/analytics';

const OrganizerCanvas = dynamic(() => import('./organizer-canvas'), { ssr: false, loading: () => <p>Đang mở bản xem trước 3D...</p> });
const parseSizes = (value: string) => value.split(',').map((part) => Number(part.trim()));

export default function OrganizerWorkbench() {
  const [dimensions, setDimensions] = useState(DEFAULT_ORGANIZER_OPTIONS);
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [rows, setRows] = useState(3); const [cols, setCols] = useState(4);
  const [columns, setColumns] = useState('43, 43, 43, 43');
  const [rowSizes, setRowSizes] = useState('37.8667, 37.8667, 37.8666');
  const [error, setError] = useState('');
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);
  const [uploading, setUploading] = useState(false);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);
  const options = useMemo<OrganizerOptions>(() => mode === 'equal'
    ? { ...dimensions, mode, rows, cols }
    : { ...dimensions, mode, columnWidthsMm: parseSizes(columns), rowHeightsMm: parseSizes(rowSizes) }, [dimensions, mode, rows, cols, columns, rowSizes]);
  const result = useMemo(() => {
    try { return { model: buildOrganizerModel(options), error: '' }; }
    catch (reason) { return { model: null, error: reason instanceof Error ? reason.message : 'Không thể dựng mẫu.' }; }
  }, [options]);
  const model = result.model;
  useEffect(() => () => model?.mergedGeometry.dispose(), [model]);
  useEffect(() => {
    setPrice(null);
    if (!model) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      trackOrganizerPreview(model);
      const weightGrams = estimateMeshWeightGrams(calculateMeshVolumeCm3(model.mergedGeometry));
      try {
        const response = await fetch('/api/public/tool-price-estimate', {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ weightGrams, printMinutes: estimatePrintMinutes(weightGrams) }),
        });
        const value = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setPrice(value);
      } catch { /* Advisory pricing must not prevent export. */ }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [model]);
  function changeMode(next: 'equal' | 'custom') {
    if (next === 'custom' && model) {
      setColumns(model.columnWidthsMm.join(', ')); setRowSizes(model.rowHeightsMm.join(', '));
    }
    if (next === 'equal' && model) { setRows(model.rows); setCols(model.cols); }
    setMode(next); setError('');
  }
  function autoFit() {
    try {
      const columnWidthsMm = autoFitOrganizerCells(dimensions.widthMm, dimensions.wallThicknessMm, parseSizes(columns));
      const rowHeightsMm = autoFitOrganizerCells(dimensions.depthMm, dimensions.wallThicknessMm, parseSizes(rowSizes));
      resolveOrganizerGrid({ ...dimensions, mode: 'custom', columnWidthsMm, rowHeightsMm });
      setColumns(columnWidthsMm.join(', ')); setRowSizes(rowHeightsMm.join(', ')); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể Auto-fit.'); }
  }
  function download() {
    if (!model) return;
    const url = URL.createObjectURL(exportOrganizerStl(model.mergedGeometry));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'khay-chia-ngan.stl'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); trackOrganizerExportDownload(model);
  }
  async function sendRequest() {
    if (!model) return;
    setUploading(true); setError('');
    try {
      const body = new FormData(); body.set('file', exportOrganizerStl(model.mergedGeometry), 'khay-chia-ngan.stl');
      const response = await fetch('/api/public/custom-requests/attachments', { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? 'Không thể tải STL lên.');
      const { path } = await response.json() as { path: string };
      setPrefill({ attachmentPath: path, attachmentFileName: 'khay-chia-ngan.stl', requestedMaterial: 'PLA', requestedColor: '',
        description: `Khay chia ngăn: ${model.rows}x${model.cols}, ${options.widthMm}x${options.depthMm}x${options.heightMm}mm` });
      trackOrganizerExportToRequest(model);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể chuẩn bị yêu cầu.'); }
    finally { setUploading(false); }
  }
  useEffect(() => { if (prefill) document.getElementById('organizer-request-form')?.scrollIntoView({ behavior: 'smooth' }); }, [prefill]);
  const field = (label: string, value: number, min: number, max: number, step: number, change: (value: number) => void) => <label className="block text-sm">{label}<input type="number" value={Number.isNaN(value) ? '' : value} min={min} max={max} step={step} onChange={(event) => change(event.target.valueAsNumber)} className="mt-1 h-10 w-full rounded border bg-background px-2" /></label>;
  return <>
    <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-h-[50dvh] bg-slate-100">{model ? <OrganizerCanvas geometry={model.mergedGeometry} /> : <p className="p-6">Điều chỉnh thông số để xem mẫu.</p>}</div>
      <aside className="space-y-4 border-l p-5">
        <h1 className="text-2xl font-bold">Flex Organizer</h1><p className="text-sm">Khay chia ngăn theo kích thước của bạn. Đơn vị: mm.</p>
        <fieldset disabled={uploading} className="space-y-3">
          {field('Chiều rộng (mm)', dimensions.widthMm, C.MIN_TRAY_DIMENSION_MM, C.MAX_TRAY_WIDTH_MM, 0.1, (widthMm) => setDimensions({ ...dimensions, widthMm }))}
          {field('Chiều sâu (mm)', dimensions.depthMm, C.MIN_TRAY_DIMENSION_MM, C.MAX_TRAY_DEPTH_MM, 0.1, (depthMm) => setDimensions({ ...dimensions, depthMm }))}
          {field('Chiều cao (mm)', dimensions.heightMm, C.MIN_TRAY_DIMENSION_MM, C.MAX_TRAY_HEIGHT_MM, 0.1, (heightMm) => setDimensions({ ...dimensions, heightMm }))}
          {field('Độ dày vách (mm)', dimensions.wallThicknessMm, C.MIN_WALL_THICKNESS_MM, C.MAX_WALL_THICKNESS_MM, 0.1, (wallThicknessMm) => setDimensions({ ...dimensions, wallThicknessMm }))}
          {field('Độ dày đáy (mm)', dimensions.bottomThicknessMm, C.MIN_BOTTOM_THICKNESS_MM, C.MAX_BOTTOM_THICKNESS_MM, 0.1, (bottomThicknessMm) => setDimensions({ ...dimensions, bottomThicknessMm }))}
          <label className="block text-sm">Chế độ lưới<select value={mode} onChange={(event) => changeMode(event.target.value as 'equal' | 'custom')} className="mt-1 h-10 w-full rounded border bg-background px-2"><option value="equal">Chia đều</option><option value="custom">Kích thước tuỳ chỉnh</option></select></label>
          {mode === 'equal' ? <div className="grid grid-cols-2 gap-3">{field('Số hàng', rows, 1, C.MAX_GRID_ROWS, 1, setRows)}{field('Số cột', cols, 1, C.MAX_GRID_COLS, 1, setCols)}</div> : <>
            <label className="block text-sm">Độ rộng các cột (mm)<input value={columns} onChange={(event) => setColumns(event.target.value)} className="mt-1 h-10 w-full rounded border bg-background px-2" /></label>
            <label className="block text-sm">Kích thước các hàng (mm)<input value={rowSizes} onChange={(event) => setRowSizes(event.target.value)} className="mt-1 h-10 w-full rounded border bg-background px-2" /></label>
            <p className="text-xs">Phân cách bằng dấu phẩy. Auto-fit giữ các ngăn trước và điền phần còn lại vào ngăn cuối.</p>
            <button type="button" onClick={autoFit} className="rounded border p-2">Auto-fit ngăn cuối</button>
          </>}
        </fieldset>
        {result.error || error ? <p role="alert" className="text-sm text-destructive">{result.error || error}</p> : null}
        {price ? <p>Ước tính: {price.minPriceVnd.toLocaleString('vi-VN')}đ – {price.maxPriceVnd.toLocaleString('vi-VN')}đ / chiếc</p> : <p className="text-sm">Chưa có giá ước tính.</p>}
        <p className="text-xs text-muted-foreground">Giá tham khảo cho PLA. Xưởng sẽ gửi báo giá chính xác sau khi kiểm tra mẫu.</p>
        <div className="grid gap-2" id="tool-quote"><StorefrontButton onClick={download} disabled={!model || uploading}>Tải STL</StorefrontButton><StorefrontButton onClick={() => void sendRequest()} disabled={!model || uploading}>{uploading ? 'Đang chuẩn bị file...' : 'Gửi yêu cầu báo giá'}</StorefrontButton></div>
      </aside>
    </div>
    {prefill ? <section id="organizer-request-form" className="mx-auto max-w-3xl p-6"><h2 className="mb-4 text-2xl font-bold">Hoàn tất yêu cầu báo giá</h2><CustomRequestForm key={prefill.attachmentPath} prefill={prefill} /></section> : null}
  </>;
}
