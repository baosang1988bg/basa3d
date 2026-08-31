'use client';

import { useState, type FormEvent, type ClipboardEvent, type DragEvent, type ChangeEvent } from 'react';
import { StorefrontButton } from '@/components/storefront/button';
import { Upload, Link as LinkIcon, X, Image as ImageIcon } from 'lucide-react';

type SubmitState = { status: 'idle' | 'submitting' | 'success' | 'error'; message?: string };

export function CustomRequestForm() {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa là 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      // Set the data URL as the attachment value
      setAttachmentUrl(result);
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          event.preventDefault();
          handleImageFile(file);
          break;
        }
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleImageFile(event.dataTransfer.files[0]);
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files[0]) {
      handleImageFile(event.target.files[0]);
    }
  }

  function handleClearImage() {
    setImagePreview(null);
    setAttachmentUrl('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      {/* Attachment area: Link or Ctrl+V Image Paste or File Dropzone */}
      <div className="flex flex-col gap-2 md:col-span-2">
        <div className="flex items-center justify-between">
          <label htmlFor="attachmentUrl" className="text-sm font-semibold text-foreground">File đính kèm / Ảnh mẫu</label>
          <span className="text-xs text-muted-foreground">Có thể <strong>Ctrl+V dán ảnh</strong> hoặc kéo thả ảnh trực tiếp</span>
        </div>

        {imagePreview ? (
          <div className="relative flex items-center gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 dark:bg-emerald-950/20">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-background">
              {/* eslint-disable-next-html-element-suppression */}
              <img src={imagePreview} alt="Ảnh mẫu đã dán" className="size-full object-cover" />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <ImageIcon className="size-3.5" /> Đã dán ảnh mẫu thành công!
              </span>
              <span className="text-xs text-muted-foreground">Ảnh sẽ được gửi đính kèm cùng yêu cầu đặt in của bạn.</span>
            </div>
            <button type="button" onClick={handleClearImage} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
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
                <span>Kéo thả tệp ảnh vào đây hoặc nhấp chọn ảnh:</span>
              </div>
              <label className="cursor-pointer font-medium text-primary hover:underline">
                Chọn ảnh từ máy
                <input type="file" accept="image/*" onChange={handleFileInputChange} className="hidden" />
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
        <StorefrontButton type="submit" variant="accent" disabled={state.status === 'submitting'} className="w-full sm:w-auto">
          {state.status === 'submitting' ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu đặt in 3D'}
        </StorefrontButton>
      </div>
    </form>
  );
}
