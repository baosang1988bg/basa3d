import { setRequestLocale } from 'next-intl/server';

export type LocaleParams = Promise<{ locale: string }>;

// Phase 42 (ADR-0045): next-intl requires setRequestLocale() in every page/layout/generateMetadata
// that should render statically — Next.js can render a page without re-running its parent layout
// (client navigation, ISR), and without this call getTranslations()/getLocale() fall back to
// reading the middleware's request header, which silently turns the route dynamic again.
// `[locale]/layout.tsx` already rejects unknown locales, so no validation is repeated here.
export async function applyRequestLocale(params: LocaleParams): Promise<string> {
  const { locale } = await params;
  setRequestLocale(locale);
  return locale;
}
