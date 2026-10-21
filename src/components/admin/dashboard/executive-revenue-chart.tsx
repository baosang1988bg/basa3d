'use client';

import { useState } from 'react';
import type { ExecutiveDailyPoint } from '@/services/dashboard.service';
import { formatVnd, formatVndCompact, niceAxisTicks } from '@/lib/executive-metrics';
import { cn } from '@/lib/utils';

// Phase 41 — OWNER-only 30-day revenue bars. SVG only (Rule #8 AGENTS.md), no chart library.
// Weekend bars (Sat/Sun, flagged server-side from Postgres isodow) are drawn solid; weekdays faded.
// - Tooltip: hover (mouse) or tap (touch) a bar; tapping never toggles it closed.
// - Phones: the SVG keeps a 640px minimum width and scrolls sideways inside the card, so axis text
//   stays readable instead of shrinking to ~4px.
// - Screen readers: the SVG is one image; the numbers are in a visually hidden table below it.
const WIDTH = 720;
const HEIGHT = 260;
const PADDING_LEFT = 56;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 28;
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

export function ExecutiveRevenueChart({ points }: { points: ExecutiveDailyPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maxRevenue = Math.max(0, ...points.map((point) => point.revenue));

  if (!points.length || maxRevenue === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Chưa có doanh thu đơn hàng shop trong 30 ngày qua.</p>;
  }

  const ticks = niceAxisTicks(maxRevenue);
  const axisTop = ticks[ticks.length - 1];
  const slot = (WIDTH - PADDING_LEFT) / points.length;
  const barWidth = Math.max(4, Math.min(18, slot - 4));
  const yOf = (value: number) => PADDING_TOP + CHART_HEIGHT - (value / axisTop) * CHART_HEIGHT;
  const active = activeIndex != null ? points[activeIndex] : null;

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label="Biểu đồ doanh thu đơn hàng shop theo ngày, 30 ngày gần nhất. Số liệu chi tiết ở bảng ngay sau."
          onMouseLeave={() => setActiveIndex(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PADDING_LEFT} y1={yOf(tick)} x2={WIDTH} y2={yOf(tick)} className="stroke-border" strokeWidth={1} strokeDasharray={tick === 0 ? undefined : '3 3'} />
              <text x={PADDING_LEFT - 6} y={yOf(tick) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {tick === 0 ? '0' : formatVndCompact(tick).replace('₫', '')}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const x = PADDING_LEFT + index * slot + (slot - barWidth) / 2;
            const y = yOf(point.revenue);
            const showLabel = index % 5 === 0 || index === points.length - 1;
            return (
              <g key={point.date} className="cursor-pointer" onMouseEnter={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)}>
                <rect x={PADDING_LEFT + index * slot} y={PADDING_TOP} width={slot} height={CHART_HEIGHT} fill="transparent" />
                <rect
                  x={x}
                  y={point.revenue > 0 ? y : y - 1}
                  width={barWidth}
                  height={point.revenue > 0 ? PADDING_TOP + CHART_HEIGHT - y : 1}
                  rx={2}
                  className={cn(
                    point.isWeekend ? 'fill-blue-600 dark:fill-blue-400' : 'fill-blue-500/45 dark:fill-blue-400/40',
                    activeIndex === index && 'fill-blue-700 dark:fill-blue-300',
                  )}
                />
                {showLabel ? (
                  <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {point.dayLabel}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {active && activeIndex != null ? (
        <div
          className={cn(
            'pointer-events-none absolute top-0 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md',
            activeIndex < points.length / 2 ? 'right-2' : 'left-14',
          )}
        >
          <p className="font-medium">{active.weekdayLabel}, {active.dayLabel}{active.isWeekend ? ' · cuối tuần' : ''}</p>
          <p className="text-muted-foreground">Doanh thu: <span className="font-medium text-foreground">{formatVnd(active.revenue)}</span></p>
          <p className="text-muted-foreground">Số đơn: {active.orderCount}</p>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>Doanh thu đơn hàng shop theo ngày</caption>
        <thead><tr><th scope="col">Ngày</th><th scope="col">Doanh thu</th><th scope="col">Số đơn</th></tr></thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}><td>{point.weekdayLabel} {point.dayLabel}</td><td>{formatVnd(point.revenue)}</td><td>{point.orderCount}</td></tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-blue-500/45 dark:bg-blue-400/40" /> Ngày thường</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-blue-600 dark:bg-blue-400" /> Thứ 7 / Chủ nhật</span>
      </div>
    </div>
  );
}
