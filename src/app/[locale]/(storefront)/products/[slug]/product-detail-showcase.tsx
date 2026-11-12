'use client';

import { useMemo, useState } from 'react';
import { formatVnd } from '@/components/storefront/format';
import { SpecTable } from '@/components/storefront/spec-table';
import { AddToCartForm } from './add-to-cart-form';
import { ProductGallery } from './product-gallery';

type Variant = {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  inStock: boolean;
};

type GalleryImage = {
  url: string;
  altText: string | null;
  variantId: string | null;
};

export function ProductDetailShowcase({
  productName,
  productSlug,
  productType,
  basePrice,
  shortDescription,
  description,
  anyInStock,
  inStockLabel,
  printOnDemandLabel,
  noImageLabel,
  specsTitle,
  descriptionTitle,
  skuLabelTemplate,
  thumbnailLabels,
  images,
  variants,
  specs,
}: {
  productName: string;
  productSlug: string;
  productType: string;
  basePrice: number | null;
  shortDescription: string | null;
  description: string | null;
  anyInStock: boolean;
  inStockLabel: string;
  printOnDemandLabel: string;
  noImageLabel: string;
  specsTitle: string;
  descriptionTitle: string;
  skuLabelTemplate: string;
  thumbnailLabels: string[];
  images: GalleryImage[];
  variants: Variant[];
  specs: { label: string; value: string }[];
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? '');
  const [galleryIndex, setGalleryIndex] = useState(0);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0];

  const variantImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const img of images) {
      if (img.variantId && !map[img.variantId]) map[img.variantId] = img.url;
    }
    return map;
  }, [images]);

  function handleSelectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    const matchedImageIndex = images.findIndex((img) => img.variantId === variantId);
    if (matchedImageIndex >= 0) setGalleryIndex(matchedImageIndex);
  }

  const pricePrices = variants.map((v) => v.price).filter((p) => p > 0);
  const minPrice = pricePrices.length ? Math.min(...pricePrices) : basePrice;
  const maxPrice = pricePrices.length ? Math.max(...pricePrices) : basePrice;
  const displayPrice = selectedVariant?.price ?? basePrice;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <ProductGallery
        images={images}
        productName={productName}
        noImageLabel={noImageLabel}
        thumbnailLabels={thumbnailLabels}
        activeIndex={galleryIndex}
        onActiveIndexChange={setGalleryIndex}
      />

      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">{productName}</h1>
        {selectedVariant ? (
          <p className="mt-1 text-sm text-muted-foreground">{skuLabelTemplate.replace('{sku}', selectedVariant.sku)}</p>
        ) : null}
        <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${anyInStock ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
          {anyInStock ? inStockLabel : printOnDemandLabel}
        </span>

        {displayPrice != null ? (
          <div className="mt-4 flex flex-wrap items-baseline gap-2.5">
            <p className="font-heading text-2xl font-bold tabular-nums text-foreground">{formatVnd(displayPrice)}</p>
            {minPrice != null && maxPrice != null && minPrice !== maxPrice ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                ({formatVnd(minPrice)} – {formatVnd(maxPrice)})
              </span>
            ) : null}
          </div>
        ) : null}

        {shortDescription ? <p className="mt-4 text-base text-muted-foreground">{shortDescription}</p> : null}

        <div className="mt-6">
          <AddToCartForm
            productType={productType}
            productSlug={productSlug}
            productName={productName}
            imageUrl={images[0]?.url ?? null}
            variants={variants}
            selectedVariantId={selectedVariant?.id}
            onVariantChange={handleSelectVariant}
            variantImageMap={variantImageMap}
          />
        </div>

        {specs.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-sm font-semibold text-foreground">{specsTitle}</p>
            <SpecTable specs={specs} />
          </div>
        )}

        {description && (
          <div className="mt-8">
            <p className="mb-2 text-sm font-semibold text-foreground">{descriptionTitle}</p>
            <p className="text-sm whitespace-pre-line text-muted-foreground">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
