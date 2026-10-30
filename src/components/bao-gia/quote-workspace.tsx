'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import {
  UploadCloud,
  Link2,
  Globe,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Layers,
  FileCheck,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ClipboardPaste,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatVnd } from '@/components/storefront/format';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { QuoteFlow } from './quote-flow';
import { MakerWorldQuoteResult } from '@/components/storefront/makerworld-quote-result';
import type { MakerWorldCnModelDetail } from '@/app/api/public/makerworld-cn/resolve/route';
import {
  analyticsErrorCode,
  getMakerWorldSourceHost,
  trackMakerWorldResolve,
} from '@/lib/analytics';

export type QuoteTab = 'file' | 'link';

export type SampleItem = {
  key: string;
  title: string;
  description: string;
  priceVnd: number | null;
};

const MAKERWORLD_SAMPLES = [
  {
    label: '🌐 Ace Snail Stand (Quốc tế)',
    url: 'https://makerworld.com/en/models/2851863#profileId-3334843',
  },
  {
    label: '🇨🇳 Hộp lọc cà phê V60 (China)',
    url: 'https://makerworld.com.cn/zh/models/700000',
  },
  {
    label: '🇨🇳 R301 Apex Legends (China)',
    url: 'https://makerworld.com.cn/zh/models/800000',
  },
  {
    label: '🇨🇳 Thìa xúc thực phẩm (China)',
    url: 'https://makerworld.com.cn/zh/models/2851863',
  },
];

interface QuoteWorkspaceProps {
  materials: string[];
  samples: SampleItem[];
  initialTab?: QuoteTab;
  initialUrl?: string;
}

