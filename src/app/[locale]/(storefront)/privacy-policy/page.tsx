import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPage } from '@/components/storefront/legal-page';
import { SITE_CONFIG } from '@/config/site';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';
import { localeAlternates } from '@/i18n/seo';

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  await applyRequestLocale(params);
  const t = await getTranslations('policies.privacy');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localeAlternates('/privacy-policy'),
  };
}

export default async function PrivacyPolicyPage({ params }: { params: LocaleParams }) {
  await applyRequestLocale(params);
  const t = await getTranslations('policies.privacy');
  return (
    <LegalPage title={t('title')} updatedAt="2026-08-31">
      <section>
        <h2>{t('section1Title')}</h2>
        <p>{t('section1Body', { siteName: SITE_CONFIG.name })}</p>
      </section>
      <section>
        <h2>{t('section2Title')}</h2>
        <ul>
          <li>{t('section2Item1')}</li>
          <li>{t('section2Item2')}</li>
          <li>{t('section2Item3')}</li>
        </ul>
      </section>
      <section>
        <h2>{t('section3Title')}</h2>
        <p>{t('section3Body')}</p>
      </section>
      <section>
        <h2>{t('section4Title')}</h2>
        <p>{t('section4Body', { hotline: SITE_CONFIG.hotline })}</p>
      </section>
    </LegalPage>
  );
}
