import type { ReactNode } from 'react';
import { UntranslatedNotice } from '@/components/storefront/untranslated-notice';
import { redirect } from '@/i18n/navigation';
import { SITE_CONFIG } from '@/config/site';

// This route is outside Phase 18's translated content slice (phase-18.md Non-goals) — the
// banner is a server component, so it's added via a layout rather than inside the page itself,
// which is a 'use client' component and can't render a server component directly.
export default async function CheckoutLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SITE_CONFIG.cartEnabled) redirect({ href: '/products', locale });

  return (
    <>
      <UntranslatedNotice />
      {children}
    </>
  );
}
