'use client';

import { useState, useEffect, type FormEvent } from 'react';
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ClipboardPaste,
} from 'lucide-react';
import type { MakerWorldCnModelDetail } from '@/app/api/public/makerworld-cn/resolve/route';
import { MakerWorldQuoteResult } from './makerworld-quote-result';
import {
  analyticsErrorCode,
  getMakerWorldSourceHost,
  trackMakerWorldResolve,
} from '@/lib/analytics';

const SAMPLES = [
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

export function MakerWorldCnTool({ initialUrl }: { initialUrl?: string } = {}) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MakerWorldCnModelDetail | null>(null);

  async function handlePasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        handleResolve(text);
      }
    } catch {
      // Ignore clipboard permission rejections silently
    }
  }

  async function handleResolve(targetUrl?: string) {
    const raw = (targetUrl ?? url).trim();
    if (!raw) return;

    // Never send `raw` itself: it is free-form user input (may carry share tokens or PII).
    const sourceHost = getMakerWorldSourceHost(raw);
    let failedStatus: number | undefined;

    setLoading(true);
    setError(null);

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
      setDetail(data.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi phân tích liên kết.';
      trackMakerWorldResolve({ success: false, source_host: sourceHost, error_code: analyticsErrorCode(failedStatus) });
      setError(msg);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialUrl && initialUrl.trim()) {
      handleResolve(initialUrl.trim());
    }
  }, [initialUrl]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleResolve();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Search / Input Box */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="mw-input-url" className="text-sm font-semibold text-foreground">
            Dán liên kết mô hình MakerWorld (Trung Quốc hoặc Quốc tế)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <input
                id="mw-input-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Dán link MakerWorld (.com hoặc .com.cn) hoặc văn bản chia sẻ từ app..."
                disabled={loading}
                className="w-full rounded-xl border border-input bg-background pl-4 pr-11 py-3 text-sm text-foreground shadow-xs placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
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
              disabled={loading || !url.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Đang phân tích…</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>Xem mẫu</span>
                </>
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Ví dụ định dạng link:</span>
            <span className="font-mono text-[11px] text-foreground/80 bg-muted px-2 py-0.5 rounded">
              makerworld.com/en/models/12345
            </span>
            <span className="font-mono text-[11px] text-foreground/80 bg-muted px-2 py-0.5 rounded">
              makerworld.com.cn/zh/models/12345
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span>Bấm thử mẫu:</span>
            {SAMPLES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setUrl(s.url);
                  handleResolve(s.url);
                }}
                className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground hover:bg-muted transition cursor-pointer"
              >
                {s.label}
              </button>
            ))}
          </div>
        </form>

        {error ? (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-5 shrink-0" />
              <span>{error}</span>
            </div>
            <a
              href="https://mwc.3dhubvn.net/makerworld-cn"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-xs font-semibold underline sm:self-auto"
            >
              <span>Thử mở công cụ dự phòng 3DHubVN</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        ) : null}
      </div>

      {/* Result Section */}
      {detail ? (
        <MakerWorldQuoteResult detail={detail} onReset={() => setDetail(null)} />
      ) : (
        /* Empty State / How-it-works guide */
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">1</div>
            <h3 className="font-heading font-semibold text-base text-foreground mt-1">Chọn mẫu 3D từ mọi nguồn</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sao chép liên kết từ <code className="text-primary font-mono">makerworld.com</code> (Quốc tế) hoặc <code className="text-primary font-mono">makerworld.com.cn</code> (kho nội địa Trung Quốc), kể cả link chia sẻ từ app di động.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">2</div>
            <h3 className="font-heading font-semibold text-base text-foreground mt-1">Dán link & Xem báo giá ngay</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dán liên kết vào ô ở trên. Hệ thống tự động bóc tách từng bàn in, số gram nhựa, thời gian in, xem trước hình khối 3D và tính ngay giá in xưởng ước tính.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">3</div>
            <h3 className="font-heading font-semibold text-base text-foreground mt-1">Tải file 3MF hoặc Đặt in xưởng</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bấm tải trực tiếp file .3mf về máy để tự in (vượt qua rào cản tài khoản nội địa), hoặc gửi ngay yêu cầu xưởng BaSa3D in hoàn thiện giao tận nhà.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
