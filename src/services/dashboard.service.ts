import { cache } from 'react';
import { query } from '../lib/db';
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

// STAFF-safe (ADR-0011 boundary #2): reachable from getOperationalMetrics(), which the protected
// layout calls for every admin request regardless of role. pendingOrders deliberately carries no
// money field (no `total`) — the phase-11.md draft originally included one, which would have
// leaked order value into a STAFF-reachable type; corrected here, see phase-11.md Slice 1 note.
export interface ActionableRecentItems {
  pendingOrders: { id: string; orderCode: string; customerName: string; status: string; createdAt: Date }[];
  openCustomRequests: { id: string; requestCode: string; customerName: string; sourceChannel: string; status: string; createdAt: Date }[];
}

const TREND_DAYS_INTERVAL = '13 days';

async function getOrderTrends(): Promise<OrderTrendPoint[]> {
  const result = await query<{ date: string; day_label: string; order_count: number }>(`
    select to_char(d.day, 'YYYY-MM-DD') as date,
      to_char(d.day, 'DD/MM') as day_label,
      count(o.id)::int as order_count
    from generate_series(current_date - interval '${TREND_DAYS_INTERVAL}', current_date, '1 day'::interval) d(day)
    left join orders o on o.created_at::date = d.day::date
    group by d.day
    order by d.day asc`);
  return result.rows.map((row) => ({ date: row.date, dayLabel: row.day_label, orderCount: row.order_count }));
}

async function getRevenueTrends(): Promise<RevenueTrendPoint[]> {
  const result = await query<{ date: string; day_label: string; order_count: number; revenue: string }>(`
    select to_char(d.day, 'YYYY-MM-DD') as date,
      to_char(d.day, 'DD/MM') as day_label,
      count(o.id)::int as order_count,
      coalesce(sum(case when o.status <> 'CANCELLED' then o.total else 0 end), 0)::bigint as revenue
    from generate_series(current_date - interval '${TREND_DAYS_INTERVAL}', current_date, '1 day'::interval) d(day)
    left join orders o on o.created_at::date = d.day::date
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

// STAFF-visible (ADR-0011 boundary #2: STAFF sees operational counts only, no money) — none of
// the queries below select a money column. Memoized via cache() so the layout (nav badges) and
// the dashboard page calling this in the same request share 1 set of queries.
export const getOperationalMetrics = cache(async () => {
  const [
    ordersToday, pendingOrders, customRequestsOpen, printJobsActive, lowStock,
    dailyOrderTrends, productionPipeline, customRequestPipeline, materialHealth, actionableItems,
  ] = await Promise.all([
    query<{ count: string }>(`select count(*) from orders where created_at::date = current_date`),
    query<{ count: string }>(`select count(*) from orders where status in ('NEW','CONFIRMED')`),
    query<{ count: string }>(`select count(*) from custom_requests where status in ('NEW','REVIEWING','NEED_INFO','QUOTED')`),
    query<{ count: string }>(`select count(*) from print_jobs where status in ('QUEUED','PRINTING')`),
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
  return {
    ordersToday: Number(ordersToday.rows[0].count),
    pendingOrders: Number(pendingOrders.rows[0].count),
    customRequestsOpen: Number(customRequestsOpen.rows[0].count),
    printJobsActive: Number(printJobsActive.rows[0].count),
    lowStockCount: Number(lowStock.rows[0].count),
    dailyOrderTrends,
    productionPipeline,
    customRequestPipeline,
    materialHealth,
    actionableItems,
  };
});

// OWNER-only (ADR-0011 boundary #2) — enforced by the page calling this, not here.
export async function getFinancialMetrics() {
  const [revenueToday, revenueThisMonth, dailyRevenueTrends] = await Promise.all([
    query<{ sum: string | null }>(`select sum(total) from orders where created_at::date = current_date and status <> 'CANCELLED'`),
    query<{ sum: string | null }>(`select sum(total) from orders where date_trunc('month', created_at) = date_trunc('month', current_date) and status <> 'CANCELLED'`),
    getRevenueTrends(),
  ]);
  const revenueLast14Days = dailyRevenueTrends.reduce((sum, point) => sum + point.revenue, 0);
  return {
    revenueToday: Number(revenueToday.rows[0].sum ?? 0),
    revenueThisMonth: Number(revenueThisMonth.rows[0].sum ?? 0),
    revenueLast14Days,
    dailyRevenueTrends,
  };
}
