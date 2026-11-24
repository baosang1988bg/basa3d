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
      {/*
        Emil design-eng principles applied:
        - :active → scale(0.97) for instant press feedback (100ms)
        - hover: border brightens + icon/text color shift (150ms ease-out)
        - kbd badge: visible contrast, shrink-0 so it never collapses
        - Breakpoint: icon-only on md, full pill from lg onward (w-44)
        - overflow-hidden clips content cleanly inside rounded border
        - whitespace-nowrap prevents label wrap at any width
      */}
      <button
        type="button"
        onClick={() => show()}
        aria-label={t('open')}
        aria-haspopup="dialog"
        title={t('openShortcut')}
        className={[
          // Base layout
          'group inline-flex h-8 shrink-0 cursor-pointer items-center gap-2',
          'overflow-hidden whitespace-nowrap rounded-lg border px-2',
          // Colors — idle
          'border-border bg-transparent text-muted-foreground',
          // Hover — border brightens, bg tints, text shifts
          'hover:border-border/80 hover:bg-secondary hover:text-foreground',
          // Press feedback — instant scale (Emil: 100-160ms)
          'transition-[transform,background-color,border-color,color]',
          'duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
          'active:scale-[0.97] active:duration-100',
          // Focus ring
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          // Responsive: narrow → icon only; lg+ → full pill
          'lg:w-44 lg:justify-between lg:px-3',
        ].join(' ')}
      >
        {/* Left: icon + label */}
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Search
            className="size-4 shrink-0 transition-colors duration-150 group-hover:text-primary"
            aria-hidden="true"
          />
          <span className="hidden truncate text-sm lg:inline">{t('buttonLabel')}</span>
        </span>

        {/* Right: keyboard shortcut badge — only on lg+ */}
        <kbd className="hidden shrink-0 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] leading-none text-muted-foreground lg:inline-flex">
          {shortcut}
        </kbd>
      </button>

      {open ? (
        <UnifiedSearchDialog key={open.key} isOpen onClose={() => setOpen(null)} initialTab={open.tab} initialQuery={open.query} />
      ) : null}
    </>
  );
}
