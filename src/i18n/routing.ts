import { defineRouting } from 'next-intl/routing';

// Every locale the app has catalogs for. The *routable* subset is decided by the flag below.
export const ALL_LOCALES = ['vi', 'en'] as const;
export type AppLocale = (typeof ALL_LOCALES)[number];

// ADR-0048: EN is temporarily switched off as a whole (routing, sitemap, hreflang, Organizer toggle) — not
// just the Header switcher. Same env var as SITE_CONFIG.languageSwitcherEnabled; read here
// directly so middleware (edge) doesn't pull in site config. NEXT_PUBLIC_* is inlined at build
// time, so flipping it requires a rebuild. When off, `/en/*` is 308-redirected to the unprefixed
// VI URL by middleware.ts so old links/indexed URLs don't 404.
export const isEnglishEnabled = process.env.NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED === 'true';

const enabledLocales: AppLocale[] = isEnglishEnabled ? [...ALL_LOCALES] : ['vi'];

// VI is the unprefixed default (`/products`), EN is prefixed (`/en/products`) —
// phase-18.md decision #2/#3. Admin (`/admin/**`) and `/api/**` never go through this routing at
// all — they live outside the `[locale]` segment and are excluded by middleware.ts's matcher.
export const routing = defineRouting({
  locales: enabledLocales,
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
  // next-intl negotiates a locale from the visitor's Accept-Language header by default, which
  // would silently serve EN to any browser configured for English — contradicting "VI is the
  // default" (explicit product requirement). Disabling detection means the unprefixed `/` always
  // serves VI regardless of browser language; a visitor only gets EN by explicitly using the
  // LanguageSwitcher (which then persists via the NEXT_LOCALE cookie).
  localeDetection: false,
});
