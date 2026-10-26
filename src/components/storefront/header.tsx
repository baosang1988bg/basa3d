'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Menu, X, ShoppingCart, MessageCircle, ChevronDown, Package } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { BAO_GIA_ENABLED_IN_BROWSER } from '@/config/bao-gia';
import { SITE_CONFIG } from '@/config/site';
import { useCart } from '@/lib/cart/cart-context';
import { trackContactClick } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export type StorefrontCategoryNavItem = {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
};

export interface HeaderProps {
  categories?: StorefrontCategoryNavItem[];
}

// Anchor links (e.g. `/#materials`) have no distinct pathname to match against, so they never
// report active — accepted as out of scope for this slice rather than tracking scroll position.
function isNavLinkActive(pathname: string, href: string): boolean {
  if (href.includes('#')) return false;
  if (href === '/home' || href === '/') {
    return pathname === '/home' || pathname === '/';
  }
  return pathname.startsWith(href);
}

// Phase 43: re-mounting the badge (new `key`) replays its pop; only real increases after the stored
// cart has loaded count, so reading the cart on page load never animates.
function useCartBadgeBump(itemCount: number, isReady: boolean): number {
  const [bump, setBump] = useState(0);
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (!isReady) return;
    if (lastCount.current !== null && itemCount > lastCount.current) setBump((value) => value + 1);
    lastCount.current = itemCount;
  }, [itemCount, isReady]);
  return bump;
}

