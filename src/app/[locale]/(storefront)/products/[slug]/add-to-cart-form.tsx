'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatVnd } from '@/components/storefront/format';
import { ZaloConsultButton } from '@/components/storefront/zalo-consult-button';
import { SITE_CONFIG } from '@/config/site';

type Variant = {
  id: string; sku: string; name: string; attributes: Record<string, string>; price: number; inStock: boolean;
};

export function AddToCartForm({
  productName,
  productType,
  variants,
  selectedVariantId: controlledVariantId,
  onVariantChange,
  variantImageMap,
}: {
  productSlug: string;
  productName: string;
  productType: string;
  imageUrl: string | null;
  variants: Variant[];
  selectedVariantId?: string;
  onVariantChange?: (variantId: string) => void;
  variantImageMap?: Record<string, string>;
}) {
  const t = useTranslations('products');
  const [uncontrolledVariantId, setUncontrolledVariantId] = useState(variants[0]?.id ?? '');
  const selectedVariantId = controlledVariantId ?? uncontrolledVariantId;
  const setSelectedVariantId = onVariantChange ?? setUncontrolledVariantId;

  const activeVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0];

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">{t('variantLabel')} ({variants.length})</span>
          <div role="radiogroup" aria-label={t('variantLabel')} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {variants.map((variant) => {
              const active = variant.id === activeVariant?.id;
              const unavailable = productType !== 'MADE_TO_ORDER' && !variant.inStock;
              const thumb = variantImageMap?.[variant.id];
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                      : 'border-border bg-card hover:bg-muted/40'
                  } ${unavailable ? 'opacity-65' : ''}`}
                >
                  {thumb ? (
                    <Image src={thumb} alt="" width={40} height={40} className="size-10 shrink-0 rounded-lg border border-border object-cover" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {variant.name}
                      {unavailable ? t('variantOutOfStock') : ''}
                    </p>
                    {variant.price > 0 && (
                      <p className="text-xs font-semibold text-primary tabular-nums">{formatVnd(variant.price)}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ZaloConsultButton
        label={t('contactToOrderZalo')}
        hotlineHint={t('contactToOrderHotline', { hotline: SITE_CONFIG.hotline })}
        payload={() => ({
          source: 'product',
          title: productName,
          specs: activeVariant
            ? [
                { label: 'Phiên bản', value: activeVariant.name },
                { label: 'SKU', value: activeVariant.sku },
              ]
            : [],
          estimatedPriceVnd: activeVariant?.price ? { min: activeVariant.price } : null,
        })}
      />
    </div>
  );
}
