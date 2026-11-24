// ADR-0064 — every external search ends with a way back to a BaSa3D quote. Pure, unit tested.
// See quoteHrefForModelUrl for the routing rules.
import { isHostAllowed } from '@/lib/net/safe-fetch';

export const QUOTE_LINK_MAX_LENGTH = 2000;
const MAKERWORLD_HOSTS = ['makerworld.com', 'makerworld.com.cn', 'makerworld.cn'] as const;

/**
 * Where "Báo giá mẫu này" goes (Owner feedback 2026-11-25: links must land on the QUOTE page, not "Đặt in").
 * - /bao-gia enabled (default): MakerWorld → `/bao-gia?tab=link&url=` (auto-analysed, instant price);
 *   any other model link → `/bao-gia?tab=file&ref=` (download the STL/3MF from that page, drop it in, price now).
 * - /bao-gia disabled (NEXT_PUBLIC_BAO_GIA_ENABLED=false): MakerWorld → `/tools/makerworld-cn?url=`,
 *   other links → `/custom-print?ref=` (request form with the link pre-filled).
 */
export function quoteHrefForModelUrl(raw: string, options: { baoGiaEnabled?: boolean } = {}): string | null {
  const baoGia = options.baoGiaEnabled ?? true;
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
  const encoded = encodeURIComponent(href);
  if (isMakerWorldUrl(url)) return baoGia ? `/bao-gia?tab=link&url=${encoded}` : `/tools/makerworld-cn?url=${encoded}`;
  return baoGia ? `/bao-gia?tab=file&ref=${encoded}` : `/custom-print?ref=${encoded}`;
}

/** True for makerworld.com / makerworld.com.cn / makerworld.cn and their subdomains (suffix match, not substring). */
export function isMakerWorldUrl(url: URL): boolean {
  return isHostAllowed(url.hostname, MAKERWORLD_HOSTS);
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
