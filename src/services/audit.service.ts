import type { PoolClient } from 'pg';

export async function writeAuditLog(client: PoolClient, input: {
  actorId: string; action: string; entityType: string; entityId?: string; beforeData?: unknown; afterData?: unknown;
}): Promise<void> {
  await client.query(
    `insert into audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
     values ($1, $2, $3, $4, $5, $6)`,
    [input.actorId, input.action, input.entityType, input.entityId ?? null, input.beforeData ?? null, input.afterData ?? null],
  );
}
