// ADR-0039 / docs/exec-plans/active/makerworld-screenshot-estimate.md.
// Link + screenshot arrive in ONE request; the result is stored server-side and the browser only gets
// an id + profile keys. Submission reads the stored row back (never trusts the browser) and the row is
// consumed in the custom-request transaction (custom-request.service.ts).
import { query } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { createDatabaseRateLimiter } from '../lib/rate-limit';
import { parseMakerWorldUrl } from '../lib/parsers/makerworld-resolver';
import {
  matchScreenshotToUrl,
  normalizeVisionOutput,
  profileSpecLine,
  type ScreenshotMatchStatus,
  type ScreenshotProfile,
} from '../lib/parsers/makerworld-screenshot';
import { extractMakerWorldScreenshotJson, VisionUnavailableError, type VisionImage } from '../lib/vision/gemini-vision';
import { estimateFromSpec, loadPricingContext, type PricingContext } from './instant-estimate.service';
import { canonicalSourceUrl, type EstimateReason, type PublicEstimateProfile, type PublicMakerWorldEstimate } from './makerworld-estimate.service';
import { downloadCustomRequestAttachment, inspectUploadedObject, type CustomRequestMakerWorldSnapshot } from './custom-request.service';
import type { AssemblyTier } from '../lib/pricing/assembly-tiers';

export const SCREENSHOT_ESTIMATE_TTL_MINUTES = 120;
export const SCREENSHOT_GLOBAL_BUDGET_PER_HOUR = 200;
export const SCREENSHOT_MAX_BYTES = 8 * 1024 * 1024;
/** Unconsumed rows older than this are deleted by the daily cron. */
export const SCREENSHOT_RETENTION_DAYS = 2;

const SCREENSHOT_PATH_RE = /^requests\/[0-9a-f-]+\.(jpg|jpeg|png|webp)$/;
const MIME_BY_EXTENSION: Record<string, VisionImage['mimeType']> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export function isScreenshotEstimateEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MAKERWORLD_SCREENSHOT_ESTIMATE_ENABLED === 'true' && Boolean(env.GEMINI_API_KEY);
}

export type StoredScreenshotProfile = ScreenshotProfile & { prices: Record<AssemblyTier, number | null> };

export type PublicScreenshotEstimate = PublicMakerWorldEstimate & {
  /** null when nothing was stored (unreadable screenshot, vision down, busy). */
  screenshotEstimateId: string | null;
  matchStatus: ScreenshotMatchStatus | null;
};

type StoreInput = {
  modelId: string; sourceUrl: string; requestedProfileId: string | null; attachmentPath: string;
  modelTitleExtracted: string | null; matchStatus: ScreenshotMatchStatus; profiles: StoredScreenshotProfile[];
};

export type ScreenshotEstimateDeps = {
  inspect: (path: string) => Promise<{ sizeBytes: number }>;
  download: (path: string) => Promise<Uint8Array>;
  extract: (image: VisionImage) => Promise<unknown>;
  pricingContext: () => Promise<PricingContext | null>;
  /** Global hourly budget for vision calls. true = over budget. */
  overBudget: () => Promise<boolean>;
  /** true when this image already has an estimate row (unique attachment_path). */
  alreadyUsed: (path: string) => Promise<boolean>;
  store: (input: StoreInput) => Promise<string>;
};

const isGlobalBudgetExceeded = createDatabaseRateLimiter({
  scope: 'makerworld-screenshot-global', maxRequests: SCREENSHOT_GLOBAL_BUDGET_PER_HOUR, windowMs: 60 * 60_000,
});

async function storeEstimate(input: StoreInput): Promise<string> {
  try {
    const result = await query<{ id: string }>(`
      insert into makerworld_screenshot_estimates
        (model_id, source_url, requested_profile_id, attachment_path, model_title_extracted, match_status, profiles, expires_at)
      values ($1, $2, $3, $4, $5, $6, $7, now() + ($8::int * interval '1 minute'))
      returning id`, [
      input.modelId, input.sourceUrl, input.requestedProfileId, input.attachmentPath, input.modelTitleExtracted,
      input.matchStatus, JSON.stringify(input.profiles), SCREENSHOT_ESTIMATE_TTL_MINUTES,
    ]);
    return result.rows[0].id;
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new DomainError('SCREENSHOT_ALREADY_USED', 'Ảnh này đã được dùng để xem giá — vui lòng tải ảnh lên lại.', 409);
    }
    throw error;
  }
}

const defaultDeps: ScreenshotEstimateDeps = {
  inspect: (path) => inspectUploadedObject(path),
  download: downloadCustomRequestAttachment,
  extract: (image) => extractMakerWorldScreenshotJson(image),
  pricingContext: loadPricingContext,
  overBudget: () => isGlobalBudgetExceeded('global'),
  alreadyUsed: async (path) => Boolean((await query('select 1 from makerworld_screenshot_estimates where attachment_path = $1', [path])).rowCount),
  store: storeEstimate,
};

