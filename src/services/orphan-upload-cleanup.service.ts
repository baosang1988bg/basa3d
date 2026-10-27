// Phase 33 S2 (plan §8 S2, §11): signed upload tokens live 2 hours and the bucket is written to by
// anonymous visitors, so objects that never ended up on a submitted request are deleted daily.
// "Orphan" = an object under `requests/` older than ORPHAN_MIN_AGE_MS that NO
// custom_requests.attachment_path and NO custom_request_items.attachment_path references.
//
// Candidates are found in SQL against Supabase's `storage.objects` metadata table (same Postgres,
// read through the server `pg` pool as the `postgres` role), not by paging the Storage list API:
// referenced files stay in the bucket forever, so an oldest-first API scan bounded per run would
// eventually see nothing but referenced files and stall. Deletion still goes through the Storage
// API (`remove`), which deletes the underlying object — rows in storage.objects are never deleted
// directly.
import { query } from '../lib/db';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { CUSTOM_REQUEST_ATTACHMENT_BUCKET } from '../config/uploads';

export const ORPHAN_MIN_AGE_HOURS = 24;
/** Objects deleted per run (10 remove calls of 100); anything beyond waits for the next run. */
export const ORPHAN_DELETE_LIMIT = 1_000;
const REMOVE_BATCH_SIZE = 100;

export type OrphanCleanupDeps = {
  findOrphans: (limit: number) => Promise<string[]>;
  remove: (paths: string[]) => Promise<void>;
};

export type OrphanCleanupResult = { found: number; deleted: number; failedBatches: number };

/** Oldest unreferenced objects under requests/ that are older than ORPHAN_MIN_AGE_HOURS. */
export async function findOrphanUploadPaths(limit: number): Promise<string[]> {
  const result = await query<{ name: string }>(`
    select o.name
    from storage.objects o
    where o.bucket_id = $1
      and o.name like 'requests/%'
      and o.created_at < now() - ($2::int * interval '1 hour')
      and not exists (select 1 from custom_requests cr where cr.attachment_path = o.name)
      and not exists (select 1 from custom_request_items i where i.attachment_path = o.name)
    order by o.created_at
    limit $3`, [CUSTOM_REQUEST_ATTACHMENT_BUCKET, ORPHAN_MIN_AGE_HOURS, limit]);
  return result.rows.map((row) => row.name);
}

const defaultDeps: OrphanCleanupDeps = {
  findOrphans: findOrphanUploadPaths,
  async remove(paths) {
    const { error } = await createSupabaseAdminClient().storage.from(CUSTOM_REQUEST_ATTACHMENT_BUCKET).remove(paths);
    if (error) throw new Error(`storage remove failed: ${error.message}`);
  },
};

export async function cleanupOrphanUploads(options: { deps?: OrphanCleanupDeps; deleteLimit?: number } = {}): Promise<OrphanCleanupResult> {
  const deps = options.deps ?? defaultDeps;
  const orphans = await deps.findOrphans(options.deleteLimit ?? ORPHAN_DELETE_LIMIT);
  let deleted = 0;
  let failedBatches = 0;
  for (let index = 0; index < orphans.length; index += REMOVE_BATCH_SIZE) {
    const batch = orphans.slice(index, index + REMOVE_BATCH_SIZE);
    try {
      await deps.remove(batch);
      deleted += batch.length;
    } catch (error) {
      // Keep going: the remaining batches are independent; the failed ones are retried tomorrow.
      failedBatches += 1;
      console.error('[ORPHAN_UPLOAD_CLEANUP_BATCH_FAILED]', error instanceof Error ? error.message : error);
    }
  }
  const result = { found: orphans.length, deleted, failedBatches };
  console.info('[ORPHAN_UPLOAD_CLEANUP]', result);
  return result;
}

// Phase 52 P3: product images uploaded from "Đăng sản phẩm mới" go straight to Storage (signed upload
// URL) under `onboarding/<productId>/`; one that was never registered in product_images (tab closed,
// register failed) is an orphan after the same 24h. Only that prefix is swept, so importer and legacy
// uploads (`<productId>/…`, Feature 003 renders) are never touched by this job.
export const PRODUCT_IMAGE_BUCKET = 'product-images';

export async function findOrphanProductImagePaths(limit: number): Promise<string[]> {
  const result = await query<{ name: string }>(`
    select o.name
    from storage.objects o
    where o.bucket_id = $1
      and o.name like 'onboarding/%'
      and o.created_at < now() - ($2::int * interval '1 hour')
      and not exists (select 1 from product_images pi where pi.storage_path = o.name)
    order by o.created_at
    limit $3`, [PRODUCT_IMAGE_BUCKET, ORPHAN_MIN_AGE_HOURS, limit]);
  return result.rows.map((row) => row.name);
}

export async function cleanupOrphanProductImages(options: { deps?: OrphanCleanupDeps; deleteLimit?: number } = {}): Promise<OrphanCleanupResult> {
  return cleanupOrphanUploads({
    deleteLimit: options.deleteLimit,
    deps: options.deps ?? {
      findOrphans: findOrphanProductImagePaths,
      async remove(paths) {
        const { error } = await createSupabaseAdminClient().storage.from(PRODUCT_IMAGE_BUCKET).remove(paths);
        if (error) throw new Error(`storage remove failed: ${error.message}`);
      },
    },
  });
}
