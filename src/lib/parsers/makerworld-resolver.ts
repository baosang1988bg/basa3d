// Phase 13: MakerWorld URL resolver — parses a staff-pasted MakerWorld model link and fetches its
// print profile metadata server-side (title, cover image, plate count, print time, filaments).
// Extended by makerworld-profile-verification Phase A: returns ALL print profiles of the model so
// staff can pick + visually verify the exact one (a model like 3246150 has a 170g No-AMS profile and
// a 285g profile — pricing the wrong one is a data-integrity bug, not a cosmetic one).
//
// SECURITY (this is the first outbound third-party fetch() in the codebase — no existing pattern to
// copy, see phase-13.md decision #1, "Bổ sung sau Claude review" rounds 1/2):
// - Hostname allowlist (`*.makerworld.com`, https only) is checked BEFORE the initial fetch AND
//   before following any redirect hop — `fetch()`'s default `redirect: 'follow'` does not
//   re-validate the hostname per hop, which is the classic SSRF-via-redirect vector. We use
//   `redirect: 'manual'` and manually inspect/validate the `Location` header ourselves.
// - ONE AbortController deadline (6s) covers the whole redirect chain AND the body read — previously
//   5s per hop, i.e. up to 20s worst case.
// - The response body is read as a stream and capped at 3 MB, so a huge/hostile page cannot blow up
//   server memory.
// - Every value taken from the third-party payload is validated with Zod (bounded numbers/arrays/
//   strings) before it reaches pricing — a NaN would otherwise make computePricingBreakdown throw
//   inside the admin panel's render.
// - Image URLs go through sanitizeMakerWorldImageUrl (makerworld-image.ts) — never rendered raw.
// - Residual risk (documented, not solved here): this hostname allowlist does not pin the resolved
//   IP address. A DNS-rebinding attack against makerworld.com's own DNS would not be caught by a
//   hostname check alone — that would require a custom `dns.lookup`/undici `Agent` hook. Out of scope
//   (the attacker only controls the pasted URL, not makerworld.com's DNS).
//
// PARSING STRATEGY (assumption, documented — still NOT verified against the live site, no public
// MakerWorld API is documented anywhere):
// MakerWorld's model detail page is assumed to be a Next.js app that embeds its page data in
// `<script id="__NEXT_DATA__">` at `props.pageProps.designDetail`. Per-instance field names below
// accept a few plausible aliases (`title`/`name`, `cover`/`coverUrl`/`pictureUrl`, ...). If the real
// payload differs, `RawMakerWorldInstance` + `normalizeInstance` are the only place to fix — the HTTP
// layer (allowlist, redirect validation, deadline, size cap, error classification) is independent.

import { z } from 'zod';
import { sanitizeMakerWorldImageUrl } from './makerworld-image';

const ALLOWED_HOST_SUFFIX = 'makerworld.com';
export const MAKERWORLD_FETCH_DEADLINE_MS = 6_000;
export const MAKERWORLD_MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; BaSa3DQuoteBot/1.0; +https://basa3d.vn)';

export const MAKERWORLD_LIMITS = {
  maxProfiles: 50,
  maxFilaments: 16,
  maxPrintMinutes: 20_000,
  maxGrams: 20_000,
  maxPlates: 200,
  maxTitleLength: 300,
} as const;

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class MakerWorldResolverError extends Error {
  constructor(public readonly kind: 'BLOCKED_OR_TIMEOUT' | 'NOT_FOUND' | 'PROFILE_NOT_FOUND', message: string) {
    super(message);
  }
}

/** (a) Request timed out, or the response looks like an anti-bot block (Cloudflare 403/503/429). */
export class MakerWorldBlockedOrTimeoutError extends MakerWorldResolverError {
  constructor(message = 'MakerWorld không phản hồi kịp hoặc đang chặn truy cập tự động (Cloudflare).') {
    super('BLOCKED_OR_TIMEOUT', message);
  }
}

/** (b) URL is not a valid/allowlisted MakerWorld model URL, or the model page itself is a 404. */
export class MakerWorldNotFoundError extends MakerWorldResolverError {
  constructor(message = 'Link MakerWorld không hợp lệ hoặc không tìm thấy mẫu.') {
    super('NOT_FOUND', message);
  }
}

/** (c) The model page loaded, but its print-profile data is missing or malformed. */
export class MakerWorldProfileNotFoundError extends MakerWorldResolverError {
  constructor(message = 'Không đọc được danh sách profile in trên trang MakerWorld — có thể tác giả đã xoá hoặc trang đổi cấu trúc.') {
    super('PROFILE_NOT_FOUND', message);
  }
}

export type ParsedMakerWorldUrl = { modelId: string; profileId: string | null; url: URL };

function isAllowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === ALLOWED_HOST_SUFFIX || host.endsWith(`.${ALLOWED_HOST_SUFFIX}`);
}

function isAllowedMakerWorldUrl(url: URL): boolean {
  return url.protocol === 'https:' && isAllowedHostname(url.hostname) && !url.username && !url.password && !url.port;
}

/** Boundary check reused by the quote snapshot schema: a `sourceUrl` must be an https MakerWorld
 * model URL. Never throws. */
export function isMakerWorldModelUrl(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  try {
    parseMakerWorldUrl(raw);
    return true;
  } catch {
    return false;
  }
}

/** Parses e.g. `https://makerworld.com/en/models/2851863-ace-snail#profileId-3334843` into
 * `{ modelId: '2851863', profileId: '3334843' }`. Validates the hostname allowlist here too, so
 * callers never need to fetch an unvalidated URL. */
export function parseMakerWorldUrl(rawUrl: string): ParsedMakerWorldUrl {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new MakerWorldNotFoundError('Link không đúng định dạng URL.');
  }
  if (!isAllowedMakerWorldUrl(url)) {
    throw new MakerWorldNotFoundError('Chỉ chấp nhận link từ makerworld.com (https).');
  }
  const modelMatch = url.pathname.match(/\/models\/(\d+)/);
  if (!modelMatch) {
    throw new MakerWorldNotFoundError('Không tìm thấy mã model (models/<id>) trong link.');
  }
  const profileMatch = url.hash.match(/profileId-(\d+)/) ?? url.search.match(/profileId=(\d+)/);
  return { modelId: modelMatch[1], profileId: profileMatch ? profileMatch[1] : null, url };
}

async function readBodyWithCap(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new MakerWorldBlockedOrTimeoutError('Trang MakerWorld trả về dữ liệu quá lớn — từ chối đọc.');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new MakerWorldBlockedOrTimeoutError('Trang MakerWorld trả về dữ liệu quá lớn — từ chối đọc.');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

type FetchSafelyOptions = { deadlineMs: number; maxBytes: number };

/** SSRF-safe GET: manual redirect handling (re-validates hostname allowlist on every hop), ONE
 * deadline for the whole chain + body read, and a streamed body size cap. */
async function fetchSafely(startUrl: URL, fetchImpl: FetchLike, options: FetchSafelyOptions): Promise<string> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.deadlineMs);
  const deadline = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new MakerWorldBlockedOrTimeoutError()), { once: true });
  });
  // Prevent an unhandled rejection when the deadline fires after we've already returned.
  deadline.catch(() => undefined);

  try {
    let currentUrl = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      let response: Response;
      try {
        response = await Promise.race([
          fetchImpl(currentUrl, {
            redirect: 'manual',
            signal: controller.signal,
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
            },
          }),
          deadline,
        ]);
      } catch (error) {
        if (error instanceof MakerWorldResolverError) throw error;
        if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
          throw new MakerWorldBlockedOrTimeoutError();
        }
        throw new MakerWorldBlockedOrTimeoutError('Không thể kết nối tới MakerWorld.');
      }

      // fetch() with redirect:'manual' surfaces a redirect as an opaqueredirect response in browser
      // contexts, but in Node's undici-based fetch it returns the real 3xx status + Location header —
      // handle both defensively.
      if (response.status >= 300 && response.status < 400 && response.type !== 'opaqueredirect') {
        const location = response.headers.get('location');
        if (!location) throw new MakerWorldBlockedOrTimeoutError('MakerWorld trả về redirect không hợp lệ.');
        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          throw new MakerWorldNotFoundError('Redirect trỏ tới URL không hợp lệ.');
        }
        if (!isAllowedMakerWorldUrl(nextUrl)) {
          throw new MakerWorldNotFoundError('Redirect trỏ ra ngoài makerworld.com — từ chối theo dõi vì lý do bảo mật.');
        }
        currentUrl = nextUrl;
        continue;
      }
      if (response.type === 'opaqueredirect') {
        throw new MakerWorldBlockedOrTimeoutError('Không thể xác minh đích redirect từ MakerWorld.');
      }
      if (response.status === 404) throw new MakerWorldNotFoundError();
      if (response.status === 403 || response.status === 429 || response.status === 503) {
        throw new MakerWorldBlockedOrTimeoutError();
      }
      if (!response.ok) throw new MakerWorldBlockedOrTimeoutError(`MakerWorld trả về lỗi HTTP ${response.status}.`);
      try {
        return await Promise.race([readBodyWithCap(response, options.maxBytes), deadline]);
      } catch (error) {
        if (error instanceof MakerWorldResolverError) throw error;
        throw new MakerWorldBlockedOrTimeoutError();
      }
    }
    throw new MakerWorldBlockedOrTimeoutError('Quá nhiều lượt redirect từ MakerWorld.');
  } finally {
    clearTimeout(timeout);
  }
}

