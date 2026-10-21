import { cache } from 'react';
import { query } from '../lib/db';
import { SQL_LOCAL_TODAY, sqlLocal, sqlLocalDate, sqlLocalDayStart } from '../lib/business-time';
import {
  averageOrderValue, filamentThresholdGrams, isFilamentBelowThreshold, pctChange, weekdayLabel,
} from '../lib/executive-metrics';
import { getFilamentInventoryStats } from './filament.service';

// STAFF-safe (ADR-0011 boundary #2: STAFF sees operational counts only, no money). Kept as its
// own type — never a shared "trend point" with an optional `revenue` — so this function can
// never leak money to STAFF just by returning its rows as-is (Phase 11 review blocker #2).
export interface OrderTrendPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "01/09"
  orderCount: number;
}

// OWNER-only (ADR-0011 boundary #2).
export interface RevenueTrendPoint extends OrderTrendPoint {
  revenue: number;
}

export interface ProductionPipelineStats {
  queued: number;
  printing: number;
  qc: number;
  completed: number;
  failed: number;
}

export interface CustomRequestPipelineStats {
  new: number;
  reviewing: number;
  needInfo: number;
  quoted: number;
  approved: number;
  converted: number;
}

// Reuses filament.service.ts's getFilamentInventoryStats() (Phase 12, Q5's 4-tier thresholds)
// instead of re-deriving stock-health cutoffs here, so the Materials page and this dashboard
// never disagree on what counts as "sắp hết" (Phase 11 review blocker #1).
export interface MaterialHealthOverview {
  totalSpools: number;
  totalRemainingWeightGrams: number;
  watchCount: number;
  lowStockCount: number;
  emptyCount: number;
  byMaterialType: { materialType: string; count: number; totalWeightKg: number }[];
}

// STAFF-safe (ADR-0011 boundary #2): reachable from the dashboard operational metrics.
// pendingOrders deliberately carries no
// money field (no `total`) — the phase-11.md draft originally included one, which would have
// leaked order value into a STAFF-reachable type; corrected here, see phase-11.md Slice 1 note.
export interface ActionableRecentItems {
  pendingOrders: { id: string; orderCode: string; customerName: string; status: string; createdAt: Date }[];
  openCustomRequests: { id: string; requestCode: string; customerName: string; sourceChannel: string; status: string; createdAt: Date }[];
}

const TREND_DAYS_INTERVAL = '13 days';

// ADR-0044 §1: the one definition of "an order that counts as revenue" for every dashboard money
// figure (OWNER-only). Shop orders only — custom-print quotes are not in `orders`.
function revenueEligible(alias: string): string {
  return `(${alias}.status <> 'CANCELLED' and ${alias}.payment_status <> 'REFUNDED')`;
}

async function getOrderTrends(): Promise<OrderTrendPoint[]> {
  const result = await query<{ date: string; day_label: string; order_count: number }>(`
    select to_char(d.day, 'YYYY-MM-DD') as date,
      to_char(d.day, 'DD/MM') as day_label,
      count(o.id)::int as order_count
    from generate_series(${SQL_LOCAL_TODAY} - interval '${TREND_DAYS_INTERVAL}', ${SQL_LOCAL_TODAY}, '1 day'::interval) d(day)
    left join orders o on ${sqlLocalDate('o.created_at')} = d.day::date
    group by d.day
    order by d.day asc`);
  return result.rows.map((row) => ({ date: row.date, dayLabel: row.day_label, orderCount: row.order_count }));
}

async function getRevenueTrends(): Promise<RevenueTrendPoint[]> {
  const result = await query<{ date: string; day_label: string; order_count: number; revenue: string }>(`
    select to_char(d.day, 'YYYY-MM-DD') as date,
      to_char(d.day, 'DD/MM') as day_label,
      count(o.id)::int as order_count,
      coalesce(sum(case when ${revenueEligible('o')} then o.total else 0 end), 0)::bigint as revenue
    from generate_series(${SQL_LOCAL_TODAY} - interval '${TREND_DAYS_INTERVAL}', ${SQL_LOCAL_TODAY}, '1 day'::interval) d(day)
    left join orders o on ${sqlLocalDate('o.created_at')} = d.day::date
    group by d.day
    order by d.day asc`);
  return result.rows.map((row) => ({ date: row.date, dayLabel: row.day_label, orderCount: row.order_count, revenue: Number(row.revenue) }));
}

