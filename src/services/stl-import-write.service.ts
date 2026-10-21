// Feature 003 (FR-009..FR-014, research R3/R8): writes one imported model per transaction. Called by
// scripts/stl-import/import-stl.ts on the OWNER's machine — no Next.js imports here. Imported products
// are always DRAFT, so the storefront cache needs no invalidation from this path.
//
// Order per model: upload the NEW images → one transaction (lock item, upsert item/product/variant,
// replace product_images, audit) → after commit remove the OLD images. If the transaction fails, the
// new uploads are removed, so a failure never leaves an orphan nor deletes an image still in use.
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { withTransaction } from '../lib/db';
import { buildSku, uniqueSlug } from '../lib/stl-import/naming';
import { fingerprintFiles, sameFingerprint, type SourceFile } from '../lib/stl-import/source-key';
import type { ModelAnalysis, ImportWarning } from '../lib/stl-import/metrics';
import type { ImportPrice } from '../lib/stl-import/pricing';
import type { GroupMode } from '../lib/stl-import/scan';
import { UNCATEGORIZED_SLUG } from '../lib/stl-import/category-map';
import { writeAuditLog } from './audit.service';

export const PRODUCT_IMAGE_BUCKET = 'product-images';
export const PROCESS_ERROR_MAX = 2_000;
const SYSTEM_IMPORT_ACTOR = 'system-import';

export type ImageStore = {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(paths: string[]): Promise<void>;
};

export type ImportAction = 'CREATE' | 'RERENDER' | 'SOURCE_CHANGED' | 'SKIP';

export type ExistingImportItem = {
  id: string;
  productId: string | null;
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  renderStatus: 'PENDING' | 'RENDERED' | 'ERROR';
  needsRerender: boolean;
  sourceFiles: SourceFile[];
};

export type ImportModelInput = {
  sourceKey: string;
  sourceRelPath: string;
  sourceDir: string;
  groupMode: GroupMode;
  files: SourceFile[];
  analysis: ModelAnalysis;
  extraWarnings: ImportWarning[];
  name: string;
  description: string;
  categorySlug: string;
  skuCode: string;
  price: ImportPrice;
  /** Rendered WebP images, cover first. Empty when analysis failed. */
  images: Uint8Array[];
};

export type ImportResult = { action: ImportAction | 'ERROR'; itemId: string | null; productId: string | null; slug?: string; sku?: string; error?: string };

type Db = Pool | PoolClient;

export async function findImportItem(db: Db, sourceKey: string): Promise<ExistingImportItem | null> {
  const result = await db.query<ExistingImportItem>(
    `select id, product_id as "productId", review_status as "reviewStatus", render_status as "renderStatus",
       needs_rerender as "needsRerender", source_files as "sourceFiles"
     from public.product_import_items where source_key = $1`, [sourceKey]);
  return result.rows[0] ?? null;
}

/** What a run would do with this model — decided before rendering, so SKIPs cost no render. */
export function planImport(existing: ExistingImportItem | null, files: SourceFile[], options: { retryErrors?: boolean } = {}): ImportAction {
  if (!existing) return 'CREATE';
  if (existing.reviewStatus === 'REJECTED') return 'SKIP';
  const changed = !sameFingerprint(existing.sourceFiles, files);
  if (existing.reviewStatus === 'APPROVED') return changed ? 'SOURCE_CHANGED' : 'SKIP';
  const retry = changed || existing.needsRerender || (existing.renderStatus === 'ERROR' && options.retryErrors === true);
  // A PENDING item without product: a failed first import, or its product was deleted.
  if (!existing.productId) return existing.renderStatus === 'ERROR' && !retry ? 'SKIP' : 'CREATE';
  return retry ? 'RERENDER' : 'SKIP';
}

function truncateError(message: string): string {
  return message.slice(0, PROCESS_ERROR_MAX);
}

function sourceColumns(model: ImportModelInput) {
  const files = fingerprintFiles(model.files);
  return {
    files,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    mtime: new Date(files.reduce((max, file) => Math.max(max, file.mtimeMs), 0)),
  };
}

async function takenValues(client: PoolClient, table: 'products' | 'product_variants', column: 'slug' | 'sku', base: string): Promise<Set<string>> {
  const result = await client.query<{ value: string }>(
    `select ${column} as value from public.${table} where ${column} = $1 or ${column} like $2`,
    [base, `${base.slice(0, 30).replace(/[%_\\]/g, '\\$&')}%`],
  );
  return new Set(result.rows.map((row) => row.value));
}

async function categoryIdFor(client: PoolClient, slug: string): Promise<string | null> {
  const result = await client.query<{ id: string; slug: string }>(
    'select id, slug from public.categories where slug = any($1::text[])', [[slug, UNCATEGORIZED_SLUG]]);
  return (result.rows.find((row) => row.slug === slug) ?? result.rows.find((row) => row.slug === UNCATEGORIZED_SLUG))?.id ?? null;
}

