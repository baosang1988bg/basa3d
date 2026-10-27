import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatPctChange } from '@/lib/executive-metrics';
import { cn } from '@/lib/utils';

// Dashboard visual primitives (UX refresh 2026-10-27, after the "Pulse" realtime dashboard reference):
// hairline cards, compact 11–14px type, tabular numbers, sparklines, a stat strip above charts and a
// donut with a centre total. Server-safe (no hooks), SVG only — no chart library (AGENTS.md rule 8).
// Colours come from theme tokens so light and dark mode both work.

export function DashCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border/70 bg-gradient-to-b from-card to-muted/20 shadow-xs transition-colors hover:border-border',
        className,
      )}
    >
      {title || action ? (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-medium text-foreground">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn('flex-1 px-4 pb-4 pt-3 sm:px-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function DeltaBadge({ pct, suffix = 'so với 30 ngày trước' }: { pct: number | null; suffix?: string }) {
  const tone = pct == null || pct === 0 ? 'neutral' : pct > 0 ? 'up' : 'down';
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        className={cn(
          'rounded px-1.5 py-0.5 font-medium tabular-nums ring-1 ring-inset',
          tone === 'up' && 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400',
          tone === 'down' && 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-400',
          tone === 'neutral' && 'bg-muted text-muted-foreground ring-border',
        )}
        title={pct == null ? 'Kỳ trước chưa có số liệu để so sánh' : undefined}
      >
        {pct != null && pct > 0 ? '▲ ' : pct != null && pct < 0 ? '▼ ' : ''}{formatPctChange(pct)}
      </span>
      {suffix}
    </span>
  );
}

/** Tiny trend line. `values` oldest → newest; renders nothing for < 2 points or an all-zero series. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 0);
  if (values.length < 2) return <div className={cn('h-8', className)} aria-hidden />;
  if (max === 0) {
    return (
      <svg viewBox="0 0 120 32" preserveAspectRatio="none" className={cn('h-8 w-full', className)} aria-hidden>
        <line x1="0" y1="30" x2="120" y2="30" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 3" className="opacity-30" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const width = 120;
  const height = 32;
  const step = width / (values.length - 1);
  const y = (value: number) => height - 2 - (value / max) * (height - 4);
  const line = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn('h-8 w-full overflow-visible', className)} aria-hidden>
      <path d={`${line} L${width},${height} L0,${height} Z`} className="fill-current opacity-10" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={width} cy={y(values[values.length - 1])} r={2.5} className="fill-current" />
    </svg>
  );
}

export function KpiTile({
  label,
  value,
  icon,
  pct,
  hint,
  trend,
  tone = 'default',
  href,
}: {
  label: string;
  /** Pre-formatted by the caller (money/kg/count) — this tile never decides what is money. */
  value: string | number;
  icon?: ReactNode;
  pct?: number | null;
  hint?: string;
  trend?: number[];
  tone?: 'default' | 'warning' | 'danger' | 'success';
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground" title={label}>{label}</p>
        {icon ? (
          <span
            className={cn(
              'grid size-7 place-items-center rounded-lg [&_svg]:size-3.5',
              tone === 'default' && 'bg-primary/10 text-primary',
              tone === 'success' && 'bg-emerald-500/10 text-emerald-600',
              tone === 'warning' && 'bg-amber-500/10 text-amber-600',
              tone === 'danger' && 'bg-rose-500/10 text-rose-600',
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold tracking-tight tabular-nums',
          tone === 'warning' && 'text-amber-600 dark:text-amber-400',
          tone === 'danger' && 'text-rose-600 dark:text-rose-400',
        )}
      >
        {value}
      </p>
      <div className="mt-1 min-h-5">
        {pct !== undefined ? <DeltaBadge pct={pct} /> : hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {trend ? <Sparkline values={trend} className={cn('mt-3', tone === 'danger' ? 'text-rose-500' : tone === 'warning' ? 'text-amber-500' : 'text-primary')} /> : null}
      {pct !== undefined && hint ? <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p> : null}
    </>
  );
  const className = 'block rounded-xl border border-border/70 bg-gradient-to-b from-card to-muted/20 p-4 shadow-xs transition-colors hover:border-border';
  return href ? <Link href={href} className={cn(className, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>{body}</Link> : <div className={className}>{body}</div>;
}

/** A row of small stats joined by hairlines, shown above a chart. */
export function StatStrip({ items }: { items: { label: string; value: string; tone?: 'default' | 'muted' }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-card px-3 py-2.5">
          <p className="truncate text-[11px] text-muted-foreground">{item.label}</p>
          <p className="text-[15px] font-semibold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

const DONUT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#94a3b8'];

/** Share donut with a centre label and a legend list. Slices beyond 6 are grouped as "Khác". */
export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  formatValue,
  emptyText,
}: {
  slices: { label: string; value: number; detail?: string }[];
  centerLabel: string;
  centerValue: string;
  formatValue: (value: number) => string;
  emptyText?: string;
}) {
  const sorted = [...slices].filter((slice) => slice.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6).reduce((sum, slice) => sum + slice.value, 0);
  const data = rest > 0 ? [...top, { label: 'Khác', value: rest }] : top;
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 15.9155; // circumference = 100
  let offset = 25; // start at 12 o'clock

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto aspect-square w-full max-w-[200px]">
        <svg viewBox="0 0 42 42" className="size-full -rotate-0" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
          <circle cx="21" cy="21" r={radius} fill="none" className="stroke-muted" strokeWidth="5" />
          {total > 0 ? data.map((slice, index) => {
            const length = (slice.value / total) * 100;
            const dash = `${Math.max(0, length - 0.6)} ${100 - Math.max(0, length - 0.6)}`;
            const circle = (
              <circle key={slice.label} cx="21" cy="21" r={radius} fill="none" stroke={DONUT_COLORS[index % DONUT_COLORS.length]} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} />
            );
            offset -= length;
            return circle;
          }) : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">{centerLabel}</p>
            <p className="text-lg font-semibold tracking-tight tabular-nums">{centerValue}</p>
          </div>
        </div>
      </div>
      {!data.length && emptyText ? <p className="text-center text-xs text-muted-foreground">{emptyText}</p> : null}
      <ul className="flex flex-col gap-2">
        {data.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2 text-xs">
            <span className="size-2 shrink-0 rounded-full" style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate" title={slice.label}>{slice.label}</span>
            <span className="tabular-nums text-muted-foreground">{formatValue(slice.value)}</span>
            <span className="w-9 text-right font-medium tabular-nums">{total > 0 ? Math.round((slice.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One-line warning with a link to where the detail lives (keeps the dashboard a quick review). */
export function AlertStrip({ href, linkLabel, children }: { href: string; linkLabel: string; children: ReactNode }) {
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300">
      <span className="flex items-center gap-2">
        <span className="size-1.5 shrink-0 rounded-full bg-rose-500" />
        {children}
      </span>
      <Link href={href} className="text-xs font-medium underline-offset-2 hover:underline">{linkLabel} →</Link>
    </div>
  );
}

/** Small muted link for card headers. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">{children}</Link>;
}
