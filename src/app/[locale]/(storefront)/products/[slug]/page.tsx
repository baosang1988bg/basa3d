import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCachedCategories, getCachedStorefrontProductBySlug } from '@/lib/cache/storefront-cache';
import { Breadcrumb, type BreadcrumbItem } from '@/components/storefront/breadcrumb';
import { ProductDetailShowcase } from './product-detail-showcase';
import { ViewItemTracker } from '@/components/analytics/storefront-trackers';
import { serializeJsonLd } from '@/lib/json-ld';
import { localeAlternates } from '@/i18n/seo';
import { getCategoryDisplayName } from '@/lib/categories';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedStorefrontProductBySlug(slug);
  if (!product) return {};
  const title = product.seoTitle ?? product.name;
  const description = product.seoDescription ?? product.shortDescription ?? undefined;
  return {
    title, description,
    alternates: localeAlternates(`/products/${product.slug}`),
    openGraph: { title, description, type: 'website', ...(product.images[0] ? { images: [product.images[0].url] } : {}) },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string; locale?: string }> }) {
  const { slug, locale = 'vi' } = await params;
  const [product, t, categories] = await Promise.all([
    getCachedStorefrontProductBySlug(slug),
    getTranslations('products'),
    getCachedCategories(100),
  ]);
  if (!product) notFound();

  const firstVariant = product.variants[0];
  const anyInStock = product.variants.some((variant) => variant.inStock);

  const category = product.categoryId
    ? categories.items.find((item) => item.id === product.categoryId)
    : undefined;
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t('breadcrumbHome'), href: '/home' },
    { label: t('breadcrumbProducts'), href: '/products' },
    ...(category ? [{ label: getCategoryDisplayName(category, locale), href: `/products?categoryId=${category.id}` }] : []),
    { label: product.name },
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription ?? undefined,
    ...(product.images[0] ? { image: [product.images[0].url] } : {}),
    ...(firstVariant ? {
      sku: firstVariant.sku,
      offers: {
        '@type': 'Offer', priceCurrency: 'VND', price: firstVariant.price,
        availability: anyInStock ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
      },
    } : {}),
  };
  const specs = [
    ...(firstVariant?.weightGrams != null ? [{ label: t('weight'), value: `${firstVariant.weightGrams}g` }] : []),
    ...Object.entries(firstVariant?.attributes ?? {}).map(([label, value]) => ({ label, value })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {firstVariant && <ViewItemTracker item={{ item_id: firstVariant.sku, item_name: product.name, item_category: category ? getCategoryDisplayName(category, locale) : undefined, item_variant: firstVariant.name, price: firstVariant.price, quantity: 1 }} />}
      {/* JSON-LD built server-side; serializeJsonLd escapes `</script>` in staff-entered fields. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <Breadcrumb items={breadcrumbItems} />

      <ProductDetailShowcase
        productName={product.name}
        productSlug={product.slug}
        productType={product.productType}
        basePrice={product.basePrice}
        shortDescription={product.shortDescription}
        description={product.description}
        anyInStock={anyInStock}
        inStockLabel={t('inStock')}
        printOnDemandLabel={t('printOnDemand24h')}
        noImageLabel={t('noImage')}
        specsTitle={t('specsTitle')}
        descriptionTitle={t('descriptionTitle')}
        skuLabelTemplate={t('sku', { sku: '{sku}' })}
        thumbnailLabels={product.images.map((_, index) => t('galleryThumbnail', { index: index + 1 }))}
        images={product.images.map((image) => ({ url: image.url, altText: image.altText, variantId: image.variantId }))}
        variants={product.variants.map((variant) => ({ id: variant.id, sku: variant.sku, name: variant.name, attributes: variant.attributes, price: variant.price, inStock: variant.inStock }))}
        specs={specs}
      />
    </div>
  );
}
