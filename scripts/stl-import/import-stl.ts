// Feature 003 — STL library → DRAFT products (specs/003-stl-bulk-import/contracts/cli-import-stl.md).
//
//   npx tsx --env-file=.env.local scripts/stl-import/import-stl.ts --in "<Drive folder>" [--limit 50]   # dry-run (default)
//   … add --apply to write the DB and upload rendered images
//
// This script never loads an env file itself: it only reads process.env, so a test can run it with an
// explicit, empty environment and it can never pick up the real credentials by accident. It never
// uploads the source STL files — only the rendered .webp images (FR-012).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type { PoolClient } from 'pg';
import { getPool } from '../../src/lib/db';
import { categoryMapSchema, resolveCategory, type CategoryMap } from '../../src/lib/stl-import/category-map';
import { analyzeModel, type ImportWarning } from '../../src/lib/stl-import/metrics';
import { buildSku, describeModel, displayName, uniqueSlug } from '../../src/lib/stl-import/naming';
import { estimateImportPrice, type ImportPrice, type ImportPricingContext } from '../../src/lib/stl-import/pricing';
import { groupModels, walkDir, type GroupMode } from '../../src/lib/stl-import/scan';
import { sourceKey } from '../../src/lib/stl-import/source-key';
import { applyImport, findImportItem, planImport, PRODUCT_IMAGE_BUCKET, type ImageStore, type ImportAction } from '../../src/services/stl-import-write.service';
import { getBucketUsageBytes, STORAGE_BLOCK_BYTES, STORAGE_WARN_BYTES } from '../../src/services/storage-usage.service';
import { ModelRenderer } from './render';
import { totalsOf, writeReport, type Manifest, type ManifestItem } from './report';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXIT = { OK: 0, CONFIG: 1, USAGE: 2, STORAGE: 3 } as const;
const AVG_IMAGE_BYTES = 120 * 1024; // planning estimate per rendered WebP (spike: ~80–150 KB at 1200 px)

const VALUE_FLAGS = ['in', 'out', 'group-by', 'limit', 'only', 'views', 'color', 'size', 'max-mb', 'timeout', 'map'] as const;
const BOOLEAN_FLAGS = ['dims-overlay', 'retry-errors', 'apply', 'allow-storage-over', 'no-render', 'help'] as const;

class UsageError extends Error {}

type Options = {
  in: string; out: string; groupBy: GroupMode | null; limit: number; only?: string; views: 2 | 4; color: string; size: number;
  maxBytes: number; timeoutMs: number; mapFile: string; dims: boolean; retryErrors: boolean; apply: boolean; allowStorageOver: boolean; noRender: boolean;
};

export function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new UsageError(`Tham số lạ: ${arg}`);
    const name = arg.slice(2);
    if ((BOOLEAN_FLAGS as readonly string[]).includes(name)) flags.add(name);
    else if ((VALUE_FLAGS as readonly string[]).includes(name)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`--${name} cần một giá trị`);
      values.set(name, value);
      i += 1;
    } else throw new UsageError(`Cờ không hợp lệ: --${name}`);
  }
  if (flags.has('help')) throw new UsageError('');
  const input = values.get('in');
  if (!input) throw new UsageError('Thiếu --in <thư mục kho>');
  const number = (name: string, fallback: number, min: number) => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min) throw new UsageError(`--${name} phải là số ≥ ${min}`);
    return value;
  };
  const groupBy = values.get('group-by');
  if (groupBy && groupBy !== 'folder' && groupBy !== 'file') throw new UsageError('--group-by chỉ nhận folder|file');
  const views = number('views', 4, 2);
  if (views !== 2 && views !== 4) throw new UsageError('--views chỉ nhận 4 hoặc 2');
  const color = values.get('color') ?? '#9aa0a6';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new UsageError('--color phải dạng #rrggbb');
  const options: Options = {
    in: path.resolve(input),
    out: path.resolve(values.get('out') ?? '.stl-import'),
    groupBy: groupBy ? (groupBy === 'file' ? 'FILE' : 'FOLDER') : null,
    limit: number('limit', Infinity, 1),
    only: values.get('only'),
    views,
    color,
    size: number('size', 1200, 256),
    maxBytes: number('max-mb', 300, 1) * 1024 * 1024,
    timeoutMs: number('timeout', 120, 5) * 1000,
    mapFile: path.resolve(values.get('map') ?? path.join(here, 'category-map.json')),
    dims: flags.has('dims-overlay'),
    retryErrors: flags.has('retry-errors'),
    apply: flags.has('apply'),
    allowStorageOver: flags.has('allow-storage-over'),
    noRender: flags.has('no-render'),
  };
  if (options.apply && options.noRender) throw new UsageError('--no-render chỉ dùng khi chạy thử (không kèm --apply)');
  return options;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Test runs (BASA3D_TEST_ENVIRONMENT=isolated) may only ever reach a local database and Storage. */
