import { z } from 'zod';
import { resolveMakerWorldUrl, parseMakerWorldUrl } from '@/lib/parsers/makerworld-resolver';
import { sanitizeMakerWorldImageUrl } from '@/lib/parsers/makerworld-image';
import { query } from '@/lib/db';
import { DomainError } from '@/lib/domain-error';
import { isHostAllowed, safeFetchText, SafeFetchError, type FetchLike } from '@/lib/net/safe-fetch';
import { evaluateLicenseSafety, type LicenseSafetyInfo } from '@/lib/trend/license-safety';

export { evaluateLicenseSafety };
export type { CommercialSafetyStatus, LicenseSafetyInfo } from '@/lib/trend/license-safety';

export type TrendPlatform = 'MAKERWORLD' | 'MAKERWORLD_CN' | 'PRINTABLES' | 'THINGIVERSE' | 'THANGS' | 'DOUYIN' | 'OTHER';

import { TREND_WATCH_STATUSES, canTransitionTrendStatus, type TrendWatchStatus } from '@/lib/trend/watch-status';

export { TREND_WATCH_STATUSES, TREND_WATCH_TRANSITIONS, canTransitionTrendStatus } from '@/lib/trend/watch-status';
export type { TrendWatchStatus } from '@/lib/trend/watch-status';

export interface TrendCapturedDraft {
  sourceUrl: string;
  platform: TrendPlatform;
  title: string;
  coverUrl: string | null;
  author: string | null;
  license: string | null;
  licenseSafety: LicenseSafetyInfo;
  estimatedGrams: number | null;
  estimatedPrintMinutes: number | null;
  plateCount: number | null;
  categoryTag: string;
  notes?: string;
}

export interface TrendWatchItem extends TrendCapturedDraft {
  id: string;
  status: TrendWatchStatus;
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

export async function captureModelFromUrl(rawUrl: string, deps: { fetchImpl?: FetchLike } = {}): Promise<TrendCapturedDraft> {
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
    return {
      sourceUrl: trimmed,
      platform,
      title: resolved.modelTitle,
      coverUrl: resolved.modelCoverImageUrl ? sanitizeMakerWorldImageUrl(resolved.modelCoverImageUrl) : null,
      author: null,
      license: resolved.license ?? null,
      licenseSafety: evaluateLicenseSafety(resolved.license),
      estimatedGrams: defaultProfile?.netWeightGrams ?? null,
      estimatedPrintMinutes: defaultProfile?.printTimeMinutes ?? null,
      plateCount: defaultProfile?.platesCount ?? (resolved.profiles.length || null),
      categoryTag: 'MakerWorld Hot',
    };
  }

