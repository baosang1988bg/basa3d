// Phase 52 P2/P3 — "Đăng sản phẩm mới" (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md).
//   createProductWithVariants: one transaction → product (always DRAFT) + one variant per chosen colour
//     + opening stock (READY_STOCK only, ADJUSTMENT_IN "Tồn đầu khi tạo sản phẩm"). Slug/SKU are
//     generated here (D10), never typed by staff. A repeated requestId with the same form returns the
//     first product; a changed form under a used requestId is refused (admin_request_keys).
//   createProductImageUploadTargets / registerProductImages: browser → Storage directly with signed
//     upload URLs (D11 — Server Actions cap request bodies at 1 MB), then the uploaded objects are
//     verified against storage.objects before product_images rows are written.
//   publishProductIfReady: DRAFT → ACTIVE only with licence known, ≥ 1 image, price > 0 and a real
//     category (the same bar Feature 003 sets for imported models, applied to manual products).
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { invalidatesStorefrontCatalog } from '../lib/cache/storefront-cache-tags';
import { buildSku, skuCodeForCategory, slugify, uniqueSlug } from '../lib/catalog/naming';
import type { ProductOnboardingInput } from '../domain/schemas';
import { PRODUCT_IMAGE_MAX_BYTES } from '../domain/schemas';
import { writeAuditLog } from './audit.service';
import { insertInventoryMovementLocked, lockVariantForInventoryWrite } from './inventory.service';
import { updateProduct } from './product.service';
import { claimRequestKey, setRequestKeyResult } from './request-keys.service';

export const PRODUCT_IMAGE_BUCKET = 'product-images';
/** New admin uploads live under this prefix so the orphan sweep never touches importer/legacy files. */
export const ONBOARDING_IMAGE_PREFIX = 'onboarding';
export const UNCATEGORIZED_SLUG = 'chua-phan-loai';
export const OPENING_STOCK_NOTE = 'Tồn đầu khi tạo sản phẩm';

const EXTENSION_BY_TYPE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const ONBOARDING_PATH_RE = /^onboarding\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

// ---------------------------------------------------------------------------------------------
// Form options
// ---------------------------------------------------------------------------------------------

export type OnboardingColorOption = { key: string; label: string; color: string; material: string };

export async function getProductOnboardingOptions() {
  const [categories, colors, warehouses] = await Promise.all([
    query<{ id: string; name: string; slug: string }>(
      'select id, name, slug from categories where is_active = true order by sort_order, name'),
    // Filament colours the workshop actually stocks (materials with a colour), one per type+colour.
    query<{ materialType: string; color: string }>(
      `select distinct material_type as "materialType", color from materials
       where is_active = true and color is not null and btrim(color) <> '' order by 1, 2`),
    query<{ id: string; name: string; code: string }>('select id, name, code from warehouses where is_active = true order by name'),
  ]);
  return {
    categories: categories.rows,
    colors: colors.rows.map((row): OnboardingColorOption => ({
      key: `${row.materialType}|${row.color}`, label: `${row.materialType} ${row.color}`, color: row.color, material: row.materialType,
    })),
    warehouses: warehouses.rows,
  };
}

// ---------------------------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------------------------

export type ProductOnboardingResult = {
  productId: string;
  slug: string;
  variants: { id: string; sku: string; name: string }[];
  replayed: boolean;
};

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

async function takenValues(client: PoolClient, table: 'products' | 'product_variants', column: 'slug' | 'sku', base: string): Promise<Set<string>> {
  const result = await client.query<{ value: string }>(
    `select ${column} as value from public.${table} where ${column} = $1 or ${column} like $2`,
    [base, `${escapeLike(base.slice(0, 30))}%`]);
  return new Set(result.rows.map((row) => row.value));
}

async function resolveOpeningWarehouse(client: PoolClient, requested: string | null | undefined): Promise<string> {
  if (requested) {
    const found = await client.query('select 1 from warehouses where id = $1 and is_active = true', [requested]);
    if (!found.rowCount) throw new DomainError('WAREHOUSE_NOT_FOUND', 'Kho không tồn tại hoặc đã ngừng dùng.', 404);
    return requested;
  }
  const active = await client.query<{ id: string }>('select id from warehouses where is_active = true order by name limit 2');
  if (active.rowCount !== 1) throw new DomainError('WAREHOUSE_REQUIRED', 'Hãy chọn kho để nhập tồn ban đầu.', 400);
  return active.rows[0].id;
}

