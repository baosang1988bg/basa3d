'use client';

import { useEffect, useRef, useState, type FormEvent, type ClipboardEvent, type DragEvent, type ChangeEvent } from 'react';
import NextLink from 'next/link';
import { StorefrontButton } from '@/components/storefront/button';
import { formatVnd } from '@/components/storefront/format';
import { Upload, Link as LinkIcon, X, Image as ImageIcon, File as FileIcon, Loader2, AlertCircle, PackageCheck, Wrench, Printer, ChevronDown } from 'lucide-react';
import { trackCustomPrintQuote, trackFileUpload } from '@/lib/analytics';
import { CURRENT_TOS_VERSION } from '@/lib/copyright/tos-version';
import type { PublicFileEstimate } from '@/services/file-estimate.service';
import type { InstantOptionKey } from '@/services/instant-estimate.service';

type SubmitState = { status: 'idle' | 'submitting' | 'success' | 'error'; message?: string };
type UploadState = { status: 'idle' | 'uploading' | 'done' | 'error'; fileName?: string; message?: string };
type EstimateState = { status: 'idle' | 'loading' | 'done' | 'error'; result?: PublicFileEstimate; message?: string };

// Kept in sync with CONTENT_TYPE_BY_EXTENSION in custom-request.service.ts — this is only a
// client-side UX check, the server re-validates and is the actual authority.
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'stl', 'step', 'stp', 'obj', '3mf']);
const PRICEABLE_EXTENSIONS = new Set(['3mf', 'stl', 'obj']);
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const RESPONSE_TIME_TEXT = 'trong 2 giờ làm việc';

const OPTION_LABEL: Record<InstantOptionKey, string> = {
  ASSEMBLED: 'Bản ráp sẵn hoàn thiện',
  KIT: 'Bản kit tự ráp',
  STANDARD: 'Giá in',
};

const STATUS_TEXT: Record<Exclude<PublicFileEstimate['status'], 'OK'>, string> = {
  NOT_SLICED: 'File .3mf này chưa được slice nên chưa có thời gian in. Mở bằng Bambu Studio/Orca → Slice → "Export plate sliced file" rồi tải lên lại — hoặc gửi yêu cầu để xưởng báo giá.',
  UNSUPPORTED: `Loại file/vật liệu này cần xưởng xem trực tiếp. Gửi yêu cầu, BaSa3D báo giá ${RESPONSE_TIME_TEXT}.`,
  UNREADABLE: 'Chưa đọc được hình khối trong file này. Bạn vẫn gửi yêu cầu được, xưởng sẽ kiểm tra và báo giá.',
  NO_PRICING_CONFIG: `Hiện chưa thể hiển thị giá tự động. Gửi yêu cầu, BaSa3D báo giá ${RESPONSE_TIME_TEXT}.`,
  NO_MATERIAL_PRICE: 'Chưa có giá tự động cho vật liệu này. Gửi yêu cầu để xưởng báo giá.',
};

export type CustomRequestPrefill = {
  attachmentPath: string;
  attachmentFileName: string;
  requestedMaterial: string;
  requestedColor: string;
  description: string;
};

const inputClass = 'h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';

/**
 * Quote-first custom print form (ADR-0034): 1) upload a file + pick material → instant price for
 * sliced .3mf (exact) or .stl/.obj (range); 2) only if the customer wants to go ahead, show the contact
 * form. The browser never sends a price — the server recomputes it from the stored file at submit.
 */