async function getProductionPipeline(): Promise<ProductionPipelineStats> {
  const result = await query<{ status: string; count: string }>(
    `select status, count(*) from print_jobs where status in ('QUEUED','PRINTING','QC','COMPLETED','FAILED') group by status`,
  );
  const counts = Object.fromEntries(result.rows.map((row) => [row.status, Number(row.count)]));
  return {
    queued: counts.QUEUED ?? 0,
    printing: counts.PRINTING ?? 0,
    qc: counts.QC ?? 0,
    completed: counts.COMPLETED ?? 0,
    failed: counts.FAILED ?? 0,
  };
}

async function getCustomRequestPipeline(): Promise<CustomRequestPipelineStats> {
  const result = await query<{ status: string; count: string }>(
    `select status, count(*) from custom_requests where status in ('NEW','REVIEWING','NEED_INFO','QUOTED','APPROVED','CONVERTED') group by status`,
  );
  const counts = Object.fromEntries(result.rows.map((row) => [row.status, Number(row.count)]));
  return {
    new: counts.NEW ?? 0,
    reviewing: counts.REVIEWING ?? 0,
    needInfo: counts.NEED_INFO ?? 0,
    quoted: counts.QUOTED ?? 0,
    approved: counts.APPROVED ?? 0,
    converted: counts.CONVERTED ?? 0,
  };
}

async function getMaterialHealth(): Promise<MaterialHealthOverview> {
  const [stats, byType] = await Promise.all([
    getFilamentInventoryStats(),
    query<{ material_type: string; count: string; total_weight_kg: string }>(`
      select m.material_type,
        count(*) as count,
        sum(fs.initial_weight_grams - fs.used_weight_grams)::numeric / 1000 as total_weight_kg
      from filament_spools fs join materials m on m.id = fs.material_id
      where fs.status = 'ACTIVE'
      group by m.material_type
      order by m.material_type`),
  ]);
  return {
    totalSpools: stats.totalSpools,
    totalRemainingWeightGrams: stats.totalRemainingWeightGrams,
    watchCount: stats.watchCount,
    lowStockCount: stats.lowStockCount,
    emptyCount: stats.emptyCount,
    byMaterialType: byType.rows.map((row) => ({
      materialType: row.material_type,
      count: Number(row.count),
      totalWeightKg: Number(row.total_weight_kg),
    })),
  };
}

async function getActionableItems(): Promise<ActionableRecentItems> {
  const [pendingOrders, openCustomRequests] = await Promise.all([
    // No `total` column selected — this is the STAFF-safe operational path (see ActionableRecentItems).
    query<{ id: string; order_code: string; customer_name: string; status: string; created_at: Date }>(`
      select id, order_number as order_code, customer_name, status, created_at
      from orders where status in ('NEW','CONFIRMED') order by created_at desc limit 5`),
    query<{ id: string; request_code: string; customer_name: string; source_channel: string; status: string; created_at: Date }>(`
      select id, request_number as request_code, customer_name, source_channel, status, created_at
      from custom_requests where status in ('NEW','REVIEWING','NEED_INFO','QUOTED') order by created_at desc limit 5`),
  ]);
  return {
    pendingOrders: pendingOrders.rows.map((row) => ({
      id: row.id, orderCode: row.order_code, customerName: row.customer_name, status: row.status, createdAt: row.created_at,
    })),
    openCustomRequests: openCustomRequests.rows.map((row) => ({
      id: row.id, requestCode: row.request_code, customerName: row.customer_name, sourceChannel: row.source_channel, status: row.status, createdAt: row.created_at,
    })),
  };
}

