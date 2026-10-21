// Feature 003 — admin "Kho nhập STL" (specs/003-stl-bulk-import/contracts/admin-stl-import.md).
// OWNER + STAFF list and quick-edit; only OWNER approves/rejects (FR-016). The role is checked here
// as well as in the server actions. Edits are optimistic-locked on updated_at, compared as
// microsecond strings in SQL (a JS Date would drop the microseconds). Each decision runs in its own
// transaction, locking the item before the product — the same order as the import script.
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import type { StaffSession } from '../lib/auth/require-admin';
import { invalidateStorefrontCatalog } from '../lib/cache/storefront-cache-tags';
import { UNCATEGORIZED_SLUG } from '../lib/stl-import/category-map';
import { publishBlockedReasons, type PublishBlockReason } from '../lib/stl-import/publish-gate';
import { stlImportBulkDecisionSchema, stlImportFilterSchema, stlImportItemRefSchema, stlImportQuickEditSchema } from '../domain/schemas';
import { writeAuditLog } from './audit.service';
import { getBucketUsageBytes } from './storage-usage.service';
import { PRODUCT_IMAGE_BUCKET } from './stl-import-write.service';

export const STL_IMPORT_PAGE_SIZE = 24;
const TS = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export type DecisionBlockReason = PublishBlockReason | 'NOT_RENDERED' | 'STALE' | 'NOT_PENDING' | 'NOT_FOUND' | 'ERROR';
export type DecisionResult = { done: string[]; blocked: { itemId: string; reasons: DecisionBlockReason[] }[] };

export type ImportListItem = {
  itemId: string; itemUpdatedAt: string; productId: string | null; productUpdatedAt: string | null; productStatus: string | null;
  coverUrl: string | null; name: string | null; slug: string | null; categoryId: string | null; categoryName: string | null;
  bboxMm: { x: number; y: number; z: number } | null; volumeCm3: number | null; basePrice: number | null;
  licenseType: string | null; licenseSourceUrl: string | null; licenseReviewed: boolean; reviewStatus: string; renderStatus: string;
  processError: string | null; warnings: string[]; needsPriceReview: boolean; needsRerender: boolean; sourceChangedAt: string | null;
  sourceRelPath: string; sourceDir: string;
};

function imageUrl(storagePath: string | null): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!storagePath || !baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
}

function requireStaff(session: StaffSession) {
  if (session.role !== 'OWNER' && session.role !== 'STAFF') throw new DomainError('FORBIDDEN', 'Tài khoản chưa được cấp quyền truy cập admin.', 403);
}

function requireOwnerSession(session: StaffSession) {
  if (session.role !== 'OWNER') throw new DomainError('FORBIDDEN', 'Chỉ OWNER mới được duyệt hoặc từ chối mẫu nhập.', 403);
}

function stale(): DomainError {
  return new DomainError('STALE_WRITE', 'Dữ liệu đã thay đổi trên thiết bị khác. Tải lại trang rồi sửa lại.', 409);
}

