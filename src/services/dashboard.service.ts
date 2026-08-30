import { query } from '../lib/db';

// STAFF-visible (ADR-0011 boundary #2: STAFF sees operational counts only, no money).
export async function getOperationalMetrics() {
  const [ordersToday, pendingOrders, customRequestsOpen, printJobsActive, lowStock] = await Promise.all([
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
  ]);
  return {
    ordersToday: Number(ordersToday.rows[0].count),
    pendingOrders: Number(pendingOrders.rows[0].count),
    customRequestsOpen: Number(customRequestsOpen.rows[0].count),
    printJobsActive: Number(printJobsActive.rows[0].count),
    lowStockCount: Number(lowStock.rows[0].count),
  };
}

// OWNER-only (ADR-0011 boundary #2) — enforced by the page calling this, not here.
export async function getFinancialMetrics() {
  const revenueToday = await query<{ sum: string | null }>(`select sum(total) from orders where created_at::date = current_date`);
  return { revenueToday: Number(revenueToday.rows[0].sum ?? 0) };
}
