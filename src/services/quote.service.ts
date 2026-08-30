import { randomUUID } from 'node:crypto';
import { withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';

export function canAcceptQuote(validUntil: Date, now = new Date()): boolean { return validUntil >= now; }

export async function createQuote(input: { customRequestId: string; subtotal: number; shippingFee?: number; discount?: number; total: number; validUntil: Date; note?: string | null }, actorId: string) {
  return withTransaction(async (client) => {
    const quoteNumber = `Q-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const result = await client.query<{ id: string; quote_number: string }>(`
      insert into quotes (custom_request_id, quote_number, subtotal, shipping_fee, discount, total, valid_until, note)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, quote_number`, [input.customRequestId, quoteNumber, input.subtotal, input.shippingFee ?? 0, input.discount ?? 0, input.total, input.validUntil, input.note ?? null]);
    await writeAuditLog(client, { actorId, action: 'QUOTE_CREATED', entityType: 'quote', entityId: result.rows[0].id, afterData: input });
    return { id: result.rows[0].id, quoteNumber: result.rows[0].quote_number };
  });
}

export async function acceptQuote(id: string, actorId: string) {
  return withTransaction(async (client) => {
    const quote = await client.query<{ valid_until: Date }>('select valid_until from quotes where id = $1 for update', [id]);
    if (!quote.rowCount) throw new DomainError('QUOTE_NOT_FOUND', 'Quote was not found.', 404);
    if (!canAcceptQuote(quote.rows[0].valid_until)) throw new DomainError('QUOTE_EXPIRED', 'Expired quotes cannot be accepted.', 409);
    const result = await client.query('update quotes set status = $2 where id = $1 returning id, status', [id, 'ACCEPTED']);
    await writeAuditLog(client, { actorId, action: 'QUOTE_ACCEPTED', entityType: 'quote', entityId: id, afterData: result.rows[0] });
    return result.rows[0];
  });
}
