// Phase 52 — idempotency keys for admin writes (table admin_request_keys, migration 20261027000000).
// claimRequestKey runs INSIDE the caller's transaction, so the key row commits or rolls back together
// with the work it guards. Same key + same canonical payload → REPLAY; same key + different payload or
// scope → IDEMPOTENCY_CONFLICT. A concurrent request with the same key blocks on the primary key until
// the first transaction ends, then sees its row.
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainError } from '../lib/domain-error';

export type RequestKeyScope = 'quick_restock' | 'product_onboarding';
export type RequestKeyClaim = { status: 'NEW' } | { status: 'REPLAY'; resultId: string | null };

/** JSON with object keys sorted, so the hash doesn't depend on property order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function payloadHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export class RequestKeyConflictError extends DomainError {
  constructor(message: string) {
    super('IDEMPOTENCY_CONFLICT', message, 409);
  }
}

export async function claimRequestKey(
  client: PoolClient,
  input: { key: string; scope: RequestKeyScope; payload: unknown; actorId: string },
  conflictMessage: string,
): Promise<RequestKeyClaim> {
  const hash = payloadHash(input.payload);
  const inserted = await client.query(
    `insert into admin_request_keys (request_key, scope, payload_hash, created_by) values ($1, $2, $3, $4)
     on conflict (request_key) do nothing returning request_key`, [input.key, input.scope, hash, input.actorId]);
  if (inserted.rowCount) return { status: 'NEW' };
  const existing = await client.query<{ scope: string; payload_hash: string; result_id: string | null }>(
    'select scope, payload_hash, result_id from admin_request_keys where request_key = $1', [input.key]);
  const row = existing.rows[0];
  if (!row || row.scope !== input.scope || row.payload_hash !== hash) throw new RequestKeyConflictError(conflictMessage);
  return { status: 'REPLAY', resultId: row.result_id };
}

export async function setRequestKeyResult(client: PoolClient, key: string, resultId: string): Promise<void> {
  await client.query('update admin_request_keys set result_id = $2 where request_key = $1', [key, resultId]);
}
