'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { formatVnd } from './format';
import { trackSelectItem } from '@/lib/analytics';

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  basePrice: number | null;
  imageUrl: string | null;
  inStock: boolean;
  productType: string;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const t = useTranslations('products');
  const stockLabel = product.productType === 'READY_STOCK'
    ? (product.inStock ? t('inStock') : t('outOfStock'))
    : t('printOnDemand24h');
  const stockBadgeClass = product.productType === 'READY_STOCK' && product.inStock
    ? 'border border-emerald-500/20 bg-emerald-50/95 text-emerald-700 shadow-xs dark:bg-emerald-950/90 dark:text-emerald-300 dark:border-emerald-500/30'
    : 'border border-border/60 bg-secondary/90 text-secondary-foreground shadow-xs dark:bg-slate-800/90 dark:text-slate-300';

  return (
    <Link
      href={`/products/${product.slug}`}
      onClick={() => trackSelectItem({ item_id: product.id, item_name: product.name, price: product.basePrice ?? undefined }, 'Product catalog')}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-3.5 shadow-tactile transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-tactile-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted/40">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={400}
            height={400}
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">{t('noImage')}</div>
        )}
        <span className={`absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-xs ${stockBadgeClass}`}>
          {stockLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2 pt-2">
        <h3 className="font-heading line-clamp-2 text-sm font-semibold text-foreground transition-colors duration-150 group-hover:text-primary md:text-base">
          {product.name}
        </h3>
        <div className="flex items-baseline justify-between gap-1 pt-1">
          {product.basePrice != null ? (
            <p className="font-heading text-base font-bold text-foreground md:text-lg">
              {formatVnd(product.basePrice)}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">{t('contactToOrderZalo')}</span>
          )}
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary transition-all duration-150 group-hover:translate-x-0.5">
            {t('viewDetail')}
            <ArrowRight className="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
