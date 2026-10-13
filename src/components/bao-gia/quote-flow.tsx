'use client';

import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { AlertCircle, Box, Check, Copy, Eye, Loader2, Printer, Trash2, Upload } from 'lucide-react';
import { StorefrontButton } from '@/components/storefront/button';
import { formatVnd } from '@/components/storefront/format';
import { BAO_GIA_MAX_ITEMS, BAO_GIA_RESPONSE_TIME_TEXT } from '@/config/bao-gia';
import { MAX_UPLOAD_BYTES, formatUploadLimitMb } from '@/config/uploads';
import { SITE_CONFIG } from '@/config/site';
import { DEFAULT_INFILL_PCT, INFILL_OPTIONS, MIN_ITEM_PRICE_VND } from '@/lib/pricing/fdm-estimate-model';
import type { MeshMetrics } from '@/lib/pricing/mesh-metrics';
import { CURRENT_TOS_VERSION } from '@/lib/copyright/tos-version';
import { trackContactClick, trackQuoteEstimateShown, trackQuoteFileAdded, trackQuoteSubmitted } from '@/lib/analytics';
import { uploadCustomRequestFiles } from '@/lib/uploads/upload-custom-request-file';
import type { MeshAnalyzeRequest, MeshAnalyzeResponse } from '@/workers/mesh-analyze.worker';
import { EstimatePrintSheet, type PrintLine } from './estimate-print-sheet';

