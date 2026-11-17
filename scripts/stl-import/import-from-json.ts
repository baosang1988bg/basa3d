// Import BaSa3D DRAFT products from local 3D Catalog JSON export (multi-variant, preview WebP only).
//
//   npx tsx --env-file=.env.local scripts/stl-import/import-from-json.ts --json "<export.json>" [--out "<manifest.json>"] [--limit 50]
//   ... add --apply to upload preview .webp images and upsert DRAFT products into dev PostgreSQL.
//
// Never uploads .3mf/.stl source files — only preview images converted to .webp.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type { PoolClient } from 'pg';
import sharp from 'sharp';
import { getPool } from '../../src/lib/db';
import {
  buildVariantSkus,
  catalogExportBundleSchema,
  computeJsonBundleSlug,
  type CatalogExportItem,
} from '../../src/lib/stl-import/json-bundle';
import {
  applyCatalogJsonItem,
  type JsonImportResult,
} from '../../src/services/catalog-json-import.service';
import {
  findImportItem,
  PRODUCT_IMAGE_BUCKET,
  type ImageStore,
} from '../../src/services/stl-import-write.service';
import {
  getBucketUsageBytes,
  STORAGE_BLOCK_BYTES,
  STORAGE_WARN_BYTES,
} from '../../src/services/storage-usage.service';

const EXIT = { OK: 0, CONFIG: 1, USAGE: 2, STORAGE: 3 } as const;
const AVG_IMAGE_BYTES = 120 * 1024;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const VALUE_FLAGS = ['json', 'out', 'limit', 'size'] as const;
const BOOLEAN_FLAGS = ['apply', 'dry-run', 'allow-storage-over', 'help'] as const;

class UsageError extends Error {}

export type JsonImportOptions = {
  jsonFile: string;
  outPath: string;
  limit: number;
  size: number;
  apply: boolean;
  allowStorageOver: boolean;
};

export type JsonImportTotals = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

export type JsonImportManifest = {
  schemaVersion: string;
  runAt: string;
  applied: boolean;
  sourceJson: string;
  totals: JsonImportTotals;
  bucketUsageBytesBefore: number | null;
  storageWarning: string | null;
  items: JsonImportResult[];
};

const USAGE_TEXT = [
  'Cách dùng:',
  '  npx tsx --env-file=.env.local scripts/stl-import/import-from-json.ts --json <file.json> [tuỳ chọn]',
  '',
  'Tuỳ chọn:',
  '  --json <path>           File JSON xuất từ D:\\3D_Catalog (bắt buộc)',
  '  --out <path>            File manifest.json đầu ra (hoặc thư mục chứa manifest.json)',
  '  --limit <n>             Giới hạn số sản phẩm xử lý',
  '  --size <px>             Kích thước tối đa cạnh ảnh WebP (mặc định 1200)',
  '  --apply                 Ghi DB thật & upload ảnh preview WebP (mặc định là dry-run)',
  '  --dry-run               Chạy thử, không ghi DB / không upload ảnh',
  '  --allow-storage-over    Cho phép vượt ngưỡng ước tính 950 MB bucket',
  '  --help                  Hiện hướng dẫn',
].join('\n');

export function parseJsonImportArgs(argv: string[]): JsonImportOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new UsageError(`Tham số lạ: ${arg}`);
    const name = arg.slice(2);
    if ((BOOLEAN_FLAGS as readonly string[]).includes(name)) {
      flags.add(name);
    } else if ((VALUE_FLAGS as readonly string[]).includes(name)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError(`--${name} cần một giá trị`);
      }
      values.set(name, value);
      i += 1;
    } else {
      throw new UsageError(`Cờ không hợp lệ: --${name}`);
    }
  }

  if (flags.has('help')) throw new UsageError('');
  if (flags.has('apply') && flags.has('dry-run')) {
    throw new UsageError('Không thể dùng đồng thời --apply và --dry-run');
  }

  const jsonRaw = values.get('json');
  if (!jsonRaw) throw new UsageError('Thiếu --json <file.json>');

  const parseNum = (name: string, fallback: number, min: number): number => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < min) {
      throw new UsageError(`--${name} phải là số ≥ ${min}`);
    }
    return num;
  };

  const outRaw = values.get('out') ?? '.stl-import/json-manifest.json';
  const resolvedOut = outRaw.toLowerCase().endsWith('.json')
    ? path.resolve(outRaw)
    : path.resolve(outRaw, 'manifest.json');

  return {
    jsonFile: path.resolve(jsonRaw),
    outPath: resolvedOut,
    limit: parseNum('limit', Infinity, 1),
    size: parseNum('size', 1200, 256),
    apply: flags.has('apply'),
    allowStorageOver: flags.has('allow-storage-over'),
  };
}

