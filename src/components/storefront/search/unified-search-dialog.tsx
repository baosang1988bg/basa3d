'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Boxes, Image as ImageIcon, Package } from 'lucide-react';
import { SearchModalShell, SearchTab } from './search-modal-shell';
import { ProductSearchPanel } from './product-search-panel';
import { ModelSearchPanel } from './model-search-panel';
import type { HeaderSearchTab } from './search-events';

/**
 * ADR-0064 — header search. Tab 1 (default) is the shop catalog; tabs 2–3 are the external 3D-library and image
 * search. One query is shared across tabs so "not in the shop → search the libraries" keeps what was typed.
 * Loaded lazily by HeaderSearch (next/dynamic) — never part of the first page load.
 */
export function UnifiedSearchDialog({
  isOpen,
  onClose,
  initialTab = 'products',
  initialQuery = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: HeaderSearchTab;
  initialQuery?: string;
}) {
  const t = useTranslations('headerSearch');
  const [tab, setTab] = useState<HeaderSearchTab>(initialTab);
  const [query, setQuery] = useState(initialQuery);

  return (
    <SearchModalShell isOpen={isOpen} onClose={onClose} labelledBy="header-search-title" closeLabel={t('close')}>
      <h2 id="header-search-title" className="pr-10 text-xl font-extrabold text-foreground sm:text-2xl">{t('title')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('subtitle')}</p>
      <div role="tablist" aria-label={t('title')} className="mt-4 flex overflow-x-auto border-b border-border">
        <SearchTab active={tab === 'products'} onClick={() => setTab('products')} icon={<Package className="size-4" />}>{t('tabProducts')}</SearchTab>
        <SearchTab active={tab === 'library'} onClick={() => setTab('library')} icon={<Boxes className="size-4" />}>{t('tabLibrary')}</SearchTab>
        <SearchTab active={tab === 'image'} onClick={() => setTab('image')} icon={<ImageIcon className="size-4" />}>{t('tabImage')}</SearchTab>
      </div>

      {tab === 'products' ? (
        <ProductSearchPanel query={query} onQueryChange={setQuery} onSearchLibrary={() => setTab('library')} onNavigate={onClose} />
      ) : (
        <ModelSearchPanel
          tab={tab === 'image' ? 'image' : 'text'}
          onTabChange={(next) => setTab(next === 'image' ? 'image' : 'library')}
          query={query}
          onQueryChange={setQuery}
          onNavigate={onClose}
        />
      )}
    </SearchModalShell>
  );
}
