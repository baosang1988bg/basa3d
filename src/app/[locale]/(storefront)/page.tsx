import type { Metadata } from 'next';
import Image from 'next/image';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { PackageCheck, Sparkles, Timer, ShoppingBag, ArrowRight } from 'lucide-react';
import { getCachedCategories, getCachedStorefrontProducts } from '@/lib/cache/storefront-cache';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';
import { localeAlternates } from '@/i18n/seo';
import { getCategoryDisplayName } from '@/lib/categories';
import { ProductCard } from '@/components/storefront/product-card';
import { SectionHeader } from '@/components/storefront/section-header';
import { FaqAccordion } from '@/components/storefront/faq-accordion';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { SITE_CONFIG } from '@/config/site';
import { Link } from '@/i18n/navigation';
import { serializeJsonLd } from '@/lib/json-ld';

type DbCategoryItem = { id: string; name: string; slug: string };

function getCategoryHref(
  categoryName: string,
  dbCategories: readonly DbCategoryItem[],
): string {
  const normalized = categoryName.toLowerCase();
  const directMatch = dbCategories.find(
    (c) =>
      c.name.toLowerCase() === normalized ||
      getCategoryDisplayName(c, 'vi').toLowerCase() === normalized ||
      getCategoryDisplayName(c, 'en').toLowerCase() === normalized,
  );
  if (directMatch) return `/products?categoryId=${directMatch.id}`;

  if (normalized.includes('móc khoá') || normalized.includes('móc khóa') || normalized.includes('keychain')) {
    const match = dbCategories.find((c) => c.slug === 'keychain');
    if (match) return `/products?categoryId=${match.id}`;
  }
  if (normalized.includes('mô hình') || normalized.includes('art toy') || normalized.includes('nhân vật') || normalized.includes('figure')) {
    const match = dbCategories.find((c) => c.slug === 'figure-model' || c.name.toLowerCase().includes('figure'));
    if (match) return `/products?categoryId=${match.id}`;
  }
  if (normalized.includes('decor') || normalized.includes('trang trí')) {
    const match = dbCategories.find((c) => c.slug === 'home-decor' || c.name.toLowerCase().includes('decor'));
    if (match) return `/products?categoryId=${match.id}`;
  }
  if (normalized.includes('phụ kiện') || normalized.includes('tiện ích') || normalized.includes('accessories') || normalized.includes('gadgets')) {
    const match = dbCategories.find((c) => c.slug === 'accessories-gadgets' || c.name.toLowerCase().includes('accessories') || c.name.toLowerCase().includes('gadgets'));
    if (match) return `/products?categoryId=${match.id}`;
  }
  if (normalized.includes('keycap') || normalized.includes('nút phím') || normalized.includes('nút bàn phím')) {
    const match = dbCategories.find((c) => c.slug === 'keycap');
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

const HERO_VALUE_PROP_ICONS = [PackageCheck, Sparkles, Timer];

// Phase 42 (ADR-0045): ISR instead of force-dynamic. Prerendered at `next build` for both locales and
// then served from cache; catalog writes call invalidateStorefrontCatalog() after commit, which purges
// this page through the `storefront-catalog` tag on its data, and 60s is only the safety net (the old
// "stale forever until the next deploy" problem no longer applies). Keep in sync with
// STOREFRONT_CATALOG_TTL_SECONDS (route segment config must be a literal).
export const revalidate = 60;

// A build must not depend on a reachable database (local builds, CI without DATABASE_URL). If the
// catalog cannot be read while prerendering, connection() opts this route into per-request rendering
// for that build only — the pre-Phase-42 behaviour — instead of failing the build. At runtime the
// error is rethrown as usual.
async function loadHomeCatalog() {
  try {
    const [featuredRes, categoriesRes] = await Promise.all([
      getCachedStorefrontProducts({ limit: 8, featuredOnly: true }),
      getCachedCategories(100),
    ]);
    const productsRes = featuredRes.items.length > 0
      ? featuredRes
      : await getCachedStorefrontProducts({ limit: 8 });
    return [productsRes, categoriesRes] as const;
  } catch (error) {
    if (process.env.NEXT_PHASE === 'phase-production-build') await connection();
    throw error;
  }
}

export const metadata: Metadata = {
  alternates: localeAlternates('/'),
};

export default async function HomePage({ params }: { params: LocaleParams }) {
  await applyRequestLocale(params);
  const [[{ items: featuredProducts }, { items: dbCategoriesRaw }], t] = await Promise.all([
    loadHomeCatalog(),
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
        <Link href="/custom-print" className="group block cursor-pointer overflow-hidden rounded-2xl border border-border shadow-sm transition-opacity duration-150 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <Image src="/brand/home-banner-2058.webp" alt={t('bannerAlt', { phone: SITE_CONFIG.zaloPhone })} width={2058} height={764} priority sizes="(max-width: 1152px) 100vw, 1120px" className="h-auto w-full transition-transform duration-700 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
        </Link>
      </div>
      <section className="mx-auto max-w-6xl px-4 py-16 text-center md:py-24">
        <h1 className="font-heading mx-auto max-w-3xl text-4xl font-extrabold text-foreground md:text-[3.25rem] md:leading-[1.15]">
          {t('heroTitle')}
        </h1>
        {/* Phase 43: decorative "extruded layer" stroke, drawn once like a nozzle laying filament.
            pathLength=1 + dasharray 1 → animating dashoffset 1→0 draws it; without the animation
            (reduced motion, old browsers) it is simply fully drawn. Not the LCP element. */}
        <svg viewBox="0 0 240 14" className="mx-auto mt-4 h-3.5 w-44 text-accent md:w-56" fill="none" aria-hidden="true">
          <path d="M3 9 C 40 3, 78 3, 118 8 S 196 13, 237 5" pathLength={1} stroke="currentColor" strokeWidth={3} strokeLinecap="round" className="[stroke-dasharray:1] motion-safe:animate-draw-line" />
        </svg>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">{t('heroDescription')}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <div className="relative inline-flex">
            <Link
              href="/products"
              className={storefrontButtonClasses('primary', 'group gap-2 px-6 py-3 text-base shadow-tactile-lift')}
            >
              <ShoppingBag className="size-5 transition-transform duration-200 group-hover:scale-110 motion-reduce:group-hover:transform-none" aria-hidden="true" />
              <span>{t('ctaExploreProducts')}</span>
              <ArrowRight className="size-4.5 transition-transform duration-150 ease-out group-hover:translate-x-1 motion-reduce:group-hover:transform-none" aria-hidden="true" />
            </Link>
            <span className="pointer-events-none absolute -top-2.5 -right-2 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground shadow-sm motion-safe:animate-pulse">
              {t('ctaExploreBadge')}
            </span>
          </div>
          <Link href="/custom-print" className={storefrontButtonClasses('secondary', 'px-5 py-3 text-base')}>
            {t('ctaCustomPrint')}
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{t('quickBrowseLabel')}:</span>
          {categories.map((category) => {
            const href = getCategoryHref(category.name, dbCategories);
            return (
              <Link
                key={category.name}
                href={href}
                className="inline-flex cursor-pointer items-center rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-150 hover:border-primary/50 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {category.name}
              </Link>
            );
          })}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {heroValueProps.map(({ label, href }, index) => {
            const Icon = HERO_VALUE_PROP_ICONS[index];
            return (
              <Link
                key={label}
                href={href}
                className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground transition-colors duration-150 hover:border-primary/50 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {Icon && <Icon className="size-4 text-primary transition-transform duration-200 ease-out group-hover:-rotate-12 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:transform-none" aria-hidden="true" />}
                {label}
              </Link>
            );
          })}
        </div>
      </section>


      <section className="bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeader
            eyebrow={t('categoriesEyebrow')}
            title={t('categoriesTitle')}
            action={
              <Link
                href="/products"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              >
                <span>{t('viewAllProducts')}</span>
                <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            }
          />
          <div className="reveal-stagger grid grid-cols-2 gap-4 md:grid-cols-4">
            {categories.map((category) => {
              const href = getCategoryHref(category.name, dbCategories);
              return (
                <Link
                  key={category.name}
                  href={href}
                  className="group block cursor-pointer rounded-xl border border-border/60 bg-card p-4 shadow-tactile transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md motion-reduce:transition-colors motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

      <section id="featured-products" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-12 md:py-16">
        <SectionHeader
          eyebrow={t('featuredEyebrow')}
          title={t('featuredTitle')}
          description={t('featuredDescription')}
          action={
            <Link
              href="/products"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              <span>{t('viewAll')}</span>
              <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          }
        />

        {featuredProducts.length > 0 ? (
          <div className="reveal-stagger grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="reveal rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center sm:p-12">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShoppingBag className="size-6" aria-hidden="true" />
            </div>
            <h3 className="font-heading mt-4 text-base font-semibold text-foreground md:text-lg">
              {t('featuredTitle')}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {t('emptyFeatured')}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/products"
                className={storefrontButtonClasses('primary', 'group gap-2 px-5 py-2.5 text-sm shadow-tactile-lift')}
              >
                <ShoppingBag className="size-4" aria-hidden="true" />
                <span>{t('viewAllProducts')}</span>
                <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {featuredProducts.length > 0 && (
          <div className="reveal mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/products"
              className={storefrontButtonClasses('secondary', 'group gap-2 px-6 py-3 text-sm font-semibold shadow-tactile hover:border-primary/50')}
            >
              <ShoppingBag className="size-4.5 text-primary transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
              <span>{t('viewAllProducts')}</span>
              <ArrowRight className="size-4.5 transition-transform duration-150 ease-out group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <section id="workflow" className="scroll-mt-20 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeader eyebrow={t('workflowEyebrow')} title={t('workflowTitle')} />
          <div className="reveal-stagger grid grid-cols-1 gap-4 md:grid-cols-4">
            {workflowSteps.map((item) => (
              <div key={item.step} className="group rounded-xl bg-card p-4 shadow-tactile">
                <span className="font-heading inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors duration-200 group-hover:bg-accent group-hover:text-accent-foreground">{item.step}</span>
                <h3 className="font-heading mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="reveal mt-6 text-center">
            <Link href="/custom-print" className={storefrontButtonClasses('primary')}>{t('ctaStartOrder')}</Link>
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader eyebrow={t('faqEyebrow')} title={t('faqTitle')} />
        <FaqAccordion items={faqItems} className="reveal-stagger" />
      </section>
    </>
  );
}
