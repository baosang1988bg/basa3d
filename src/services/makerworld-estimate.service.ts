// Phase B public MakerWorld estimate (makerworld-phase-b-storefront-estimate.md §1, §3, ADR-0033).
// Three sources, in order:
//   1. VERIFIED — presets staff saved from the admin panel, re-priced with today's config (DB only,
//      never calls MakerWorld → works from Vercel even when Cloudflare blocks us).
//   2. AUTO     — server resolver + the SAME shared pricing rules with median material cost; behind
//      MAKERWORLD_PUBLIC_RESOLVER_ENABLED (default off), cached 24h per model, global hourly budget.
//   3. NONE     — no price; the customer can still send a request.
// The returned DTO never contains breakdowns, unit costs, config ids or margin (B1).
import { query } from '../lib/db';
import { getCurrentPricingConfig } from './pricing-config.service';
import { listMaterials } from './inventory.service';
import { resolveMaterialUnitCostVndPerGram } from './pricing.service';
import { lookupVerifiedPrices } from './makerworld-price-preset.service';
import {
  MakerWorldResolverError,
  parseMakerWorldUrl,
  resolveMakerWorldUrl,
  type FetchLike,
  type MakerWorldResolution,
} from '../lib/parsers/makerworld-resolver';
import {
  buildMakerWorldMaterialLines,
  defaultLaborMinutes,
  medianUnitCostByMaterialType,
  priceMakerWorldLines,
} from '../lib/pricing/makerworld-pricing';
import { ASSEMBLY_TIER_KEYS, type AssemblyTier } from '../lib/pricing/assembly-tiers';

export const RESOLVER_CACHE_TTL_HOURS = 24;
/** Failed lookups (Cloudflare block, timeout) are only cached briefly so a transient block doesn't
 * hide a model's price for a whole day. */
export const RESOLVER_NEGATIVE_CACHE_TTL_MINUTES = 10;
export const RESOLVER_GLOBAL_BUDGET_PER_HOUR = 30;
export const AUTO_ESTIMATE_ROUNDING_VND = 5_000;

export type EstimateSource = 'VERIFIED' | 'AUTO' | 'NONE';
export type EstimateReason = 'OK' | 'BLOCKED' | 'BUSY' | 'NO_PRICING_CONFIG' | 'INCOMPLETE' | 'NOT_VERIFIED';

export type PublicEstimateProfile = {
  profileId: string;
  profileTitle: string;
  imageUrl: string | null;
  printerTarget: string | null;
  printMinutes: number;
  platesCount: number;
  netWeightGrams: number;
  amsRequired: boolean | null;
  prices: Record<AssemblyTier, number | null>;
};

export type PublicMakerWorldEstimate = {
  modelId: string;
  modelTitle: string | null;
  sourceUrl: string;
  source: EstimateSource;
  reason: EstimateReason;
  license: string | null;
  profiles: PublicEstimateProfile[];
  /** The #profileId from the pasted link, when it is one of `profiles`. */
  selectedProfileId: string | null;
  /** The #profileId from the pasted link (even if it has no price) — UI explains "chưa có giá". */
  requestedProfileId: string | null;
};

export function isPublicResolverEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MAKERWORLD_PUBLIC_RESOLVER_ENABLED === 'true';
}

export function roundAutoEstimate(value: number): number {
  return Math.round(value / AUTO_ESTIMATE_ROUNDING_VND) * AUTO_ESTIMATE_ROUNDING_VND;
}

/** Strip the URL to model + optional profile (no query/tracking params) for storage/display. */
function canonicalSourceUrl(rawUrl: string): string {
  const parsed = parseMakerWorldUrl(rawUrl);
  const url = new URL(parsed.url.toString());
  url.search = '';
  url.hash = parsed.profileId ? `profileId-${parsed.profileId}` : '';
  return url.toString();
}

