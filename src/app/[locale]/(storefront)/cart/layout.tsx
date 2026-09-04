import type { ReactNode } from 'react';
import { UntranslatedNotice } from '@/components/storefront/untranslated-notice';

// This route is outside Phase 18's translated content slice (phase-18.md Non-goals) — the
// banner is a server component, so it's added via a layout rather than inside the page itself,
// which is a 'use client' component and can't render a server component directly.
export default function CartLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UntranslatedNotice />
      {children}
    </>
  );
}
