import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPage } from '@/components/storefront/legal-page';
import { SITE_CONFIG } from '@/config/site';
import { CURRENT_TOS_VERSION } from '@/lib/copyright/tos-version';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  await applyRequestLocale(params);
  const t = await getTranslations('policies.fileConfidentiality');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: '/file-confidentiality-policy',
      languages: { vi: '/file-confidentiality-policy', en: '/en/file-confidentiality-policy' },
    },
  };
}

export default async function FileConfidentialityPolicyPage({ params }: { params: LocaleParams }) {
  await applyRequestLocale(params);
  const t = await getTranslations('policies.fileConfidentiality');
  return (
    <LegalPage title={t('title')} updatedAt={CURRENT_TOS_VERSION}>
      <section>
        <h2>{t('section1Title')}</h2>
        <p>
          {t('section1BodyBefore')} <strong>{t('section1BodyStrong')}</strong>{' '}
          {t('section1BodyAfter', { siteName: SITE_CONFIG.name })}
        </p>
      </section>
      <section>
        <h2>{t('section2Title')}</h2>
        <p>{t('section2Body', { siteName: SITE_CONFIG.name })}</p>
      </section>
      <section>
        <h2>{t('section3Title')}</h2>
        <p>{t('section3Body', { hotline: SITE_CONFIG.hotline })}</p>
      </section>
      <section>
        <h2>{t('section4Title')}</h2>
        <p>
          {t('section4BodyBefore')} {SITE_CONFIG.name} {t('section4BodyAfter')}
        </p>
      </section>
    </LegalPage>
  );
}
