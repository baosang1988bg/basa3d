'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Menu, X, ShoppingCart, MessageCircle } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { BAO_GIA_ENABLED_IN_BROWSER } from '@/config/bao-gia';
import { SITE_CONFIG } from '@/config/site';
import { useCart } from '@/lib/cart/cart-context';
import { trackContactClick } from '@/lib/analytics';

// Anchor links (e.g. `/#materials`) have no distinct pathname to match against, so they never
// report active — accepted as out of scope for this slice rather than tracking scroll position.
function isNavLinkActive(pathname: string, href: string): boolean {
  if (href.includes('#')) return false;
  if (href === '/home' || href === '/') {
    return pathname === '/home' || pathname === '/';
  }
  return pathname.startsWith(href);
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const pathname = usePathname();
  const t = useTranslations('nav');

  const navLinks = [
    { href: '/home', label: t('home') },
    { href: '/products', label: t('products') },
    { href: '/tools', label: t('tools') },
    ...(BAO_GIA_ENABLED_IN_BROWSER ? [{ href: '/bao-gia', label: t('quote') }] : []),
    { href: '/custom-print', label: t('customPrint') },
    ...(SITE_CONFIG.blogEnabled ? [{ href: '/blog', label: t('blog') }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/home" className="inline-flex shrink-0 cursor-pointer items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          {/* Phase 37: logo thật (nền trong suốt, đọc được cả light/dark). priority vì nằm trên mọi trang. */}
          <Image src="/brand/basa3d-logo.webp" alt={t('logoAlt')} width={443} height={192} priority className="h-10 w-auto md:h-12" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => {
            const isActive = isNavLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`cursor-pointer text-sm font-medium transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                {link.label}
              </Link>
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
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D97706] px-1 text-[10px] font-bold text-white dark:bg-[#F59E0B] dark:text-[#0F172A]">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            aria-label={t('openMenu')}
            onClick={() => setIsMenuOpen(true)}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground md:hidden"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 md:hidden" onClick={() => setIsMenuOpen(false)}>
          <div
            className="ml-auto flex h-full w-72 flex-col gap-1 bg-card p-4 shadow-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-heading text-lg font-bold">{t('menuTitle')}</span>
              <button type="button" aria-label={t('closeMenu')} onClick={() => setIsMenuOpen(false)} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border">
                <X className="size-4" />
              </button>
            </div>
            {navLinks.map((link) => {
              const isActive = isNavLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`cursor-pointer rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors duration-150 hover:bg-secondary ${isActive ? 'font-semibold' : 'font-medium'}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
