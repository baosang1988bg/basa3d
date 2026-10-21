// Phase 41 — fake "Kinh doanh & Tài chính" numbers for checking the UI on `npm run dev`
// (`/admin/dashboard?demo=normal`). Never touches the database.
//
// Safety: resolveDemoScenario() returns a scenario ONLY when NODE_ENV is 'development' (i.e. `next dev`)
// AND the viewer is OWNER. `next build` / Vercel Preview / Production run with NODE_ENV='production',
// where Next inlines the check and the demo branch is dead code.
import type { StaffRole } from './auth/require-admin';
import type { ExecutiveBusinessMetrics, ExecutiveDailyPoint } from '../services/dashboard.service';
import { BUSINESS_TIME_ZONE } from './business-time';
import { averageOrderValue, filamentThresholdGrams, isFilamentBelowThreshold, pctChange, weekdayLabel } from './executive-metrics';

export const DEMO_SCENARIOS = ['normal', 'empty', 'first-month'] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export const DEMO_SCENARIO_LABELS: Record<DemoScenario, string> = {
  normal: 'Bình thường',
  empty: 'Chưa có đơn',
  'first-month': 'Tháng đầu (kỳ trước = 0)',
};

export function resolveDemoScenario(rawDemo: unknown, context: { nodeEnv: string | undefined; role: StaffRole }): DemoScenario | null {
  if (context.nodeEnv !== 'development' || context.role !== 'OWNER') return null;
  return (DEMO_SCENARIOS as readonly unknown[]).includes(rawDemo) ? (rawDemo as DemoScenario) : null;
}

const DAY_MS = 86_400_000;

/** Today's Asia/Ho_Chi_Minh calendar date as a UTC-midnight timestamp (calendar math only). */
function localTodayUtcMs(now: Date): number {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return Date.parse(`${ymd}T00:00:00Z`);
}

/** Deterministic (no Math.random) so a screenshot today looks the same on every reload. */
function demoRevenue(dayIndex: number, isWeekend: boolean): number {
  const wave = Math.sin(dayIndex * 1.7) * 900_000 + Math.cos(dayIndex * 0.6) * 500_000;
  const amount = 3_100_000 + wave + (isWeekend ? 2_600_000 : 0);
  return Math.max(0, Math.round(amount / 1_000) * 1_000);
}

function buildDays(todayMs: number, offsetDays: number, scale: number, zeroDayIndex: number | null): ExecutiveDailyPoint[] {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(todayMs - (29 - index + offsetDays) * DAY_MS);
    const isoDow = ((date.getUTCDay() + 6) % 7) + 1;
    const isWeekend = isoDow >= 6;
    const revenue = index === zeroDayIndex ? 0 : Math.round((demoRevenue(index + offsetDays, isWeekend) * scale) / 1_000) * 1_000;
    const iso = date.toISOString().slice(0, 10);
    return {
      date: iso,
      dayLabel: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      weekdayLabel: weekdayLabel(isoDow),
      isWeekend,
      revenue,
      orderCount: revenue > 0 ? Math.max(1, Math.round(revenue / 215_000)) : 0,
    };
  });
}

function filamentRow(id: string, name: string, materialType: string, color: string, spoolCount: number, remainingGrams: number) {
  const capacityGrams = spoolCount * 1_000;
  return {
    materialId: `demo-${id}`, materialName: name, materialType, color, spoolCount, capacityGrams, remainingGrams,
    thresholdGrams: filamentThresholdGrams(capacityGrams), isLow: isFilamentBelowThreshold(remainingGrams, capacityGrams),
  };
}

export function buildExecutiveDemoMetrics(scenario: DemoScenario, now: Date = new Date()): ExecutiveBusinessMetrics {
  const todayMs = localTodayUtcMs(now);
  const empty = scenario === 'empty';
  // One quiet day (index 12) so the "no revenue" 1px bar is visible too.
  const current = empty ? buildDays(todayMs, 0, 0, null) : buildDays(todayMs, 0, 1, 12);
  const previous = empty || scenario === 'first-month' ? buildDays(todayMs, 30, 0, null) : buildDays(todayMs, 30, 0.83, null);

  const sum = (days: ExecutiveDailyPoint[], key: 'revenue' | 'orderCount') => days.reduce((total, day) => total + day[key], 0);
  const compare = (currentValue: number, previousValue: number) => ({ current: currentValue, previous: previousValue, pctChange: pctChange(currentValue, previousValue) });
  const revenue = compare(sum(current, 'revenue'), sum(previous, 'revenue'));
  const orders = compare(sum(current, 'orderCount'), sum(previous, 'orderCount'));

  // Category split of the merchandise value (smaller than the KPI on purpose: no ship/COD/VAT — ADR-0044 §2).
  const merchandise = Math.round(revenue.current * 0.9);
  const shares: [string, number, number][] = [['Đồ decor', 0.36, 0.3], ['Quà tặng', 0.27, 0.22], ['Móc khóa', 0.17, 0.33], ['Phụ kiện', 0.15, 0.2], ['Chưa phân loại', 0.05, 0.04]];
  const categoryRevenue = empty ? [] : shares.map(([categoryName, revenueShare, orderShare], index) => ({
    categoryId: categoryName === 'Chưa phân loại' ? null : `demo-category-${index}`,
    categoryName,
    revenue: Math.round((merchandise * revenueShare) / 1_000) * 1_000,
    orderCount: Math.max(1, Math.round(orders.current * orderShare)),
  }));

  const filamentStock = [
    filamentRow('pla-white', 'PLA Basic - Trắng', 'PLA Basic', 'Trắng', 2, 300), // low (15%)
    filamentRow('petg-black', 'PETG Basic - Đen', 'PETG Basic', 'Đen', 1, 200), // exactly 20% → low
    filamentRow('tpu-clear', 'TPU 95A - Trong', 'TPU 95A', 'Trong', 1, 450),
    filamentRow('pla-blue', 'PLA Basic - Xanh dương', 'PLA Basic', 'Xanh dương', 4, 3_200),
    filamentRow('pla-silk', 'PLA Silk - Vàng đồng', 'PLA Silk', 'Vàng đồng', 1, 880),
  ];

  return {
    revenue30d: revenue,
    orders30d: orders,
    aov30d: compare(averageOrderValue(revenue.current, orders.current), averageOrderValue(revenue.previous, orders.previous)),
    filamentUsedGrams30d: empty ? compare(0, 0) : compare(48_600, scenario === 'first-month' ? 0 : 41_800),
    dailyTrends30d: current,
    categoryRevenue,
    filamentStock: empty ? [] : filamentStock,
  };
}