export type MakerWorldFilament = {
  name: string;
  colorHex: string;
  materialType: string;
  netWeightGrams: number;
};

/** One print profile ("instance") of a MakerWorld model. */
export type MakerWorldProfileItem = {
  profileId: string;
  profileTitle: string;
  profileCoverImageUrl: string | null;
  printerTarget: string | null;
  platesCount: number;
  printTimeMinutes: number;
  netWeightGrams: number;
  /** true = needs AMS, false = explicitly No-AMS, null = payload doesn't say (staff must choose). */
  amsRequired: boolean | null;
  filaments: MakerWorldFilament[];
};

export type MakerWorldResolution = {
  modelId: string;
  modelTitle: string;
  modelCoverImageUrl: string | null;
  sourceUrl: string;
  profiles: MakerWorldProfileItem[];
  /** null when the URL has no profileId and the model has more than one profile — staff MUST pick
   * explicitly (no silent `instances[0]` default). */
  activeProfileId: string | null;
  /** The URL named a profileId that no longer exists on the page — UI warns and asks staff to pick. */
  requestedProfileMissing: boolean;
};

// Assumed Next.js hydration payload shape — see file header. Kept optional-everywhere so a shape
// mismatch fails a controlled MakerWorldProfileNotFoundError instead of a raw TypeError.
type RawMakerWorldFilament = { name?: unknown; colorHex?: unknown; color?: unknown; type?: unknown; weightGrams?: unknown; weight?: unknown };
type RawMakerWorldInstance = {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  cover?: unknown;
  coverUrl?: unknown;
  pictureUrl?: unknown;
  printerName?: unknown;
  printer?: unknown;
  printers?: unknown;
  plateCount?: unknown;
  printTimeMinutes?: unknown;
  weightGrams?: unknown;
  needAms?: unknown;
  amsRequired?: unknown;
  filaments?: unknown;
};
type RawMakerWorldNextData = {
  props?: { pageProps?: { designDetail?: { title?: unknown; coverUrl?: unknown; instances?: unknown } } };
};

const NEXT_DATA_SCRIPT_RE = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f-\u009f]/g;

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_CHARS_RE, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'number' ? value : Number(value);
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function printerTargetOf(instance: RawMakerWorldInstance): string | null {
  if (Array.isArray(instance.printers)) {
    const names = instance.printers.map((p) => cleanText(p, 40)).filter((p): p is string => Boolean(p));
    if (names.length) return names.join('/').slice(0, 100);
  }
  return cleanText(instance.printerName, 100) ?? cleanText(instance.printer, 100);
}

const boundedGrams = z.number().finite().nonnegative().max(MAKERWORLD_LIMITS.maxGrams);
const filamentSchema = z.object({
  name: z.string().max(MAKERWORLD_LIMITS.maxTitleLength),
  colorHex: z.string().max(20),
  materialType: z.string().max(40),
  netWeightGrams: boundedGrams,
});
const profileSchema = z.object({
  profileId: z.string().regex(/^\d{1,20}$/),
  profileTitle: z.string().min(1).max(MAKERWORLD_LIMITS.maxTitleLength),
  profileCoverImageUrl: z.string().nullable(),
  printerTarget: z.string().max(100).nullable(),
  platesCount: z.number().int().nonnegative().max(MAKERWORLD_LIMITS.maxPlates),
  printTimeMinutes: z.number().int().nonnegative().max(MAKERWORLD_LIMITS.maxPrintMinutes),
  netWeightGrams: boundedGrams,
  amsRequired: z.boolean().nullable(),
  filaments: z.array(filamentSchema).max(MAKERWORLD_LIMITS.maxFilaments),
});

