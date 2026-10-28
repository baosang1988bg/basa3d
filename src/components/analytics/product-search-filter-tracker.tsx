'use client';

import { useEffect, useRef } from 'react';
import { trackFilterCategory, trackSearch, type ProductTypeFilter } from '@/lib/analytics';
import { currentNavigationOrigin } from '@/lib/analytics-navigation';

// /products is a Server Component driven by the query string, so search/filter are observed from
// the URL. Events fire only for user-initiated changes (not reload, back/forward or an external
// landing). Rules: docs/marketing/ga4-tracking-guide.md § "Search & filter".

type Sort = 'newest' | 'price_asc' | 'price_desc';

interface ProductSearchFilterTrackerProps {
  searchTerm?: string;
  categoryId?: string;
  /** Default-locale (vi) display name — keeps reports from splitting per language. */
  categoryName?: string;
  productType?: ProductTypeFilter;
  sort: Sort;
  resultsOnPage: number;
}

export function ProductSearchFilterTracker({
  searchTerm,
  categoryId,
  categoryName,
  productType,
  sort,
  resultsOnPage,
}: ProductSearchFilterTrackerProps) {
  const term = searchTerm?.trim() ?? '';
  const filterKey = `${categoryId ?? ''}|${productType ?? ''}|${sort}`;
  const lastStateRef = useRef<{ term: string; filterKey: string } | null>(null);

  useEffect(() => {
    const previous = lastStateRef.current;
    lastStateRef.current = { term, filterKey };

    const termChanged = term !== (previous?.term ?? '');
    const filterChanged = previous ? filterKey !== previous.filterKey : Boolean(categoryId || productType || sort !== 'newest');
    if (!termChanged && !filterChanged) return; // e.g. pagination
    if (currentNavigationOrigin() !== 'user') return;

    if (termChanged && term) trackSearch({ search_term: term, results_on_page: resultsOnPage });
    if (filterChanged) {
      trackFilterCategory({
        category_id: categoryId ?? 'all',
        category_name: categoryName,
        product_type: productType,
        sort,
      });
    }
    // resultsOnPage/categoryName are derived from the same URL state; not change triggers.
  }, [term, filterKey]);

  return null;
}
