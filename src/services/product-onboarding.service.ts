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
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import type { StaffSession } from '../lib/auth/require-admin';
import { translateImportGateError } from '../lib/stl-import/publish-gate';
import { buildSku, skuCodeForCategory, slugify, uniqueSlug } from '../lib/catalog/naming';
import type { ProductOnboardingInput } from '../domain/schemas';
import { PRODUCT_IMAGE_MAX_BYTES, catalogBulkActionSchema, catalogQuickEditSchema, mergeCatalogProductsSchema } from '../domain/schemas';
import { writeAuditLog } from './audit.service';
import { insertInventoryMovementLocked, lockVariantForInventoryWrite } from './inventory.service';
import { deleteProduct, updateProduct } from './product.service';
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
export type CatalogSortOption = 'default' | 'updated_desc' | 'name_asc' | 'price_asc' | 'price_desc';
export type CatalogSourceFilter = 'ALL' | 'STL' | 'MANUAL';

export type CatalogListItem = {
  id: string; name: string; slug: string; status: string; productType: string; basePrice: number | null;
  shortDescription: string | null; isFeatured: boolean;
  categoryId: string | null; categoryName: string | null; categorySlug: string | null; coverStoragePath: string | null;
  variantCount: number; minPrice: number | null; maxPrice: number | null; imported: boolean;
  licenseType: string; licenseSourceUrl: string | null; licenseProofUrl: string | null;
  importItemId: string | null; importReviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  importLicenseReviewed: boolean | null; importSourceRelPath: string | null; importWarnings: string[];
  updatedAt: string; missing: PublishReadinessReason[];
};

const ORDER_BY_MAP: Record<CatalogSortOption, string> = {
  default: "case p.status when 'DRAFT' then 0 when 'ACTIVE' then 1 else 2 end, p.updated_at desc, p.id",
  updated_desc: 'p.updated_at desc, p.id',
  name_asc: 'p.name asc, p.id',
  price_asc: 'coalesce(p.base_price, 9223372036854775807) asc, p.updated_at desc, p.id',
  price_desc: 'coalesce(p.base_price, -1) desc, p.updated_at desc, p.id',
};

