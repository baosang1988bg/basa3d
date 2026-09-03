// Phase 13: MakerWorld URL resolver — parses a staff-pasted MakerWorld model link and fetches its
// print profile metadata server-side (title, cover image, plate count, print time, filaments).
//
// SECURITY (this is the first outbound third-party fetch() in the codebase — no existing pattern to
// copy, see phase-13.md decision #1, "Bổ sung sau Claude review" rounds 1/2):
// - Hostname allowlist (`*.makerworld.com`, https only) is checked BEFORE the initial fetch AND
//   before following any redirect hop — `fetch()`'s default `redirect: 'follow'` does not
//   re-validate the hostname per hop, which is the classic SSRF-via-redirect vector. We use
//   `redirect: 'manual'` and manually inspect/validate the `Location` header ourselves.
// - A real `AbortController` enforces a 5s timeout — not just a comment.
// - Residual risk (documented, not solved here): this hostname allowlist does not pin the resolved
//   IP address. A DNS-rebinding attack against makerworld.com's own DNS (attacker-controlled
//   authoritative response resolving makerworld.com to 169.254.169.254/127.0.0.1/etc.) would not be
//   caught by a hostname check alone — that would require a custom `dns.lookup`/undici `Agent`
//   hook that resolves the hostname once and validates the resulting IP is not in a private/
//   link-local/loopback range before connecting. Out of scope for this phase (MakerWorld's own DNS
//   is not attacker-controlled in the threat model here — the attacker only controls the pasted
//   URL, not makerworld.com's DNS), but noted for any future outbound-fetch resolver.
//
// PARSING STRATEGY (assumption, documented — cannot be verified against the live site in this
// sandboxed environment, no public MakerWorld API is documented anywhere):
// MakerWorld's model detail page is assumed to be a Next.js app that embeds its page data as JSON
// in `<script id="__NEXT_DATA__" type="application/json">...</script>` (the standard Next.js
// hydration payload, `props.pageProps.<key>`). This resolver looks for that script tag and reads
// design metadata from an assumed `props.pageProps.designDetail` shape (see `RawMakerWorldNextData`
// below). If MakerWorld's real page does not match this shape, `extractDesignFromNextData` throws
// `MakerWorldProfileNotFoundError` (not a crash) and the parsing shape documented here is the first
// place to fix once the real response can be inspected — the HTTP fetch layer (allowlist, manual
// redirect validation, timeout, error classification) is independent of this assumption and does
// not need to change.

const ALLOWED_HOST_SUFFIX = 'makerworld.com';
const FETCH_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; BaSa3DQuoteBot/1.0; +https://basa3d.vn)';

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

/** (c) The model page loaded fine, but the specific print profile (profileId) was not found on it. */
export class MakerWorldProfileNotFoundError extends MakerWorldResolverError {
  constructor(message = 'Không tìm thấy profile in này trên trang MakerWorld — có thể tác giả đã xoá hoặc đổi profile.') {
    super('PROFILE_NOT_FOUND', message);
  }
}

export type ParsedMakerWorldUrl = { modelId: string; profileId: string | null; url: URL };

function isAllowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === ALLOWED_HOST_SUFFIX || host.endsWith(`.${ALLOWED_HOST_SUFFIX}`);
}

function isAllowedMakerWorldUrl(url: URL): boolean {
  return url.protocol === 'https:' && isAllowedHostname(url.hostname);
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

/** SSRF-safe GET: manual redirect handling (re-validates hostname allowlist on every hop) + a real
 * AbortController timeout. Throws MakerWorldBlockedOrTimeoutError for timeouts/anti-bot responses,
 * MakerWorldNotFoundError for a 404 or an invalid/unsafe redirect target. */
async function fetchSafely(startUrl: URL, fetchImpl: FetchLike): Promise<string> {
  let currentUrl = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new MakerWorldBlockedOrTimeoutError();
      }
      throw new MakerWorldBlockedOrTimeoutError('Không thể kết nối tới MakerWorld.');
    } finally {
      clearTimeout(timeout);
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
    return response.text();
  }
  throw new MakerWorldBlockedOrTimeoutError('Quá nhiều lượt redirect từ MakerWorld.');
}

export type MakerWorldFilament = {
  name: string;
  colorHex: string;
  materialType: string;
  netWeightGrams: number;
};

export type MakerWorldProfile = {
  modelId: string;
  profileId: string;
  title: string;
  coverImageUrl: string | null;
  platesCount: number;
  totalPrintMinutes: number;
  filaments: MakerWorldFilament[];
};

// Assumed Next.js hydration payload shape — see file header. Kept narrow/optional-everywhere so a
// shape mismatch fails a controlled `MakerWorldProfileNotFoundError` instead of a raw TypeError.
type RawMakerWorldInstance = {
  id?: string | number;
  plateCount?: number;
  printTimeMinutes?: number;
  filaments?: { name?: string; colorHex?: string; type?: string; weightGrams?: number }[];
};
type RawMakerWorldNextData = {
  props?: {
    pageProps?: {
      designDetail?: {
        title?: string;
        coverUrl?: string;
        instances?: RawMakerWorldInstance[];
      };
    };
  };
};

const NEXT_DATA_SCRIPT_RE = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i;

function extractDesignFromNextData(html: string, parsed: ParsedMakerWorldUrl): MakerWorldProfile {
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
  const design = data.props?.pageProps?.designDetail;
  if (!design || !Array.isArray(design.instances) || design.instances.length === 0) {
    throw new MakerWorldProfileNotFoundError();
  }
  const instance = parsed.profileId
    ? design.instances.find((candidate) => String(candidate.id) === parsed.profileId)
    : design.instances[0];
  if (!instance) throw new MakerWorldProfileNotFoundError();

  const filaments: MakerWorldFilament[] = (instance.filaments ?? []).map((filament) => ({
    name: filament.name ?? 'Unknown',
    colorHex: filament.colorHex ?? '#000000',
    materialType: filament.type ?? 'PLA',
    netWeightGrams: Number(filament.weightGrams ?? 0),
  }));

  return {
    modelId: parsed.modelId,
    profileId: parsed.profileId ?? String(instance.id ?? ''),
    title: design.title ?? 'MakerWorld model',
    coverImageUrl: design.coverUrl ?? null,
    platesCount: Number(instance.plateCount ?? 0),
    totalPrintMinutes: Number(instance.printTimeMinutes ?? 0),
    filaments,
  };
}

export async function resolveMakerWorldUrl(rawUrl: string, options: { fetchImpl?: FetchLike } = {}): Promise<MakerWorldProfile> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const parsed = parseMakerWorldUrl(rawUrl);
  const html = await fetchSafely(parsed.url, fetchImpl);
  return extractDesignFromNextData(html, parsed);
}