async function uploadAll(store: ImageStore, productId: string, images: Uint8Array[]): Promise<string[]> {
  const uploaded: string[] = [];
  try {
    for (const bytes of images) {
      const path = `${productId}/${randomUUID()}.webp`;
      await store.upload(path, bytes, 'image/webp');
      uploaded.push(path);
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) await store.remove(uploaded).catch(() => undefined);
    throw error;
  }
}

async function insertImages(client: PoolClient, productId: string, paths: string[], name: string) {
  for (const [index, path] of paths.entries()) {
    await client.query(
      'insert into public.product_images (product_id, storage_path, alt_text, sort_order) values ($1, $2, $3, $4)',
      [productId, path, name.slice(0, 200), index]);
  }
}

/** Records a model whose mesh could not be read: an item with render_status ERROR, no new product. */
async function recordError(db: Pool, model: ImportModelInput, message: string): Promise<ImportResult> {
  const source = sourceColumns(model);
  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string; product_id: string | null; review_status: string }>(
      'select id, product_id, review_status from public.product_import_items where source_key = $1 for update', [model.sourceKey]);
    const row = existing.rows[0];
    if (row && row.review_status !== 'PENDING') return { action: 'SKIP' as const, itemId: row.id, productId: row.product_id };
    const result = row
      ? await client.query<{ id: string }>(
        `update public.product_import_items set render_status = 'ERROR', process_error = $2, source_files = $3, source_bytes = $4,
           source_mtime = $5, needs_rerender = false where id = $1 returning id`,
        [row.id, truncateError(message), JSON.stringify(source.files), source.bytes, source.mtime])
      : await client.query<{ id: string }>(
        `insert into public.product_import_items (source_key, source_rel_path, source_dir, group_mode, source_files, source_bytes, source_mtime,
           render_status, process_error, warnings)
         values ($1, $2, $3, $4, $5, $6, $7, 'ERROR', $8, $9) returning id`,
        [model.sourceKey, model.sourceRelPath, model.sourceDir, model.groupMode, JSON.stringify(source.files), source.bytes, source.mtime,
          truncateError(message), JSON.stringify(model.extraWarnings)]);
    await writeAuditLog(client, { actorId: null, action: 'STL_IMPORT_ITEM_FAILED', entityType: 'product_import_item', entityId: result.rows[0].id, afterData: { actor: SYSTEM_IMPORT_ACTOR, error: truncateError(message) } });
    return { action: 'ERROR' as const, itemId: result.rows[0].id, productId: row?.product_id ?? null, error: message };
  });
}

/**
 * Applies `action` (from planImport) for one model. Never writes inventory_movements (FR-009).
 * The action is re-checked under the row lock, so a concurrent admin decision wins.
 */
