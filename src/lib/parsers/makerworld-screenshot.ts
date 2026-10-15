// ADR-0039: pure helpers for the MakerWorld screenshot estimate. No network, no DB.
// - `visionOutputSchema` bounds EVERYTHING the vision model returns (it is third-party output and the
//   screenshot itself is customer-controlled, so it may contain prompt-injection text).
// - Time and weight are kept as the RAW text the model copied ("7.4 h", "168 g") and parsed with the
//   already-tested spec-text parser, so the model never does unit conversions for us.
// - `matchScreenshotToUrl` is model-level only; profile-level correctness is a staff check.
import { z } from 'zod';
import { parseMakerWorldSpecText } from './makerworld-spec-text';

export const SCREENSHOT_LIMITS = { maxProfiles: 10, maxText: 300, maxColors: 16, maxPlates: 200 } as const;

const boundedText = z.string().trim().max(SCREENSHOT_LIMITS.maxText).nullable().catch(null);
const shortText = z.string().trim().max(40).nullable().catch(null);

const rawProfileSchema = z.object({
  title: boundedText,
  printerTarget: shortText,
  printTimeText: shortText,
  weightText: shortText,
  platesCount: z.number().int().min(1).max(SCREENSHOT_LIMITS.maxPlates).nullable().catch(null),
  colorsCount: z.number().int().min(1).max(SCREENSHOT_LIMITS.maxColors).nullable().catch(null),
  ams: z.enum(['YES', 'NO', 'UNKNOWN']).catch('UNKNOWN'),
});

export const visionOutputSchema = z.object({
  isMakerWorldScreenshot: z.boolean(),
  modelTitle: boundedText,
  modelIdInImage: z.string().trim().regex(/^\d{1,20}$/).nullable().catch(null),
  // Extra profiles beyond the cap are dropped rather than failing the whole screenshot.
  profiles: z.array(z.unknown()).max(50).transform((items) => items.slice(0, SCREENSHOT_LIMITS.maxProfiles)),
});
export type VisionOutput = z.infer<typeof visionOutputSchema>;

export type ScreenshotProfile = {
  /** Server-assigned key (`p0`..`p9`) — never the profile title (titles can repeat). */
  key: string;
  title: string;
  printerTarget: string | null;
  printMinutes: number | null;
  netWeightGrams: number | null;
  platesCount: number | null;
  amsRequired: boolean | null;
  colorsCount: number | null;
  /** Print time or grams missing → never priced (a missing field must not become 0đ). */
  dataIncomplete: boolean;
};

export type ScreenshotMatchStatus = 'MATCH' | 'MISMATCH' | 'UNKNOWN';

export const PROFILE_KEY_RE = /^p\d{1,2}$/;

/** Print-time text as MakerWorld shows it: "7.4 h", "3h 20m", "1d 2h", "45 min", "1 ngày 2 giờ".
 * Days are handled here because the spec-text parser (built for pasted lines) only knows h/min —
 * "1d 2h" would otherwise read as 2 h and under-price a 26 h print. */
export function parseDurationText(text: string | null): number | null {
  if (!text) return null;
  const days = text.match(/(\d+(?:[.,]\d+)?)\s*(?:d|day|days|ngày)(?![a-z])/i);
  const rest = days ? text.replace(days[0], ' ') : text;
  const restMinutes = /\d/.test(rest) ? parseMakerWorldSpecText(rest).printMinutes : null;
  if (!days) return restMinutes;
  const dayMinutes = Number(days[1].replace(',', '.')) * 24 * 60;
  if (!Number.isFinite(dayMinutes)) return null;
  return Math.round(dayMinutes + (restMinutes ?? 0));
}