// Small STAFF-safe navigation counts; deliberately independent of dashboard analytics.
export const getAdminNavBadges = cache(async () => {
  const [pendingOrders, customRequestsOpen, printJobsActive] = await Promise.all([
    query<{ count: string }>(`select count(*) from orders where status in ('NEW','CONFIRMED')`),
    query<{ count: string }>(`select count(*) from custom_requests where status in ('NEW','REVIEWING','NEED_INFO','QUOTED')`),
    query<{ count: string }>(`select count(*) from print_jobs where status in ('QUEUED','PRINTING')`),
  ]);
  return {
    pendingOrders: Number(pendingOrders.rows[0].count),
    customRequestsOpen: Number(customRequestsOpen.rows[0].count),
    printJobsActive: Number(printJobsActive.rows[0].count),
  };
});

// STAFF-visible (ADR-0011 boundary #2: STAFF sees operational counts only, no money) — none of
// the queries below select a money column. Memoized via cache() for repeated dashboard reads
// within one render request; navigation uses the smaller getAdminNavBadges() above.
export const getOperationalMetrics = cache(async () => {
  const [
    counts,
    lowStock,
    dailyOrderTrends,
    productionPipeline,
    customRequestPipeline,
    materialHealth,
    actionableItems,
  ] = await Promise.all([
    query<{
      orders_today: string;
      pending_orders: string;
      custom_requests_open: string;
      print_jobs_active: string;
    }>(`
      select
        (select count(*) from orders where ${sqlLocalDate('created_at')} = ${SQL_LOCAL_TODAY}) as orders_today,
        (select count(*) from orders where status in ('NEW','CONFIRMED')) as pending_orders,
        (select count(*) from custom_requests where status in ('NEW','REVIEWING','NEED_INFO','QUOTED')) as custom_requests_open,
        (select count(*) from print_jobs where status in ('QUEUED','PRINTING')) as print_jobs_active
    `),
    // Low-stock threshold (available <= 5) is a fixed MVP default — no configurable reorder
    // point column exists yet in product_variants.
    query<{ count: string }>(`
      select count(*) from (
        select v.id,
          coalesce((select sum(quantity) from inventory_movements where product_variant_id = v.id), 0)
          - coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id where oi.variant_id = v.id and o.status in ('NEW','CONFIRMED')), 0) as available
        from product_variants v where v.is_active = true
      ) stock where available <= 5`),
    getOrderTrends(),
    getProductionPipeline(),
    getCustomRequestPipeline(),
    getMaterialHealth(),
    getActionableItems(),
  ]);
  const countsRow = counts.rows[0];
  return {
    ordersToday: Number(countsRow?.orders_today ?? 0),
    pendingOrders: Number(countsRow?.pending_orders ?? 0),
    customRequestsOpen: Number(countsRow?.custom_requests_open ?? 0),
    printJobsActive: Number(countsRow?.print_jobs_active ?? 0),
    lowStockCount: Number(lowStock.rows[0]?.count ?? 0),
    dailyOrderTrends,
    productionPipeline,
    customRequestPipeline,
    materialHealth,
    actionableItems,
  };
});

// OWNER-only (ADR-0011 boundary #2) — enforced by the page calling this, not here.
export async function getFinancialMetrics() {
  const [revenueCounts, dailyRevenueTrends] = await Promise.all([
    query<{ sum_today: string | null; sum_month: string | null }>(`
      select
        (select sum(total) from orders where ${sqlLocalDate('created_at')} = ${SQL_LOCAL_TODAY} and ${revenueEligible('orders')}) as sum_today,
        (select sum(total) from orders where date_trunc('month', ${sqlLocal('created_at')}) = date_trunc('month', ${sqlLocal('now()')}) and ${revenueEligible('orders')}) as sum_month
    `),
    getRevenueTrends(),
  ]);
  const row = revenueCounts.rows[0];
  const revenueLast14Days = dailyRevenueTrends.reduce((sum, point) => sum + point.revenue, 0);
  return {
    revenueToday: Number(row?.sum_today ?? 0),
    revenueThisMonth: Number(row?.sum_month ?? 0),
    revenueLast14Days,
    dailyRevenueTrends,
  };
}

// ---------------------------------------------------------------------------------------------
// Phase 41 (ADR-0044) — "Kinh doanh & Tài chính" tab: 30 days vs the previous 30 days.
// ---------------------------------------------------------------------------------------------

