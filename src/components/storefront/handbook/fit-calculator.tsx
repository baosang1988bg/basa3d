'use client';

import { useId, useState } from 'react';
import { computeFit, FIT_DIAMETER_MAX_MM, FIT_DIAMETER_MIN_MM, formatUm, type FitMode, type FitOption } from '@/lib/handbook/fit';
import { cn } from '@/lib/utils';
import { handbookFieldClasses, handbookLabelClasses, handbookPanelClasses } from './field-classes';

// Phase 53 — client island. Receives the trimmed tolerance rows as props from HandbookBlocks (never
// imports src/data/handbook). The math lives in src/lib/handbook/fit.ts and is unit-tested.

const MODE_COPY: Record<FitMode, { input: string; output: string }> = {
  'shaft-known': { input: 'Đường kính trục / chốt / bu lông có sẵn', output: 'Vẽ lỗ trong CAD' },
  'hole-known': { input: 'Đường kính lỗ có sẵn', output: 'Vẽ trục / chốt trong CAD' },
};

const ERROR_COPY = {
  invalid: 'Nhập số mm, ví dụ 8 hoặc 3,5.',
  'out-of-range': `Nhập từ ${FIT_DIAMETER_MIN_MM} đến ${FIT_DIAMETER_MAX_MM} mm.`,
  'no-room': 'Lỗ quá nhỏ so với khe hở của kiểu lắp này.',
} as const;

export function FitCalculator({ options }: { options: FitOption[] }) {
  const id = useId();
  const [mode, setMode] = useState<FitMode>('shaft-known');
  const [raw, setRaw] = useState('8');
  const [fitId, setFitId] = useState(options[0]?.id ?? '');
  const option = options.find((o) => o.id === fitId) ?? options[0];
  if (!option) return null;

  const result = computeFit(mode, raw, option);
  const error = !result.ok && result.reason !== 'empty' ? ERROR_COPY[result.reason] : null;

  return (
    <div className={handbookPanelClasses}>
      <p className="font-semibold">Máy tính khe hở lắp ghép</p>
      <p className="mt-1 text-sm text-muted-foreground">Dựa trên bảng khe hở ở trên (đầu phun 0.4 mm, máy đã hiệu chỉnh flow).</p>

      <div role="group" aria-label="Bạn đang có chi tiết nào?" className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(MODE_COPY) as FitMode[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              'min-h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              mode === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {key === 'shaft-known' ? 'Tôi có trục' : 'Tôi có lỗ'}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-d`} className={handbookLabelClasses}>{MODE_COPY[mode].input} (mm)</label>
          <input
            id={`${id}-d`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            className={handbookFieldClasses}
          />
          {error && <p id={`${id}-err`} className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-fit`} className={handbookLabelClasses}>Kiểu lắp</label>
          <select id={`${id}-fit`} value={option.id} onChange={(event) => setFitId(event.target.value)} className={handbookFieldClasses}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.fit}</option>
            ))}
          </select>
        </div>
      </div>

      <output htmlFor={`${id}-d ${id}-fit`} aria-live="polite" className="mt-4 block rounded-lg bg-primary/5 p-4">
        {result.ok ? (
          <>
            <span className="block text-sm text-muted-foreground">{MODE_COPY[mode].output}</span>
            <span className="mt-0.5 block text-2xl font-extrabold tabular-nums text-primary">
              Ø{formatUm(result.targetUm[0])}–{formatUm(result.targetUm[1])} mm
            </span>
            <span className="mt-1 block text-sm text-muted-foreground tabular-nums">
              Khe mỗi bên {formatUm(result.clearanceUm[0])}–{formatUm(result.clearanceUm[1])} mm.
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Nhập đường kính để xem kích thước gợi ý.</span>
        )}
      </output>

      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-primary">
        <li>
          Muốn bù trong slicer thay vì sửa CAD: <span className="font-medium text-foreground">Bambu Studio / OrcaSlicer → X-Y hole compensation</span> (giá trị dương làm lỗ to ra) bằng khe mỗi bên ở trên.
        </li>
        <li className="font-medium text-foreground">Chỉ chọn một trong hai — vừa cộng khe trong CAD vừa bật bù trong slicer sẽ thành lỏng gấp đôi.</li>
        <li>In thử một mẫu test dung sai trên đúng máy và cuộn nhựa trước khi in chi tiết thật.</li>
      </ul>
    </div>
  );
}