export async function listImportItems(session: StaffSession, rawFilter: unknown) {
  requireStaff(session);
  const filter = stlImportFilterSchema.parse(rawFilter);
  const where: string[] = [];
  const values: unknown[] = [];
  const param = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (filter.status === 'ERROR') where.push(`i.render_status = 'ERROR'`);
  else where.push(`i.review_status = ${param(filter.status)}`, `i.render_status <> 'ERROR'`);
  if (filter.categoryId) where.push(`p.category_id = ${param(filter.categoryId)}`);
  if (filter.sourceDir !== undefined && filter.sourceDir !== '') {
    where.push(`(i.source_dir = ${param(filter.sourceDir)} or i.source_dir like ${param(`${filter.sourceDir.replace(/[%_\\]/g, '\\$&')}/%`)})`);
  }
  if (filter.q) where.push(`p.name ilike ${param(`%${filter.q.replace(/[%_\\]/g, '\\$&')}%`)}`);
  const offset = (filter.page - 1) * STL_IMPORT_PAGE_SIZE;
  const rows = await query<Omit<ImportListItem, 'coverUrl'> & { coverPath: string | null; basePrice: string | null; volumeCm3: string | null }>(`
    select i.id as "itemId", ${TS('i.updated_at')} as "itemUpdatedAt", p.id as "productId", ${TS('p.updated_at')} as "productUpdatedAt",
      p.status::text as "productStatus",
      (select pi.storage_path from product_images pi where pi.product_id = p.id order by pi.sort_order, pi.id limit 1) as "coverPath",
      p.name, p.slug, p.category_id as "categoryId", c.name as "categoryName", i.bbox_mm as "bboxMm", i.volume_cm3 as "volumeCm3",
      p.base_price as "basePrice", p.license_type as "licenseType", p.license_source_url as "licenseSourceUrl",
      i.license_reviewed as "licenseReviewed", i.review_status as "reviewStatus", i.render_status as "renderStatus",
      i.process_error as "processError", i.warnings, i.needs_price_review as "needsPriceReview", i.needs_rerender as "needsRerender",
      ${TS('i.source_changed_at')} as "sourceChangedAt", i.source_rel_path as "sourceRelPath", i.source_dir as "sourceDir"
    from product_import_items i
    left join products p on p.id = i.product_id
    left join categories c on c.id = p.category_id
    where ${where.join(' and ')}
    order by i.created_at desc, i.id
    limit ${STL_IMPORT_PAGE_SIZE + 1} offset ${offset}`, values);
  const [sourceDirs, bucketUsageBytes] = await Promise.all([
    query<{ sourceDir: string }>('select distinct source_dir as "sourceDir" from product_import_items order by 1 limit 300'),
    getBucketUsageBytes(PRODUCT_IMAGE_BUCKET).catch(() => null),
  ]);
  const items: ImportListItem[] = rows.rows.slice(0, STL_IMPORT_PAGE_SIZE).map(({ coverPath, ...row }) => ({
    ...row,
    basePrice: row.basePrice === null ? null : Number(row.basePrice),
    volumeCm3: row.volumeCm3 === null ? null : Number(row.volumeCm3),
    coverUrl: imageUrl(coverPath),
  }));
  return { items, page: filter.page, hasNext: rows.rows.length > STL_IMPORT_PAGE_SIZE, filter, sourceDirs: sourceDirs.rows.map((r) => r.sourceDir), bucketUsageBytes };
}

type LockedItem = { id: string; product_id: string | null; review_status: string; render_status: string; license_reviewed: boolean; updated_at: string };

async function lockItem(client: PoolClient, itemId: string): Promise<LockedItem | null> {
  const result = await client.query<LockedItem>(
    `select id, product_id, review_status, render_status, license_reviewed, ${TS('updated_at')} as updated_at
     from product_import_items where id = $1 for update`, [itemId]);
  return result.rows[0] ?? null;
}

type LockedProduct = { id: string; status: string; name: string; category_id: string | null; category_slug: string | null; category_active: boolean | null; base_price: string | null; license_type: string; license_source_url: string | null; updated_at: string };

async function lockProduct(client: PoolClient, productId: string): Promise<LockedProduct> {
  const result = await client.query<LockedProduct>(
    `select p.id, p.status::text as status, p.name, p.category_id, c.slug as category_slug, c.is_active as category_active, p.base_price, p.license_type, p.license_source_url,
       ${TS('p.updated_at')} as updated_at
     from products p left join categories c on c.id = p.category_id where p.id = $1 for update of p`, [productId]);
  if (!result.rowCount) throw new DomainError('PRODUCT_NOT_FOUND', 'Sản phẩm của mẫu nhập không còn tồn tại.', 404);
  return result.rows[0];
}

async function isUncategorized(client: PoolClient, categoryId: string | null): Promise<boolean> {
  if (!categoryId) return true;
  const result = await client.query('select 1 from categories where id = $1 and slug = $2', [categoryId, UNCATEGORIZED_SLUG]);
  return Boolean(result.rowCount);
}

