import { ProductsCatalogManager } from '@/components/admin/products-catalog-manager';
import { getCategoryDisplayName } from '@/lib/categories';
import { requireAdmin } from '@/lib/auth/require-admin';
import { productImagePublicUrl } from '@/lib/storage/product-image-url';
import { listCategories } from '@/services/product.service';
import {
  PUBLISH_READINESS_REASONS,
  listCatalogProducts,
  type CatalogSortOption,
  type CatalogSourceFilter,
  type CatalogStatusFilter,
  type PublishReadinessReason,
} from '@/services/product-onboarding.service';

export const metadata = { title: 'Sản phẩm | BaSa3D Admin' };

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
  category?: string;
  source?: string;
  sort?: string;
  page?: string;
  publishBlocked?: string;
  missing?: string;
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Phase 35 D1: never rely on the layout alone — RSC segment requests can render this page
  // without re-running the layout. requireAdmin() is cache()-memoized, so this is free.
  const { role } = await requireAdmin();
  const params = await searchParams;
  const status = (['ACTIVE', 'DRAFT', 'ARCHIVED'] as const).find((value) => value === params.status) as CatalogStatusFilter | undefined;
  const source = (['ALL', 'STL', 'MANUAL'] as const).find((value) => value === params.source) as CatalogSourceFilter | undefined;
  const sort = (['default', 'updated_desc', 'name_asc', 'price_asc', 'price_desc'] as const).find((value) => value === params.sort) as CatalogSortOption | undefined;
  const filters = {
    q: params.q?.trim() || undefined,
    type: params.type || undefined,
    category: params.category || undefined,
    source: source ?? 'ALL',
    sort: sort ?? 'default',
  };

  const [catalog, { items: rawCategories }] = await Promise.all([
    listCatalogProducts({
      search: filters.q,
      status,
      productType: filters.type,
      categoryId: filters.category,
      source: filters.source,
      sort: filters.sort,
      page: Number(params.page),
    }),
    listCategories({ limit: 100 }),
  ]);

  const categories = rawCategories.map((category) => ({
    id: category.id,
    label: getCategoryDisplayName(category, 'vi'),
    slug: category.slug,
  }));

  const items = catalog.items.map((item) => ({
    ...item,
    coverUrl: productImagePublicUrl(item.coverStoragePath),
    categoryLabel: item.categorySlug
      ? getCategoryDisplayName({ name: item.categoryName ?? '', slug: item.categorySlug }, 'vi')
      : null,
  }));

  const missingNotice = (params.missing ?? '')
    .split(',')
    .filter((reason): reason is PublishReadinessReason => (PUBLISH_READINESS_REASONS as readonly string[]).includes(reason));

  return (
    <ProductsCatalogManager
      items={items}
      categories={categories}
      role={role}
      statusCounts={catalog.statusCounts}
      page={catalog.page}
      hasNext={catalog.hasNext}
      filters={{ ...filters, status }}
      publishBlocked={params.publishBlocked}
      missingNotice={missingNotice}
    />
  );
}
