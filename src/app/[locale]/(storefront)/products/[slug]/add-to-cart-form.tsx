'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, MessageCircle, ShoppingCart } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { StorefrontButton } from '@/components/storefront/button';
import { useCart } from '@/lib/cart/cart-context';
import { trackAddToCart, trackContactClick } from '@/lib/analytics';
import { SITE_CONFIG } from '@/config/site';

type Variant = {
  id: string; sku: string; name: string; attributes: Record<string, string>; price: number; inStock: boolean;
};

function ContactToOrder({ productName }: { productName: string }) {
  const t = useTranslations('products');
  return (
    <div className="flex flex-col gap-2">
      <a
        href={SITE_CONFIG.zaloUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackContactClick('zalo', `product:${productName}`)}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0068FF] px-4 py-2.5 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 sm:w-auto"
      >
        <MessageCircle className="size-4" /> {t('contactToOrderZalo')}
      </a>
      <p className="text-sm text-muted-foreground">{t('contactToOrderHotline', { hotline: SITE_CONFIG.hotline })}</p>
    </div>
  );
}

export function AddToCartForm({ productSlug, productName, productType, imageUrl, variants }: { productSlug: string; productName: string; productType: string; imageUrl: string | null; variants: Variant[] }) {
  const t = useTranslations('products');
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const canAdd = Boolean(selectedVariant && (productType === 'MADE_TO_ORDER' || selectedVariant.inStock));

  function handleAddToCart() {
    if (!selectedVariant || !canAdd) return;
    addItem({
      variantId: selectedVariant.id,
      productSlug,
      productName,
      variantName: selectedVariant.name,
      sku: selectedVariant.sku,
      attributes: selectedVariant.attributes,
      price: selectedVariant.price,
      imageUrl,
    }, quantity);
    trackAddToCart({ item_id: selectedVariant.sku, item_name: productName, item_variant: selectedVariant.name, price: selectedVariant.price }, quantity);
    setJustAdded(true);
    setQuantity(1);
    setTimeout(() => setJustAdded(false), 3000);
  }

  if (!SITE_CONFIG.cartEnabled) {
    return <ContactToOrder productName={productName} />;
  }

  if (!variants.length) {
    return <p className="text-sm text-muted-foreground">{t('noVariants')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {variants.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="variant" className="text-sm font-semibold text-foreground">{t('variantLabel')}</label>
          <select
            id="variant"
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            className="h-10 cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id} disabled={productType !== 'MADE_TO_ORDER' && !variant.inStock}>
                {variant.name}{productType !== 'MADE_TO_ORDER' && !variant.inStock ? t('variantOutOfStock') : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor="quantity" className="text-sm font-semibold text-foreground">{t('quantityLabel')}</label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={10000}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.min(10000, Number(event.target.value) || 1)))}
            className="h-10 w-20 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <StorefrontButton variant="accent" onClick={handleAddToCart} disabled={!canAdd} className="w-full sm:w-auto">
        <ShoppingCart className="mr-2 size-4" />
        {canAdd ? (productType === 'MADE_TO_ORDER' ? t('orderCustom') : t('addToCart')) : t('temporarilyOutOfStock')}
      </StorefrontButton>

      {justAdded && (
        <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 dark:text-emerald-400">
          <Check className="size-4" /> {t('addedToCart')}{' '}
          <Link href="/cart" className="cursor-pointer underline underline-offset-2 hover:text-emerald-700 dark:hover:text-emerald-300">{t('viewCart')}</Link>
        </p>
      )}
    </div>
  );
}