export async function quickEditImportItem(session: StaffSession, rawInput: unknown) {
  requireStaff(session);
  const input = stlImportQuickEditSchema.parse(rawInput);
  const result = await withTransaction(async (client) => {
    const item = await lockItem(client, input.itemId);
    if (!item || item.product_id !== input.productId) throw new DomainError('IMPORT_ITEM_NOT_FOUND', 'Không tìm thấy mẫu nhập.', 404);
    if (item.updated_at !== input.expectedItemUpdatedAt) throw stale();
    const product = await lockProduct(client, input.productId);
    if (product.updated_at !== input.expectedProductUpdatedAt) throw stale();
    if (item.review_status === 'APPROVED'
      && (!input.licenseReviewed || await isUncategorized(client, input.categoryId) || !input.basePrice)) {
      throw new DomainError('IMPORT_APPROVED_LOCKED', 'Mẫu đã lên web phải giữ: đã kiểm tra bản quyền, danh mục thật và giá > 0.', 409);
    }
    const priceChanged = (product.base_price === null ? null : Number(product.base_price)) !== input.basePrice;
    const updatedProduct = await client.query<{ updated_at: string; status: string }>(
      `update products set name = $2, category_id = $3, license_type = $4, license_source_url = $5
         ${priceChanged ? ', base_price = $6, pricing_breakdown = null, pricing_config_id = null' : ''}
       where id = $1 returning ${TS('updated_at')} as updated_at, status::text as status`,
      [input.productId, input.name, input.categoryId, input.licenseType, input.licenseSourceUrl, ...(priceChanged ? [input.basePrice] : [])]);
    if (priceChanged) {
      await client.query(
        `update product_variants set price = $2
         where id = (select id from product_variants where product_id = $1 order by created_at, id limit 1)`,
        [input.productId, input.basePrice ?? 0]);
    }
    const reviewToggled = input.licenseReviewed !== item.license_reviewed;
    const updatedItem = await client.query<{ updated_at: string }>(
      `update product_import_items set license_reviewed = $2,
         license_reviewed_by = case when $3 then (case when $2 then $4::uuid else null end) else license_reviewed_by end,
         license_reviewed_at = case when $3 then (case when $2 then now() else null end) else license_reviewed_at end,
         needs_price_review = case when $5 then false else needs_price_review end
       where id = $1 returning ${TS('updated_at')} as updated_at`,
      [input.itemId, input.licenseReviewed, reviewToggled, session.actorId, priceChanged]);
    const before = { name: product.name, categoryId: product.category_id, basePrice: product.base_price === null ? null : Number(product.base_price), licenseType: product.license_type, licenseSourceUrl: product.license_source_url, licenseReviewed: item.license_reviewed };
    const after = { name: input.name, categoryId: input.categoryId, basePrice: input.basePrice, licenseType: input.licenseType, licenseSourceUrl: input.licenseSourceUrl, licenseReviewed: input.licenseReviewed };
    await writeAuditLog(client, { actorId: session.actorId, action: 'STL_IMPORT_ITEM_UPDATED', entityType: 'product_import_item', entityId: input.itemId, beforeData: before, afterData: after });
    await writeAuditLog(client, { actorId: session.actorId, action: 'PRODUCT_UPDATED', entityType: 'product', entityId: input.productId, beforeData: before, afterData: after });
    return { itemUpdatedAt: updatedItem.rows[0].updated_at, productUpdatedAt: updatedProduct.rows[0].updated_at, live: updatedProduct.rows[0].status === 'ACTIVE' };
  }).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && (error as { message?: string }).message === 'IMPORT_LINK_BLOCKED') {
      throw new DomainError('IMPORT_APPROVED_LOCKED', 'Mẫu đã lên web phải giữ trạng thái đã kiểm tra bản quyền.', 409);
    }
    throw error;
  });
  if (result.live) invalidateStorefrontCatalog();
  return { itemUpdatedAt: result.itemUpdatedAt, productUpdatedAt: result.productUpdatedAt };
}

export async function requestRerender(session: StaffSession, rawInput: unknown) {
  requireStaff(session);
  const input = stlImportItemRefSchema.parse(rawInput);
  return withTransaction(async (client) => {
    const item = await lockItem(client, input.itemId);
    if (!item) throw new DomainError('IMPORT_ITEM_NOT_FOUND', 'Không tìm thấy mẫu nhập.', 404);
    if (item.updated_at !== input.expectedItemUpdatedAt) throw stale();
    // FR-011: published or rejected models never get new images from the script.
    if (item.review_status !== 'PENDING') throw new DomainError('NOT_PENDING', 'Chỉ làm lại ảnh cho mẫu đang chờ duyệt.', 409);
    const updated = await client.query<{ updated_at: string }>(
      `update product_import_items set needs_rerender = true where id = $1 returning ${TS('updated_at')} as updated_at`, [item.id]);
    await writeAuditLog(client, { actorId: session.actorId, action: 'STL_IMPORT_RERENDER_REQUESTED', entityType: 'product_import_item', entityId: item.id });
    return { itemUpdatedAt: updated.rows[0].updated_at };
  });
}