async function verifiedEstimate(modelId: string, requestedProfileId: string | null, sourceUrl: string): Promise<PublicMakerWorldEstimate | null> {
  const verified = await lookupVerifiedPrices(modelId);
  if (!verified.profiles.length && !verified.noPricingConfig) return null;
  if (verified.noPricingConfig) {
    return { modelId, modelTitle: null, sourceUrl, source: 'NONE', reason: 'NO_PRICING_CONFIG', license: null, profiles: [], selectedProfileId: null, requestedProfileId };
  }
  const profiles = verified.profiles.map((entry): PublicEstimateProfile => ({
    profileId: entry.profileId,
    profileTitle: entry.snapshot.profileTitle,
    imageUrl: entry.snapshot.profileCoverImageUrl,
    printerTarget: entry.snapshot.printerTarget,
    printMinutes: entry.snapshot.printMinutes,
    platesCount: entry.snapshot.platesCount,
    netWeightGrams: entry.snapshot.netWeightGrams,
    amsRequired: entry.snapshot.amsRequired,
    prices: entry.prices,
  }));
  const first = verified.profiles[0].snapshot;
  return {
    modelId, modelTitle: first.modelTitle, sourceUrl, source: 'VERIFIED', reason: 'OK', license: first.license,
    profiles,
    selectedProfileId: requestedProfileId && profiles.some((p) => p.profileId === requestedProfileId) ? requestedProfileId : null,
    requestedProfileId,
  };
}

type CachedResolution = { resolution: MakerWorldResolution | null; outcome: string };

async function resolveWithCacheAndBudget(rawUrl: string, modelId: string, fetchImpl?: FetchLike): Promise<CachedResolution | 'BUSY'> {
  const cached = await query<{ resolution: MakerWorldResolution | null; outcome: string }>(
    `select resolution, outcome from makerworld_resolver_cache
     where model_id = $1 and (
       (outcome = 'OK' and fetched_at > now() - ($2::int * interval '1 hour'))
       or (outcome <> 'OK' and fetched_at > now() - ($3::int * interval '1 minute')))`,
    [modelId, RESOLVER_CACHE_TTL_HOURS, RESOLVER_NEGATIVE_CACHE_TTL_MINUTES]);
  if (cached.rowCount) return cached.rows[0];
  // Global budget: count only cache writes (one per real MakerWorld call) — bounded work, no per-IP rows.
  const recent = await query<{ count: string }>(`select count(*) from makerworld_resolver_cache where fetched_at > now() - interval '1 hour'`);
  if (Number(recent.rows[0].count) >= RESOLVER_GLOBAL_BUDGET_PER_HOUR) return 'BUSY';

  let resolution: MakerWorldResolution | null = null;
  let outcome = 'OK';
  try {
    resolution = await resolveMakerWorldUrl(rawUrl, { fetchImpl });
  } catch (error) {
    if (!(error instanceof MakerWorldResolverError)) throw error;
    outcome = error.kind;
  }
  console.info('[MAKERWORLD_RESOLVER]', { outcome, channel: 'public' });
  await query(
    `insert into makerworld_resolver_cache (model_id, resolution, outcome, fetched_at) values ($1, $2, $3, now())
     on conflict (model_id) do update set resolution = excluded.resolution, outcome = excluded.outcome, fetched_at = excluded.fetched_at`,
    [modelId, resolution ? JSON.stringify(resolution) : null, outcome]);
  return { resolution, outcome };
}

