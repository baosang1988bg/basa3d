import Link from 'next/link';
import { listStorefrontProducts } from '@/services/storefront-catalog.service';
import { ProductCard } from '@/components/storefront/product-card';
import { StorefrontButton } from '@/components/storefront/button';

type SearchParams = { q?: string; type?: string; sort?: string; page?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const sortBy = params.sort === 'price_asc' || params.sort === 'price_desc' ? params.sort : 'newest';
  const { items, page } = await listStorefrontProducts({
    search: params.q, productType: params.type, sortBy,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">Sản phẩm</h1>

      <form className="mt-6 flex flex-col gap-3 md:flex-row md:items-center" method="get">
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
          <Link href="/custom-print"><StorefrontButton variant="accent">Gửi yêu cầu đặt in</StorefrontButton></Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}

      {page > 1 && (
        <div className="mt-8 flex justify-center">
          <Link href={`?${new URLSearchParams({ ...params, page: String(page - 1) })}`}><StorefrontButton variant="secondary">Trang trước</StorefrontButton></Link>
        </div>
      )}
    </div>
  );
}
