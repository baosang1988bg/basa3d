import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function pagination(input: { page?: number; limit?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, input.limit ?? DEFAULT_PAGE_SIZE));
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
  const rows = await query(`
    select p.id, p.name, p.slug, p.product_type as "productType", p.status, p.base_price as "basePrice",
      p.category_id as "categoryId", coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'sku', v.sku, 'name', v.name, 'price', v.price)) filter (where v.id is not null), '[]') as variants
    from products p left join product_variants v on v.product_id = p.id and v.is_active = true
    where true ${statusSql} group by p.id order by p.created_at desc limit $${values.length - 1} offset $${values.length}`, values);
  return { page, limit, items: rows.rows };
}

export async function listVariants(input: { page?: number; limit?: number } = {}) {
  const { page, limit, offset } = pagination(input);
  const result = await query(`select id, product_id as "productId", sku, name, attributes, price, cost_price as "costPrice", weight_grams as "weightGrams", is_active as "isActive" from product_variants order by created_at desc limit $1 offset $2`, [limit, offset]);
  return { page, limit, items: result.rows };
}

export async function createProduct(input: Record<string, unknown>, actorId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(`
      insert into products (category_id, name, slug, short_description, description, product_type, status, base_price, cost_price, is_featured, is_customizable)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`, [
      input.categoryId ?? null, input.name, input.slug, input.shortDescription ?? null, input.description ?? null, input.productType, input.status ?? 'DRAFT', input.basePrice ?? null, input.costPrice ?? null, input.isFeatured ?? false, input.isCustomizable ?? false,
    ]);
    await writeAuditLog(client, { actorId, action: 'PRODUCT_CREATED', entityType: 'product', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
}

export async function updateVariantPrice(variantId: string, price: number, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query<{ price: number }>('select price from product_variants where id = $1 for update', [variantId]);
    if (!before.rowCount) throw new DomainError('VARIANT_NOT_FOUND', 'Product variant was not found.', 404);
    const updated = await client.query('update product_variants set price = $2 where id = $1 returning id, price', [variantId, price]);
    await writeAuditLog(client, { actorId, action: 'VARIANT_PRICE_UPDATED', entityType: 'product_variant', entityId: variantId, beforeData: before.rows[0], afterData: updated.rows[0] });
    return updated.rows[0];
  });
}