function priceProfile(ctx: PricingContext, profile: ScreenshotProfile): Record<AssemblyTier, number | null> {
  const prices: Record<AssemblyTier, number | null> = { ASSEMBLED: null, KIT: null };
  if (profile.dataIncomplete) return prices;
  const estimate = estimateFromSpec(ctx, {
    printMinutes: profile.printMinutes,
    netWeightGrams: profile.netWeightGrams,
    platesCount: profile.platesCount,
    amsRequired: profile.amsRequired,
    colorsCount: profile.colorsCount,
  }, { forceTiers: true });
  for (const option of estimate?.options ?? []) {
    if (option.key === 'ASSEMBLED' || option.key === 'KIT') prices[option.key] = option.priceVnd;
  }
  return prices;
}

function toPublicProfile(profile: StoredScreenshotProfile, hidePrices: boolean): PublicEstimateProfile {
  return {
    profileId: profile.key,
    profileTitle: profile.title,
    imageUrl: null,
    printerTarget: profile.printerTarget,
    printMinutes: profile.printMinutes ?? 0,
    platesCount: profile.platesCount ?? 0,
    netWeightGrams: profile.netWeightGrams ?? 0,
    amsRequired: profile.amsRequired,
    prices: hidePrices ? { ASSEMBLED: null, KIT: null } : profile.prices,
    dataIncomplete: profile.dataIncomplete,
  };
}

/**
 * Throws MakerWorldNotFoundError for a bad link (route → 400) and DomainError for a bad/oversized
 * upload. Everything else is a normal 200 with a `reason` so the customer can still send a request.
 */
export async function estimateMakerWorldScreenshot(
  input: { url: string; attachmentPath: string },
  deps: ScreenshotEstimateDeps = defaultDeps,
): Promise<PublicScreenshotEstimate> {
  const parsed = parseMakerWorldUrl(input.url);
  const sourceUrl = canonicalSourceUrl(input.url);
  const extension = SCREENSHOT_PATH_RE.exec(input.attachmentPath)?.[1];
  if (!extension) throw new DomainError('INVALID_SCREENSHOT', 'Vui lòng tải lên ảnh chụp màn hình (JPG, PNG hoặc WEBP).', 400);

  const none = (reason: EstimateReason, extra: Partial<PublicScreenshotEstimate> = {}): PublicScreenshotEstimate => ({
    modelId: parsed.modelId, modelTitle: null, sourceUrl, source: 'NONE', reason, license: null, profiles: [],
    selectedProfileId: null, requestedProfileId: parsed.profileId, screenshotEstimateId: null, matchStatus: null, ...extra,
  });

  // Cheap check before any paid call; the unique index in storeEstimate still settles a race.
  if (await deps.alreadyUsed(input.attachmentPath)) {
    throw new DomainError('SCREENSHOT_ALREADY_USED', 'Ảnh này đã được dùng để xem giá — vui lòng tải ảnh lên lại.', 409);
  }
  const { sizeBytes } = await deps.inspect(input.attachmentPath);
  if (sizeBytes > SCREENSHOT_MAX_BYTES) throw new DomainError('SCREENSHOT_TOO_LARGE', 'Ảnh quá lớn (tối đa 8MB) — hãy chụp lại hoặc cắt bớt ảnh.', 400);
  const ctx = await deps.pricingContext();
  if (!ctx) return none('NO_PRICING_CONFIG');
  if (await deps.overBudget()) return none('BUSY');

  const bytes = await deps.download(input.attachmentPath);
  let raw: unknown;
  try {
    raw = await deps.extract({ bytes, mimeType: MIME_BY_EXTENSION[extension] });
  } catch (error) {
    if (!(error instanceof VisionUnavailableError)) throw error;
    console.warn('[MAKERWORLD_SCREENSHOT]', { outcome: 'VISION_UNAVAILABLE', detail: error.message });
    return none('SCREENSHOT_UNAVAILABLE');
  }
  const vision = normalizeVisionOutput(raw);
  if (!vision || !vision.isMakerWorldScreenshot || vision.profiles.length === 0) {
    console.info('[MAKERWORLD_SCREENSHOT]', { outcome: 'UNREADABLE' });
    return none('SCREENSHOT_UNREADABLE');
  }

  const matchStatus = matchScreenshotToUrl({ modelId: parsed.modelId, sourceUrl, modelIdInImage: vision.modelIdInImage, modelTitle: vision.modelTitle });
  const profiles: StoredScreenshotProfile[] = vision.profiles.map((profile) => ({ ...profile, prices: priceProfile(ctx, profile) }));
  const screenshotEstimateId = await deps.store({
    modelId: parsed.modelId, sourceUrl, requestedProfileId: parsed.profileId, attachmentPath: input.attachmentPath,
    modelTitleExtracted: vision.modelTitle, matchStatus, profiles,
  });

  const hidePrices = matchStatus === 'MISMATCH';
  const publicProfiles = profiles.map((profile) => toPublicProfile(profile, hidePrices));
  const anyPrice = publicProfiles.some((p) => p.prices.ASSEMBLED !== null || p.prices.KIT !== null);
  const complete = publicProfiles.filter((p) => !p.dataIncomplete);
  console.info('[MAKERWORLD_SCREENSHOT]', { outcome: 'OK', profiles: profiles.length, complete: complete.length, matchStatus });
  return {
    modelId: parsed.modelId,
    modelTitle: vision.modelTitle,
    sourceUrl,
    source: anyPrice ? 'SCREENSHOT' : 'NONE',
    reason: hidePrices ? 'SCREENSHOT_MISMATCH' : anyPrice ? 'OK' : 'INCOMPLETE',
    license: null,
    profiles: publicProfiles,
    // Plan D6: pre-select only when exactly one profile was read AND it is complete.
    selectedProfileId: publicProfiles.length === 1 && complete.length === 1 ? publicProfiles[0].profileId : null,
    requestedProfileId: parsed.profileId,
    screenshotEstimateId,
    matchStatus,
  };
}

