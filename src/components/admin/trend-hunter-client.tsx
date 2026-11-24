'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  ExternalLink,
  Flame,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  Clock,
  Weight,
  Layers,
  ClipboardPaste,
  Globe,
  Tag,
  AlertCircle,
  ShoppingBag,
  Eye,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  CURATED_TREND_FEEDS,
} from '@/lib/search/meta-engines';
import type {
  TrendCapturedDraft,
  TrendWatchItem,
} from '@/services/trend-hunter.service';
import type { LicenseSafetyInfo } from '@/lib/trend/license-safety';
import { TREND_WATCH_STATUSES, canTransitionTrendStatus, type TrendWatchStatus } from '@/lib/trend/watch-status';
import { Button } from '@/components/ui/button';

const STATUS_LABELS: Record<TrendWatchStatus, { label: string; color: string }> = {
  WATCHING: { label: 'Đang theo dõi', color: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800' },
  PRINT_TESTING: { label: 'Đang in thử', color: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800' },
  CONVERTED_DRAFT: { label: 'Đã tạo SP nháp', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800' },
  ARCHIVED: { label: 'Đã lưu trữ', color: 'bg-muted text-muted-foreground border-border' },
};

export function TrendHunterClient({ initialItems = [], loadError = null }: { initialItems?: TrendWatchItem[]; loadError?: string | null }) {
  const [activeTab, setActiveTab] = useState<'feeds' | 'capture' | 'watchlist'>('feeds');
  const [urlInput, setUrlInput] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TrendCapturedDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const [watchlist, setWatchlist] = useState<TrendWatchItem[]>(initialItems);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(loadError);
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [licenseFilter, setLicenseFilter] = useState<'ALL' | 'CAN_SELL' | 'NO_SELL'>('ALL');

  function calculateSuggestedPrice(grams: number | null, printMinutes: number | null): number {
    const g = grams ?? 50;
    const m = printMinutes ?? 60;
    const raw = g * 550 + m * 250 + 25_000;
    return Math.max(35_000, Math.round(raw / 5_000) * 5_000);
  }

  type ConvertibleItem = {
    /** Watchlist id — required to link the product and arm the server publish gate (ADR-0063). */
    id?: string;
    title: string;
    sourceUrl: string;
    license?: string | null;
    licenseSafety?: LicenseSafetyInfo;
    estimatedGrams?: number | null;
    estimatedPrintMinutes?: number | null;
    notes?: string;
  };

  /** Returns false when staff cancels the license warning. */
  function confirmLicenseForSale(item: ConvertibleItem): boolean {
    if (item.licenseSafety?.canDirectSell) return true;
    return window.confirm(
      `⚠️ CẢNH BÁO BẢN QUYỀN:\n\n` +
      `Mẫu này mang giấy phép [${item.license || item.licenseSafety?.badgeLabel || 'chưa rõ'}] — chưa được xác nhận là được phép bán thương mại.\n\n` +
      `${item.licenseSafety?.explanation ?? ''}\n\n` +
      `Nếu bạn vẫn muốn tạo sản phẩm nháp (DRAFT) để chuẩn bị, hãy đảm bảo bạn chỉ bán khi đã có sự đồng ý của tác giả hoặc tự in và chụp ảnh sản phẩm thật của xưởng.\n\n` +
      `Bạn có muốn tiếp tục mở form đăng bán không?`
    );
  }

  function openProductForm(item: ConvertibleItem) {
    const price = calculateSuggestedPrice(item.estimatedGrams ?? null, item.estimatedPrintMinutes ?? null);
    const params = new URLSearchParams({
      title: item.title,
      basePrice: String(price),
      sourceUrl: item.sourceUrl,
      // ADR-0062 §5: the product form only pre-selects "Có license" for COMMERCIAL_ALLOWED.
      licenseStatus: item.licenseSafety?.status ?? 'UNKNOWN',
      ...(item.id ? { trendItemId: item.id } : {}),
      notes: item.notes || `Mẫu săn từ Trend Radar: ${item.sourceUrl}`,
    });
    window.location.href = `/basaadmin/products/new?${params.toString()}`;
  }

  /** Capture tab: a draft has no id yet, so it is saved to the watchlist first, then converted. */
  async function handleConvertDraft(item: TrendCapturedDraft) {
    if (!confirmLicenseForSale(item)) return;
    try {
      setSaving(true);
      const res = await fetch('/api/admin/trend-hunter/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data?.id) {
        alert(json?.message || 'Không thể lưu mẫu vào Watchlist trước khi tạo sản phẩm.');
        return;
      }
      openProductForm({ ...item, id: json.data.id });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchWatchlist();
  }, []);

  async function fetchWatchlist() {
    try {
      setLoadingWatchlist(true);
      const res = await fetch('/api/admin/trend-hunter/items');
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.data) {
        setWatchlistError(data?.message || 'Không tải được Watchlist (kiểm tra migration trend_watch_items).');
        return;
      }
      setWatchlist(data.data);
      setWatchlistError(null);
    } catch {
      setWatchlistError('Không tải được Watchlist — lỗi mạng.');
    } finally {
      setLoadingWatchlist(false);
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
        runCapture(text);
      }
    } catch {
      // Ignore clipboard read error
    }
  }

  async function runCapture(targetUrl?: string) {
    const urlToCapture = (targetUrl ?? urlInput).trim();
    if (!urlToCapture) return;

    try {
      setCapturing(true);
      setCaptureError(null);
      setDraft(null);

      const res = await fetch('/api/admin/trend-hunter/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToCapture }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Không thể trích xuất thông tin từ URL.');
      }

      setDraft(json.data);
      setActiveTab('capture');
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setCapturing(false);
    }
  }

  async function handleSaveToWatchlist() {
    if (!draft) return;
    try {
      setSaving(true);
      const res = await fetch('/api/admin/trend-hunter/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Lỗi khi lưu.');
      }

      await fetchWatchlist();
      setActiveTab('watchlist');
      setDraft(null);
      setUrlInput('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể lưu mẫu.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(id: string, newStatus: TrendWatchStatus): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/trend-hunter/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'Không thể cập nhật trạng thái.');
        return false;
      }
      setWatchlist((prev) => prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)));
      return true;
    } catch {
      alert('Không thể cập nhật trạng thái — lỗi mạng.');
      return false;
    }
  }

  async function handleDeleteItem(id: string) {
    if (!confirm('Bạn có chắc muốn xoá mẫu này khỏi Watchlist?')) return;
    try {
      const res = await fetch(`/api/admin/trend-hunter/items?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'Không thể xoá mẫu. Nhân viên hãy chuyển sang "Lưu trữ" thay vì xoá.');
        return;
      }
      setWatchlist((prev) => prev.filter((item) => item.id !== id));
    } catch {
      alert('Không thể xoá mẫu — lỗi mạng.');
    }
  }

  const filteredWatchlist = watchlist.filter((item) => {
    if (platformFilter !== 'ALL' && item.platform !== platformFilter) return false;
    if (licenseFilter === 'CAN_SELL') return item.licenseSafety?.canDirectSell;
    if (licenseFilter === 'NO_SELL') return !item.licenseSafety?.canDirectSell;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Capture Bar */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <Flame className="size-4 text-amber-500" />
                Trend Radar
              </span>
              <span className="text-xs text-muted-foreground">Săn mẫu hot in 3D đón đầu thị trường</span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Trung Tâm Săn Mẫu Trend
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'feeds' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('feeds')}
              className="gap-1.5"
            >
              <Globe className="size-4" />
              Nguồn Săn Trend ({CURATED_TREND_FEEDS.length})
            </Button>
            <Button
              variant={activeTab === 'capture' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('capture')}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Bắt Mẫu URL
            </Button>
            <Button
              variant={activeTab === 'watchlist' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('watchlist')}
              className="gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              Watchlist ({watchlist.length})
            </Button>
          </div>
        </div>

        {/* Global Quick Input Bar */}
        <div className="mt-5 border-t border-border/60 pt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runCapture();
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Dán liên kết mẫu hot từ MakerWorld (Global / CN), Printables, Thingiverse, Douyin..."
                className="h-11 w-full rounded-xl border border-input bg-background/90 px-4 pr-24 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/80 flex items-center gap-1"
              >
                <ClipboardPaste className="size-3.5" />
                Dán
              </button>
            </div>
            <Button type="submit" disabled={capturing} className="h-11 gap-2 px-5">
              {capturing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Phân Tích & Bắt Mẫu
            </Button>
          </form>

          {captureError && (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{captureError}</span>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: CURATED FEEDS */}
      {activeTab === 'feeds' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Globe className="size-5 text-primary" />
              Các Kênh Săn Trend Chọn Lọc (Bấm là mở ngay)
            </h2>
            <span className="text-xs text-muted-foreground">
              Mẹo: Lướt bảng Download TQ hoặc Douyin, thấy mẫu nào hay thì copy link dán vào ô trên!
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CURATED_TREND_FEEDS.map((feed) => (
              <div
                key={feed.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {feed.badge}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">{feed.source}</span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {feed.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                    {feed.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50">
                  <a
                    href={feed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    <span>Mở Kênh Này</span>
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CAPTURE PREVIEW */}
      {activeTab === 'capture' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Kết quả Phân Tích Mẫu</h2>
          {draft ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="grid gap-6 md:grid-cols-[280px_1fr]">
                {/* Cover Image */}
                <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center">
                  {draft.coverUrl ? (
                    <img
                      src={draft.coverUrl}
                      alt={draft.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground">Không có ảnh bìa</div>
                  )}
                  <span className="absolute left-2.5 top-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white uppercase">
                    {draft.platform}
                  </span>
                </div>

                {/* Info & Specs */}
                <div className="flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-extrabold text-foreground">{draft.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {draft.author && <span>Tác giả: <b>{draft.author}</b></span>}
                      {draft.license && <span>Giấy phép: <b>{draft.license}</b></span>}
                      <a
                        href={draft.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <span>Mở trang gốc</span>
                        <ExternalLink className="size-3" />
                      </a>
                    </div>

                    {/* Sliced Specs */}
                    <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-secondary/50 p-3.5">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Weight className="size-4 text-primary mb-1" />
                        <span className="text-[11px] text-muted-foreground">Khối lượng</span>
                        <span className="text-sm font-bold text-foreground">
                          {draft.estimatedGrams ? `${draft.estimatedGrams}g` : 'Chưa rõ'}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center text-center">
                        <Clock className="size-4 text-primary mb-1" />
                        <span className="text-[11px] text-muted-foreground">Thời gian in</span>
                        <span className="text-sm font-bold text-foreground">
                          {draft.estimatedPrintMinutes
                            ? `${Math.floor(draft.estimatedPrintMinutes / 60)}h ${draft.estimatedPrintMinutes % 60}m`
                            : 'Chưa rõ'}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center text-center">
                        <Layers className="size-4 text-primary mb-1" />
                        <span className="text-[11px] text-muted-foreground">Số bàn / Profile</span>
                        <span className="text-sm font-bold text-foreground">
                          {draft.plateCount ?? 1} bàn
                        </span>
                      </div>
                    </div>

                    {/* License Safety Advisory */}
                    <div className="mt-4 rounded-xl border border-border/80 bg-secondary/30 p-3.5 text-xs flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          {draft.licenseSafety.canDirectSell ? (
                            <ShieldCheck className="size-4 text-emerald-500" />
                          ) : (
                            <ShieldAlert className="size-4 text-amber-500" />
                          )}
                          Kiểm Tra Bản Quyền:
                        </span>
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${draft.licenseSafety.badgeColor}`}>
                          {draft.licenseSafety.badgeLabel}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        {draft.licenseSafety.explanation}
                      </p>
                    </div>

                    {/* Category Tag Input */}
                    <div className="mt-4 flex items-center gap-2">
                      <Tag className="size-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Danh mục gán:</span>
                      <input
                        type="text"
                        value={draft.categoryTag}
                        onChange={(e) => setDraft({ ...draft, categoryTag: e.target.value })}
                        className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button onClick={handleSaveToWatchlist} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      Lưu Vào Watchlist Săn Mẫu
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleConvertDraft(draft)}
                      className="gap-2"
                    >
                      <ShoppingBag className="size-4 text-primary" />
                      Đăng Bán SP Catalog (~{calculateSuggestedPrice(draft.estimatedGrams, draft.estimatedPrintMinutes).toLocaleString('vi-VN')}đ)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDraft(null);
                        setUrlInput('');
                      }}
                    >
                      Bỏ qua
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              Dán một liên kết bất kỳ vào thanh tìm kiếm phía trên để xem trước và lưu thông số mẫu.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WATCHLIST */}
      {activeTab === 'watchlist' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
                Danh Sách Mẫu Đang Theo Dõi ({filteredWatchlist.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Quản lý các mẫu tiềm năng, theo dõi tiến độ in thử trước khi đưa lên Catalog bán.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-col gap-2 items-start sm:items-end">
              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', 'MAKERWORLD_CN', 'MAKERWORLD', 'PRINTABLES', 'THINGIVERSE', 'DOUYIN'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      platformFilter === p
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground text-[11px]">Bản quyền:</span>
                <button
                  type="button"
                  onClick={() => setLicenseFilter('ALL')}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    licenseFilter === 'ALL' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setLicenseFilter('CAN_SELL')}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    licenseFilter === 'CAN_SELL' ? 'bg-emerald-600 text-white' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  }`}
                >
                  🟢 Được bán (CC-BY/CC0)
                </button>
                <button
                  type="button"
                  onClick={() => setLicenseFilter('NO_SELL')}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    licenseFilter === 'NO_SELL' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                  }`}
                >
                  🔴 Cấm bán (In gia công)
                </button>
              </div>
            </div>
          </div>

          {watchlistError ? (
            <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-500/10 p-3 text-sm text-rose-700 dark:border-rose-800 dark:text-rose-300">
              {watchlistError}
            </p>
          ) : null}

          {loadingWatchlist ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : filteredWatchlist.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              Chưa có mẫu nào trong danh sách theo dõi. Hãy dùng tab &quot;Nguồn Săn Trend&quot; hoặc dán URL để lưu mẫu!
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredWatchlist.map((item) => {
                const statusMeta = STATUS_LABELS[item.status];
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    <div>
                      {/* Image & Header */}
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                        {item.coverUrl ? (
                          <img
                            src={item.coverUrl}
                            alt={item.title}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                            Không có ảnh
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                          {item.platform}
                        </span>
                      </div>

                      <h3 className="mt-3 font-bold text-foreground text-sm line-clamp-1">{item.title}</h3>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">{item.categoryTag}</p>
                        {item.licenseSafety && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${item.licenseSafety.badgeColor}`}
                            title={item.licenseSafety.explanation}
                          >
                            {item.licenseSafety.badgeLabel}
                          </span>
                        )}
                      </div>

                      {/* Specs */}
                      <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
                        {item.estimatedGrams && (
                          <span className="flex items-center gap-1 font-medium">
                            <Weight className="size-3.5 text-primary" />
                            {item.estimatedGrams}g
                          </span>
                        )}
                        {item.estimatedPrintMinutes && (
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="size-3.5 text-primary" />
                            {Math.floor(item.estimatedPrintMinutes / 60)}h{item.estimatedPrintMinutes % 60}m
                          </span>
                        )}
                        {(item.platform === 'MAKERWORLD' || item.platform === 'MAKERWORLD_CN') && (
                          <a
                            href={`/tools/makerworld-cn?url=${encodeURIComponent(item.sourceUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                            title="Xem bàn in, thông số cắt lớp & tải 3MF"
                          >
                            <Eye className="size-3 text-primary" />
                            <span>Bàn in</span>
                          </a>
                        )}
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                        >
                          <span>Mở web</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>

                    {/* Popularity / velocity (ADR-0063 U5) */}
                    {item.popularity ? (
                      <p className="mt-3 text-[11px] text-muted-foreground" title={`Số liệu ngày ${item.popularity.capturedOn}`}>
                        {item.popularity.downloads !== null ? <span>⬇ {item.popularity.downloads.toLocaleString('vi-VN')}</span> : null}
                        {item.popularity.likes !== null ? <span className="ml-2">♥ {item.popularity.likes.toLocaleString('vi-VN')}</span> : null}
                        {item.popularity.downloadsPerDay !== null ? (
                          <span className={`ml-2 font-semibold ${item.popularity.downloadsPerDay >= 50 ? 'text-rose-600' : 'text-foreground'}`}>
                            +{item.popularity.downloadsPerDay.toLocaleString('vi-VN')} lượt tải/ngày ({item.popularity.windowDays} ngày)
                          </span>
                        ) : <span className="ml-2">Đang chờ đủ 2 ngày số liệu để tính độ nóng</span>}
                      </p>
                    ) : null}
                    {item.licenseSource === 'NONE' ? (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">License chưa lấy được từ nền tảng — kiểm tra tay trên trang gốc.</p>
                    ) : null}

                    {/* Status & Actions */}
                    <div className="mt-4 border-t border-border/50 pt-3 flex items-center justify-between">
                      <select
                        value={item.status}
                        onChange={(e) => handleUpdateStatus(item.id, e.target.value as TrendWatchStatus)}
                        className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusMeta.color}`}
                      >
                        {TREND_WATCH_STATUSES.map((value) => (
                          <option key={value} value={value} disabled={!canTransitionTrendStatus(item.status, value)}>
                            {STATUS_LABELS[value].label}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={Boolean(item.productId) || !canTransitionTrendStatus(item.status, 'CONVERTED_DRAFT')}
                          onClick={() => {
                            // The server links the product and sets CONVERTED_DRAFT when the product is created (ADR-0063).
                            if (!confirmLicenseForSale(item)) return;
                            openProductForm(item);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            item.licenseSafety?.canDirectSell
                              ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-600 hover:text-white dark:text-emerald-400'
                              : 'bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border'
                          }`}
                          title={
                            item.licenseSafety?.canDirectSell
                              ? 'Mẫu hợp pháp để tạo sản phẩm Catalog bán đại trà'
                              : 'Mẫu cấm bán thương mại - Bấm để xem cảnh báo'
                          }
                        >
                          <ShoppingBag className="size-3.5" />
                          <span>{item.productId ? 'Đã tạo SP' : item.licenseSafety?.canDirectSell ? 'Đăng bán' : 'Bán (Cảnh báo)'}</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem(item.id)}
                          className="size-8 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
