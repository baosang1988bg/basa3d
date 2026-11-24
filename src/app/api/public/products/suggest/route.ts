import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { sanitizeListingParams } from '@/lib/catalog/listing-params';
import { listStorefrontProducts } from '@/services/storefront-catalog.service';

// ADR-0064 — header search suggestions. Same data and filters as /products?q= (ACTIVE products only),
// capped at 6. No DB rate limiter on purpose (it would write a row per keystroke): the cost equals one
// /products?q= render, the client debounces + aborts, and the CDN caches each query for 60s.
const SUGGEST_LIMIT = 6;
const SUGGEST_MIN_CHARS = 2;
const CACHE = { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' };

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const all = url.searchParams.getAll('q');
    // A repeated key is not a search (same rule as sanitizeListingParams for the listing page).
    const { search } = sanitizeListingParams({ q: all.length === 1 ? all[0] : undefined });
    if (!search || search.length < SUGGEST_MIN_CHARS) {
      return NextResponse.json({ data: { query: search ?? '', items: [] } }, { headers: CACHE });
    }
    const { items } = await listStorefrontProducts({ search, limit: SUGGEST_LIMIT, page: 1 });
    return NextResponse.json({
      data: {
        query: search,
        items: items.map((item) => ({
          id: item.id, name: item.name, slug: item.slug, imageUrl: item.imageUrl,
          basePrice: item.basePrice, minPrice: item.minPrice, maxPrice: item.maxPrice,
          inStock: item.inStock, productType: item.productType,
        })),
      },
    }, { headers: CACHE });
  } catch (error) {
    return apiError(error);
  }
}
