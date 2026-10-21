// Phase 41 (ADR-0044): pure helpers for the OWNER "Kinh doanh & Tài chính" dashboard tab.
// No I/O and no server-only imports (only `import type`), so client chart components and unit
// tests can use them directly.
import type { StaffRole } from './auth/require-admin';
import { FILAMENT_LOW_STOCK_PCT } from './filament-thresholds';

export type DashboardTab = 'business' | 'operations';

/**
 * ADR-0011 boundary #2: the only place that decides which dashboard tab renders. STAFF always gets
 * `operations`, whatever `?tab=` says, so the page never reaches the financial reader for STAFF.
 * OWNER defaults to `business`; anything other than the exact string `operations` is ignored.
 */
export function resolveDashboardTab(role: StaffRole, rawTab: unknown): DashboardTab {
  if (role !== 'OWNER') return 'operations';
  return rawTab === 'operations' ? 'operations' : 'business';
}

/**
 * Growth in percent, rounded to 1 decimal. `null` when there is no base to compare with
 * (previous period 0) — the UI shows "—" instead of a misleading 0% or Infinity.
 */
export function pctChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Average order value in whole VND (Rule #2: money stays integer). 0 orders → 0. */
export function averageOrderValue(revenue: number, orderCount: number): number {
  return orderCount > 0 ? Math.round(revenue / orderCount) : 0;
}

const oneDecimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** "850₫", "215k₫", "122,6 tr₫", "1,25 tỷ₫". */
export function formatVndCompact(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const value = Math.abs(amount);
  if (value < 1_000) return `${sign}${integer.format(value)}₫`;
  const thousands = Math.round(value / 1_000);
  if (thousands < 1_000) return `${sign}${thousands}k₫`;
  // Compare the value as it will be shown (1 decimal), so 999.96M becomes "1 tỷ₫", not "1.000 tr₫".
  const millions = Math.round(value / 100_000) / 10;
  if (millions < 1_000) return `${sign}${oneDecimal.format(millions)} tr₫`;
  return `${sign}${twoDecimals.format(value / 1_000_000_000)} tỷ₫`;
}

/** Full amount for tooltips: "1.234.000₫". */
export function formatVnd(amount: number): string {
  return `${integer.format(amount)}₫`;
}

/** "+20,1%", "-3%", "0%"; `null` → "—". */
export function formatPctChange(pct: number | null): string {
  if (pct == null) return '—';
  const text = `${oneDecimal.format(Math.abs(pct))}%`;
  if (pct > 0) return `+${text}`;
  if (pct < 0) return `-${text}`;
  return text;
}

/**
 * Y-axis ticks from 0 with a 1-2-5 step, just enough to cover the max,
 * e.g. 7.3M → [0, 2M, 4M, 6M, 8M]; 4.1M → [0, 2M, 4M, 6M].
 * Steps are at least 1 (integer domain: VND, order counts). max <= 0 → [0].
 */
export function niceAxisTicks(maxValue: number, targetTickCount = 4): number[] {
  if (!(maxValue > 0)) return [0];
  const rawStep = maxValue / targetTickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(1, Math.round(nice * magnitude));
  const steps = Math.ceil(maxValue / step);
  return Array.from({ length: steps + 1 }, (_, index) => index * step);
}

/**
 * The SAP_HET ("sắp hết") cutoff of filament.service.ts's warningTier() (same constant, from
 * filament-thresholds.ts), applied on the dashboard to a material's ACTIVE spools pooled together
 * (ADR-0044 §4) — so it can differ from the per-spool tiers on the Materials page.
 */
export { FILAMENT_LOW_STOCK_PCT };

/** Integer math (no float rounding at the boundary): remaining*100 <= capacity*20. */
export function isFilamentBelowThreshold(remainingGrams: number, capacityGrams: number): boolean {
  if (remainingGrams <= 0) return true;
  return remainingGrams * 100 <= capacityGrams * FILAMENT_LOW_STOCK_PCT;
}

export function filamentThresholdGrams(capacityGrams: number): number {
  return Math.round((capacityGrams * FILAMENT_LOW_STOCK_PCT) / 100);
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

/** ISO day of week (1 = Monday … 7 = Sunday, Postgres `isodow`) → "T2" … "CN". */
export function weekdayLabel(isoDayOfWeek: number): string {
  return WEEKDAY_LABELS[isoDayOfWeek - 1] ?? '';
}
