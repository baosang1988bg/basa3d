'use client';

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { KnowledgeNavItem } from '@/config/knowledge-nav';
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

      {/* pt-3 is an invisible bridge between trigger and card, so the pointer never "leaves" on the way. */}
      <div
        id={panelId}
        hidden={!isOpen}
        className="absolute top-full left-1/2 z-50 -ml-48 w-96 pt-3"
      >
        <ul className="motion-safe:animate-dropdown-in rounded-2xl border border-border bg-card p-2 shadow-lg">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={close}
                className="block cursor-pointer rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
              >
                <span className="block text-[0.9375rem] font-semibold text-foreground">{t(`knowledgeItems.${item.key}.title`)}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{t(`knowledgeItems.${item.key}.description`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
