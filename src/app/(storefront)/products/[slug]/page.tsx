import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getStorefrontProductBySlug } from '@/services/storefront-catalog.service';
import { SpecTable } from '@/components/storefront/spec-table';
import { formatVnd } from '@/components/storefront/format';
import { ConfirmIntentDialog } from './confirm-intent-dialog';

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);
  if (!product) notFound();

  const firstVariant = product.variants[0];
  const anyInStock = product.variants.some((variant) => variant.inStock);
  const specs = [
    ...(firstVariant?.weightGrams != null ? [{ label: 'Khối lượng', value: `${firstVariant.weightGrams}g` }] : []),
    ...Object.entries(firstVariant?.attributes ?? {}).map(([label, value]) => ({ label, value })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="cursor-pointer hover:text-foreground">Trang chủ</Link>
        <span className="mx-2">/</span>
        <Link href="/products" className="cursor-pointer hover:text-foreground">Sản phẩm</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl bg-muted/50">
            {product.images[0] ? (
              <Image src={product.images[0].url} alt={product.images[0].altText ?? product.name} width={600} height={600} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Chưa có ảnh</div>
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
          {firstVariant && <p className="mt-1 text-sm text-muted-foreground">SKU: {firstVariant.sku}</p>}
          <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${anyInStock ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {anyInStock ? 'Sẵn hàng' : 'Đặt in 24h'}
          </span>
          {product.basePrice != null && <p className="mt-4 text-2xl font-bold text-foreground">{formatVnd(product.basePrice)}</p>}
          {product.shortDescription && <p className="mt-4 text-base text-muted-foreground">{product.shortDescription}</p>}

          {product.variants.length > 1 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-foreground">Tuỳ chọn</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <span key={variant.id} className="rounded-lg border border-border px-3 py-1.5 text-sm">
                    {variant.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <ConfirmIntentDialog productName={product.name} />
          </div>

          {specs.length > 0 && (
            <div className="mt-8">
              <p className="mb-2 text-sm font-semibold text-foreground">Thông số kỹ thuật</p>
              <SpecTable specs={specs} />
            </div>
          )}

          {product.description && (
            <div className="mt-8">
              <p className="mb-2 text-sm font-semibold text-foreground">Mô tả & hướng dẫn bảo quản</p>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
