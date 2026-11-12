'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, MessageCircle, ShoppingCart } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { StorefrontButton } from '@/components/storefront/button';
import { formatVnd } from '@/components/storefront/format';
import { useCart } from '@/lib/cart/cart-context';
import { trackAddToCart, trackContactClick } from '@/lib/analytics';
import { SITE_CONFIG } from '@/config/site';

type Variant = {
  id: string; sku: string; name: string; attributes: Record<string, string>; price: number; inStock: boolean;
};

function ContactToOrder({ productName }: { productName: string }) {
  const t = useTranslations('products');
  const [copied, setCopied] = useState(false);

  async function handleZaloClick() {
    trackContactClick('zalo', `product:${productName}`);
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
      const message = `Chào BaSa3D, mình muốn tư vấn đặt in / mua sản phẩm: "${productName}"${currentUrl ? ` (Link: ${currentUrl})` : ''}.`;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      }
    } catch {
      // Fallback if clipboard API is blocked
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <a
        href={SITE_CONFIG.zaloUrl}
        target="_blank"
        rel="noreferrer"
        onClick={handleZaloClick}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0068FF] px-4 py-2.5 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 sm:w-auto"
      >
        <MessageCircle className="size-4" />
        {copied ? 'Đã copy thông tin · Đang mở Zalo...' : t('contactToOrderZalo')}
      </a>
      {copied ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="size-3.5" /> Đã sao chép tên sản phẩm vào bộ nhớ tạm! Bạn chỉ cần dán (Paste) vào Zalo.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('contactToOrderHotline', { hotline: SITE_CONFIG.hotline })}</p>
      )}
    </div>
  );
}

export function AddToCartForm({
  productSlug,
  productName,
  productType,
  imageUrl,
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
  const { addItem } = useCart();
  const [uncontrolledVariantId, setUncontrolledVariantId] = useState(variants[0]?.id ?? '');
  const selectedVariantId = controlledVariantId ?? uncontrolledVariantId;
  const setSelectedVariantId = onVariantChange ?? setUncontrolledVariantId;
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const canAdd = Boolean(selectedVariant && (productType === 'MADE_TO_ORDER' || selectedVariant.inStock));

  function handleAddToCart() {
    if (!selectedVariant || !canAdd) return;
    const chosenImage = variantImageMap?.[selectedVariant.id] ?? imageUrl;
    addItem({
      variantId: selectedVariant.id,
      productSlug,
      productName,
      variantName: selectedVariant.name,
      sku: selectedVariant.sku,
      attributes: selectedVariant.attributes,
      price: selectedVariant.price,
      imageUrl: chosenImage,
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
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">{t('variantLabel')} ({variants.length})</span>
          <div role="radiogroup" aria-label={t('variantLabel')} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {variants.map((variant) => {
              const active = variant.id === selectedVariant?.id;
              const disabled = productType !== 'MADE_TO_ORDER' && !variant.inStock;
              const thumb = variantImageMap?.[variant.id];
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`flex items-center gap-2.5 rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  {thumb ? (
                    <Image src={thumb} alt="" width={40} height={40} className="size-10 shrink-0 rounded-lg border border-border object-cover" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{variant.name}</p>
                    <p className="text-xs font-semibold tabular-nums text-primary">
                      {formatVnd(variant.price)}
                      {disabled ? <span className="ml-1 font-normal text-muted-foreground">{t('variantOutOfStock')}</span> : null}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <label htmlFor="quantity" className="text-sm font-semibold text-foreground">{t('quantityLabel')}</label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
            className="h-10 w-16 rounded-lg border border-input bg-background px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <StorefrontButton type="button" onClick={handleAddToCart} disabled={!canAdd}>
          <ShoppingCart className="size-4" /> {canAdd ? t('addToCart') : t('outOfStock')}
        </StorefrontButton>
      </div>
      {justAdded && (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="size-4" />
          {t('addedToCart')} <Link href="/cart" className="underline">{t('viewCart')}</Link>
        </p>
      )}
    </div>
  );
}
