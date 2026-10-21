// Feature 003 test fixtures: an imported product (category, product, variant, image, import item) and
// staff profiles, inserted straight into the disposable local test DB. Call after configureTestEnvironment().
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { sourceKey } from '../../src/lib/stl-import/source-key';

type Db = Pool | PoolClient;

export type ImportedFixture = { productId: string; itemId: string; variantId: string; categoryId: string; sourceRelPath: string; tag: string };

export async function createStaff(db: Db, role: 'OWNER' | 'STAFF'): Promise<string> {
  const id = randomUUID();
  await db.query('insert into auth.users (id) values ($1)', [id]);
  await db.query('insert into staff_profiles (id, full_name, role) values ($1, $2, $3)', [id, `STL ${role} ${id.slice(0, 6)}`, role]);
  return id;
}

export async function deleteStaff(db: Db, ids: string[]): Promise<void> {
  await db.query('delete from staff_profiles where id = any($1::uuid[])', [ids]);
  await db.query('delete from auth.users where id = any($1::uuid[])', [ids]);
}

export async function uncategorizedId(db: Db): Promise<string> {
  return (await db.query<{ id: string }>(`select id from categories where slug = 'chua-phan-loai'`)).rows[0].id;
}

/** Defaults satisfy every gate condition except APPROVED; override to break one at a time. */
export async function seedImportedProduct(db: Db, options: {
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  licenseReviewed?: boolean;
  withImage?: boolean;
  basePrice?: number | null;
  variantPrice?: number;
  uncategorized?: boolean;
  status?: 'DRAFT' | 'ARCHIVED';
  sourceDir?: string;
} = {}): Promise<ImportedFixture> {
  const tag = `stl${randomUUID().slice(0, 8)}`;
  const categoryId = options.uncategorized
    ? await uncategorizedId(db)
    : (await db.query<{ id: string }>(`insert into categories (name, slug) values ($1, $1) returning id`, [`${tag}-cat`])).rows[0].id;
  const basePrice = options.basePrice === undefined ? 50_000 : options.basePrice;
  const productId = (await db.query<{ id: string }>(
    `insert into products (category_id, name, slug, product_type, status, base_price, license_type)
     values ($1, $2, $2, 'MADE_TO_ORDER', $3, $4, 'UNKNOWN') returning id`,
    [categoryId, tag, options.status ?? 'DRAFT', basePrice],
  )).rows[0].id;
  const variantId = (await db.query<{ id: string }>(
    `insert into product_variants (product_id, sku, name, price) values ($1, $2, 'Mặc định', $3) returning id`,
    [productId, `UNC-${tag.toUpperCase()}`, options.variantPrice ?? basePrice ?? 0],
  )).rows[0].id;
  if (options.withImage ?? true) {
    await db.query(`insert into product_images (product_id, storage_path, sort_order) values ($1, $2, 0)`, [productId, `${productId}/${randomUUID()}.webp`]);
  }
  const sourceDir = options.sourceDir ?? `Fixtures/${tag}`;
  const sourceRelPath = `${sourceDir}/${tag}-SECRET-SOURCE`;
  const reviewStatus = options.reviewStatus ?? 'PENDING';
  const itemId = (await db.query<{ id: string }>(
    `insert into product_import_items (product_id, source_key, source_rel_path, source_dir, group_mode, source_files, source_bytes, source_mtime,
       bbox_mm, volume_cm3, triangle_count, render_status, license_reviewed, review_status, reviewed_at)
     values ($1, $2, $3, $4, 'FOLDER', $5, 100, now(), '{"x":10,"y":10,"z":10}', 1, 12, 'RENDERED', $6, $7, $8) returning id`,
    [productId, sourceKey(sourceRelPath), sourceRelPath, sourceDir, JSON.stringify([{ relPath: `${sourceRelPath}/a.stl`, bytes: 100, mtimeMs: 1 }]),
      options.licenseReviewed ?? true, reviewStatus, reviewStatus === 'PENDING' ? null : new Date()],
  )).rows[0].id;
  return { productId, itemId, variantId, categoryId, sourceRelPath, tag };
}

export async function cleanupImported(db: Db, fixtures: ImportedFixture[]): Promise<void> {
  const productIds = fixtures.map((fixture) => fixture.productId);
  await db.query('delete from product_import_items where id = any($1::uuid[]) or product_id = any($2::uuid[])', [fixtures.map((fixture) => fixture.itemId), productIds]);
  await db.query('delete from product_images where product_id = any($1::uuid[])', [productIds]);
  await db.query('delete from product_variants where product_id = any($1::uuid[])', [productIds]);
  await db.query('delete from products where id = any($1::uuid[])', [productIds]);
  await db.query(`delete from categories where slug = any($1::text[])`, [fixtures.map((fixture) => `${fixture.tag}-cat`)]);
}
