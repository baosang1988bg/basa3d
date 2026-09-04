import { defineRouting } from 'next-intl/routing';

// VI is the unprefixed default (`/products`), EN is prefixed (`/en/products`) —
// phase-18.md decision #2/#3. Admin (`/admin/**`) and `/api/**` never go through this routing at
// all — they live outside the `[locale]` segment and are excluded by middleware.ts's matcher.
export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
  // next-intl negotiates a locale from the visitor's Accept-Language header by default, which
  // would silently serve EN to any browser configured for English — contradicting "VI is the
  // default" (explicit product requirement). Disabling detection means the unprefixed `/` always
  // serves VI regardless of browser language; a visitor only gets EN by explicitly using the
  // LanguageSwitcher (which then persists via the NEXT_LOCALE cookie).
  localeDetection: false,
});
