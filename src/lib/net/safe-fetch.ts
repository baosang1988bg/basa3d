// SSRF-safe GET for server-side fetches of user/admin-supplied URLs (ADR-0062).
// Same guarantees as `fetchSafely` in makerworld-resolver.ts, generalised to any host allowlist:
// - https only, no credentials/port in the URL, hostname must equal or be a subdomain of an allowlisted suffix;
// - `redirect: 'manual'` and every Location hop is re-validated against the allowlist (max redirects);
// - ONE deadline covers the whole chain AND the body read (no slow-body hang after headers arrive);
// - streamed body cap (Content-Length is checked first, then counted while reading).
// Residual risk (same as the MakerWorld resolver): the hostname is not pinned to a resolved public IP,
// so DNS rebinding of an allowlisted domain is out of scope.

export type FetchLike = (input: URL, init: RequestInit) => Promise<Response>;

export type SafeFetchOptions = {
  allowedHostSuffixes: readonly string[];
  deadlineMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
  userAgent?: string;
  /** POST support (e.g. GraphQL). Redirects are refused for non-GET requests. */
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  fetchImpl?: FetchLike;
};

export class SafeFetchError extends Error {
  constructor(
    public readonly reason: 'INVALID_URL' | 'HOST_NOT_ALLOWED' | 'TIMEOUT' | 'TOO_LARGE' | 'HTTP_ERROR' | 'TOO_MANY_REDIRECTS' | 'NETWORK',
    message: string,
    /** HTTP status for HTTP_ERROR. */
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; BaSa3D-TrendRadar/1.0; +https://basa3d.vn)';

export function isHostAllowed(hostname: string, allowedHostSuffixes: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return allowedHostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function isAllowedUrl(url: URL, allowedHostSuffixes: readonly string[]): boolean {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && isHostAllowed(url.hostname, allowedHostSuffixes);
}

async function readBodyWithCap(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new SafeFetchError('TOO_LARGE', 'Response too large.');
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
      throw new SafeFetchError('TOO_LARGE', 'Response too large.');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function safeFetchText(rawUrl: string | URL, options: SafeFetchOptions): Promise<string> {
  const { allowedHostSuffixes, deadlineMs = 6_000, maxBytes = 512 * 1024, maxRedirects = 3 } = options;
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));

  let currentUrl: URL;
  try {
    currentUrl = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);
  } catch {
    throw new SafeFetchError('INVALID_URL', 'Invalid URL.');
  }
  if (!isAllowedUrl(currentUrl, allowedHostSuffixes)) throw new SafeFetchError('HOST_NOT_ALLOWED', 'Host not allowed.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const deadline = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new SafeFetchError('TIMEOUT', 'Request timed out.')), { once: true });
  });
  deadline.catch(() => undefined);

  try {
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      let response: Response;
      try {
        response = await Promise.race([
          fetchImpl(currentUrl, {
            method: options.method ?? 'GET',
            body: options.body,
            redirect: 'manual',
            signal: controller.signal,
            headers: {
              'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
              Accept: options.accept ?? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
              ...options.headers,
            },
          }),
          deadline,
        ]);
      } catch (error) {
        if (error instanceof SafeFetchError) throw error;
        if (controller.signal.aborted) throw new SafeFetchError('TIMEOUT', 'Request timed out.');
        throw new SafeFetchError('NETWORK', 'Network error.');
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || response.type === 'opaqueredirect') throw new SafeFetchError('HTTP_ERROR', 'Unverifiable redirect.', response.status);
        if ((options.method ?? 'GET') !== 'GET') throw new SafeFetchError('HTTP_ERROR', 'Redirects are not followed for non-GET requests.', response.status);
        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          throw new SafeFetchError('INVALID_URL', 'Redirect to invalid URL.');
        }
        if (!isAllowedUrl(nextUrl, allowedHostSuffixes)) throw new SafeFetchError('HOST_NOT_ALLOWED', 'Redirect to a host that is not allowed.');
        currentUrl = nextUrl;
        continue;
      }
      if (response.type === 'opaqueredirect') throw new SafeFetchError('HTTP_ERROR', 'Unverifiable redirect.', response.status);
      if (!response.ok) throw new SafeFetchError('HTTP_ERROR', `HTTP ${response.status}`, response.status);
      try {
        return await Promise.race([readBodyWithCap(response, maxBytes), deadline]);
      } catch (error) {
        if (error instanceof SafeFetchError) throw error;
        throw new SafeFetchError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK', 'Failed to read body.');
      }
    }
    throw new SafeFetchError('TOO_MANY_REDIRECTS', 'Too many redirects.');
  } finally {
    clearTimeout(timer);
  }
}
