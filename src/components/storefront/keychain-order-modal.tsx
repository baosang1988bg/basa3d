'use client';

import { useState, useEffect, type FormEvent } from 'react';
import {
  X,
  Printer,
  Clock,
  Weight,
  CheckCircle2,
  Loader2,
  FileBox,
  AlertCircle,
  Tag,
  MessageCircle,
} from 'lucide-react';
import { CURRENT_TOS_VERSION } from '@/lib/copyright/tos-version';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { uploadCustomRequestFile } from '@/lib/uploads/upload-custom-request-file';
import { trackKeychainExportToRequest } from '@/lib/analytics';
import { SITE_CONFIG } from '@/config/site';
import type { KeychainModel } from '@/lib/keychain/keychain-engine';

export interface KeychainOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  model: KeychainModel | null;
  baseThicknessMm: number;
  textThicknessMm: number;
  includeKeyringHole: boolean;
  keyringHoleDiameterMm: number;
  baseColor: string;
  textColor: string;
  price: { minPriceVnd: number; maxPriceVnd: number } | null;
  makeStl: () => Blob;
  colorDescription: string;
  safeFileName: string;
}

export function KeychainOrderModal({
  isOpen,
  onClose,
  text,
  model,
  baseThicknessMm,
  textThicknessMm,
  includeKeyringHole,
  keyringHoleDiameterMm,
  baseColor,
  textColor,
  price,
  makeStl,
  colorDescription,
  safeFileName,
}: KeychainOrderModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [requestedColor, setRequestedColor] = useState(colorDescription);
  const [note, setNote] = useState('');
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(true);

  const [status, setStatus] = useState<'idle' | 'uploading_file' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [requestNumber, setRequestNumber] = useState('');

  // Sync color description when opened
  useEffect(() => {
    if (isOpen) {
      setRequestedColor(colorDescription);
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen, colorDescription]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'submitting' && status !== 'uploading_file') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, status]);

  if (!isOpen || !model) return null;

  const weightGrams = estimateMeshWeightGrams(calculateMeshVolumeCm3(model.mergedGeometry));
  const printMinutes = estimatePrintMinutes(weightGrams);

  const unitMinPrice = price?.minPriceVnd ?? 35_000;
  const unitMaxPrice = price?.maxPriceVnd ?? 55_000;
  const totalMinPrice = unitMinPrice * Math.max(1, quantity);
  const totalMaxPrice = unitMaxPrice * Math.max(1, quantity);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!model) return;

    if (!customerName.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setErrorMessage('Vui lòng nhập số điện thoại hoặc Zalo hợp lệ (từ 9 số trở lên).');
      return;
    }

    if (!copyrightConfirmed) {
      setErrorMessage('Vui lòng đồng ý với điều khoản gửi yêu cầu in.');
      return;
    }

    try {
      setStatus('uploading_file');
      setErrorMessage('');

      // Step 1: Upload generated STL to storage
      const blob = makeStl();
      const { path, uploadClaim } = await uploadCustomRequestFile(blob, safeFileName);

      setStatus('submitting');

      const description = [
        `[Công cụ tạo mẫu] Móc khoá khắc tên: "${text.trim()}"`,
        `Kích thước mẫu: ${model.widthMm.toFixed(1)} × ${model.heightMm.toFixed(1)} × ${(baseThicknessMm + textThicknessMm).toFixed(1)} mm`,
        `Khoen móc khoá: ${includeKeyringHole ? `Có lỗ khoen (đường kính Ø${keyringHoleDiameterMm.toFixed(1)} mm)` : 'Không có lỗ khoen (bảng tên)'}`,
        `Màu sắc thiết kế: ${colorDescription}`,
        requestedColor.trim() && requestedColor.trim() !== colorDescription ? `Yêu cầu màu tuỳ chọn: ${requestedColor.trim()}` : null,
        `Khối lượng ước tính: ~${weightGrams}g · Thời gian in: ~${printMinutes} phút`,
        `Ước tính xưởng: ${unitMinPrice.toLocaleString('vi-VN')}đ – ${unitMaxPrice.toLocaleString('vi-VN')}đ/chiếc (Tổng: ~${totalMinPrice.toLocaleString('vi-VN')}đ – ${totalMaxPrice.toLocaleString('vi-VN')}đ)`,
        note.trim() ? `Ghi chú khách hàng: ${note.trim()}` : null,
      ].filter(Boolean).join('\n');

      // Step 2: Submit custom request
      const response = await fetch('/api/public/custom-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || null,
          requestedMaterial: 'PLA',
          requestedColor: requestedColor.trim() || colorDescription,
          description,
          quantity: Math.max(1, quantity),
          attachmentPath: path,
          uploadClaim,
          copyrightConfirmed: true,
          tosVersion: CURRENT_TOS_VERSION,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data?.message || 'Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại.');
        return;
      }

      setStatus('success');
      setRequestNumber(data?.requestNumber || '');
      trackKeychainExportToRequest({ characterCount: text.trim().length, hasKeyringHole: includeKeyringHole });
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    }
  }

  const inputClass =
    'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';

  const zaloDirectLink = requestNumber
    ? `${SITE_CONFIG.zaloUrl}?text=${encodeURIComponent(`Chào BaSa3D, tôi vừa gửi yêu cầu in móc khoá mã ${requestNumber} (nội dung: ${text.trim()}). Xưởng báo giá giúp tôi nhé!`)}`
    : SITE_CONFIG.zaloUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'submitting' && status !== 'uploading_file') {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Printer className="size-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">
                Đặt xưởng BaSa3D in móc khoá
              </h3>
              <p className="text-xs text-muted-foreground">
                Tự động đính kèm file STL 3D và thông số thiết kế bạn vừa tạo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'submitting' || status === 'uploading_file'}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
          {status === 'success' ? (
            /* Success State */
            <div className="py-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-8" />
              </div>

              <div>
                <h4 className="font-heading text-2xl font-bold text-foreground">
                  Đã gửi yêu cầu in thành công!
                </h4>
                {requestNumber ? (
                  <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Mã yêu cầu: <span className="font-mono">{requestNumber}</span>
                  </p>
                ) : null}
              </div>

              <div className="mx-auto max-w-md rounded-xl border border-border bg-muted/40 p-4 text-left text-xs text-foreground space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nội dung chữ:</span>
                  <span className="font-bold text-right">{text.trim()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kích thước mẫu:</span>
                  <span className="font-medium">
                    {model.widthMm.toFixed(1)} × {model.heightMm.toFixed(1)} × {(baseThicknessMm + textThicknessMm).toFixed(1)} mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phối màu:</span>
                  <span className="font-medium text-right">{colorDescription}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File đính kèm:</span>
                  <span className="font-mono text-primary font-medium">{safeFileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Số lượng đặt:</span>
                  <span className="font-medium">{quantity} chiếc</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2 font-semibold">
                  <span>Ước tính tham khảo:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ~{totalMinPrice.toLocaleString('vi-VN')}đ – {totalMaxPrice.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              <p className="mx-auto max-w-md text-xs text-muted-foreground leading-relaxed">
                Kỹ thuật viên xưởng BaSa3D đã nhận file thiết kế 3D và sẽ liên hệ qua Zalo/SĐT{' '}
                <strong className="text-foreground">{customerPhone}</strong> để xác nhận số lượng, màu nhựa và giao hàng.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a
                  href={zaloDirectLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  <MessageCircle className="size-4" />
                  <span>Nhắn Zalo xác nhận ngay</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-border px-6 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          ) : (
            /* Order Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Snapshot of Customized Keychain */}
              <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <Tag className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                      <span>Móc khoá in 3D cá nhân hoá</span>
                    </div>
                    <h4 className="font-heading font-bold text-base text-foreground">
                      Khắc tên: &ldquo;{text.trim()}&rdquo;
                    </h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Kích thước: {model.widthMm.toFixed(1)} × {model.heightMm.toFixed(1)} × {(baseThicknessMm + textThicknessMm).toFixed(1)} mm
                      {includeKeyringHole ? ` · Lỗ khoen Ø${keyringHoleDiameterMm.toFixed(1)}mm` : ' · Không lỗ khoen'}
                    </p>
                  </div>
                </div>

                {/* Specs Badges */}
                <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-2.5 text-xs text-muted-foreground sm:grid-cols-3">
                  <div className="flex items-center gap-1.5">
                    <Weight className="size-3.5 text-primary shrink-0" />
                    <span>~{weightGrams}g nhựa PLA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-primary shrink-0" />
                    <span>In ~{printMinutes} phút</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileBox className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-mono text-[11px] truncate text-foreground">{safeFileName}</span>
                  </div>
                </div>

                {/* Color swatches */}
                <div className="flex items-center gap-2 border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
                  <span>Màu thiết kế:</span>
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span
                      className="size-3.5 rounded-full border border-border inline-block"
                      style={{ backgroundColor: baseColor }}
                      title={`Đế: ${baseColor}`}
                    />
                    <span>Đế</span>
                    <span>+</span>
                    <span
                      className="size-3.5 rounded-full border border-border inline-block"
                      style={{ backgroundColor: textColor }}
                      title={`Chữ: ${textColor}`}
                    />
                    <span>Chữ</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground ml-auto">({colorDescription})</span>
                </div>
              </div>

              {/* Pricing Estimate Box */}
              <div className="flex items-center justify-between rounded-xl bg-primary/10 p-3.5 border border-primary/20">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Giá in ước tính</p>
                  <p className="text-xs text-muted-foreground">Áp dụng cho nhựa PLA tiêu chuẩn</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-foreground">
                    {totalMinPrice.toLocaleString('vi-VN')}đ – {totalMaxPrice.toLocaleString('vi-VN')}đ
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    (~{unitMinPrice.toLocaleString('vi-VN')}đ – {unitMaxPrice.toLocaleString('vi-VN')}đ / chiếc)
                  </p>
                </div>
              </div>

              {/* Customer Inputs */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="keychainCustomerName" className="text-xs font-semibold text-foreground">
                      Họ và tên <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="keychainCustomerName"
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="keychainCustomerPhone" className="text-xs font-semibold text-foreground">
                      Số điện thoại / Zalo <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="keychainCustomerPhone"
                      type="tel"
                      required
                      placeholder="0912 345 678"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="keychainQuantity" className="text-xs font-semibold text-foreground">
                      Số lượng cần in
                    </label>
                    <input
                      id="keychainQuantity"
                      type="number"
                      min={1}
                      max={1000}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="keychainCustomerEmail" className="text-xs font-semibold text-foreground">
                      Email (tuỳ chọn)
                    </label>
                    <input
                      id="keychainCustomerEmail"
                      type="email"
                      placeholder="email@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="keychainRequestedColor" className="text-xs font-semibold text-foreground">
                    Màu sắc &amp; vật liệu yêu cầu
                  </label>
                  <input
                    id="keychainRequestedColor"
                    type="text"
                    placeholder="Đế đen, chữ vàng, kèm khoen tròn..."
                    value={requestedColor}
                    onChange={(e) => setRequestedColor(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="keychainOrderNote" className="text-xs font-semibold text-foreground">
                    Ghi chú thêm &amp; địa chỉ nhận hàng (tuỳ chọn)
                  </label>
                  <textarea
                    id="keychainOrderNote"
                    rows={2}
                    maxLength={1000}
                    placeholder="Địa chỉ giao hàng, thời gian cần lấy, yêu cầu in thêm mặt sau..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>

                {/* Terms confirmation */}
                <div className="flex items-start gap-2 pt-1">
                  <input
                    id="keychainCopyrightConfirmed"
                    type="checkbox"
                    required
                    checked={copyrightConfirmed}
                    onChange={(e) => setCopyrightConfirmed(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-input text-primary focus:ring-primary"
                  />
                  <label htmlFor="keychainCopyrightConfirmed" className="cursor-pointer text-xs text-muted-foreground leading-relaxed">
                    Tôi đồng ý gửi file 3D và thông tin liên hệ cho xưởng BaSa3D để nhận báo giá &amp; xác nhận đặt in.
                  </label>
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage ? (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {/* Actions Footer */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end border-t border-border pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={status === 'submitting' || status === 'uploading_file'}
                  className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
                >
                  Đóng
                </button>

                <button
                  type="submit"
                  disabled={status === 'submitting' || status === 'uploading_file' || !copyrightConfirmed}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer"
                >
                  {status === 'uploading_file' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Đang tải file STL lên xưởng...</span>
                    </>
                  ) : status === 'submitting' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Đang gửi yêu cầu...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="size-4" />
                      <span>
                        Gửi xưởng BaSa3D in ngay (~{totalMinPrice.toLocaleString('vi-VN')}đ)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
