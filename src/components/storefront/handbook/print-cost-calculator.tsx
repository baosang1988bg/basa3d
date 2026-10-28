'use client';

import { ArrowRight } from 'lucide-react';
import { useId, useState } from 'react';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { Link } from '@/i18n/navigation';
import { computePrintCost, formatVnd, PRINT_COST_DEFAULTS, PRINT_COST_LIMITS, type PrintCostField, type PrintCostInput } from '@/lib/handbook/print-cost';
import { handbookFieldClasses, handbookLabelClasses, handbookPanelClasses } from './field-classes';

// Phase 53 — "chi phí tự in tại nhà". Client island; math in src/lib/handbook/print-cost.ts.
// B1: shows NO BaSa3D price. The CTA href/label are resolved on the server (bao-gia flag fallback)
// and passed in, so this island never imports src/data/handbook.

type FieldSpec = { field: PrintCostField; label: string; suffix: string; inputMode: 'numeric' | 'decimal' };

const FIELDS: FieldSpec[] = [
  { field: 'grams', label: 'Khối lượng nhựa (slicer báo)', suffix: 'g', inputMode: 'decimal' },
  { field: 'pricePerKg', label: 'Giá cuộn nhựa', suffix: '₫/kg', inputMode: 'numeric' },
  { field: 'hours', label: 'Thời gian in — giờ', suffix: 'h', inputMode: 'numeric' },
  { field: 'minutes', label: 'Thời gian in — phút', suffix: 'phút', inputMode: 'numeric' },
  { field: 'powerW', label: 'Công suất trung bình của máy', suffix: 'W', inputMode: 'numeric' },
  { field: 'kwhPrice', label: 'Giá điện', suffix: '₫/kWh', inputMode: 'numeric' },
  { field: 'bufferPercent', label: 'Dự phòng in hỏng / hao hụt', suffix: '%', inputMode: 'numeric' },
];

const errorText = (field: PrintCostField, kind: 'invalid' | 'out-of-range') => {
  if (kind === 'out-of-range') {
    const [min, max] = PRINT_COST_LIMITS[field];
    return `Trong khoảng ${min.toLocaleString('vi-VN')}–${max.toLocaleString('vi-VN')}.`;
  }
  return field === 'grams' ? 'Nhập số gram, ví dụ 48,6.' : 'Nhập số nguyên, ví dụ 300.000.';
};

export function PrintCostCalculator({ cta }: { cta: { href: string; label: string } }) {
  const id = useId();
  const [input, setInput] = useState<PrintCostInput>(PRINT_COST_DEFAULTS);
  const result = computePrintCost(input);
  const errors = result.ok ? {} : result.errors;

  return (
    <div className={handbookPanelClasses}>
      <p className="font-semibold">Ước tính chi phí tự in tại nhà</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Lấy khối lượng và thời gian từ màn hình Preview của slicer. Các số điền sẵn chỉ là ví dụ — hãy thay bằng giá cuộn nhựa và hoá đơn điện của bạn.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ field, label, suffix, inputMode }) => {
          const error = errors[field];
          return (
            <div key={field} className="space-y-1.5">
              <label htmlFor={`${id}-${field}`} className={handbookLabelClasses}>{label}</label>
              <div className="relative">
                <input
                  id={`${id}-${field}`}
                  type="text"
                  inputMode={inputMode}
                  autoComplete="off"
                  value={input[field]}
                  onChange={(event) => setInput((prev) => ({ ...prev, [field]: event.target.value }))}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-${field}-err` : undefined}
                  className={`${handbookFieldClasses} pr-16`}
                />
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span>
              </div>
              {error && <p id={`${id}-${field}-err`} className="text-xs text-destructive">{errorText(field, error)}</p>}
            </div>
          );
        })}
      </div>

      <output aria-live="polite" className="mt-4 block rounded-lg bg-primary/5 p-4">
        {result.ok ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">Nhựa</dt>
            <dd className="text-right">{formatVnd(result.filamentVnd)}</dd>
            <dt className="text-muted-foreground">Điện (~{(result.energyWh / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kWh)</dt>
            <dd className="text-right">{formatVnd(result.electricityVnd)}</dd>
            <dt className="text-muted-foreground">Dự phòng</dt>
            <dd className="text-right">{formatVnd(result.bufferVnd)}</dd>
            <dt className="mt-1 border-t border-border pt-2 font-semibold">Tổng ước tính</dt>
            <dd className="mt-1 border-t border-border pt-2 text-right text-xl font-extrabold text-primary">{formatVnd(result.totalVnd)}</dd>
          </dl>
        ) : (
          <span className="text-sm text-muted-foreground">Sửa các ô báo lỗi để xem ước tính.</span>
        )}
      </output>

      <p className="mt-3 text-xs text-muted-foreground">
        Chưa tính khấu hao máy, đầu phun, bàn in và công hậu kỳ. Đây không phải giá in của BaSa3D.
      </p>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">Không có máy, hoặc không muốn mất công hiệu chỉnh? Để xưởng in giúp bạn.</p>
        <Link href={cta.href} className={storefrontButtonClasses('primary', 'shrink-0 gap-1.5 text-sm')}>
          {cta.label}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
