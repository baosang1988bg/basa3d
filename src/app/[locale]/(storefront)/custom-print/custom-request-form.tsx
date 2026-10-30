'use client';

import { useEffect, useRef, useState, type FormEvent, type ClipboardEvent, type DragEvent, type ChangeEvent } from 'react';
import NextLink from 'next/link';
import { StorefrontButton } from '@/components/storefront/button';
import { formatVnd } from '@/components/storefront/format';
import { Upload, Link as LinkIcon, X, Image as ImageIcon, File as FileIcon, Loader2, AlertCircle, PackageCheck, Wrench, Printer, ChevronDown, Check, Copy, MessageCircle } from 'lucide-react';
import { trackCustomPrintQuote, trackFileUpload, trackContactClick } from '@/lib/analytics';
import { SITE_CONFIG } from '@/config/site';
import { CURRENT_TOS_VERSION } from '@/lib/copyright/tos-version';
import type { PublicFileEstimate } from '@/services/file-estimate.service';
import type { InstantOptionKey } from '@/services/instant-estimate.service';
import { MAX_UPLOAD_BYTES, UPLOAD_EXTENSIONS, formatUploadLimitMb } from '@/config/uploads';
import { uploadCustomRequestFile } from '@/lib/uploads/upload-custom-request-file';
import { DEFAULT_PRINTER_TARGET_ID, type PrinterProfileId } from '@/lib/pricing/printer-profiles';
import { contactFromFormData } from '@/lib/customer/saved-contact';
import { useContactFormPrefill, useSavedContact } from '@/lib/customer/use-saved-contact';
import { RememberContactOption } from '@/components/storefront/remember-contact-option';

type SubmitState = { status: 'idle' | 'submitting' | 'success' | 'error'; message?: string; requestNumber?: string };
type UploadState = { status: 'idle' | 'uploading' | 'done' | 'error'; fileName?: string; message?: string };
type EstimateState = { status: 'idle' | 'loading' | 'done' | 'error'; result?: PublicFileEstimate; message?: string };

// Client-side UX check only (shared config with the server) — upload-urls, the bucket limits and
// inspectUploadedObject at submit are the actual authority.
const ALLOWED_EXTENSIONS = new Set<string>(UPLOAD_EXTENSIONS);
const PRICEABLE_EXTENSIONS = new Set(['3mf', 'stl', 'obj']);
const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_BYTES;
const RESPONSE_TIME_TEXT = 'trong 2 giờ làm việc';
/** Keycap / figurine-sized parts: several fit one plate, so batching saves heating + prime tower time. */
const SMALL_PART_MAX_MM = 40;

const PRINTER_CHOICES: { id: PrinterProfileId; label: string }[] = [
  { id: 'SNAPMAKER_U1', label: 'Snapmaker U1 (4 đầu in - Tối ưu chi phí & không xả thải nhựa)' },
  { id: 'BAMBU_P2S', label: 'Bambu Lab AMS (Dòng máy phổ thông)' },
];

const OPTION_LABEL: Record<InstantOptionKey, string> = {
  ASSEMBLED: 'Bản ráp sẵn hoàn thiện',
  KIT: 'Bản kit tự ráp',
  STANDARD: 'Giá in',
};

const STATUS_TEXT: Record<Exclude<PublicFileEstimate['status'], 'OK'>, string> = {
  NOT_SLICED: `Chưa đọc được thời gian in từ file .3mf này. Bạn chỉ cần bấm "Gửi yêu cầu", BaSa3D báo giá chính xác ${RESPONSE_TIME_TEXT}.`,
  UNSUPPORTED: `Loại file/vật liệu này cần xưởng xem trực tiếp. Gửi yêu cầu, BaSa3D báo giá ${RESPONSE_TIME_TEXT}.`,
  UNREADABLE: 'Chưa đọc được hình khối trong file này. Bạn vẫn gửi yêu cầu được, xưởng sẽ kiểm tra và báo giá.',
  NO_PRICING_CONFIG: `Hiện chưa thể hiển thị giá tự động. Gửi yêu cầu, BaSa3D báo giá ${RESPONSE_TIME_TEXT}.`,
  NO_MATERIAL_PRICE: 'Chưa có giá tự động cho vật liệu này. Gửi yêu cầu để xưởng báo giá.',
  TOO_LARGE: `File khá lớn nên chưa tính giá tự động được. Gửi yêu cầu, BaSa3D báo giá ${RESPONSE_TIME_TEXT}.`,
};

