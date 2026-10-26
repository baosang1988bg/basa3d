'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { StorefrontButton, storefrontButtonClasses } from '@/components/storefront/button';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { createKeychainModel, exportKeychainStl, type KeychainModel } from '@/lib/keychain/keychain-engine';
import { trackKeychainExportDownload, trackKeychainPreview } from '@/lib/analytics';
import { KeychainOrderModal } from '@/components/storefront/keychain-order-modal';

const Canvas = dynamic(() => import('./keychain-generator-canvas'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center text-muted-foreground">
      <p className="animate-pulse text-sm">Đang mở bản xem trước 3D...</p>
    </div>
  ),
});

const COLOR_NAMES: Record<string, string> = {
  '#000000': 'đen',
  '#ffffff': 'trắng',
  '#ffd700': 'vàng',
  '#ef4444': 'đỏ',
  '#2563eb': 'xanh dương',
  '#16a34a': 'xanh lá',
  '#1e293b': 'xám than',
  '#f59e0b': 'cam',
  '#a855f7': 'tím',
};

const PRESET_BASE_COLORS = ['#000000', '#ffffff', '#1e293b', '#2563eb', '#ef4444'];
const PRESET_TEXT_COLORS = ['#ffd700', '#ffffff', '#ef4444', '#16a34a', '#000000'];

type ControlTab = 'text' | 'base' | 'keychain' | 'color';

function colorDescription(baseColor: string, textColor: string): string {
  return `Đế ${COLOR_NAMES[baseColor.toLowerCase()] ?? baseColor} (${baseColor.toUpperCase()}) - Chữ ${COLOR_NAMES[textColor.toLowerCase()] ?? textColor} (${textColor.toUpperCase()})`;
}

function safeFileName(text: string): string {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  return `${normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'moc-khoa'}.stl`;
}