async function autoEstimate(rawUrl: string, modelId: string, requestedProfileId: string | null, sourceUrl: string, fetchImpl?: FetchLike): Promise<PublicMakerWorldEstimate> {
  const none = (reason: EstimateReason, extra: Partial<PublicMakerWorldEstimate> = {}): PublicMakerWorldEstimate => ({
    modelId, modelTitle: null, sourceUrl, source: 'NONE', reason, license: null, profiles: [], selectedProfileId: null, requestedProfileId, ...extra,
  });
  const result = await resolveWithCacheAndBudget(rawUrl, modelId, fetchImpl);
  if (result === 'BUSY') return none('BUSY');
  if (!result.resolution) return none('BLOCKED');
  const { resolution } = result;

  const config = await getCurrentPricingConfig();
  const display = { modelTitle: resolution.modelTitle, license: resolution.license };
  if (!config) return none('NO_PRICING_CONFIG', display);
  const materials = await listMaterials();
  const medians = medianUnitCostByMaterialType(materials.map((m) => ({ materialType: m.materialType, unitCostVndPerGram: resolveMaterialUnitCostVndPerGram(m) })));

  const profiles = resolution.profiles.map((profile): PublicEstimateProfile => {
    const prices: Record<AssemblyTier, number | null> = { ASSEMBLED: null, KIT: null };
    if (!profile.dataIncomplete) {
      for (const tier of ASSEMBLY_TIER_KEYS) {
        const lines = buildMakerWorldMaterialLines({
          filaments: profile.filaments,
          colorsCount: profile.filaments.length,
          // Customers can't be asked "AMS or not?". When MakerWorld doesn't say, price the
          // conservative case (AMS purge waste) so an automatic estimate never undercharges.
          amsRequired: profile.amsRequired ?? true,
          tier,
          choices: profile.filaments.map((f) => ({ unitCostVndPerGram: medians.get(f.materialType.trim().toUpperCase()) ?? null })),
        });
        const breakdown = lines ? priceMakerWorldLines({ lines, printMinutes: profile.printTimeMinutes, laborMinutes: defaultLaborMinutes(tier, profile.platesCount), config }) : null;
        prices[tier] = breakdown ? roundAutoEstimate(breakdown.finalPriceVnd) : null;
      }
    }
    return {
      profileId: profile.profileId, profileTitle: profile.profileTitle, imageUrl: profile.profileCoverImageUrl ?? resolution.modelCoverImageUrl,
      printerTarget: profile.printerTarget, printMinutes: profile.printTimeMinutes, platesCount: profile.platesCount,
      netWeightGrams: profile.netWeightGrams, amsRequired: profile.amsRequired, prices,
    };
  });
  const anyPrice = profiles.some((p) => p.prices.ASSEMBLED !== null || p.prices.KIT !== null);
  return {
    modelId, modelTitle: resolution.modelTitle, sourceUrl, source: anyPrice ? 'AUTO' : 'NONE', reason: anyPrice ? 'OK' : 'INCOMPLETE',
    license: resolution.license, profiles,
    selectedProfileId: resolution.activeProfileId && profiles.some((p) => p.profileId === resolution.activeProfileId) ? resolution.activeProfileId : null,
    requestedProfileId,
  };
}

/** Throws MakerWorldNotFoundError for an invalid/non-MakerWorld URL (route → 400). */
export async function estimateMakerWorldUrl(rawUrl: string, options: { fetchImpl?: FetchLike; env?: Record<string, string | undefined> } = {}): Promise<PublicMakerWorldEstimate> {
  const parsed = parseMakerWorldUrl(rawUrl);
  const sourceUrl = canonicalSourceUrl(rawUrl);
  const verified = await verifiedEstimate(parsed.modelId, parsed.profileId, sourceUrl);
  if (verified) return verified;
  if (isPublicResolverEnabled(options.env)) return autoEstimate(rawUrl, parsed.modelId, parsed.profileId, sourceUrl, options.fetchImpl);
  return { modelId: parsed.modelId, modelTitle: null, sourceUrl, source: 'NONE', reason: 'NOT_VERIFIED', license: null, profiles: [], selectedProfileId: null, requestedProfileId: parsed.profileId };
}

/** Reference price for one (profile, tier), recomputed server-side — stored with a customer's intake
 * so staff see which number the customer was shown. Never taken from the browser. */
export async function referencePriceFor(rawUrl: string, profileId: string | null, tier: AssemblyTier): Promise<{ source: EstimateSource; priceVnd: number | null; modelTitle: string | null; profileTitle: string | null }> {
  try {
    const estimate = await estimateMakerWorldUrl(rawUrl);
    const profile = profileId ? estimate.profiles.find((p) => p.profileId === profileId) : estimate.profiles.length === 1 ? estimate.profiles[0] : undefined;
    return { source: profile ? estimate.source : 'NONE', priceVnd: profile?.prices[tier] ?? null, modelTitle: estimate.modelTitle, profileTitle: profile?.profileTitle ?? null };
  } catch {
    return { source: 'NONE', priceVnd: null, modelTitle: null, profileTitle: null };
  }
}