export function QuoteWorkspace({
  materials,
  samples,
  initialTab = 'link',
  initialUrl,
}: QuoteWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<QuoteTab>(initialTab);
  const [linkInput, setLinkInput] = useState(initialUrl ?? '');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isAnalyzingLink, setIsAnalyzingLink] = useState(false);
  const [linkDetail, setLinkDetail] = useState<MakerWorldCnModelDetail | null>(null);

  function handleTabChange(tab: QuoteTab) {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  }

  async function handleAnalyze(targetUrl?: string) {
    const raw = (targetUrl ?? linkInput).trim();
    if (!raw) {
      setLinkError('Vui lòng nhập hoặc dán liên kết mẫu 3D từ MakerWorld.');
      return;
    }

    try {
      const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      const host = parsed.hostname.toLowerCase();
      if (!host.includes('makerworld.com')) {
        setLinkError('Hiện công cụ hỗ trợ tốt nhất link MakerWorld (makerworld.com hoặc makerworld.com.cn). Bạn vẫn có thể tiếp tục phân tích.');
      } else {
        setLinkError(null);
      }
    } catch {
      setLinkError('Đường dẫn không hợp lệ. Vui lòng kiểm tra lại URL.');
      return;
    }

    const sourceHost = getMakerWorldSourceHost(raw);
    let failedStatus: number | undefined;

    setIsAnalyzingLink(true);
    setLinkError(null);

    try {
      const res = await fetch('/api/public/makerworld-cn/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: raw }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        failedStatus = res.status;
        throw new Error(data.message || 'Không thể đọc dữ liệu mẫu từ liên kết này.');
      }

      trackMakerWorldResolve({ success: true, source_host: sourceHost, model_id: data.data?.modelId });
      setLinkDetail(data.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi phân tích liên kết.';
      trackMakerWorldResolve({ success: false, source_host: sourceHost, error_code: analyticsErrorCode(failedStatus) });
      setLinkError(msg);
      setLinkDetail(null);
    } finally {
      setIsAnalyzingLink(false);
    }
  }

  useEffect(() => {
    if (initialUrl && initialUrl.trim()) {
      handleAnalyze(initialUrl.trim());
    }
  }, [initialUrl]);

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    handleAnalyze();
  }

  async function handlePasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLinkInput(text);
        handleAnalyze(text);
      }
    } catch {
      // Ignore clipboard permission rejections silently
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 2-Option Segmented Switcher */}
      <div
        role="tablist"
        aria-label="Chọn phương thức báo giá in 3D"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:hidden"
      >
        {/* Option 1 (Ưu tiên): Tìm & Báo giá theo link MakerWorld */}
        <button
          type="button"
          role="tab"
          id="tab-bao-gia-link"
          aria-selected={activeTab === 'link'}
          aria-controls="panel-bao-gia-link"
          onClick={() => handleTabChange('link')}
          className={cn(
            'group relative flex flex-col items-start rounded-2xl border p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] sm:p-6 cursor-pointer',
            activeTab === 'link'
              ? 'border-primary bg-primary/[0.06] shadow-sm ring-2 ring-primary/20 dark:bg-primary/[0.10]'
              : 'border-border/80 bg-card hover:border-primary/50 hover:bg-primary/[0.02] hover:shadow-xs'
          )}
        >
          {/* Top row: Icon, Status Badge & Priority Pill */}
          <div className="flex w-full items-center justify-between gap-2">
            <div
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-xl transition-all duration-200',
                activeTab === 'link'
                  ? 'bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/15'
                  : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-sm'
              )}
            >
              <Link2 className="size-6" aria-hidden="true" />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 border border-amber-500/25">
                <Sparkles className="size-3 text-amber-600 dark:text-amber-400" />
                Ưu tiên
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-150',
                  activeTab === 'link'
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/25 border border-transparent'
                    : 'bg-secondary text-secondary-foreground border border-border/80'
                )}
              >
                {activeTab === 'link' ? (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                ) : null}
                Dán link / Tìm mẫu
              </span>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="font-heading text-lg font-bold text-foreground sm:text-xl">
              1. Tìm & Báo giá theo link
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Chưa có file hoặc tìm thấy mẫu ưng ý trên mạng? Dán link MakerWorld để tự động bóc tách bàn in, khối lượng nhựa và đặt in ngay.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2.5 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-500/20">
              <Sparkles className="size-3 text-amber-600 dark:text-amber-400" /> Không cần tải file nặng
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-primary dark:bg-primary/15 dark:text-primary-300 border border-primary/20">
              <Globe className="size-3 text-primary" /> Hàng triệu mẫu MakerWorld
            </span>
          </div>
        </button>

        {/* Option 2: File có sẵn */}
        <button
          type="button"
          role="tab"
          id="tab-bao-gia-file"
          aria-selected={activeTab === 'file'}
          aria-controls="panel-bao-gia-file"
          onClick={() => handleTabChange('file')}
          className={cn(
            'group relative flex flex-col items-start rounded-2xl border p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] sm:p-6 cursor-pointer',
            activeTab === 'file'
              ? 'border-primary bg-primary/[0.06] shadow-sm ring-2 ring-primary/20 dark:bg-primary/[0.10]'
              : 'border-border/80 bg-card hover:border-primary/50 hover:bg-primary/[0.02] hover:shadow-xs'
          )}
        >
          <div className="flex w-full items-center justify-between gap-2">
            <div
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-xl transition-all duration-200',
                activeTab === 'file'
                  ? 'bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/15'
                  : 'bg-secondary text-foreground/75 group-hover:bg-primary/10 group-hover:text-primary'
              )}
            >
              <UploadCloud className="size-6" aria-hidden="true" />
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-150',
                activeTab === 'file'
                  ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/25 border border-transparent'
                  : 'bg-secondary text-secondary-foreground border border-border/80'
              )}
            >
              {activeTab === 'file' ? (
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
              ) : null}
              File có sẵn (.STL / .OBJ)
            </span>
          </div>

          <div className="mt-4">
            <h2 className="font-heading text-lg font-bold text-foreground sm:text-xl">
              2. Tải file từ máy tính
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Đã có file 3D? Kéo thả file .stl / .obj để phân tích hình khối, tuỳ chỉnh độ đặc infill và nhận giá ước tính ngay lập tức.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-secondary-foreground border border-border/60">
              <Layers className="size-3 text-primary" /> Phân tích 3D trực tiếp
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-secondary-foreground border border-border/60">
              <FileCheck className="size-3 text-primary" /> Bảo mật trên máy bạn
            </span>
          </div>
        </button>
      </div>

      {/* ============================================================== */}
      {/* PART 1: TÌM THEO LINK (MakerWorld Discovery & Link Quotation)   */}
      {/* ============================================================== */}
      <section
        id="panel-bao-gia-link"
        role="tabpanel"
        aria-labelledby="tab-bao-gia-link"
        className={cn(
          'print:hidden',
          activeTab === 'link' ? 'block' : 'hidden'
        )}
      >
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-xs sm:p-8">
          <div className="flex flex-col gap-6">
            {/* Header of Link Section */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Kho mẫu MakerWorld & MakerWorld China
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Bóc tách tự động
                </span>
              </div>

              <h3 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                Phương thức 1: Dán liên kết mẫu 3D để phân tích & báo giá
              </h3>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Bạn chưa có file sẵn hoặc đã tìm thấy mẫu ưng ý trên mạng? Hãy dán link từ MakerWorld để hệ thống tự động bóc tách các bàn in (plates), tính lượng nhựa và gửi báo giá chính xác.
              </p>
            </div>

            {/* Link Input Bar */}
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Link2
                    className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={linkInput}
                    onChange={(e) => {
                      setLinkInput(e.target.value);
                      if (linkError) setLinkError(null);
                    }}
                    placeholder="Dán link makerworld.com hoặc makerworld.com.cn (VD: https://makerworld.com/en/models/...)"
                    disabled={isAnalyzingLink}
                    className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-11 text-sm font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 shadow-2xs disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    title="Dán từ bộ nhớ tạm (Clipboard)"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                  >
                    <ClipboardPaste className="size-4" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isAnalyzingLink || !linkInput.trim()}
                  className={cn(
                    storefrontButtonClasses('accent'),
                    'h-12 px-6 text-sm font-semibold whitespace-nowrap shadow-sm disabled:opacity-50 cursor-pointer'
                  )}
                >
                  {isAnalyzingLink ? (
                    <>
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                      Đang phân tích…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 size-4" />
                      Phân tích & Báo giá ngay
                    </>
                  )}
                </button>
              </div>

              {/* Sample Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span className="font-medium">Bấm thử mẫu nhanh:</span>
                {MAKERWORLD_SAMPLES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      setLinkInput(s.url);
                      handleAnalyze(s.url);
                    }}
                    disabled={isAnalyzingLink}
                    className="rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 text-xs text-foreground hover:border-primary/50 hover:bg-background transition cursor-pointer disabled:opacity-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {linkError ? (
                <div role="alert" className="mt-2 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{linkError}</span>
                </div>
              ) : null}
            </form>

            {/* Live Quotation Result (renders directly here without redirecting) */}
            {linkDetail ? (
              <div className="border-t border-border/60 pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Báo giá bóc tách tự động cho mẫu #{linkDetail.modelId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkDetail(null);
                      setLinkInput('');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Nhập link khác</span>
                  </button>
                </div>

                <MakerWorldQuoteResult
                  detail={linkDetail}
                  onReset={() => {
                    setLinkDetail(null);
                    setLinkInput('');
                  }}
                />
              </div>
            ) : null}

            {/* Direct Model Repositories Links */}
            {!linkDetail && (
              <div className="border-t border-border/60 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Chưa có link? Khám phá ngay trên kho mẫu:
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="https://makerworld.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground shadow-xs transition-all hover:border-primary/50 hover:bg-secondary sm:text-sm"
                  >
                    <Globe className="size-4 text-primary" aria-hidden="true" />
                    <span>Duyệt MakerWorld Quốc tế</span>
                    <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </a>

                  <a
                    href="https://makerworld.com.cn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground shadow-xs transition-all hover:border-primary/50 hover:bg-secondary sm:text-sm"
                  >
                    <span className="text-base leading-none" aria-hidden="true">🇨🇳</span>
                    <span>Duyệt MakerWorld Trung Quốc</span>
                    <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </a>

                  <button
                    type="button"
                    onClick={() => router.push('/tools/makerworld-cn')}
                    className={cn(
                      storefrontButtonClasses('secondary'),
                      'h-10 px-4 text-xs sm:text-sm cursor-pointer'
                    )}
                  >
                    Mở công cụ MakerWorld chuyên sâu
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 3 Simple Steps Infographic */}
            {!linkDetail && (
              <div className="mt-2 grid grid-cols-1 gap-4 pt-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/60 p-4 transition-all hover:border-primary/30">
                  <div className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-xs">
                    1
                  </div>
                  <h4 className="font-heading text-sm font-bold text-foreground">
                    Tìm mẫu ưng ý
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Truy cập MakerWorld Global hoặc MakerWorld China với hàng trăm nghìn mẫu 3D miễn phí, từ đồ trang trí đến phụ kiện tiện ích.
                  </p>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/60 p-4 transition-all hover:border-primary/30">
                  <div className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-xs">
                    2
                  </div>
                  <h4 className="font-heading text-sm font-bold text-foreground">
                    Sao chép liên kết
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Copy link URL trang chi tiết mẫu (trên trình duyệt máy tính hoặc điện thoại) và dán vào ô tìm kiếm ở trên.
                  </p>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/60 p-4 transition-all hover:border-primary/30">
                  <div className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-xs">
                    3
                  </div>
                  <h4 className="font-heading text-sm font-bold text-foreground">
                    Báo giá & In ngay
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Hệ thống tự động đọc file cấu hình in (.3mf), hiển thị số lượng bàn in, thời gian in và ước tính chi phí chính xác.
                  </p>
                </div>
              </div>
            )}

            {/* Switch Helper */}
            <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs sm:text-sm">
              <span className="text-muted-foreground">
                Đã có file .STL hoặc .OBJ trên máy tính?
              </span>
              <button
                type="button"
                onClick={() => handleTabChange('file')}
                className="font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Chuyển sang Tải file từ máy tính <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* PART 2: ĐÃ CÓ FILE SẴN (QuoteFlow Dropzone & Slicing Controls) */}
      {/* ============================================================== */}
      <section
        id="panel-bao-gia-file"
        role="tabpanel"
        aria-labelledby="tab-bao-gia-file"
        className={cn(
          activeTab === 'file' ? 'block' : 'hidden print:block'
        )}
      >
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/20 p-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">
              Phương thức 2: Kéo thả file STL / OBJ để tính giá tức thì
            </h3>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Phân tích trực tiếp trên máy bạn bằng Web Worker — chưa tải lên máy chủ cho tới khi bạn gửi yêu cầu xác nhận.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleTabChange('link')}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline self-start sm:self-auto cursor-pointer"
          >
            Chưa có file? Tìm & báo giá theo link <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Live File Upload & Mesh Analysis Flow */}
        <QuoteFlow materials={materials} />

        {/* Reference Pricing Grid */}
        <div className="mt-12 print:hidden">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-lg font-bold text-foreground">
              Giá tham khảo theo cấu hình hiện hành
            </h3>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Tính bằng cùng công thức với báo giá trực tuyến, giúp bạn ước lượng nhanh chi phí theo kích thước thực tế.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {samples.map((sample) => (
              <div
                key={sample.key}
                className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
              >
                <p className="font-semibold text-foreground">{sample.title}</p>
                <p className="text-xs text-muted-foreground">{sample.description}</p>
                <p className="font-heading mt-2 text-xl font-bold text-foreground">
                  {sample.priceVnd !== null ? `~${formatVnd(sample.priceVnd)}` : 'Xưởng báo giá'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
