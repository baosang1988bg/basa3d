import { z } from 'zod';
import { resolveMakerWorldUrl, parseMakerWorldUrl } from '@/lib/parsers/makerworld-resolver';
import { sanitizeMakerWorldImageUrl } from '@/lib/parsers/makerworld-image';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DomainError } from '@/lib/domain-error';

export type TrendPlatform =
  | 'MAKERWORLD'
  | 'MAKERWORLD_CN'
  | 'PRINTABLES'
  | 'THINGIVERSE'
  | 'THANGS'
  | 'DOUYIN'
  | 'OTHER';

export type TrendWatchStatus = 'WATCHING' | 'PRINT_TESTING' | 'CONVERTED_DRAFT' | 'ARCHIVED';

export type CommercialSafetyStatus =
  | 'COMMERCIAL_ALLOWED'
  | 'NON_COMMERCIAL'
  | 'COMMERCIAL_SUBSCRIPTION'
  | 'UNKNOWN';

export interface LicenseSafetyInfo {
  status: CommercialSafetyStatus;
  badgeLabel: string;
  badgeColor: string;
  explanation: string;
  canDirectSell: boolean;
  requiresAttribution: boolean;
}

const NON_COMMERCIAL_LICENSE_RE = /standard digital file license|non[\s-]?commercial|\bby-nc\b|\bnc\b/i;
const COMMERCIAL_SUBSCRIPTION_RE = /patreon|commercial\s+license|merchant|club/i;
const CC0_RE = /\bcc0\b|public\s+domain/i;
const CC_BY_RE = /cc[\s-]?by|\bby\s*4\.0|attribution/i;

export function evaluateLicenseSafety(license: string | null, notes?: string): LicenseSafetyInfo {
  if (!license && !notes) {
    return {
      status: 'UNKNOWN',
      badgeLabel: 'Chưa rõ bản quyền',
      badgeColor: 'bg-muted text-muted-foreground border-border',
      explanation: 'Không tìm thấy thông tin giấy phép. Khuyến nghị chỉ nhận in gia công theo yêu cầu cá nhân.',
      canDirectSell: false,
      requiresAttribution: false,
    };
  }

  const raw = `${license ?? ''} ${notes ?? ''}`;

  // Commercial Club / Patreon check
  if (COMMERCIAL_SUBSCRIPTION_RE.test(raw)) {
    return {
      status: 'COMMERCIAL_SUBSCRIPTION',
      badgeLabel: 'Cần Gói Hội Viên',
      badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
      explanation: 'Tác giả yêu cầu mua gói thương mại (Patreon / Club) để được bán bản in thành phẩm.',
      canDirectSell: false,
      requiresAttribution: true,
    };
  }

  // Non-commercial checks (Standard Digital File License / CC-NC)
  if (NON_COMMERCIAL_LICENSE_RE.test(raw)) {
    return {
      status: 'NON_COMMERCIAL',
      badgeLabel: 'Cấm Bán Lẻ (Chỉ In Gia Công)',
      badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800',
      explanation: 'Giấy phép cấm kinh doanh thương mại. Chỉ nhận in gia công theo yêu cầu cá nhân (Personal Use).',
      canDirectSell: false,
      requiresAttribution: true,
    };
  }

  // CC0 / Public domain
  if (CC0_RE.test(raw)) {
    return {
      status: 'COMMERCIAL_ALLOWED',
      badgeLabel: 'Tự Do Thương Mại (CC0)',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
      explanation: 'Thuộc phạm vi công cộng (Public Domain). Được phép in và bán thương mại tự do 100%.',
      canDirectSell: true,
      requiresAttribution: false,
    };
  }

  // CC-BY (Attribution without NC)
  if (CC_BY_RE.test(raw)) {
    return {
      status: 'COMMERCIAL_ALLOWED',
      badgeLabel: 'Được Bán (Ghi Công Tác Giả)',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
      explanation: 'Được phép in bán thương mại. Bắt buộc phải ghi công tác giả và dẫn link nguồn gốc.',
      canDirectSell: true,
      requiresAttribution: true,
    };
  }

  return {
    status: 'UNKNOWN',
    badgeLabel: 'Bản Quyền Mở',
    badgeColor: 'bg-muted text-muted-foreground border-border',
    explanation: 'Cần kiểm tra kỹ trang gốc trước khi quyết định bán thương mại.',
    canDirectSell: false,
    requiresAttribution: false,
  };
}

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

/**
 * Detects the platform of a model URL.
 */
export function detectTrendPlatform(rawUrl: string): TrendPlatform {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('makerworld.com.cn') || host.includes('makerworld.cn')) {
      return 'MAKERWORLD_CN';
    }
    if (host.includes('makerworld.com')) {
      return 'MAKERWORLD';
    }
    if (host.includes('printables.com')) {
      return 'PRINTABLES';
    }
    if (host.includes('thingiverse.com')) {
      return 'THINGIVERSE';
    }
    if (host.includes('thangs.com')) {
      return 'THANGS';
    }
    if (host.includes('douyin.com')) {
      return 'DOUYIN';
    }
    return 'OTHER';
  } catch {
    return 'OTHER';
  }
}

/**
 * Helper to fetch OpenGraph metadata with SSRF protection and timeouts.
 */
