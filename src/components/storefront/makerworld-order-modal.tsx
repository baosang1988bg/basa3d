'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Weight,
  Layers,
  Sparkles,
  ExternalLink,
  PackageCheck,
  Wrench,
  MessageCircle,
  Copy,
  Check,
  QrCode,
  Info,
  PhoneCall,
} from 'lucide-react';
import { formatVnd } from '@/components/storefront/format';
import { SITE_CONFIG } from '@/config/site';
import { trackContactClick } from '@/lib/analytics';
import type { MakerWorldCnModelDetail, MakerWorldCnProfile } from '@/services/makerworld-cn-pricing.service';

function formatPrintTime(minutes: number): string {
  if (!minutes || minutes <= 0) return 'Chưa rõ';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h}h ${m}p`;
}

export interface MakerWorldOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: MakerWorldCnModelDetail;
  initialProfileId?: string | null;
  measuredDimensions?: Record<string, string>;
}

export function MakerWorldOrderModal({
  isOpen,
  onClose,
  detail,
  initialProfileId,
  measuredDimensions,
}: MakerWorldOrderModalProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    initialProfileId || detail.profiles[0]?.profileId || ''
  );

  const selectedProfile: MakerWorldCnProfile | null =
    detail.profiles.find((p) => p.profileId === selectedProfileId) ||
    detail.profiles[0] ||
    null;

  const [targetDimension, setTargetDimension] = useState('');
  const currentDim =
    measuredDimensions && selectedProfile ? (measuredDimensions[selectedProfile.profileId] || null) : null;
  const activeDimension = targetDimension.trim()
    ? targetDimension.trim()
    : currentDim || selectedProfile?.dimensionsMm || null;

  const isMultiPlate = (selectedProfile?.platesCount ?? 1) > 1;
  const [tier, setTier] = useState<'ASSEMBLED' | 'KIT'>('ASSEMBLED');

  const [requestedColor, setRequestedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Sync profile when initialProfileId changes
  useEffect(() => {
    if (initialProfileId) {
      setSelectedProfileId(initialProfileId);
    }
  }, [initialProfileId]);

  // Handle ESC key to close
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

  // Determine current unit price based on tier & profile
  const unitPrice = selectedProfile
    ? isMultiPlate && tier === 'KIT' && selectedProfile.priceTiers?.kitVnd
      ? selectedProfile.priceTiers.kitVnd
      : isMultiPlate && tier === 'ASSEMBLED' && selectedProfile.priceTiers?.assembledVnd
        ? selectedProfile.priceTiers.assembledVnd
        : selectedProfile.estimatedPriceVnd ?? 0
    : 0;

  const totalPrice = unitPrice * Math.max(1, quantity);

  // Build the live Zalo consultation / order text snippet
  const generatedMessage = useMemo(() => {
    const tierLabel = !isMultiPlate
      ? 'Bản in tiêu chuẩn (1 bàn)'
      : tier === 'ASSEMBLED'
        ? 'Ráp sẵn hoàn thiện'
        : 'Kit tự ráp (chi tiết rời)';

    const filamentList = selectedProfile && selectedProfile.filaments.length > 0
      ? selectedProfile.filaments.map((f) => `${f.name} (${f.type})`).join(', ')
      : 'Theo màu mặc định của file';

    const colorText = requestedColor.trim() ? requestedColor.trim() : filamentList;

    const lines: string[] = [
      'Chào BaSa3D, mình muốn đặt in mẫu MakerWorld này:',
      `📌 Nguồn: ${detail.isChinaModel ? 'MakerWorld CN' : 'MakerWorld'}`,
      `🧩 Mẫu: ${detail.title}`,
    ];

    if (selectedProfile) {
      lines.push(`• Bàn in (Profile): ${selectedProfile.title} (ID: ${selectedProfile.profileId})`);
      lines.push(
        `• Thông số file: ${formatPrintTime(selectedProfile.printTimeMinutes)} · ${
          selectedProfile.weightGrams ? `${selectedProfile.weightGrams}g` : 'Chưa rõ'
        } · ${selectedProfile.platesCount} bàn in`
      );
    }

    if (activeDimension) {
      lines.push(`• Kích thước: ${activeDimension}`);
    }

    lines.push(`• Số lượng: ${Math.max(1, quantity)} chiếc`);
    lines.push(`• Màu sắc mong muốn: ${colorText}`);

    if (isMultiPlate) {
      lines.push(`• Phương án: ${tierLabel}`);
    }

    if (unitPrice > 0) {
      lines.push(
        `💰 Giá ước tính trên web: ~${formatVnd(totalPrice)} (${formatVnd(unitPrice)}/chiếc)`
      );
    }

    if (detail.sourceUrl) {
      lines.push(`🔗 Link MakerWorld: ${detail.sourceUrl}`);
    }

    if (typeof window !== 'undefined' && window.location.href) {
      lines.push(`🔗 Xem lại cấu hình: ${window.location.href}`);
    }

    if (note.trim()) {
      lines.push(`📝 Ghi chú: ${note.trim()}`);
    }

    return lines.join('\n');
  }, [
    detail.isChinaModel,
    detail.title,
    detail.sourceUrl,
    selectedProfile,
    activeDimension,
    quantity,
    requestedColor,
    isMultiPlate,
    tier,
    unitPrice,
    totalPrice,
    note,
  ]);

  if (!isOpen) return null;

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback for older browsers / webview
    }
    return false;
  }

  async function handleCopyOnly() {
    trackContactClick('zalo', `makerworld_copy_text:${detail.title}`);
    const success = await copyToClipboard(generatedMessage);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    }
  }

  async function handleOpenZalo() {
    trackContactClick('zalo', `makerworld_open_zalo:${detail.title}`);
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
                Đặt xưởng BaSa3D in mẫu
              </h3>
              <p className="text-xs text-muted-foreground">
                Báo giá xưởng theo thông số profile — Trao đổi trực tiếp qua Zalo
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
          {/* Profile Snapshot Card */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
            <div className="flex items-start gap-3">
              {selectedProfile?.coverImageUrl || detail.coverImageUrl ? (
                <img
                  src={selectedProfile?.coverImageUrl || detail.coverImageUrl || ''}
                  alt={detail.title}
                  className="size-16 shrink-0 rounded-lg object-cover bg-muted border border-border"
                />
              ) : (
                <div className="size-16 shrink-0 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  3D Model
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{detail.isChinaModel ? '🇨🇳 MakerWorld CN' : '🌐 MakerWorld'}</span>
                  {detail.author ? <span>• Tác giả: {detail.author}</span> : null}
                </div>
                <h4 className="font-heading font-semibold text-sm line-clamp-1 text-foreground" title={detail.title}>
                  {detail.title}
                </h4>
                <a
                  href={detail.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <span>Xem link sản phẩm gốc</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            {/* Profile Selector if multiple */}
            {detail.profiles.length > 1 ? (
              <div className="space-y-1.5 border-t border-border/50 pt-2.5">
                <label htmlFor="order-profile-select" className="text-xs font-semibold text-foreground">
                  Chọn bàn in / Print Profile ({detail.profiles.length} bàn):
                </label>
                <select
                  id="order-profile-select"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {detail.profiles.map((p) => (
                    <option key={p.profileId} value={p.profileId}>
                      {p.title} — {formatPrintTime(p.printTimeMinutes)}
                      {p.estimatedPriceVnd ? ` (~${formatVnd(p.estimatedPriceVnd)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Selected Profile Specs Badges */}
            {selectedProfile ? (
              <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-2.5 text-xs text-muted-foreground sm:grid-cols-4">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary shrink-0" />
                  <span>{formatPrintTime(selectedProfile.printTimeMinutes)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Weight className="size-3.5 text-primary shrink-0" />
                  <span>{selectedProfile.weightGrams ? `${selectedProfile.weightGrams}g` : 'Chưa rõ'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary shrink-0" />
                  <span>{selectedProfile.platesCount} bàn in</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`size-2 rounded-full ${
                      selectedProfile.amsRequired ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span>{selectedProfile.amsRequired ? 'Cần AMS' : 'Không AMS'}</span>
                </div>
              </div>
            ) : null}

            {/* Filaments swatch preview */}
            {selectedProfile && selectedProfile.filaments.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <span>Màu theo file:</span>
                {selectedProfile.filaments.map((f, idx) => (
                  <span
                    key={idx}
                    className="inline-flex size-4 items-center justify-center rounded-full border border-border"
                    style={{ backgroundColor: f.colorHex }}
                    title={`${f.name} (${f.type})`}
                  />
                ))}
                <span className="text-[11px] text-muted-foreground/80">
                  ({selectedProfile.filaments.map((f) => f.name).join(', ')})
                </span>
              </div>
            ) : null}
          </div>

          {/* Tier Selection (if multi-plate) */}
          {isMultiPlate && selectedProfile?.priceTiers ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Chọn phương án hoàn thiện:
              </label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTier('ASSEMBLED')}
                  className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    tier === 'ASSEMBLED'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                      <PackageCheck className="size-4" />
                      Ráp sẵn hoàn thiện
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {selectedProfile.priceTiers.assembledVnd
                        ? `~${formatVnd(selectedProfile.priceTiers.assembledVnd)}`
                        : 'Theo xưởng'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Xưởng BaSa3D lắp ráp hoàn thiện, kiểm tra khớp nối trước khi giao.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTier('KIT')}
                  className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    tier === 'KIT'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                      <Wrench className="size-4" />
                      Kit tự ráp (Tiết kiệm)
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {selectedProfile.priceTiers.kitVnd
                        ? `~${formatVnd(selectedProfile.priceTiers.kitVnd)}`
                        : 'Theo xưởng'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Giao các chi tiết rời sau khi in để bạn tự trải nghiệm lắp ráp.
                  </p>
                </button>
              </div>
            </div>
          ) : null}

          {/* Customizable Print Specs (Parameters only - NO customer PII) */}
          <div className="space-y-3 rounded-xl border border-border/80 bg-background p-3.5 sm:p-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>Tuỳ chỉnh thông số in</span>
              <span className="text-[11px] font-normal lowercase text-muted-foreground">
                (tự động cập nhật vào tin nhắn Zalo)
              </span>
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="orderQuantity" className="text-xs font-semibold text-foreground">
                  Số lượng cần in
                </label>
                <input
                  id="orderQuantity"
                  type="number"
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="orderRequestedColor" className="text-xs font-semibold text-foreground">
                  Màu sắc mong muốn
                </label>
                <input
                  id="orderRequestedColor"
                  maxLength={100}
                  placeholder="Theo file, hoặc: Đen, Trắng..."
                  value={requestedColor}
                  onChange={(e) => setRequestedColor(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="orderTargetDimension" className="text-xs font-semibold text-foreground">
                  Kích thước mong muốn
                </label>
                <input
                  id="orderTargetDimension"
                  maxLength={100}
                  placeholder={
                    currentDim || selectedProfile?.dimensionsMm
                      ? `${currentDim || selectedProfile?.dimensionsMm}`
                      : 'Ví dụ: Cao 15cm, hoặc theo file gốc'
                  }
                  value={targetDimension}
                  onChange={(e) => setTargetDimension(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label htmlFor="orderNote" className="text-xs font-semibold text-foreground">
                Ghi chú thêm cho xưởng (tuỳ chọn)
              </label>
              <input
                id="orderNote"
                maxLength={300}
                placeholder="Ví dụ: Cần lấy gấp trước cuối tuần, yêu cầu in nhựa PETG chịu nhiệt..."
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
                  Gồm nhựa in, điện năng, khấu hao máy và dự phòng in lỗi
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {unitPrice > 0 ? `~${formatVnd(totalPrice)}` : 'Xưởng sẽ báo giá'}
              </span>
              {quantity > 1 && unitPrice > 0 ? (
                <span className="block text-[10px] text-muted-foreground">
                  (~${formatVnd(unitPrice)}/chiếc × {quantity})
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
