'use client';

import { useTranslations, useLocale } from 'next-intl';
import { usePathname, getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

// Deliberately a plain <a> (full page navigation), not next-intl's client router: the <html lang>
// attribute lives in the root layout (src/app/layout.tsx), which sits *above* the `[locale]`
// segment and does not re-render on a client-side soft navigation between locales — only a real
// navigation re-runs middleware and the root layout with the new locale. Locale switching is
// infrequent, so the cost of a full reload here is worth the correctness (phase-18.md decision #6).
export function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('label')}>
      {routing.locales.map((loc) => (
        <a
          key={loc}
          href={getPathname({ href: pathname, locale: loc })}
          aria-current={locale === loc ? 'true' : undefined}
          className={`cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold uppercase transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            locale === loc ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {loc}
        </a>
      ))}
    </div>
  );
}
