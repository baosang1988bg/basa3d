import type { ReactNode } from 'react';
import { Header } from '@/components/storefront/header';
import { Footer } from '@/components/storefront/footer';
import { ZaloFloatingButton } from '@/components/storefront/zalo-floating-button';
import { CartProvider } from '@/lib/cart/cart-context';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';
import { getCachedCategories } from '@/lib/cache/storefront-cache';

export default async function StorefrontLayout({ children, params }: { children: ReactNode; params: LocaleParams }) {
  // Phase 42: Next.js renders layouts and pages in parallel, so the server-rendered Footer
  // (useTranslations) needs the locale set here too or it reads the request header → dynamic.
  await applyRequestLocale(params);
  const categories = await getCachedCategories(50).then((res) => res.items).catch(() => []);
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <Header categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer />
        <ZaloFloatingButton />
      </div>
    </CartProvider>
  );
}