/** Gate pre-check (same rules as the trigger) so each blocked item gets its own readable reasons. */
async function publishReasons(client: PoolClient, item: LockedItem, product: LockedProduct): Promise<DecisionBlockReason[]> {
  const reasons: DecisionBlockReason[] = [];
  if (!item.license_reviewed) reasons.push('LICENSE_NOT_REVIEWED');
  const checks = await client.query<{ has_image: boolean; has_price: boolean }>(
    `select exists (select 1 from product_images where product_id = $1) as has_image,
       exists (select 1 from product_variants where product_id = $1 and is_active and price > 0) as has_price`, [product.id]);
  if (!checks.rows[0].has_image) reasons.push('NO_IMAGE');
  if (product.base_price === null || Number(product.base_price) <= 0 || !checks.rows[0].has_price) reasons.push('NO_PRICE');
  if (!product.category_id || product.category_slug === UNCATEGORIZED_SLUG || !product.category_active) reasons.push('UNCATEGORIZED');
  return reasons;
}

async function decide(session: StaffSession, rawInput: unknown, decision: 'APPROVE' | 'REJECT'): Promise<DecisionResult> {
  requireOwnerSession(session);
  const { items } = stlImportBulkDecisionSchema.parse(rawInput);
  const result: DecisionResult = { done: [], blocked: [] };
  const sorted = [...new Map(items.map((item) => [item.itemId, item])).values()].sort((a, b) => (a.itemId < b.itemId ? -1 : 1));
  try {
  for (const ref of sorted) {
    try {
      const outcome = await withTransaction(async (client): Promise<DecisionBlockReason[]> => {
        const item = await lockItem(client, ref.itemId);
        if (!item) return ['NOT_FOUND'];
        if (item.updated_at !== ref.expectedItemUpdatedAt) return ['STALE'];
        if (item.review_status !== 'PENDING') return ['NOT_PENDING'];
        if (decision === 'APPROVE') {
          if (item.render_status !== 'RENDERED' || !item.product_id) return ['NOT_RENDERED'];
          const product = await lockProduct(client, item.product_id);
          if (product.updated_at !== ref.expectedProductUpdatedAt) return ['STALE'];
          const reasons = await publishReasons(client, item, product);
          if (reasons.length) return reasons;
          // Item first: the products trigger requires the item to be APPROVED already.
          await client.query(`update product_import_items set review_status = 'APPROVED', reviewed_by = $2, reviewed_at = now() where id = $1`, [item.id, session.actorId]);
          await client.query(`update products set status = 'ACTIVE' where id = $1`, [product.id]);
          await writeAuditLog(client, { actorId: session.actorId, action: 'STL_IMPORT_APPROVED', entityType: 'product_import_item', entityId: item.id, afterData: { productId: product.id } });
        } else {
          await client.query(`update product_import_items set review_status = 'REJECTED', reviewed_by = $2, reviewed_at = now() where id = $1`, [item.id, session.actorId]);
          if (item.product_id) await client.query(`update products set status = 'ARCHIVED' where id = $1 and status <> 'ARCHIVED'`, [item.product_id]);
          await writeAuditLog(client, { actorId: session.actorId, action: 'STL_IMPORT_REJECTED', entityType: 'product_import_item', entityId: item.id, afterData: { productId: item.product_id } });
        }
        return [];
      });
      if (outcome.length) result.blocked.push({ itemId: ref.itemId, reasons: outcome });
      else result.done.push(ref.itemId);
    } catch (error) {
      // One bad item (gate refusal, deleted product, deadlock, dropped connection) never hides the
      // items already committed nor stops the rest of the batch.
      const reasons = publishBlockedReasons(error);
      if (!reasons) {
        const { code, message } = error as { code?: string; message?: string };
        console.error('[stl-import] decision failed', { itemId: ref.itemId, decision, code, message });
      }
      result.blocked.push({ itemId: ref.itemId, reasons: reasons ?? ['ERROR'] });
    }
  }
  } finally {
    if (result.done.length) invalidateStorefrontCatalog();
  }
  return result;
}

export function approveImportItems(session: StaffSession, rawInput: unknown) {
  return decide(session, rawInput, 'APPROVE');
}

export function rejectImportItems(session: StaffSession, rawInput: unknown) {
  return decide(session, rawInput, 'REJECT');
}
