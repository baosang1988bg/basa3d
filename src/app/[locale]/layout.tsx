import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

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
    <NextIntlClientProvider>
      {children}
    </NextIntlClientProvider>
  );
}
