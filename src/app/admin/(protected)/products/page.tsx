import Link from 'next/link';
import { Boxes, ChevronDown, ImageOff, Package, Pencil, Plus, Printer, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { PublishBlockedNotice } from '@/components/admin/publish-blocked-notice';
import { getCategoryDisplayName } from '@/lib/categories';
import { productImagePublicUrl } from '@/lib/storage/product-image-url';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listCategories } from '@/services/product.service';
import {
  PUBLISH_READINESS_MESSAGES,
  PUBLISH_READINESS_REASONS,
  listCatalogProducts,
  type CatalogListItem,
  type CatalogStatusFilter,
  type PublishReadinessReason,
} from '@/services/product-onboarding.service';
import { archiveProductAction, createCategoryAction, publishProductFromListAction, unarchiveProductAction } from './actions';

export const metadata = { title: 'Sản phẩm | BaSa3D Admin' };

type SearchParams = { q?: string; status?: string; type?: string; category?: string; page?: string; publishBlocked?: string; missing?: string };

const STATUS_TABS: { value: CatalogStatusFilter | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'ACTIVE', label: 'Đang bán' },
  { value: 'ARCHIVED', label: 'Đã lưu trữ' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang bán', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  DRAFT: { label: 'Nháp', className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  ARCHIVED: { label: 'Đã lưu trữ', className: 'border-border bg-muted text-muted-foreground' },
};

const SHORT_MISSING: Record<PublishReadinessReason, string> = {
  LICENSE_UNKNOWN: 'bản quyền',
  NO_IMAGE: 'ảnh',
  NO_PRICE: 'giá',
  UNCATEGORIZED: 'danh mục',
  NOT_FOUND: 'sản phẩm',
};

function formatVnd(value: number | null): string {
  return value == null ? '—' : `${value.toLocaleString('vi-VN')}đ`;
}

function priceLabel(item: CatalogListItem): string {
  if (item.minPrice !== null && item.maxPrice !== null && item.minPrice !== item.maxPrice) return `${formatVnd(item.minPrice)} – ${formatVnd(item.maxPrice)}`;
  return formatVnd(item.minPrice ?? item.basePrice);
}

