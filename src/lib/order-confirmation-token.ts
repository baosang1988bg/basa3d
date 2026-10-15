import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 45 * 60;
const EXPIRY_BUFFER_SECONDS = 5;

// Phase 36 S4 (closes Phase 35 deferred item "separate HMAC domain for order vs quote tokens").
// One secret signs two kinds of bearer link — the order-confirmation link (Phase 5) and the public
// quote link (Phase 13). Each token now names its purpose in a version prefix that is ALSO inside the
// signed message, so a token minted for one resource kind can never verify as the other, even if a
// future table shared ids with another. Format: `<o1|q1>.<uuid>.<expiresAt>.<base64url sig>`.
export type AccessTokenPurpose = 'order' | 'quote';
const PREFIX: Record<AccessTokenPurpose, string> = { order: 'o1', quote: 'q1' };

// Legacy (pre-Phase-36) quote links `<uuid>.<expiresAt>.<sig>` were sent to customers over Zalo and
// live until the quote's valid_until. They stay accepted for quotes ONLY, and only if they expire
// before this date — after it passes, delete the legacy branch (and this constant).
// Order links live 45 minutes, so legacy order tokens are not accepted at all.
const LEGACY_QUOTE_TOKEN_MAX_EXPIRES_AT = Math.floor(Date.parse('2027-01-31T00:00:00Z') / 1000);

export function assertOrderConfirmationConfigured(): void {
  const secret = process.env.ORDER_CONFIRMATION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ORDER_CONFIRMATION_SECRET must be configured with at least 32 characters.');
  }
}

function tokenSecret(): string {
  assertOrderConfirmationConfigured();
  return process.env.ORDER_CONFIRMATION_SECRET!;
}

function signature(purpose: AccessTokenPurpose, resourceId: string, expiresAt: number): Buffer {
  return createHmac('sha256', tokenSecret()).update(`basa3d:${PREFIX[purpose]}:${purpose}:${resourceId}:${expiresAt}`).digest();
}

function legacySignature(resourceId: string, expiresAt: number): Buffer {
  return createHmac('sha256', tokenSecret()).update(`${resourceId}.${expiresAt}`).digest();
}

export function createResourceAccessToken(purpose: AccessTokenPurpose, resourceId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${PREFIX[purpose]}.${resourceId}.${expiresAt}.${signature(purpose, resourceId, expiresAt).toString('base64url')}`;
}

function signatureMatches(signatureRaw: string, expected: Buffer): boolean {
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signatureRaw, 'base64url');
  } catch {
    return false;
  }
  // Canonical encoding only (base64url's last char carries padding bits — no malleable variants).
  if (supplied.toString('base64url') !== signatureRaw) return false;
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function isLive(expiresAtRaw: string | undefined): number | null {
  if (!/^\d+$/.test(expiresAtRaw ?? '')) return null;
  const expiresAt = Number(expiresAtRaw);
  // Date.now() is wall-clock time and may step backward after an OS/hypervisor/NTP correction.
  // Reject tokens slightly before their exact boundary so small clock jitter cannot reopen an
  // already-expired bearer token that grants access to unmasked order/quote details.
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) + EXPIRY_BUFFER_SECONDS) return null;
  return expiresAt;
}

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export function verifyResourceAccessToken(token: string, purpose: AccessTokenPurpose): { resourceId: string; expiresAt: number } | null {
  const parts = token.split('.');
  if (parts.length === 4) {
    const [prefix, resourceId, expiresAtRaw, signatureRaw] = parts;
    if (prefix !== PREFIX[purpose] || !UUID_PATTERN.test(resourceId) || !signatureRaw) return null;
    const expiresAt = isLive(expiresAtRaw);
    if (expiresAt === null) return null;
    return signatureMatches(signatureRaw, signature(purpose, resourceId, expiresAt)) ? { resourceId, expiresAt } : null;
  }
  if (parts.length === 3 && purpose === 'quote') {
    const [resourceId, expiresAtRaw, signatureRaw] = parts;
    if (!UUID_PATTERN.test(resourceId) || !signatureRaw) return null;
    const expiresAt = isLive(expiresAtRaw);
    if (expiresAt === null || expiresAt > LEGACY_QUOTE_TOKEN_MAX_EXPIRES_AT) return null;
    return signatureMatches(signatureRaw, legacySignature(resourceId, expiresAt)) ? { resourceId, expiresAt } : null;
  }
  return null;
}

/** Order-confirmation link token (POST /api/public/orders → /order-confirmation/[orderNumber]). */
export function createOrderConfirmationToken(orderId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  return createResourceAccessToken('order', orderId, ttlSeconds);
}

export function verifyOrderConfirmationToken(token: string): { resourceId: string; expiresAt: number } | null {
  return verifyResourceAccessToken(token, 'order');
}

/** Test/migration helper: mints a pre-Phase-36 (3-part, purpose-less) token. Never call from app code. */
export function createLegacyAccessTokenForTests(resourceId: string, ttlSeconds: number): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${resourceId}.${expiresAt}.${legacySignature(resourceId, expiresAt).toString('base64url')}`;
}
