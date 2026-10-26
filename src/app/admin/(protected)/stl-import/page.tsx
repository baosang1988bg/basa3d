import { getCategoryDisplayName } from '@/lib/categories';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requireAdmin } from '@/lib/auth/require-admin';
import { stlImportStatusFilterSchema } from '@/domain/schemas';
import { listCategories } from '@/services/product.service';
import { listImportItems } from '@/services/stl-import.service';
import { STORAGE_WARN_BYTES } from '@/services/storage-usage.service';
import { ImportGrid } from './import-grid';

const STATUS_TABS = [
  { key: 'PENDING', label: 'Chờ duyệt' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'REJECTED', label: 'Đã từ chối' },
  { key: 'ERROR', label: 'Lỗi' },
] as const;

type Search = { status?: string; categoryId?: string; sourceDir?: string; q?: string; page?: string };

function cleanFilter(params: Search) {
  const status = stlImportStatusFilterSchema.safeParse(params.status);
  const page = Number(params.page);
  return {
    status: status.success ? status.data : 'PENDING' as const,
    categoryId: params.categoryId && /^[0-9a-f-]{36}$/i.test(params.categoryId) ? params.categoryId : undefined,
    sourceDir: params.sourceDir ? params.sourceDir.slice(0, 1000) : undefined,
    q: params.q ? params.q.trim().slice(0, 200) || undefined : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export default async function StlImportPage({ searchParams }: { searchParams: Promise<Search> }) {
  // Phase 35 D1: never rely on the layout alone.
  const session = await requireAdmin();
  const filter = cleanFilter(await searchParams);
  const [{ items, page, hasNext, sourceDirs, bucketUsageBytes }, { items: categories }] = await Promise.all([
    listImportItems(session, filter),
    listCategories({ limit: 100 }),
  ]);
  const linkFilters = { status: filter.status, categoryId: filter.categoryId, sourceDir: filter.sourceDir, q: filter.q };
  const tabHref = (status: string) => {
    const params = new URLSearchParams({ status });
    for (const key of ['categoryId', 'sourceDir', 'q'] as const) if (filter[key]) params.set(key, filter[key] as string);
    return `/admin/stl-import?${params}`;
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">Kho nhập STL</h1>
        <p className="text-sm text-muted-foreground">
          Bản nháp tạo từ kho STL. Kiểm tra bản quyền, sửa tên/danh mục/giá rồi {session.role === 'OWNER' ? 'duyệt để lên web' : 'chờ OWNER duyệt'}.
        </p>
      </div>

      {bucketUsageBytes !== null && bucketUsageBytes > STORAGE_WARN_BYTES ? (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Dung lượng ảnh sản phẩm đã ~{Math.round(bucketUsageBytes / 1024 ** 2)} MB (gói 1 GB). Lần nhập tới nên dùng <code>--views 2</code> hoặc dọn ảnh không dùng.
        </p>
      ) : null}

      {/* Plain anchors on purpose — see the StatusFilterTabs comment about same-route Link no-ops. */}
      <nav aria-label="Trạng thái" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <a
            key={tab.key}
            href={tabHref(tab.key)}
            aria-current={tab.key === filter.status ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${tab.key === filter.status ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      <form method="get" className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input type="hidden" name="status" value={filter.status} />
        <Input name="q" defaultValue={filter.q} placeholder="Tìm theo tên" aria-label="Tìm theo tên" className="h-11" />
        <select name="categoryId" defaultValue={filter.categoryId ?? ''} aria-label="Danh mục" className="h-11 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="">Mọi danh mục</option>
          {categories.map((category: { id: string; name: string; slug?: string }) => <option key={category.id} value={category.id}>{getCategoryDisplayName(category, 'vi')}</option>)}
        </select>
        <select name="sourceDir" defaultValue={filter.sourceDir ?? ''} aria-label="Thư mục nguồn" className="h-11 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="">Mọi thư mục nguồn</option>
          {sourceDirs.map((dir) => <option key={dir} value={dir}>{dir || '(gốc)'}</option>)}
        </select>
        <Button type="submit" className="h-11">Lọc</Button>
      </form>

      <ImportGrid
        items={items}
        categories={categories.map((category: { id: string; name: string; slug: string }) => ({ id: category.id, name: getCategoryDisplayName(category, 'vi'), slug: category.slug }))}
        isOwner={session.role === 'OWNER'}
      />

      <AdminPagination basePath="/admin/stl-import" page={page} hasNext={hasNext} filters={linkFilters} />
    </div>
  );
}
