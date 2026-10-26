'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { HandbookTocItem } from '@/data/handbook/types';
import { cn } from '@/lib/utils';

// Phase 50 — scroll-spy TOC. It wraps the server-rendered chapters (`children` stay RSC output, not
// client JS) so one IntersectionObserver drives both the desktop sidebar and the mobile tab bar.
//
// Activation band: just below the sticky chrome (64px header + ~44px mobile tab bar ≈ 112px) down to
// 45% of the viewport. Sections (not headings) are observed with a single threshold, so a long
// chapter covering the band stays active and the callback only fires on enter/leave — no scroll
// listener, no throttle needed.
const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: '-112px 0px -55% 0px', threshold: 0 };
const SCROLL_LOCK_FALLBACK_MS = 1000;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function HandbookToc({ items, children }: { items: HandbookTocItem[]; children: ReactNode }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  // While a TOC click is smooth-scrolling, ignore observer updates so the highlight does not sweep
  // through every chapter in between.
  const scrollLockRef = useRef(false);
  const mobileBarRef = useRef<HTMLDivElement>(null);
  const idsKey = items.map((item) => item.id).join('|');

  useEffect(() => {
    const ids = idsKey.split('|').filter(Boolean);
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      if (scrollLockRef.current) return;
      // Topmost visible chapter wins; when none is in the band (between chapters), keep the last one.
      const top = ids.find((id) => visible.has(id));
      if (top) setActiveId((current) => (current === top ? current : top));
    }, OBSERVER_OPTIONS);

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [idsKey]);

  // Keep the active tab visible in the mobile bar. scrollTo on the bar itself — scrollIntoView()
  // would also scroll the page vertically on iOS Safari and make the page jump.
  useEffect(() => {
    const bar = mobileBarRef.current;
    if (!bar || bar.offsetParent === null) return; // hidden on desktop
    const tab = bar.querySelector<HTMLElement>(`[data-toc-id="${CSS.escape(activeId)}"]`);
    if (!tab) return;
    const left = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [activeId]);

  const handleClick = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return; // let the browser follow the plain #hash
    event.preventDefault();
    setActiveId(id);
    scrollLockRef.current = true;

    const unlock = () => {
      scrollLockRef.current = false;
      window.removeEventListener('scrollend', unlock);
      clearTimeout(fallbackTimer);
    };
    window.addEventListener('scrollend', unlock, { once: true });
    // Browsers without `scrollend` (older Safari), or a click on the chapter already in view (no scroll).
    const fallbackTimer = setTimeout(unlock, 'onscrollend' in window ? SCROLL_LOCK_FALLBACK_MS * 3 : SCROLL_LOCK_FALLBACK_MS);

    // `scroll-mt-28` on each section keeps the heading clear of the sticky header/tab bar.
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  return (
    <div>
      {/* Mobile: horizontal tab bar. A direct child of this wrapper (not inside a grid cell) so it
          stays sticky for the whole article. `sticky`, not `fixed`: the storefront template animates
          with transform, which would re-anchor a fixed element. */}
      <nav aria-label="Mục lục cẩm nang" className="sticky top-16 z-30 -mx-4 border-b border-border bg-background/95 backdrop-blur lg:hidden">
        <div ref={mobileBarRef} className="relative flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                data-toc-id={item.id}
                aria-current={active ? 'location' : undefined}
                onClick={(event) => handleClick(event, item.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors duration-150',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="tabular-nums opacity-70">{item.number}</span> {item.title}
              </a>
            );
          })}
        </div>
      </nav>

      <div className="mt-6 grid gap-10 lg:mt-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <nav aria-label="Mục lục cẩm nang">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mục lục</p>
            <ol className="mt-3 space-y-1 border-l border-border">
              {items.map((item) => {
                const active = item.id === activeId;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      aria-current={active ? 'location' : undefined}
                      onClick={(event) => handleClick(event, item.id)}
                      className={cn(
                        '-ml-px flex gap-2 border-l-2 py-1.5 pl-3 text-sm transition-colors duration-150',
                        active ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span className="tabular-nums text-primary/80">{item.number}</span>
                      <span>{item.title}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
