import { query } from '../lib/db';
import { pagination } from './product.service';
import { availableStock } from './inventory.service';

const PRODUCT_IMAGE_BUCKET = 'product-images';

// `product_images.storage_path` holds a bucket-relative path, not a URL. The bucket is public, so
// building the URL is pure string concatenation — exactly what supabase-js `getPublicUrl` does
// internally. Doing it inline keeps this fully public, unauthenticated code path free of the
// service-role client (which throws when SUPABASE_SERVICE_ROLE_KEY is absent).
function toPublicImageUrl(storagePath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL must be configured to render product images.');
  return `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
}

export type StorefrontProductSummary = {
  id: string; name: string; slug: string; shortDescription: string | null;
  productType: string; basePrice: number | null; categoryId: string | null;
  imageUrl: string | null; inStock: boolean;
};

export type StorefrontProductDetail = {
  id: string; name: string; slug: string; shortDescription: string | null; description: string | null;
  productType: string; basePrice: number | null; categoryId: string | null;
  seoTitle: string | null; seoDescription: string | null;
  variants: { id: string; sku: string; name: string; attributes: Record<string, string>; price: number; weightGrams: number | null; inStock: boolean }[];
  images: { url: string; altText: string | null; sortOrder: number }[];
};

// Batched equivalent of inventory.service `getStockLevel`, parameterised over an array of variant
// ids so a listing page costs one round trip instead of 1-per-variant. Mirrors the same on-hand
// (sum of inventory_movements) minus reserved (NEW/CONFIRMED order_items) definition. Driving off
// `unnest` guarantees one row per requested id (0/0 when the variant has no ledger rows at all).
// Deliberately separate from `getStockLevel`, whose single-id contract is relied on by write paths.
async function getAvailableStockByVariant(variantIds: string[]): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const result = await query<{ variantId: string; onHand: string; reserved: string }>(`
    select v.id as "variantId",
      coalesce((select sum(m.quantity) from inventory_movements m where m.product_variant_id = v.id), 0) as "onHand",
      coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id
        where oi.variant_id = v.id and o.status in ('NEW', 'CONFIRMED')), 0) as "reserved"
    from unnest($1::uuid[]) as v(id)`, [variantIds]);
  return new Map(result.rows.map((row) => [row.variantId, availableStock(Number(row.onHand), Number(row.reserved))]));
}

async function attachStockFlag(variantsByProduct: Map<string, { id: string }[]>): Promise<Map<string, boolean>> {
  const allVariantIds = [...variantsByProduct.values()].flat().map((variant) => variant.id);
  const availableByVariant = await getAvailableStockByVariant(allVariantIds);
  const flags = new Map<string, boolean>();
  for (const [productId, variants] of variantsByProduct) {
    flags.set(productId, variants.some((variant) => (availableByVariant.get(variant.id) ?? 0) > 0));
  }
  return flags;
}

export async function listStorefrontProducts(input: { page?: number; limit?: number; categoryId?: string; productType?: string; search?: string; sortBy?: 'newest' | 'price_asc' | 'price_desc'; featuredOnly?: boolean } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  let filterSql = '';
  if (input.categoryId) { values.push(input.categoryId); filterSql += ` and p.category_id = $${values.length}`; }
  if (input.productType) { values.push(input.productType); filterSql += ` and p.product_type = $${values.length}`; }
  if (input.search) { values.push(`%${input.search}%`); filterSql += ` and p.name ilike $${values.length}`; }
  if (input.featuredOnly) filterSql += ' and p.is_featured = true';
  const orderSql = input.sortBy === 'price_asc' ? 'p.base_price asc nulls last'
    : input.sortBy === 'price_desc' ? 'p.base_price desc nulls last'
    : 'p.created_at desc';
  values.push(limit, offset);
  const rows = await query<{
    id: string; name: string; slug: string; shortDescription: string | null; productType: string;
    basePrice: number | null; categoryId: string | null; imageStoragePath: string | null; variantIds: string[];
  }>(`
    select p.id, p.name, p.slug, p.short_description as "shortDescription", p.product_type as "productType",
      p.base_price as "basePrice", p.category_id as "categoryId",
      (select storage_path from product_images pi where pi.product_id = p.id order by pi.sort_order limit 1) as "imageStoragePath",
      coalesce(array_agg(v.id) filter (where v.id is not null), '{}') as "variantIds"
    from products p left join product_variants v on v.product_id = p.id and v.is_active = true
    where p.status = 'ACTIVE' ${filterSql}
    group by p.id order by ${orderSql} limit $${values.length - 1} offset $${values.length}`, values);

  const variantsByProduct = new Map(rows.rows.map((row) => [row.id, row.variantIds.map((id) => ({ id }))]));
  const stockFlags = await attachStockFlag(variantsByProduct);

  return {
    page, limit,
    items: rows.rows.map((row) => ({
      id: row.id, name: row.name, slug: row.slug, shortDescription: row.shortDescription,
      productType: row.productType, basePrice: row.basePrice, categoryId: row.categoryId,
      imageUrl: row.imageStoragePath ? toPublicImageUrl(row.imageStoragePath) : null,
      inStock: row.productType === 'MADE_TO_ORDER' || (stockFlags.get(row.id) ?? false),
    })) satisfies StorefrontProductSummary[],
  };
}

// For sitemap.ts only — every ACTIVE product slug, unpaginated (sitemap generation reads the
// whole public catalog once per build/request, not page-by-page like the storefront listing).
export async function listAllActiveProductSlugs() {
  const result = await query<{ slug: string; updatedAt: string }>(
    `select slug, updated_at as "updatedAt" from products where status = 'ACTIVE'`,
  );
  return result.rows;
}

export async function getStorefrontProductBySlug(slug: string): Promise<StorefrontProductDetail | null> {
  const productResult = await query<{
    id: string; name: string; slug: string; shortDescription: string | null; description: string | null;
    productType: string; basePrice: number | null; categoryId: string | null;
    seoTitle: string | null; seoDescription: string | null;
  }>(`select id, name, slug, short_description as "shortDescription", description, product_type as "productType", base_price as "basePrice", category_id as "categoryId",
      seo_title as "seoTitle", seo_description as "seoDescription"
      from products where slug = $1 and status = 'ACTIVE'`, [slug]);
  if (!productResult.rowCount) return null;
  const product = productResult.rows[0];

  const variantRows = await query<{ id: string; sku: string; name: string; attributes: Record<string, string>; price: number; weightGrams: number | null }>(
    'select id, sku, name, attributes, price, weight_grams as "weightGrams" from product_variants where product_id = $1 and is_active = true order by created_at', [product.id],
  );
  const availableByVariant = await getAvailableStockByVariant(variantRows.rows.map((variant) => variant.id));
  const variants = variantRows.rows.map((variant) => ({
    ...variant, inStock: product.productType === 'MADE_TO_ORDER' || (availableByVariant.get(variant.id) ?? 0) > 0,
  }));

  const imageRows = await query<{ storagePath: string; altText: string | null; sortOrder: number }>(
    'select storage_path as "storagePath", alt_text as "altText", sort_order as "sortOrder" from product_images where product_id = $1 order by sort_order', [product.id],
  );
  const images = imageRows.rows.map((row) => ({
    url: toPublicImageUrl(row.storagePath), altText: row.altText, sortOrder: row.sortOrder,
  }));

  return { ...product, variants, images };
}
