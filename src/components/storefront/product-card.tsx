import Link from 'next/link';
import Image from 'next/image';
import { formatVnd } from './format';

export type ProductCardData = {
  name: string; slug: string; basePrice: number | null; imageUrl: string | null; inStock: boolean; productType: string;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const stockLabel = product.productType === 'READY_STOCK'
    ? (product.inStock ? 'Sẵn hàng' : 'Tạm hết hàng')
    : 'Đặt in 24h';
  const stockBadgeClass = product.productType === 'READY_STOCK' && product.inStock
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 ease-out hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
    >
      <div className="aspect-square overflow-hidden rounded-lg bg-muted/50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={400}
            height={400}
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Chưa có ảnh</div>
        )}
      </div>
      <span className={`absolute top-6 left-6 rounded-full px-2 py-0.5 text-xs font-semibold ${stockBadgeClass}`}>{stockLabel}</span>
      <div>
        <h3 className="font-heading text-base font-semibold text-foreground">{product.name}</h3>
        {product.basePrice != null && <p className="mt-1 text-lg font-bold text-foreground">{formatVnd(product.basePrice)}</p>}
      </div>
    </Link>
  );
}
