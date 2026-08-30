import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';

export async function createCustomRequest(input: Record<string, unknown>, actorId: string) {
  return withTransaction(async (client) => {
    const requestNumber = `CR-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const result = await client.query<{ id: string; request_number: string }>(`
      insert into custom_requests (request_number, source_channel, customer_name, customer_phone, customer_email, description, quantity, requested_material, requested_color, requested_size)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, request_number`, [requestNumber, input.sourceChannel, input.customerName, input.customerPhone, input.customerEmail ?? null, input.description, input.quantity, input.requestedMaterial ?? null, input.requestedColor ?? null, input.requestedSize ?? null]);
    await writeAuditLog(client, { actorId, action: 'CUSTOM_REQUEST_CREATED', entityType: 'custom_request', entityId: result.rows[0].id, afterData: input });
    return { id: result.rows[0].id, requestNumber: result.rows[0].request_number };
  });
}

export async function updateCustomRequestStatus(id: string, status: string, actorId: string) {
  return withTransaction(async (client) => {
    const result = await client.query('update custom_requests set status = $2 where id = $1 returning id, status', [id, status]);
    if (!result.rowCount) throw new DomainError('CUSTOM_REQUEST_NOT_FOUND', 'Custom request was not found.', 404);
    await writeAuditLog(client, { actorId, action: 'CUSTOM_REQUEST_STATUS_UPDATED', entityType: 'custom_request', entityId: id, afterData: result.rows[0] });
    return result.rows[0];
  });
}

type CustomRequestSummary = { id: string; requestNumber: string; sourceChannel: string; status: string; createdAt: Date };

export async function listCustomRequests(input: { page?: number; limit?: number } = {}) {
  const { page, limit, offset } = pagination(input);
  const result = await query<CustomRequestSummary>('select id, request_number as "requestNumber", source_channel as "sourceChannel", status, created_at as "createdAt" from custom_requests order by created_at desc limit $1 offset $2', [limit, offset]);
  return { page, limit, items: result.rows };
}

type CustomRequestDetail = {
  id: string; requestNumber: string; sourceChannel: string; customerName: string; customerPhone: string;
  customerEmail: string | null; description: string; quantity: number; requestedMaterial: string | null;
  requestedColor: string | null; requestedSize: string | null; status: string; internalNote: string | null; createdAt: Date;
};

export async function getCustomRequestById(id: string): Promise<CustomRequestDetail | null> {
  const result = await query<CustomRequestDetail>(`
    select id, request_number as "requestNumber", source_channel as "sourceChannel", customer_name as "customerName",
      customer_phone as "customerPhone", customer_email as "customerEmail", description, quantity,
      requested_material as "requestedMaterial", requested_color as "requestedColor", requested_size as "requestedSize",
      status, internal_note as "internalNote", created_at as "createdAt"
    from custom_requests where id = $1`, [id]);
  return result.rows[0] ?? null;
}