async function fetchOpenGraphMeta(url: string): Promise<{ title?: string; image?: string; description?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return {};

    const text = await res.text();

    const titleMatch = text.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      text.match(/<title>([^<]+)<\/title>/i);
    const imageMatch = text.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const descMatch = text.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);

    return {
      title: titleMatch?.[1]?.replace(/\s*\|.*$/, '').trim(),
      image: imageMatch?.[1]?.trim(),
      description: descMatch?.[1]?.trim(),
    };
  } catch {
    return {};
  }
}

/**
 * Captures model info from a URL on-demand.
 */
export async function captureModelFromUrl(rawUrl: string): Promise<TrendCapturedDraft> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new DomainError('INVALID_URL', 'Vui lòng cung cấp URL hợp lệ.', 400);
  }

  const platform = detectTrendPlatform(trimmed);

  // MakerWorld Global / China: use dedicated resolver
  if (platform === 'MAKERWORLD' || platform === 'MAKERWORLD_CN') {
    const parsedMw = parseMakerWorldUrl(trimmed);
    if (!parsedMw) {
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
      licenseSafety: evaluateLicenseSafety(resolved.license, undefined),
      estimatedGrams: defaultProfile?.netWeightGrams ?? null,
      estimatedPrintMinutes: defaultProfile?.printTimeMinutes ?? null,
      plateCount: defaultProfile?.platesCount ?? resolved.profiles.length,
      categoryTag: 'MakerWorld Hot',
    };
  }

  // Printables, Thingiverse, Thangs, Douyin, etc.
  const og = await fetchOpenGraphMeta(trimmed);

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
    licenseSafety: evaluateLicenseSafety(null, og.description),
    estimatedGrams: null,
    estimatedPrintMinutes: null,
    plateCount: null,
    categoryTag: defaultCategory,
    notes: og.description ? og.description.slice(0, 300) : undefined,
  };
}

export const trendWatchInputSchema = z.object({
  sourceUrl: z.string().url().max(2000),
  platform: z.enum(['MAKERWORLD', 'MAKERWORLD_CN', 'PRINTABLES', 'THINGIVERSE', 'THANGS', 'DOUYIN', 'OTHER']),
  title: z.string().trim().min(1).max(255),
  coverUrl: z.string().url().nullable().optional(),
  author: z.string().trim().max(120).nullable().optional(),
  license: z.string().trim().max(100).nullable().optional(),
  notes: z.string().max(1000).optional(),
  estimatedGrams: z.number().nonnegative().nullable().optional(),
  estimatedPrintMinutes: z.number().int().nonnegative().nullable().optional(),
  plateCount: z.number().int().positive().nullable().optional(),
  categoryTag: z.string().max(64).default('Chưa phân loại'),
  status: z.enum(['WATCHING', 'PRINT_TESTING', 'CONVERTED_DRAFT', 'ARCHIVED']).default('WATCHING'),
});

export type TrendWatchInput = z.infer<typeof trendWatchInputSchema>;

/**
 * Lists all trend watch items with fallback to memory if DB not ready.
 */
export async function listTrendWatchItems(): Promise<TrendWatchItem[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('trend_watch_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      sourceUrl: row.source_url,
      platform: row.platform,
      title: row.title,
      coverUrl: row.cover_url,
      author: row.author,
      license: row.license,
      licenseSafety: evaluateLicenseSafety(row.license, row.notes),
      notes: row.notes,
      estimatedGrams: row.estimated_grams ? Number(row.estimated_grams) : null,
      estimatedPrintMinutes: row.estimated_print_minutes,
      plateCount: row.plate_count,
      categoryTag: row.category_tag || 'Chưa phân loại',
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Saves a new item to the trend watchlist.
 */
export async function saveTrendWatchItem(input: TrendWatchInput, staffId?: string): Promise<{ id: string }> {
  const validated = trendWatchInputSchema.parse(input);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('trend_watch_items')
    .insert({
      source_url: validated.sourceUrl,
      platform: validated.platform,
      title: validated.title,
      cover_url: validated.coverUrl ?? null,
      author: validated.author ?? null,
      license: validated.license ?? null,
      notes: validated.notes ?? null,
      estimated_grams: validated.estimatedGrams ?? null,
      estimated_print_minutes: validated.estimatedPrintMinutes ?? null,
      plate_count: validated.plateCount ?? null,
      category_tag: validated.categoryTag,
      status: validated.status,
      created_by: staffId ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new DomainError('TREND_SAVE_FAILED', `Không thể lưu mẫu trend: ${error?.message || 'Database error'}`, 500);
  }

  return { id: data.id };
}

/**
 * Updates status of an item in the watchlist.
 */
export async function updateTrendWatchItemStatus(id: string, status: TrendWatchStatus): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('trend_watch_items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new DomainError('TREND_UPDATE_FAILED', `Không thể cập nhật trạng thái: ${error.message}`, 500);
  }
}

/**
 * Deletes an item from the watchlist.
 */
export async function deleteTrendWatchItem(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('trend_watch_items')
    .delete()
    .eq('id', id);

  if (error) {
    throw new DomainError('TREND_DELETE_FAILED', `Không thể xoá mẫu: ${error.message}`, 500);
  }
}
