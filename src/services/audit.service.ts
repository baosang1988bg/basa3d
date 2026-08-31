import type { PoolClient } from 'pg';
import { query } from '../lib/db';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// OWNER-only (ADR-0011 boundary #4) — enforced by the route handler, not here.
export async function listAuditLogs(input: { page?: number; limit?: number } = {}) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, input.limit ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const result = await query<{ id: string; actorId: string | null; action: string; entityType: string; entityId: string | null; beforeData: unknown; afterData: unknown; createdAt: string }>(
    'select id, actor_id as "actorId", action, entity_type as "entityType", entity_id as "entityId", before_data as "beforeData", after_data as "afterData", created_at as "createdAt" from audit_logs order by created_at desc limit $1 offset $2',
    [limit, offset],
  );
  return { page, limit, items: result.rows };
}

export async function writeAuditLog(client: PoolClient, input: {
  actorId: string | null; action: string; entityType: string; entityId?: string; beforeData?: unknown; afterData?: unknown;
}): Promise<void> {
  await client.query(
    `insert into audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
     values ($1, $2, $3, $4, $5, $6)`,
    [input.actorId, input.action, input.entityType, input.entityId ?? null, input.beforeData ?? null, input.afterData ?? null],
  );
}
