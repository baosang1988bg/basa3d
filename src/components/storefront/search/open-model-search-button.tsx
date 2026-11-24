'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { openHeaderSearch } from './search-events';

/** ADR-0064 — /products zero-result state: opens the header search on the 3D-library tab with the same query. */
export function OpenModelSearchButton({ query }: { query: string }) {
  const t = useTranslations('headerSearch');
  return (
    <button
      type="button"
      onClick={() => openHeaderSearch({ tab: 'library', query })}
      className={storefrontButtonClasses('primary')}
    >
      <Sparkles className="size-4" aria-hidden="true" />
      {query ? t('emptySearchLibrary', { query }) : t('searchLibraryCta')}
    </button>
  );
}
