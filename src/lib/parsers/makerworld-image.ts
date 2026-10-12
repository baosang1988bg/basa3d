// MakerWorld profile/cover image URL sanitizer (makerworld-profile-verification plan, B2/B11).
//
// Why this exists: `QuoteModelSnapshot.coverImageUrl`/`profileCoverImageUrl` round-trip through the
// browser (hidden form input) and are rendered on the PUBLIC quote page the customer pays from. An
// unrestricted URL there is an image-injection vector (fake "chuyển khoản vào STK khác" banners,
// tracking pixels that log the customer's IP). Applied at two layers: the resolver output AND the
// Zod snapshot schema (the real server boundary — AGENTS.md rule #6).
//
// Allowlist decision (owner, 2026-10-12): `*.aliyuncs.com` from the Gemini-revised plan was dropped
// — any Alibaba Cloud OSS customer gets a `<bucket>.oss-*.aliyuncs.com` hostname, so a wildcard
// there re-opens exactly the B2 hole. If MakerWorld's real image CDN turns out to live on another
// host, add that EXACT hostname to EXACT_HOSTS below (never a shared-cloud wildcard).

export const MAX_IMAGE_URL_LENGTH = 2_000;

/** Hostnames matched EXACTLY (case-insensitive) — no wildcards at all.
 * - `makerworld.bblmw.com`: MakerWorld's real image CDN (verified on the live page of model 3246150,
 *   2026-10-12 — design covers and per-instance covers both live there).
 * - `makerworld.com`, `image.makerworld.com`: first-party hosts named in the phase plan.
 * Review 2026-10-12 removed the `*.makerworld.com` / `*.bambulab.com` wildcards from the Gemini plan:
 * hosts like forum.bambulab.com / wiki.bambulab.com serve USER uploads, so a wildcard would let
 * anyone place an arbitrary image next to the VietQR code on the public quote page (the B2 risk).
 * Add a new CDN host here only after seeing it in a real payload. */
const EXACT_HOSTS = new Set<string>(['makerworld.com', 'image.makerworld.com', 'makerworld.bblmw.com']);

export function isAllowedMakerWorldImageHost(hostname: string): boolean {
  return EXACT_HOSTS.has(hostname.toLowerCase());
}

/** Returns a normalized https URL string when `raw` is a safe MakerWorld/Bambu Lab image URL,
 * otherwise `null` — never throws, so callers can degrade to "no thumbnail". */
export function sanitizeMakerWorldImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_IMAGE_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port) return null;
  if (!isAllowedMakerWorldImageHost(url.hostname)) return null;
  const normalized = url.toString();
  return normalized.length > MAX_IMAGE_URL_LENGTH ? null : normalized;
}

/** True when `raw` is already a sanitized-equivalent URL — used by Zod refinements so a value that
 * only passes after normalization is still accepted. */
export function isSafeMakerWorldImageUrl(raw: unknown): boolean {
  return sanitizeMakerWorldImageUrl(raw) !== null;
}
