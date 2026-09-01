import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 45 * 60;

function tokenSecret(): string {
  const secret = process.env.ORDER_CONFIRMATION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ORDER_CONFIRMATION_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

function signature(orderId: string, expiresAt: number): Buffer {
  return createHmac('sha256', tokenSecret()).update(`${orderId}.${expiresAt}`).digest();
}

export function createOrderConfirmationToken(orderId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${orderId}.${expiresAt}.${signature(orderId, expiresAt).toString('base64url')}`;
}

export function verifyOrderConfirmationToken(token: string): { orderId: string; expiresAt: number } | null {
  const [orderId, expiresAtRaw, signatureRaw, ...extra] = token.split('.');
  if (extra.length || !/^[0-9a-f-]{36}$/i.test(orderId ?? '') || !/^\d+$/.test(expiresAtRaw ?? '') || !signatureRaw) return null;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;

  let supplied: Buffer;
  try {
    supplied = Buffer.from(signatureRaw, 'base64url');
  } catch {
    return null;
  }
  const expected = signature(orderId, expiresAt);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return { orderId, expiresAt };
}
