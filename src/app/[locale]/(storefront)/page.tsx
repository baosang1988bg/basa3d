import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Zap, ShieldCheck, Timer, Cuboid, Download, Send } from 'lucide-react';
import { listStorefrontProducts } from '@/services/storefront-catalog.service';
import { ProductCard } from '@/components/storefront/product-card';
import { SectionHeader } from '@/components/storefront/section-header';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { MaterialBadge } from '@/components/storefront/material-badge';
import { SITE_CONFIG } from '@/config/site';
import { Link } from '@/i18n/navigation';

// LocalBusiness JSON-LD data comes straight from SITE_CONFIG (already env-driven with sensible
// fallbacks) — not fabricated (phase-7.md decision #5). SITE_CONFIG.address is city-level only, so
// this uses addressLocality rather than a full street address that doesn't exist yet.
const LOCAL_BUSINESS_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
  telephone: SITE_CONFIG.hotline,
  email: SITE_CONFIG.email,
  address: { '@type': 'PostalAddress', addressLocality: SITE_CONFIG.address, addressCountry: 'VN' },
};

const HERO_VALUE_PROP_ICONS = [Zap, ShieldCheck, Timer];

// Forces on-demand rendering instead of build-time static generation: this page reads live
// catalog/stock data (product status and inventory availability change frequently), and without
// this, Next.js would try to statically prerender it at `next build` time using whatever
// DATABASE_URL happens to be set in the build environment — stale forever until the next deploy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/', languages: { vi: '/', en: '/en' } },
};

export default async function HomePage() {
  const [{ items: featuredProducts }, t] = await Promise.all([
    listStorefrontProducts({ limit: 8, featuredOnly: true }),
    getTranslations('home'),
  ]);

  const categories = t.raw('categories') as { name: string; description: string }[];
  const workflowSteps = t.raw('workflowSteps') as { step: string; title: string; description: string }[];
  const heroValueProps = t.raw('heroValueProps') as { label: string; href: string }[];
  const faqItems = t.raw('faq') as { question: string; answer: string }[];

  // Built from faqItems above, not fabricated content — same "real data only" rule as the
  // LocalBusiness JSON-LD (phase-7.md decision #5).
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <>
      {/* Static JSON-LD constructed server-side from our own data, not user input rendered as HTML. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <section className="mx-auto max-w-6xl px-4 py-16 text-center md:py-24">
        <h1 className="font-heading mx-auto max-w-3xl text-4xl font-extrabold text-foreground md:text-[3.25rem] md:leading-[1.15]">
          {t('heroTitle')}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{t('heroDescription')}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/custom-print" className={storefrontButtonClasses('accent')}>{t('ctaCustomPrint')}</Link>
          <Link href="/products" className={storefrontButtonClasses('secondary')}>{t('ctaExploreProducts')}</Link>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {heroValueProps.map(({ label, href }, index) => {
            const Icon = HERO_VALUE_PROP_ICONS[index];
            return (
              <Link
                key={label}
                href={href}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground transition-colors duration-150 hover:border-primary/50 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {Icon && <Icon className="size-4 text-primary" aria-hidden="true" />}
                {label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 md:p-8">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('toolEyebrow')}</p>
              <h2 className="font-heading mt-2 text-2xl font-extrabold text-foreground md:text-3xl">{t('toolTitle')}</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">{t('toolDescription')}</p>
              <div className="mt-5 flex flex-wrap gap-4 text-sm text-foreground">
                <span className="inline-flex items-center gap-1.5"><Cuboid className="size-4 text-primary" />{t('toolFeaturePreview')}</span>
                <span className="inline-flex items-center gap-1.5"><Download className="size-4 text-primary" />{t('toolFeatureDownload')}</span>
                <span className="inline-flex items-center gap-1.5"><Send className="size-4 text-primary" />{t('toolFeatureRequest')}</span>
              </div>
              <Link href="/tools/keychain-generator" className={storefrontButtonClasses('accent', 'mt-6')}>
                {t('toolCta')}
              </Link>
            </div>
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-border bg-background/70 p-6" aria-hidden="true">
              <div className="relative flex h-24 w-64 rotate-[-5deg] items-center justify-center rounded-2xl bg-slate-900 shadow-xl dark:bg-slate-700">
                <div className="absolute left-4 size-7 rounded-full border-[6px] border-background/90" />
                <span className="font-heading ml-8 text-3xl font-extrabold tracking-wide text-amber-400">BaSa3D</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader eyebrow={t('categoriesEyebrow')} title={t('categoriesTitle')} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {categories.map((category) => (
            <div key={category.name} className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-base font-semibold text-foreground">{category.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            </div>
          ))}
        </div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeader eyebrow={t('featuredEyebrow')} title={t('featuredTitle')} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      )}

      <section id="workflow" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <SectionHeader eyebrow={t('workflowEyebrow')} title={t('workflowTitle')} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {workflowSteps.map((item) => (
            <div key={item.step} className="rounded-xl border border-border bg-card p-4">
              <span className="font-heading inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{item.step}</span>
              <h3 className="font-heading mt-3 text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/custom-print" className={storefrontButtonClasses('primary')}>{t('ctaStartOrder')}</Link>
        </div>
      </section>

      <section id="materials" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <SectionHeader eyebrow={t('materialsEyebrow')} title={t('materialsTitle')} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <MaterialBadge material="PLA" />
            <p className="mt-2 text-sm text-muted-foreground">{t('materialPlaDescription')}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <MaterialBadge material="PETG" />
            <p className="mt-2 text-sm text-muted-foreground">{t('materialPetgDescription')}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <MaterialBadge material="RESIN" />
            <p className="mt-2 text-sm text-muted-foreground">{t('materialResinDescription')}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-secondary/50 p-4">
          <p className="text-sm font-semibold text-foreground">{t('pricingTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('pricingDescription')}</p>
          <Link href="/custom-print" className={storefrontButtonClasses('secondary', 'mt-3 text-sm')}>
            {t('ctaGetQuote')}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader title={t('qualityTitle')} description={t('qualityDescription')} />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader eyebrow={t('faqEyebrow')} title={t('faqTitle')} />
        <div className="flex flex-col gap-3">
          {faqItems.map((item) => (
            <details key={item.question} className="group rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer list-none font-heading text-base font-semibold text-foreground marker:content-none">
                {item.question}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