async function loadReplay(client: PoolClient, productId: string | null): Promise<ProductOnboardingResult> {
  const product = productId ? await client.query<{ slug: string }>('select slug from products where id = $1', [productId]) : null;
  if (!productId || !product?.rowCount) throw new DomainError('IDEMPOTENCY_CONFLICT', 'Sản phẩm của lần lưu trước không còn. Hãy tải lại trang.', 409);
  const variants = await client.query<{ id: string; sku: string; name: string }>(
    'select id, sku, name from product_variants where product_id = $1 order by created_at, sku', [productId]);
  return { productId, slug: product.rows[0].slug, variants: variants.rows, replayed: true };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

export async function createProductWithVariants(input: ProductOnboardingInput, actorId: string): Promise<ProductOnboardingResult> {
  return invalidatesStorefrontCatalog(withTransaction(async (client) => {
    // Double click / retry after a lost response: the same requestId with the IDENTICAL form replays the
    // product created the first time; any change under a used key is refused (admin_request_keys).
    const { requestId, ...payload } = input;
    const claim = await claimRequestKey(client, { key: requestId, scope: 'product_onboarding', payload, actorId },
      'Sản phẩm đã được tạo ở lần lưu trước với nội dung khác. Mở danh sách sản phẩm để kiểm tra, hoặc tải lại trang để tạo mới.');
    if (claim.status === 'REPLAY') return loadReplay(client, claim.resultId);

    const category = await client.query<{ slug: string }>('select slug from categories where id = $1 and is_active = true', [input.categoryId]);
    if (!category.rowCount) throw new DomainError('CATEGORY_NOT_FOUND', 'Danh mục không tồn tại.', 404);
    if (input.pricingConfigId) {
      const config = await client.query('select 1 from pricing_configs where id = $1', [input.pricingConfigId]);
      if (!config.rowCount) throw new DomainError('PRICING_CONFIG_NOT_FOUND', 'Cấu hình giá không tồn tại.', 404);
    }
    const needsStock = input.productType === 'READY_STOCK' && input.variants.some((variant) => variant.openingStock > 0);
    const warehouseId = needsStock ? await resolveOpeningWarehouse(client, input.warehouseId) : null;

    // Slug: first free `ten-san-pham`, `ten-san-pham-2`… A concurrent create can still take it between
    // the read and the insert, so the insert retries under a savepoint on a unique violation.
    let productId = '';
    let slug = '';
    for (let attempt = 0; ; attempt += 1) {
      const taken = await takenValues(client, 'products', 'slug', slugify(input.name));
      slug = uniqueSlug(input.name, (value) => taken.has(value));
      await client.query('savepoint product_slug');
      try {
        const inserted = await client.query<{ id: string }>(`
          insert into products (category_id, name, slug, short_description, description, product_type, status, base_price,
            is_featured, seo_title, seo_description, pricing_breakdown, pricing_config_id, license_type, license_source_url, license_proof_url)
          values ($1,$2,$3,$4,$5,$6,'DRAFT',$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`, [
          input.categoryId, input.name, slug, input.shortDescription ?? null, input.description ?? null, input.productType, input.basePrice,
          input.isFeatured, input.seoTitle ?? null, input.seoDescription ?? null,
          input.pricingBreakdown ? JSON.stringify(input.pricingBreakdown) : null, input.pricingConfigId ?? null,
          input.licenseType, input.licenseSourceUrl ?? null, input.licenseProofUrl ?? null,
        ]);
        await client.query('release savepoint product_slug');
        productId = inserted.rows[0].id;
        break;
      } catch (error) {
        await client.query('rollback to savepoint product_slug');
        if (!isUniqueViolation(error) || attempt >= 2) throw error;
      }
    }

    const skuCode = skuCodeForCategory(category.rows[0].slug);
    const singleDefault = input.variants.length === 1 && !input.variants[0].color;
    const assigned = new Set<string>();
    const variants: ProductOnboardingResult['variants'] = [];
    for (const variant of input.variants) {
      const skuSlug = singleDefault ? slug : `${slug.slice(0, 24)}-${slugify(variant.name)}`;
      let created: { id: string; sku: string } | null = null;
      for (let attempt = 0; !created; attempt += 1) {
        const taken = await takenValues(client, 'product_variants', 'sku', buildSku(skuCode, skuSlug, () => false));
        const sku = buildSku(skuCode, skuSlug, (value) => taken.has(value) || assigned.has(value));
        await client.query('savepoint variant_sku');
        try {
          const attributes: Record<string, string> = {};
          if (variant.color) attributes.color = variant.color;
          if (variant.material) attributes.material = variant.material;
          const inserted = await client.query<{ id: string }>(`
            insert into product_variants (product_id, sku, name, attributes, price, is_active)
            values ($1,$2,$3,$4,$5,true) returning id`, [productId, sku, variant.name, attributes, variant.price ?? input.basePrice]);
          await client.query('release savepoint variant_sku');
          created = { id: inserted.rows[0].id, sku };
        } catch (error) {
          await client.query('rollback to savepoint variant_sku');
          if (!isUniqueViolation(error) || attempt >= 2) throw error;
        }
      }
      assigned.add(created.sku);
      variants.push({ id: created.id, sku: created.sku, name: variant.name });

      // D9: opening stock is per variant, in the same transaction, as an audited adjustment.
      if (warehouseId && variant.openingStock > 0) {
        await lockVariantForInventoryWrite(client, created.id);
        await insertInventoryMovementLocked(client, {
          warehouseId, productVariantId: created.id, movementType: 'ADJUSTMENT_IN', quantity: variant.openingStock, note: OPENING_STOCK_NOTE,
        }, actorId);
      }
    }

    await setRequestKeyResult(client, requestId, productId);
    await writeAuditLog(client, {
      actorId, action: 'PRODUCT_CREATED', entityType: 'product', entityId: productId,
      afterData: { ...input, slug, variants: variants.map((v) => ({ id: v.id, sku: v.sku })), source: 'onboarding' },
    });
    return { productId, slug, variants, replayed: false };
  }));
}

// ---------------------------------------------------------------------------------------------
// Images (P3)
// ---------------------------------------------------------------------------------------------

export type SignUpload = (path: string) => Promise<{ token: string; signedUrl: string }>;
export type ProductImageUploadTarget = { path: string; token: string; signedUrl: string; contentType: string };

async function assertProductExists(productId: string): Promise<void> {
  const result = await query('select 1 from products where id = $1', [productId]);
  if (!result.rowCount) throw new DomainError('PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
}

export async function createProductImageUploadTargets(
  input: { productId: string; files: { contentType: string; sizeBytes: number }[] },
  signUpload: SignUpload,
): Promise<ProductImageUploadTarget[]> {
  await assertProductExists(input.productId);
  const targets: ProductImageUploadTarget[] = [];
  for (const file of input.files) {
    const extension = EXTENSION_BY_TYPE[file.contentType];
    if (!extension) throw new DomainError('INVALID_FILE_TYPE', 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.', 400);
    if (file.sizeBytes > PRODUCT_IMAGE_MAX_BYTES) throw new DomainError('FILE_TOO_LARGE', 'Ảnh phải nhỏ hơn 5 MB.', 400);
    const path = `${ONBOARDING_IMAGE_PREFIX}/${input.productId}/${randomUUID()}.${extension}`;
    const signed = await signUpload(path);
    targets.push({ path, token: signed.token, signedUrl: signed.signedUrl, contentType: file.contentType });
  }
  return targets;
}

export type RegisteredImages = { added: number; total: number; coverPath: string | null };

export async function registerProductImages(
  input: { productId: string; storagePaths: string[]; coverPath?: string | null; altText?: string | null },
  actorId: string,
): Promise<RegisteredImages> {
  const unique = [...new Set(input.storagePaths)];
  for (const path of unique) {
    const match = ONBOARDING_PATH_RE.exec(path);
    if (!match || match[1] !== input.productId) throw new DomainError('INVALID_IMAGE_PATH', 'Đường dẫn ảnh không hợp lệ.', 400);
  }
  if (input.coverPath && !unique.includes(input.coverPath)) {
    const existing = await query('select 1 from product_images where product_id = $1 and storage_path = $2', [input.productId, input.coverPath]);
    if (!existing.rowCount) throw new DomainError('INVALID_IMAGE_PATH', 'Ảnh bìa không thuộc sản phẩm này.', 400);
  }

  return invalidatesStorefrontCatalog(withTransaction(async (client) => {
    const product = await client.query('select 1 from products where id = $1 for update', [input.productId]);
    if (!product.rowCount) throw new DomainError('PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);

    // The browser claims it uploaded these — trust Storage's own metadata, not the claim.
    const objects = await client.query<{ name: string; size: string | null; mimetype: string | null }>(
      `select name, metadata->>'size' as size, metadata->>'mimetype' as mimetype from storage.objects
       where bucket_id = $1 and name = any($2::text[])`, [PRODUCT_IMAGE_BUCKET, unique]);
    const byName = new Map(objects.rows.map((row) => [row.name, row]));
    for (const path of unique) {
      const object = byName.get(path);
      if (!object) throw new DomainError('IMAGE_NOT_UPLOADED', 'Có ảnh chưa tải lên xong. Thử tải lại ảnh đó.', 400);
      if (object.size !== null && Number(object.size) > PRODUCT_IMAGE_MAX_BYTES) throw new DomainError('FILE_TOO_LARGE', 'Ảnh phải nhỏ hơn 5 MB.', 400);
      if (object.mimetype !== null && !EXTENSION_BY_TYPE[object.mimetype]) throw new DomainError('INVALID_FILE_TYPE', 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.', 400);
    }

    const existing = await client.query<{ id: string; storage_path: string; sort_order: number }>(
      'select id, storage_path, sort_order from product_images where product_id = $1 order by sort_order, created_at', [input.productId]);
    const known = new Set(existing.rows.map((row) => row.storage_path));
    let added = 0;
    let nextSort = existing.rows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    for (const path of unique) {
      if (known.has(path)) continue; // idempotent retry
      const inserted = await client.query<{ id: string }>(
        'insert into product_images (product_id, storage_path, alt_text, sort_order) values ($1,$2,$3,$4) returning id',
        [input.productId, path, input.altText ?? null, nextSort]);
      await writeAuditLog(client, { actorId, action: 'PRODUCT_IMAGE_UPLOADED', entityType: 'product_image', entityId: inserted.rows[0].id, afterData: { productId: input.productId, storagePath: path } });
      nextSort += 1;
      added += 1;
    }

    // Cover = sort_order 0 (D11): put the chosen image first, keep everyone else's relative order.
    const ordered = await client.query<{ id: string; storage_path: string }>(
      'select id, storage_path from product_images where product_id = $1 order by sort_order, created_at', [input.productId]);
    let rows = ordered.rows;
    if (input.coverPath) rows = [...rows.filter((row) => row.storage_path === input.coverPath), ...rows.filter((row) => row.storage_path !== input.coverPath)];
    for (const [index, row] of rows.entries()) {
      await client.query('update product_images set sort_order = $2 where id = $1 and sort_order <> $2', [row.id, index]);
    }
    return { added, total: rows.length, coverPath: rows[0]?.storage_path ?? null };
  }));
}

/** Set an already-registered image as the cover (sort_order 0). */
export async function setProductCoverImage(productId: string, imageId: string): Promise<void> {
  await invalidatesStorefrontCatalog(withTransaction(async (client) => {
    const rows = await client.query<{ id: string }>(
      'select id from product_images where product_id = $1 order by sort_order, created_at for update', [productId]);
    if (!rows.rows.some((row) => row.id === imageId)) throw new DomainError('PRODUCT_IMAGE_NOT_FOUND', 'Không tìm thấy ảnh.', 404);
    const ordered = [imageId, ...rows.rows.map((row) => row.id).filter((id) => id !== imageId)];
    for (const [index, id] of ordered.entries()) await client.query('update product_images set sort_order = $2 where id = $1', [id, index]);
  }));
}

// ---------------------------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------------------------

export const PUBLISH_READINESS_REASONS = ['LICENSE_UNKNOWN', 'NO_IMAGE', 'NO_PRICE', 'UNCATEGORIZED', 'NOT_FOUND'] as const;
export type PublishReadinessReason = typeof PUBLISH_READINESS_REASONS[number];

export const PUBLISH_READINESS_MESSAGES: Record<PublishReadinessReason, string> = {
  LICENSE_UNKNOWN: 'Chưa rõ nguồn/bản quyền mẫu',
  NO_IMAGE: 'Chưa có ảnh',
  NO_PRICE: 'Chưa có giá bán hoặc biến thể đang bán',
  UNCATEGORIZED: 'Chưa chọn danh mục thật',
  NOT_FOUND: 'Không tìm thấy sản phẩm',
};

/** Pure: why a product can't go live yet (same bar for the publish button and the list hints). */
export function readinessReasons(row: { licenseType: string; basePrice: number | null; categorySlug: string | null; imageCount: number; pricedVariants: number }): PublishReadinessReason[] {
  const reasons: PublishReadinessReason[] = [];
  if (row.licenseType === 'UNKNOWN') reasons.push('LICENSE_UNKNOWN');
  if (row.imageCount === 0) reasons.push('NO_IMAGE');
  if (!row.basePrice || row.basePrice <= 0 || row.pricedVariants === 0) reasons.push('NO_PRICE');
  if (!row.categorySlug || row.categorySlug === UNCATEGORIZED_SLUG) reasons.push('UNCATEGORIZED');
  return reasons;
}

export async function getPublishReadiness(productId: string): Promise<PublishReadinessReason[]> {
  const result = await query<{ license_type: string; base_price: string | null; category_slug: string | null; images: string; priced_variants: string }>(`
    select p.license_type, p.base_price, c.slug as category_slug,
      (select count(*) from product_images pi where pi.product_id = p.id) as images,
      (select count(*) from product_variants v where v.product_id = p.id and v.is_active and v.price > 0) as priced_variants
    from products p left join categories c on c.id = p.category_id where p.id = $1`, [productId]);
  if (!result.rowCount) return ['NOT_FOUND'];
  const row = result.rows[0];
  return readinessReasons({
    licenseType: row.license_type, basePrice: row.base_price === null ? null : Number(row.base_price), categorySlug: row.category_slug,
    imageCount: Number(row.images), pricedVariants: Number(row.priced_variants),
  });
}

// ---------------------------------------------------------------------------------------------
// /admin/products — the catalogue list (UX redesign 2026-10-27): what's live, what's a draft and
// what each draft still lacks. Stock and quick pricing live on /admin/product-inventory.
// ---------------------------------------------------------------------------------------------

export type CatalogStatusFilter = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
export type CatalogListItem = {
  id: string; name: string; status: string; productType: string; basePrice: number | null;
  categoryName: string | null; categorySlug: string | null; coverStoragePath: string | null;
  variantCount: number; minPrice: number | null; maxPrice: number | null; imported: boolean;
  updatedAt: string; missing: PublishReadinessReason[];
};

export async function listCatalogProducts(filters: { search?: string; status?: CatalogStatusFilter; productType?: string; categoryId?: string; page?: number; limit?: number } = {}) {
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page as number)) : 1;
  const limit = Math.min(100, Math.max(1, filters.limit ?? 30));
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters.search?.trim()) {
    values.push(`%${filters.search.trim().replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`(p.name ilike $${values.length} or p.slug ilike $${values.length} or exists (select 1 from product_variants sv where sv.product_id = p.id and (sv.sku ilike $${values.length} or sv.name ilike $${values.length})))`);
  }
  if (filters.productType === 'READY_STOCK' || filters.productType === 'MADE_TO_ORDER') { values.push(filters.productType); where.push(`p.product_type = $${values.length}`); }
  if (filters.categoryId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.categoryId)) { values.push(filters.categoryId); where.push(`p.category_id = $${values.length}`); }

  // Counts per status for the tabs use every filter except the status itself.
  const baseWhere = where.length ? `where ${where.join(' and ')}` : '';
  const counts = await query<{ status: string; n: string }>(`select p.status, count(*) as n from products p ${baseWhere} group by p.status`, values);

  const listValues = [...values];
  const listWhere = [...where];
  if (filters.status) { listValues.push(filters.status); listWhere.push(`p.status = $${listValues.length}`); }
  listValues.push(limit + 1, (page - 1) * limit);
  const rows = await query<{
    id: string; name: string; status: string; productType: string; basePrice: string | null; licenseType: string;
    categoryName: string | null; categorySlug: string | null; coverStoragePath: string | null; imageCount: string;
    variantCount: string; pricedVariants: string; minPrice: string | null; maxPrice: string | null; imported: boolean; updatedAt: string;
  }>(`
    select p.id, p.name, p.status, p.product_type as "productType", p.base_price as "basePrice", p.license_type as "licenseType",
      c.name as "categoryName", c.slug as "categorySlug",
      (select pi.storage_path from product_images pi where pi.product_id = p.id order by pi.sort_order, pi.created_at limit 1) as "coverStoragePath",
      (select count(*) from product_images pi where pi.product_id = p.id) as "imageCount",
      (select count(*) from product_variants v where v.product_id = p.id and v.is_active) as "variantCount",
      (select count(*) from product_variants v where v.product_id = p.id and v.is_active and v.price > 0) as "pricedVariants",
      (select min(v.price) from product_variants v where v.product_id = p.id and v.is_active) as "minPrice",
      (select max(v.price) from product_variants v where v.product_id = p.id and v.is_active) as "maxPrice",
      exists (select 1 from product_import_items i where i.product_id = p.id) as imported,
      p.updated_at as "updatedAt"
    from products p left join categories c on c.id = p.category_id
    ${listWhere.length ? `where ${listWhere.join(' and ')}` : ''}
    order by case p.status when 'DRAFT' then 0 when 'ACTIVE' then 1 else 2 end, p.updated_at desc, p.id
    limit $${listValues.length - 1} offset $${listValues.length}`, listValues);

  const items: CatalogListItem[] = rows.rows.slice(0, limit).map((row) => {
    const basePrice = row.basePrice === null ? null : Number(row.basePrice);
    return {
      id: row.id, name: row.name, status: row.status, productType: row.productType, basePrice,
      categoryName: row.categoryName, categorySlug: row.categorySlug, coverStoragePath: row.coverStoragePath,
      variantCount: Number(row.variantCount), minPrice: row.minPrice === null ? null : Number(row.minPrice),
      maxPrice: row.maxPrice === null ? null : Number(row.maxPrice), imported: row.imported, updatedAt: row.updatedAt,
      missing: readinessReasons({ licenseType: row.licenseType, basePrice, categorySlug: row.categorySlug, imageCount: Number(row.imageCount), pricedVariants: Number(row.pricedVariants) }),
    };
  });
  const statusCounts = { ACTIVE: 0, DRAFT: 0, ARCHIVED: 0 } as Record<CatalogStatusFilter, number>;
  for (const row of counts.rows) if (row.status in statusCounts) statusCounts[row.status as CatalogStatusFilter] = Number(row.n);
  return { page, limit, hasNext: rows.rows.length > limit, items, statusCounts };
}

export async function publishProductIfReady(productId: string, actorId: string): Promise<{ published: boolean; reasons: PublishReadinessReason[] }> {
  const reasons = await getPublishReadiness(productId);
  if (reasons.length) return { published: false, reasons };
  // updateProduct locks the row, audits, and still runs the Feature 003 publish-gate trigger.
  await updateProduct(productId, { status: 'ACTIVE' }, actorId);
  return { published: true, reasons: [] };
}

/** Free SKU for a variant added later on the product page (staff left "SKU" empty). */
export async function generateVariantSku(productId: string, variantName: string): Promise<string> {
  const product = await query<{ slug: string; category_slug: string | null }>(
    'select p.slug, c.slug as category_slug from products p left join categories c on c.id = p.category_id where p.id = $1', [productId]);
  if (!product.rowCount) throw new DomainError('PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
  const code = skuCodeForCategory(product.rows[0].category_slug);
  const skuSlug = `${product.rows[0].slug.slice(0, 24)}-${slugify(variantName)}`;
  return withTransaction(async (client) => {
    const taken = await takenValues(client, 'product_variants', 'sku', buildSku(code, skuSlug, () => false));
    return buildSku(code, skuSlug, (value) => taken.has(value));
  });
}
