'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Zap,
  Link2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Wrench,
  PackageCheck,
  ChevronDown,
  RotateCcw,
  Sparkles,
  BadgeCheck,
  Camera,
} from 'lucide-react';
import { CURRENT_TOS_VERSION } from '@/lib/copyright/tos-version';
import { useContactStatePrefill, useSavedContact } from '@/lib/customer/use-saved-contact';
import { RememberContactOption } from '@/components/storefront/remember-contact-option';
import { formatVnd } from '@/components/storefront/format';
import { ProfileVerificationCard } from '@/components/makerworld/profile-verification-card';
import type { PublicMakerWorldEstimate, EstimateReason } from '@/services/makerworld-estimate.service';
import type { PublicScreenshotEstimate } from '@/services/makerworld-screenshot-estimate.service';
import { uploadCustomRequestFile, UploadError } from '@/lib/uploads/upload-custom-request-file';
import { prepareScreenshot } from '@/lib/uploads/prepare-screenshot';

type Tier = 'ASSEMBLED' | 'KIT';

const SAMPLE_MAKERWORLD_URL =
  'https://makerworld.com/en/models/3246150-frankenstein-s-monster-halloween-version-no-ams#profileId-3678340';

/** Owner decision D5 (makerworld-phase-b-storefront-estimate.md §10). */
const RESPONSE_TIME_TEXT = 'trong 2 giờ làm việc';

const REASON_TEXT: Record<Exclude<EstimateReason, 'OK'>, string> = {
  NOT_VERIFIED: 'Mẫu này chưa có giá sẵn trên hệ thống. Gửi yêu cầu để BaSa3D phân tích và báo giá chính xác cho bạn.',
  BLOCKED: 'Chưa đọc được dữ liệu mẫu tự động từ MakerWorld. Gửi yêu cầu để BaSa3D kiểm tra và báo giá cho bạn.',
  BUSY: 'Hệ thống đang bận. Bạn vẫn có thể gửi yêu cầu, BaSa3D sẽ báo giá cho bạn.',
  NO_PRICING_CONFIG: 'Hiện chưa thể hiển thị giá tự động. Gửi yêu cầu để BaSa3D báo giá cho bạn.',
  INCOMPLETE: 'Mẫu này thiếu thông số in trên MakerWorld nên chưa tính được giá tự động. Gửi yêu cầu để BaSa3D báo giá cho bạn.',
  SPEC_UNREADABLE: 'Chưa đọc được thời gian in và số gram trong đoạn bạn dán. Hãy copy cả dòng có dạng "7.4 h · 6 plates · 168 g" rồi thử lại.',
  SCREENSHOT_UNREADABLE: 'Chưa đọc được thông số profile trong ảnh. Hãy chụp lại rõ phần có tên profile, số giờ in và số gram.',
  SCREENSHOT_MISMATCH: 'Ảnh có vẻ không phải mẫu trong link bạn dán, nên chưa hiển thị giá. Hãy kiểm tra lại link/ảnh — bạn vẫn có thể gửi yêu cầu để xưởng kiểm tra.',
  SCREENSHOT_UNAVAILABLE: 'Hiện chưa đọc được ảnh tự động. Bạn có thể dán thông số bên dưới hoặc gửi yêu cầu để BaSa3D báo giá.',
};

// ADR-0039: screenshot of the profile on the MakerWorld app/web, read server-side.
const SCREENSHOT_HELP = 'Mở mẫu trên app hoặc web MakerWorld → bấm vào profile bạn muốn in → chụp màn hình phần có tên mẫu, tên profile, số giờ in, số gram và số plate.';
const SCREENSHOT_MAX_BYTES = 8 * 1024 * 1024;

// Option 1 (ADR-0034): MakerWorld blocks automated reads, so the customer copies the profile's spec
// line from the MakerWorld page; the server parses and prices it with the admin rules.
const SPEC_HELP = 'Mở link trên MakerWorld → ở mục "Print Profile", copy dòng thông số của profile bạn chọn (tên profile, số giờ, số plate, số gram) rồi dán vào đây.';

