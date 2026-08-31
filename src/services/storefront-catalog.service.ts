import { query } from '../lib/db';
import { pagination } from './product.service';
import { getStockLevel } from './inventory.service';

export type StorefrontProductSummary = {
  id: string; name: string; slug: string; shortDescription: string | null;
  productType: string; basePrice: number | null; categoryId: string | null;
  imageUrl: string | null; inStock: boolean;
};

export type StorefrontProductDetail = {
  id: string; name: string; slug: string; shortDescription: string | null; description: string | null;
  productType: string; basePrice: number | null; categoryId: string | null;
  variants: { id: string; sku: string; name: string; attributes: Record<string, string>; price: number; weightGrams: number | null; inStock: boolean }[];
  images: { url: string; altText: string | null; sortOrder: number }[];
};

async function attachStockFlag(variantsByProduct: Map<string, { id: string }[]>): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();
  for (const [productId, variants] of variantsByProduct) {
    let anyInStock = false;
    for (const variant of variants) {
      const stock = await getStockLevel(variant.id);
      if (stock.available > 0) { anyInStock = true; break; }
    }
    flags.set(productId, anyInStock);
  }
  return flags;
}

export async function listStorefrontProducts(input: { page?: number; limit?: number; categoryId?: string; productType?: string; search?: string; sortBy?: 'newest' | 'price_asc' | 'price_desc' } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  let filterSql = '';
  if (input.categoryId) { values.push(input.categoryId); filterSql += ` and p.category_id = $${values.length}`; }
  if (input.productType) { values.push(input.productType); filterSql += ` and p.product_type = $${values.length}`; }
  if (input.search) { values.push(`%${input.search}%`); filterSql += ` and p.name ilike $${values.length}`; }
  const orderSql = input.sortBy === 'price_asc' ? 'p.base_price asc nulls last'
    : input.sortBy === 'price_desc' ? 'p.base_price desc nulls last'
    : 'p.created_at desc';
  values.push(limit, offset);
  const rows = await query<{
    id: string; name: string; slug: string; shortDescription: string | null; productType: string;
    basePrice: number | null; categoryId: string | null; imageUrl: string | null; variantIds: string[];
  }>(`
    select p.id, p.name, p.slug, p.short_description as "shortDescription", p.product_type as "productType",
      p.base_price as "basePrice", p.category_id as "categoryId",
      (select storage_path from product_images pi where pi.product_id = p.id order by pi.sort_order limit 1) as "imageUrl",
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
      imageUrl: row.imageUrl, inStock: stockFlags.get(row.id) ?? false,
    })) satisfies StorefrontProductSummary[],
  };
}

export async function getStorefrontProductBySlug(slug: string): Promise<StorefrontProductDetail | null> {
  const productResult = await query<{
    id: string; name: string; slug: string; shortDescription: string | null; description: string | null;
    productType: string; basePrice: number | null; categoryId: string | null;
  }>(`select id, name, slug, short_description as "shortDescription", description, product_type as "productType", base_price as "basePrice", category_id as "categoryId"
      from products where slug = $1 and status = 'ACTIVE'`, [slug]);
  if (!productResult.rowCount) return null;
  const product = productResult.rows[0];

  const variantRows = await query<{ id: string; sku: string; name: string; attributes: Record<string, string>; price: number; weightGrams: number | null }>(
    'select id, sku, name, attributes, price, weight_grams as "weightGrams" from product_variants where product_id = $1 and is_active = true order by created_at', [product.id],
  );
  const variants = await Promise.all(variantRows.rows.map(async (variant) => {
    const stock = await getStockLevel(variant.id);
    return { ...variant, inStock: stock.available > 0 };
  }));

  const imageRows = await query<{ storagePath: string; altText: string | null; sortOrder: number }>(
    'select storage_path as "storagePath", alt_text as "altText", sort_order as "sortOrder" from product_images where product_id = $1 order by sort_order', [product.id],
  );
  const { createSupabaseAdminClient } = await import('../lib/supabase/admin');
  const supabase = createSupabaseAdminClient();
  const images = imageRows.rows.map((row) => ({
    url: supabase.storage.from('product-images').getPublicUrl(row.storagePath).data.publicUrl,
    altText: row.altText, sortOrder: row.sortOrder,
  }));

  return { ...product, variants, images };
}
