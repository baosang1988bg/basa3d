'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Loader2, Package, Search, Sparkles } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { formatVnd } from '@/components/storefront/format';
import { trackSearch } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export type ProductSuggestion = {
  id: string; name: string; slug: string; imageUrl: string | null;
  basePrice: number | null; minPrice: number | null; maxPrice: number | null;
  inStock: boolean; productType: string;
};

export const SUGGEST_DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

function priceLabel(item: ProductSuggestion): string | null {
  const min = item.minPrice ?? item.basePrice;
  const max = item.maxPrice ?? item.basePrice;
  if (min == null) return null;
  return max != null && max !== min ? `${formatVnd(min)} – ${formatVnd(max)}` : formatVnd(min);
}

/**
 * ADR-0064 — "Sản phẩm BaSa3D" tab: debounced suggestions from /api/public/products/suggest (stale requests
 * aborted), ↑/↓/Enter keyboard navigation, "see all" → /products?q=, zero results → hand over to the 3D-library tab.
 */
export function ProductSearchPanel({
  query,
  onQueryChange,
  onSearchLibrary,
  onNavigate,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearchLibrary: () => void;
  onNavigate: () => void;
}) {
  const t = useTranslations('headerSearch');
  const router = useRouter();
  const [items, setItems] = useState<ProductSuggestion[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [active, setActive] = useState(-1);
  const lastTracked = useRef('');
  const term = query.trim();

  useEffect(() => {
    setActive(-1);
    if (term.length < MIN_CHARS) {
      setItems([]);
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const res = await fetch(`/api/public/products/suggest?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const json = await res.json().catch(() => null) as { data?: { items?: ProductSuggestion[] } } | null;
        if (!res.ok || !json?.data) throw new Error('suggest failed');
        const next = json.data.items ?? [];
        setItems(next);
        setStatus('done');
        if (lastTracked.current !== term) {
          lastTracked.current = term;
          trackSearch({ search_term: term, results_on_page: next.length });
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setItems([]);
        setStatus('error');
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  function seeAll() {
    if (!term) return;
    onNavigate();
    router.push(`/products?q=${encodeURIComponent(term)}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault();
      setActive((index) => (index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active >= 0 && items[active]) {
        onNavigate();
        router.push(`/products/${items[active].slug}`);
      } else {
        seeAll();
      }
    }
  }

  const listId = 'header-search-suggestions';

  return (
    <div className="mt-5 space-y-3">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          // QA-022: the panel can mount after the modal's focus effect ran, so focus it here too.
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('placeholderProducts')}
          aria-label={t('tabProducts')}
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          maxLength={80}
          className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {status === 'loading' ? <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary" aria-label={t('loading')} /> : null}
      </div>

      {term.length > 0 && term.length < MIN_CHARS ? <p className="text-xs text-muted-foreground">{t('minChars')}</p> : null}
      {status === 'error' ? <p role="alert" className="text-xs text-destructive">{t('error')}</p> : null}

      {items.length > 0 ? (
        <ul id={listId} role="listbox" aria-label={t('tabProducts')} className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {items.map((item, index) => {
            const price = priceLabel(item);
            return (
              <li key={item.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                <Link
                  href={`/products/${item.slug}`}
                  onClick={onNavigate}
                  onMouseEnter={() => setActive(index)}
                  className={cn('flex items-center gap-3 px-3 py-2.5 transition-colors', index === active ? 'bg-secondary' : 'hover:bg-secondary/60')}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg border border-border object-cover" />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50"><Package className="size-5 text-muted-foreground" aria-hidden="true" /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{item.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {price ? <span className="font-medium text-foreground">{price}</span> : null}
                      <span>{item.productType === 'MADE_TO_ORDER' ? t('madeToOrder') : item.inStock ? t('inStock') : t('outOfStock')}</span>
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <button type="button" onClick={seeAll} className="text-sm font-semibold text-primary hover:underline">
          {t('seeAll', { query: term })}
        </button>
      ) : null}

      {status === 'done' && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-center">
          <p className="text-sm font-semibold text-foreground">{t('noResults', { query: term })}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('noResultsHint')}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={onSearchLibrary} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Sparkles className="size-4" aria-hidden="true" />
              {t('searchLibraryCta')}
            </button>
            <Link href="/custom-print" onClick={onNavigate} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary">
              {t('customPrintCta')}
            </Link>
          </div>
        </div>
      ) : null}

      {status === 'idle' && term.length === 0 ? <p className="text-xs text-muted-foreground">{t('idleHint')}</p> : null}
    </div>
  );
}
