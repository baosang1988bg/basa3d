'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingCart } from 'lucide-react';
import { StorefrontButton } from '@/components/storefront/button';
import { useCart } from '@/lib/cart/cart-context';
import { trackAddToCart } from '@/lib/analytics';

type Variant = {
  id: string; sku: string; name: string; attributes: Record<string, string>; price: number; inStock: boolean;
};

export function AddToCartForm({ productSlug, productName, productType, imageUrl, variants }: { productSlug: string; productName: string; productType: string; imageUrl: string | null; variants: Variant[] }) {
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

  if (!variants.length) {
    return <p className="text-sm text-muted-foreground">Sản phẩm hiện chưa có phân loại nào để đặt hàng.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {variants.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="variant" className="text-sm font-semibold text-foreground">Phân loại</label>
          <select
            id="variant"
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            className="h-10 cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id} disabled={productType !== 'MADE_TO_ORDER' && !variant.inStock}>
                {variant.name}{productType !== 'MADE_TO_ORDER' && !variant.inStock ? ' (hết hàng)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor="quantity" className="text-sm font-semibold text-foreground">Số lượng</label>
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
        {canAdd ? (productType === 'MADE_TO_ORDER' ? 'Đặt in theo yêu cầu' : 'Thêm vào giỏ hàng') : 'Tạm hết hàng'}
      </StorefrontButton>

      {justAdded && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="size-4" /> Đã thêm vào giỏ hàng.{' '}
          <Link href="/cart" className="cursor-pointer underline underline-offset-2 hover:text-emerald-700 dark:hover:text-emerald-300">Xem giỏ hàng</Link>
        </p>
      )}
    </div>
  );
}
