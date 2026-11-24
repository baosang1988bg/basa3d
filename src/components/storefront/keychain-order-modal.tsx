'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Weight,
  Sparkles,
  Tag,
  MessageCircle,
  Copy,
  Check,
  QrCode,
  Info,
  PhoneCall,
  FileBox,
} from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { trackContactClick } from '@/lib/analytics';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
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
  price,
  colorDescription,
}: KeychainOrderModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [requestedColor, setRequestedColor] = useState(colorDescription);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Sync color description when opened
  useEffect(() => {
    if (isOpen) {
      setRequestedColor(colorDescription);
      setCopied(false);
    }
  }, [isOpen, colorDescription]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const weightGrams = model ? estimateMeshWeightGrams(calculateMeshVolumeCm3(model.mergedGeometry)) : 0;
  const printMinutes = model ? estimatePrintMinutes(weightGrams) : 0;

  const unitMinPrice = price?.minPriceVnd ?? 25_000;
  const unitMaxPrice = price?.maxPriceVnd ?? 40_000;
  const totalMinPrice = unitMinPrice * Math.max(1, quantity);
  const totalMaxPrice = unitMaxPrice * Math.max(1, quantity);

  const dimensionText = model
    ? `${model.widthMm.toFixed(1)} × ${model.heightMm.toFixed(1)} × ${(baseThicknessMm + textThicknessMm).toFixed(1)} mm`
    : 'Chưa rõ';

  // Live generated Zalo message
  const generatedMessage = useMemo(() => {
    const lines: string[] = [
      'Chào BaSa3D, mình muốn đặt in móc khoá thiết kế này:',
      '📌 Nguồn: Công cụ tạo móc khoá 3D BaSa3D',
      `🧩 Chữ in: "${text.trim() || 'Tùy chỉnh'}"`,
      `• Kích thước: ${dimensionText}`,
      `• Khoen móc: ${includeKeyringHole ? `Có lỗ khoen (Ø${keyringHoleDiameterMm.toFixed(1)}mm)` : 'Không có lỗ khoen (bảng tên)'}`,
      `• Màu sắc thiết kế: ${colorDescription}`,
    ];

    if (requestedColor.trim() && requestedColor.trim() !== colorDescription) {
      lines.push(`• Màu khách yêu cầu thêm: ${requestedColor.trim()}`);
    }

    lines.push(`• Khối lượng: ~${weightGrams}g · Thời gian in: ~${printMinutes} phút`);
    lines.push(`• Số lượng: ${Math.max(1, quantity)} chiếc`);
    lines.push(`💰 Giá tham khảo trên web: ~${totalMinPrice.toLocaleString('vi-VN')}đ – ${totalMaxPrice.toLocaleString('vi-VN')}đ (~${unitMinPrice.toLocaleString('vi-VN')}đ – ${unitMaxPrice.toLocaleString('vi-VN')}đ/chiếc)`);

    if (typeof window !== 'undefined' && window.location.href) {
      lines.push(`🔗 Link công cụ: ${window.location.href}`);
    }

    if (note.trim()) {
      lines.push(`📝 Ghi chú: ${note.trim()}`);
    }

    return lines.join('\n');
  }, [
    text,
    dimensionText,
    includeKeyringHole,
    keyringHoleDiameterMm,
    colorDescription,
    requestedColor,
    weightGrams,
    printMinutes,
    quantity,
    totalMinPrice,
    totalMaxPrice,
    unitMinPrice,
    unitMaxPrice,
    note,
  ]);

  if (!isOpen || !model) return null;

  async function copyToClipboard(str: string): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(str);
        return true;
      }
    } catch {
      // Fallback
    }
    return false;
  }

  async function handleCopyOnly() {
    trackContactClick('zalo', `keychain_copy_text:${text}`);
    const success = await copyToClipboard(generatedMessage);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    }
  }

  async function handleOpenZalo() {
    trackContactClick('zalo', `keychain_open_zalo:${text}`);
    await copyToClipboard(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 6000);
    if (typeof window !== 'undefined') {
      window.open(SITE_CONFIG.zaloUrl, '_blank', 'noopener,noreferrer');
    }
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    SITE_CONFIG.zaloUrl
  )}`;

  const inputClass =
    'h-9 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#0068FF]/10 text-[#0068FF]">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">
                Đặt xưởng BaSa3D in móc khoá
              </h3>
              <p className="text-xs text-muted-foreground">
                Báo giá xưởng theo mẫu thiết kế — Kết nối trực tiếp qua Zalo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-5 py-5 sm:px-6 space-y-4">
          {/* Keychain Specs Snapshot Card */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-16 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-border font-heading font-black text-lg">
                <Tag className="size-8 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Công cụ tạo móc khoá 3D</span>
                  <span>• BaSa3D Studio</span>
                </div>
                <h4 className="font-heading font-bold text-base text-foreground truncate">
                  Móc khoá chữ &quot;{text.trim() || 'Tùy chỉnh'}&quot;
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Màu sắc: <strong className="text-foreground">{colorDescription}</strong>
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-2.5 text-xs text-muted-foreground sm:grid-cols-4">
              <div className="flex items-center gap-1.5">
                <FileBox className="size-3.5 text-primary shrink-0" />
                <span className="truncate">{dimensionText}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Weight className="size-3.5 text-primary shrink-0" />
                <span>~{weightGrams}g</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary shrink-0" />
                <span>~{printMinutes} phút</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>{includeKeyringHole ? 'Có lỗ khoen' : 'Bảng tên'}</span>
              </div>
            </div>
          </div>

          {/* Customizable Print Options (NO customer PII) */}
          <div className="space-y-3 rounded-xl border border-border/80 bg-background p-3.5 sm:p-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>Tuỳ chỉnh thông số in</span>
              <span className="text-[11px] font-normal lowercase text-muted-foreground">
                (tự động cập nhật vào tin nhắn Zalo)
              </span>
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <label htmlFor="keychainRequestedColor" className="text-xs font-semibold text-foreground">
                  Yêu cầu màu sắc tuỳ chọn
                </label>
                <input
                  id="keychainRequestedColor"
                  type="text"
                  maxLength={100}
                  placeholder="Ví dụ: Đổi chữ sang màu vàng gold..."
                  value={requestedColor}
                  onChange={(e) => setRequestedColor(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label htmlFor="keychainOrderNote" className="text-xs font-semibold text-foreground">
                Ghi chú thêm cho xưởng (tuỳ chọn)
              </label>
              <input
                id="keychainOrderNote"
                maxLength={300}
                placeholder="Ví dụ: Giao kèm 2 khoen tròn kim loại, cần lấy gấp..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Price Callout Banner */}
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span>Giá in xưởng ước tính:</span>
                <p className="text-[11px] font-normal text-muted-foreground">
                  Gồm vật liệu PLA 2 màu, điện, khấu hao và khoen móc
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                ~{totalMinPrice.toLocaleString('vi-VN')}đ – {totalMaxPrice.toLocaleString('vi-VN')}đ
              </span>
              {quantity > 1 ? (
                <span className="block text-[10px] text-muted-foreground">
                  (~{unitMinPrice.toLocaleString('vi-VN')}đ – {unitMaxPrice.toLocaleString('vi-VN')}đ/chiếc × {quantity})
                </span>
              ) : null}
            </div>
          </div>

          {/* Live Message Preview Box */}
          <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MessageCircle className="size-3.5 text-[#0068FF]" />
                Đoạn tin nhắn mẫu gửi Zalo (tự động cập nhật):
              </span>
              <button
                type="button"
                onClick={handleCopyOnly}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-xs hover:bg-muted transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Đã copy!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3 text-muted-foreground" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background/80 p-2.5 font-mono text-[11px] text-muted-foreground leading-relaxed border border-border/50 select-all">
              {generatedMessage}
            </pre>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Info className="size-3.5 text-primary shrink-0" />
              <span>
                Không cần điền form hay để lại thông tin cá nhân trên web. Khi bấm nút, nội dung trên sẽ được sao chép sẵn để bạn gửi vào Zalo.
              </span>
            </div>
          </div>

          {/* Feedback Banner when Copied */}
          {copied ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-150">
              <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Đã sao chép tin nhắn vào bộ nhớ tạm!</strong> Khi Zalo mở lên, bạn chỉ cần bấm <strong>Dán (Paste)</strong> vào đoạn chat để gửi xưởng.
              </span>
            </div>
          ) : null}

          {/* Desktop QR Modal / Dropdown Toggle */}
          {showQr ? (
            <div className="rounded-xl border border-border bg-card p-4 text-center space-y-2 animate-in fade-in zoom-in-95 duration-150">
              <p className="text-xs font-semibold text-foreground">
                Quét mã QR bằng ứng dụng Zalo trên điện thoại:
              </p>
              <div className="mx-auto size-40 rounded-lg border border-border bg-white p-2 flex items-center justify-center">
                <img
                  src={qrImageUrl}
                  alt="Mã QR Zalo BaSa3D"
                  className="size-full object-contain"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Số Zalo / Hotline:{' '}
                <strong className="text-foreground font-mono">{SITE_CONFIG.zaloPhone}</strong>
              </p>
            </div>
          ) : null}
        </div>

        {/* Actions Footer */}
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:px-6 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer text-xs"
              >
                <QrCode className="size-3.5" />
                <span>{showQr ? 'Ẩn mã QR' : 'Hiện mã QR Zalo'}</span>
              </button>
              <span className="text-border">•</span>
              <a
                href={`tel:${SITE_CONFIG.zaloPhone.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
              >
                <PhoneCall className="size-3.5" />
                <span>{SITE_CONFIG.zaloPhone}</span>
              </a>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleCopyOnly}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                <Copy className="size-3.5" />
                <span>{copied ? 'Đã copy' : 'Sao chép tin nhắn'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenZalo}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0068FF] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#0057d9] transition cursor-pointer"
              >
                <MessageCircle className="size-4" />
                <span>Mở Zalo đặt in ngay</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
