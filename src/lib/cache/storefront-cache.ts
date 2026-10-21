import { unstable_cache } from 'next/cache';
import {
  getStorefrontProductBySlug,
  listStorefrontProducts,
  type StorefrontProductDetail,
} from '@/services/storefront-catalog.service';
import { listCategories } from '@/services/product.service';
import { STOREFRONT_CATALOG_TAG, STOREFRONT_CATALOG_TTL_SECONDS } from './storefront-cache-tags';

export { invalidateStorefrontCatalog, STOREFRONT_CATALOG_TAG, STOREFRONT_CATALOG_TTL_SECONDS } from './storefront-cache-tags';

// Phase 42 (ADR-0045) — cross-request cache for the public catalog reads.
//
// Services stay framework-free (tests call them directly, outside Next.js, where unstable_cache
// throws "incrementalCache missing"); only pages import these wrappers. Every write that can change
// what the storefront shows — product/variant/image/category edits, inventory movements, orders that
// reserve or release stock — calls invalidateStorefrontCatalog() (storefront-cache-tags.ts, kept
// separate so services can import it without a services ↔ cache import cycle) after it commits.
// The TTL is the safety net for a write path that forgets to: displayed stock can be at most this
// stale. Checkout never reads from here — createOrder locks the variant and re-checks stock.

const cacheOptions = { tags: [STOREFRONT_CATALOG_TAG], revalidate: STOREFRONT_CATALOG_TTL_SECONDS };

// Bounded key space: free-text search and deep pages are attacker-controlled and would each create
// a new cache entry, so they bypass the cache and hit the DB exactly as before Phase 42.
export const MAX_CACHED_LISTING_PAGE = 5;

type ListingInput = NonNullable<Parameters<typeof listStorefrontProducts>[0]>;

const cachedListStorefrontProducts = unstable_cache(
  (input: ListingInput) => listStorefrontProducts(input),
  ['storefront:listStorefrontProducts'],
  cacheOptions,
);

export function isCacheableListing(input: ListingInput): boolean {
  if (input.search && input.search.trim() !== '') return false;
  const page = input.page ?? 1;
  return Number.isFinite(page) && page >= 1 && page <= MAX_CACHED_LISTING_PAGE;
}

export function getCachedStorefrontProducts(input: ListingInput = {}) {
  return isCacheableListing(input) ? cachedListStorefrontProducts(input) : listStorefrontProducts(input);
}

export const getCachedCategories = unstable_cache(
  (limit: number) => listCategories({ limit }),
  ['storefront:listCategories'],
  cacheOptions,
);

// Unknown slugs are not cached (arbitrary URLs would otherwise each create an entry): the cached
// function throws for a miss — unstable_cache never stores a rejection — and the wrapper maps it
// back to null so the page still calls notFound().
class ProductSlugMiss extends Error {}

const cachedProductBySlug = unstable_cache(
  async (slug: string): Promise<StorefrontProductDetail> => {
    const product = await getStorefrontProductBySlug(slug);
    if (!product) throw new ProductSlugMiss(slug);
    return product;
  },
  ['storefront:getStorefrontProductBySlug'],
  cacheOptions,
);

export async function getCachedStorefrontProductBySlug(slug: string): Promise<StorefrontProductDetail | null> {
  try {
    return await cachedProductBySlug(slug);
  } catch (error) {
    if (error instanceof ProductSlugMiss) return null;
    throw error;
  }
}