const PERIOD_DAYS = 30;
// Local (Asia/Ho_Chi_Minh) calendar dates; both bounds are inclusive days, today included.
const PERIOD_START_DATE = `(${SQL_LOCAL_TODAY} - ${PERIOD_DAYS - 1})`;
const PREVIOUS_PERIOD_START_DATE = `(${SQL_LOCAL_TODAY} - ${2 * PERIOD_DAYS - 1})`;

export interface PeriodComparison {
  current: number;
  previous: number;
  pctChange: number | null; // null when previous = 0 (no base to compare with)
}

// OWNER-only (carries revenue).
export interface ExecutiveDailyPoint {
  date: string; // YYYY-MM-DD, local calendar day
  dayLabel: string; // "01/09"
  weekdayLabel: string; // "T2" … "CN"
  isWeekend: boolean; // Saturday/Sunday — from Postgres isodow, not JS Date parsing
  revenue: number;
  orderCount: number;
}

// OWNER-only (carries revenue).
export interface CategoryRevenueRow {
  categoryId: string | null; // null = "Chưa phân loại" (no variant/product/category any more)
  categoryName: string;
  revenue: number; // sum(order_items.line_total) — merchandise, before order discount and fees
  orderCount: number; // distinct orders containing this category
}

// STAFF-safe: grams only — never selects purchase_cost / cost_per_spool / current_unit_cost.
export interface FilamentThresholdRow {
  materialId: string;
  materialName: string;
  materialType: string;
  color: string | null;
  spoolCount: number;
  capacityGrams: number; // sum(initial_weight_grams) of ACTIVE spools
  remainingGrams: number;
  thresholdGrams: number; // FILAMENT_LOW_STOCK_PCT of capacity
  isLow: boolean;
}

export interface ExecutiveBusinessMetrics {
  revenue30d: PeriodComparison;
  orders30d: PeriodComparison;
  aov30d: PeriodComparison;
  filamentUsedGrams30d: PeriodComparison;
  dailyTrends30d: ExecutiveDailyPoint[];
  categoryRevenue: CategoryRevenueRow[];
  filamentStock: FilamentThresholdRow[];
}

function compare(current: number, previous: number): PeriodComparison {
  return { current, previous, pctChange: pctChange(current, previous) };
}

// STAFF-safe (no money). Per material (type + color), over ACTIVE spools, using the same SAP_HET
// cutoff as filament.service.ts's warningTier() (ADR-0044 §4). Low materials first.
export async function getFilamentThresholdStock(): Promise<FilamentThresholdRow[]> {
  const result = await query<{
    material_id: string; material_name: string; material_type: string; color: string | null;
    spool_count: number; capacity_grams: string; remaining_grams: string;
  }>(`
    select m.id as material_id, m.name as material_name, m.material_type, m.color,
      count(*)::int as spool_count,
      sum(fs.initial_weight_grams)::bigint as capacity_grams,
      sum(fs.initial_weight_grams - fs.used_weight_grams)::bigint as remaining_grams
    from filament_spools fs
    join materials m on m.id = fs.material_id
    where fs.status = 'ACTIVE'
    group by m.id, m.name, m.material_type, m.color`);
  const rows = result.rows.map((row) => {
    const capacityGrams = Number(row.capacity_grams);
    const remainingGrams = Number(row.remaining_grams);
    return {
      materialId: row.material_id,
      materialName: row.material_name,
      materialType: row.material_type,
      color: row.color,
      spoolCount: row.spool_count,
      capacityGrams,
      remainingGrams,
      thresholdGrams: filamentThresholdGrams(capacityGrams),
      isLow: isFilamentBelowThreshold(remainingGrams, capacityGrams),
    };
  });
  return rows.sort((a, b) => Number(b.isLow) - Number(a.isLow)
    || a.remainingGrams / a.capacityGrams - b.remainingGrams / b.capacityGrams
    || a.materialName.localeCompare(b.materialName, 'vi'));
}