type StoredRow = {
  id: string; model_id: string; source_url: string; requested_profile_id: string | null; attachment_path: string;
  model_title_extracted: string | null; match_status: ScreenshotMatchStatus; profiles: StoredScreenshotProfile[];
};

export type ScreenshotSubmission = { snapshot: CustomRequestMakerWorldSnapshot; attachmentPath: string; screenshotEstimateId: string };

/** Pure — exported for tests. Builds the custom-request snapshot from a stored row. */
export function buildScreenshotSubmission(row: StoredRow, input: { sourceUrl: string; profileKey: string; tier: AssemblyTier }, now = new Date()): ScreenshotSubmission {
  if (canonicalSourceUrl(input.sourceUrl) !== row.source_url) {
    throw new DomainError('SCREENSHOT_URL_MISMATCH', 'Link MakerWorld đã thay đổi sau khi xem giá — vui lòng xem giá lại.', 400);
  }
  const profile = row.profiles.find((p) => p.key === input.profileKey);
  if (!profile) throw new DomainError('SCREENSHOT_PROFILE_NOT_FOUND', 'Không tìm thấy profile bạn chọn — vui lòng xem giá lại.', 400);
  const price = row.match_status === 'MISMATCH' ? null : profile.prices[input.tier] ?? null;
  return {
    attachmentPath: row.attachment_path,
    screenshotEstimateId: row.id,
    snapshot: {
      sourceUrl: row.source_url,
      modelId: row.model_id,
      profileId: row.requested_profile_id,
      modelTitle: row.model_title_extracted,
      profileTitle: profile.title,
      tier: input.tier,
      profileConfirmed: true,
      estimateSource: price === null ? 'NONE' : 'SCREENSHOT',
      estimatedPriceVnd: price,
      estimatedAt: now.toISOString(),
      specText: profileSpecLine(profile),
      screenshot: {
        estimateId: row.id,
        matchStatus: row.match_status,
        modelTitleExtracted: row.model_title_extracted,
        selectedProfileKey: profile.key,
        profiles: row.profiles.map((p) => ({ key: p.key, title: p.title, specLine: profileSpecLine(p), dataIncomplete: p.dataIncomplete })),
      },
    },
  };
}

/** Reads an unconsumed, unexpired estimate. The row is consumed later, inside the create transaction. */
export async function loadScreenshotSubmission(input: { screenshotEstimateId: string; sourceUrl: string; profileKey: string; tier: AssemblyTier }): Promise<ScreenshotSubmission> {
  const result = await query<StoredRow>(`
    select id, model_id, source_url, requested_profile_id, attachment_path, model_title_extracted, match_status, profiles
    from makerworld_screenshot_estimates
    where id = $1 and consumed_at is null and expires_at > now()`, [input.screenshotEstimateId]);
  if (!result.rowCount) {
    throw new DomainError('SCREENSHOT_ESTIMATE_USED', 'Ảnh báo giá này đã được dùng hoặc đã hết hạn — vui lòng chụp và xem giá lại.', 409);
  }
  return buildScreenshotSubmission(result.rows[0], input);
}

/** Daily cron: delete estimates nobody submitted. Their images are removed by the orphan-upload cron. */
export async function cleanupExpiredScreenshotEstimates(): Promise<number> {
  const result = await query(
    `delete from makerworld_screenshot_estimates where consumed_at is null and created_at < now() - ($1::int * interval '1 day')`,
    [SCREENSHOT_RETENTION_DAYS]);
  return result.rowCount ?? 0;
}