export type CustomRequestPrefill = {
  attachmentPath: string;
  uploadClaim: string;
  attachmentFileName: string;
  requestedMaterial: string;
  requestedColor: string;
  description: string;
};

/** Phase 40: the "slice it yourself" how-to is hidden behind a toggle — most customers don't run a
 * slicer and shouldn't feel they must; the default path is "gửi yêu cầu, xưởng báo giá". */
function BambuSliceHelp() {
  return (
    <details className="group rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Bạn dùng Bambu Studio? Xem cách lấy giá chính xác ngay
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Mở file <code>.3mf</code> bằng Bambu Studio.</li>
        <li>Góc trên bên trái: chọn máy <strong>Bambu Lab P2S</strong> và loại nhựa cho từng màu.</li>
        <li>Bấm <strong>Slice plate</strong> (góc trên bên phải), đợi tính xong.</li>
        <li>Vào <strong>File → Export → Export plate sliced file</strong> — phần mềm lưu ra file <code>….gcode.3mf</code>.</li>
        <li>Tải <strong>file vừa xuất</strong> lên ô phía trên (thay file cũ) — giá sẽ tính theo đúng thời gian in và lượng nhựa.</li>
      </ol>
    </details>
  );
}

/** 125 → "2,1" (Vietnamese decimal comma), used for the machine-time range. */
function formatHours(minutes: number): string {
  return (Math.round((minutes / 60) * 10) / 10).toLocaleString('vi-VN');
}

const inputClass = 'h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';

/**
 * Quote-first custom print form (ADR-0034): 1) upload a file + pick material → instant price for
 * sliced .3mf (exact) or .stl/.obj (range); 2) only if the customer wants to go ahead, show the contact
 * form. The browser never sends a price — the server recomputes it from the stored file at submit.
 */
