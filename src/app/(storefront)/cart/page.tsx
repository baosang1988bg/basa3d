'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { formatVnd } from '@/components/storefront/format';
import { useCart } from '@/lib/cart/cart-context';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <ShoppingBag className="mx-auto size-12 text-muted-foreground" />
        <h1 className="font-heading mt-4 text-2xl font-bold text-foreground">Giỏ hàng trống</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bạn chưa thêm sản phẩm nào vào giỏ hàng.</p>
        <Link href="/products" className={storefrontButtonClasses('accent', 'mt-6')}>Khám phá sản phẩm</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">Giỏ hàng của bạn</h1>
      <p className="mt-1 text-sm text-muted-foreground">Giá hiển thị chỉ mang tính tham khảo — hệ thống sẽ tính lại giá chính xác khi bạn xác nhận đặt hàng.</p>

      <div className="mt-6 flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.variantId} className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted/50">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.productName} width={80} height={80} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-xs text-muted-foreground">Không ảnh</div>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between">
              <div>
                <Link href={`/products/${item.productSlug}`} className="cursor-pointer text-sm font-semibold text-foreground hover:underline">{item.productName}</Link>
                <p className="text-xs text-muted-foreground">{item.variantName} · SKU: {item.sku}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatVnd(item.price)}</p>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-lg border border-border">
                  <button type="button" aria-label="Giảm số lượng" onClick={() => updateQuantity(item.variantId, item.quantity - 1)} className="inline-flex size-8 cursor-pointer items-center justify-center text-foreground transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium text-foreground">{item.quantity}</span>
                  <button type="button" aria-label="Tăng số lượng" onClick={() => updateQuantity(item.variantId, item.quantity + 1)} className="inline-flex size-8 cursor-pointer items-center justify-center text-foreground transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <button type="button" aria-label="Xoá khỏi giỏ hàng" onClick={() => removeItem(item.variantId)} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Tạm tính</p>
          <p className="text-xl font-bold text-foreground">{formatVnd(subtotal)}</p>
        </div>
        <Link href="/checkout" className={storefrontButtonClasses('accent', 'w-full text-center sm:w-auto')}>Tiến hành đặt hàng</Link>
      </div>
      <Link href="/products" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">← Tiếp tục mua sắm</Link>
    </div>
  );
}
