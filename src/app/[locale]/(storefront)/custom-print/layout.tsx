import type { ReactNode } from 'react';
import { UntranslatedNotice } from '@/components/storefront/untranslated-notice';

// This route (and its `tao-mau-khac-ten` keychain-generator subroute) is outside Phase 18's
// translated content slice (phase-18.md Non-goals).
export default function CustomPrintLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UntranslatedNotice />
      {children}
    </>
  );
}
