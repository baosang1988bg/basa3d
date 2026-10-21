import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPctChange } from '@/lib/executive-metrics';
import { cn } from '@/lib/utils';

// Phase 41: one KPI = big number + growth badge vs the previous 30 days. Pure presentational —
// the caller formats `value` (money, count or kg), so this card never decides what is money.
export function ExecutiveKpiCard({
  label,
  value,
  pctChange,
  hint,
}: {
  label: string;
  value: string;
  pctChange: number | null;
  hint?: string;
}) {
  const tone = pctChange == null || pctChange === 0 ? 'neutral' : pctChange > 0 ? 'up' : 'down';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="truncate text-sm font-medium text-muted-foreground" title={label}>{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 font-medium tabular-nums',
              tone === 'up' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
              tone === 'down' && 'bg-red-500/15 text-red-700 dark:text-red-400',
              tone === 'neutral' && 'bg-muted text-muted-foreground',
            )}
            title={pctChange == null ? '30 ngày trước chưa có số liệu để so sánh' : undefined}
          >
            {formatPctChange(pctChange)}
          </span>
          <span className="text-muted-foreground">so với 30 ngày trước</span>
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
