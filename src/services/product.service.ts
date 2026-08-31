import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { writeAuditLog } from './audit.service';

const PRODUCT_IMAGE_BUCKET = 'product-images';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Callers include public pages that pass `Number(searchParams.page)` straight through, so a
// malformed `?page=abc` arrives here as NaN. `Math.max(1, NaN)` is NaN, which would reach SQL as an
// OFFSET and blow up with a raw Postgres error, so non-finite values fall back to the default.
// Fractional input is floored so the OFFSET stays an integer. Valid integer input is unaffected.
function positiveInt(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value as number)) : fallback;
}

export function pagination(input: { page?: number; limit?: number }) {
  const page = positiveInt(input.page, 1);
  const limit = Math.min(MAX_PAGE_SIZE, positiveInt(input.limit, DEFAULT_PAGE_SIZE));
  return { page, limit, offset: (page - 1) * limit };
}

export async function listCategories(input: { page?: number; limit?: number } = {}) {
  const { page, limit, offset } = pagination(input);
  const result = await query(`select id, parent_id as "parentId", name, slug, description, sort_order as "sortOrder" from categories where is_active = true order by sort_order, name limit $1 offset $2`, [limit, offset]);
  return { page, limit, items: result.rows };
}

export async function createCategory(input: Record<string, unknown>, actorId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>('insert into categories (parent_id, name, slug, description, sort_order) values ($1,$2,$3,$4,$5) returning id', [input.parentId ?? null, input.name, input.slug, input.description ?? null, input.sortOrder ?? 0]);
    await writeAuditLog(client, { actorId, action: 'CATEGORY_CREATED', entityType: 'category', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
}

export async function listProducts(input: { page?: number; limit?: number; status?: string } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  const statusSql = input.status ? (values.push(input.status), `and p.status = $${values.length}`) : '';
  values.push(limit, offset);
  const rows = await query<{ id: string; name: string; slug: string; productType: string; status: string; basePrice: number | null; categoryId: string | null; variants: { id: string; sku: string; name: string; price: number }[] }>(`
    select p.id, p.name, p.slug, p.product_type as "productType", p.status, p.base_price as "basePrice",
      p.category_id as "categoryId", coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'sku', v.sku, 'name', v.name, 'price', v.price)) filter (where v.id is not null), '[]') as variants
    from products p left join product_variants v on v.product_id = p.id and v.is_active = true
    where true ${statusSql} group by p.id order by p.created_at desc limit $${values.length - 1} offset $${values.length}`, values);
  return { page, limit, items: rows.rows };
}

// Public listing (GET /api/products/variants, no auth) — cost_price is COGS, never exposed here.
export async function listVariants(input: { page?: number; limit?: number } = {}) {
  const { page, limit, offset } = pagination(input);
  const result = await query(`select id, product_id as "productId", sku, name, attributes, price, weight_grams as "weightGrams", is_active as "isActive" from product_variants where is_active = true order by created_at desc limit $1 offset $2`, [limit, offset]);
  return { page, limit, items: result.rows };
}

// For dropdowns elsewhere in the admin UI (inventory, orders) — no pagination, small catalogs only.
export async function listAllVariantsWithProductName() {
  const result = await query<{ id: string; sku: string; name: string; productName: string }>(
    `select v.id, v.sku, v.name, p.name as "productName" from product_variants v join products p on p.id = v.product_id where v.is_active = true order by p.name, v.name`,
  );
  return result.rows;
}

type ProductDetail = {
  id: string; name: string; slug: string; shortDescription: string | null; description: string | null;
  productType: string; status: string; basePrice: number | null; costPrice: number | null;
  isFeatured: boolean; categoryId: string | null; seoTitle: string | null; seoDescription: string | null;
};
type VariantDetail = { id: string; sku: string; name: string; attributes: Record<string, string>; price: number; costPrice: number | null; weightGrams: number | null; isActive: boolean };

export async function getProductById(productId: string) {
  const result = await query<ProductDetail>(`
    select id, name, slug, short_description as "shortDescription", description, product_type as "productType",
      status, base_price as "basePrice", cost_price as "costPrice", is_featured as "isFeatured", category_id as "categoryId",
      seo_title as "seoTitle", seo_description as "seoDescription"
    from products where id = $1`, [productId]);
  if (!result.rowCount) return null;
  const variants = await query<VariantDetail>('select id, sku, name, attributes, price, cost_price as "costPrice", weight_grams as "weightGrams", is_active as "isActive" from product_variants where product_id = $1 order by created_at', [productId]);
  return { ...result.rows[0], variants: variants.rows };
}

export async function createProduct(input: Record<string, unknown>, actorId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(`
      insert into products (category_id, name, slug, short_description, description, product_type, status, base_price, cost_price, is_featured, is_customizable, seo_title, seo_description)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`, [
      input.categoryId ?? null, input.name, input.slug, input.shortDescription ?? null, input.description ?? null, input.productType, input.status ?? 'DRAFT', input.basePrice ?? null, input.costPrice ?? null, input.isFeatured ?? false, input.isCustomizable ?? false, input.seoTitle ?? null, input.seoDescription ?? null,
    ]);
    await writeAuditLog(client, { actorId, action: 'PRODUCT_CREATED', entityType: 'product', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23503';
}

export async function createVariant(input: { productId: string; sku: string; name: string; attributes?: Record<string, string>; price: number; costPrice?: number | null; weightGrams?: number | null; isActive?: boolean }, actorId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(`
      insert into product_variants (product_id, sku, name, attributes, price, cost_price, weight_grams, is_active)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`, [
      input.productId, input.sku, input.name, input.attributes ?? {}, input.price, input.costPrice ?? null, input.weightGrams ?? null, input.isActive ?? true,
    ]);
    await writeAuditLog(client, { actorId, action: 'VARIANT_CREATED', entityType: 'product_variant', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
}

export async function updateVariant(variantId: string, patch: { name?: string; attributes?: Record<string, string>; price?: number; costPrice?: number | null; weightGrams?: number | null; isActive?: boolean }, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query('select name, attributes, price, cost_price, weight_grams, is_active from product_variants where id = $1 for update', [variantId]);
    if (!before.rowCount) throw new DomainError('VARIANT_NOT_FOUND', 'Product variant was not found.', 404);
    const fields = { name: 'name', attributes: 'attributes', price: 'price', costPrice: 'cost_price', weightGrams: 'weight_grams', isActive: 'is_active' } as const;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(fields) as [keyof typeof patch, string][]) {
      if (patch[key] === undefined) continue;
      values.push(patch[key]);
      sets.push(`${column} = $${values.length}`);
    }
    if (!sets.length) return before.rows[0];
    values.push(variantId);
    const updated = await client.query(`update product_variants set ${sets.join(', ')} where id = $${values.length} returning id, name, attributes, price, cost_price, weight_grams, is_active`, values);
    await writeAuditLog(client, { actorId, action: 'VARIANT_UPDATED', entityType: 'product_variant', entityId: variantId, beforeData: before.rows[0], afterData: updated.rows[0] });
    return updated.rows[0];
  });
}

// Hard delete — OWNER only (enforced by the route handler, ADR-0011 boundary #3). STAFF instead
// calls updateProduct/updateVariant with isActive/status = ARCHIVED (soft archive).
export async function deleteVariant(variantId: string, actorId: string) {
  return withTransaction(async (client) => {
    try {
      const result = await client.query('delete from product_variants where id = $1 returning id', [variantId]);
      if (!result.rowCount) throw new DomainError('VARIANT_NOT_FOUND', 'Product variant was not found.', 404);
      await writeAuditLog(client, { actorId, action: 'VARIANT_DELETED', entityType: 'product_variant', entityId: variantId });
      return result.rows[0];
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new DomainError('VARIANT_HAS_REFERENCES', 'Variant has existing cart items or order history and cannot be hard-deleted.', 409);
      throw error;
    }
  });
}

export async function updateProduct(productId: string, patch: { categoryId?: string | null; name?: string; slug?: string; shortDescription?: string | null; description?: string | null; status?: string; basePrice?: number | null; costPrice?: number | null; isFeatured?: boolean; isCustomizable?: boolean; seoTitle?: string | null; seoDescription?: string | null }, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query('select category_id, name, slug, short_description, description, status, base_price, cost_price, is_featured, is_customizable, seo_title, seo_description from products where id = $1 for update', [productId]);
    if (!before.rowCount) throw new DomainError('PRODUCT_NOT_FOUND', 'Product was not found.', 404);
    const fields = { categoryId: 'category_id', name: 'name', slug: 'slug', shortDescription: 'short_description', description: 'description', status: 'status', basePrice: 'base_price', costPrice: 'cost_price', isFeatured: 'is_featured', isCustomizable: 'is_customizable', seoTitle: 'seo_title', seoDescription: 'seo_description' } as const;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(fields) as [keyof typeof patch, string][]) {
      if (patch[key] === undefined) continue;
      values.push(patch[key]);
      sets.push(`${column} = $${values.length}`);
    }
    if (!sets.length) return before.rows[0];
    values.push(productId);
    const updated = await client.query(`update products set ${sets.join(', ')} where id = $${values.length} returning id, name, slug, status`, values);
    await writeAuditLog(client, { actorId, action: 'PRODUCT_UPDATED', entityType: 'product', entityId: productId, beforeData: before.rows[0], afterData: updated.rows[0] });
    return updated.rows[0];
  });
}