export async function listCatalogProducts(filters: {
  search?: string; status?: CatalogStatusFilter; productType?: string; categoryId?: string;
  source?: CatalogSourceFilter; sort?: CatalogSortOption; page?: number; limit?: number;
} = {}) {
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
  if (filters.source === 'STL') where.push('exists (select 1 from product_import_items i where i.product_id = p.id)');
  else if (filters.source === 'MANUAL') where.push('not exists (select 1 from product_import_items i where i.product_id = p.id)');

  // Counts per status for the tabs use every filter except the status itself.
  const baseWhere = where.length ? `where ${where.join(' and ')}` : '';
  const counts = await query<{ status: string; n: string }>(`select p.status, count(*) as n from products p ${baseWhere} group by p.status`, values);

  const listValues = [...values];
  const listWhere = [...where];
  if (filters.status) { listValues.push(filters.status); listWhere.push(`p.status = $${listValues.length}`); }
  const orderBy = ORDER_BY_MAP[filters.sort ?? 'default'] ?? ORDER_BY_MAP.default;
  listValues.push(limit + 1, (page - 1) * limit);
  const rows = await query<{
    id: string; name: string; slug: string; status: string; productType: string; basePrice: string | null;
    shortDescription: string | null; isFeatured: boolean; licenseType: string;
    licenseSourceUrl: string | null; licenseProofUrl: string | null;
    categoryId: string | null; categoryName: string | null; categorySlug: string | null; coverStoragePath: string | null;
    imageCount: string; variantCount: string; pricedVariants: string; minPrice: string | null; maxPrice: string | null;
    importItemId: string | null; importReviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    importLicenseReviewed: boolean | null; importSourceRelPath: string | null; importWarnings: unknown; updatedAt: string;
  }>(`
    select p.id, p.name, p.slug, p.status, p.product_type as "productType", p.base_price as "basePrice",
      p.short_description as "shortDescription", p.is_featured as "isFeatured", p.license_type as "licenseType",
      p.license_source_url as "licenseSourceUrl", p.license_proof_url as "licenseProofUrl",
      p.category_id as "categoryId", c.name as "categoryName", c.slug as "categorySlug",
      (select pi.storage_path from product_images pi where pi.product_id = p.id order by pi.sort_order, pi.created_at limit 1) as "coverStoragePath",
      (select count(*) from product_images pi where pi.product_id = p.id) as "imageCount",
      (select count(*) from product_variants v where v.product_id = p.id and v.is_active) as "variantCount",
      (select count(*) from product_variants v where v.product_id = p.id and v.is_active and v.price > 0) as "pricedVariants",
      (select min(v.price) from product_variants v where v.product_id = p.id and v.is_active) as "minPrice",
      (select max(v.price) from product_variants v where v.product_id = p.id and v.is_active) as "maxPrice",
      imp.id as "importItemId", imp.review_status as "importReviewStatus", imp.license_reviewed as "importLicenseReviewed",
      imp.source_rel_path as "importSourceRelPath", imp.warnings as "importWarnings",
      p.updated_at as "updatedAt"
    from products p
    left join categories c on c.id = p.category_id
    left join product_import_items imp on imp.product_id = p.id
    ${listWhere.length ? `where ${listWhere.join(' and ')}` : ''}
    order by ${orderBy}
    limit $${listValues.length - 1} offset $${listValues.length}`, listValues);

  const items: CatalogListItem[] = rows.rows.slice(0, limit).map((row) => {
    const basePrice = row.basePrice === null ? null : Number(row.basePrice);
    const importWarnings = Array.isArray(row.importWarnings) ? row.importWarnings.filter((w): w is string => typeof w === 'string') : [];
    return {
      id: row.id, name: row.name, slug: row.slug, status: row.status, productType: row.productType, basePrice,
      shortDescription: row.shortDescription, isFeatured: row.isFeatured,
      categoryId: row.categoryId, categoryName: row.categoryName, categorySlug: row.categorySlug, coverStoragePath: row.coverStoragePath,
      variantCount: Number(row.variantCount), minPrice: row.minPrice === null ? null : Number(row.minPrice),
      maxPrice: row.maxPrice === null ? null : Number(row.maxPrice), imported: Boolean(row.importItemId),
      licenseType: row.licenseType, licenseSourceUrl: row.licenseSourceUrl, licenseProofUrl: row.licenseProofUrl,
      importItemId: row.importItemId, importReviewStatus: row.importReviewStatus,
      importLicenseReviewed: row.importLicenseReviewed, importSourceRelPath: row.importSourceRelPath, importWarnings,
      updatedAt: row.updatedAt,
      missing: readinessReasons({ licenseType: row.licenseType, basePrice, categorySlug: row.categorySlug, imageCount: Number(row.imageCount), pricedVariants: Number(row.pricedVariants) }),
    };
  });
  const statusCounts = { ACTIVE: 0, DRAFT: 0, ARCHIVED: 0 } as Record<CatalogStatusFilter, number>;
  for (const row of counts.rows) if (row.status in statusCounts) statusCounts[row.status as CatalogStatusFilter] = Number(row.n);
  return { page, limit, hasNext: rows.rows.length > limit, items, statusCounts };
}

export async function getProductImportMeta(productId: string) {
  const result = await query<{
    id: string; reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    licenseReviewed: boolean; sourceRelPath: string;
  }>(`select id, review_status as "reviewStatus", license_reviewed as "licenseReviewed", source_rel_path as "sourceRelPath"
      from product_import_items where product_id = $1`, [productId]);
  return result.rows[0] ?? null;
}

export async function publishProductIfReady(productId: string, actorId: string): Promise<{ published: boolean; reasons: PublishReadinessReason[] }> {
  const reasons = await getPublishReadiness(productId);
  if (reasons.length) return { published: false, reasons };
  // updateProduct locks the row, audits, and still runs the Feature 003 publish-gate trigger.
  await updateProduct(productId, { status: 'ACTIVE' }, actorId);
  return { published: true, reasons: [] };
}