export function CustomRequestForm({ prefill }: { prefill?: CustomRequestPrefill }) {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [attachmentPath, setAttachmentPath] = useState(prefill?.attachmentPath ?? '');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState>(prefill
    ? { status: 'done', fileName: prefill.attachmentFileName }
    : { status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(false);
  const [material, setMaterial] = useState(prefill?.requestedMaterial ?? '');
  const [quantity, setQuantity] = useState(1);
  const [estimate, setEstimate] = useState<EstimateState>({ status: 'idle' });
  const [selectedOption, setSelectedOption] = useState<InstantOptionKey | null>(null);
  // Tool-generated designs (prefill) already have a price on the tool page — go straight to contact.
  const [showContact, setShowContact] = useState(Boolean(prefill));
  const inflight = useRef<AbortController | null>(null);

  const extension = (upload.fileName ?? attachmentPath).toLowerCase().split('.').pop() ?? '';
  // Tool-generated designs (prefill) are priced on the tool page itself — don't show a second number.
  const canPrice = !prefill && Boolean(attachmentPath) && PRICEABLE_EXTENSIONS.has(extension);

  // Re-price whenever the uploaded file or the chosen material changes.
  useEffect(() => {
    if (!canPrice) {
      setEstimate({ status: 'idle' });
      return;
    }
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setEstimate({ status: 'loading' });
    (async () => {
      try {
        const response = await fetch('/api/public/file-estimate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ attachmentPath, materialType: material || null }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setEstimate({ status: 'error', message: data?.message ?? 'Chưa tính được giá cho file này.' });
          return;
        }
        const result = data as PublicFileEstimate;
        setEstimate({ status: 'done', result });
        const firstPriced = result.estimate?.options.find((o) => o.priceVnd !== null || o.minVnd !== undefined);
        setSelectedOption(firstPriced?.key ?? null);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setEstimate({ status: 'error', message: 'Không kết nối được máy chủ để tính giá.' });
      }
    })();
    return () => controller.abort();
  }, [attachmentPath, material, canPrice]);

  async function handleFile(file: File) {
    const fileExtension = file.name.toLowerCase().split('.').pop() ?? '';
    if (!ALLOWED_EXTENSIONS.has(fileExtension)) {
      alert('Chỉ chấp nhận ảnh (JPG, PNG, WEBP) hoặc file thiết kế 3D (.stl, .step, .stp, .obj, .3mf).');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert('Dung lượng file tối đa là 20MB.');
      return;
    }

    setUpload({ status: 'uploading', fileName: file.name });
    setImagePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    setAttachmentPath('');

    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/public/custom-requests/attachments', { method: 'POST', body });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        setUpload({ status: 'error', message: errorBody?.message ?? 'Tải file lên thất bại, vui lòng thử lại.' });
        setImagePreview(null);
        return;
      }
      const { path } = (await response.json()) as { path: string };
      setAttachmentPath(path);
      setUpload({ status: 'done', fileName: file.name });
      trackFileUpload({ name: file.name, extension: fileExtension, sizeMb: Number((file.size / (1024 * 1024)).toFixed(2)) });
    } catch {
      setUpload({ status: 'error', message: 'Không thể kết nối máy chủ, vui lòng thử lại.' });
      setImagePreview(null);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          event.preventDefault();
          void handleFile(file);
          break;
        }
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) void handleFile(event.dataTransfer.files[0]);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files[0]) void handleFile(event.target.files[0]);
  }

  function handleClearFile() {
    inflight.current?.abort();
    setImagePreview(null);
    setAttachmentPath('');
    setUpload({ status: 'idle' });
    setEstimate({ status: 'idle' });
    setSelectedOption(null);
  }

  const isUploading = upload.status === 'uploading';
  const result = estimate.status === 'done' ? estimate.result : undefined;
  const priced = result?.status === 'OK' ? result.estimate : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading || !copyrightConfirmed) return;
    const formElement = event.currentTarget;
    setState({ status: 'submitting' });
    const form = new FormData(formElement);
    const typedDescription = String(form.get('description') ?? '').trim();
    const description = typedDescription || (upload.fileName ? `Yêu cầu in từ file ${upload.fileName}` : '');
    if (!description) {
      setState({ status: 'error', message: 'Vui lòng mô tả yêu cầu hoặc tải file thiết kế lên.' });
      return;
    }
    const payload = {
      customerName: String(form.get('customerName') ?? ''),
      customerPhone: String(form.get('customerPhone') ?? ''),
      customerEmail: form.get('customerEmail') ? String(form.get('customerEmail')) : null,
      requestedMaterial: material || null,
      requestedColor: form.get('requestedColor') ? String(form.get('requestedColor')) : null,
      quantity: Math.max(1, quantity),
      attachmentPath: attachmentPath.trim() !== '' ? attachmentPath.trim() : null,
      description,
      honeypot: String(form.get('company-website') ?? ''),
      copyrightConfirmed: true as const,
      tosVersion: CURRENT_TOS_VERSION,
      ...(priced && selectedOption ? { fileEstimateOption: selectedOption } : {}),
    };

    try {
      const response = await fetch('/api/public/custom-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 429) {
        const body = await response.json();
        setState({ status: 'error', message: body.message ?? 'Bạn đã gửi yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút.' });
        return;
      }
      if (!response.ok) {
        setState({ status: 'error', message: 'Có lỗi xảy ra, vui lòng kiểm tra lại thông tin.' });
        return;
      }
      trackCustomPrintQuote({ material: payload.requestedMaterial, color: payload.requestedColor, quantity: payload.quantity, hasAttachment: payload.attachmentPath !== null });
      setState({ status: 'success' });
    } catch {
      setState({ status: 'error', message: 'Không thể kết nối máy chủ, vui lòng thử lại.' });
    }
  }

  if (state.status === 'success') {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-xs">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-heading text-xl font-bold text-foreground">Đã gửi yêu cầu thành công!</p>
        <p className="mt-2 text-sm text-muted-foreground">BaSa3D sẽ liên hệ qua Zalo/SĐT {RESPONSE_TIME_TEXT} để xác nhận và báo giá chính thức.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-xs">
      {/* Honeypot: visually hidden from real users */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="company-website">Company website</label>
        <input id="company-website" name="company-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Step 1 — file + material → instant price */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-heading text-lg font-bold text-foreground">1. Tải file lên để xem giá ngay</p>
          <span className="text-xs text-muted-foreground">.3mf đã slice cho giá chính xác nhất · .stl/.obj cho khoảng giá</span>
        </div>

        {upload.status === 'uploading' ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            <span className="text-sm text-muted-foreground">Đang tải lên {upload.fileName}...</span>
          </div>
        ) : upload.status === 'done' && attachmentPath ? (
          <div className="relative flex items-center gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 dark:bg-emerald-950/20">
            <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
              {imagePreview ? (
                // eslint-disable-next-html-element-suppression
                <img src={imagePreview} alt="Ảnh mẫu đã chọn" className="size-full object-cover" />
              ) : (
                <FileIcon className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-1 flex-col">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <ImageIcon className="size-3.5" /> Đã tải lên: {upload.fileName}
              </span>
              <span className="text-xs text-muted-foreground">File được lưu riêng tư; chỉ nhân viên xử lý yêu cầu có thể mở.</span>
            </div>
            <button type="button" onClick={handleClearFile} aria-label="Bỏ file" className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div
            onPaste={handlePaste}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-5 transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}
          >
            {upload.status === 'error' && upload.message ? <p className="text-xs font-medium text-destructive">{upload.message}</p> : null}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LinkIcon className="size-4 shrink-0" />
              Kéo thả file .3mf/.stl/.obj/.step hoặc ảnh mẫu vào đây (có thể Ctrl+V dán ảnh).
            </div>
            <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><Upload className="size-3.5" /><span>Tối đa 20MB</span></div>
              <label className="cursor-pointer font-medium text-primary hover:underline">
                Chọn file từ máy
                <input type="file" accept="image/*,.stl,.step,.stp,.obj,.3mf" onChange={handleFileInputChange} className="hidden" />
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="requestedMaterial" className="text-sm font-semibold text-foreground">Vật liệu</label>
            <select id="requestedMaterial" value={material} onChange={(e) => setMaterial(e.target.value)} className={`${inputClass} cursor-pointer`}>
              <option value="">Chưa chắc chắn (tính theo PLA)</option>
              <option value="PLA">PLA (Tiêu chuẩn, đẹp, dễ dùng)</option>
              <option value="PETG">PETG (Bền cơ học, chịu nhiệt nhẹ)</option>
              <option value="ABS">ABS/ASA (Chịu lực & chịu nhiệt cao)</option>
              <option value="TPU">TPU (Vật liệu dẻo/cao su)</option>
              <option value="RESIN">Resin (Độ nét cực cao cho mô hình)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quantity" className="text-sm font-semibold text-foreground">Số lượng</label>
            <input id="quantity" type="number" min={1} max={10000} value={quantity} onChange={(e) => setQuantity(Math.min(10000, Math.max(1, parseInt(e.target.value) || 1)))} className={inputClass} />
          </div>
        </div>

        {/* Instant price */}
        {estimate.status === 'loading' ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tính giá từ file…
          </div>
        ) : null}
        {estimate.status === 'error' ? (
          <div role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="size-4 shrink-0" />{estimate.message}</div>
        ) : null}
        {attachmentPath && !canPrice && upload.status === 'done' ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground"><AlertCircle className="mt-0.5 size-4 shrink-0" />{STATUS_TEXT.UNSUPPORTED}</div>
        ) : null}
        {result && result.status !== 'OK' ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground"><AlertCircle className="mt-0.5 size-4 shrink-0" />{STATUS_TEXT[result.status]}</div>
        ) : null}
        {priced ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {priced.specs.printMinutes !== null ? <span className="rounded-md bg-muted px-2.5 py-1 font-medium">~{Math.round((priced.specs.printMinutes / 60) * 10) / 10} giờ in</span> : null}
              {priced.specs.netWeightGrams !== null ? <span className="rounded-md bg-muted px-2.5 py-1 font-medium">~{priced.specs.netWeightGrams}g {priced.materialType}</span> : null}
              {priced.specs.platesCount ? <span className="rounded-md bg-muted px-2.5 py-1 font-medium">{priced.specs.platesCount} plate</span> : null}
              {priced.specs.sizeMm ? <span className="rounded-md bg-muted px-2.5 py-1 font-medium">{priced.specs.sizeMm.x}×{priced.specs.sizeMm.y}×{priced.specs.sizeMm.z} mm</span> : null}
            </div>
            <div className={`grid grid-cols-1 gap-3 ${priced.options.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {priced.options.map((option) => {
                const isSelected = selectedOption === option.key;
                const Icon = option.key === 'ASSEMBLED' ? PackageCheck : option.key === 'KIT' ? Wrench : Printer;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedOption(option.key)}
                    aria-pressed={isSelected}
                    className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-background hover:border-primary/50'}`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary"><Icon className="size-4" />{OPTION_LABEL[option.key]}</span>
                    <span className="font-heading text-2xl font-extrabold text-foreground">
                      {option.priceVnd !== null
                        ? `~${formatVnd(option.priceVnd)}`
                        : option.minVnd !== undefined ? `${formatVnd(option.minVnd)} – ${formatVnd(option.maxVnd ?? option.minVnd)}` : 'Xưởng sẽ báo giá'}
                    </span>
                    {quantity > 1 ? <span className="text-xs text-muted-foreground">Giá cho 1 sản phẩm.</span> : null}
                  </button>
                );
              })}
            </div>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-300">
              {priced.kind === 'SLICED'
                ? 'Giá ước tính từ thời gian in và số gram trong file đã slice, làm tròn 5.000đ. Giá chính thức do BaSa3D xác nhận khi kiểm tra file.'
                : 'Khoảng giá sơ bộ từ thể tích mô hình (chưa biết độ đặc/infill). Gửi file .3mf đã slice để có giá chính xác hơn; giá chính thức do BaSa3D xác nhận.'}
            </p>
          </div>
        ) : null}

        {!showContact ? (
          <div className="flex flex-col items-start gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => setShowContact(true)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline-offset-2 hover:underline">
              Không có file? Gửi mô tả ý tưởng để xưởng tư vấn
            </button>
            <StorefrontButton type="button" variant="accent" onClick={() => setShowContact(true)} disabled={isUploading || estimate.status === 'loading'} className="w-full sm:w-auto">
              <span className="inline-flex items-center gap-2">{priced ? 'Ưng giá — đặt in mẫu này' : 'Gửi yêu cầu báo giá'}<ChevronDown className="size-4" /></span>
            </StorefrontButton>
          </div>
        ) : null}
      </div>

      {/* Step 2 — contact details, only once the customer wants to go ahead */}
      {showContact ? (
        <div className="grid grid-cols-1 gap-5 border-t border-border pt-6 md:grid-cols-2">
          <p className="font-heading text-lg font-bold text-foreground md:col-span-2">2. Thông tin liên hệ để xưởng xác nhận</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerName" className="text-sm font-semibold text-foreground">Họ tên *</label>
            <input id="customerName" name="customerName" required maxLength={200} placeholder="Ví dụ: Nguyễn Văn A" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerPhone" className="text-sm font-semibold text-foreground">SĐT / Zalo liên hệ *</label>
            <input id="customerPhone" name="customerPhone" required maxLength={30} placeholder="098xxxxxxx" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerEmail" className="text-sm font-semibold text-foreground">Email (không bắt buộc)</label>
            <input id="customerEmail" name="customerEmail" type="email" maxLength={320} placeholder="name@example.com" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="requestedColor" className="text-sm font-semibold text-foreground">Màu sắc yêu cầu</label>
            <input id="requestedColor" name="requestedColor" defaultValue={prefill?.requestedColor} maxLength={100} placeholder="Ví dụ: Đen nhám, Trắng, Đỏ..." className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="description" className="text-sm font-semibold text-foreground">Ghi chú & kích thước mong muốn {attachmentPath ? '(tuỳ chọn)' : '*'}</label>
            <textarea
              id="description"
              name="description"
              required={!attachmentPath}
              maxLength={20000}
              rows={3}
              defaultValue={prefill?.description}
              placeholder="Công dụng, kích thước (dài x rộng x cao mm), tỉ lệ scale, lưu ý đặc biệt..."
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          {state.status === 'error' && <p role="alert" className="text-sm font-medium text-destructive md:col-span-2">{state.message}</p>}

          <div className="flex items-start gap-2 md:col-span-2">
            <input id="copyrightConfirmed" type="checkbox" required checked={copyrightConfirmed} onChange={(event) => setCopyrightConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0" />
            <label htmlFor="copyrightConfirmed" className="cursor-pointer text-xs text-muted-foreground">
              Tôi cam kết có quyền sử dụng hợp pháp file/mô tả này và đồng ý với{' '}
              <NextLink href="/file-confidentiality-policy" target="_blank" className="font-medium text-primary hover:underline">Chính sách bảo mật file thiết kế</NextLink>.
            </label>
          </div>

          <div className="pt-2 md:col-span-2">
            <StorefrontButton type="submit" variant="accent" disabled={state.status === 'submitting' || isUploading || !copyrightConfirmed} className="w-full sm:w-auto">
              {isUploading ? 'Đang tải file lên...' : state.status === 'submitting' ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu đặt in 3D'}
            </StorefrontButton>
          </div>
        </div>
      ) : null}
    </form>
  );
}
