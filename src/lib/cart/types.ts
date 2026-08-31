// Cart lives entirely client-side (phase-5.md decision #1) — the carts/cart_items tables from
// Phase 0 are intentionally unused here (see ADR-0014). Price/name/image are display-only
// snapshots taken when the item was added; the server always recomputes the real price and stock
// from product_variants at checkout (POST /api/public/orders), so a stale value here can never
// change what a customer actually pays.
export type CartItem = {
  variantId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  imageUrl: string | null;
  quantity: number;
};