function assertSafeEnvironment(): void {
  if (process.env.BASA3D_TEST_ENVIRONMENT !== 'isolated') return;
  for (const name of ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const) {
    const url = process.env[name];
    if (url && !LOCAL_HOSTS.has(new URL(url).hostname)) {
      throw new Error(`Môi trường test chỉ được dùng database local (${name}).`);
    }
  }
}

function supabaseImageStore(): ImageStore {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('--apply cần NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong môi trường.');
  }
  const bucket = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).storage.from(PRODUCT_IMAGE_BUCKET);

  return {
    async upload(objectPath, bytes, contentType) {
      const { error } = await bucket.upload(objectPath, bytes, { contentType, upsert: false });
      if (error) throw new Error(`IMAGE_UPLOAD_FAILED: ${error.message}`);
    },
    async remove(paths) {
      if (!paths.length) return;
      const { error } = await bucket.remove(paths);
      if (error) console.warn(`  không xoá được ${paths.length} ảnh: ${error.message}`);
    },
  };
}

async function convertImageFileToWebp(filePath: string, maxSize: number): Promise<Uint8Array> {
  const rawBytes = await readFile(filePath);
  const buffer = await sharp(rawBytes)
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

async function loadPreviewWebpImages(item: CatalogExportItem, maxSize: number): Promise<Uint8Array[]> {
  const results: Uint8Array[] = [];
  const seenPaths = new Set<string>();
  for (const imgPath of item.images) {
    const normalized = path.resolve(imgPath);
    if (seenPaths.has(normalized)) continue;
    seenPaths.add(normalized);
    try {
      results.push(await convertImageFileToWebp(normalized, maxSize));
    } catch (error) {
      console.warn(`  bỏ qua ảnh ${path.basename(imgPath)}: ${(error as Error).message}`);
    }
  }
  return results;
}

function storageWarningFor(bytes: number | null): string | null {
  if (bytes === null || bytes <= STORAGE_WARN_BYTES) return null;
  return `Cảnh báo: bucket ${PRODUCT_IMAGE_BUCKET} ~${(bytes / 1024 ** 2).toFixed(0)} MB (> 800 MB).`;
}

function summarizeTotals(items: JsonImportResult[]): JsonImportTotals {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  for (const item of items) {
    if (item.action === 'CREATE') created += 1;
    else if (item.action === 'UPDATE') updated += 1;
    else if (item.action === 'SKIP') skipped += 1;
    else errors += 1;
  }
  return { total: items.length, created, updated, skipped, errors };
}

export async function main(argv: string[]): Promise<number> {
  let options: JsonImportOptions;
  try {
    options = parseJsonImportArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      if (error.message) console.error(error.message);
      console.error(USAGE_TEXT);
      return error.message ? EXIT.USAGE : EXIT.OK;
    }
    throw error;
  }

  assertSafeEnvironment();

  const rawJson = await readFile(options.jsonFile, 'utf8');
  const bundle = catalogExportBundleSchema.parse(JSON.parse(rawJson));
  const selectedItems = bundle.items.slice(0, options.limit);

  const hasDb = Boolean(process.env.DATABASE_URL);
  if (options.apply && !hasDb) {
    console.error('Thiếu DATABASE_URL để chạy --apply.');
    return EXIT.CONFIG;
  }

  console.log(
    `BaSa3D JSON import: ${selectedItems.length}/${bundle.items.length} sản phẩm — ${options.apply ? 'GHI DEV DB' : 'CHẠY THỬ (dry-run)'}`,
  );

  const pool = hasDb ? getPool() : null;
  let lockClient: PoolClient | null = null;
  let store: ImageStore | null = null;
  let usageBefore: number | null = null;
  let storageWarning: string | null = null;
  const results: JsonImportResult[] = [];

  try {
    if (pool && options.apply) {
      lockClient = await pool.connect();
      const locked = await lockClient.query<{ ok: boolean }>(`select pg_try_advisory_lock(hashtext('stl-import')) as ok`);
      if (!locked.rows[0].ok) {
        console.error('Một lần nhập --apply khác đang chạy.');
        return EXIT.CONFIG;
      }
      store = supabaseImageStore();
    }

    if (pool) {
      usageBefore = await getBucketUsageBytes(PRODUCT_IMAGE_BUCKET, pool).catch(() => null);
    }

    const totalImagesEstimate = selectedItems.reduce((sum, item) => sum + item.images.length, 0);
    const estimateAfter = usageBefore === null ? null : usageBefore + totalImagesEstimate * AVG_IMAGE_BYTES;
    storageWarning = storageWarningFor(estimateAfter);
    if (storageWarning) console.warn(storageWarning);

    if (options.apply && estimateAfter !== null && estimateAfter > STORAGE_BLOCK_BYTES && !options.allowStorageOver) {
      console.error('Dừng: ước tính dung lượng bucket > 950 MB. Giảm --limit hoặc thêm --allow-storage-over.');
      return EXIT.STORAGE;
    }

    for (const [index, item] of selectedItems.entries()) {
      const started = Date.now();
      console.log(`::PROGRESS::${JSON.stringify({
        phase: 'item',
        current: index + 1,
        total: selectedItems.length,
        name: item.name,
        sourceKey: item.sourceKey,
      })}`);
      let result: JsonImportResult;
      try {
        const webpImages = await loadPreviewWebpImages(item, options.size);
        if (options.apply && pool && store) {
          result = await applyCatalogJsonItem(pool, store, item, webpImages);
        } else {
          const existing = pool ? await findImportItem(pool, item.sourceKey) : null;
          const previewSlug = computeJsonBundleSlug(item.name, new Set());
          const skus = buildVariantSkus(
            item.skuCode,
            previewSlug,
            item.variants.length,
            () => false,
          );
          result = {
            sourceKey: item.sourceKey,
            action: existing?.productId ? 'UPDATE' : 'CREATE',
            itemId: existing?.id ?? null,
            productId: existing?.productId ?? null,
            slug: previewSlug,
            sku: skus[0] ?? null,
            variantsCount: item.variants.length,
          };
        }
      } catch (error) {
        result = {
          sourceKey: item.sourceKey,
          action: 'ERROR',
          itemId: null,
          productId: null,
          slug: null,
          sku: null,
          variantsCount: item.variants.length,
          error: String((error as Error).message ?? error).slice(0, 2000),
        };
      }
      results.push(result);
      const elapsedSec = ((Date.now() - started) / 1000).toFixed(1).padStart(4);
      console.log(
        `${String(index + 1).padStart(4)}  ${elapsedSec}s  ${result.action.padEnd(7)} ${item.name} (${result.variantsCount} phân loại)${result.error ? ` — ${result.error}` : ''}`,
      );
      console.log(`::PROGRESS::${JSON.stringify({
        phase: 'done',
        current: index + 1,
        total: selectedItems.length,
        name: item.name,
        sourceKey: result.sourceKey,
        action: result.action,
        productId: result.productId,
        slug: result.slug,
        sku: result.sku,
        variantsCount: result.variantsCount,
        error: result.error ?? null,
      })}`);
    }
  } finally {
    if (lockClient) {
      await lockClient.query(`select pg_advisory_unlock(hashtext('stl-import'))`).catch(() => undefined);
      lockClient.release();
    }
  }

  const manifest: JsonImportManifest = {
    schemaVersion: bundle.schemaVersion,
    runAt: new Date().toISOString(),
    applied: options.apply,
    sourceJson: options.jsonFile,
    totals: summarizeTotals(results),
    bucketUsageBytesBefore: usageBefore,
    storageWarning,
    items: results,
  };

  await mkdir(path.dirname(options.outPath), { recursive: true });
  await writeFile(options.outPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Xong: ${JSON.stringify(manifest.totals)} — manifest: ${options.outPath}`);
  return manifest.totals.errors > 0 ? EXIT.CONFIG : EXIT.OK;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then(async (code) => {
      if (process.env.DATABASE_URL) await getPool().end().catch(() => undefined);
      process.exit(code);
    })
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : error);
      if (process.env.DATABASE_URL) await getPool().end().catch(() => undefined);
      process.exit(EXIT.CONFIG);
    });
}
