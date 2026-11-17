// Feature 003 extension: transactional writer for JSON bundles exported from D:\3D_Catalog.
// Always creates DRAFT MADE_TO_ORDER products with multi-variant profiles + WebP preview images,
// never uploads source .3mf/.stl files, and never writes inventory movements.
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { withTransaction } from '../lib/db';
import { uniqueSlug } from '../lib/catalog/naming';
import {
  buildProductDescription,
  buildVariantSkus,
  type CatalogExportItem,
} from '../lib/stl-import/json-bundle';
import { UNCATEGORIZED_SLUG } from '../lib/stl-import/category-map';
import { writeAuditLog } from './audit.service';
import { findImportItem, type ImageStore } from './stl-import-write.service';

const SYSTEM_ACTOR = 'catalog-json-import';

export type JsonImportResult = {
  sourceKey: string;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR';
  itemId: string | null;
  productId: string | null;
  slug: string | null;
  sku: string | null;
  variantsCount: number;
  error?: string;
};

async function takenValues(
  client: PoolClient,
  table: 'products' | 'product_variants',
  column: 'slug' | 'sku',
  base: string,
): Promise<Set<string>> {
  const res = await client.query<{ value: string }>(
    `select ${column} as value from public.${table} where ${column} = $1 or ${column} like $2`,
    [base, `${base.slice(0, 28).replace(/[%_\\]/g, '\\$&')}%`],
  );
  return new Set(res.rows.map((r) => r.value));
}

async function ensureCategoryId(
  client: PoolClient,
  slug: string,
  name: string,
): Promise<string | null> {
  const found = await client.query<{ id: string }>(
    'select id from public.categories where slug = $1',
    [slug],
  );
  if (found.rows[0]) return found.rows[0].id;

  if (slug !== UNCATEGORIZED_SLUG) {
    const inserted = await client.query<{ id: string }>(
      `insert into public.categories (name, slug, sort_order, is_active)
       values ($1, $2, 100, true)
       on conflict (slug) do update set name = public.categories.name
       returning id`,
      [name.slice(0, 160), slug],
    );
    if (inserted.rows[0]) return inserted.rows[0].id;
  }

  const fallback = await client.query<{ id: string }>(
    'select id from public.categories where slug = $1',
    [UNCATEGORIZED_SLUG],
  );
  return fallback.rows[0]?.id ?? null;
}

async function uploadWebpImages(store: ImageStore, productId: string, images: Uint8Array[]): Promise<string[]> {
  const uploaded: string[] = [];
  try {
    for (const bytes of images) {
      const storagePath = `${productId}/${randomUUID()}.webp`;
      await store.upload(storagePath, bytes, 'image/webp');
      uploaded.push(storagePath);
    }
    return uploaded;
  } catch (err) {
    if (uploaded.length) await store.remove(uploaded).catch(() => undefined);
    throw err;
  }
}

async function insertProductImages(client: PoolClient, productId: string, paths: string[], name: string) {
  for (const [idx, storagePath] of paths.entries()) {
    await client.query(
      'insert into public.product_images (product_id, storage_path, alt_text, sort_order) values ($1, $2, $3, $4)',
      [productId, storagePath, name.slice(0, 200), idx],
    );
  }
}

function toBboxObject(sizeMm: CatalogExportItem['sizeMm']) {
  if (!sizeMm) return null;
  return { x: sizeMm[0], y: sizeMm[1], z: sizeMm[2] };
}

