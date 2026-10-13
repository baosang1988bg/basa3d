import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Vercel Cron calls the route with `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env
 * var is set. Fails closed: a missing/short secret means NO request is authorized. Compared in
 * constant time over SHA-256 digests (equal length regardless of input).
 */
export function isAuthorizedCronRequest(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !authorizationHeader) return false;
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const actual = createHash('sha256').update(authorizationHeader).digest();
  return timingSafeEqual(expected, actual);
}