export async function quickUpdateCatalogProduct(session: StaffSession, rawInput: unknown): Promise<{ id: string; name: string; status: string }> {
  const input = catalogQuickEditSchema.parse(rawInput);
  return invalidatesStorefrontCatalog(withTransaction(async (client) => {
    const impResult = await client.query<{ id: string; review_status: 'PENDING' | 'APPROVED' | 'REJECTED'; license_reviewed: boolean }>(
      'select id, review_status, license_reviewed from product_import_items where product_id = $1 for update',
      [input.productId],
    );
    const importItem = impResult.rows[0] ?? null;

    const prodResult = await client.query<{
      id: string; name: string; status: string; category_id: string | null; product_type: string;
      base_price: string | null; short_description: string | null; is_featured: boolean;
      license_type: string; license_source_url: string | null; license_proof_url: string | null;
      category_slug: string | null; category_active: boolean | null;
    }>(`
      select p.id, p.name, p.status, p.category_id, p.product_type, p.base_price, p.short_description, p.is_featured,
        p.license_type, p.license_source_url, p.license_proof_url, c.slug as category_slug, c.is_active as category_active
      from products p left join categories c on c.id = p.category_id
      where p.id = $1 for update of p`, [input.productId]);
    if (!prodResult.rowCount) throw new DomainError('PRODUCT_NOT_FOUND', 'Kh?ng t?m th?y s?n ph?m.', 404);
    const product = prodResult.rows[0];

    let nextCategorySlug = product.category_slug;
    let nextCategoryActive = product.category_active;
    if (input.categoryId !== undefined) {
      if (input.categoryId === null) {
        nextCategorySlug = null;
        nextCategoryActive = false;
      } else {
        const cat = await client.query<{ slug: string; is_active: boolean }>('select slug, is_active from categories where id = $1', [input.categoryId]);
        if (!cat.rowCount) throw new DomainError('CATEGORY_NOT_FOUND', 'Danh m?c kh?ng t?n t?i.', 404);
        nextCategorySlug = cat.rows[0].slug;
        nextCategoryActive = cat.rows[0].is_active;
      }
    }

    const oldBasePrice = product.base_price === null ? null : Number(product.base_price);
    const nextBasePrice = input.basePrice !== undefined ? input.basePrice : oldBasePrice;
    const nextStatus = input.status ?? product.status;
    const nextLicenseType = input.licenseType ?? product.license_type;
    const effectiveLicenseReviewed = input.licenseReviewed ?? importItem?.license_reviewed ?? false;

    // Sync default/matching active variant prices when basePrice changes.
    if (input.basePrice !== undefined && input.basePrice !== null && input.syncSingleVariantPrice) {
      const variants = await client.query<{ id: string; price: string }>(
        'select id, price from product_variants where product_id = $1 and is_active = true order by created_at, id',
        [input.productId],
      );
      if (variants.rowCount === 1) {
        await client.query('update product_variants set price = $2 where id = $1', [variants.rows[0].id, input.basePrice]);
      } else if (variants.rowCount && variants.rowCount > 1) {
        for (const v of variants.rows) {
          const vp = Number(v.price);
          if (vp === 0 || (oldBasePrice !== null && vp === oldBasePrice)) {
            await client.query('update product_variants set price = $2 where id = $1', [v.id, input.basePrice]);
          }
        }
      }
    }

    if (nextStatus === 'ACTIVE') {
      const stats = await client.query<{ images: string; priced_variants: string }>(`
        select
          (select count(*) from product_images where product_id = $1) as images,
          (select count(*) from product_variants where product_id = $1 and is_active and price > 0) as priced_variants
      `, [input.productId]);
      const reasons = readinessReasons({
        licenseType: nextLicenseType,
        basePrice: nextBasePrice,
        categorySlug: nextCategoryActive === false ? UNCATEGORIZED_SLUG : nextCategorySlug,
        imageCount: Number(stats.rows[0].images),
        pricedVariants: Number(stats.rows[0].priced_variants),
      });
      if (reasons.length) {
        throw new DomainError('PUBLISH_BLOCKED', `Ch?a ??ng b?n ???c: ${reasons.map((r) => PUBLISH_READINESS_MESSAGES[r]).join('; ')}.`, 409);
      }
      if (importItem) {
        if (importItem.review_status !== 'APPROVED' && session.role !== 'OWNER') {
          throw new DomainError('FORBIDDEN', 'Ch? OWNER m?i c? quy?n duy?t s?n ph?m nh?p t? kho STL l?n web.', 403);
        }
        if (!effectiveLicenseReviewed) {
          throw new DomainError('LICENSE_NOT_REVIEWED', 'C?n tick "?? ki?m tra b?n quy?n" tr??c khi duy?t s?n ph?m STL l?n web.', 409);
        }
      }
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    const addSet = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };
    if (input.name !== undefined) addSet('name', input.name);
    if (input.categoryId !== undefined) addSet('category_id', input.categoryId);
    if (input.productType !== undefined) addSet('product_type', input.productType);
    if (input.basePrice !== undefined) {
      addSet('base_price', input.basePrice);
      if (oldBasePrice !== input.basePrice) { addSet('pricing_breakdown', null); addSet('pricing_config_id', null); }
    }
    if (input.shortDescription !== undefined) addSet('short_description', input.shortDescription);
    if (input.isFeatured !== undefined) addSet('is_featured', input.isFeatured);
    if (input.status !== undefined) addSet('status', input.status);
    if (input.licenseType !== undefined) addSet('license_type', input.licenseType);
    if (input.licenseSourceUrl !== undefined) addSet('license_source_url', input.licenseSourceUrl);
    if (input.licenseProofUrl !== undefined) addSet('license_proof_url', input.licenseProofUrl);

    const runProductUpdate = async () => {
      if (!sets.length) return { id: product.id, name: product.name, status: product.status };
      values.push(input.productId);
      const updated = await client.query<{ id: string; name: string; status: string }>(
        `update products set ${sets.join(', ')} where id = $${values.length} returning id, name, status`,
        values,
      ).catch((error: unknown) => { throw translateImportGateError(error); });
      await writeAuditLog(client, { actorId: session.actorId, action: 'PRODUCT_UPDATED', entityType: 'product', entityId: input.productId, afterData: updated.rows[0] });
      return updated.rows[0];
    };

    const runImportUpdate = async () => {
      if (!importItem) return;
      const shouldApprove = nextStatus === 'ACTIVE' && importItem.review_status !== 'APPROVED';
      const reviewToggled = input.licenseReviewed !== undefined && input.licenseReviewed !== importItem.license_reviewed;
      const priceChanged = input.basePrice !== undefined && input.basePrice !== oldBasePrice;
      if (!shouldApprove && !reviewToggled && !priceChanged) return;
      await client.query(`
        update product_import_items set
          review_status = case when $2 then 'APPROVED' else review_status end,
          reviewed_by = case when $2 then $3::uuid else reviewed_by end,
          reviewed_at = case when $2 then now() else reviewed_at end,
          license_reviewed = case when $4 then $5 else license_reviewed end,
          license_reviewed_by = case when $4 then (case when $5 then $3::uuid else null end) else license_reviewed_by end,
          license_reviewed_at = case when $4 then (case when $5 then now() else null end) else license_reviewed_at end,
          needs_price_review = case when $6 then false else needs_price_review end
        where id = $1
      `, [importItem.id, shouldApprove, session.actorId, reviewToggled, Boolean(input.licenseReviewed), priceChanged]);
      if (shouldApprove) {
        await writeAuditLog(client, { actorId: session.actorId, action: 'STL_IMPORT_APPROVED', entityType: 'product_import_item', entityId: importItem.id, afterData: { productId: input.productId, via: 'catalog_quick_edit' } });
      }
    };

    // Demoting ACTIVE -> DRAFT/ARCHIVED updates product first so enforce_import_item_link allows unticking licenseReviewed.
    let updatedRow: { id: string; name: string; status: string };
    if (product.status === 'ACTIVE' && nextStatus !== 'ACTIVE') {
      updatedRow = await runProductUpdate();
      await runImportUpdate();
    } else {
      await runImportUpdate();
      updatedRow = await runProductUpdate();
    }
    return updatedRow;
  }));
}