function normalizeInstance(instance: RawMakerWorldInstance, index: number): unknown {
  const rawFilaments = Array.isArray(instance.filaments) ? (instance.filaments as RawMakerWorldFilament[]) : [];
  const filaments = rawFilaments.map((filament) => ({
    name: cleanText(filament?.name, MAKERWORLD_LIMITS.maxTitleLength) ?? 'Unknown',
    colorHex: cleanText(filament?.colorHex, 20) ?? cleanText(filament?.color, 20) ?? '#000000',
    materialType: cleanText(filament?.type, 40) ?? 'PLA',
    netWeightGrams: optionalNumber(filament?.weightGrams) ?? optionalNumber(filament?.weight) ?? 0,
  }));
  const filamentGrams = filaments.reduce((sum, f) => sum + (Number.isFinite(f.netWeightGrams) ? f.netWeightGrams : Number.NaN), 0);
  const printMinutes = optionalNumber(instance.printTimeMinutes) ?? 0;
  return {
    profileId: instance.id === undefined || instance.id === null ? '' : String(instance.id),
    profileTitle: cleanText(instance.title, MAKERWORLD_LIMITS.maxTitleLength)
      ?? cleanText(instance.name, MAKERWORLD_LIMITS.maxTitleLength)
      ?? `Profile #${index + 1}`,
    profileCoverImageUrl: sanitizeMakerWorldImageUrl(instance.cover)
      ?? sanitizeMakerWorldImageUrl(instance.coverUrl)
      ?? sanitizeMakerWorldImageUrl(instance.pictureUrl),
    printerTarget: printerTargetOf(instance),
    platesCount: optionalNumber(instance.plateCount) ?? 0,
    // Slicer estimates can be fractional minutes — round once here so snapshots stay integer.
    printTimeMinutes: Number.isFinite(printMinutes) ? Math.round(printMinutes) : Number.NaN,
    netWeightGrams: optionalNumber(instance.weightGrams) ?? Math.round(filamentGrams * 100) / 100,
    amsRequired: optionalBoolean(instance.amsRequired) ?? optionalBoolean(instance.needAms),
    filaments,
  };
}

/** Pure — exported for tests. Throws MakerWorldProfileNotFoundError on any missing/malformed data. */
export function extractResolutionFromHtml(html: string, parsed: ParsedMakerWorldUrl): MakerWorldResolution {
  const match = html.match(NEXT_DATA_SCRIPT_RE);
  if (!match) {
    throw new MakerWorldProfileNotFoundError('Không đọc được dữ liệu mẫu từ trang MakerWorld (thiếu __NEXT_DATA__).');
  }
  let data: RawMakerWorldNextData;
  try {
    data = JSON.parse(match[1]) as RawMakerWorldNextData;
  } catch {
    throw new MakerWorldProfileNotFoundError('Dữ liệu mẫu trên trang MakerWorld không đúng định dạng JSON.');
  }
  const design = data?.props?.pageProps?.designDetail;
  const instances = design?.instances;
  if (!design || !Array.isArray(instances) || instances.length === 0) {
    throw new MakerWorldProfileNotFoundError();
  }
  if (instances.length > MAKERWORLD_LIMITS.maxProfiles) {
    throw new MakerWorldProfileNotFoundError('Model có quá nhiều profile in — vui lòng nhập tay thông số.');
  }

  const parsedProfiles = z.array(profileSchema).safeParse(
    instances.map((instance, index) => normalizeInstance((instance ?? {}) as RawMakerWorldInstance, index)),
  );
  if (!parsedProfiles.success) {
    throw new MakerWorldProfileNotFoundError('Dữ liệu profile in trên MakerWorld không hợp lệ (số liệu thiếu hoặc vượt giới hạn) — vui lòng nhập tay thông số.');
  }
  const profiles: MakerWorldProfileItem[] = parsedProfiles.data;
  if (new Set(profiles.map((p) => p.profileId)).size !== profiles.length) {
    throw new MakerWorldProfileNotFoundError('Dữ liệu profile in trên MakerWorld bị trùng mã profile.');
  }

  let activeProfileId: string | null = null;
  let requestedProfileMissing = false;
  if (parsed.profileId) {
    if (profiles.some((p) => p.profileId === parsed.profileId)) activeProfileId = parsed.profileId;
    else requestedProfileMissing = true;
  }
  if (!activeProfileId && !requestedProfileMissing && profiles.length === 1) {
    activeProfileId = profiles[0].profileId;
  }

  return {
    modelId: parsed.modelId,
    modelTitle: cleanText(design.title, MAKERWORLD_LIMITS.maxTitleLength) ?? 'MakerWorld model',
    modelCoverImageUrl: sanitizeMakerWorldImageUrl(design.coverUrl),
    sourceUrl: parsed.url.toString(),
    profiles,
    activeProfileId,
    requestedProfileMissing,
  };
}

export async function resolveMakerWorldUrl(
  rawUrl: string,
  options: { fetchImpl?: FetchLike; deadlineMs?: number; maxBytes?: number } = {},
): Promise<MakerWorldResolution> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const parsed = parseMakerWorldUrl(rawUrl);
  const html = await fetchSafely(parsed.url, fetchImpl, {
    deadlineMs: options.deadlineMs ?? MAKERWORLD_FETCH_DEADLINE_MS,
    maxBytes: options.maxBytes ?? MAKERWORLD_MAX_RESPONSE_BYTES,
  });
  return extractResolutionFromHtml(html, parsed);
}
