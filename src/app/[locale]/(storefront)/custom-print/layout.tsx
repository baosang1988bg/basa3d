import type { ReactNode } from 'react';
import { UntranslatedNotice } from '@/components/storefront/untranslated-notice';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';

// This route (and its `tao-mau-khac-ten` keychain-generator subroute) is outside Phase 18's
// translated content slice (phase-18.md Non-goals).
export default async function CustomPrintLayout({ children, params }: { children: ReactNode; params: LocaleParams }) {
  // Phase 42: UntranslatedNotice calls getLocale(); without this it would read the request header
  // and make /custom-print dynamic.
  await applyRequestLocale(params);
  return (
    <>
      <UntranslatedNotice />
      {children}
    </>
  );
}
