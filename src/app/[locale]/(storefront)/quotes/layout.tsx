import type { ReactNode } from 'react';
import { UntranslatedNotice } from '@/components/storefront/untranslated-notice';

// `/quotes/[quoteNumber]` is outside Phase 18's translated content slice (phase-18.md Non-goals).
export default function QuotesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UntranslatedNotice />
      {children}
    </>
  );
}
