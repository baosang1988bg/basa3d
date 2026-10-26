'use client';

import { useState, useEffect, type FormEvent } from 'react';
import {
  X,
  Printer,
  Clock,
  Weight,
  Layers,
  Sparkles,
  CheckCircle2,
  Loader2,
  ExternalLink,
  PackageCheck,
  Wrench,
  AlertCircle,
} from 'lucide-react';
import { formatVnd } from '@/components/storefront/format';
import { CURRENT_TOS_VERSION } from '@/lib/copyright/tos-version';
import { useContactStatePrefill, useSavedContact } from '@/lib/customer/use-saved-contact';
import { RememberContactOption } from '@/components/storefront/remember-contact-option';
import type { MakerWorldCnModelDetail } from '@/services/makerworld-cn-pricing.service';

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
}

export function MakerWorldOrderModal({
  isOpen,
  onClose,
  detail,
  initialProfileId,
}: MakerWorldOrderModalProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    initialProfileId || detail.profiles[0]?.profileId || ''
  );

  const selectedProfile =
    detail.profiles.find((p) => p.profileId === selectedProfileId) ||
    detail.profiles[0] ||
    null;

  const isMultiPlate = (selectedProfile?.platesCount ?? 1) > 1;
  const [tier, setTier] = useState<'ASSEMBLED' | 'KIT'>('ASSEMBLED');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [requestedColor, setRequestedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(false);

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [requestNumber, setRequestNumber] = useState('');
  const savedContact = useSavedContact();
  useContactStatePrefill(savedContact.contact, { name: setCustomerName, phone: setCustomerPhone, email: setCustomerEmail });

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
      if (e.key === 'Escape' && status !== 'submitting') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, status]);

  if (!isOpen) return null;

  // Determine current unit price based on tier & profile
  const unitPrice = selectedProfile
    ? isMultiPlate && tier === 'KIT' && selectedProfile.priceTiers?.kitVnd
      ? selectedProfile.priceTiers.kitVnd
      : isMultiPlate && tier === 'ASSEMBLED' && selectedProfile.priceTiers?.assembledVnd
        ? selectedProfile.priceTiers.assembledVnd
        : selectedProfile.estimatedPriceVnd ?? 0
    : 0;

  const totalPrice = unitPrice * Math.max(1, quantity);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;

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
      setErrorMessage('Vui lòng tích chọn đồng ý cam kết bản quyền phi thương mại.');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    const tierLabel = !isMultiPlate
      ? 'Bản in hoàn thiện (1 plate)'
      : tier === 'ASSEMBLED'
        ? 'Bản Ráp sẵn hoàn thiện'
        : 'Bản Kit tự ráp';

    const filamentList = selectedProfile.filaments.length > 0
      ? selectedProfile.filaments.map((f) => `${f.name} (${f.type})`).join(', ')
      : 'Theo màu mặc định của file';

    const description = [
      `[MakerWorld] ${detail.title}`,
      `Nguồn mẫu: ${detail.sourceUrl}`,
      detail.author ? `Tác giả: ${detail.author}` : null,
      `Bàn in (Profile): ${selectedProfile.title} (ID: ${selectedProfile.profileId})`,
      `Thông số in: ${formatPrintTime(selectedProfile.printTimeMinutes)} · ${selectedProfile.weightGrams ? `${selectedProfile.weightGrams}g` : 'Chưa rõ'} · ${selectedProfile.platesCount} bàn in`,
      `Máy in: ${selectedProfile.printerTarget || 'Bambu Lab'} · AMS: ${selectedProfile.amsRequired ? 'Cần AMS (Đa màu)' : 'Không AMS'}`,
      `Màu sắc file: ${filamentList}`,
      requestedColor.trim() ? `Màu khách yêu cầu: ${requestedColor.trim()}` : null,
      `Phương án: ${tierLabel}`,
      unitPrice > 0 ? `Báo giá ước tính hiển thị: ~${formatVnd(unitPrice)}/chiếc (Tổng: ~${formatVnd(totalPrice)})` : null,
      note.trim() ? `Ghi chú khách hàng: ${note.trim()}` : null,
    ].filter(Boolean).join('\n');

    try {
      const response = await fetch('/api/public/custom-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || null,
          requestedMaterial: selectedProfile.filaments[0]?.type || 'PLA',
          requestedColor: requestedColor.trim() || (filamentList !== 'Theo màu mặc định của file' ? filamentList : null),
          description,
          quantity: Math.max(1, quantity),
          copyrightConfirmed: true,
          tosVersion: CURRENT_TOS_VERSION,
          makerworld: {
            sourceUrl: detail.sourceUrl,
            profileId: selectedProfile.profileId,
            tier: isMultiPlate ? tier : 'ASSEMBLED',
            profileConfirmed: true,
          },
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data?.message || 'Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại.');
        return;
      }

      savedContact.saveAfterSubmit({ name: customerName, phone: customerPhone, email: customerEmail });
      setStatus('success');
      setRequestNumber(data?.requestNumber || '');
    } catch {
      setStatus('error');
      setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.');
    }
  }

  const inputClass =
    'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'submitting') {
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
                Đặt xưởng BaSa3D in mẫu
              </h3>
              <p className="text-xs text-muted-foreground">
                Báo giá xưởng theo đúng thông số profile đã chọn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'submitting'}
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
                  <span className="text-muted-foreground">Mẫu:</span>
                  <span className="font-medium text-right line-clamp-1">{detail.title}</span>
                </div>
                {selectedProfile ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bàn in (Profile):</span>
                    <span className="font-medium text-right line-clamp-1">{selectedProfile.title}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Số lượng:</span>
                  <span className="font-medium">{quantity} chiếc</span>
                </div>
                {unitPrice > 0 ? (
                  <div className="flex justify-between border-t border-border/60 pt-2 font-semibold">
                    <span>Giá in ước tính:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ~{formatVnd(totalPrice)}
                    </span>
                  </div>
                ) : null}
              </div>

              <p className="mx-auto max-w-md text-xs text-muted-foreground leading-relaxed">
                Kỹ thuật viên xưởng BaSa3D sẽ kiểm tra file, chuẩn bị máy in và liên hệ với bạn qua Zalo/SĐT{' '}
                <strong className="text-foreground">{customerPhone}</strong> trong vòng 2 giờ làm việc để xác nhận đơn và tiến hành in.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          ) : (
            /* Order Form */
            <form onSubmit={handleSubmit} className="space-y-5">
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
                      <span className={`size-2 rounded-full ${selectedProfile.amsRequired ? 'bg-amber-500' : 'bg-emerald-500'}`} />
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

              {/* Price Callout Banner */}
              <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span>Giá in xưởng ước tính:</span>
                    <p className="text-[11px] font-normal text-muted-foreground">
                      Đã gồm nhựa in, điện, khấu hao máy và dự phòng in lỗi
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {unitPrice > 0 ? `~${formatVnd(totalPrice)}` : 'Xưởng sẽ báo giá'}
                  </span>
                  {quantity > 1 && unitPrice > 0 ? (
                    <span className="block text-[10px] text-muted-foreground">
                      (~{formatVnd(unitPrice)}/chiếc × {quantity})
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Customer Contact Details */}
              <div className="space-y-3.5 border-t border-border pt-4">
                <h4 className="text-sm font-bold text-foreground">
                  Thông tin liên hệ nhận báo giá &amp; giao hàng
                </h4>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="orderCustomerName" className="text-xs font-semibold text-foreground">
                      Họ và tên *
                    </label>
                    <input
                      id="orderCustomerName"
                      autoComplete="name"
                      required
                      maxLength={200}
                      placeholder="Ví dụ: Nguyễn Văn A"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="orderCustomerPhone" className="text-xs font-semibold text-foreground">
                      Số điện thoại / Zalo *
                    </label>
                    <input
                      id="orderCustomerPhone"
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={30}
                      placeholder="098xxxxxxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="orderCustomerEmail" className="text-xs font-semibold text-foreground">
                      Email (không bắt buộc)
                    </label>
                    <input
                      id="orderCustomerEmail"
                      type="email"
                      autoComplete="email"
                      maxLength={320}
                      placeholder="name@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>

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
                      Màu sắc mong muốn (tuỳ chọn)
                    </label>
                    <input
                      id="orderRequestedColor"
                      maxLength={100}
                      placeholder="Theo màu file gốc, hoặc: Đen, Trắng, v.v."
                      value={requestedColor}
                      onChange={(e) => setRequestedColor(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="orderNote" className="text-xs font-semibold text-foreground">
                    Ghi chú thêm &amp; địa chỉ giao hàng (tuỳ chọn)
                  </label>
                  <textarea
                    id="orderNote"
                    rows={2}
                    maxLength={1000}
                    placeholder="Địa chỉ nhận hàng, thời gian cần gấp hoặc các lưu ý đặc biệt..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>

                {/* Copyright confirmation */}
                <div className="flex items-start gap-2 pt-1">
                  <input
                    id="orderCopyrightConfirmed"
                    type="checkbox"
                    required
                    checked={copyrightConfirmed}
                    onChange={(e) => setCopyrightConfirmed(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-input text-primary focus:ring-primary"
                  />
                  <label htmlFor="orderCopyrightConfirmed" className="cursor-pointer text-xs text-muted-foreground leading-relaxed">
                    Tôi cam kết yêu cầu in mẫu này cho mục đích cá nhân, phi thương mại và đồng ý với{' '}
                    <span className="text-primary hover:underline font-medium">chính sách bảo mật file &amp; điều khoản in ấn</span> của BaSa3D.
                  </label>
                </div>
              </div>

              {/* Error Alert */}
              <RememberContactOption
                remember={savedContact.remember}
                onRememberChange={savedContact.setRemember}
                hasSaved={savedContact.contact !== null}
                onClear={savedContact.clear}
              />

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
                  disabled={status === 'submitting'}
                  className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
                >
                  Đóng
                </button>

                <button
                  type="submit"
                  disabled={status === 'submitting' || !copyrightConfirmed}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer"
                >
                  {status === 'submitting' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Đang gửi yêu cầu...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="size-4" />
                      <span>
                        Gửi xưởng BaSa3D in ngay {unitPrice > 0 ? `(~${formatVnd(totalPrice)})` : ''}
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