export async function applyImport(db: Pool, store: ImageStore, model: ImportModelInput, action: ImportAction): Promise<ImportResult> {
  if (action === 'SKIP') return { action, itemId: null, productId: null };
  if (action === 'SOURCE_CHANGED') return markSourceChanged(db, model);
  if (!model.analysis.ok) return recordError(db, model, model.analysis.error);
  if (!model.images.length) return recordError(db, model, 'RENDER_FAILED: không tạo được ảnh.');
  const analysis = model.analysis;
  const existing = await findImportItem(db, model.sourceKey);
  const productId = action === 'RERENDER' && existing?.productId ? existing.productId : randomUUID();
  const uploaded = await uploadAll(store, productId, model.images);
  let oldPaths: string[] = [];
  try {
    const result = await withTransaction(async (client) => {
      const locked = await client.query<{ id: string; product_id: string | null; review_status: string }>(
        'select id, product_id, review_status from public.product_import_items where source_key = $1 for update', [model.sourceKey]);
      const row = locked.rows[0];
      if (row && row.review_status !== 'PENDING') return { action: 'SKIP' as const, itemId: row.id, productId: row.product_id };
      // Planned against a stale read (another run linked a product meanwhile): never create a second one.
      if (row?.product_id && row.product_id !== productId) return { action: 'SKIP' as const, itemId: row.id, productId: row.product_id };
      const source = sourceColumns(model);
      const warnings = [...new Set([...analysis.warnings, ...model.extraWarnings, ...(model.price.priced ? [] : ['UNPRICED' as const])])];
      const metrics = [JSON.stringify(analysis.bboxMm), analysis.volumeCm3, analysis.triangles, JSON.stringify(warnings)];

      if (row?.product_id && row.product_id === productId) {
        // RERENDER: new images + metrics; name/category/price/license/description stay as the admin left them.
        await client.query('select id from public.products where id = $1 for update', [productId]);
        oldPaths = (await client.query<{ storage_path: string }>('delete from public.product_images where product_id = $1 returning storage_path', [productId])).rows.map((r) => r.storage_path);
        await insertImages(client, productId, uploaded, model.name);
        await client.query(
          `update public.product_import_items set bbox_mm = $2, volume_cm3 = $3, triangle_count = $4, warnings = $5, render_status = 'RENDERED',
             process_error = null, needs_rerender = false, needs_price_review = true, source_files = $6, source_bytes = $7, source_mtime = $8
           where id = $1`,
          [row.id, ...metrics, JSON.stringify(source.files), source.bytes, source.mtime]);
        await writeAuditLog(client, { actorId: null, action: 'STL_IMPORT_ITEM_RERENDERED', entityType: 'product_import_item', entityId: row.id, afterData: { actor: SYSTEM_IMPORT_ACTOR, productId, images: uploaded.length } });
        return { action: 'RERENDER' as const, itemId: row.id, productId };
      }

      // CREATE (also re-creates the product of a PENDING item whose product was deleted).
      const categoryId = await categoryIdFor(client, model.categorySlug);
      const slugBase = uniqueSlug(model.name, () => false);
      const slugsTaken = await takenValues(client, 'products', 'slug', slugBase);
      const slug = uniqueSlug(model.name, (value) => slugsTaken.has(value));
      const skuBase = buildSku(model.skuCode, slug, () => false);
      const skusTaken = await takenValues(client, 'product_variants', 'sku', skuBase);
      const sku = buildSku(model.skuCode, slug, (value) => skusTaken.has(value));
      const price = model.price.priced ? model.price : null;
      await client.query(
        `insert into public.products (id, category_id, name, slug, description, product_type, status, base_price, pricing_breakdown, pricing_config_id, license_type)
         values ($1, $2, $3, $4, $5, 'MADE_TO_ORDER', 'DRAFT', $6, $7, $8, 'UNKNOWN')`,
        [productId, categoryId, model.name, slug, model.description, price?.basePrice ?? null, price ? JSON.stringify(price.breakdown) : null, price?.pricingConfigId ?? null]);
      await client.query(
        `insert into public.product_variants (product_id, sku, name, price) values ($1, $2, 'Mặc định', $3)`,
        [productId, sku, price?.basePrice ?? 0]);
      await insertImages(client, productId, uploaded, model.name);
      const item = row
        ? await client.query<{ id: string }>(
          `update public.product_import_items set product_id = $2, bbox_mm = $3, volume_cm3 = $4, triangle_count = $5, warnings = $6,
             render_status = 'RENDERED', process_error = null, needs_rerender = false, needs_price_review = true,
             source_files = $7, source_bytes = $8, source_mtime = $9 where id = $1 returning id`,
          [row.id, productId, ...metrics, JSON.stringify(source.files), source.bytes, source.mtime])
        : await client.query<{ id: string }>(
          `insert into public.product_import_items (product_id, source_key, source_rel_path, source_dir, group_mode, source_files, source_bytes,
             source_mtime, bbox_mm, volume_cm3, triangle_count, warnings, render_status)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'RENDERED') returning id`,
          [productId, model.sourceKey, model.sourceRelPath, model.sourceDir, model.groupMode, JSON.stringify(source.files), source.bytes,
            source.mtime, ...metrics]);
      await writeAuditLog(client, {
        actorId: null, action: 'STL_IMPORT_ITEM_CREATED', entityType: 'product_import_item', entityId: item.rows[0].id,
        afterData: { actor: SYSTEM_IMPORT_ACTOR, productId, slug, sku, basePrice: price?.basePrice ?? null, images: uploaded.length },
      });
      return { action: 'CREATE' as const, itemId: item.rows[0].id, productId, slug, sku };
    });
    if (result.action === 'SKIP') await store.remove(uploaded).catch(() => undefined);
    else if (oldPaths.length) await store.remove(oldPaths).catch(() => undefined);
    return result;
  } catch (error) {
    await store.remove(uploaded).catch(() => undefined);
    throw error;
  }
}

/** FR-011: a published product keeps its public images/price; only the item is flagged for review. */
async function markSourceChanged(db: Pool, model: ImportModelInput): Promise<ImportResult> {
  const source = sourceColumns(model);
  return withTransaction(async (client) => {
    const locked = await client.query<{ id: string; product_id: string | null; review_status: string }>(
      'select id, product_id, review_status from public.product_import_items where source_key = $1 for update', [model.sourceKey]);
    const row = locked.rows[0];
    if (!row || row.review_status !== 'APPROVED') return { action: 'SKIP' as const, itemId: row?.id ?? null, productId: row?.product_id ?? null };
    await client.query(
      'update public.product_import_items set source_changed_at = now(), source_files = $2, source_bytes = $3, source_mtime = $4 where id = $1',
      [row.id, JSON.stringify(source.files), source.bytes, source.mtime]);
    await writeAuditLog(client, { actorId: null, action: 'STL_IMPORT_SOURCE_CHANGED', entityType: 'product_import_item', entityId: row.id, afterData: { actor: SYSTEM_IMPORT_ACTOR, files: source.files.length } });
    return { action: 'SOURCE_CHANGED' as const, itemId: row.id, productId: row.product_id };
  });
}
