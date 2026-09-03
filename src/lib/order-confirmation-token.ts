import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 45 * 60;
const EXPIRY_BUFFER_SECONDS = 5;

function tokenSecret(): string {
  const secret = process.env.ORDER_CONFIRMATION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ORDER_CONFIRMATION_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

function signature(resourceId: string, expiresAt: number): Buffer {
  return createHmac('sha256', tokenSecret()).update(`${resourceId}.${expiresAt}`).digest();
}

// Phase 13: generalized from `orderId` to `resourceId` — this token is now shared by two resources
// (orders, since Phase 5; quotes, since Phase 13). The mechanism (HMAC-SHA256, TTL baked in at mint
// time, timingSafeEqual) is identical for both; only the UUID being signed differs. Existing callers
// were unaffected by this rename (they all pass the id positionally), but were updated for clarity —
// see order.service.ts's getOrderConfirmationByToken and quote.service.ts's getQuoteAccessByToken.
export function createOrderConfirmationToken(resourceId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${resourceId}.${expiresAt}.${signature(resourceId, expiresAt).toString('base64url')}`;
}

export function verifyOrderConfirmationToken(token: string): { resourceId: string; expiresAt: number } | null {
  const [resourceId, expiresAtRaw, signatureRaw, ...extra] = token.split('.');
  if (extra.length || !/^[0-9a-f-]{36}$/i.test(resourceId ?? '') || !/^\d+$/.test(expiresAtRaw ?? '') || !signatureRaw) return null;
  const expiresAt = Number(expiresAtRaw);
  // Date.now() is wall-clock time and may step backward after an OS/hypervisor/NTP correction.
  // Reject tokens slightly before their exact boundary so small clock jitter cannot reopen an
  // already-expired bearer token that grants access to unmasked order/quote details.
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) + EXPIRY_BUFFER_SECONDS) return null;

  let supplied: Buffer;
  try {
    supplied = Buffer.from(signatureRaw, 'base64url');
  } catch {
    return null;
  }
  const expected = signature(resourceId, expiresAt);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return { resourceId, expiresAt };
}
