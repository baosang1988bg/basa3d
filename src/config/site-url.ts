// Phase 56: the public origin used in links we hand to customers (order confirmation, quote links
// pasted into Zalo). These used to be hard-coded to one domain; a deployment on any other domain then
// sent customers — and their access tokens — to a site that is not this one.
// NEXT_PUBLIC_* is inlined at build time, so this also works in client components.
const FALLBACK_SITE_URL = 'https://basa3d.vn';

export function publicSiteUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) return FALLBACK_SITE_URL;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? `${url.protocol}//${url.host}` : FALLBACK_SITE_URL;
  } catch {
    return FALLBACK_SITE_URL;
  }
}
