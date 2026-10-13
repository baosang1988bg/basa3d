import type { ReactNode } from 'react';
import { UntranslatedNotice } from '@/components/storefront/untranslated-notice';

// Same as /custom-print: Vietnamese-only content for now (EN visitors see the notice banner).
export default function BaoGiaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UntranslatedNotice />
      {children}
    </>
  );
}
