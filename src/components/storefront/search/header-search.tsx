'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { isOpenSearchShortcut, OPEN_SEARCH_EVENT, type HeaderSearchTab, type OpenSearchDetail } from './search-events';

// ADR-0064: the dialog (+ meta-engines, image search) is only downloaded when the customer opens search.
const UnifiedSearchDialog = dynamic(() => import('./unified-search-dialog').then((mod) => mod.UnifiedSearchDialog), { ssr: false });

/** Header search button: click, Ctrl/⌘+K, or `openHeaderSearch()` from any component. */
export function HeaderSearch() {
  const t = useTranslations('headerSearch');
  const [open, setOpen] = useState<{ tab: HeaderSearchTab; query: string; key: number } | null>(null);
  // Shortcut hint is decided after mount (navigator is not available during SSR → no hydration mismatch).
  const [shortcut, setShortcut] = useState('Ctrl K');
  useEffect(() => {
    if (/mac|iphone|ipad/i.test(navigator.userAgent)) setShortcut('⌘K');
  }, []);

  const show = useCallback((detail: OpenSearchDetail = {}) => {
    setOpen({ tab: detail.tab ?? 'products', query: (detail.query ?? '').slice(0, 80), key: Date.now() });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isOpenSearchShortcut(event)) return;
      event.preventDefault();
      show();
    }
    function onOpen(event: Event) {
      show((event as CustomEvent<OpenSearchDetail>).detail ?? {});
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, [show]);

  return (
    <>
      <button
        type="button"
        onClick={() => show()}
        aria-label={t('open')}
        aria-haspopup="dialog"
        title={t('openShortcut')}
        className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border px-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:w-44 lg:justify-between lg:px-3"
      >
        <span className="inline-flex items-center gap-2">
          <Search className="size-4" aria-hidden="true" />
          <span className="hidden lg:inline">{t('buttonLabel')}</span>
        </span>
        <kbd className="hidden rounded border border-border bg-secondary px-1.5 font-mono text-[10px] text-muted-foreground lg:inline">{shortcut}</kbd>
      </button>
      {open ? (
        <UnifiedSearchDialog key={open.key} isOpen onClose={() => setOpen(null)} initialTab={open.tab} initialQuery={open.query} />
      ) : null}
    </>
  );
}