/**
 * Phase B storefront MakerWorld intake (makerworld-phase-b-storefront-estimate.md §7, ADR-0033).
 * Prices come only from the server: admin-verified presets (VERIFIED) or the optional auto estimate
 * (AUTO). This component never sends grams/minutes/prices — only the link + what the customer picked.
 */
export function MakerWorldIntakeCard({
  initialUrl,
  initialProfileId,
}: {
  initialUrl?: string;
  initialProfileId?: string;
} = {}) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const [estimate, setEstimate] = useState<PublicMakerWorldEstimate | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>('ASSEMBLED');
  const [specText, setSpecText] = useState('');
  const [usedSpecText, setUsedSpecText] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const [screenshotAvailable, setScreenshotAvailable] = useState(false);
  const [screenshotEstimateId, setScreenshotEstimateId] = useState<string | null>(null);
  const [matchStatus, setMatchStatus] = useState<PublicScreenshotEstimate['matchStatus']>(null);
  const [isReadingScreenshot, setIsReadingScreenshot] = useState(false);
  const screenshotInput = useRef<HTMLInputElement | null>(null);

  const [showDetailForm, setShowDetailForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  // Phase 29: both confirmations must be actively ticked by the customer — never pre-checked.
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(false);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [detailErrorMessage, setDetailErrorMessage] = useState('');
  const [requestNumber, setRequestNumber] = useState('');
  const savedContact = useSavedContact();
  useContactStatePrefill(savedContact.contact, { name: setCustomerName, phone: setCustomerPhone });

  useEffect(() => () => inflight.current?.abort(), []);

  const selectedProfile = estimate?.profiles.find((p) => p.profileId === selectedProfileId) ?? null;
  const isSinglePlate = selectedProfile?.platesCount === 1;
  const hasPrices = estimate?.source === 'VERIFIED' || estimate?.source === 'AUTO' || estimate?.source === 'SPEC' || estimate?.source === 'SCREENSHOT';
  const isEstimateSource = estimate?.source === 'AUTO' || estimate?.source === 'SPEC' || estimate?.source === 'SCREENSHOT';
  const needsProfilePick = Boolean(estimate && estimate.profiles.length > 1 && !selectedProfile);

  useEffect(() => {
    if (isSinglePlate && tier !== 'ASSEMBLED') {
      setTier('ASSEMBLED');
    }
  }, [isSinglePlate, tier]);

  async function handleEstimate(targetUrl?: string, spec?: string) {
    const urlToTest = (targetUrl ?? url).trim();
    if (!urlToTest) {
      setEstimateError('Vui lòng dán link mô hình từ MakerWorld.');
      return;
    }
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setIsEstimating(true);
    setEstimateError('');
    setEstimate(null);
    setSelectedProfileId(null);
    setProfileConfirmed(false);
    setShowDetailForm(false);
    setScreenshotEstimateId(null);
    setMatchStatus(null);
    try {
      const response = await fetch('/api/public/makerworld-estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(spec ? { url: urlToTest, specText: spec } : { url: urlToTest }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setEstimateError(data?.message || (response.status === 429
          ? 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.'
          : 'Không thể kiểm tra link này. Vui lòng kiểm tra lại link MakerWorld.'));
        return;
      }
      const result = data as PublicMakerWorldEstimate;
      setEstimate(result);
      setScreenshotAvailable(Boolean(result.screenshotAvailable));
      setUsedSpecText(spec && result.source === 'SPEC' ? spec : null);
      setSelectedProfileId(result.selectedProfileId ?? (result.profiles.length === 1 ? result.profiles[0].profileId : null));
      if (targetUrl) setUrl(targetUrl);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setEstimateError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
    } finally {
      if (inflight.current === controller) setIsEstimating(false);
    }
  }

  useEffect(() => {
    if (initialUrl) {
      void handleEstimate(initialUrl).then(() => {
        if (initialProfileId) {
          setSelectedProfileId(initialProfileId);
        }
      });
    }
  }, [initialUrl, initialProfileId]);

  /** ADR-0039: upload the screenshot (existing signed-upload flow), then send link + image path in ONE request. */
  async function handleScreenshot(file: File) {
    if (!estimate) return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setIsReadingScreenshot(true);
    setEstimateError('');
    try {
      // Re-encoded in the browser: strips EXIF (GPS), shrinks big photos, converts HEIC when possible.
      const prepared = await prepareScreenshot(file);
      if (!prepared) {
        setEstimateError('Chỉ nhận ảnh PNG, JPG hoặc WEBP. Ảnh chụp màn hình trên điện thoại thường đã đúng định dạng.');
        return;
      }
      if (prepared.blob.size > SCREENSHOT_MAX_BYTES) {
        setEstimateError('Ảnh quá lớn (tối đa 8MB) — hãy cắt bớt hoặc chụp lại.');
        return;
      }
      const uploaded = await uploadCustomRequestFile(prepared.blob, prepared.fileName);
      const response = await fetch('/api/public/makerworld-screenshot-estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: estimate.sourceUrl, attachmentPath: uploaded.path, uploadClaim: uploaded.uploadClaim }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setEstimateError(data?.message || (response.status === 429
          ? 'Bạn đã gửi ảnh quá nhiều lần, vui lòng thử lại sau.'
          : 'Không đọc được ảnh này, vui lòng thử lại.'));
        return;
      }
      const result = data as PublicScreenshotEstimate;
      setEstimate(result);
      setScreenshotEstimateId(result.screenshotEstimateId);
      setMatchStatus(result.matchStatus);
      setUsedSpecText(null);
      setSelectedProfileId(result.selectedProfileId);
      setProfileConfirmed(false);
      setShowDetailForm(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setEstimateError(error instanceof UploadError ? error.message : 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
    } finally {
      if (inflight.current === controller) setIsReadingScreenshot(false);
      if (screenshotInput.current) screenshotInput.current.value = '';
    }
  }

  async function handleDetailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!estimate) return;
    if (!customerName.trim()) return setDetailErrorMessage('Vui lòng nhập họ và tên của bạn.');
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 9) {
      return setDetailErrorMessage('Vui lòng nhập số điện thoại hoặc Zalo hợp lệ (từ 9 số trở lên).');
    }
    if (needsProfilePick) return setDetailErrorMessage('Vui lòng chọn đúng profile in bạn muốn ở phía trên.');
    if (!profileConfirmed) return setDetailErrorMessage('Vui lòng xác nhận link và profile là đúng mẫu bạn muốn in.');
    if (!copyrightConfirmed) return setDetailErrorMessage('Vui lòng xác nhận in cho mục đích cá nhân, phi thương mại.');

    setDetailStatus('submitting');
    setDetailErrorMessage('');
    const tierLabel = isSinglePlate
      ? 'Bản in hoàn thiện (1 plate)'
      : tier === 'ASSEMBLED'
        ? 'Bản Ráp sẵn hoàn thiện'
        : 'Bản Kit tự ráp';
    const description = [
      `[MakerWorld] ${estimate.modelTitle ?? estimate.sourceUrl}`,
      selectedProfile ? `Profile: ${selectedProfile.profileTitle}` : null,
      `Phương án: ${tierLabel}`,
      note.trim() ? `Ghi chú: ${note.trim()}` : null,
    ].filter(Boolean).join('\n');

    try {
      const response = await fetch('/api/public/custom-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          description,
          quantity: Math.max(1, Number(quantity) || 1),
          copyrightConfirmed,
          tosVersion: CURRENT_TOS_VERSION,
          makerworld: {
            sourceUrl: estimate.sourceUrl,
            // Screenshot profiles use server keys (p0..); the MakerWorld #profileId stays the link's.
            profileId: screenshotEstimateId ? estimate.requestedProfileId ?? null : selectedProfile?.profileId ?? estimate.requestedProfileId ?? null,
            tier,
            profileConfirmed,
            ...(screenshotEstimateId && selectedProfile
              ? { screenshotEstimateId, profileKey: selectedProfile.profileId }
              : usedSpecText ? { specText: usedSpecText } : {}),
          },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setDetailStatus('error');
        setDetailErrorMessage(data?.message || 'Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại.');
        return;
      }
      savedContact.saveAfterSubmit({ name: customerName, phone: customerPhone });
      setDetailStatus('success');
      setRequestNumber(data?.requestNumber || '');
    } catch {
      setDetailStatus('error');
      setDetailErrorMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.');
    }
  }

  function handleReset() {
    setScreenshotEstimateId(null);
    setMatchStatus(null);
    setSpecText('');
    setUsedSpecText(null);
    inflight.current?.abort();
    setUrl('');
    setEstimate(null);
    setSelectedProfileId(null);
    setEstimateError('');
    setShowDetailForm(false);
    setProfileConfirmed(false);
    setDetailStatus('idle');
  }

  function priceFor(t: Tier): number | null {
    return selectedProfile?.prices[t] ?? null;
  }

  if (detailStatus === 'success') {
    return (
      <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 md:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>
        <h3 className="font-heading mt-4 text-2xl font-bold text-foreground">Đã gửi yêu cầu báo giá thành công!</h3>
        {requestNumber ? (
          <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Mã yêu cầu: <span className="font-mono">{requestNumber}</span>
          </p>
        ) : null}
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          BaSa3D sẽ kiểm tra mẫu, màu nhựa còn trong kho và gửi báo giá chính thức qua Zalo/SĐT{' '}
          <strong className="text-foreground">{customerPhone}</strong> {RESPONSE_TIME_TEXT}.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-all cursor-pointer"
        >
          <span>Xem giá mẫu khác</span>
          <ArrowRight className="size-4" />
        </button>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-primary/25 bg-linear-to-b from-primary/5 via-background to-background p-6 md:p-8 shadow-xs">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
            <Zap className="size-3.5 fill-current" />
            BÁO GIÁ NHANH TỪ LINK MAKERWORLD
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">• Xem giá không cần để lại SĐT</span>
        </div>
        <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">Dán link MakerWorld để xem giá in</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Dán link là có ngay giá cho bản in hoàn thiện và bản kit tự ráp — mẫu BaSa3D đã kiểm tra hiển thị giá chính xác, mẫu khác hiển thị giá ước tính tự động. Gửi yêu cầu để xưởng xác nhận giá chính thức {RESPONSE_TIME_TEXT}.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              id="makerworld-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setEstimateError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleEstimate();
                }
              }}
              placeholder="https://makerworld.com/... hoặc makerworld.com.cn/..."
              className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm text-foreground shadow-xs placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => handleEstimate()}
            disabled={isEstimating || !url.trim()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isEstimating ? (<><Loader2 className="size-4 animate-spin" /><span>Đang kiểm tra…</span></>) : (<><Sparkles className="size-4" /><span>Xem giá</span></>)}
          </button>
        </div>

        {!estimate && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Chưa có link?</span>
            <button
              type="button"
              onClick={() => {
                setUrl(SAMPLE_MAKERWORLD_URL);
                handleEstimate(SAMPLE_MAKERWORLD_URL);
              }}
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              Thử mẫu ví dụ: Quái vật Frankenstein
            </button>
          </div>
        )}

        {estimateError ? (
          <div role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{estimateError}</span>
          </div>
        ) : null}
      </div>

      {estimate && (
        <div className="mt-6 flex flex-col gap-5 border-t border-border/60 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-bold text-foreground">{estimate.modelTitle ?? 'Mẫu MakerWorld của bạn'}</h3>
            {estimate.source === 'VERIFIED' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <BadgeCheck className="size-3.5" /> Giá BaSa3D đã kiểm tra
              </span>
            ) : estimate.source === 'AUTO' ? (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Giá ước tính tự động</span>
            ) : estimate.source === 'SPEC' ? (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Giá ước tính từ thông số bạn dán</span>
            ) : estimate.source === 'SCREENSHOT' ? (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Giá ước tính từ ảnh chụp</span>
            ) : null}
          </div>

          {estimate.source === 'NONE' && estimate.reason !== 'OK' ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{REASON_TEXT[estimate.reason]}</span>
            </div>
          ) : null}

          {matchStatus === 'UNKNOWN' && screenshotEstimateId ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>Chưa đối chiếu được ảnh với link (ảnh không thấy rõ tên mẫu). Hãy chắc chắn ảnh chụp đúng mẫu trong link — xưởng sẽ kiểm tra lại trước khi báo giá chính thức.</span>
            </div>
          ) : null}

          {estimate.source === 'NONE' && estimate.reason !== 'NO_PRICING_CONFIG' && screenshotAvailable ? (
            <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground">Xem giá ngay bằng ảnh chụp màn hình</p>
              <p className="text-xs text-muted-foreground">{SCREENSHOT_HELP}</p>
              <p className="text-[11px] text-muted-foreground">Ảnh được đọc tự động bằng AI chỉ để lấy thông số in; xưởng vẫn kiểm tra lại trước khi báo giá chính thức.</p>
              <input
                ref={screenshotInput}
                id="mw-screenshot"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleScreenshot(file);
                }}
              />
              <button
                type="button"
                onClick={() => screenshotInput.current?.click()}
                disabled={isReadingScreenshot || isEstimating}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isReadingScreenshot ? (<><Loader2 className="size-4 animate-spin" /><span>Đang đọc ảnh…</span></>) : (<><Camera className="size-4" /><span>Chọn ảnh chụp màn hình</span></>)}
              </button>
            </div>
          ) : null}

          {estimate.source === 'NONE' && estimate.reason !== 'NO_PRICING_CONFIG' ? (
            <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground">{screenshotAvailable ? 'Hoặc dán thông số profile' : 'Xem giá ngay bằng thông số profile'}</p>
              <p className="text-xs text-muted-foreground">{SPEC_HELP}</p>
              <textarea
                id="mw-spec-text"
                rows={2}
                maxLength={2000}
                value={specText}
                onChange={(e) => setSpecText(e.target.value)}
                placeholder="Ví dụ: 0.2mm layer, 2 walls, 15% infill · P1S · 7.4 h · 6 plates · 168 g"
                className="rounded-lg border border-input bg-background p-2.5 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => handleEstimate(undefined, specText.trim())}
                disabled={isEstimating || specText.trim().length < 3}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isEstimating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                <span>Tính giá từ thông số</span>
              </button>
            </div>
          ) : null}

          {estimate.profiles.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-foreground">
                {estimate.profiles.length > 1 ? 'Chọn đúng profile in bạn muốn:' : 'Profile in:'}
              </p>
              {!screenshotEstimateId && estimate.requestedProfileId && !estimate.profiles.some((p) => p.profileId === estimate.requestedProfileId) ? (
                <p className="text-xs text-muted-foreground">Profile trong link của bạn chưa có giá sẵn — chọn một profile bên dưới hoặc gửi yêu cầu để xưởng báo giá profile đó.</p>
              ) : null}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {estimate.profiles.map((profile) => (
                  <button
                    key={profile.profileId}
                    type="button"
                    onClick={() => {
                      setSelectedProfileId(profile.profileId);
                      setProfileConfirmed(false);
                    }}
                    aria-pressed={selectedProfileId === profile.profileId}
                    className={`rounded-xl text-left transition-all cursor-pointer ${selectedProfileId === profile.profileId ? 'ring-2 ring-primary' : 'opacity-80 hover:opacity-100'}`}
                  >
                    <ProfileVerificationCard
                      profileTitle={profile.profileTitle}
                      imageUrl={profile.imageUrl}
                      printerTarget={profile.printerTarget}
                      printMinutes={profile.printMinutes}
                      platesCount={profile.platesCount}
                      netWeightGrams={profile.netWeightGrams}
                      amsRequired={profile.amsRequired}
                    />
                    {profile.dataIncomplete ? (
                      <span className="mt-1 block px-1 text-[11px] text-amber-700 dark:text-amber-400">
                        Ảnh chưa thấy đủ số giờ in / số gram của profile này — bấm vào profile trên MakerWorld rồi chụp phần chi tiết để có giá.
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {hasPrices && selectedProfile ? (
            <div className={`grid grid-cols-1 gap-4 ${isSinglePlate ? '' : 'sm:grid-cols-2'}`}>
              {(isSinglePlate ? (['ASSEMBLED'] as const) : (['ASSEMBLED', 'KIT'] as const)).map((t) => {
                const price = priceFor(t);
                const isSelected = tier === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    aria-pressed={isSelected}
                    className={`flex flex-col gap-2 rounded-xl border p-5 text-left transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5 shadow-xs ring-2 ring-primary/20' : 'border-border bg-card hover:border-primary/50'}`}
                  >
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${t === 'ASSEMBLED' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {t === 'ASSEMBLED' ? <PackageCheck className="size-4" /> : <Wrench className="size-4" />}
                      {isSinglePlate ? 'Bản in hoàn thiện' : t === 'ASSEMBLED' ? 'Bản ráp sẵn hoàn thiện' : 'Bản kit tự ráp'}
                    </span>
                    <span className="font-heading text-3xl font-extrabold text-foreground">
                      {price === null ? <span className="text-base font-semibold text-muted-foreground">Xưởng sẽ báo giá</span>
                        : isEstimateSource ? `~${formatVnd(price)}` : formatVnd(price)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isSinglePlate
                        ? 'Mẫu in 1 plate (1 bàn in) không cần lắp ráp, xưởng in và làm sạch hoàn thiện.'
                        : t === 'ASSEMBLED'
                          ? 'Xưởng in đủ chi tiết, làm sạch support và ráp hoàn chỉnh.'
                          : 'Các mảnh in rời đã làm sạch cơ bản, bạn tự ráp.'}
                      {quantity > 1 ? ' Giá cho 1 sản phẩm.' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {hasPrices ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                {estimate.source === 'VERIFIED'
                  ? 'Giá tham khảo do BaSa3D tính cho đúng profile này với cấu hình in và giá nhựa hiện tại. Giá chính thức sẽ được xác nhận khi xưởng kiểm tra màu nhựa bạn chọn.'
                  : estimate.source === 'SPEC'
                    ? 'Giá ước tính theo thông số bạn dán, làm tròn 5.000đ. BaSa3D sẽ kiểm tra lại đúng profile trên MakerWorld trước khi báo giá chính thức.'
                    : estimate.source === 'SCREENSHOT'
                      ? 'Giá ước tính theo thông số đọc từ ảnh chụp của bạn, làm tròn 5.000đ. BaSa3D sẽ kiểm tra lại đúng mẫu và profile trên MakerWorld trước khi báo giá chính thức.'
                    : 'Giá ước tính tự động, làm tròn 5.000đ. Giá chính thức do BaSa3D xác nhận sau khi kiểm tra mẫu.'}
              </span>
            </div>
          ) : null}

          {!showDetailForm ? (
            <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
              <button type="button" onClick={handleReset} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                <RotateCcw className="size-3.5" />
                <span>Nhập link khác</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDetailForm(true)}
                disabled={needsProfilePick}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer sm:w-auto"
              >
                <span>{needsProfilePick ? 'Chọn profile để tiếp tục' : 'Gửi yêu cầu in mẫu này'}</span>
                <ChevronDown className="size-4" />
              </button>
            </div>
          ) : null}
        </div>
      )}

      {estimate && showDetailForm && (
        <form onSubmit={handleDetailSubmit} className="mt-6 flex flex-col gap-4 border-t border-border/80 pt-6">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-lg font-bold text-foreground">Thông tin nhận báo giá chính thức</h3>
            <p className="text-xs text-muted-foreground">Xưởng kiểm tra màu nhựa còn trong kho và gửi báo giá chốt qua Zalo {RESPONSE_TIME_TEXT}.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mw-customer-name" className="text-xs font-semibold text-foreground">Họ và tên của bạn (*)</label>
              <input id="mw-customer-name" type="text" autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn An" required maxLength={200}
                className="rounded-lg border border-input bg-background p-2.5 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mw-customer-phone" className="text-xs font-semibold text-foreground">Số điện thoại / Zalo nhận báo giá (*)</label>
              <input id="mw-customer-phone" type="tel" autoComplete="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Ví dụ: 0912 345 678" required maxLength={30}
                className="rounded-lg border border-input bg-background p-2.5 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <label htmlFor="mw-note" className="text-xs font-semibold text-foreground">Màu sắc / ghi chú (tuỳ chọn)</label>
              <input id="mw-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: in màu xanh rêu, giao trước thứ 6..." maxLength={2000}
                className="rounded-lg border border-input bg-background p-2.5 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label htmlFor="mw-qty" className="text-xs font-semibold text-foreground">Số lượng</label>
              <input id="mw-qty" type="number" min={1} max={100} value={quantity} onChange={(e) => setQuantity(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                className="rounded-lg border border-input bg-background p-2.5 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <RememberContactOption
            remember={savedContact.remember}
            onRememberChange={savedContact.setRemember}
            hasSaved={savedContact.contact !== null}
            onClear={savedContact.clear}
          />

          <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs text-muted-foreground">
            <input id="mw-profile-confirm" type="checkbox" checked={profileConfirmed} onChange={(e) => setProfileConfirmed(e.target.checked)} className="mt-0.5 size-4 cursor-pointer" />
            <span>
              <span className="font-medium text-foreground">Đúng mẫu tôi muốn in: </span>
              {selectedProfile ? `profile "${selectedProfile.profileTitle}", ` : 'link MakerWorld ở trên, '}
              {isSinglePlate
                ? 'bản in hoàn thiện (1 plate).'
                : tier === 'ASSEMBLED'
                  ? 'bản ráp sẵn hoàn thiện.'
                  : 'bản kit tự ráp.'}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
            <input id="mw-copyright" type="checkbox" checked={copyrightConfirmed} onChange={(e) => setCopyrightConfirmed(e.target.checked)} className="mt-0.5 size-4 cursor-pointer" />
            <span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground"><ShieldCheck className="size-3.5 text-primary" />Cam kết bản quyền:</span>{' '}
              Tôi xác nhận yêu cầu in mẫu này phục vụ mục đích cá nhân, phi thương mại.
            </span>
          </label>

          {detailErrorMessage ? (
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{detailErrorMessage}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button type="button" onClick={() => setShowDetailForm(false)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Thu gọn</button>
            <button
              type="submit"
              disabled={detailStatus === 'submitting'}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-60 transition-all cursor-pointer"
            >
              {detailStatus === 'submitting' ? (<><Loader2 className="size-4 animate-spin" /><span>Đang gửi…</span></>) : (<><span>Gửi yêu cầu & nhận báo giá chính thức</span><ArrowRight className="size-4" /></>)}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