// OWNER-only (ADR-0011 boundary #2) — enforced by the page via resolveDashboardTab(), not here
// (caller-enforces convention, ADR-0026). 4 independent queries, no N+1; every `created_at` filter is
// a plain lower bound so the created_at indexes stay usable.
export async function getExecutiveBusinessMetrics(): Promise<ExecutiveBusinessMetrics> {
  const periodStart = sqlLocalDayStart(PERIOD_START_DATE);
  const previousPeriodStart = sqlLocalDayStart(PREVIOUS_PERIOD_START_DATE);
  const [days, categories, filamentUsed, filamentStock] = await Promise.all([
    // 60 zero-gap local days; the first 30 are the previous period, the last 30 the current one.
    query<{ date: string; day_label: string; iso_dow: number; order_count: number; revenue: string }>(`
      with eligible as (
        select o.total, ${sqlLocalDate('o.created_at')} as local_day
        from orders o
        where o.created_at >= ${previousPeriodStart} and ${revenueEligible('o')}
      )
      select to_char(d.day, 'YYYY-MM-DD') as date,
        to_char(d.day, 'DD/MM') as day_label,
        extract(isodow from d.day)::int as iso_dow,
        count(e.local_day)::int as order_count,
        coalesce(sum(e.total), 0)::bigint as revenue
      from generate_series(${PREVIOUS_PERIOD_START_DATE}::timestamp, ${SQL_LOCAL_TODAY}::timestamp, interval '1 day') d(day)
      left join eligible e on e.local_day = d.day::date
      group by d.day
      order by d.day asc`),
    query<{ category_id: string | null; category_name: string; revenue: string; order_count: number }>(`
      select c.id as category_id,
        coalesce(c.name, 'Chưa phân loại') as category_name,
        sum(oi.line_total)::bigint as revenue,
        count(distinct o.id)::int as order_count
      from orders o
      join order_items oi on oi.order_id = o.id
      left join product_variants v on v.id = oi.variant_id
      left join products p on p.id = v.product_id
      left join categories c on c.id = p.category_id
      where o.created_at >= ${periodStart} and ${revenueEligible('o')}
      group by c.id, c.name
      order by revenue desc, category_name asc`),
    // Stock ledger (ADR-0044 §3): includes failed/reprinted jobs; GRAM materials only.
    query<{ current_grams: string; previous_grams: string }>(`
      select
        coalesce(sum(-mm.quantity) filter (where mm.created_at >= ${periodStart}), 0)::bigint as current_grams,
        coalesce(sum(-mm.quantity) filter (where mm.created_at < ${periodStart}), 0)::bigint as previous_grams
      from material_movements mm
      join materials m on m.id = mm.material_id
      where mm.movement_type = 'PRODUCTION_OUT' and m.unit = 'GRAM' and mm.created_at >= ${previousPeriodStart}`),
    getFilamentThresholdStock(),
  ]);

  const points: ExecutiveDailyPoint[] = days.rows.map((row) => ({
    date: row.date,
    dayLabel: row.day_label,
    weekdayLabel: weekdayLabel(row.iso_dow),
    isWeekend: row.iso_dow >= 6,
    revenue: Number(row.revenue),
    orderCount: row.order_count,
  }));
  const previousPoints = points.slice(0, points.length - PERIOD_DAYS);
  const dailyTrends30d = points.slice(-PERIOD_DAYS);
  const sumOf = (list: ExecutiveDailyPoint[], key: 'revenue' | 'orderCount') => list.reduce((total, point) => total + point[key], 0);

  const revenue = compare(sumOf(dailyTrends30d, 'revenue'), sumOf(previousPoints, 'revenue'));
  const orders = compare(sumOf(dailyTrends30d, 'orderCount'), sumOf(previousPoints, 'orderCount'));
  const used = filamentUsed.rows[0];

  return {
    revenue30d: revenue,
    orders30d: orders,
    aov30d: compare(averageOrderValue(revenue.current, orders.current), averageOrderValue(revenue.previous, orders.previous)),
    filamentUsedGrams30d: compare(Number(used?.current_grams ?? 0), Number(used?.previous_grams ?? 0)),
    dailyTrends30d,
    categoryRevenue: categories.rows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      revenue: Number(row.revenue),
      orderCount: row.order_count,
    })),
    filamentStock,
  };
}