export async function listProductImages(productId: string) {
  const result = await query<{ id: string; storagePath: string; altText: string | null; sortOrder: number; variantId: string | null }>(
    'select id, storage_path as "storagePath", alt_text as "altText", sort_order as "sortOrder", variant_id as "variantId" from product_images where product_id = $1 order by sort_order',
    [productId],
  );
  const supabase = createSupabaseAdminClient();
  return result.rows.map((row) => ({ ...row, url: supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(row.storagePath).data.publicUrl }));
}

export async function uploadProductImage(input: { productId: string; variantId?: string | null; file: Blob; fileName: string; altText?: string | null; sortOrder?: number }, actorId: string) {
  if (!ALLOWED_IMAGE_TYPES.has(input.file.type)) throw new DomainError('INVALID_FILE_TYPE', 'Only JPEG, PNG, or WEBP images are allowed.', 400);
  if (input.file.size > MAX_IMAGE_SIZE_BYTES) throw new DomainError('FILE_TOO_LARGE', 'Image must be 5 MB or smaller.', 400);
  const extension = EXTENSION_BY_TYPE[input.file.type];
  const storagePath = `${input.productId}/${randomUUID()}.${extension}`;

  const supabase = createSupabaseAdminClient();
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(storagePath, bytes, { contentType: input.file.type });
  if (uploadError) throw new DomainError('IMAGE_UPLOAD_FAILED', uploadError.message, 502);

  try {
    return await withTransaction(async (client) => {
      const productExists = await client.query('select id from products where id = $1', [input.productId]);
      if (!productExists.rowCount) throw new DomainError('PRODUCT_NOT_FOUND', 'Product was not found.', 404);
      const result = await client.query<{ id: string }>(`
        insert into product_images (product_id, variant_id, storage_path, alt_text, sort_order)
        values ($1,$2,$3,$4,$5) returning id`, [input.productId, input.variantId ?? null, storagePath, input.altText ?? null, input.sortOrder ?? 0]);
      await writeAuditLog(client, { actorId, action: 'PRODUCT_IMAGE_UPLOADED', entityType: 'product_image', entityId: result.rows[0].id, afterData: { productId: input.productId, storagePath } });
      const { data: publicUrl } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(storagePath);
      return { id: result.rows[0].id, url: publicUrl.publicUrl };
    });
  } catch (dbError) {
    // The Storage upload already succeeded — if the DB insert fails, remove the now-orphaned
    // file instead of leaking it in the bucket forever.
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([storagePath]);
    throw dbError;
  }
}

