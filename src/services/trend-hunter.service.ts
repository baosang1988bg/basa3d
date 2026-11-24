import { z } from 'zod';
import type { PoolClient } from 'pg';
import { resolveMakerWorldUrl, parseMakerWorldUrl } from '@/lib/parsers/makerworld-resolver';
import { sanitizeMakerWorldImageUrl } from '@/lib/parsers/makerworld-image';
import { query, withTransaction } from '@/lib/db';
import { DomainError } from '@/lib/domain-error';
import { isHostAllowed, safeFetchText, SafeFetchError, type FetchLike } from '@/lib/net/safe-fetch';
import { evaluateLicenseSafety, type CommercialSafetyStatus, type LicenseSafetyInfo } from '@/lib/trend/license-safety';
import { TREND_WATCH_STATUSES, canTransitionTrendStatus, type TrendWatchStatus } from '@/lib/trend/watch-status';
import {
  extractPrintablesModelId,
  extractThingiverseThingId,
  fetchPrintablesMetadata,
  fetchPrintablesStats,
  fetchThingiverseMetadata,
  type PlatformMetadata,
  type PlatformStats,
} from '@/lib/trend/platform-sources';
import { writeAuditLog } from '@/services/audit.service';

export { evaluateLicenseSafety };
export type { CommercialSafetyStatus, LicenseSafetyInfo } from '@/lib/trend/license-safety';
export { TREND_WATCH_STATUSES, TREND_WATCH_TRANSITIONS, canTransitionTrendStatus } from '@/lib/trend/watch-status';
export type { TrendWatchStatus } from '@/lib/trend/watch-status';
export type { PlatformStats } from '@/lib/trend/platform-sources';

export type TrendPlatform = 'MAKERWORLD' | 'MAKERWORLD_CN' | 'PRINTABLES' | 'THINGIVERSE' | 'THANGS' | 'DOUYIN' | 'OTHER';

/** Where the license string came from. Only PLATFORM_API / PAGE_DATA are structured fields. */
export type TrendLicenseSource = 'PLATFORM_API' | 'PAGE_DATA' | 'NONE';

export interface TrendCapturedDraft {
  sourceUrl: string;
  platform: TrendPlatform;
  title: string;
  coverUrl: string | null;
  author: string | null;
  license: string | null;
  licenseSource: TrendLicenseSource;
  licenseSafety: LicenseSafetyInfo;
  estimatedGrams: number | null;
  estimatedPrintMinutes: number | null;
  plateCount: number | null;
  categoryTag: string;
  notes?: string;
  stats?: PlatformStats | null;
}

export interface TrendPopularity {
  downloads: number | null;
  likes: number | null;
  prints: number | null;
  capturedOn: string;
  /** Average new downloads per day over the last ≤7 days of snapshots; null with fewer than 2 days of data. */
  downloadsPerDay: number | null;
  likesPerDay: number | null;
  windowDays: number | null;
}

export interface TrendWatchItem extends TrendCapturedDraft {
  id: string;
  status: TrendWatchStatus;
  productId: string | null;
  popularity: TrendPopularity | null;
  createdAt: string;
  updatedAt: string;
}

/** Hosts we fetch OpenGraph metadata from (non-MakerWorld). Anything else is saved by URL only. */
const OG_FETCH_HOSTS: Partial<Record<TrendPlatform, readonly string[]>> = {
  PRINTABLES: ['printables.com'],
  THINGIVERSE: ['thingiverse.com'],
  THANGS: ['thangs.com'],
  DOUYIN: ['douyin.com'],
};

const PLATFORM_HOSTS: [TrendPlatform, readonly string[]][] = [
  ['MAKERWORLD_CN', ['makerworld.com.cn', 'makerworld.cn']],
  ['MAKERWORLD', ['makerworld.com']],
  ['PRINTABLES', ['printables.com']],
  ['THINGIVERSE', ['thingiverse.com']],
  ['THANGS', ['thangs.com']],
  ['DOUYIN', ['douyin.com']],
];

