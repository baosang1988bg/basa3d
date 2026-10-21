import Link from 'next/link';
import type { FilamentThresholdRow } from '@/services/dashboard.service';
import { FILAMENT_LOW_STOCK_PCT } from '@/lib/executive-metrics';
import { cn } from '@/lib/utils';

const MAX_ROWS = 8;
const grams = new Intl.NumberFormat('vi-VN');

// Phase 41 — grams only (STAFF-safe data, shown on the OWNER tab). Bar = remaining / capacity of the
// material's ACTIVE spools pooled together; the dashed mark is the SAP_HET cutoff (ADR-0044 §4).
// Pooled, so it can differ from the Materials page, which rates each spool on its own.
export function FilamentThresholdCard({ rows }: { rows: FilamentThresholdRow[] }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Chưa có cuộn nhựa nào đang hoạt động.</p>;
  }
  const visible = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {visible.map((row) => {
          const pct = row.capacityGrams > 0 ? Math.min(100, Math.max(0, (row.remainingGrams / row.capacityGrams) * 100)) : 0;
          return (
            <li key={row.materialId} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium" title={row.materialName}>{row.materialName}</span>
                <span className={cn('shrink-0 tabular-nums', row.isLow ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                  {grams.format(row.remainingGrams)} g{row.isLow ? ' · dưới ngưỡng' : ''}
                </span>
              </div>
              <div
                className="relative h-2 w-full rounded-full bg-muted"
                role="img"
                aria-label={`${row.materialName}: còn ${grams.format(row.remainingGrams)} g trên ${grams.format(row.capacityGrams)} g, ngưỡng tối thiểu ${grams.format(row.thresholdGrams)} g`}
              >
                <div className={cn('h-full rounded-full', row.isLow ? 'bg-red-500' : 'bg-muted-foreground/50')} style={{ width: `${pct}%` }} />
                <div className="absolute -bottom-1 -top-1 border-l-2 border-dashed border-foreground/60" style={{ left: `${FILAMENT_LOW_STOCK_PCT}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {row.spoolCount} cuộn · {grams.format(row.capacityGrams)} g tổng · ngưỡng {grams.format(row.thresholdGrams)} g
              </p>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Vạch đứt = ngưỡng tối thiểu {FILAMENT_LOW_STOCK_PCT}% tổng khối lượng các cuộn đang dùng.{' '}
        {hidden > 0 ? <>Còn {hidden} loại khác — </> : null}
        <Link href="/admin/materials" className="underline underline-offset-2 hover:text-foreground">Xem kho nhựa</Link>
      </p>
    </div>
  );
}
