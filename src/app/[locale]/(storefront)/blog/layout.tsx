import type { ReactNode } from 'react';
import { UntranslatedNotice } from '@/components/storefront/untranslated-notice';

// Covers both the blog list and `/blog/[slug]` post pages — both are outside Phase 18's
// translated content slice (phase-18.md Non-goals).
export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UntranslatedNotice />
      {children}
    </>
  );
}