export async function deleteProductImage(imageId: string, actorId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{ storage_path: string }>('delete from product_images where id = $1 returning storage_path', [imageId]);
    if (!result.rowCount) throw new DomainError('PRODUCT_IMAGE_NOT_FOUND', 'Product image was not found.', 404);
    await createSupabaseAdminClient().storage.from(PRODUCT_IMAGE_BUCKET).remove([result.rows[0].storage_path]);
    await writeAuditLog(client, { actorId, action: 'PRODUCT_IMAGE_DELETED', entityType: 'product_image', entityId: imageId });
    return { id: imageId };
  });
}

// Hard delete — OWNER only (enforced by the route handler, ADR-0011 boundary #3).
export async function deleteProduct(productId: string, actorId: string) {
  return withTransaction(async (client) => {
    try {
      const result = await client.query('delete from products where id = $1 returning id', [productId]);
      if (!result.rowCount) throw new DomainError('PRODUCT_NOT_FOUND', 'Product was not found.', 404);
      await writeAuditLog(client, { actorId, action: 'PRODUCT_DELETED', entityType: 'product', entityId: productId });
      return result.rows[0];
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new DomainError('PRODUCT_HAS_VARIANTS', 'Product has existing variants and cannot be hard-deleted — archive it or delete the variants first.', 409);
      throw error;
    }
  });
}
