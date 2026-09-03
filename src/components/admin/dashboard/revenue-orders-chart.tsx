'use client';

import { useState } from 'react';
import type { OrderTrendPoint, RevenueTrendPoint } from '@/services/dashboard.service';

// SVG-only (Rule #8 AGENTS.md) — no chart library. OWNER passes `revenueTrends` (bars + revenue
// tooltip); STAFF passes only `orderTrends` (bars sized by order count) — the component never
// receives a money field it isn't supposed to render, matching the server-side split in
// dashboard.service.ts (getOperationalMetrics vs getFinancialMetrics).
export function RevenueOrdersChart({
  orderTrends,
  revenueTrends,
}: {
  orderTrends: OrderTrendPoint[];
  revenueTrends?: RevenueTrendPoint[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const points = revenueTrends ?? orderTrends;
  const showRevenue = revenueTrends != null;

  const width = 640;
  const height = 220;
  const paddingLeft = 8;
  const paddingBottom = 24;
  const chartHeight = height - paddingBottom;
  const barSlot = (width - paddingLeft) / points.length;
  const barWidth = Math.min(28, barSlot - 8);

  const maxOrderCount = Math.max(1, ...points.map((p) => p.orderCount));
  const maxRevenue = showRevenue ? Math.max(1, ...(revenueTrends ?? []).map((p) => p.revenue)) : 1;

  const linePoints = points.map((p, index) => {
    const x = paddingLeft + index * barSlot + barSlot / 2;
    const y = chartHeight - (p.orderCount / maxOrderCount) * (chartHeight - 16);
    return { x, y };
  });
  const polyline = linePoints.map((p) => `${p.x},${p.y}`).join(' ');

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const hoveredRevenue = hovered && showRevenue ? (hovered as RevenueTrendPoint).revenue : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={showRevenue ? 'Biểu đồ đơn hàng và doanh thu 14 ngày' : 'Biểu đồ sản lượng đơn hàng 14 ngày'}>
        <line x1={0} y1={chartHeight} x2={width} y2={chartHeight} stroke="var(--border)" strokeWidth={1} />
        {points.map((point, index) => {
          const x = paddingLeft + index * barSlot + (barSlot - barWidth) / 2;
          const revenueRatio = showRevenue ? (point as RevenueTrendPoint).revenue / maxRevenue : point.orderCount / maxOrderCount;
          const barHeight = revenueRatio * (chartHeight - 16);
          const y = chartHeight - barHeight;
          return (
            <g key={point.date} onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex(null)}>
              <rect x={x} y={0} width={barWidth} height={chartHeight} fill="transparent" />
              <rect
                x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} rx={3}
                fill={hoverIndex === index ? 'var(--chart-1)' : 'color-mix(in srgb, var(--chart-1) 70%, transparent)'}
              />
              <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {point.dayLabel}
              </text>
            </g>
          );
        })}
        <polyline points={polyline} fill="none" stroke="var(--chart-2)" strokeWidth={2} />
        {linePoints.map((p, index) => (
          <circle key={points[index].date} cx={p.x} cy={p.y} r={hoverIndex === index ? 4 : 2.5} fill="var(--chart-2)" />
        ))}
      </svg>
      {hovered ? (
        <div className="pointer-events-none absolute left-2 top-0 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
          <p className="font-medium">{hovered.dayLabel}</p>
          <p className="text-muted-foreground">Đơn hàng: {hovered.orderCount}</p>
          {hoveredRevenue != null ? <p className="text-muted-foreground">Doanh thu: {hoveredRevenue.toLocaleString('vi-VN')}đ</p> : null}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: 'var(--chart-1)' }} /> {showRevenue ? 'Doanh thu' : 'Số đơn'}</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: 'var(--chart-2)' }} /> Xu hướng số đơn</span>
      </div>
    </div>
  );
}