export function CustomRequestForm({ prefill }: { prefill?: CustomRequestPrefill }) {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);
  const [attachmentPath, setAttachmentPath] = useState(prefill?.attachmentPath ?? '');
  const [uploadClaim, setUploadClaim] = useState(prefill?.uploadClaim ?? '');
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
  const [printerTarget, setPrinterTarget] = useState<PrinterProfileId>(DEFAULT_PRINTER_TARGET_ID);
  // Tool-generated designs (prefill) already have a price on the tool page — go straight to contact.
  const [showContact, setShowContact] = useState(Boolean(prefill));
  const savedContact = useSavedContact();
  const prefillFormRef = useContactFormPrefill(savedContact.contact, showContact);
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
          body: JSON.stringify({ attachmentPath, uploadClaim, materialType: material || null, printerTarget }),
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
  }, [attachmentPath, uploadClaim, material, printerTarget, canPrice]);

  async function handleFile(file: File) {
    const fileExtension = file.name.toLowerCase().split('.').pop() ?? '';
    if (!ALLOWED_EXTENSIONS.has(fileExtension)) {
      alert('Chỉ chấp nhận ảnh (JPG, PNG, WEBP) hoặc file thiết kế 3D (.stl, .step, .stp, .obj, .3mf).');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`Dung lượng file tối đa là ${formatUploadLimitMb()}.`);
      return;
    }

    setUpload({ status: 'uploading', fileName: file.name });
    setImagePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    setAttachmentPath('');
    setUploadClaim('');

    try {
      // Phase 33 S2: signed URL → straight to Storage (files over Vercel's 4.5MB limit work).
      const { path, uploadClaim: claim } = await uploadCustomRequestFile(file, file.name);
      setAttachmentPath(path);
      setUploadClaim(claim);
      setUpload({ status: 'done', fileName: file.name });
      trackFileUpload({ name: file.name, extension: fileExtension, sizeMb: Number((file.size / (1024 * 1024)).toFixed(2)) });
    } catch (error) {
      setUpload({ status: 'error', message: error instanceof Error && error.message ? error.message : 'Không thể kết nối máy chủ, vui lòng thử lại.' });
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
    setUploadClaim('');
    setUpload({ status: 'idle' });
    setEstimate({ status: 'idle' });
    setSelectedOption(null);
  }

  const isUploading = upload.status === 'uploading';
  const result = estimate.status === 'done' ? estimate.result : undefined;
  const priced = result?.status === 'OK' ? result.estimate : null;
  // Phase 40: multi-color unsliced .3mf is priced as 1 color (purge shown separately, not priced).
  const singleColorBasis = priced?.kind === 'MESH' && priced.specs.priceBasis === 'SINGLE_COLOR';

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
      uploadClaim: uploadClaim.trim() !== '' ? uploadClaim.trim() : null,
      description,
      honeypot: String(form.get('company-website') ?? ''),
      copyrightConfirmed: true as const,
      tosVersion: CURRENT_TOS_VERSION,
      ...(priced && selectedOption ? { fileEstimateOption: selectedOption, printerTarget } : {}),
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
        // Phase 33 S2: the server re-checks the uploaded object (exists, size, magic bytes) — say so
        // instead of a generic error, so the customer knows to re-upload the file.
        const body = await response.json().catch(() => null);
        const fileProblem = typeof body?.code === 'string' && ['ATTACHMENT_NOT_FOUND', 'ATTACHMENT_CONTENT_MISMATCH', 'EMPTY_FILE', 'FILE_TOO_LARGE'].includes(body.code);
        setState({ status: 'error', message: fileProblem && body.message ? body.message : 'Có lỗi xảy ra, vui lòng kiểm tra lại thông tin.' });
        return;
      }
      const resData = await response.json().catch(() => null);
      savedContact.saveAfterSubmit(contactFromFormData(form));
      trackCustomPrintQuote({ material: payload.requestedMaterial, color: payload.requestedColor, quantity: payload.quantity, hasAttachment: payload.attachmentPath !== null });
      setState({ status: 'success', requestNumber: typeof resData?.requestNumber === 'string' ? resData.requestNumber : undefined });
    } catch {
      setState({ status: 'error', message: 'Không thể kết nối máy chủ, vui lòng thử lại.' });
    }
  }

  if (state.status === 'success') {
    const requestNum = state.requestNumber;
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-xs">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-heading text-xl font-bold text-foreground">
          Đã gửi yêu cầu thành công{requestNum ? ` (${requestNum})` : ''}!
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          BaSa3D sẽ liên hệ qua Zalo/SĐT {RESPONSE_TIME_TEXT} để xác nhận và báo giá chính thức.
        </p>

        {copied && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" /> Đã sao chép tin nhắn kèm mã yêu cầu! Bạn chỉ cần dán (Paste) vào Zalo.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {requestNum && (
            <StorefrontButton
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(requestNum);
                setCopied(true);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Copy className="size-4" />
                {copied ? 'Đã sao chép mã' : 'Sao chép mã yêu cầu'}
              </span>
            </StorefrontButton>
          )}
          <a
            href={SITE_CONFIG.zaloUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              trackContactClick('zalo', 'custom_print_success');
              const zaloMsg = requestNum
                ? `Chào BaSa3D, mình vừa gửi yêu cầu đặt in 3D mã ${requestNum} trên website, nhờ xưởng kiểm tra file và báo giá giúp mình nhé!`
                : 'Chào BaSa3D, mình vừa gửi yêu cầu in 3D trên website, nhờ shop kiểm tra và báo giá giúp mình nhé!';
              void navigator.clipboard?.writeText(zaloMsg);
              setCopied(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0068FF] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <MessageCircle className="size-4" />
            Nhắn Zalo với shop ngay ({SITE_CONFIG.zaloPhone})
          </a>
        </div>
      </div>
    );
  }

  return (
    <form ref={prefillFormRef} onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-xs">
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
              <div className="flex items-center gap-1.5"><Upload className="size-3.5" /><span>Tối đa {formatUploadLimitMb()}</span></div>
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
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quantity" className="text-sm font-semibold text-foreground">Số lượng</label>
            <input id="quantity" type="number" min={1} max={10000} value={quantity} onChange={(e) => setQuantity(Math.min(10000, Math.max(1, parseInt(e.target.value) || 1)))} className={inputClass} />
          </div>
        </div>

        {canPrice ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-semibold text-foreground">Máy in</legend>
            {PRINTER_CHOICES.map((choice) => (
              <label
                key={choice.id}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${printerTarget === choice.id ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <input type="radio" name="printerTarget" value={choice.id} checked={printerTarget === choice.id} onChange={() => setPrinterTarget(choice.id)} className="mt-0.5 size-4" />
                <span className="text-foreground">
                  {choice.label}
                  {choice.id === DEFAULT_PRINTER_TARGET_ID ? <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Khuyên dùng</span> : null}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

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
        {result?.status === 'NOT_SLICED' ? <BambuSliceHelp /> : null}
        {priced ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {priced.specs.printMinutes !== null ? <span className="rounded-md bg-muted px-2.5 py-1 font-medium">~{Math.round((priced.specs.printMinutes / 60) * 10) / 10} giờ in</span> : null}
              {priced.specs.netWeightGrams !== null ? <span className="rounded-md bg-muted px-2.5 py-1 font-medium">~{priced.specs.netWeightGrams}g {priced.materialType}</span> : null}
              {priced.specs.platesCount ? <span className="rounded-md bg-muted px-2.5 py-1 font-medium">{priced.specs.platesCount} plate</span> : null}
              {priced.specs.sizeMm ? <span className="rounded-md bg-muted px-2.5 py-1 font-medium">{priced.specs.sizeMm.x}×{priced.specs.sizeMm.y}×{priced.specs.sizeMm.z} mm</span> : null}
              {priced.specs.colors?.length ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-medium">
                  <span className="flex -space-x-1" aria-hidden="true">
                    {priced.specs.colors.map((color, index) => <span key={`${color}-${index}`} className="size-3 rounded-full border border-border" style={{ backgroundColor: color }} />)}
                  </span>
                  {priced.specs.colors.length} màu
                </span>
              ) : null}
              {priced.specs.printerTarget ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 font-medium">
                  {priced.specs.printerTarget}
                </span>
              ) : null}
            </div>
            {priced.specs.sizeMm && Math.max(priced.specs.sizeMm.x, priced.specs.sizeMm.y, priced.specs.sizeMm.z) <= SMALL_PART_MAX_MM ? (
              <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                Tiết kiệm tới 40% chi phí khi in từ 2 sản phẩm trở lên trên cùng 1 mẻ in.
              </p>
            ) : null}
            {/* Phase 40: what the estimate is made of — quantities only, never internal costs/margin (B1). */}
            {priced.kind === 'MESH' && priced.specs.modelGrams ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-lg border border-border bg-muted/20 p-3 text-xs sm:grid-cols-2">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Nhựa cho mô hình</dt><dd className="font-medium text-foreground">~{priced.specs.modelGrams.min}–{priced.specs.modelGrams.max} g {priced.materialType}</dd></div>
                {priced.specs.purgeGrams ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{priced.specs.printerType === 'TOOL_CHANGER' ? 'Tháp mồi (Tool Changer)' : 'Nhựa xả khi đổi màu'}</dt>
                    <dd className="font-medium text-foreground">
                      ~{priced.specs.purgeGrams} g · ~{priced.specs.colorChanges} lần đổi màu
                      {priced.specs.printerType === 'TOOL_CHANGER' ? ' · không xả thải' : ''}
                      {priced.specs.priceBasis === 'SINGLE_COLOR' ? ' (chưa tính vào giá)' : ''}
                    </dd>
                  </div>
                ) : null}
                {priced.specs.printMinutesRange ? (
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Thời gian máy chạy</dt><dd className="font-medium text-foreground">~{formatHours(priced.specs.printMinutesRange.min)}–{formatHours(priced.specs.printMinutesRange.max)} giờ</dd></div>
                ) : null}
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Độ đặc giả định</dt><dd className="font-medium text-foreground">in thưa → in đặc</dd></div>
              </dl>
            ) : null}
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
                        : option.minVnd !== undefined
                          ? singleColorBasis
                            // Multi-color, unsliced: a FLOOR, not a quote — say so in the number itself.
                            ? `Từ ~${formatVnd(option.minVnd)}`
                            // One price when both ends round to the same number (was "30.000đ – 30.000đ").
                            : (option.maxVnd ?? option.minVnd) === option.minVnd ? `~${formatVnd(option.minVnd)}` : `${formatVnd(option.minVnd)} – ${formatVnd(option.maxVnd ?? option.minVnd)}`
                          : 'Xưởng sẽ báo giá'}
                    </span>
                    {quantity > 1 ? <span className="text-xs text-muted-foreground">Giá cho 1 sản phẩm.</span> : null}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Đã gồm:</span> nhựa{priced.specs.purgeGrams && !singleColorBasis ? ' (kể cả nhựa xả đổi màu)' : ''}, điện, khấu hao máy, dự phòng in lỗi, thao tác &amp; đóng gói.{' '}
              <span className="font-semibold text-foreground">Chưa gồm:</span> phí ship, hậu kỳ/sơn, chỉnh sửa thiết kế.
            </p>
            {singleColorBasis ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-300">
                Giá này tính như in <strong>1 màu</strong>. Mẫu của bạn dùng <strong>{priced.specs.colors?.length ?? 2} màu</strong>
                {priced.specs.colors?.length ? (
                  <span className="mx-1 inline-flex -space-x-1 align-middle" aria-hidden="true">
                    {priced.specs.colors.map((color, index) => <span key={`${color}-${index}`} className="size-3 rounded-full border border-border" style={{ backgroundColor: color }} />)}
                  </span>
                ) : ' '}
                nên máy cần đổi màu khoảng <strong>{priced.specs.colorChanges} lần</strong> (thêm khoảng <strong>{priced.specs.purgeGrams}g nhựa</strong> và <strong>{formatHours(priced.specs.colorChangeMinutes ?? 0)} giờ máy</strong>) — phần này chưa có trong giá trên.{' '}
                <strong>Xưởng sẽ báo giá chính xác {RESPONSE_TIME_TEXT}</strong>, bạn chỉ cần bấm &quot;Gửi yêu cầu&quot;.
              </p>
            ) : null}
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-300">
              {priced.kind === 'SLICED'
                ? 'Giá ước tính từ thời gian in và số gram trong file đã slice, làm tròn 5.000đ. Giá chính thức do BaSa3D xác nhận khi kiểm tra file.'
                : `Giá sơ bộ tính từ kích thước mô hình (chưa biết độ đặc khi in). BaSa3D báo giá chính xác ${RESPONSE_TIME_TEXT} sau khi bạn gửi yêu cầu.`}
            </p>
            {result?.hint === 'SLICE_FOR_EXACT' ? <BambuSliceHelp /> : null}
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
            <input id="customerName" name="customerName" autoComplete="name" required maxLength={200} placeholder="Ví dụ: Nguyễn Văn A" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerPhone" className="text-sm font-semibold text-foreground">SĐT / Zalo liên hệ *</label>
            <input id="customerPhone" name="customerPhone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} placeholder="098xxxxxxx" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerEmail" className="text-sm font-semibold text-foreground">Email (không bắt buộc)</label>
            <input id="customerEmail" name="customerEmail" type="email" autoComplete="email" maxLength={320} placeholder="name@example.com" className={inputClass} />
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

          <RememberContactOption
            className="md:col-span-2"
            remember={savedContact.remember}
            onRememberChange={savedContact.setRemember}
            hasSaved={savedContact.contact !== null}
            onClear={savedContact.clear}
          />
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
