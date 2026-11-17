// Phase 56 — the public /products listing takes its filters from the URL. Pure, unit tested.
export const LISTING_SEARCH_MAX_LENGTH = 80;
export const LISTING_MAX_PAGE = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_TYPES = ['READY_STOCK', 'MADE_TO_ORDER'] as const;

export type ListingParams = { q?: unknown; type?: unknown; page?: unknown; categoryId?: unknown };
export type ListingFilters = { search?: string; productType?: (typeof PRODUCT_TYPES)[number]; categoryId?: string; page: number };

/** Next.js gives `string | string[]` for a repeated query key; only a single string is a filter. */
function single(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function sanitizeListingParams(params: ListingParams): ListingFilters {
  const search = single(params.q)?.trim().slice(0, LISTING_SEARCH_MAX_LENGTH) || undefined;
  const type = single(params.type);
  const categoryId = single(params.categoryId);
  const page = Number(single(params.page));
  return {
    search,
    productType: PRODUCT_TYPES.find((value) => value === type),
    categoryId: categoryId && UUID_RE.test(categoryId) ? categoryId.toLowerCase() : undefined,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, LISTING_MAX_PAGE) : 1,
  };
}