function parseMtime(raw: string): Date {
  if (!raw) return new Date();
  const d = new Date(raw.replace(' ', 'T') + (raw.includes('T') || raw.includes('Z') ? '' : '+07:00'));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function applyCatalogJsonItem(
  db: Pool,
  store: ImageStore,
  item: CatalogExportItem,
  webpImages: Uint8Array[],
): Promise<JsonImportResult> {
  const existing = await findImportItem(db, item.sourceKey);
  if (existing && (existing.reviewStatus === 'APPROVED' || existing.reviewStatus === 'REJECTED')) {
    return {
      sourceKey: item.sourceKey,
      action: 'SKIP',
      itemId: existing.id,
      productId: existing.productId,
      slug: null,
      sku: null,
      variantsCount: item.variants.length,
    };
  }

  const productId = existing?.productId ?? randomUUID();
  const uploadedPaths = webpImages.length ? await uploadWebpImages(store, productId, webpImages) : [];
  let oldImagePaths: string[] = [];

  try {
    const res = await withTransaction(async (client) => {
      const locked = await client.query<{ id: string; product_id: string | null; review_status: string }>(
        'select id, product_id, review_status from public.product_import_items where source_key = $1 for update',
        [item.sourceKey],
      );
      const row = locked.rows[0];
      if (row && (row.review_status === 'APPROVED' || row.review_status === 'REJECTED')) {
        return { action: 'SKIP' as const, itemId: row.id, productId: row.product_id, slug: null, sku: null };
      }

      const categoryId = await ensureCategoryId(client, item.categorySlug, item.categoryName);
      const activeCfgRes = item.pricingBreakdown
        ? await client.query<{ id: string }>(
          `select id from public.pricing_configs
            where effective_from <= now()
            order by effective_from desc, created_at desc limit 1`,
        )
        : null;
      const pricingConfigId = activeCfgRes?.rows[0]?.id ?? null;
      // Check constraint `products_pricing_snapshot_pair` requires both breakdown and config_id null or both non-null.
      const pricingBreakdownJson = (item.pricingBreakdown && pricingConfigId)
        ? JSON.stringify(item.pricingBreakdown)
        : null;
      const sourceFilesJson = JSON.stringify([{
        relPath: item.sourceRelPath,
        bytes: item.sourceBytes,
        mtimeMs: parseMtime(item.sourceMtime).getTime(),
      }]);
      const mtimeDate = parseMtime(item.sourceMtime);
      const bboxObj = toBboxObject(item.sizeMm);
      const description = buildProductDescription(item);
      const warnings: string[] = [];
      if (!webpImages.length) warnings.push('MISSING_IMAGE');
      if (!item.basePriceVnd) warnings.push('UNPRICED');

      // Existing DRAFT product -> refresh specs, variants & images cleanly
      if (row?.product_id) {
        const pRes = await client.query<{ slug: string; status: string }>(
          'select slug, status from public.products where id = $1 for update',
          [row.product_id],
        );
        const curProd = pRes.rows[0];
        if (!curProd || curProd.status !== 'DRAFT') {
          return { action: 'SKIP' as const, itemId: row.id, productId: row.product_id, slug: curProd?.slug ?? null, sku: null };
        }

        await client.query(
          `update public.products
              set category_id = coalesce($2, category_id),
                  name = $3,
                  description = $4,
                  base_price = $5,
                  pricing_breakdown = $6,
                  pricing_config_id = $7
            where id = $1`,
          [
            row.product_id,
            categoryId,
            item.name,
            description,
            item.basePriceVnd ?? null,
            pricingBreakdownJson,
            pricingConfigId,
          ],
        );

        if (uploadedPaths.length) {
          oldImagePaths = (
            await client.query<{ storage_path: string }>(
              'delete from public.product_images where product_id = $1 returning storage_path',
              [row.product_id],
            )
          ).rows.map((r) => r.storage_path);
          await insertProductImages(client, row.product_id, uploadedPaths, item.name);
        }

        // Refresh variants if none are referenced by cart/orders
        const refCheck = await client.query<{ cnt: string }>(
          `select count(*)::text as cnt from public.product_variants pv
            where pv.product_id = $1
              and (exists (select 1 from public.cart_items ci where ci.variant_id = pv.id)
                or exists (select 1 from public.order_items oi where oi.variant_id = pv.id))`,
          [row.product_id],
        );
        let primarySku: string | null = null;
        if (Number(refCheck.rows[0]?.cnt || 0) === 0) {
          await client.query('delete from public.product_variants where product_id = $1', [row.product_id]);
          const takenSkus = await takenValues(client, 'product_variants', 'sku', `${item.skuCode}-${curProd.slug.toUpperCase()}`);
          const skus = buildVariantSkus(item.skuCode, curProd.slug, item.variants.length, (s) => takenSkus.has(s));
          primarySku = skus[0] ?? null;
          for (const [idx, v] of item.variants.entries()) {
            await client.query(
              `insert into public.product_variants (product_id, sku, name, attributes, price, cost_price, weight_grams)
               values ($1, $2, $3, $4, $5, $6, $7)`,
              [
                row.product_id,
                skus[idx],
                v.name,
                JSON.stringify(v.attributes),
                v.priceVnd,
                v.costPriceVnd ?? null,
                v.weightGrams ?? null,
              ],
            );
          }
        }

        await client.query(
          `update public.product_import_items
              set source_rel_path = $2, source_dir = $3, group_mode = $4, source_files = $5,
                  source_bytes = $6, source_mtime = $7, bbox_mm = $8, volume_cm3 = $9,
                  triangle_count = $10, warnings = $11, render_status = 'RENDERED',
                  process_error = null, needs_price_review = true
            where id = $1`,
          [
            row.id,
            item.sourceRelPath,
            item.sourceDir,
            item.groupMode,
            sourceFilesJson,
            item.sourceBytes,
            mtimeDate,
            bboxObj ? JSON.stringify(bboxObj) : null,
            item.volumeCm3 ?? null,
            item.triangles ?? null,
            JSON.stringify(warnings),
          ],
        );
        await writeAuditLog(client, {
          actorId: null,
          action: 'CATALOG_JSON_ITEM_UPDATED',
          entityType: 'product_import_item',
          entityId: row.id,
          afterData: { actor: SYSTEM_ACTOR, productId: row.product_id, variants: item.variants.length },
        });
        return { action: 'UPDATE' as const, itemId: row.id, productId: row.product_id, slug: curProd.slug, sku: primarySku };
      }

      // Create fresh DRAFT product + multi-variants
      const draftSlug = uniqueSlug(item.name, () => false);
      const takenSlugs = await takenValues(client, 'products', 'slug', draftSlug);
      const slug = uniqueSlug(item.name, (s) => takenSlugs.has(s));

      const baseSkuHint = `${item.skuCode}-${slug.toUpperCase()}`;
      const takenSkus = await takenValues(client, 'product_variants', 'sku', baseSkuHint);
      const skus = buildVariantSkus(item.skuCode, slug, item.variants.length, (s) => takenSkus.has(s));

      await client.query(
        `insert into public.products
           (id, category_id, name, slug, description, product_type, status, base_price, pricing_breakdown, pricing_config_id, license_type)
         values ($1, $2, $3, $4, $5, 'MADE_TO_ORDER', 'DRAFT', $6, $7, $8, 'UNKNOWN')`,
        [
          productId,
          categoryId,
          item.name,
          slug,
          description,
          item.basePriceVnd ?? null,
          pricingBreakdownJson,
          pricingConfigId,
        ],
      );

      for (const [idx, v] of item.variants.entries()) {
        await client.query(
          `insert into public.product_variants (product_id, sku, name, attributes, price, cost_price, weight_grams)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            productId,
            skus[idx],
            v.name,
            JSON.stringify(v.attributes),
            v.priceVnd,
            v.costPriceVnd ?? null,
            v.weightGrams ?? null,
          ],
        );
      }

      if (uploadedPaths.length) {
        await insertProductImages(client, productId, uploadedPaths, item.name);
      }

      const itemRow = row
        ? await client.query<{ id: string }>(
          `update public.product_import_items
              set product_id = $2, bbox_mm = $3, volume_cm3 = $4, triangle_count = $5,
                  warnings = $6, render_status = 'RENDERED', process_error = null,
                  needs_price_review = true, source_files = $7, source_bytes = $8, source_mtime = $9
            where id = $1 returning id`,
          [
            row.id,
            productId,
            bboxObj ? JSON.stringify(bboxObj) : null,
            item.volumeCm3 ?? null,
            item.triangles ?? null,
            JSON.stringify(warnings),
            sourceFilesJson,
            item.sourceBytes,
            mtimeDate,
          ],
        )
        : await client.query<{ id: string }>(
          `insert into public.product_import_items
             (product_id, source_key, source_rel_path, source_dir, group_mode, source_files,
              source_bytes, source_mtime, bbox_mm, volume_cm3, triangle_count, warnings, render_status)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'RENDERED') returning id`,
          [
            productId,
            item.sourceKey,
            item.sourceRelPath,
            item.sourceDir,
            item.groupMode,
            sourceFilesJson,
            item.sourceBytes,
            mtimeDate,
            bboxObj ? JSON.stringify(bboxObj) : null,
            item.volumeCm3 ?? null,
            item.triangles ?? null,
            JSON.stringify(warnings),
          ],
        );

      await writeAuditLog(client, {
        actorId: null,
        action: 'CATALOG_JSON_ITEM_CREATED',
        entityType: 'product_import_item',
        entityId: itemRow.rows[0].id,
        afterData: {
          actor: SYSTEM_ACTOR,
          productId,
          slug,
          sku: skus[0] ?? null,
          variants: item.variants.length,
          basePrice: item.basePriceVnd ?? null,
          images: uploadedPaths.length,
        },
      });

      return {
        action: 'CREATE' as const,
        itemId: itemRow.rows[0].id,
        productId,
        slug,
        sku: skus[0] ?? null,
      };
    });

    if (res.action === 'SKIP' && uploadedPaths.length) {
      await store.remove(uploadedPaths).catch(() => undefined);
    } else if (oldImagePaths.length) {
      await store.remove(oldImagePaths).catch(() => undefined);
    }

    return {
      sourceKey: item.sourceKey,
      ...res,
      variantsCount: item.variants.length,
    };
  } catch (err) {
    if (uploadedPaths.length) await store.remove(uploadedPaths).catch(() => undefined);
    throw err;
  }
}
