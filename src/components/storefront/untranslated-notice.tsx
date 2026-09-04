import { getLocale, getTranslations } from 'next-intl/server';

// Renders nothing for the VI default locale. For EN, pages outside Phase 18's translated slice
// (cart, checkout, custom-print, blog, quotes — phase-18.md decision #8) still render their
// Vietnamese content as-is; this banner is the only thing that changes, so the visitor knows why
// the rest of the page isn't in English rather than assuming something is broken.
export async function UntranslatedNotice() {
  const locale = await getLocale();
  if (locale === 'vi') return null;

  const t = await getTranslations();
  return (
    <div className="border-b border-border bg-secondary/50 px-4 py-2 text-center text-sm text-muted-foreground">
      {t('untranslatedNotice')}
    </div>
  );
}
