import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Zap, ShieldCheck, Timer } from 'lucide-react';
import { listStorefrontProducts } from '@/services/storefront-catalog.service';
import { listCategories } from '@/services/product.service';
import { ProductCard } from '@/components/storefront/product-card';
import { SectionHeader } from '@/components/storefront/section-header';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { MaterialBadge } from '@/components/storefront/material-badge';
import { SITE_CONFIG } from '@/config/site';
import { Link } from '@/i18n/navigation';
import { serializeJsonLd } from '@/lib/json-ld';

type DbCategoryItem = { id: string; name: string; slug: string };

function getCategoryHref(
  categoryName: string,
  dbCategories: readonly DbCategoryItem[],
): string {
  const normalized = categoryName.toLowerCase();
  const directMatch = dbCategories.find((c) => c.name.toLowerCase() === normalized);
  if (directMatch) return `/products?categoryId=${directMatch.id}`;

  if (normalized.includes('móc khoá') || normalized.includes('móc khóa') || normalized.includes('keychain')) {
    const match = dbCategories.find((c) => c.slug === 'keychain');
    if (match) return `/products?categoryId=${match.id}`;
  }
  if (normalized.includes('mô hình') || normalized.includes('art toy')) {
    const match = dbCategories.find((c) => c.slug === 'figure-model' || c.name.toLowerCase().includes('figure'));
    if (match) return `/products?categoryId=${match.id}`;
  }
  if (normalized.includes('decor')) {
    const match = dbCategories.find((c) => c.slug === 'home-decor' || c.name.toLowerCase().includes('decor'));
    if (match) return `/products?categoryId=${match.id}`;
  }
  if (normalized.includes('phụ kiện')) {
    const match = dbCategories.find((c) => c.slug === 'accessories-gadgets' || c.name.toLowerCase().includes('accessories') || c.name.toLowerCase().includes('gadgets'));
    if (match) return `/products?categoryId=${match.id}`;
  }

  const partialMatch = dbCategories.find((c) => normalized.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(normalized));
  if (partialMatch) return `/products?categoryId=${partialMatch.id}`;

  return '/products';
}

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
  const [{ items: featuredProducts }, { items: dbCategoriesRaw }, t] = await Promise.all([
    listStorefrontProducts({ limit: 8, featuredOnly: true }),
    listCategories({ limit: 100 }),
    getTranslations('home'),
  ]);
  const dbCategories = dbCategoriesRaw as unknown as DbCategoryItem[];

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
      {/* JSON-LD built server-side; serializeJsonLd escapes `</script>` in staff-entered fields. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(LOCAL_BUSINESS_JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />
      {/* Phase 37: banner thương hiệu. Chữ in sẵn trong ảnh → alt mang đủ nội dung; hero text bên dưới giữ nguyên
          vì trên mobile chữ trong ảnh rất nhỏ. */}
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <Link href="/custom-print" className="block cursor-pointer overflow-hidden rounded-2xl border border-border shadow-sm transition-opacity duration-150 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <Image src="/brand/home-banner-2058.webp" alt={t('bannerAlt', { phone: SITE_CONFIG.zaloPhone })} width={2058} height={764} priority sizes="(max-width: 1152px) 100vw, 1120px" className="h-auto w-full" />
        </Link>
      </div>
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


      <section className="bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeader eyebrow={t('categoriesEyebrow')} title={t('categoriesTitle')} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {categories.map((category) => {
              const href = getCategoryHref(category.name, dbCategories);
              return (
                <Link
                  key={category.name}
                  href={href}
                  className="group block cursor-pointer rounded-xl border border-border/60 bg-card p-4 shadow-tactile transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <h3 className="font-heading text-base font-semibold text-foreground transition-colors duration-150 group-hover:text-primary">
                    {category.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                </Link>
              );
            })}
          </div>
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

      <section id="workflow" className="scroll-mt-20 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeader eyebrow={t('workflowEyebrow')} title={t('workflowTitle')} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {workflowSteps.map((item) => (
              <div key={item.step} className="rounded-xl bg-card p-4 shadow-tactile">
                <span className="font-heading inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{item.step}</span>
                <h3 className="font-heading mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/custom-print" className={storefrontButtonClasses('primary')}>{t('ctaStartOrder')}</Link>
          </div>
        </div>
      </section>

      <section id="materials" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <SectionHeader eyebrow={t('materialsEyebrow')} title={t('materialsTitle')} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-card p-4 shadow-tactile">
            <MaterialBadge material="PLA" />
            <p className="mt-2 text-sm text-muted-foreground">{t('materialPlaDescription')}</p>
          </div>
          <div className="rounded-xl bg-card p-4 shadow-tactile">
            <MaterialBadge material="PETG" />
            <p className="mt-2 text-sm text-muted-foreground">{t('materialPetgDescription')}</p>
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

      <section className="bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeader title={t('qualityTitle')} description={t('qualityDescription')} />
        </div>
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
