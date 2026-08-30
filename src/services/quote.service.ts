import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';

export function canAcceptQuote(validUntil: Date, now = new Date()): boolean { return validUntil >= now; }

type QuoteSummary = {
  id: string; quoteNumber: string; subtotal: number; shippingFee: number; discount: number; total: number;
  validUntil: Date; status: string; note: string | null; createdAt: Date;
};

export async function listQuotesByCustomRequest(customRequestId: string): Promise<QuoteSummary[]> {
  const result = await query<QuoteSummary>(`
    select id, quote_number as "quoteNumber", subtotal, shipping_fee as "shippingFee", discount, total,
      valid_until as "validUntil", status, note, created_at as "createdAt"
    from quotes where custom_request_id = $1 order by created_at desc`, [customRequestId]);
  return result.rows;
}

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
    const quote = await client.query<{ valid_until: Date; custom_request_id: string; status: string }>('select valid_until, custom_request_id, status from quotes where id = $1 for update', [id]);
    if (!quote.rowCount) throw new DomainError('QUOTE_NOT_FOUND', 'Quote was not found.', 404);
    if (quote.rows[0].status !== 'DRAFT' && quote.rows[0].status !== 'SENT') {
      throw new DomainError('QUOTE_ALREADY_FINALIZED', `Quote is already ${quote.rows[0].status} and cannot be accepted again.`, 409);
    }
    if (!canAcceptQuote(quote.rows[0].valid_until)) throw new DomainError('QUOTE_EXPIRED', 'Expired quotes cannot be accepted.', 409);
    const result = await client.query('update quotes set status = $2 where id = $1 returning id, status', [id, 'ACCEPTED']);
    await writeAuditLog(client, { actorId, action: 'QUOTE_ACCEPTED', entityType: 'quote', entityId: id, afterData: result.rows[0] });

    // ADR-0007: custom prints never become an `orders` row — accepting a quote moves the work
    // into production tracking via print_jobs instead. material_id is left null until staff
    // assigns one (Phase 3 admin UI, see docs/exec-plans/active/phase-3.md decision #3).
    const printJob = await client.query<{ id: string }>(`
      insert into print_jobs (order_id, custom_request_id, quote_id, material_id, status)
      values (null, $1, $2, null, 'QUEUED') returning id`, [quote.rows[0].custom_request_id, id]);
    await writeAuditLog(client, { actorId, action: 'PRINT_JOB_CREATED', entityType: 'print_job', entityId: printJob.rows[0].id, afterData: { quoteId: id, customRequestId: quote.rows[0].custom_request_id } });

    return { ...result.rows[0], printJobId: printJob.rows[0].id };
  });
}
