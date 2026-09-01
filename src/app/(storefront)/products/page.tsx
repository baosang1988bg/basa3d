import Link from 'next/link';
import { listStorefrontProducts } from '@/services/storefront-catalog.service';
import { listCategories } from '@/services/product.service';
import { ProductCard } from '@/components/storefront/product-card';
import { StorefrontButton, storefrontButtonClasses } from '@/components/storefront/button';
import { Breadcrumb } from '@/components/storefront/breadcrumb';
import { cn } from '@/lib/utils';
import { ViewItemListTracker } from '@/components/analytics/storefront-trackers';

type SearchParams = { q?: string; type?: string; sort?: string; page?: string; categoryId?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const sortBy = params.sort === 'price_asc' || params.sort === 'price_desc' ? params.sort : 'newest';
  const [{ items, page, limit }, { items: categories }] = await Promise.all([
    listStorefrontProducts({
      search: params.q, productType: params.type, sortBy, categoryId: params.categoryId,
      page: params.page ? Number(params.page) : 1,
    }),
    listCategories({ limit: 100 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ViewItemListTracker listName="Product catalog" items={items.map((product) => ({ item_id: product.id, item_name: product.name, price: product.basePrice ?? undefined, item_category: categories.find((category) => category.id === product.categoryId)?.name }))} />
      <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Sản phẩm' }]} />
      <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">Sản phẩm</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`?${buildQueryString(params, { categoryId: undefined })}`}
          className={cn(
            'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150',
            !params.categoryId ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          Tất cả
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`?${buildQueryString(params, { categoryId: category.id })}`}
            className={cn(
              'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150',
              params.categoryId === category.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <form className="mt-6 flex flex-col gap-3 md:flex-row md:items-center" method="get">
        {params.categoryId && <input type="hidden" name="categoryId" value={params.categoryId} />}
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Tìm sản phẩm theo tên..."
          className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <select name="type" defaultValue={params.type ?? ''} className="h-10 cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm">
          <option value="">Tất cả loại</option>
          <option value="READY_STOCK">Sẵn hàng</option>
          <option value="MADE_TO_ORDER">Đặt in theo yêu cầu</option>
        </select>
        <select name="sort" defaultValue={sortBy} className="h-10 cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm">
          <option value="newest">Mới nhất</option>
          <option value="price_asc">Giá tăng dần</option>
          <option value="price_desc">Giá giảm dần</option>
        </select>
        <StorefrontButton variant="secondary" type="submit">Lọc</StorefrontButton>
      </form>

      {items.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">Không tìm thấy sản phẩm phù hợp.</p>
          <p className="text-sm text-muted-foreground">Không thấy mẫu bạn cần? Gửi yêu cầu in theo thiết kế riêng của bạn.</p>
          <Link href="/custom-print" className={storefrontButtonClasses('accent')}>Gửi yêu cầu đặt in</Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}

      {(page > 1 || items.length === limit) && (
        <div className="mt-8 flex justify-center gap-3">
          {page > 1 && (
            <Link href={`?${buildQueryString(params, { page: page - 1 })}`} className={storefrontButtonClasses('secondary')}>Trang trước</Link>
          )}
          {items.length === limit && (
            <Link href={`?${buildQueryString(params, { page: page + 1 })}`} className={storefrontButtonClasses('secondary')}>Trang sau</Link>
          )}
        </div>
      )}
    </div>
  );
}

type QueryOverrides = Partial<Record<keyof SearchParams, string | number | undefined>>;

// Merges overrides onto the current params, defaulting to page 1 unless the override sets page
// explicitly (pagination links) — a category/filter change should never keep stale pagination
// from the previous filter's result set.
function buildQueryString(params: SearchParams, overrides: QueryOverrides = {}): string {
  const merged: QueryOverrides = { ...params, page: '1', ...overrides };
  const entries = Object.entries(merged).filter(
    (entry): entry is [string, string | number] => entry[1] != null && entry[1] !== '',
  );
  return new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString();
}