const MeshViewer = dynamic(() => import('./mesh-viewer'), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted sm:h-80" /> });

const ACCEPTED = new Set(['stl', 'obj']);
const MATERIAL_LABEL: Record<string, string> = { PLA: 'PLA', PETG: 'PETG', ABS: 'ABS', ASA: 'ASA', TPU: 'TPU (dẻo)' };
const UNPRICED_TEXT: Record<string, string> = {
  EXCEEDS_BUILD_VOLUME: 'Cần xưởng báo giá (vượt khổ máy / cần chia nhỏ)',
  INVALID_MESH: 'Cần xưởng báo giá (hình khối có lỗi, xưởng sẽ kiểm tra)',
};
const PRICE_NOTE = 'Giá ước tính sơ bộ từ hình học. Xưởng xác nhận giá chính xác sau khi xem file.';

type Item = {
  id: string;
  file: File;
  name: string;
  analysis: 'pending' | 'ok' | 'error';
  metrics?: MeshMetrics;
  positions?: Float32Array | null;
  error?: string;
  materialType: string;
  infillPct: number;
  scalePct: number;
  color: string;
  quantity: number;
};

type EstimateLine =
  | { status: 'OK'; grams: number; printMinutes: number; sizeMm: { x: number; y: number; z: number }; unitPriceVnd: number; lineSubtotalVnd: number; floorApplied: boolean; vatVnd: number; lineTotalVnd: number }
  | { status: 'UNPRICED'; reason: string; sizeMm: { x: number; y: number; z: number } }
  | { status: 'NO_MATERIAL_PRICE'; sizeMm: { x: number; y: number; z: number } };

type EstimateResponse = {
  items: EstimateLine[];
  totals: { subtotalVnd: number; vatVnd: number; totalVnd: number; pricedItems: number } | null;
  vat?: { enabled: boolean; rateBps: number };
  reason?: string;
};

const fmtHours = (minutes: number) => (minutes < 60 ? `${minutes} phút` : `${Math.round((minutes / 60) * 10) / 10} giờ`);
const fmtSize = (s: { x: number; y: number; z: number }) => `${s.x} × ${s.y} × ${s.z} mm`;
const inputClass = 'h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';

export function QuoteFlow({ materials }: { materials: string[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; data?: EstimateResponse; forIds?: string[] }>({ status: 'idle' });
  const [submit, setSubmit] = useState<{ status: 'idle' | 'uploading' | 'submitting' | 'error'; message?: string; progress?: string }>({ status: 'idle' });
  const [done, setDone] = useState<{ requestNumber: string } | null>(null);
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const uploadedPaths = useRef(new Map<string, string>());
  const defaultMaterial = materials[0] ?? 'PLA';

  const worker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../../workers/mesh-analyze.worker.ts', import.meta.url));
      workerRef.current.onmessage = (event: MessageEvent<MeshAnalyzeResponse>) => {
        const result = event.data;
        setItems((current) => current.map((item) => {
          if (item.id !== result.id) return item;
          return result.ok
            ? { ...item, analysis: 'ok', metrics: result.metrics, positions: result.positions }
            : { ...item, analysis: 'error', error: result.message };
        }));
      };
    }
    return workerRef.current;
  }, []);
  useEffect(() => () => workerRef.current?.terminate(), []);

  function addFiles(list: FileList | File[]) {
    setNotice(null);
    const incoming = Array.from(list);
    const next: Item[] = [];
    for (const file of incoming) {
      const ext = file.name.toLowerCase().split('.').pop() ?? '';
      if (ext === '3mf') { setNotice('File .3mf vui lòng gửi ở trang Đặt in theo yêu cầu — file .3mf đã slice cho giá chính xác theo slicer.'); continue; }
      if (!ACCEPTED.has(ext)) { setNotice('Trang này nhận file .stl và .obj.'); continue; }
      if (file.size > MAX_UPLOAD_BYTES) { setNotice(`${file.name}: tối đa ${formatUploadLimitMb()} mỗi file.`); continue; }
      if (items.length + next.length >= BAO_GIA_MAX_ITEMS) { setNotice(`Tối đa ${BAO_GIA_MAX_ITEMS} file mỗi lần báo giá.`); break; }
      const item: Item = {
        id: crypto.randomUUID(), file, name: file.name.slice(0, 200), analysis: 'pending',
        materialType: defaultMaterial, infillPct: DEFAULT_INFILL_PCT, scalePct: 100, color: '', quantity: 1,
      };
      next.push(item);
      worker().postMessage({ id: item.id, file } satisfies MeshAnalyzeRequest);
      trackQuoteFileAdded({ extension: ext, sizeMb: Number((file.size / 1_048_576).toFixed(2)), fileCount: items.length + next.length });
    }
    if (next.length) setItems((current) => [...current, ...next]);
  }

  function update(id: string, patch: Partial<Item>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }
  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    uploadedPaths.current.delete(id);
    if (selectedId === id) setSelectedId(null);
  }

  const ready = useMemo(() => items.filter((item) => item.analysis === 'ok' && item.metrics), [items]);
  // "Xem trước mô hình": the chosen item, else the first analysed one — always one viewer at most.
  const previewItem = ready.find((item) => item.id === selectedId) ?? ready[0] ?? null;
  const signature = JSON.stringify(ready.map((item) => [item.id, item.materialType, item.infillPct, item.scalePct, item.quantity]));

  // Debounced re-estimate (§7: < 1s after each change; no upload).
  useEffect(() => {
    if (!ready.length) { setEstimate({ status: 'idle' }); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setEstimate((current) => ({ ...current, status: 'loading' }));
      try {
        const response = await fetch('/api/public/quote-estimate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            items: ready.map((item) => ({
              kind: 'MESH', metrics: item.metrics, scalePermille: Math.round(item.scalePct * 10),
              materialType: item.materialType, infillPct: item.infillPct, quantity: item.quantity,
            })),
          }),
        });
        const data = (await response.json().catch(() => null)) as EstimateResponse | null;
        if (!response.ok || !data) { setEstimate({ status: 'error' }); return; }
        setEstimate({ status: 'done', data, forIds: ready.map((item) => item.id) });
        if (data.totals) trackQuoteEstimateShown({ itemCount: ready.length, pricedCount: data.totals.pricedItems, totalVnd: data.totals.totalVnd });
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) setEstimate({ status: 'error' });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [signature]); // `ready` is captured via `signature` (its JSON); re-run only when inputs change.

  const lineFor = (id: string): EstimateLine | null => {
    if (estimate.status === 'loading' && !estimate.data) return null;
    const index = estimate.forIds?.indexOf(id) ?? -1;
    return index >= 0 ? estimate.data?.items[index] ?? null : null;
  };
  const totals = estimate.data?.totals ?? null;
  const vat = estimate.data?.vat;
  const step = done ? 4 : !items.length ? 1 : totals ? 3 : 2;

  const printLines: PrintLine[] = ready.map((item) => ({ name: item.name, materialType: item.materialType, infillPct: item.infillPct, scalePct: item.scalePct, quantity: item.quantity, line: lineFor(item.id) }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready.length || !copyrightConfirmed) return;
    const form = new FormData(event.currentTarget);
    try {
      const pending = ready.filter((item) => !uploadedPaths.current.has(item.id));
      if (pending.length) {
        setSubmit({ status: 'uploading', progress: `Đang tải file 0/${pending.length}…` });
        const paths = await uploadCustomRequestFiles(
          pending.map((item) => ({ file: item.file, fileName: item.name })),
          (n, total) => setSubmit({ status: 'uploading', progress: `Đang tải file ${n}/${total}…` }),
        );
        pending.forEach((item, index) => uploadedPaths.current.set(item.id, paths[index]));
      }
      setSubmit({ status: 'submitting' });
      const response = await fetch('/api/public/custom-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName: String(form.get('customerName') ?? ''),
          customerPhone: String(form.get('customerPhone') ?? ''),
          customerEmail: form.get('customerEmail') ? String(form.get('customerEmail')) : null,
          description: String(form.get('note') ?? '').trim() || null,
          honeypot: String(form.get('company-website') ?? ''),
          copyrightConfirmed: true,
          tosVersion: CURRENT_TOS_VERSION,
          items: ready.map((item) => ({
            attachmentPath: uploadedPaths.current.get(item.id),
            displayName: item.name,
            materialType: item.materialType,
            infillPct: item.infillPct,
            scalePermille: Math.round(item.scalePct * 10),
            color: item.color.trim() || null,
            quantity: item.quantity,
            clientMetrics: item.metrics,
          })),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setSubmit({ status: 'error', message: response.status === 429 ? body?.message ?? 'Bạn đã gửi quá nhiều lần, vui lòng thử lại sau ít phút.' : body?.message ?? 'Có lỗi xảy ra, vui lòng kiểm tra lại thông tin.' });
        return;
      }
      trackQuoteSubmitted({ itemCount: ready.length, totalVnd: totals?.totalVnd ?? 0 });
      setDone({ requestNumber: String(body.requestNumber) });
      setSubmit({ status: 'idle' });
    } catch (error) {
      setSubmit({ status: 'error', message: error instanceof Error && error.message ? error.message : 'Không thể kết nối máy chủ, vui lòng thử lại.' });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <EstimatePrintSheet lines={printLines} totals={totals} vat={vat} requestNumber={done?.requestNumber ?? null} />

      <ol aria-label="Các bước báo giá" className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 print:hidden">
        {['Tải mẫu', 'Cấu hình', 'Báo giá & liên hệ', 'Xác nhận'].map((label, index) => (
          <li key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${step === index + 1 ? 'border-primary bg-primary/5 font-semibold text-foreground' : step > index + 1 ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' : 'border-border text-muted-foreground'}`}>
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold">{step > index + 1 ? <Check className="size-3" /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {done ? (
        <section className="rounded-xl border border-border bg-card p-8 text-center shadow-xs print:hidden" aria-live="polite">
          <p className="font-heading text-xl font-bold text-foreground">Đã nhận yêu cầu {done.requestNumber}</p>
          <p className="mt-2 text-sm text-muted-foreground">Xưởng sẽ gửi báo giá chính thức cho từng món qua Zalo/SĐT {BAO_GIA_RESPONSE_TIME_TEXT}. Bạn có thể nhắn mã này qua Zalo để được hỗ trợ nhanh hơn.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <StorefrontButton variant="secondary" onClick={() => { void navigator.clipboard?.writeText(done.requestNumber); setCopied(true); }}>
              <span className="inline-flex items-center gap-2"><Copy className="size-4" />{copied ? 'Đã sao chép' : 'Sao chép mã'}</span>
            </StorefrontButton>
            <a href={SITE_CONFIG.zaloUrl} target="_blank" rel="noreferrer" onClick={() => trackContactClick('zalo', 'bao-gia')} className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Mở Zalo</a>
            <StorefrontButton variant="secondary" onClick={() => window.print()}><span className="inline-flex items-center gap-2"><Printer className="size-4" />In bảng ước tính</span></StorefrontButton>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] print:hidden">
          <div className="flex flex-col gap-4">
            <div
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files); }}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}
            >
              <Upload className="size-6 text-muted-foreground" />
              <p className="text-sm text-foreground">Kéo thả 1–{BAO_GIA_MAX_ITEMS} file <strong>.stl / .obj</strong> vào đây</p>
              <p className="text-xs text-muted-foreground">Phân tích ngay trên máy bạn — chưa tải lên cho tới khi bạn gửi yêu cầu · tối đa {formatUploadLimitMb()}/file</p>
              <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
                Chọn file từ máy
                <input data-testid="bao-gia-file-input" type="file" multiple accept=".stl,.obj" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} />
              </label>
              <p className="text-xs text-muted-foreground">Có file .3mf? <NextLink href="/custom-print" className="font-medium text-primary hover:underline">Gửi ở trang Đặt in theo yêu cầu</NextLink> để có giá theo file đã slice.</p>
            </div>
            {notice ? <p role="alert" className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-300"><AlertCircle className="size-4 shrink-0" />{notice}</p> : null}
            {!materials.length ? <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">Hiện chưa thể hiển thị giá tự động. Bạn vẫn gửi yêu cầu được, xưởng báo giá {BAO_GIA_RESPONSE_TIME_TEXT}.</p> : null}

            {previewItem ? (
              <section aria-label="Xem trước mô hình" data-testid="bao-gia-preview" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-heading text-base font-bold text-foreground">Xem trước mô hình</p>
                  <p className="max-w-full truncate text-xs text-muted-foreground">{ready.indexOf(previewItem) + 1}/{ready.length} · {previewItem.name} · tỉ lệ {previewItem.scalePct}%</p>
                </div>
                {previewItem.positions ? (
                  <MeshViewer key={previewItem.id} positions={previewItem.positions} label={previewItem.name} scalePct={previewItem.scalePct} onScaleChange={(pct) => update(previewItem.id, { scalePct: clampScalePct(pct) })} />
                ) : (
                  <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">File rất chi tiết (trên 1,5 triệu tam giác) nên không dựng 3D để tránh treo máy — kích thước và giá vẫn tính bình thường.</p>
                )}
                {ready.length > 1 ? <p className="text-xs text-muted-foreground">Bấm “Xem” ở từng món để đổi mô hình đang xem.</p> : null}
              </section>
            ) : null}

            {items.map((item, index) => {
              const line = lineFor(item.id);
              const size = item.metrics ? { x: Math.round(item.metrics.sizeMm.x * item.scalePct) / 100, y: Math.round(item.metrics.sizeMm.y * item.scalePct) / 100, z: Math.round(item.metrics.sizeMm.z * item.scalePct) / 100 } : null;
              return (
                <article key={item.id} data-testid="bao-gia-item" className={`flex flex-col gap-3 rounded-xl border bg-card p-4 ${previewItem?.id === item.id ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground"><Box className="mr-1 inline size-4" />{index + 1}. {item.name}</p>
                      {item.analysis === 'pending' ? <p className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Đang phân tích hình khối…</p> : null}
                      {item.analysis === 'error' ? <p role="alert" className="text-xs text-destructive">{item.error ?? 'Không đọc được file này.'}</p> : null}
                      {size ? <p className="text-xs text-muted-foreground">Kích thước: {fmtSize(size)} · {item.metrics!.triangles.toLocaleString('vi-VN')} tam giác</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {item.analysis === 'ok' ? (
                        <button type="button" onClick={() => setSelectedId(item.id)} aria-pressed={previewItem?.id === item.id} className={`cursor-pointer rounded-lg px-2 py-1 text-xs ${previewItem?.id === item.id ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted'}`} aria-label="Xem 3D"><Eye className="mr-1 inline size-4" />Xem</button>
                      ) : null}
                      <button type="button" onClick={() => remove(item.id)} className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Bỏ file"><Trash2 className="size-4" /></button>
                    </div>
                  </div>

                  {item.analysis === 'ok' ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <label className="col-span-2 flex flex-col gap-1 text-xs font-medium sm:col-span-1">Vật liệu
                        <select value={item.materialType} onChange={(event) => update(item.id, { materialType: event.target.value })} className={inputClass} disabled={!materials.length}>
                          {(materials.length ? materials : ['PLA']).map((m) => <option key={m} value={m}>{MATERIAL_LABEL[m] ?? m}</option>)}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium">Độ đặc (infill)
                        <select value={item.infillPct} onChange={(event) => update(item.id, { infillPct: Number(event.target.value) })} className={inputClass}>
                          {INFILL_OPTIONS.map((pct) => <option key={pct} value={pct}>{pct}%</option>)}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium">Tỉ lệ (%)
                        <input type="number" min={10} max={1000} step={0.1} value={item.scalePct} onChange={(event) => update(item.id, { scalePct: clampScalePct(Number(event.target.value) || 100) })} className={inputClass} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium">Số lượng
                        <input type="number" min={1} max={1000} value={item.quantity} onChange={(event) => update(item.id, { quantity: Math.min(1000, Math.max(1, Math.floor(Number(event.target.value)) || 1)) })} className={inputClass} />
                      </label>
                      <label className="col-span-2 flex flex-col gap-1 text-xs font-medium sm:col-span-1">Màu (ghi chú)
                        <input value={item.color} maxLength={100} placeholder="VD: đen nhám" onChange={(event) => update(item.id, { color: event.target.value })} className={inputClass} />
                      </label>
                    </div>
                  ) : null}

                  {item.analysis === 'ok' ? (
                    <div data-testid="bao-gia-item-price" className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      {!line ? <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" />Đang tính giá…</span> : null}
                      {line?.status === 'OK' ? (
                        <>
                          <span className="text-xs text-muted-foreground">~{line.grams}g · ~{fmtHours(line.printMinutes)} · đơn giá ~{formatVnd(line.unitPriceVnd)}</span>
                          <span className="font-heading text-lg font-bold text-foreground" title={PRICE_NOTE}>~{formatVnd(line.lineSubtotalVnd)}</span>
                          {line.floorApplied ? <span className="w-full text-xs text-muted-foreground">Áp giá tối thiểu cho mỗi món ({formatVnd(MIN_ITEM_PRICE_VND)}).</span> : null}
                        </>
                      ) : null}
                      {line?.status === 'UNPRICED' ? <span className="text-muted-foreground">{UNPRICED_TEXT[line.reason] ?? 'Cần xưởng báo giá'}</span> : null}
                      {line?.status === 'NO_MATERIAL_PRICE' ? <span className="text-muted-foreground">Chưa có giá tự động cho vật liệu này — xưởng sẽ báo giá.</span> : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            <section aria-label="Tóm tắt báo giá" className="rounded-xl border border-border bg-card p-4">
              <p className="font-heading text-lg font-bold">Tạm tính</p>
              {estimate.status === 'error' ? <p role="alert" className="mt-2 text-xs text-destructive">Chưa tính được giá, vui lòng thử lại.</p> : null}
              {estimate.data?.reason === 'NO_PRICING_CONFIG' ? <p className="mt-2 text-sm text-muted-foreground">Hiện chưa có giá tự động — xưởng sẽ báo giá {BAO_GIA_RESPONSE_TIME_TEXT}.</p> : null}
              {totals ? (
                <dl className="mt-2 flex flex-col gap-1 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">{totals.pricedItems}/{ready.length} món có giá</dt><dd>~{formatVnd(totals.subtotalVnd)}</dd></div>
                  {vat?.enabled ? <div className="flex justify-between"><dt className="text-muted-foreground">VAT {vat.rateBps / 100}%</dt><dd>~{formatVnd(totals.vatVnd)}</dd></div> : null}
                  <div className="flex justify-between border-t border-border pt-1 text-base font-bold"><dt>Tổng ước tính</dt><dd data-testid="bao-gia-total">~{formatVnd(totals.totalVnd)}</dd></div>
                </dl>
              ) : !items.length ? <p className="mt-2 text-sm text-muted-foreground">Thêm file để xem giá.</p> : null}
              <p className="mt-3 text-xs text-muted-foreground">{PRICE_NOTE}</p>
              {totals ? (
                <StorefrontButton variant="secondary" className="mt-3 w-full" onClick={() => window.print()}>
                  <span className="inline-flex items-center gap-2"><Printer className="size-4" />In bảng ước tính</span>
                </StorefrontButton>
              ) : null}
            </section>

            {ready.length ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <p className="font-heading text-lg font-bold">Gửi yêu cầu cho xưởng</p>
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <label htmlFor="bg-company-website">Company website</label>
                  <input id="bg-company-website" name="company-website" type="text" tabIndex={-1} autoComplete="off" />
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium">Họ tên *<input name="customerName" required maxLength={200} className={inputClass} /></label>
                <label className="flex flex-col gap-1 text-xs font-medium">SĐT / Zalo *<input name="customerPhone" required maxLength={30} className={inputClass} /></label>
                <label className="flex flex-col gap-1 text-xs font-medium">Email (không bắt buộc)<input name="customerEmail" type="email" maxLength={320} className={inputClass} /></label>
                <label className="flex flex-col gap-1 text-xs font-medium">Ghi chú / địa chỉ nhận hàng<textarea name="note" rows={2} maxLength={2000} className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" /></label>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" required checked={copyrightConfirmed} onChange={(event) => setCopyrightConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0" />
                  <span>Tôi cam kết có quyền sử dụng hợp pháp các file này và đồng ý với <NextLink href="/file-confidentiality-policy" target="_blank" className="font-medium text-primary hover:underline">Chính sách bảo mật file thiết kế</NextLink>.</span>
                </label>
                {submit.status === 'error' ? <p role="alert" className="text-xs text-destructive">{submit.message}</p> : null}
                <StorefrontButton type="submit" variant="accent" disabled={!copyrightConfirmed || submit.status === 'uploading' || submit.status === 'submitting' || items.some((item) => item.analysis === 'pending')}>
                  {submit.status === 'uploading' ? submit.progress : submit.status === 'submitting' ? 'Đang gửi yêu cầu…' : submit.status === 'error' ? 'Thử lại' : 'Gửi yêu cầu báo giá'}
                </StorefrontButton>
                <p className="text-xs text-muted-foreground">Không cần đặt cọc. Xưởng gửi báo giá chính thức cho từng món {BAO_GIA_RESPONSE_TIME_TEXT}.</p>
              </form>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}

/** Scale is stored as permille on the server (1 decimal of %), 10–1000%. */
function clampScalePct(value: number): number {
  return Math.min(1000, Math.max(10, Math.round(value * 10) / 10));
}
