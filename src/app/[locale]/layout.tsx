import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { HtmlShell } from '@/components/layout/html-shell';

// Phase 42 (ADR-0045): static pages under [locale] are prerendered for every routable locale at
// `next build` — only `vi` while EN is switched off (ADR-0048, see src/i18n/routing.ts).
// This must stay a full list, not `[]`: VI URLs reach these routes through a middleware rewrite
// (`/privacy-policy` → `/vi/privacy-policy`) and `next start` only serves rewritten URLs from the
// cache when the path was prerendered — on-demand-only ISR is silently rendered per request there.
// The home page tolerates a build without a reachable DB (see loadHomeCatalog in its page.tsx).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this locale's subtree (next-intl requirement) — must run before
  // any `getTranslations()`/`useTranslations()` call in this request.
  setRequestLocale(locale);

  return (
    <HtmlShell lang={locale}>
      <NextIntlClientProvider>
        {children}
      </NextIntlClientProvider>
    </HtmlShell>
  );
}