function assertSafeEnvironment(): void {
  if (process.env.BASA3D_TEST_ENVIRONMENT !== 'isolated') return;
  for (const name of ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const) {
    const url = process.env[name];
    if (url && !LOCAL_HOSTS.has(new URL(url).hostname)) throw new Error(`Môi trường test chỉ được dùng database local (${name}).`);
  }
}

function supabaseImageStore(): ImageStore {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('--apply cần NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong môi trường.');
  const bucket = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }).storage.from(PRODUCT_IMAGE_BUCKET);
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

async function loadCategoryMap(file: string): Promise<CategoryMap> {
  return categoryMapSchema.parse(JSON.parse(await readFile(file, 'utf8')));
}

async function loadPricing(): Promise<ImportPricingContext | null> {
  // Imported lazily: only needed when a database is configured.
  const { loadPricingContext } = await import('../../src/services/instant-estimate.service');
  return loadPricingContext();
}

function storageMessage(bytes: number | null): string | null {
  if (bytes === null || bytes <= STORAGE_WARN_BYTES) return null;
  return `Cảnh báo: bucket ${PRODUCT_IMAGE_BUCKET} ~${(bytes / 1024 ** 2).toFixed(0)} MB (> 800 MB của gói 1 GB). Cân nhắc --views 2.`;
}