  let og: { title?: string; image?: string; description?: string } = {};
  const allowedHosts = OG_FETCH_HOSTS[platform];
  if (allowedHosts) {
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

  return {
    sourceUrl: trimmed,
    platform,
    title: og.title || `${platform} Model`,
    coverUrl: og.image || null,
    author: null,
    license: null,
    // No structured license here: description text can only make the verdict stricter (ADR-0062 §3).
    licenseSafety: evaluateLicenseSafety(null, og.description),
    estimatedGrams: null,
    estimatedPrintMinutes: null,
    plateCount: null,
    categoryTag: defaultCategory,
    notes: og.description ? og.description.slice(0, 300) : undefined,
  };
}

export const trendWatchInputSchema = z.object({
  sourceUrl: z.string().trim().url().max(2000).refine((value) => /^https?:\/\//i.test(value), 'Chỉ hỗ trợ link http(s).'),
  platform: z.enum(['MAKERWORLD', 'MAKERWORLD_CN', 'PRINTABLES', 'THINGIVERSE', 'THANGS', 'DOUYIN', 'OTHER']),
  title: z.string().trim().min(1).max(255),
  coverUrl: z.string().url().max(2000).refine((value) => /^https:\/\//i.test(value), 'Ảnh cover phải là https.').nullable().optional(),
  author: z.string().trim().max(120).nullable().optional(),
  license: z.string().trim().max(200).nullable().optional(),
  notes: z.string().max(1000).optional(),
  estimatedGrams: z.number().nonnegative().max(100_000).nullable().optional(),
  estimatedPrintMinutes: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
  plateCount: z.number().int().positive().max(1000).nullable().optional(),
  categoryTag: z.string().trim().max(64).default('Chưa phân loại'),
  status: z.enum(TREND_WATCH_STATUSES).default('WATCHING'),
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
  notes: string | null;
  estimated_grams: string | null;
  estimated_print_minutes: number | null;
  plate_count: number | null;
  category_tag: string | null;
  status: TrendWatchStatus;
  created_at: Date;
  updated_at: Date;
};

const TREND_COLUMNS = `id, source_url, platform, title, cover_url, author, license, notes, estimated_grams,
  estimated_print_minutes, plate_count, category_tag, status, created_at, updated_at`;

function toItem(row: TrendRow): TrendWatchItem {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    platform: row.platform,
    title: row.title,
    coverUrl: row.cover_url,
    author: row.author,
    license: row.license,
    licenseSafety: evaluateLicenseSafety(row.license, row.notes),
    notes: row.notes ?? undefined,
    estimatedGrams: row.estimated_grams === null ? null : Number(row.estimated_grams),
    estimatedPrintMinutes: row.estimated_print_minutes,
    plateCount: row.plate_count,
    categoryTag: row.category_tag || 'Chưa phân loại',
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Lists watchlist items, newest first. DB errors propagate (no silent empty list). */
export async function listTrendWatchItems(limit = 500): Promise<TrendWatchItem[]> {
  const result = await query<TrendRow>(`select ${TREND_COLUMNS} from trend_watch_items order by created_at desc limit $1`, [limit]);
  return result.rows.map(toItem);
}

export async function saveTrendWatchItem(input: TrendWatchInput, staffId?: string): Promise<{ id: string }> {
  const v = trendWatchInputSchema.parse(input);
  try {
    const result = await query<{ id: string }>(
      `insert into trend_watch_items (source_url, platform, title, cover_url, author, license, notes,
        estimated_grams, estimated_print_minutes, plate_count, category_tag, status, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning id`,
      [
        v.sourceUrl, v.platform, v.title, v.coverUrl ?? null, v.author ?? null, v.license ?? null, v.notes ?? null,
        v.estimatedGrams ?? null, v.estimatedPrintMinutes ?? null, v.plateCount ?? null, v.categoryTag, v.status, staffId ?? null,
      ],
    );
    return { id: result.rows[0].id };
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new DomainError('TREND_DUPLICATE', 'Mẫu này đã có trong Watchlist.', 409);
    }
    throw error;
  }
}

export async function updateTrendWatchItemStatus(id: string, status: TrendWatchStatus): Promise<void> {
  const current = await query<{ status: TrendWatchStatus }>('select status from trend_watch_items where id = $1', [id]);
  if (!current.rowCount) throw new DomainError('TREND_NOT_FOUND', 'Không tìm thấy mẫu trong Watchlist.', 404);
  const from = current.rows[0].status;
  if (!canTransitionTrendStatus(from, status)) {
    throw new DomainError('TREND_INVALID_TRANSITION', `Không thể chuyển trạng thái ${from} → ${status}.`, 409);
  }
  if (from === status) return;
  // Compare-and-set on the previous status so two staff clicking at once cannot skip the rules.
  const updated = await query('update trend_watch_items set status = $2 where id = $1 and status = $3', [id, status, from]);
  if (!updated.rowCount) throw new DomainError('TREND_CONFLICT', 'Trạng thái vừa được người khác thay đổi, hãy tải lại.', 409);
}

export async function deleteTrendWatchItem(id: string): Promise<void> {
  const result = await query('delete from trend_watch_items where id = $1', [id]);
  if (!result.rowCount) throw new DomainError('TREND_NOT_FOUND', 'Không tìm thấy mẫu trong Watchlist.', 404);
}
