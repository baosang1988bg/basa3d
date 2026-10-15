import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 2 * 60 * 60 + 15 * 60;
const EXPIRY_BUFFER_SECONDS = 5;

function uploadClaimSecret(): string {
  const secret = process.env.UPLOAD_CLAIM_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('UPLOAD_CLAIM_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

function signature(path: string, expiresAt: number): Buffer {
  return createHmac('sha256', uploadClaimSecret())
    .update(`cr_upload:${path}:${expiresAt}`)
    .digest();
}

export function createUploadClaim(path: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${path}.${expiresAt}.${signature(path, expiresAt).toString('base64url')}`;
}

export function verifyUploadClaim(path: string, claim: string): boolean {
  if (!claim.startsWith(`${path}.`)) return false;
  const suffix = claim.slice(path.length);
  if (!suffix.startsWith('.')) return false;
  const [expiresAtRaw, signatureRaw, ...extra] = suffix.slice(1).split('.');
  if (extra.length || !/^\d+$/.test(expiresAtRaw ?? '') || !signatureRaw) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) + EXPIRY_BUFFER_SECONDS) return false;
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signatureRaw, 'base64url');
  } catch {
    return false;
  }
  // Canonical encoding only: base64url's last char carries padding bits, so several strings decode to
  // the same bytes. Rejecting non-canonical forms keeps one claim = one string (no malleability).
  if (supplied.toString('base64url') !== signatureRaw) return false;
  const expected = signature(path, expiresAt);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

