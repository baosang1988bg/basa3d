'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  Printer,
  RotateCcw,
  Package,
} from 'lucide-react';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { decodeAfk2Model, type UnpackedModelMap } from '@/lib/3d-tools/book-maker/afk2-decoder';
import {
  layoutBookCoverFlat,
  layoutBookPagesFlat,
} from '@/lib/3d-tools/book-maker/book-maker-geometry';
import {
  exportBookToBambuMultiPlate3mf,
  exportCoverFlat3mf,
  exportPagesPlate3mf,
  exportCompletePackageZip,
  calculateBookEstimates,
} from '@/lib/3d-tools/book-maker/book-maker-export';
import { BOOK_FORMATS } from '@/lib/3d-tools/book-maker/book-maker-constants';
import { calculatePhotoBookPrice } from '@/lib/3d-tools/book-maker/book-maker-pricing';
import { uploadCustomRequestFile } from '@/lib/uploads/upload-custom-request-file';
import type { BookMakerConfig, BookDesignModifier } from '@/lib/3d-tools/book-maker/book-maker-types';
import {
  trackBookMakerView,
  trackBookMakerConfigChange,
  trackBookMakerExportDownload,
  trackBookMakerExportToRequest,
} from '@/lib/analytics';

declare global {
  interface Window {
    AFBookHub?: {
      version: string;
      open: (opts: Record<string, unknown>) => void;
      update: (opts: Record<string, unknown>) => void;
      close: () => void;
      getState?: () => Record<string, unknown>;
      getChoiceBase?: () => Record<string, unknown>;
      _debug?: () => unknown;
    };
    __basa3dOrderRequested?: boolean;
  }
}

interface ExportResultState {
  baseName: string;
  multiPlateBytes: Uint8Array;
  coverBytes: Uint8Array;
  pagesBytes: Uint8Array;
  zipBytes: Uint8Array;
  pageCount: number;
  formatLabel: string;
  coverColorHex: string;
  pageColorHex: string;
  hingeType: string;
  estimates: {
    volumeCm3: number;
    weightGrams: number;
    printMinutes: number;
  };
}

/**
 * Resolves the exact user-configured file name from AFBookHub choice payload and DOM input.
 */
