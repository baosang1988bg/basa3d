'use client';

import { useState, type FormEvent, type ClipboardEvent, type DragEvent, type ChangeEvent } from 'react';
import { StorefrontButton } from '@/components/storefront/button';
import { Upload, Link as LinkIcon, X, Image as ImageIcon, File as FileIcon } from 'lucide-react';

type SubmitState = { status: 'idle' | 'submitting' | 'success' | 'error'; message?: string };
type UploadState = { status: 'idle' | 'uploading' | 'done' | 'error'; fileName?: string; message?: string };

// Kept in sync with CONTENT_TYPE_BY_EXTENSION in custom-request.service.ts — this is only a
// client-side UX check, the server re-validates and is the actual authority.
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'stl', 'step', 'stp', 'obj', '3mf']);
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export function CustomRequestForm() {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File) {
    const extension = file.name.toLowerCase().split('.').pop() ?? '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      alert('Chỉ chấp nhận ảnh (JPG, PNG, WEBP) hoặc file thiết kế 3D (.stl, .step, .stp, .obj, .3mf).');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert('Dung lượng file tối đa là 20MB.');
      return;
    }

    setUpload({ status: 'uploading', fileName: file.name });
    setImagePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);

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
      const { url } = (await response.json()) as { url: string };
      setAttachmentUrl(url);
      setUpload({ status: 'done', fileName: file.name });
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
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      void handleFile(event.dataTransfer.files[0]);
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files[0]) {
      void handleFile(event.target.files[0]);
    }
  }

  function handleClearImage() {
    setImagePreview(null);
    setAttachmentUrl('');
    setUpload({ status: 'idle' });
  }

  const isUploading = upload.status === 'uploading';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading) return;
    const formElement = event.currentTarget;
    setState({ status: 'submitting' });
    const form = new FormData(formElement);
    const payload = {
      customerName: String(form.get('customerName') ?? ''),
      customerPhone: String(form.get('customerPhone') ?? ''),
      customerEmail: form.get('customerEmail') ? String(form.get('customerEmail')) : null,
      requestedMaterial: form.get('requestedMaterial') ? String(form.get('requestedMaterial')) : null,
      requestedColor: form.get('requestedColor') ? String(form.get('requestedColor')) : null,
      quantity: Number(form.get('quantity') ?? 1),
      attachmentUrl: attachmentUrl.trim() !== '' ? attachmentUrl.trim() : null,
      description: String(form.get('description') ?? ''),
      honeypot: String(form.get('company-website') ?? ''),
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
      setState({ status: 'success' });
      formElement.reset();
      setImagePreview(null);
      setAttachmentUrl('');
      setUpload({ status: 'idle' });
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
        <p className="mt-2 text-sm text-muted-foreground">BaSa3D sẽ liên hệ với bạn qua Zalo/SĐT trong vòng 30 phút để tư vấn và báo giá chi tiết.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 rounded-xl border border-border bg-card p-6 shadow-xs md:grid-cols-2">
      {/* Honeypot: visually hidden from real users */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="company-website">Company website</label>
        <input id="company-website" name="company-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerName" className="text-sm font-semibold text-foreground">Họ tên *</label>
        <input id="customerName" name="customerName" required maxLength={200} placeholder="Ví dụ: Nguyễn Văn A" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerPhone" className="text-sm font-semibold text-foreground">SĐT / Zalo liên hệ *</label>
        <input id="customerPhone" name="customerPhone" required maxLength={30} placeholder="098xxxxxxx" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerEmail" className="text-sm font-semibold text-foreground">Email (không bắt buộc)</label>
        <input id="customerEmail" name="customerEmail" type="email" maxLength={320} placeholder="name@example.com" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="quantity" className="text-sm font-semibold text-foreground">Số lượng *</label>
        <input id="quantity" name="quantity" type="number" min={1} max={10000} required defaultValue={1} className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="requestedMaterial" className="text-sm font-semibold text-foreground">Vật liệu mong muốn</label>
        <select id="requestedMaterial" name="requestedMaterial" className="h-10 cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50">
          <option value="">Chưa chắc chắn / Tư vấn giúp tôi</option>
          <option value="PLA">PLA (Tiêu chuẩn, đẹp, dễ dùng)</option>
          <option value="PETG">PETG (Bền cơ học, chịu nhiệt nhẹ)</option>
          <option value="ABS">ABS/ASA (Chịu lực & chịu nhiệt cao)</option>
          <option value="TPU">TPU (Vật liệu dẻo/cao su)</option>
          <option value="RESIN">Resin (Độ nét cực cao cho mô hình)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="requestedColor" className="text-sm font-semibold text-foreground">Màu sắc yêu cầu</label>
        <input id="requestedColor" name="requestedColor" maxLength={100} placeholder="Ví dụ: Đen nhám, Trắng, Đỏ..." className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>

      {/* Attachment area: Link or Ctrl+V Image Paste or File Dropzone (ảnh + file thiết kế 3D) */}
      <div className="flex flex-col gap-2 md:col-span-2">
        <div className="flex items-center justify-between">
          <label htmlFor="attachmentUrl" className="text-sm font-semibold text-foreground">File đính kèm / Ảnh mẫu</label>
          <span className="text-xs text-muted-foreground">Có thể <strong>Ctrl+V dán ảnh</strong> hoặc kéo thả file trực tiếp</span>
        </div>

        {upload.status === 'uploading' ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            <span className="text-sm text-muted-foreground">Đang tải lên {upload.fileName}...</span>
          </div>
        ) : upload.status === 'done' && attachmentUrl ? (
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
                <ImageIcon className="size-3.5" /> Đã tải lên thành công: {upload.fileName}
              </span>
              <span className="text-xs text-muted-foreground">File sẽ được gửi đính kèm cùng yêu cầu đặt in của bạn.</span>
            </div>
            <button type="button" onClick={handleClearImage} className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div
            onPaste={handlePaste}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-4 transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
            }`}
          >
            {upload.status === 'error' && upload.message ? (
              <p className="text-xs font-medium text-destructive">{upload.message}</p>
            ) : null}
            <div className="flex items-center gap-2">
              <LinkIcon className="size-4 text-muted-foreground shrink-0" />
              <input
                id="attachmentUrl"
                name="attachmentUrl"
                type="text"
                maxLength={2000}
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="Dán link Google Drive, Dropbox, iCloud... hoặc link ảnh"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <Upload className="size-3.5" />
                <span>Kéo thả ảnh hoặc file .stl/.step/.obj/.3mf vào đây, hoặc:</span>
              </div>
              <label className="cursor-pointer font-medium text-primary hover:underline">
                Chọn file từ máy
                <input type="file" accept="image/*,.stl,.step,.stp,.obj,.3mf" onChange={handleFileInputChange} className="hidden" />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="description" className="text-sm font-semibold text-foreground">Ghi chú chi tiết & kích thước mong muốn *</label>
        <textarea
          id="description"
          name="description"
          required
          maxLength={20000}
          rows={4}
          placeholder="Mô tả công dụng, kích thước mong muốn (dài x rộng x cao mm), tỉ lệ scale, hoặc các lưu ý đặc biệt..."
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      {state.status === 'error' && <p className="text-sm font-medium text-destructive md:col-span-2">{state.message}</p>}

      <div className="md:col-span-2 pt-2">
        <StorefrontButton type="submit" variant="accent" disabled={state.status === 'submitting' || isUploading} className="w-full sm:w-auto">
          {isUploading ? 'Đang tải file lên...' : state.status === 'submitting' ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu đặt in 3D'}
        </StorefrontButton>
      </div>
    </form>
  );
}
