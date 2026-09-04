import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPage } from '@/components/storefront/legal-page';
import { SITE_CONFIG } from '@/config/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('policies.returns');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/return-policy', languages: { vi: '/return-policy', en: '/en/return-policy' } },
  };
}

export default async function ReturnPolicyPage() {
  const t = await getTranslations('policies.returns');
  return (
    <LegalPage title={t('title')} updatedAt="2026-08-31">
      <section>
        <h2>{t('section1Title')}</h2>
        <p>{t('section1Body')}</p>
      </section>
      <section>
        <h2>{t('section2Title')}</h2>
        <ul>
          <li>{t('section2Item1')}</li>
          <li>{t('section2Item2')}</li>
        </ul>
      </section>
      <section>
        <h2>{t('section3Title')}</h2>
        <p>{t('section3Body', { hotline: SITE_CONFIG.hotline })}</p>
      </section>
    </LegalPage>
  );
}
