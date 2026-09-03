import { SITE_CONFIG } from '../config/site';

// Phase 5: static VietQR transfer QR (img.vietqr.io image URL format, Napas247-compliant, no npm
// dependency needed). Extracted out of order-confirmation/[orderNumber]/page.tsx in Phase 13 so the
// public quote page can reuse it verbatim instead of reimplementing (phase-13.md decision #4).
export function buildVietQrUrl(amount: number, referenceCode: string): string | null {
  if (!SITE_CONFIG.bankId || !SITE_CONFIG.bankAccountNumber) return null;
  const params = new URLSearchParams({ amount: String(amount), addInfo: referenceCode });
  if (SITE_CONFIG.bankAccountName) params.set('accountName', SITE_CONFIG.bankAccountName);
  return `https://img.vietqr.io/image/${encodeURIComponent(SITE_CONFIG.bankId)}-${encodeURIComponent(SITE_CONFIG.bankAccountNumber)}-compact2.png?${params.toString()}`;
}
