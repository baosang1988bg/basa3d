'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Loader2, AlertCircle, Download, Printer, ExternalLink, Box } from 'lucide-react';
import MeshViewer from '@/components/bao-gia/mesh-viewer';
import { threeMfToPositions } from '@/lib/stl-import/threemf-mesh';
import { Link } from '@/i18n/navigation';
import { formatVnd } from '@/components/storefront/format';

export interface MakerWorld3dModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string;
  profileId: string;
  profileTitle: string;
  sourceUrl: string;
  isChinaModel?: boolean;
  onDownload?: () => void;
  estimatedPriceVnd?: number | null;
}

export function MakerWorld3dModal({
  isOpen,
  onClose,
  modelId,
  profileId,
  profileTitle,
  sourceUrl,
  isChinaModel = true,
  onDownload,
  estimatedPriceVnd,
}: MakerWorld3dModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<Float32Array | null>(null);
  const [scalePct, setScalePct] = useState(100);

  const loadGeometry = useCallback(async () => {
    if (!modelId || !profileId) return;

    if (!isChinaModel) {
      setError(
        'Tính năng bóc tách hình khối 3D từ file .3MF áp dụng cho các mẫu nội địa MakerWorld Trung Quốc (nhờ máy chủ giải mã 3MF). Với mẫu Quốc Tế, bạn có thể mở xem trực tiếp 3D trên trang web MakerWorld chính chủ.'
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPositions(null);
    setScalePct(100);

    try {
      const res = await fetch('/api/public/makerworld-cn/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, profileId }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.message || 'Không thể tải file .3MF từ nguồn cung cấp để dựng hình 3D.'
        );
      }

      const buffer = await res.arrayBuffer();
      const pos = threeMfToPositions(new Uint8Array(buffer));
      setPositions(pos);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể phân tích hình khối 3D từ file .3MF này.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [modelId, profileId]);

  useEffect(() => {
    if (isOpen) {
      loadGeometry();
    } else {
      setPositions(null);
      setError(null);
    }
  }, [isOpen, loadGeometry]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="makerworld-3d-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-muted/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Box className="size-4" />
            </span>
            <div className="min-w-0">
              <h3
                id="makerworld-3d-modal-title"
                className="font-bold text-sm sm:text-base text-foreground truncate"
                title={profileTitle}
              >
                Xem trước 3D: {profileTitle}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                Mã mẫu #{modelId} · Bàn in #{profileId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Đang tải và giải nén dữ liệu 3D (.3MF)…
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Hệ thống đang trích xuất hình khối trực tiếp trên trình duyệt. Quá trình này
                mất vài giây tuỳ vào kích thước bàn in.
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 gap-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="size-6" />
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <h4 className="font-semibold text-sm text-foreground">
                  Không thể dựng hình 3D trực tiếp
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                {onDownload ? (
                  <button
                    type="button"
                    onClick={onDownload}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                  >
                    <Download className="size-3.5" />
                    <span>Tải file .3MF về máy</span>
                  </button>
                ) : null}
                <a
                  href="https://mwc.3dhubvn.net/makerworld-cn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-background px-4 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  <span>Mở trên 3DHubVN</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          ) : positions ? (
            <div className="w-full">
              <MeshViewer
                positions={positions}
                label={profileTitle}
                scalePct={scalePct}
                onScaleChange={setScalePct}
              />
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/80 px-5 py-3 bg-muted/20">
          <span className="text-[11px] text-muted-foreground">
            💡 Dùng chuột kéo để xoay 360°, cuộn để phóng to / thu nhỏ.
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {onDownload ? (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
              >
                <Download className="size-3.5" />
                <span>Tải .3MF</span>
              </button>
            ) : null}

            <Link
              href={`/custom-print?modelUrl=${encodeURIComponent(sourceUrl)}&profileId=${encodeURIComponent(profileId)}&title=${encodeURIComponent(profileTitle)}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <Printer className="size-3.5" />
              <span>Đặt in BaSa3D {estimatedPriceVnd ? `(~${formatVnd(estimatedPriceVnd)})` : ''}</span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