export async function main(argv: string[]): Promise<number> {
  let options: Options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    if (error.message) console.error(error.message);
    console.error(`Cờ hợp lệ: ${[...VALUE_FLAGS.map((f) => `--${f} <giá trị>`), ...BOOLEAN_FLAGS.map((f) => `--${f}`)].join(' ')}`);
    return EXIT.USAGE;
  }
  try {
    assertSafeEnvironment();
  } catch (error) {
    console.error((error as Error).message);
    return EXIT.CONFIG;
  }
  const hasDb = Boolean(process.env.DATABASE_URL);
  if (options.apply && !hasDb) {
    console.error('--apply cần DATABASE_URL (chạy kèm --env-file=.env.local).');
    return EXIT.CONFIG;
  }

  const map = await loadCategoryMap(options.mapFile);
  const groupMode: GroupMode = options.groupBy
    ?? (process.env.STL_IMPORT_GROUP_BY === 'file' ? 'FILE' : process.env.STL_IMPORT_GROUP_BY === 'folder' ? 'FOLDER' : null)
    ?? (map.groupBy === 'file' ? 'FILE' : 'FOLDER');
  const groups = groupModels(await walkDir(options.in), groupMode, { maxBytes: options.maxBytes, only: options.only }).slice(0, options.limit);
  console.log(`${groups.length} mẫu (${groupMode === 'FOLDER' ? 'gom theo thư mục' : 'mỗi file một mẫu'}) — ${options.apply ? 'GHI THẬT' : 'chạy thử'}`);

  let lockClient: PoolClient | null = null;
  let store: ImageStore | null = null;
  let renderer: ModelRenderer | null = null;
  const pool = hasDb ? getPool() : null;
  const items: ManifestItem[] = [];
  let usageBefore: number | null = null;
  let storageWarning: string | null = null;
  try {
    if (pool && options.apply) {
      lockClient = await pool.connect();
      const locked = await lockClient.query<{ ok: boolean }>(`select pg_try_advisory_lock(hashtext('stl-import')) as ok`);
      if (!locked.rows[0].ok) {
        console.error('Một lần nhập --apply khác đang chạy.');
        return EXIT.CONFIG;
      }
    }
    if (pool) usageBefore = await getBucketUsageBytes(PRODUCT_IMAGE_BUCKET, pool).catch(() => null);
    const pricing = pool ? await loadPricing() : null;

    const plans = await Promise.all(groups.map(async (group) => {
      const key = sourceKey(group.sourceRelPath);
      const existing = pool ? await findImportItem(pool, key) : null;
      return { group, key, action: planImport(existing, group.files, { retryErrors: options.retryErrors }) as ImportAction };
    }));
    const toRender = plans.filter((plan) => plan.action === 'CREATE' || plan.action === 'RERENDER').length;
    const estimateAfter = usageBefore === null ? null : usageBefore + toRender * options.views * AVG_IMAGE_BYTES;
    storageWarning = storageMessage(estimateAfter);
    if (storageWarning) console.warn(storageWarning);
    if (options.apply && estimateAfter !== null && estimateAfter > STORAGE_BLOCK_BYTES && !options.allowStorageOver) {
      console.error('Dừng: ước tính dung lượng ảnh sau lô > 950 MB. Giảm --limit / --views 2, hoặc thêm --allow-storage-over.');
      return EXIT.STORAGE;
    }
    if (options.apply) store = supabaseImageStore();
    if (!options.noRender && toRender > 0) renderer = new ModelRenderer(options.timeoutMs);

    const previewSlugs = new Set<string>();
    const previewSkus = new Set<string>();
    await mkdir(path.join(options.out, 'images'), { recursive: true });
    for (const [index, plan] of plans.entries()) {
      const started = Date.now();
      const { group } = plan;
      const category = resolveCategory(map, group.sourceDir);
      const name = displayName(group.nameSource);
      const extraWarnings: ImportWarning[] = group.oversizeSkipped.length ? ['OVERSIZE_SKIPPED_PART'] : [];
      const item: ManifestItem = {
        sourceKey: plan.key, sourceRelPath: group.sourceRelPath, action: plan.action === 'SOURCE_CHANGED' ? 'SOURCE_CHANGED' : plan.action,
        name, slug: null, sku: null, categorySlug: category.categorySlug, bboxMm: null, volumeCm3: null, triangles: null,
        basePrice: null, warnings: [...extraWarnings], error: null, images: [], ms: 0,
      };
      try {
        if (plan.action === 'CREATE' || plan.action === 'RERENDER') {
          const parts = await Promise.all(group.files.map(async (file) => ({ relPath: file.relPath, bytes: new Uint8Array(await readFile(path.join(options.in, ...file.relPath.split('/')))) })));
          const analysis = analyzeModel(parts);
          let price: ImportPrice = { priced: false, reason: 'NO_PRICING_CONFIG' };
          let images: Uint8Array[] = [];
          if (analysis.ok) {
            Object.assign(item, { bboxMm: analysis.bboxMm, volumeCm3: analysis.volumeCm3, triangles: analysis.triangles });
            item.warnings.push(...analysis.warnings);
            price = estimateImportPrice(analysis.metrics, pricing);
            if (!price.priced) item.warnings.push('UNPRICED');
            else item.basePrice = price.basePrice;
            if (renderer) {
              images = await renderer.render(parts.map((part) => part.bytes), { size: options.size, quality: 0.85, color: options.color, views: options.views, dims: options.dims ? analysis.bboxMm : null });
              for (const [n, bytes] of images.entries()) {
                const file = `images/${plan.key}-${n}.webp`;
                await writeFile(path.join(options.out, file), bytes);
                item.images.push(file);
              }
            }
          } else {
            item.action = 'ERROR';
            item.error = analysis.error;
          }
          if (options.apply && store && pool) {
            const result = await applyImport(pool, store, {
              sourceKey: plan.key, sourceRelPath: group.sourceRelPath, sourceDir: group.sourceDir, groupMode: group.groupMode, files: group.files,
              analysis, extraWarnings, name, description: describeModel(analysis.ok ? analysis.bboxMm : null),
              categorySlug: category.categorySlug, skuCode: category.skuCode, price, images,
            }, plan.action);
            item.action = result.action;
            item.slug = result.slug ?? null;
            item.sku = result.sku ?? null;
            if (result.error) item.error = result.error;
          } else if (plan.action === 'CREATE' && analysis.ok) {
            item.slug = uniqueSlug(name, (slug) => previewSlugs.has(slug));
            item.sku = buildSku(category.skuCode, item.slug, (sku) => previewSkus.has(sku));
            previewSlugs.add(item.slug);
            previewSkus.add(item.sku);
          }
        } else if (plan.action === 'SOURCE_CHANGED' && options.apply && store && pool) {
          const result = await applyImport(pool, store, {
            sourceKey: plan.key, sourceRelPath: group.sourceRelPath, sourceDir: group.sourceDir, groupMode: group.groupMode, files: group.files,
            analysis: { ok: false, error: 'not analysed' }, extraWarnings, name, description: '', categorySlug: category.categorySlug,
            skuCode: category.skuCode, price: { priced: false, reason: 'NO_PRICING_CONFIG' }, images: [],
          }, plan.action);
          item.action = result.action;
        }
      } catch (error) {
        item.action = 'ERROR';
        item.error = String((error as Error).message ?? error).slice(0, 2000);
      }
      if (!group.files.length && item.action !== 'SKIP') {
        item.action = 'ERROR';
        item.error ??= `Mọi file vượt --max-mb: ${group.oversizeSkipped.join(', ')}`;
      }
      item.ms = Date.now() - started;
      items.push(item);
      console.log(`${String(index + 1).padStart(5)}  ${(item.ms / 1000).toFixed(1).padStart(5)}s  ${item.action.padEnd(14)} ${item.sourceRelPath}${item.error ? `  — ${item.error}` : ''}`);
    }
  } finally {
    await renderer?.close();
    if (lockClient) {
      await lockClient.query(`select pg_advisory_unlock(hashtext('stl-import'))`).catch(() => undefined);
      lockClient.release();
    }
  }

  const processed = items.filter((item) => item.action !== 'SKIP');
  let usageAfter: number | null = usageBefore;
  if (pool && options.apply) usageAfter = await getBucketUsageBytes(PRODUCT_IMAGE_BUCKET, pool).catch(() => usageBefore);
  else if (usageBefore !== null) usageAfter = usageBefore + items.reduce((sum, item) => sum + item.images.length, 0) * AVG_IMAGE_BYTES;
  const manifest: Manifest = {
    runAt: new Date().toISOString(),
    mode: options.apply ? 'apply' : 'dry-run',
    groupBy: groupMode === 'FILE' ? 'file' : 'folder',
    totals: totalsOf(items),
    avgMsPerItem: processed.length ? Math.round(processed.reduce((sum, item) => sum + item.ms, 0) / processed.length) : 0,
    bucketUsageBytesBefore: usageBefore,
    bucketUsageBytesAfterEstimate: usageAfter,
    storageWarning: storageMessage(usageAfter) ?? storageWarning,
    items,
  };
  await writeReport(options.out, manifest);
  if (manifest.storageWarning) console.warn(manifest.storageWarning);
  console.log(`Xong: ${JSON.stringify(manifest.totals)} — báo cáo: ${path.join(options.out, 'report.html')}`);
  return EXIT.OK;
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