/** Detects the platform by exact host / subdomain match (not substring — `makerworld.com.evil.io` is OTHER). */
export function detectTrendPlatform(rawUrl: string): TrendPlatform {
  try {
    const { hostname } = new URL(rawUrl);
    for (const [platform, suffixes] of PLATFORM_HOSTS) {
      if (isHostAllowed(hostname, suffixes)) return platform;
    }
    return 'OTHER';
  } catch {
    return 'OTHER';
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function metaContent(html: string, property: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`, 'i');
  const match = html.match(re);
  const value = match?.[1] ?? match?.[2];
  return value ? decodeHtmlEntities(value).trim() : undefined;
}

/** Exported for tests. Parses OpenGraph tags from an HTML string. */
export function parseOpenGraph(html: string): { title?: string; image?: string; description?: string } {
  const title = metaContent(html, 'og:title') ?? html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const image = metaContent(html, 'og:image');
  return {
    title: title ? decodeHtmlEntities(title).replace(/\s*\|.*$/, '').trim().slice(0, 255) : undefined,
    image: image && /^https:\/\//i.test(image) ? image.slice(0, 2000) : undefined,
    description: metaContent(html, 'og:description')?.slice(0, 1000),
  };
}

export type CaptureDeps = { fetchImpl?: FetchLike; thingiverseToken?: string };

async function fetchStructuredMetadata(platform: TrendPlatform, url: string, deps: CaptureDeps): Promise<PlatformMetadata | null> {
  if (platform === 'PRINTABLES') {
    const id = extractPrintablesModelId(url);
    return id ? fetchPrintablesMetadata(id, { fetchImpl: deps.fetchImpl }) : null;
  }
  if (platform === 'THINGIVERSE') {
    const id = extractThingiverseThingId(url);
    return id ? fetchThingiverseMetadata(id, { fetchImpl: deps.fetchImpl, token: deps.thingiverseToken }) : null;
  }
  return null;
}

export async function captureModelFromUrl(rawUrl: string, deps: CaptureDeps = {}): Promise<TrendCapturedDraft> {
  const trimmed = rawUrl.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new DomainError('INVALID_URL', 'Vui lòng cung cấp URL hợp lệ.', 400);
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new DomainError('INVALID_URL', 'Chỉ hỗ trợ link http(s).', 400);
  }

  const platform = detectTrendPlatform(trimmed);

  if (platform === 'MAKERWORLD' || platform === 'MAKERWORLD_CN') {
    if (!parseMakerWorldUrl(trimmed)) {
      throw new DomainError('INVALID_MAKERWORLD_URL', 'URL MakerWorld không hợp lệ.', 400);
    }
    const resolved = await resolveMakerWorldUrl(trimmed);
    const defaultProfile = resolved.profiles[0];
    const stats = resolved.stats;
    return {
      sourceUrl: trimmed,
      platform,
      title: resolved.modelTitle,
      coverUrl: resolved.modelCoverImageUrl ? sanitizeMakerWorldImageUrl(resolved.modelCoverImageUrl) : null,
      author: null,
      license: resolved.license ?? null,
      licenseSource: resolved.license ? 'PAGE_DATA' : 'NONE',
      licenseSafety: evaluateLicenseSafety(resolved.license),
      estimatedGrams: defaultProfile?.netWeightGrams ?? null,
      estimatedPrintMinutes: defaultProfile?.printTimeMinutes ?? null,
      plateCount: defaultProfile?.platesCount ?? (resolved.profiles.length || null),
      categoryTag: 'MakerWorld Hot',
      stats: stats && (stats.downloads !== null || stats.likes !== null || stats.prints !== null) ? stats : null,
    };
  }

  // Structured platform data first (license field), OpenGraph only for title/cover fallback.
  const structured = await fetchStructuredMetadata(platform, trimmed, deps);

  let og: { title?: string; image?: string; description?: string } = {};
  const allowedHosts = OG_FETCH_HOSTS[platform];
  if (allowedHosts && (!structured?.title || !structured.coverUrl)) {
    try {
      og = parseOpenGraph(await safeFetchText(parsedUrl, { allowedHostSuffixes: allowedHosts, fetchImpl: deps.fetchImpl }));
    } catch (error) {
      // Metadata is best-effort: an unreachable/oversized page still yields a URL-only draft.
      if (!(error instanceof SafeFetchError)) throw error;
    }
  }

  let defaultCategory = 'Chưa phân loại';
  if (platform === 'DOUYIN') defaultCategory = 'Douyin Video Trend';
  else if (platform === 'PRINTABLES') defaultCategory = 'Cơ khí & Tiện ích';
  else if (platform === 'THINGIVERSE') defaultCategory = 'Cộng đồng STL';

  const license = structured?.license ?? null;
  return {
    sourceUrl: trimmed,
    platform,
    title: structured?.title || og.title || `${platform} Model`,
    coverUrl: structured?.coverUrl || og.image || null,
    author: structured?.author ?? null,
    license,
    licenseSource: license ? 'PLATFORM_API' : 'NONE',
    // Description text can only make the verdict stricter (ADR-0062 §3).
    licenseSafety: evaluateLicenseSafety(license, og.description),
    estimatedGrams: null,
    estimatedPrintMinutes: null,
    plateCount: null,
    categoryTag: defaultCategory,
    notes: og.description ? og.description.slice(0, 300) : undefined,
    stats: structured?.stats ?? null,
  };
}

const statsSchema = z.object({
  downloads: z.number().int().nonnegative().max(2_000_000_000).nullable(),
  likes: z.number().int().nonnegative().max(2_000_000_000).nullable(),
  prints: z.number().int().nonnegative().max(2_000_000_000).nullable(),
});

export const trendWatchInputSchema = z.object({
  sourceUrl: z.string().trim().url().max(2000).refine((value) => /^https?:\/\//i.test(value), 'Chỉ hỗ trợ link http(s).'),
  platform: z.enum(['MAKERWORLD', 'MAKERWORLD_CN', 'PRINTABLES', 'THINGIVERSE', 'THANGS', 'DOUYIN', 'OTHER']),
  title: z.string().trim().min(1).max(255),
  coverUrl: z.string().url().max(2000).refine((value) => /^https:\/\//i.test(value), 'Ảnh cover phải là https.').nullable().optional(),
  author: z.string().trim().max(120).nullable().optional(),
  license: z.string().trim().max(200).nullable().optional(),
  licenseSource: z.enum(['PLATFORM_API', 'PAGE_DATA', 'NONE']).default('NONE'),
  notes: z.string().max(1000).optional(),
  estimatedGrams: z.number().nonnegative().max(100_000).nullable().optional(),
  estimatedPrintMinutes: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
  plateCount: z.number().int().positive().max(1000).nullable().optional(),
  categoryTag: z.string().trim().max(64).default('Chưa phân loại'),
  status: z.enum(TREND_WATCH_STATUSES).default('WATCHING'),
  stats: statsSchema.nullable().optional(),
});

export type TrendWatchInput = z.input<typeof trendWatchInputSchema>;

type TrendRow = {
  id: string;
  source_url: string;
  platform: TrendPlatform;
  title: string;
  cover_url: string | null;
  author: string | null;
  license: string | null;
  license_source: TrendLicenseSource;
  notes: string | null;
  estimated_grams: string | null;
  estimated_print_minutes: number | null;
  plate_count: number | null;
  category_tag: string | null;
  status: TrendWatchStatus;
  product_id: string | null;
  created_at: Date;
  updated_at: Date;
  snap_on: string | null;
  snap_downloads: number | null;
  snap_likes: number | null;
  snap_prints: number | null;
  base_on: string | null;
  base_downloads: number | null;
  base_likes: number | null;
};

function perDay(latest: number | null, base: number | null, days: number | null): number | null {
  if (latest === null || base === null || !days || days <= 0) return null;
  return Math.round(((latest - base) / days) * 10) / 10;
}

/** Exported for tests. */
export function computePopularity(row: Pick<TrendRow, 'snap_on' | 'snap_downloads' | 'snap_likes' | 'snap_prints' | 'base_on' | 'base_downloads' | 'base_likes'>): TrendPopularity | null {
  if (!row.snap_on) return null;
  const days = row.base_on ? Math.round((Date.parse(row.snap_on) - Date.parse(row.base_on)) / 86_400_000) : null;
  return {
    downloads: row.snap_downloads,
    likes: row.snap_likes,
    prints: row.snap_prints,
    capturedOn: row.snap_on,
    downloadsPerDay: perDay(row.snap_downloads, row.base_downloads, days),
    likesPerDay: perDay(row.snap_likes, row.base_likes, days),
    windowDays: days && days > 0 ? days : null,
  };
}

function toItem(row: TrendRow): TrendWatchItem {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    platform: row.platform,
    title: row.title,
    coverUrl: row.cover_url,
    author: row.author,
    license: row.license,
    licenseSource: row.license_source,
    licenseSafety: evaluateLicenseSafety(row.license, row.notes),
    notes: row.notes ?? undefined,
    estimatedGrams: row.estimated_grams === null ? null : Number(row.estimated_grams),
    estimatedPrintMinutes: row.estimated_print_minutes,
    plateCount: row.plate_count,
    categoryTag: row.category_tag || 'Chưa phân loại',
    status: row.status,
    productId: row.product_id,
    popularity: computePopularity(row),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Lists watchlist items (newest first) with their latest snapshot and a ≤7-day velocity baseline. */
export async function listTrendWatchItems(limit = 500): Promise<TrendWatchItem[]> {
  const result = await query<TrendRow>(`
    select t.id, t.source_url, t.platform, t.title, t.cover_url, t.author, t.license, t.license_source, t.notes,
      t.estimated_grams, t.estimated_print_minutes, t.plate_count, t.category_tag, t.status, t.product_id,
      t.created_at, t.updated_at,
      s.captured_on::text as snap_on, s.downloads as snap_downloads, s.likes as snap_likes, s.prints as snap_prints,
      b.captured_on::text as base_on, b.downloads as base_downloads, b.likes as base_likes
    from trend_watch_items t
    left join lateral (
      select captured_on, downloads, likes, prints from trend_watch_snapshots
      where item_id = t.id order by captured_on desc limit 1
    ) s on true
    left join lateral (
      select captured_on, downloads, likes from trend_watch_snapshots
      where item_id = t.id and s.captured_on is not null
        and captured_on < s.captured_on and captured_on >= s.captured_on - 7
      order by captured_on asc limit 1
    ) b on true
    order by t.created_at desc
    limit $1`, [limit]);
  return result.rows.map(toItem);
}

type Exec = (text: string, values: unknown[]) => Promise<unknown>;

async function upsertSnapshot(run: Exec, itemId: string, stats: PlatformStats): Promise<void> {
  await run(
    `insert into trend_watch_snapshots (item_id, downloads, likes, prints) values ($1, $2, $3, $4)
     on conflict (item_id, captured_on) do update set downloads = excluded.downloads, likes = excluded.likes, prints = excluded.prints`,
    [itemId, stats.downloads, stats.likes, stats.prints],
  );
}

export async function saveTrendWatchItem(input: TrendWatchInput, staffId?: string): Promise<{ id: string }> {
  const v = trendWatchInputSchema.parse(input);
  // Verdict computed on the server from the stored fields — the client's licenseSafety is ignored.
  const licenseStatus: CommercialSafetyStatus = evaluateLicenseSafety(v.license, v.notes).status;
  try {
    return await withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `insert into trend_watch_items (source_url, platform, title, cover_url, author, license, license_source, license_status, notes,
          estimated_grams, estimated_print_minutes, plate_count, category_tag, status, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         returning id`,
        [
          v.sourceUrl, v.platform, v.title, v.coverUrl ?? null, v.author ?? null, v.license ?? null,
          v.license ? v.licenseSource : 'NONE', licenseStatus, v.notes ?? null,
          v.estimatedGrams ?? null, v.estimatedPrintMinutes ?? null, v.plateCount ?? null, v.categoryTag, v.status, staffId ?? null,
        ],
      );
      const id = result.rows[0].id;
      if (v.stats) await upsertSnapshot((text, values) => client.query(text, values), id, v.stats);
      await writeAuditLog(client, {
        actorId: staffId ?? null, action: 'TREND_ITEM_CREATED', entityType: 'trend_watch_item', entityId: id,
        afterData: { sourceUrl: v.sourceUrl, platform: v.platform, title: v.title, license: v.license ?? null, licenseStatus },
      });
      return { id };
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new DomainError('TREND_DUPLICATE', 'Mẫu này đã có trong Watchlist.', 409);
    }
    throw error;
  }
}

export async function updateTrendWatchItemStatus(id: string, status: TrendWatchStatus, actorId: string | null = null): Promise<void> {
  await withTransaction(async (client) => {
    const current = await client.query<{ status: TrendWatchStatus }>('select status from trend_watch_items where id = $1 for update', [id]);
    if (!current.rowCount) throw new DomainError('TREND_NOT_FOUND', 'Không tìm thấy mẫu trong Watchlist.', 404);
    const from = current.rows[0].status;
    if (!canTransitionTrendStatus(from, status)) {
      throw new DomainError('TREND_INVALID_TRANSITION', `Không thể chuyển trạng thái ${from} → ${status}.`, 409);
    }
    if (from === status) return;
    await client.query('update trend_watch_items set status = $2 where id = $1', [id, status]);
    await writeAuditLog(client, {
      actorId, action: 'TREND_ITEM_STATUS_CHANGED', entityType: 'trend_watch_item', entityId: id,
      beforeData: { status: from }, afterData: { status },
    });
  });
}

export async function deleteTrendWatchItem(id: string, actorId: string | null = null): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query<{ title: string; source_url: string; status: string; product_id: string | null }>(
      'delete from trend_watch_items where id = $1 returning title, source_url, status, product_id', [id],
    );
    if (!result.rowCount) throw new DomainError('TREND_NOT_FOUND', 'Không tìm thấy mẫu trong Watchlist.', 404);
    const row = result.rows[0];
    await writeAuditLog(client, {
      actorId, action: 'TREND_ITEM_DELETED', entityType: 'trend_watch_item', entityId: id,
      beforeData: { title: row.title, sourceUrl: row.source_url, status: row.status, productId: row.product_id },
    });
  });
}

/**
 * Links a freshly created catalog product to its trend item inside the product-creation transaction
 * (ADR-0063 U2). Marks the item CONVERTED_DRAFT. The DB publish gate then keys off this link.
 */
export async function linkTrendItemToProduct(client: PoolClient, input: { trendItemId: string; productId: string; actorId: string }): Promise<void> {
  const current = await client.query<{ status: TrendWatchStatus; product_id: string | null }>(
    'select status, product_id from trend_watch_items where id = $1 for update', [input.trendItemId],
  );
  if (!current.rowCount) throw new DomainError('TREND_NOT_FOUND', 'Không tìm thấy mẫu Trend Radar để liên kết.', 404);
  const { status, product_id: existing } = current.rows[0];
  if (existing) throw new DomainError('TREND_ALREADY_CONVERTED', 'Mẫu Trend này đã được tạo thành sản phẩm khác.', 409);
  if (!canTransitionTrendStatus(status, 'CONVERTED_DRAFT')) {
    throw new DomainError('TREND_INVALID_TRANSITION', `Mẫu đang ở trạng thái ${status}, không thể tạo sản phẩm.`, 409);
  }
  await client.query(`update trend_watch_items set product_id = $2, status = 'CONVERTED_DRAFT' where id = $1`, [input.trendItemId, input.productId]);
  await writeAuditLog(client, {
    actorId: input.actorId, action: 'TREND_ITEM_CONVERTED', entityType: 'trend_watch_item', entityId: input.trendItemId,
    beforeData: { status }, afterData: { status: 'CONVERTED_DRAFT', productId: input.productId },
  });
}

/** Fetches current popularity counters for one item; null when the platform exposes none. */
export async function fetchTrendStats(platform: TrendPlatform, sourceUrl: string, deps: CaptureDeps = {}): Promise<PlatformStats | null> {
  try {
    if (platform === 'MAKERWORLD' || platform === 'MAKERWORLD_CN') {
      const fetchImpl = deps.fetchImpl;
      const stats = (await resolveMakerWorldUrl(sourceUrl, {
        fetchImpl: fetchImpl ? (input, init) => fetchImpl(typeof input === 'string' ? new URL(input) : input, init ?? {}) : undefined,
      })).stats;
      return stats.downloads === null && stats.likes === null && stats.prints === null ? null : stats;
    }
    if (platform === 'PRINTABLES') {
      const id = extractPrintablesModelId(sourceUrl);
      return id ? await fetchPrintablesStats(id, { fetchImpl: deps.fetchImpl }) : null;
    }
    if (platform === 'THINGIVERSE') {
      const id = extractThingiverseThingId(sourceUrl);
      return id ? (await fetchThingiverseMetadata(id, { fetchImpl: deps.fetchImpl, token: deps.thingiverseToken }))?.stats ?? null : null;
    }
  } catch {
    return null;
  }
  return null;
}

export type SnapshotRunResult = { considered: number; captured: number; skipped: number; timedOut: boolean };

/**
 * Daily cron (ADR-0063 U5): snapshot popularity for active watchlist items, oldest snapshot first.
 * Bounded by `limit` and a wall-clock budget so it fits the cron function's maxDuration.
 */
export async function captureTrendSnapshots(options: { limit?: number; budgetMs?: number; concurrency?: number; deps?: CaptureDeps } = {}): Promise<SnapshotRunResult> {
  const limit = options.limit ?? 40;
  const budgetMs = options.budgetMs ?? 45_000;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 6));
  const started = Date.now();
  const items = await query<{ id: string; platform: TrendPlatform; source_url: string }>(`
    select t.id, t.platform, t.source_url
    from trend_watch_items t
    left join lateral (select max(captured_on) as last_on from trend_watch_snapshots where item_id = t.id) s on true
    where t.status in ('WATCHING', 'PRINT_TESTING')
      and t.platform in ('MAKERWORLD', 'MAKERWORLD_CN', 'PRINTABLES', 'THINGIVERSE')
      and (s.last_on is null or s.last_on < (timezone('utc', now()))::date)
    order by s.last_on asc nulls first, t.created_at asc
    limit $1`, [limit]);

  let captured = 0;
  let skipped = 0;
  let timedOut = false;
  const queue = [...items.rows];
  async function worker() {
    for (;;) {
      if (Date.now() - started > budgetMs) { timedOut = queue.length > 0; return; }
      const item = queue.shift();
      if (!item) return;
      const stats = await fetchTrendStats(item.platform, item.source_url, options.deps);
      if (!stats) { skipped += 1; continue; }
      await upsertSnapshot((text, values) => query(text, values), item.id, stats);
      captured += 1;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { considered: items.rowCount ?? items.rows.length, captured, skipped, timedOut };
}

/**
 * ADR-0064 — admin dashboard "Mẫu đang nóng": active watchlist items that have popularity data, ranked by
 * downloads/day, then likes/day, then total downloads. Reuses listTrendWatchItems (≤ 500 rows) so the
 * velocity definition stays in one place (computePopularity).
 */
export async function getHotTrendItems(limit = 5): Promise<TrendWatchItem[]> {
  const items = await listTrendWatchItems();
  const score = (value: number | null | undefined) => (typeof value === 'number' ? value : -1);
  return items
    .filter((item) => (item.status === 'WATCHING' || item.status === 'PRINT_TESTING') && item.popularity)
    .sort((a, b) => score(b.popularity?.downloadsPerDay) - score(a.popularity?.downloadsPerDay)
      || score(b.popularity?.likesPerDay) - score(a.popularity?.likesPerDay)
      || score(b.popularity?.downloads) - score(a.popularity?.downloads))
    .slice(0, Math.max(1, Math.min(limit, 50)));
}
