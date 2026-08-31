'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ShoppingCart, MessageCircle } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { SITE_CONFIG } from '@/config/site';
import { useCart } from '@/lib/cart/cart-context';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/products', label: 'Sản phẩm' },
  { href: '/custom-print', label: 'Đặt in' },
  { href: '/#materials', label: 'Vật liệu' },
  { href: '/blog', label: 'Blog' },
];

// Anchor links (e.g. `/#materials`) have no distinct pathname to match against, so they never
// report active — accepted as out of scope for this slice rather than tracking scroll position.
function isNavLinkActive(pathname: string, href: string): boolean {
  if (href.includes('#')) return false;
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-heading cursor-pointer text-xl font-extrabold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          BaSa3D
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => {
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
            className="hidden cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
          >
            <MessageCircle className="size-4 text-[#0068FF]" /> Zalo tư vấn
          </a>
          <ThemeToggle />
          <Link
            href="/cart"
            aria-label={itemCount > 0 ? `Giỏ hàng, ${itemCount} sản phẩm` : 'Giỏ hàng'}
            className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ShoppingCart className="size-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D97706] px-1 text-[10px] font-bold text-white dark:bg-[#F59E0B] dark:text-[#0F172A]">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            aria-label="Mở menu"
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
              <span className="font-heading text-lg font-bold">Menu</span>
              <button type="button" aria-label="Đóng menu" onClick={() => setIsMenuOpen(false)} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border">
                <X className="size-4" />
              </button>
            </div>
            {NAV_LINKS.map((link) => {
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