/** Returns null when the payload is not a usable vision result at all. */
export function normalizeVisionOutput(raw: unknown): { modelTitle: string | null; modelIdInImage: string | null; isMakerWorldScreenshot: boolean; profiles: ScreenshotProfile[] } | null {
  const parsed = visionOutputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const profiles: ScreenshotProfile[] = [];
  for (const item of parsed.data.profiles) {
    const profile = rawProfileSchema.safeParse(item ?? {});
    if (!profile.success) continue;
    const p = profile.data;
    const parsedTime = parseDurationText(p.printTimeText);
    const parsedWeight = p.weightText ? parseMakerWorldSpecText(p.weightText).netWeightGrams : null;
    const printMinutes = parsedTime !== null && parsedTime >= 1 && parsedTime <= 20_000 ? parsedTime : null;
    const netWeightGrams = parsedWeight !== null && parsedWeight >= 1 && parsedWeight <= 20_000 ? Math.round(parsedWeight * 100) / 100 : null;
    const key = `p${profiles.length}`;
    profiles.push({
      key,
      title: p.title || `Profile ${profiles.length + 1}`,
      printerTarget: p.printerTarget,
      printMinutes,
      netWeightGrams,
      platesCount: p.platesCount,
      amsRequired: p.ams === 'YES' ? true : p.ams === 'NO' ? false : null,
      colorsCount: p.colorsCount,
      dataIncomplete: printMinutes === null || netWeightGrams === null,
    });
  }
  return {
    modelTitle: parsed.data.modelTitle,
    modelIdInImage: parsed.data.modelIdInImage,
    isMakerWorldScreenshot: parsed.data.isMakerWorldScreenshot,
    profiles,
  };
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'of', 'an', 'to', 'in', 'on', 'by', 'no', 'ams', 'version', 'ver', 'v1', 'v2', 'v3', 'print', 'model', '3d']);

/** Lowercase ASCII tokens; Vietnamese diacritics folded ("Đèn ngủ" → "den", "ngu"). */
export function titleTokens(value: string | null | undefined): Set<string> {
  if (!value) return new Set();
  const folded = value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  return new Set(folded.split(/[^a-z0-9]+/).filter((token) => token.length >= 2 && !STOPWORDS.has(token)));
}

export function slugOf(sourceUrl: string): string | null {
  try {
    const match = new URL(sourceUrl).pathname.match(/\/models\/\d+-([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/** Model-level link ↔ screenshot check (plan D7). */
export function matchScreenshotToUrl(input: { modelId: string; sourceUrl: string; modelIdInImage: string | null; modelTitle: string | null }): ScreenshotMatchStatus {
  if (input.modelIdInImage) return input.modelIdInImage === input.modelId ? 'MATCH' : 'MISMATCH';
  const slug = titleTokens(slugOf(input.sourceUrl));
  const title = titleTokens(input.modelTitle);
  if (!slug.size || !title.size) return 'UNKNOWN';
  let shared = 0;
  for (const token of slug) if (title.has(token)) shared += 1;
  const ratio = shared / Math.min(slug.size, title.size);
  if (ratio >= 0.5) return 'MATCH';
  // MISMATCH hides the price, so text alone only says so when both sides are substantial (≥ 2
  // tokens each) and share nothing — a one-word or translated title stays UNKNOWN for staff.
  if (shared === 0 && slug.size >= 2 && title.size >= 2) return 'MISMATCH';
  return 'UNKNOWN';
}

/** Spec line in the format parseMakerWorldSpecText reads back — stored on the custom request so the
 * admin page and the Phase A panel pre-fill exactly like a pasted spec (plan D10). */
// The title goes LAST: the parser takes the first number+unit it sees, and a title like "50 g version"
// must not shadow the real values.
export function profileSpecLine(profile: ScreenshotProfile): string {
  const parts: string[] = [];
  if (profile.printerTarget) parts.push(profile.printerTarget);
  if (profile.printMinutes !== null) parts.push(`${Math.floor(profile.printMinutes / 60)} h ${profile.printMinutes % 60} min`);
  if (profile.platesCount !== null) parts.push(`${profile.platesCount} plates`);
  if (profile.netWeightGrams !== null) parts.push(`${profile.netWeightGrams} g`);
  if (profile.amsRequired !== null) parts.push(profile.amsRequired ? 'AMS' : 'No AMS');
  parts.push(profile.title);
  return parts.join(' · ').slice(0, 2_000);
}
