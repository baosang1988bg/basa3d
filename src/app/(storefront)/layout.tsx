import type { ReactNode } from 'react';
import { Header } from '@/components/storefront/header';
import { Footer } from '@/components/storefront/footer';

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