// UX redesign 2026-10-27: this page is the catalogue — what's on the website, what's still a draft and
// exactly what each draft lacks. Stock and quick price edits live on /admin/product-inventory.
export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Phase 35 D1: never rely on the layout alone — RSC segment requests can render this page
  // without re-running the layout. requireAdmin() is cache()-memoized, so this is free.
  await requireAdmin();
  const params = await searchParams;
  const status = (['ACTIVE', 'DRAFT', 'ARCHIVED'] as const).find((value) => value === params.status);
  const filters = { q: params.q?.trim() || undefined, type: params.type || undefined, category: params.category || undefined };

  const [catalog, { items: categories }] = await Promise.all([
    listCatalogProducts({ search: filters.q, status, productType: filters.type, categoryId: filters.category, page: Number(params.page) }),
    listCategories({ limit: 100 }),
  ]);
  const total = catalog.statusCounts.ACTIVE + catalog.statusCounts.DRAFT + catalog.statusCounts.ARCHIVED;
  const missingNotice = (params.missing ?? '').split(',').filter((reason): reason is PublishReadinessReason => (PUBLISH_READINESS_REASONS as readonly string[]).includes(reason));

  function tabHref(value: CatalogStatusFilter | 'ALL') {
    const query = new URLSearchParams();
    for (const [key, item] of Object.entries(filters)) if (item) query.set(key, item);
    if (value !== 'ALL') query.set('status', value);
    const text = query.toString();
    return text ? `/admin/products?${text}` : '/admin/products';
  }

  return (
    <div className="flex flex-col gap-5">
      <PublishBlockedNotice value={params.publishBlocked} />
      {missingNotice.length ? (
        <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Chưa đăng bán được: {missingNotice.map((reason) => PUBLISH_READINESS_MESSAGES[reason]).join('; ')}. Bổ sung ở trang chi tiết rồi thử lại.
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sản phẩm</h1>
          <p className="text-sm text-muted-foreground">Những gì đang bán trên web, bản nháp và thứ còn thiếu để đăng bán. Tồn kho &amp; sửa giá nhanh ở trang Kho.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/product-inventory" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Boxes className="mr-1.5 size-4" /> Kho &amp; giá
          </Link>
          <Link href="/admin/products/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="mr-1.5 size-4" /> Đăng sản phẩm mới
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <nav aria-label="Trạng thái" className="flex gap-6 overflow-x-auto border-b border-border">
        {STATUS_TABS.map((tab) => {
          const active = (status ?? 'ALL') === tab.value;
          const count = tab.value === 'ALL' ? total : catalog.statusCounts[tab.value];
          return (
            <Link
              key={tab.value}
              href={tabHref(tab.value)}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>
            </Link>
          );
        })}
      </nav>

      {/* Filters (GET form, keeps the status tab) */}
      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={filters.q} placeholder="Tìm theo tên, màu hoặc SKU…" className="pl-9" aria-label="Tìm sản phẩm" />
        </div>
        <select name="type" defaultValue={filters.type ?? ''} aria-label="Hình thức bán" className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm sm:w-48">
          <option value="">Mọi hình thức bán</option>
          <option value="MADE_TO_ORDER">In theo yêu cầu</option>
          <option value="READY_STOCK">Có sẵn, giao ngay</option>
        </select>
        <select name="category" defaultValue={filters.category ?? ''} aria-label="Danh mục" className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm sm:w-52">
          <option value="">Mọi danh mục</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{getCategoryDisplayName(category, 'vi')}</option>)}
        </select>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" size="sm" className="h-9">Lọc</Button>
          {filters.q || filters.type || filters.category ? (
            <Link href={status ? `/admin/products?status=${status}` : '/admin/products'} className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-9' })}>Xoá lọc</Link>
          ) : null}
        </div>
      </form>

      {/* List */}
      {catalog.items.length ? (
        <Card className="gap-0 overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {catalog.items.map((item) => {
              const cover = productImagePublicUrl(item.coverStoragePath);
              const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.DRAFT;
              const readyToPublish = item.status === 'DRAFT' && item.missing.length === 0;
              return (
                <li key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  {/* Product */}
                  <Link href={`/admin/products/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                      {cover ? <img src={cover} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-5 text-muted-foreground/60" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium hover:underline">{item.name}</span>
                        <Badge variant="outline" className={`text-[11px] ${badge.className}`}>{badge.label}</Badge>
                        {item.imported ? <Badge variant="outline" className="text-[10px] text-muted-foreground">Nhập từ kho STL</Badge> : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        {item.productType === 'READY_STOCK'
                          ? <span className="inline-flex items-center gap-1"><Package className="size-3" /> Có sẵn</span>
                          : <span className="inline-flex items-center gap-1"><Printer className="size-3" /> In theo yêu cầu</span>}
                        <span>·</span>
                        <span>{item.categorySlug ? getCategoryDisplayName({ name: item.categoryName ?? '', slug: item.categorySlug }, 'vi') : 'Chưa có danh mục'}</span>
                        <span>·</span>
                        <span>{item.variantCount} màu/biến thể</span>
                      </div>
                      {item.status === 'DRAFT' ? (
                        item.missing.length
                          ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Còn thiếu: {item.missing.map((reason) => SHORT_MISSING[reason]).join(', ')}</p>
                          : <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Đủ thông tin — có thể đăng bán</p>
                      ) : null}
                    </div>
                  </Link>

                  {/* Price */}
                  <div className="text-sm font-medium tabular-nums sm:w-44 sm:text-right">{priceLabel(item)}</div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 sm:w-[220px] sm:justify-end">
                    {readyToPublish ? (
                      <form action={publishProductFromListAction.bind(null, item.id)}>
                        <Button type="submit" size="sm">Đăng bán</Button>
                      </form>
                    ) : null}
                    <Link href={`/admin/products/${item.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                      <Pencil className="mr-1 size-3.5" /> Sửa
                    </Link>
                    {item.status === 'ARCHIVED' ? (
                      <form action={unarchiveProductAction.bind(null, item.id)}>
                        <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground">Bỏ lưu trữ</Button>
                      </form>
                    ) : (
                      <form action={archiveProductAction.bind(null, item.id)}>
                        <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground" title="Ẩn khỏi web, giữ lại lịch sử">Lưu trữ</Button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Package className="size-8 text-muted-foreground/60" />
          <p className="font-medium">{total ? 'Không có sản phẩm nào khớp' : 'Chưa có sản phẩm nào'}</p>
          <p className="text-sm text-muted-foreground">{total ? 'Thử đổi tab hoặc bỏ bớt bộ lọc.' : 'Bắt đầu bằng nút “Đăng sản phẩm mới”.'}</p>
        </div>
      )}
      <AdminPagination basePath="/admin/products" page={catalog.page} hasNext={catalog.hasNext} filters={{ ...filters, status }} />

      {/* Categories — rarely used, so tucked away */}
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
          Quản lý danh mục ({categories.length})
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => <Badge key={category.id} variant="secondary">{getCategoryDisplayName(category, 'vi')}</Badge>)}
          </div>
          <form action={createCategoryAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name">Tên danh mục mới</Label>
              <Input id="cat-name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-slug">Đường dẫn (để trống = tự tạo)</Label>
              <Input id="cat-slug" name="slug" placeholder="tự tạo" />
            </div>
            <Button type="submit" variant="outline">Thêm danh mục</Button>
          </form>
        </div>
      </details>
    </div>
  );
}
