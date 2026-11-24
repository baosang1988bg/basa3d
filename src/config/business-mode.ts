// Owner decision 2026-11-24 (ADR-0066): BaSa3D is a QUOTE site, not an e-commerce shop.
// These switches hide UI only — data, routes and services stay, so turning one back on is a
// rebuild with the env var set, not a code change. Read at build time (NEXT_PUBLIC_*).
export const BUSINESS_MODE = {
  /** Ready-stock selling (stock badges, "Sẵn hàng" filter, low-stock tiles, finished-goods ledger). */
  readyStock: process.env.NEXT_PUBLIC_READY_STOCK_ENABLED === 'true',
  /** Production tracking (admin "Việc in" menu + dashboard tile). Accepting a quote still records a print job. */
  printJobs: process.env.NEXT_PUBLIC_PRINT_JOBS_ENABLED === 'true',
  /** Storefront cart/checkout and the admin "Đơn hàng" menu (orders only come from the cart). */
  orders: process.env.NEXT_PUBLIC_CART_ENABLED === 'true',
} as const;

/** Storefront label type: with ready-stock off every product is shown as made to order. */
export function displayProductType(productType: string): string {
  return BUSINESS_MODE.readyStock ? productType : 'MADE_TO_ORDER';
}
