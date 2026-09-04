import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getStorefrontProductBySlug } from '@/services/storefront-catalog.service';
import { listCategories } from '@/services/product.service';
import { SpecTable } from '@/components/storefront/spec-table';
import { formatVnd } from '@/components/storefront/format';
import { Breadcrumb, type BreadcrumbItem } from '@/components/storefront/breadcrumb';
import { AddToCartForm } from './add-to-cart-form';
import { ViewItemTracker } from '@/components/analytics/storefront-trackers';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);
  if (!product) return {};
  const title = product.seoTitle ?? product.name;
  const description = product.seoDescription ?? product.shortDescription ?? undefined;
  return {
    title, description,
    alternates: {
      canonical: `/products/${product.slug}`,
      languages: { vi: `/products/${product.slug}`, en: `/en/products/${product.slug}` },
    },
    openGraph: { title, description, type: 'website', ...(product.images[0] ? { images: [product.images[0].url] } : {}) },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, t] = await Promise.all([getStorefrontProductBySlug(slug), getTranslations('products')]);
  if (!product) notFound();

  const firstVariant = product.variants[0];
  const anyInStock = product.variants.some((variant) => variant.inStock);

  const category = product.categoryId
    ? (await listCategories({ limit: 100 })).items.find((item) => item.id === product.categoryId)
    : undefined;
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t('breadcrumbHome'), href: '/' },
    { label: t('breadcrumbProducts'), href: '/products' },
    ...(category ? [{ label: category.name, href: `/products?categoryId=${category.id}` }] : []),
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
      {firstVariant && <ViewItemTracker item={{ item_id: firstVariant.sku, item_name: product.name, item_category: category?.name, item_variant: firstVariant.name, price: firstVariant.price, quantity: 1 }} />}
      {/* Static JSON-LD constructed server-side from our own data, not user input rendered as HTML. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumb items={breadcrumbItems} />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl bg-muted/50">
            {product.images[0] ? (
              <Image src={product.images[0].url} alt={product.images[0].altText ?? product.name} width={600} height={600} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">{t('noImage')}</div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {product.images.map((image) => (
                <div key={image.url} className="size-16 overflow-hidden rounded-lg bg-muted/50">
                  <Image src={image.url} alt={image.altText ?? product.name} width={64} height={64} className="size-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">{product.name}</h1>
          {firstVariant && <p className="mt-1 text-sm text-muted-foreground">{t('sku', { sku: firstVariant.sku })}</p>}
          <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${anyInStock ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {anyInStock ? t('inStock') : t('printOnDemand24h')}
          </span>
          {product.basePrice != null && <p className="mt-4 text-2xl font-bold text-foreground">{formatVnd(product.basePrice)}</p>}
          {product.shortDescription && <p className="mt-4 text-base text-muted-foreground">{product.shortDescription}</p>}

          <div className="mt-6">
            <AddToCartForm
              productType={product.productType}
              productSlug={product.slug}
              productName={product.name}
              imageUrl={product.images[0]?.url ?? null}
              variants={product.variants.map((variant) => ({ id: variant.id, sku: variant.sku, name: variant.name, attributes: variant.attributes, price: variant.price, inStock: variant.inStock }))}
            />
          </div>

          {specs.length > 0 && (
            <div className="mt-8">
              <p className="mb-2 text-sm font-semibold text-foreground">{t('specsTitle')}</p>
              <SpecTable specs={specs} />
            </div>
          )}

          {product.description && (
            <div className="mt-8">
              <p className="mb-2 text-sm font-semibold text-foreground">{t('descriptionTitle')}</p>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
