// ADR-0064 — every external search ends with a way back to a BaSa3D quote. Pure, unit tested.
// MakerWorld / MakerWorld CN links go to the instant quote tool; any other http(s) model link goes to
// the custom-print request form as a reference link (/custom-print?ref=…).
import { isHostAllowed } from '@/lib/net/safe-fetch';

export const QUOTE_LINK_MAX_LENGTH = 2000;
const MAKERWORLD_HOSTS = ['makerworld.com', 'makerworld.com.cn', 'makerworld.cn'] as const;

export function quoteHrefForModelUrl(raw: string): string | null {
  let value = raw.trim();
  if (!value || value.length > QUOTE_LINK_MAX_LENGTH) return null;
  if (/^(www\.)?makerworld\./i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const href = url.toString();
  if (href.length > QUOTE_LINK_MAX_LENGTH) return null;
  if (isHostAllowed(url.hostname, MAKERWORLD_HOSTS)) return `/tools/makerworld-cn?url=${encodeURIComponent(href)}`;
  return `/custom-print?ref=${encodeURIComponent(href)}`;
}

/** Server-side guard for `/custom-print?ref=`: only a plain http(s) URL ≤ 2000 chars is accepted. */
export function sanitizeReferenceUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > QUOTE_LINK_MAX_LENGTH) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