function resolveBookFileName(choice: Record<string, unknown>): string {
  const domInputVal =
    typeof document !== 'undefined'
      ? (document.querySelector('.afm-fname input') as HTMLInputElement)?.value
      : '';

  const candidate =
    choice?.fileName ||
    (choice?.state as Record<string, unknown> | undefined)?.fname ||
    domInputVal ||
    choice?.fname ||
    '';

  const cleaned = String(candidate)
    .replace(/\.3mf$/i, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"/\\|?*&]+/g, ' ')
    .trim();

  return cleaned || 'my-photo-book';
}

const ASSET_VERSION = 'v=20261101_v9';

export default function BookMakerWorkbench() {
  const [exportResult, setExportResult] = useState<ExportResultState | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(() => {
    const defaultEstimate = calculatePhotoBookPrice({ formatId: 'V-MINI', pageCount: 10 });
    return { minPriceVnd: defaultEstimate.minPriceVnd, maxPriceVnd: defaultEstimate.maxPriceVnd };
  });
  const initializedRef = useRef(false);

  function triggerDownload(data: Uint8Array, filename: string, mimeType = 'model/3mf') {
    const blob = new Blob([new Uint8Array(data)], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function launchConfigurator() {
    if (!window.AFBookHub) return;

    window.AFBookHub.open({
      slug: 'book-hub',
      basePath: '/',
      fullscreen: true,
      state: 'owned',
      admin: false,
      buttonText: { owned: 'Tải dự án 3MF (Bambu Studio)' },
      foreverText: 'BaSa3D Platform · Đa đĩa in AMS',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onDownload: async (choice: any) => {
        setLoadingExport(true);
        const baseName = resolveBookFileName(choice);
        const isOrderRequest = Boolean(window.__basa3dOrderRequested);
        window.__basa3dOrderRequested = false;

        try {
          const fmtId = choice.print?.build?.fmt || choice.state?.fmt || 'V-MINI';
          const datFile = `${fmtId}.dat`;
          const res = await fetch(`/models/book-hub/${datFile}?v=12`);
          if (!res.ok) throw new Error(`Không thể tải ${datFile}`);
          const txt = await res.text();
          const modelMap: UnpackedModelMap = await decodeAfk2Model(txt);

          const rawPages = choice.print?.build?.pages ?? choice.state?.pages ?? choice.pages;
          const pages = typeof rawPages === 'number' && !isNaN(rawPages) ? rawPages : 10;
          const rawFront = choice.print?.build?.front ?? choice.state?.front ?? choice.front;
          const frontCoverType = rawFront === 'photo' ? 'photo' : 'blank';
          const rawHinge = choice.print?.build?.hinge ?? choice.state?.hinge ?? choice.hinge;
          const hingeType = rawHinge === 'fil' || rawHinge === 'filament' ? 'filament' : 'snap';
          const coverColorHex = choice.colors?.cover?.hex || choice.print?.build?.cover || '#F28DB2';
          const pageColorHex = choice.colors?.page?.hex || choice.print?.build?.page || '#F3F2EE';

          const config: BookMakerConfig = {
            formatId: fmtId,
            pages,
            frontCoverType,
            hingeType,
            coverColor: coverColorHex,
            pageColor: pageColorHex,
            foldProgress: 0,
          };

          const designModifiers: BookDesignModifier[] =
            choice.print?.build?.design ||
            choice.print?.design ||
            choice.build?.design ||
            choice.design ||
            [];

          if (process.env.NODE_ENV !== 'production') {
            console.log('[BookMaker] Resolved export config:', config);
            console.log('[BookMaker] Received design modifiers count:', designModifiers.length);
          }

          // 1. Generate flat, printable non-overlapping layouts
          const coverParts = layoutBookCoverFlat(modelMap, config, designModifiers);
          const multiPlatePages = layoutBookPagesFlat(modelMap, config, true);
          const singlePlatePages = layoutBookPagesFlat(modelMap, config, false);

          // 2. Generate multi-plate Bambu 3MF, single-plate 3MFs, and full ZIP
          const multiPlateBytes = exportBookToBambuMultiPlate3mf(coverParts, multiPlatePages, baseName);
          const coverBytes = exportCoverFlat3mf(coverParts, `${baseName} - Bìa`);
          const pagesBytes = exportPagesPlate3mf(singlePlatePages, `${baseName} - Trang`);
          const zipBytes = exportCompletePackageZip(modelMap, config, designModifiers, baseName);

          // 3. Calculate print specifications & estimates
          const allEstimatesParts = [...coverParts, ...multiPlatePages];
          const estimates = calculateBookEstimates(allEstimatesParts);
          const matchedFormat = BOOK_FORMATS.find((f) => f.id === fmtId);
          const formatLabel = matchedFormat ? matchedFormat.label : fmtId;

          const result: ExportResultState = {
            baseName,
            multiPlateBytes,
            coverBytes,
            pagesBytes,
            zipBytes,
            pageCount: config.pages,
            formatLabel,
            coverColorHex,
            pageColorHex,
            hingeType,
            estimates,
          };

          setExportResult(result);

          // Always trigger direct 3MF download
          triggerDownload(multiPlateBytes, `${baseName}.3mf`);
          trackBookMakerExportDownload({ formatId: fmtId, pageCount: config.pages, format: '3mf' });

          // Calculate specialized Photo Book pricing (Cover + Frames + Margin 40%)
          const bookPrice = calculatePhotoBookPrice({
            formatId: fmtId,
            pageCount: config.pages,
            hasCustomDesign: designModifiers.length > 0,
            frontCoverType: config.frontCoverType,
            spinePhoto: Boolean(choice.print?.build?.spinePhoto ?? choice.state?.spinePhoto),
          });
          setPrice({ minPriceVnd: bookPrice.minPriceVnd, maxPriceVnd: bookPrice.maxPriceVnd });

          // Open confirmation and factory order dialog
          setOrderModalOpen(true);

          // If user specifically requested factory order, prepare prefill upload immediately
          if (isOrderRequest) {
            void preparePrefillUpload(result);
          }
        } catch (err) {
          console.error('Lỗi xuất 3MF:', err);
          alert('Không thể tạo file in 3D: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
          setLoadingExport(false);
        }
      },
    });
  }

  async function preparePrefillUpload(result: ExportResultState) {
    setUploading(true);
    try {
      const fileName = `${result.baseName}.3mf`;
      const blob = new Blob([new Uint8Array(result.multiPlateBytes)], { type: 'model/3mf' });
      const { path, uploadClaim } = await uploadCustomRequestFile(blob, fileName);

      setPrefill({
        attachmentPath: path,
        uploadClaim,
        attachmentFileName: fileName,
        requestedMaterial: 'PLA',
        requestedColor: result.coverColorHex || '#F28DB2',
        description: `Sách ảnh 3D ${result.baseName}: Khổ ${result.formatLabel}, ${result.pageCount} trang, bản lề ${result.hingeType}. Báo giá xưởng: ${price?.minPriceVnd.toLocaleString('vi-VN')}₫ – ${price?.maxPriceVnd.toLocaleString('vi-VN')}₫ (thành phẩm hoàn thiện, kiểm tra bản lề). Đa đĩa Bambu Studio AMS.`,
      });

      trackBookMakerExportToRequest({
        formatId: result.baseName,
        pageCount: result.pageCount,
        estimatedPriceVnd: price?.minPriceVnd,
      });
    } catch (e) {
      console.error('Lỗi tải file lên xưởng in:', e);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    // 0. Track analytics: user viewed book maker tool
    trackBookMakerView();

    // 1. Add CSS stylesheet
    const cssId = 'af-book-hub-css';
    let link = document.getElementById(cssId) as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = `/tools/book-maker/af-book-hub.css?${ASSET_VERSION}`;
      document.head.appendChild(link);
    } else {
      link.href = `/tools/book-maker/af-book-hub.css?${ASSET_VERSION}`;
    }

    // 2. Load JS script
    const scriptId = 'af-book-hub-js';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `/tools/book-maker/af-book-hub.js?${ASSET_VERSION}`;
      script.async = true;
      script.onload = () => {
        if (!initializedRef.current) {
          initializedRef.current = true;
          setTimeout(launchConfigurator, 100);
        }
      };
      document.body.appendChild(script);
    } else if (window.AFBookHub && !initializedRef.current) {
      initializedRef.current = true;
      setTimeout(launchConfigurator, 100);
    }

    // 3. Inject secondary BaSa3D Factory Order button into .afc-buybox
    const interval = setInterval(() => {
      const buybox = document.querySelector('.afc-buybox');
      if (buybox) {
        if (!buybox.querySelector('.afc-order-btn')) {
          const orderBtn = document.createElement('button');
          orderBtn.type = 'button';
          orderBtn.className = 'afc-order-btn';
          orderBtn.innerHTML = '🚀 Đặt in tại xưởng BaSa3D';
          orderBtn.onclick = () => {
            window.__basa3dOrderRequested = true;
            const buy = buybox.querySelector('.afc-buy') as HTMLButtonElement;
            if (buy) buy.click();
          };
          buybox.appendChild(orderBtn);
        }
        let priceTag = buybox.querySelector('.afc-price-tag') as HTMLElement | null;
        if (!priceTag) {
          priceTag = document.createElement('div');
          priceTag.className = 'afc-price-tag';
          const fname = buybox.querySelector('.afm-fname');
          if (fname && fname.nextSibling) {
            buybox.insertBefore(priceTag, fname.nextSibling);
          } else {
            buybox.appendChild(priceTag);
          }
        }

        // Dynamically compute specialized photo book price (Cost + 40% margin)
        const st = window.AFBookHub?.getState?.();
        if (st && priceTag) {
          const estimate = calculatePhotoBookPrice({
            formatId: `${st.dir || 'V'}-${st.code || 'MINI'}`,
            pageCount: typeof st.pages === 'number' ? st.pages : 10,
            hasCustomDesign: Array.isArray(st.items) && st.items.length > 0,
            frontCoverType: st.front === 'photo' ? 'photo' : 'blank',
            spinePhoto: Boolean(st.spinePhoto),
          });
          const newHtml = `<span>💰 Giá xưởng BaSa3D:</span><b>${estimate.minPriceVnd.toLocaleString('vi-VN')}₫ – ${estimate.maxPriceVnd.toLocaleString('vi-VN')}₫</b>`;
          if (priceTag.innerHTML !== newHtml) {
            priceTag.innerHTML = newHtml;
          }
        } else if (priceTag && !priceTag.innerHTML) {
          priceTag.innerHTML = '<span>💰 Giá xưởng BaSa3D:</span><b>Từ 95.000₫ – 115.000₫</b>';
        }
      }
    }, 300);

    // Instant reactive listener for 3D configurator updates (0ms lag on chip/option click)
    const handleConfigChange = (e: Event) => {
      const customEvt = e as CustomEvent;
      const detail = customEvt.detail;
      if (!detail?.state) return;
      const st = detail.state;
      trackBookMakerConfigChange({
        formatCode: st.code,
        pageCount: typeof st.pages === 'number' ? st.pages : 10,
        coverType: st.front,
        hasSpinePhoto: Boolean(st.spinePhoto),
        hasCustomDesign: Number(detail.itemsCount) > 0,
      });

      const estimate = calculatePhotoBookPrice({
        formatId: `${st.dir || 'V'}-${st.code || 'MINI'}`,
        pageCount: typeof st.pages === 'number' ? st.pages : 10,
        hasCustomDesign: Number(detail.itemsCount) > 0,
        frontCoverType: st.front === 'photo' ? 'photo' : 'blank',
        spinePhoto: Boolean(st.spinePhoto),
      });
      setPrice({ minPriceVnd: estimate.minPriceVnd, maxPriceVnd: estimate.maxPriceVnd });
      const priceTag = document.querySelector('.afc-price-tag') as HTMLElement | null;
      if (priceTag) {
        priceTag.innerHTML = `<span>💰 Giá xưởng BaSa3D:</span><b>${estimate.minPriceVnd.toLocaleString('vi-VN')}₫ – ${estimate.maxPriceVnd.toLocaleString('vi-VN')}₫</b>`;
      }
    };
    window.addEventListener('basa3d:book-config-change', handleConfigChange);

    // Prevent Esc from ever closing or wiping the workbench UI
    const handleEscGuard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If the order confirmation dialog is open, allow closing that dialog
        // Otherwise prevent Esc from bubbling to any unhandled close handlers
        const orderDialog = document.querySelector('[role="dialog"]');
        if (!orderDialog) {
          e.stopPropagation();
        }
      }
    };
    window.addEventListener('keydown', handleEscGuard, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('basa3d:book-config-change', handleConfigChange);
      window.removeEventListener('keydown', handleEscGuard, true);
      if (window.AFBookHub) {
        try {
          window.AFBookHub.close();
        } catch {
          // Safe ignore on unmount
        }
      }
    };
  }, []);

  return (
    <div className="relative min-h-dvh bg-slate-50 text-slate-900 overflow-hidden">
      {/* 1. Sticky BaSa3D Top Navigation Bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md md:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/tools"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Danh mục công cụ</span>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-teal-600/10 text-teal-700">
              <BookOpen className="size-4" />
            </span>
            <div className="flex flex-col">
              <span className="font-heading text-sm font-bold tracking-tight text-slate-900">
                Photo Book Studio
              </span>
              <span className="hidden text-[10px] text-teal-700 font-medium sm:inline">
                BaSa3D Platform · Chuẩn Bambu AMS
              </span>
            </div>
          </div>
        </div>

        {/* Center Live Price Advisory Tag */}
        <div className="hidden lg:flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs text-amber-900 font-medium">
          <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Báo giá in xưởng ước tính:</span>
          <span className="font-bold text-amber-950">
            {price
              ? `${price.minPriceVnd.toLocaleString('vi-VN')}₫ – ${price.maxPriceVnd.toLocaleString('vi-VN')}₫`
              : '95.000₫ – 145.000₫'}{' '}
            / cuốn
          </span>
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const resetBtn = document.querySelector('.afc-reset') as HTMLButtonElement;
              if (resetBtn) resetBtn.click();
            }}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            title="Đặt lại thiết kế về mặc định"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden md:inline">Đặt lại</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const buyBtn = document.querySelector('.afc-buy') as HTMLButtonElement;
              if (buyBtn) buyBtn.click();
            }}
            disabled={loadingExport}
            className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-teal-800 active:translate-y-px transition-all"
          >
            <Download className="size-3.5" />
            <span>{loadingExport ? 'Đang tạo...' : 'Tải file 3MF'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.__basa3dOrderRequested = true;
              const buyBtn = document.querySelector('.afc-buy') as HTMLButtonElement;
              if (buyBtn) buyBtn.click();
            }}
            disabled={loadingExport}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 active:translate-y-px transition-all"
          >
            <Printer className="size-3.5" />
            <span>Đặt xưởng in</span>
          </button>
        </div>
      </header>

      {/* 2. Fullscreen Studio Target Container (AFBookHub mounts here) */}
      <div id="af-book-hub-container" className="h-[calc(100dvh-3.5rem)] w-full overflow-hidden" />

      {/* 3. Export Confirmation & BaSa3D Factory Order Dialog */}
      <Dialog open={orderModalOpen} onOpenChange={setOrderModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-teal-700">
              <CheckCircle2 className="size-5" />
              <DialogTitle className="text-lg font-bold">
                Sách ảnh 3D — Dự án in sẵn sàng!
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              File dự án đa đĩa in cho Bambu Studio AMS đã được tạo thành công. Bạn có thể tải các đĩa riêng biệt hoặc gửi yêu cầu để BaSa3D in hoàn thiện.
            </DialogDescription>
          </DialogHeader>

          {exportResult ? (
            <div className="mt-4 space-y-5">
              {/* Specs Summary Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[11px] text-slate-500">Khổ ảnh</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-900">{exportResult.formatLabel}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[11px] text-slate-500">Số trang ruột</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-900">{exportResult.pageCount} khung ảnh</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[11px] text-slate-500">Khối lượng PLA</span>
                  <p className="mt-0.5 text-xs font-bold text-teal-700">~{exportResult.estimates.weightGrams}g</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[11px] text-slate-500">Thời gian in</span>
                  <p className="mt-0.5 text-xs font-bold text-teal-700">
                    ~{Math.round(exportResult.estimates.printMinutes / 60)} giờ
                  </p>
                </div>
              </div>

              {/* Download Plate Options */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <span className="text-xs font-bold text-slate-700">Tùy chọn tải file in 3D:</span>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerDownload(exportResult.multiPlateBytes, `${exportResult.baseName}.3mf`);
                      trackBookMakerExportDownload({ formatId: exportResult.baseName, pageCount: exportResult.pageCount, format: '3mf' });
                    }}
                    className="flex items-center justify-between rounded-lg border border-teal-600/30 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition-colors"
                  >
                    <span className="truncate pr-1">⭐ Toàn bộ dự án đa đĩa</span>
                    <span className="shrink-0 text-[10px] text-teal-700 font-mono">.3mf</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerDownload(exportResult.coverBytes, `01-${exportResult.baseName}-Cover-Flat-AMS.3mf`);
                      trackBookMakerExportDownload({ formatId: exportResult.baseName, pageCount: exportResult.pageCount, format: '3mf' });
                    }}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <span className="truncate pr-1">🎨 Đĩa 1: Bìa mở phẳng AMS</span>
                    <span className="shrink-0 text-[10px] text-slate-400 font-mono">.3mf</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerDownload(exportResult.pagesBytes, `02-${exportResult.baseName}-Pages-Plate.3mf`);
                      trackBookMakerExportDownload({ formatId: exportResult.baseName, pageCount: exportResult.pageCount, format: '3mf' });
                    }}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <span className="truncate pr-1">📄 Đĩa 2+: Các trang ruột</span>
                    <span className="shrink-0 text-[10px] text-slate-400 font-mono">.3mf</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerDownload(exportResult.zipBytes, `${exportResult.baseName}-Package.zip`, 'application/zip');
                      trackBookMakerExportDownload({ formatId: exportResult.baseName, pageCount: exportResult.pageCount, format: 'zip' });
                    }}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-1 truncate pr-1">
                      <Package className="size-3.5 shrink-0 text-slate-500" /> Trọn gói (.3mf + STLs)
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400 font-mono">.zip</span>
                  </button>
                </div>
              </div>

              {/* BaSa3D Factory Order Section */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <span className="text-xs font-bold text-amber-900">Báo giá sản xuất Sách ảnh hoàn thiện tại BaSa3D:</span>
                    <p className="font-heading text-base font-extrabold text-amber-900">
                      {price
                        ? `${price.minPriceVnd.toLocaleString('vi-VN')}₫ – ${price.maxPriceVnd.toLocaleString('vi-VN')}₫`
                        : '95.000₫ – 115.000₫'}{' '}
                      <span className="text-xs font-normal text-amber-700">/ cuốn thành phẩm</span>
                    </p>
                    <p className="text-[11px] text-amber-800/90 mt-1">
                      *Bao gồm bìa in đa màu AMS, toàn bộ các đĩa trang ruột PEI, xỏ chốt và lắp ráp hoàn thiện kiểm tra bản lề xoay.
                    </p>
                  </div>

                  {!prefill ? (
                    <button
                      type="button"
                      onClick={() => void preparePrefillUpload(exportResult)}
                      disabled={uploading}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 active:translate-y-px transition-all"
                    >
                      <Printer className="size-3.5" />
                      <span>{uploading ? 'Đang chuẩn bị file...' : 'Đặt xưởng in ngay'}</span>
                    </button>
                  ) : null}
                </div>

                {prefill ? (
                  <div className="mt-4 border-t border-amber-200/80 pt-4">
                    <p className="text-xs font-semibold text-slate-700 mb-3">
                      Điền thông tin giao nhận để xưởng in BaSa3D tiến hành sản xuất:
                    </p>
                    <CustomRequestForm prefill={prefill} />
                  </div>
                ) : null}
              </div>

              {/* Return to 3D Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  ← Tiếp tục tùy biến trong 3D
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