export type BulkCatalogResult = {
  done: string[];
  blocked: { productId: string; name: string; reason: string }[];
};

export async function bulkCatalogAction(session: StaffSession, rawInput: unknown): Promise<BulkCatalogResult> {
  const input = catalogBulkActionSchema.parse(rawInput);
  const ids = [...new Set(input.productIds)].sort();
  if (input.action === 'DELETE' && session.role !== 'OWNER') {
    throw new DomainError('FORBIDDEN', 'Ch? OWNER m?i c? quy?n xo? h?n s?n ph?m.', 403);
  }
  const namesResult = await query<{ id: string; name: string }>('select id, name from products where id = any($1::uuid[])', [ids]);
  const nameById = new Map(namesResult.rows.map((r) => [r.id, r.name]));

  const result: BulkCatalogResult = { done: [], blocked: [] };
  for (const productId of ids) {
    const label = nameById.get(productId) ?? productId;
    try {
      if (input.action === 'DELETE') {
        await deleteProduct(productId, session.actorId);
      } else if (input.action === 'SET_CATEGORY') {
        await quickUpdateCatalogProduct(session, { productId, categoryId: input.categoryId });
      } else if (input.action === 'SET_STATUS') {
        await quickUpdateCatalogProduct(session, { productId, status: input.status });
      } else if (input.action === 'SET_FEATURED') {
        await quickUpdateCatalogProduct(session, { productId, isFeatured: input.isFeatured });
      } else if (input.action === 'PUBLISH') {
        await quickUpdateCatalogProduct(session, {
          productId,
          status: 'ACTIVE',
          ...(input.confirmLicenseReviewed ? { licenseReviewed: true } : {}),
        });
      } else if (input.action === 'APPLY_LICENSE') {
        await quickUpdateCatalogProduct(session, {
          productId,
          licenseType: input.licenseType,
          ...(input.licenseSourceUrl !== undefined ? { licenseSourceUrl: input.licenseSourceUrl } : {}),
          ...(input.licenseReviewed !== undefined ? { licenseReviewed: input.licenseReviewed } : {}),
          ...(input.publish ? { status: 'ACTIVE' as const } : {}),
        });
      }
      result.done.push(productId);
    } catch (error) {
      if (error instanceof DomainError) {
        result.blocked.push({ productId, name: label, reason: error.message });
      } else {
        throw error;
      }
    }
  }
  return result;
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

export type MergeCatalogResult = {
  productId: string;
  slug: string;
  name: string;
  status: string;
  variantCount: number;
};

export async function mergeCatalogProducts(session: StaffSession, rawInput: unknown): Promise<MergeCatalogResult> {
  const input = mergeCatalogProductsSchema.parse(rawInput);
  const sourceIds = [...new Set(input.items.map((i) => i.sourceProductId))];
  if (sourceIds.length !== input.items.length) {
    throw new DomainError('DUPLICATE_SOURCE_PRODUCT', 'Không thể gộp trùng cùng một sản phẩm gốc.', 400);
  }
  if (input.sourceCleanup === 'DELETE' && session.role !== 'OWNER') {
    throw new DomainError('FORBIDDEN', 'Chỉ OWNER mới có quyền xoá hẳn sản phẩm gốc.', 403);
  }
  if (input.publishImmediately && input.licenseType === 'UNKNOWN') {
    throw new DomainError('LICENSE_UNKNOWN', 'Cần chọn loại bản quyền trước khi đăng bán ngay.', 409);
  }

  const copiedStoragePaths: string[] = [];
  try {
    return await invalidatesStorefrontCatalog(withTransaction(async (client) => {
      const category = await client.query<{ slug: string; is_active: boolean }>(
        'select slug, is_active from categories where id = $1',
        [input.categoryId],
      );
      if (!category.rowCount || !category.rows[0].is_active || category.rows[0].slug === UNCATEGORIZED_SLUG) {
        throw new DomainError('UNCATEGORIZED', 'Hãy chọn một danh mục thật đang hoạt động.', 400);
      }

      const sortedSourceIds = [...sourceIds].sort();
      const lockedSources = await client.query<{ id: string }>(
        'select id from products where id = any($1::uuid[]) order by id for update',
        [sortedSourceIds],
      );
      if (lockedSources.rowCount !== sortedSourceIds.length) {
        throw new DomainError('PRODUCT_NOT_FOUND', 'Một số sản phẩm gốc không còn tồn tại.', 404);
      }

      if (input.publishImmediately && session.role !== 'OWNER') {
        const hasImported = await client.query('select 1 from product_import_items where product_id = any($1::uuid[]) limit 1', [sortedSourceIds]);
        if (hasImported.rowCount) {
          throw new DomainError('FORBIDDEN', 'Chỉ OWNER mới có quyền duyệt sản phẩm nhập từ kho STL lên web.', 403);
        }
      }

      if (input.sourceCleanup === 'DELETE') {
        const refs = await client.query<{ has_refs: boolean }>(`
          select exists (
            select 1 from order_items oi join product_variants pv on pv.id = oi.variant_id where pv.product_id = any($1::uuid[])
            union all
            select 1 from cart_items ci join product_variants pv on pv.id = ci.variant_id where pv.product_id = any($1::uuid[])
            union all
            select 1 from inventory_movements im join product_variants pv on pv.id = im.product_variant_id where pv.product_id = any($1::uuid[])
          ) as has_refs
        `, [sortedSourceIds]);
        if (refs.rows[0].has_refs) {
          throw new DomainError('PRODUCT_IN_USE', 'Có sản phẩm gốc đã phát sinh đơn hàng/giỏ hàng/tồn kho — hãy chọn "Lưu trữ" thay vì xoá hẳn.', 409);
        }
      }

      // Read each source product's cover image BEFORE deleting/archiving source rows.
      const coverBySourceId = new Map<string, string>();
      for (const sourceId of sortedSourceIds) {
        const srcImg = await client.query<{ storage_path: string }>(
          'select storage_path from product_images where product_id = $1 order by sort_order, created_at limit 1',
          [sourceId],
        );
        if (srcImg.rowCount) coverBySourceId.set(sourceId, srcImg.rows[0].storage_path);
      }

      // When deleting source products, remove their product_images rows first so unique storage_path is freed.
      if (input.sourceCleanup === 'DELETE') {
        await client.query('delete from product_images where product_id = any($1::uuid[])', [sortedSourceIds]);
      }

      const basePrice = Math.min(...input.items.map((i) => i.price));
      let productId = '';
      let slug = '';
      for (let attempt = 0; ; attempt += 1) {
        const taken = await takenValues(client, 'products', 'slug', slugify(input.name));
        slug = uniqueSlug(input.name, (value) => taken.has(value));
        await client.query('savepoint merge_product_slug');
        try {
          const inserted = await client.query<{ id: string }>(`
            insert into products (category_id, name, slug, short_description, product_type, status, base_price, is_featured, license_type, license_source_url, license_proof_url)
            values ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10) returning id`, [
            input.categoryId, input.name, slug, input.shortDescription ?? null, input.productType, basePrice,
            input.isFeatured, input.licenseType, input.licenseSourceUrl ?? null, input.licenseProofUrl ?? null,
          ]);
          await client.query('release savepoint merge_product_slug');
          productId = inserted.rows[0].id;
          break;
        } catch (error) {
          await client.query('rollback to savepoint merge_product_slug');
          if (!isUniqueViolation(error) || attempt >= 2) throw error;
        }
      }

      const skuCode = skuCodeForCategory(category.rows[0].slug);
      const assignedSkus = new Set<string>();
      const variantPlans = [
        ...input.items.map((item) => ({ sourceProductId: item.sourceProductId as string | null, name: item.variantName.trim(), price: item.price })),
        ...(input.comboVariant?.enabled && input.comboVariant.price && input.comboVariant.price > 0
          ? [{ sourceProductId: null, name: input.comboVariant.name.trim(), price: input.comboVariant.price }]
          : []),
      ];

      const hasStorage = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
      const storage = hasStorage ? createSupabaseAdminClient().storage.from(PRODUCT_IMAGE_BUCKET) : null;

      let imageSortOrder = 0;
      for (const plan of variantPlans) {
        const skuSlug = `${slug.slice(0, 22)}-${slugify(plan.name)}`;
        let variantId = '';
        for (let attempt = 0; !variantId; attempt += 1) {
          const taken = await takenValues(client, 'product_variants', 'sku', buildSku(skuCode, skuSlug, () => false));
          const sku = buildSku(skuCode, skuSlug, (value) => taken.has(value) || assignedSkus.has(value));
          await client.query('savepoint merge_variant_sku');
          try {
            const inserted = await client.query<{ id: string }>(
              `insert into product_variants (product_id, sku, name, attributes, price, is_active)
               values ($1,$2,$3,$4,$5,true) returning id`,
              [productId, sku, plan.name, { sample: plan.name }, plan.price],
            );
            await client.query('release savepoint merge_variant_sku');
            variantId = inserted.rows[0].id;
            assignedSkus.add(sku);
          } catch (error) {
            await client.query('rollback to savepoint merge_variant_sku');
            if (!isUniqueViolation(error) || attempt >= 2) throw error;
          }
        }

        const srcPath = plan.sourceProductId ? coverBySourceId.get(plan.sourceProductId) : undefined;
        if (srcPath) {
          let targetPath = srcPath;
          if (input.sourceCleanup !== 'DELETE') {
            const extMatch = /\.(webp|jpg|jpeg|png)$/i.exec(srcPath);
            const ext = extMatch ? extMatch[1].toLowerCase() : 'webp';
            targetPath = `${ONBOARDING_IMAGE_PREFIX}/${productId}/${randomUUID()}.${ext}`;
            if (storage) {
              const { error: copyError } = await storage.copy(srcPath, targetPath);
              if (copyError) {
                throw new DomainError('IMAGE_COPY_FAILED', 'Không thể sao chép ảnh sang sản phẩm gộp. Thử lại nhé.', 502);
              }
              copiedStoragePaths.push(targetPath);
            }
          }
          await client.query(
            'insert into product_images (product_id, variant_id, storage_path, alt_text, sort_order) values ($1,$2,$3,$4,$5)',
            [productId, variantId, targetPath, plan.name.slice(0, 200), imageSortOrder],
          );
          imageSortOrder += 1;
        }
      }

      let finalStatus = 'DRAFT';
      if (input.publishImmediately) {
        if (imageSortOrder === 0) {
          throw new DomainError('NO_IMAGE', 'Các sản phẩm gốc chưa có ảnh — không thể đăng bán ngay, hãy lưu nháp rồi tải ảnh.', 409);
        }
        await client.query(`update products set status = 'ACTIVE' where id = $1`, [productId]);
        finalStatus = 'ACTIVE';
      }

      if (input.sourceCleanup === 'ARCHIVE') {
        await client.query(`update products set status = 'ARCHIVED' where id = any($1::uuid[])`, [sortedSourceIds]);
      } else if (input.sourceCleanup === 'DELETE') {
        await client.query('delete from product_variants where product_id = any($1::uuid[])', [sortedSourceIds]);
        await client.query('delete from products where id = any($1::uuid[])', [sortedSourceIds]);
      }

      await writeAuditLog(client, {
        actorId: session.actorId,
        action: 'PRODUCT_MERGED',
        entityType: 'product',
        entityId: productId,
        afterData: { sourceIds: sortedSourceIds, variantCount: variantPlans.length, cleanup: input.sourceCleanup, status: finalStatus },
      });

      return { productId, slug, name: input.name, status: finalStatus, variantCount: variantPlans.length };
    }));
  } catch (error) {
    if (copiedStoragePaths.length && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await createSupabaseAdminClient().storage.from(PRODUCT_IMAGE_BUCKET).remove(copiedStoragePaths).catch(() => undefined);
    }
    throw error;
  }
}
