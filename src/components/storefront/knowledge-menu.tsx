'use client';

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, BookOpen, Newspaper, Wrench, Layers, Ruler } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { KnowledgeNavItem, KnowledgeNavKey } from '@/config/knowledge-nav';
import { trackNavigationClick } from '@/lib/analytics';
import { cn } from '@/lib/utils';

// Phase 50 — desktop "Kiến thức in 3D ▾" dropdown. Disclosure pattern (button + aria-expanded +
// plain links), not an ARIA `menu`: the items are navigation links, Tab order stays natural.
//
// - Mouse: opens on hover, closes 150ms after the pointer leaves (time to cross into the panel).
//   Hover only reacts to pointerType === 'mouse', so a tap on a touch laptop doesn't open-then-close.
// - Click / tap / Enter / Space on the trigger toggles; a click right after hover-open pins it open.
// - Esc closes and returns focus to the trigger; focus or a click leaving the menu closes it.
// The panel is `absolute` inside the sticky header — fine despite its backdrop-filter, which only
// re-anchors `fixed` descendants (see the drawer comment in header.tsx).
const CLOSE_DELAY_MS = 150;

const ICONS: Record<KnowledgeNavKey, typeof BookOpen> = {
  handbook: BookOpen,
  blog: Newspaper,
  troubleshooting: Wrench,
  materials: Layers,
  tolerances: Ruler,
};

export function KnowledgeMenu({ items, isActive, pathname }: { items: KnowledgeNavItem[]; isActive: boolean; pathname: string }) {
  const t = useTranslations('nav');
  const [isOpen, setIsOpen] = useState(false);
  const openedByHoverRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const close = useCallback(() => {
    cancelClose();
    openedByHoverRef.current = false;
    setIsOpen(false);
  }, []);

  useEffect(() => close, [close]);
  // Route change (link click, back/forward) closes the panel.
  useEffect(() => close(), [pathname, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen, close]);

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    cancelClose();
    if (!isOpen) openedByHoverRef.current = true;
    setIsOpen(true);
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    cancelClose();
    closeTimerRef.current = setTimeout(close, CLOSE_DELAY_MS);
  };
  const onTriggerClick = () => {
    if (isOpen && openedByHoverRef.current) {
      openedByHoverRef.current = false; // pin: the hover already opened it
      return;
    }
    openedByHoverRef.current = false;
    setIsOpen((open) => !open);
  };

  const primaryItems = items.filter((item) => item.key === 'handbook' || item.key === 'blog');
  const shortcutItems = items.filter((item) => item.key !== 'handbook' && item.key !== 'blog');

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onTriggerClick}
        className={cn(
          'relative inline-flex cursor-pointer items-center gap-1 py-1 text-sm font-medium transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-primary after:transition-transform after:duration-200 after:ease-out motion-reduce:after:transition-none',
          isActive || isOpen ? 'text-foreground after:scale-x-100' : 'text-muted-foreground after:scale-x-0',
          isActive && 'font-semibold',
        )}
      >
        {t('knowledge')}
        <ChevronDown aria-hidden="true" className={cn('size-3.5 transition-transform duration-200 motion-reduce:transition-none', isOpen && 'rotate-180')} />
      </button>

      {/* pt-2 is an invisible bridge between trigger and card, matching products dropdown. */}
      <div
        id={panelId}
        hidden={!isOpen}
        className="absolute top-full left-0 z-50 pt-2"
      >
        <ul className="motion-safe:animate-dropdown-in w-64 rounded-2xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-lg backdrop-blur-md">
          {primaryItems.map((item) => {
            const Icon = ICONS[item.key] ?? BookOpen;
            const isCurrent = pathname === item.href || (item.href !== '/home' && pathname.startsWith(`${item.href}/`));
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => {
                    close();
                    trackNavigationClick({ placement: 'header', nav_key: item.key, target: item.href });
                  }}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 outline-none focus-visible:bg-secondary focus-visible:text-foreground',
                    isCurrent
                      ? 'bg-secondary font-semibold text-primary'
                      : 'text-foreground/90 hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                    {t(`knowledgeItems.${item.key}.title`)}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">→</span>
                </Link>
              </li>
            );
          })}

          {shortcutItems.length > 0 && (
            <>
              <li role="separator" aria-hidden="true">
                <hr className="my-1 border-border" />
              </li>
              <li className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('shortcuts')}
              </li>
              {shortcutItems.map((item) => {
                const Icon = ICONS[item.key] ?? Wrench;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        close();
                        trackNavigationClick({ placement: 'header', nav_key: item.key, target: item.href });
                      }}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground/80 transition-colors duration-150 outline-none hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground"
                    >
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{t(`knowledgeItems.${item.key}.title`)}</span>
                    </Link>
                  </li>
                );
              })}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
