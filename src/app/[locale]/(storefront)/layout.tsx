import type { ReactNode } from 'react';
import { Header } from '@/components/storefront/header';
import { Footer } from '@/components/storefront/footer';
import { ZaloFloatingButton } from '@/components/storefront/zalo-floating-button';
import { CartProvider } from '@/lib/cart/cart-context';

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <ZaloFloatingButton />
      </div>
    </CartProvider>
  );
}
