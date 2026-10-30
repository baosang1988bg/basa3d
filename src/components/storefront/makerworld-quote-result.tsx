'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Download,
  ExternalLink,
  Printer,
  Loader2,
  AlertCircle,
  Layers,
  Clock,
  Weight,
  Sparkles,
  Share2,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { formatVnd } from '@/components/storefront/format';
import type { MakerWorldCnModelDetail, MakerWorldCnProfile } from '@/app/api/public/makerworld-cn/resolve/route';
import { MakerWorld3dModal } from './makerworld-3d-modal';
import { MakerWorldOrderModal } from './makerworld-order-modal';
import { BUILD_INFO } from '@/config/build-info';
import {
  analyticsErrorCode,
  trackMakerWorldDownload,
  trackMakerWorldOrderClick,
  trackMakerWorldPreview3D,
} from '@/lib/analytics';

const isProduction = BUILD_INFO.channel === 'production' || process.env.NODE_ENV === 'production';

function formatPrintTime(minutes: number): string {
  if (!minutes || minutes <= 0) return 'Chưa rõ';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h}h ${m}p`;
}

export interface MakerWorldQuoteResultProps {
  detail: MakerWorldCnModelDetail;
  onReset?: () => void;
}

export function MakerWorldQuoteResult({
  detail: initialDetail,
  onReset,
}: MakerWorldQuoteResultProps) {
  const [detail, setDetail] = useState<MakerWorldCnModelDetail>(initialDetail);
  const [downloadingProfileId, setDownloadingProfileId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [profilePricingStatus, setProfilePricingStatus] = useState<
    Record<string, 'loading' | 'done' | 'unpriced'>
  >({});
  const resolveSeqRef = useRef(0);

  const [active3dProfile, setActive3dProfile] = useState<{
    profileId: string;
    title: string;
    estimatedPriceVnd?: number | null;
  } | null>(null);

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedOrderProfileId, setSelectedOrderProfileId] = useState<string | null>(null);

  useEffect(() => {
    setDetail(initialDetail);
    triggerSequentialPricing(initialDetail);
  }, [initialDetail]);

  async function triggerSequentialPricing(modelDetail: MakerWorldCnModelDetail) {
    const currentSeq = ++resolveSeqRef.current;

    const initialStatuses: Record<string, 'loading' | 'done' | 'unpriced'> = {};
    const unpricedQueue: MakerWorldCnProfile[] = [];

    for (const p of modelDetail.profiles) {
      if (typeof p.estimatedPriceVnd === 'number' && p.estimatedPriceVnd > 0) {
        initialStatuses[p.profileId] = 'done';
      } else if (p.printTimeMinutes > 0 && p.weightGrams > 0) {
        initialStatuses[p.profileId] = 'loading';
        unpricedQueue.push(p);
      } else {
        initialStatuses[p.profileId] = 'unpriced';
      }
    }

    setProfilePricingStatus(initialStatuses);

    if (unpricedQueue.length === 0) return;

    for (const profile of unpricedQueue) {
      if (resolveSeqRef.current !== currentSeq) return;

      try {
        const res = await fetch('/api/public/makerworld-cn/estimate-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printTimeMinutes: profile.printTimeMinutes,
            weightGrams: profile.weightGrams,
            platesCount: profile.platesCount,
            amsRequired: profile.amsRequired,
            filaments: profile.filaments,
          }),
        });

        if (resolveSeqRef.current !== currentSeq) return;

        if (res.ok) {
          const json = await res.json();
          const { estimatedPriceVnd, priceTiers } = json.data ?? {};
          if (typeof estimatedPriceVnd === 'number' && estimatedPriceVnd > 0) {
            setDetail((prev) => {
              if (!prev || prev.modelId !== modelDetail.modelId) return prev;
              return {
                ...prev,
                profiles: prev.profiles.map((p) =>
                  p.profileId === profile.profileId
                    ? { ...p, estimatedPriceVnd, priceTiers }
                    : p
                ),
              };
            });
            setProfilePricingStatus((prev) => ({
              ...prev,
              [profile.profileId]: 'done',
            }));
            continue;
          }
        }

        setProfilePricingStatus((prev) => ({
          ...prev,
          [profile.profileId]: 'unpriced',
        }));
      } catch {
        if (resolveSeqRef.current !== currentSeq) return;
        setProfilePricingStatus((prev) => ({
          ...prev,
          [profile.profileId]: 'unpriced',
        }));
      }
    }
  }

  function handleOpenOrderModal(profileId?: string) {
    if (detail) {
      const profile = profileId ? detail.profiles.find((p) => p.profileId === profileId) : undefined;
      trackMakerWorldOrderClick({
        model_id: detail.modelId,
        profile_id: profileId,
        estimated_price_vnd: profile?.estimatedPriceVnd,
      });
    }
    setSelectedOrderProfileId(profileId || null);
    setIsOrderModalOpen(true);
  }

  async function handleDownload(profileId: string) {
    if (!detail) return;
    const downloadEvent = { model_id: detail.modelId, profile_id: profileId, model_title: detail.title };
    if (!detail.isChinaModel) {
      trackMakerWorldDownload({ ...downloadEvent, method: 'external', success: true });
      window.open(detail.sourceUrl, '_blank');
      return;
    }
    let failedStatus: number | undefined;
    setDownloadingProfileId(profileId);
    setDownloadError(null);

    try {
      const res = await fetch('/api/public/makerworld-cn/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: detail.modelId,
          profileId,
        }),
      });

      if (!res.ok) {
        failedStatus = res.status;
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.message || 'Tải file thất bại từ server. Bạn có thể mở công cụ dự phòng để tải file.'
        );
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `makerworld-${detail.modelId}-${profileId}.3mf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      trackMakerWorldDownload({ ...downloadEvent, method: 'direct', success: true });
    } catch (err: unknown) {
      trackMakerWorldDownload({ ...downloadEvent, method: 'direct', success: false, error_code: analyticsErrorCode(failedStatus) });
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải file.';
      setDownloadError(msg);
    } finally {
      setDownloadingProfileId(null);
    }
  }

  const hasAnyLoadingProfile = Object.values(profilePricingStatus).some((status) => status === 'loading');

  const pricedProfiles = detail.profiles.filter(
    (p) => typeof p.estimatedPriceVnd === 'number' && p.estimatedPriceVnd > 0
  );
  const minPrice =
    pricedProfiles.length > 0
      ? Math.min(...pricedProfiles.map((p) => p.estimatedPriceVnd!))
      : null;

  return (
    <div className="flex flex-col gap-6">
      {downloadError ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-5 shrink-0" />
            <span>{downloadError}</span>
          </div>
          <a
            href="https://mwc.3dhubvn.net/makerworld-cn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start text-xs font-semibold underline sm:self-auto"
          >
            <span>Tải file qua web 3DHubVN</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : null}

      {/* Model Summary Card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
          {/* Cover Image */}
          <div className="overflow-hidden rounded-xl bg-muted aspect-4/3 relative">
            {detail.coverImageUrl ? (
              <img
                src={detail.coverImageUrl}
                alt={detail.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                Không có ảnh bìa
              </div>
            )}
          </div>

          {/* Model Info */}
          <div className="flex flex-col justify-between md:col-span-2">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Mã mẫu #{detail.modelId}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    detail.isChinaModel
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                  }`}
                >
                  {detail.isChinaModel ? '🇨🇳 MakerWorld Trung Quốc' : '🌐 MakerWorld Quốc Tế'}
                </span>
                {detail.license ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {detail.license}
                  </span>
                ) : null}
              </div>
              <h2 className="text-xl font-bold text-foreground md:text-2xl">{detail.title}</h2>
              {detail.author ? (
                <p className="text-sm text-muted-foreground">Tác giả: <span className="font-medium text-foreground">{detail.author}</span></p>
              ) : null}
              {detail.summary ? (
                <p className="line-clamp-2 text-xs text-muted-foreground/80 mt-1">{detail.summary}</p>
              ) : null}
              {minPrice ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Giá in xưởng: từ ~{formatVnd(minPrice)}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    (Tuỳ theo bàn in bạn chọn)
                  </span>
                </div>
              ) : hasAnyLoadingProfile ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  <span>Đang tính báo giá in xưởng theo từng bàn…</span>
                </div>
              ) : null}
              {!detail.isChinaModel ? (
                <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-2.5 text-xs text-sky-800 dark:text-sky-300 mt-2">
                  💡 <strong>Mẫu thuộc MakerWorld Quốc Tế:</strong> Bạn có thể mở trực tiếp trang MakerWorld để tải file .3MF chính chủ miễn phí mà không bị chặn bởi chính sách số điện thoại Trung Quốc.
                </div>
              ) : null}
            </div>

            {/* Primary Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={() => handleOpenOrderModal()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 cursor-pointer"
              >
                <Printer className="size-4" />
                <span>Đặt xưởng BaSa3D in mẫu này {minPrice ? `(từ ~${formatVnd(minPrice)})` : ''}</span>
              </button>

              <a
                href={detail.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <ExternalLink className="size-4" />
                <span>Mở trang MakerWorld</span>
              </a>

              {onReset ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Dán link khác</span>
                </button>
              ) : null}

              {!isProduction && (
                <a
                  href="https://mwc.3dhubvn.net/makerworld-cn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-input bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground transition hover:text-foreground"
                  title="Mở công cụ dự phòng tải file 3MF của 3DHubVN"
                >
                  <Share2 className="size-3.5" />
                  <span>Dự phòng 3DHubVN</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profiles / Plates Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <span>Các bản in / Print Profiles ({detail.profiles.length})</span>
          </h3>
          <p className="text-xs text-muted-foreground">Bấm tải file 3MF để in trực tiếp trên máy in Bambu Lab / OrcaSlicer</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {detail.profiles.map((p) => {
            const isDownloading = downloadingProfileId === p.profileId;
            return (
              <div
                key={p.profileId}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition hover:border-primary/40 hover:shadow-sm"
              >
                <div>
                  {/* Profile Header & Thumbnail */}
                  <div className="flex items-start gap-3">
                    {p.coverImageUrl ? (
                      <img
                        src={p.coverImageUrl}
                        alt={p.title}
                        className="size-16 shrink-0 rounded-lg object-cover bg-muted"
                      />
                    ) : (
                      <div className="size-16 shrink-0 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                        Profile
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm line-clamp-2 text-foreground" title={p.title}>
                        {p.title}
                      </h4>
                      <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {p.printerTarget || 'Bambu Lab'}
                      </span>
                    </div>
                  </div>

                  {/* Specs badges */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2 border-y border-border/40 py-2.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-primary/70 shrink-0" />
                      <span>{formatPrintTime(p.printTimeMinutes)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Weight className="size-3.5 text-primary/70 shrink-0" />
                      <span>{p.weightGrams ? `${p.weightGrams} g` : 'Chưa rõ'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="size-3.5 text-primary/70 shrink-0" />
                      <span>{p.platesCount} bàn in</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block size-2 rounded-full ${p.amsRequired ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span>{p.amsRequired ? 'Cần AMS' : 'Không AMS'}</span>
                    </div>
                  </div>

                  {/* Filaments swatch preview */}
                  {p.filaments.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Màu:</span>
                      {p.filaments.map((f, fIdx) => (
                        <span
                          key={fIdx}
                          className="inline-flex size-4 items-center justify-center rounded-full border border-border shadow-xs"
                          style={{ backgroundColor: f.colorHex }}
                          title={`${f.name} (${f.type})`}
                        />
                      ))}
                    </div>
                  ) : null}

                  {/* Estimated price badge */}
                  {(() => {
                    const status =
                      profilePricingStatus[p.profileId] ??
                      (typeof p.estimatedPriceVnd === 'number' && p.estimatedPriceVnd > 0
                        ? 'done'
                        : p.printTimeMinutes > 0 && p.weightGrams > 0
                          ? 'loading'
                          : 'unpriced');

                    if (status === 'loading') {
                      return (
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/60 border border-border/80 px-3 py-2 text-xs">
                          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                            <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                            <span>Báo giá:</span>
                          </div>
                          <div className="text-right">
                            <span className="inline-block text-xs font-semibold text-primary animate-pulse">
                              Đang tính giá…
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (p.estimatedPriceVnd) {
                      return (
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                            <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Giá in ước tính:</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
                              ~{formatVnd(p.estimatedPriceVnd)}
                            </span>
                            {p.priceTiers?.kitVnd && p.priceTiers.kitVnd !== p.estimatedPriceVnd ? (
                              <span className="block text-[10px] text-muted-foreground">
                                (Kit tự ráp: ~{formatVnd(p.priceTiers.kitVnd)})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/30 border border-border/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="text-[11px] font-medium">Báo giá:</span>
                        <span className="text-[11px] text-muted-foreground">
                          Liên hệ xưởng báo giá
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenOrderModal(p.profileId)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 cursor-pointer"
                  >
                    <Printer className="size-3.5" />
                    <span>
                      Đặt in bàn này{' '}
                      {p.estimatedPriceVnd
                        ? `(~${formatVnd(p.estimatedPriceVnd)})`
                        : profilePricingStatus[p.profileId] === 'loading'
                          ? '(Đang tính…)'
                          : ''}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        trackMakerWorldPreview3D({
                          model_id: detail.modelId,
                          profile_id: p.profileId,
                        });
                        setActive3dProfile({
                          profileId: p.profileId,
                          title: p.title,
                          estimatedPriceVnd: p.estimatedPriceVnd,
                        });
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                      title="Xem trước hình khối 3D trên trình duyệt"
                    >
                      <Eye className="size-3.5 text-primary" />
                      <span>Xem 3D</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(p.profileId)}
                      disabled={isDownloading}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Đang tải…</span>
                        </>
                      ) : detail.isChinaModel ? (
                        <>
                          <Download className="size-3.5 text-foreground/80" />
                          <span>Tải .3MF</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="size-3.5 text-foreground/80" />
                          <span>MakerWorld</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive 3D Preview Modal */}
      {active3dProfile ? (
        <MakerWorld3dModal
          isOpen={Boolean(active3dProfile)}
          onClose={() => setActive3dProfile(null)}
          modelId={detail.modelId}
          profileId={active3dProfile.profileId}
          profileTitle={active3dProfile.title}
          sourceUrl={detail.sourceUrl}
          isChinaModel={detail.isChinaModel}
          onDownload={() => handleDownload(active3dProfile.profileId)}
          onOrder={() => {
            const targetPid = active3dProfile.profileId;
            setActive3dProfile(null);
            handleOpenOrderModal(targetPid);
          }}
          estimatedPriceVnd={active3dProfile.estimatedPriceVnd}
        />
      ) : null}

      {/* Instant Order Modal */}
      {isOrderModalOpen ? (
        <MakerWorldOrderModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          detail={detail}
          initialProfileId={selectedOrderProfileId}
        />
      ) : null}
    </div>
  );
}