export default function KeychainGeneratorWorkbench() {
  const [text, setText] = useState('BaSa3D');
  const [fontSizeMm, setFontSizeMm] = useState(11);
  const [letterSpacing, setLetterSpacing] = useState(1);
  const [textThicknessMm, setTextThicknessMm] = useState(1.2);

  const [baseThicknessMm, setBaseThicknessMm] = useState(3);
  const [horizontalPaddingMm, setHorizontalPaddingMm] = useState(7);
  const [verticalPaddingMm, setVerticalPaddingMm] = useState(5);
  const [cornerRadiusMm, setCornerRadiusMm] = useState(4);

  const [includeKeyringHole, setIncludeKeyringHole] = useState(true);
  const [keyringHoleDiameterMm, setKeyringHoleDiameterMm] = useState(4.8);

  const [baseColor, setBaseColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#ffd700');

  const [activeTab, setActiveTab] = useState<ControlTab>('text');
  const [model, setModel] = useState<KeychainModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      createKeychainModel({
        text,
        baseThicknessMm,
        includeKeyringHole,
        fontSizeMm,
        letterSpacing,
        horizontalPaddingMm,
        verticalPaddingMm,
        cornerRadiusMm,
        textThicknessMm,
        keyringHoleDiameterMm,
      })
        .then(async (nextModel) => {
          if (cancelled) {
            nextModel.baseGeometry.dispose();
            nextModel.textGeometry.dispose();
            nextModel.mergedGeometry.dispose();
            return;
          }
          setModel((previous) => {
            previous?.baseGeometry.dispose();
            previous?.textGeometry.dispose();
            previous?.mergedGeometry.dispose();
            return nextModel;
          });
          setError(null);
          trackKeychainPreview({ characterCount: text.trim().length, hasKeyringHole: includeKeyringHole });
          const weightGrams = estimateMeshWeightGrams(calculateMeshVolumeCm3(nextModel.mergedGeometry));
          const response = await fetch('/api/public/tool-price-estimate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ weightGrams, printMinutes: estimatePrintMinutes(weightGrams) }),
          });
          if (!cancelled && response.ok) setPrice(await response.json());
          else if (!cancelled) setPrice(null);
        })
        .catch((reason: unknown) => {
          if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể dựng mẫu.');
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    text,
    baseThicknessMm,
    includeKeyringHole,
    fontSizeMm,
    letterSpacing,
    horizontalPaddingMm,
    verticalPaddingMm,
    cornerRadiusMm,
    textThicknessMm,
    keyringHoleDiameterMm,
  ]);

  const makeStl = useCallback(() => {
    if (!model) throw new Error('Mẫu chưa sẵn sàng.');
    return exportKeychainStl(model.mergedGeometry);
  }, [model]);

  function downloadStl() {
    const blob = makeStl();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeFileName(text);
    anchor.click();
    URL.revokeObjectURL(url);
    trackKeychainExportDownload({ characterCount: text.trim().length });
  }

  function resetDesign() {
    setText('BaSa3D');
    setFontSizeMm(11);
    setLetterSpacing(1);
    setHorizontalPaddingMm(7);
    setVerticalPaddingMm(5);
    setCornerRadiusMm(4);
    setBaseThicknessMm(3);
    setTextThicknessMm(1.2);
    setIncludeKeyringHole(true);
    setKeyringHoleDiameterMm(4.8);
    setBaseColor('#000000');
    setTextColor('#ffd700');
    setError(null);
  }

  const range = (
    id: string,
    label: string,
    value: number,
    unit: string,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void
  ) => (
    <div className="text-sm">
      <div className="flex justify-between">
        <label htmlFor={id} className="font-medium text-foreground">{label}</label>
        <span className="text-muted-foreground">{value}{unit}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full accent-primary"
      />
    </div>
  );

  return (
    <>
      <div className="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* 3D Canvas Viewport */}
        <div className="h-[50dvh] min-h-[360px] bg-[radial-gradient(ellipse_at_center,_#1e293b,_#020617)] lg:h-full lg:min-h-0">
          <Canvas model={model} baseColor={baseColor} textColor={textColor} />
        </div>

        {/* Sidebar Controls Workbench */}
        <aside className="flex flex-col space-y-4 border-l bg-card p-5 lg:overflow-y-auto">
          <div>
            <h1 className="text-2xl font-bold">Tạo móc khoá 3D</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Tuỳ chỉnh chữ nổi tiếng Việt, kiểu dáng đế, lỗ gắn khoen và màu sắc.
            </p>
          </div>

          {/* Section Tabs Selector */}
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 text-xs font-semibold">
            <button
              type="button"
              className={`rounded-md py-1.5 transition-colors ${activeTab === 'text' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('text')}
            >
              Chữ
            </button>
            <button
              type="button"
              className={`rounded-md py-1.5 transition-colors ${activeTab === 'base' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('base')}
            >
              Đế thẻ
            </button>
            <button
              type="button"
              className={`flex items-center justify-center gap-1 rounded-md py-1.5 transition-colors ${activeTab === 'keychain' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('keychain')}
            >
              Móc khoá
              <span className={`inline-block size-1.5 rounded-full ${includeKeyringHole ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
            </button>
            <button
              type="button"
              className={`rounded-md py-1.5 transition-colors ${activeTab === 'color' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('color')}
            >
              Màu sắc
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="keychain-text" className="text-sm font-semibold">
                    Tên hoặc nội dung
                  </label>
                  <input
                    id="keychain-text"
                    value={text}
                    onChange={(event) => setText(event.target.value.slice(0, 24))}
                    maxLength={24}
                    placeholder="Nhập tên..."
                    className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Tối đa 24 ký tự (hỗ trợ có dấu tiếng Việt).</p>
                </div>
                {range('font-size', 'Cỡ chữ', fontSizeMm, ' mm', 6, 20, 0.5, setFontSizeMm)}
                {range('letter-spacing', 'Giãn chữ', letterSpacing, '×', 0.75, 2, 0.05, setLetterSpacing)}
                {range('text-thickness', 'Độ dày chữ nổi', textThicknessMm, ' mm', 0.6, 3, 0.2, setTextThicknessMm)}
              </div>
            )}

            {activeTab === 'base' && (
              <div className="space-y-4">
                {range('base-thickness', 'Độ dày đế', baseThicknessMm, ' mm', 2, 5, 0.5, setBaseThicknessMm)}
                {range('horizontal-padding', 'Viền ngang', horizontalPaddingMm, ' mm', 4, 16, 1, setHorizontalPaddingMm)}
                {range('vertical-padding', 'Viền dọc', verticalPaddingMm, ' mm', 3, 12, 1, setVerticalPaddingMm)}
                {range('corner-radius', 'Bo góc', cornerRadiusMm, ' mm', 1, 10, 0.5, setCornerRadiusMm)}
              </div>
            )}

            {activeTab === 'keychain' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">Lỗ gắn khoen móc khoá</p>
                    <p className="text-xs text-muted-foreground">Tự động chừa khoảng cách và cắt lỗ xuyên đế.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeKeyringHole}
                    onChange={(event) => setIncludeKeyringHole(event.target.checked)}
                    className="size-5 accent-primary"
                    aria-label="Có lỗ gắn khoen móc khoá"
                  />
                </div>

                {includeKeyringHole ? (
                  <div className="space-y-3">
                    {range('hole-diameter', 'Đường kính lỗ', keyringHoleDiameterMm, ' mm', 3, 8, 0.2, setKeyringHoleDiameterMm)}
                    <p className="text-xs text-muted-foreground">
                      Khoen tròn móc khoá thông dụng thường vừa với lỗ từ 4.5 mm – 5.0 mm.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Đã tắt lỗ khoen. Mô hình sẽ được tạo như biển tên / bảng tên phẳng (name tag).
                  </p>
                )}
              </div>
            )}

            {activeTab === 'color' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="base-color-picker" className="text-sm font-semibold">Màu đế thẻ</label>
                    <span className="text-xs font-mono text-muted-foreground">{baseColor}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {PRESET_BASE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBaseColor(c)}
                        className={`size-7 rounded-full border transition-transform ${baseColor.toLowerCase() === c.toLowerCase() ? 'scale-110 ring-2 ring-primary ring-offset-2' : ''}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Chọn màu đế ${c}`}
                      />
                    ))}
                    <input
                      id="base-color-picker"
                      aria-label="Màu đế tuỳ chỉnh"
                      type="color"
                      value={baseColor}
                      onChange={(event) => setBaseColor(event.target.value)}
                      className="ml-auto size-8 cursor-pointer rounded-md border"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="text-color-picker" className="text-sm font-semibold">Màu chữ nổi</label>
                    <span className="text-xs font-mono text-muted-foreground">{textColor}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {PRESET_TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTextColor(c)}
                        className={`size-7 rounded-full border transition-transform ${textColor.toLowerCase() === c.toLowerCase() ? 'scale-110 ring-2 ring-primary ring-offset-2' : ''}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Chọn màu chữ ${c}`}
                      />
                    ))}
                    <input
                      id="text-color-picker"
                      aria-label="Màu chữ tuỳ chỉnh"
                      type="color"
                      value={textColor}
                      onChange={(event) => setTextColor(event.target.value)}
                      className="ml-auto size-8 cursor-pointer rounded-md border"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                  Phối màu mô tả: <strong className="text-foreground">{colorDescription(baseColor, textColor)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Model Dimensions */}
          {model ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Kích thước mẫu:{' '}
              <strong className="text-foreground">
                {model.widthMm.toFixed(1)} × {model.heightMm.toFixed(1)} × {(baseThicknessMm + textThicknessMm).toFixed(1)} mm
              </strong>
            </div>
          ) : null}

          {/* Pricing Estimate */}
          {price ? (
            <div className="rounded-lg bg-primary/10 p-3.5">
              <p className="text-xs font-semibold uppercase text-primary">Ước tính tham khảo</p>
              <p className="mt-1 text-lg font-bold">
                {price.minPriceVnd.toLocaleString('vi-VN')}đ – {price.maxPriceVnd.toLocaleString('vi-VN')}đ / chiếc
              </p>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Giá tham khảo cho vật liệu PLA. Xưởng BaSa3D sẽ gửi báo giá chính xác qua SĐT/Zalo.
          </p>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

            {/* Action Buttons */}
            <div id="tool-quote" className="grid gap-2 pt-2">
              <StorefrontButton type="button" onClick={downloadStl} disabled={!model}>
                Tải STL về máy
              </StorefrontButton>
              <StorefrontButton
                type="button"
                variant="accent"
                onClick={() => setIsOrderModalOpen(true)}
                disabled={!model}
              >
                Gửi yêu cầu báo giá
              </StorefrontButton>
              <button
                type="button"
                onClick={resetDesign}
                className={storefrontButtonClasses('secondary', 'w-full text-xs')}
              >
                Đặt lại thiết kế
              </button>
            </div>
          </aside>
        </div>

        <KeychainOrderModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          text={text}
          model={model}
          baseThicknessMm={baseThicknessMm}
          textThicknessMm={textThicknessMm}
          includeKeyringHole={includeKeyringHole}
          keyringHoleDiameterMm={keyringHoleDiameterMm}
          baseColor={baseColor}
          textColor={textColor}
          price={price}
          makeStl={makeStl}
          colorDescription={colorDescription(baseColor, textColor)}
          safeFileName={safeFileName(text)}
        />
      </>
    );
  }