export function Header({ categories: initialCategories = [] }: HeaderProps = {}) {
  const [categories, setCategories] = useState<StorefrontCategoryNavItem[]>(initialCategories);
  const [isProductsDropdownOpen, setIsProductsDropdownOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { itemCount, isReady } = useCart();
  const badgeBump = useCartBadgeBump(itemCount, isReady);
  const pathname = usePathname();
  const t = useTranslations('nav');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync or fetch categories if not provided on SSR
  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
      return;
    }
    let active = true;
    fetch('/api/categories?limit=50')
      .then((res) => res.json())
      .then((data) => {
        if (active && Array.isArray(data?.items)) {
          setCategories(data.items);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [initialCategories]);

  // Read active category from URL without wrapping in Suspense
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setActiveCategoryId(params.get('categoryId'));
    }
  }, [pathname]);

  const navLinks = [
    { href: '/home', label: t('home') },
    { href: '/products', label: t('products') },
    { href: '/tools', label: t('tools') },
    ...(BAO_GIA_ENABLED_IN_BROWSER ? [{ href: '/bao-gia', label: t('quote') }] : []),
    { href: '/custom-print', label: t('customPrint') },
    ...(SITE_CONFIG.blogEnabled ? [{ href: '/blog', label: t('blog') }] : []),
  ];

  // Close menus whenever the route changes (link tap, browser back).
  useEffect(() => {
    setIsMenuOpen(false);
    setIsProductsDropdownOpen(false);
  }, [pathname]);

  // Close desktop dropdown on Escape
  useEffect(() => {
    if (!isProductsDropdownOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProductsDropdownOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isProductsDropdownOpen]);

  // Cleanup hover close timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsProductsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setIsProductsDropdownOpen(false);
    }, 150);
  };

  const handleDropdownBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsProductsDropdownOpen(false);
    }
  };

  // Drawer open: focus moves into it, Esc closes, the page behind cannot scroll. On close, focus
  // returns to the ☰ button that opened it.
  useEffect(() => {
    if (!isMenuOpen) return;
    const menuButton = menuButtonRef.current;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [isMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/home" className="inline-flex shrink-0 cursor-pointer items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            {/* Phase 37: logo thật (nền trong suốt, đọc được cả light/dark). priority vì nằm trên mọi trang. */}
            <Image src="/brand/basa3d-logo.webp" alt={t('logoAlt')} width={443} height={192} priority className="h-10 w-auto md:h-12" />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => {
              const isActive = isNavLinkActive(pathname, link.href);
              const isProductsLink = link.href === '/products';

              if (!isProductsLink) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative cursor-pointer py-1 text-sm font-medium transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      // Phase 43: underline that grows from the left on hover and stays on the active page.
                      'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-primary after:transition-transform after:duration-200 after:ease-out motion-reduce:after:transition-none',
                      isActive ? 'font-semibold text-foreground after:scale-x-100' : 'text-muted-foreground after:scale-x-0 hover:after:scale-x-100',
                    )}
                  >
                    {link.label}
                  </Link>
                );
              }

              return (
                <div
                  key={link.href}
                  ref={dropdownContainerRef}
                  className="relative flex items-center"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onFocus={handleMouseEnter}
                  onBlur={handleDropdownBlur}
                >
                  <Link
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    aria-haspopup="true"
                    aria-expanded={isProductsDropdownOpen}
                    onClick={() => setIsProductsDropdownOpen(false)}
                    className={cn(
                      'relative inline-flex items-center gap-1 cursor-pointer py-1 text-sm font-medium transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-primary after:transition-transform after:duration-200 after:ease-out motion-reduce:after:transition-none',
                      isActive ? 'font-semibold text-foreground after:scale-x-100' : 'text-muted-foreground after:scale-x-0 hover:after:scale-x-100',
                    )}
                  >
                    <span>{link.label}</span>
                    <ChevronDown
                      className={cn(
                        'size-3.5 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none',
                        isProductsDropdownOpen && 'rotate-180 text-foreground',
                      )}
                      aria-hidden="true"
                    />
                  </Link>

                  {/* Dropdown panel on hover */}
                  <div
                    role="menu"
                    aria-label={link.label}
                    className={cn(
                      'absolute top-full left-0 z-50 pt-2 transition-all duration-200 ease-out motion-reduce:transition-none',
                      isProductsDropdownOpen
                        ? 'visible opacity-100 translate-y-0 pointer-events-auto'
                        : 'invisible opacity-0 -translate-y-1 pointer-events-none',
                    )}
                  >
                    <div className="w-64 rounded-2xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-lg backdrop-blur-md">
                      <Link
                        href="/products"
                        role="menuitem"
                        onClick={() => setIsProductsDropdownOpen(false)}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 outline-none focus-visible:bg-secondary focus-visible:text-foreground',
                          !activeCategoryId && isActive
                            ? 'bg-secondary font-semibold text-primary'
                            : 'text-foreground/90 hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Package className="size-4 text-primary" />
                          {t('allProducts')}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">→</span>
                      </Link>

                      {categories.length > 0 && (
                        <>
                          <hr className="my-1 border-border" />
                          <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto px-0.5">
                            {categories.map((category) => {
                              const isSelected = pathname === '/products' && activeCategoryId === category.id;
                              return (
                                <Link
                                  key={category.id}
                                  href={`/products?categoryId=${category.id}`}
                                  role="menuitem"
                                  onClick={() => setIsProductsDropdownOpen(false)}
                                  className={cn(
                                    'flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors duration-150 outline-none focus-visible:bg-secondary focus-visible:text-foreground',
                                    isSelected
                                      ? 'bg-secondary font-semibold text-primary'
                                      : 'text-foreground/80 hover:bg-secondary hover:text-foreground',
                                  )}
                                >
                                  <span className="truncate">{category.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={SITE_CONFIG.zaloUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackContactClick('zalo', 'header')}
              className="hidden cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
            >
              <MessageCircle className="size-4 text-[#0068FF]" /> {t('zaloConsult')}
            </a>
            {SITE_CONFIG.languageSwitcherEnabled && <LanguageSwitcher />}
            <ThemeToggle />
            {SITE_CONFIG.cartEnabled && (
              <Link
                href="/cart"
                aria-label={itemCount > 0 ? t('cartAriaLabelWithCount', { count: itemCount }) : t('cartAriaLabelEmpty')}
                className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ShoppingCart className="size-4" />
                {itemCount > 0 && (
                  <span
                    key={badgeBump}
                    className={cn(
                      'absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D97706] px-1 text-[10px] font-bold text-white dark:bg-[#F59E0B] dark:text-[#0F172A]',
                      badgeBump > 0 && 'motion-safe:animate-badge-pop',
                    )}
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>
            )}
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={t('openMenu')}
              aria-expanded={isMenuOpen}
              aria-controls="storefront-mobile-menu"
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground transition-colors duration-150 hover:bg-secondary md:hidden"
            >
              <Menu className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Phase 43: the drawer is a sibling of <header>, not a child. The header's backdrop-blur
          (backdrop-filter) makes it the containing block of `position: fixed` descendants, so the
          old in-header overlay was clipped to the 64px header and the menu spilled over the page
          without a backdrop. It stays mounted so it can slide out as well as in (ui-ux skill panel
          timing: 500ms in / 350ms out, iOS sheet curve); `inert` keeps it out of Tab order and the
          accessibility tree while closed. */}
      <div id="storefront-mobile-menu" inert={!isMenuOpen} className={cn('fixed inset-0 z-50 md:hidden', !isMenuOpen && 'pointer-events-none')}>
        <div
          aria-hidden
          onClick={() => setIsMenuOpen(false)}
          className={cn(
            'absolute inset-0 bg-black/30 transition-opacity ease-sheet motion-reduce:transition-none',
            isMenuOpen ? 'opacity-100 duration-500' : 'opacity-0 duration-[350ms]',
          )}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('menuTitle')}
          tabIndex={-1}
          className={cn(
            'absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-1 bg-card p-4 shadow-md outline-none transition-transform ease-sheet will-change-transform motion-reduce:transition-none',
            isMenuOpen ? 'translate-x-0 duration-500' : 'translate-x-full duration-[350ms]',
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="font-heading text-lg font-bold">{t('menuTitle')}</span>
            <button type="button" aria-label={t('closeMenu')} onClick={() => setIsMenuOpen(false)} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border transition-colors duration-150 hover:bg-secondary">
              <X className="size-4" />
            </button>
          </div>
          {navLinks.map((link, index) => {
            const isActive = isNavLinkActive(pathname, link.href);
            const isProductsLink = link.href === '/products';
            return (
              <div key={link.href} className="flex flex-col">
                <Link
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  // Links follow the panel in, one after another; on close they leave together.
                  style={{ transitionDelay: isMenuOpen ? `${120 + index * 40}ms` : '0ms' }}
                  className={cn(
                    'cursor-pointer rounded-lg px-3 py-2.5 text-sm text-foreground transition-[background-color,opacity,transform] duration-300 ease-out hover:bg-secondary motion-reduce:transform-none motion-reduce:transition-none',
                    isActive ? 'bg-secondary/60 font-semibold' : 'font-medium',
                    isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
                  )}
                >
                  {link.label}
                </Link>
                {isProductsLink && categories.length > 0 && (
                  <div
                    style={{ transitionDelay: isMenuOpen ? `${140 + index * 40}ms` : '0ms' }}
                    className={cn(
                      'ml-4 my-1 flex flex-col gap-0.5 border-l border-border/70 pl-3 transition-[opacity,transform] duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none',
                      isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
                    )}
                  >
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/products?categoryId=${cat.id}`}
                        onClick={() => setIsMenuOpen(false)}
                        className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
