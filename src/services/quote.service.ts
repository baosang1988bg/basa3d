import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import { createOrderConfirmationToken, verifyOrderConfirmationToken } from '../lib/order-confirmation-token';
import { digitsOnly, maskCustomerName } from './order.service';
import type { PricingBreakdown } from './pricing.service';

export function canAcceptQuote(validUntil: Date, now = new Date()): boolean { return validUntil >= now; }

// Phase 13: model metadata snapshot from the MakerWorld resolver, captured at "Tạo báo giá" time
// (immutable, like pricingBreakdown/pricingConfigId — ADR-0022) so the public quote page can render
// it without re-fetching MakerWorld. Optional — a manually-typed quote simply omits it.
export type QuoteModelSnapshot = {
  sourceUrl: string;
  title: string;
  coverImageUrl?: string | null;
  platesCount: number;
  totalPrintMinutes: number;
  colorsCount: number;
};

type QuoteSummary = {
  id: string; quoteNumber: string; subtotal: number; shippingFee: number; discount: number; total: number;
  validUntil: Date; status: string; note: string | null; createdAt: Date; modelSnapshot: QuoteModelSnapshot | null;
};

export async function listQuotesByCustomRequest(customRequestId: string): Promise<QuoteSummary[]> {
  const result = await query<QuoteSummary>(`
    select id, quote_number as "quoteNumber", subtotal, shipping_fee as "shippingFee", discount, total,
      valid_until as "validUntil", status, note, created_at as "createdAt", model_snapshot as "modelSnapshot"
    from quotes where custom_request_id = $1 order by created_at desc`, [customRequestId]);
  return result.rows;
}

// pricingBreakdown/pricingConfigId are an optional immutable snapshot (Phase 9) — a Quote created
// by hand (no pricing engine involved) simply omits both, and the DB pair constraint
// (quotes_pricing_snapshot_pair) rejects setting only one of the two.
export async function createQuote(input: {
  customRequestId: string; subtotal: number; shippingFee?: number; discount?: number; total: number;
  validUntil: Date; note?: string | null; pricingBreakdown?: unknown | null; pricingConfigId?: string | null;
  modelSnapshot?: QuoteModelSnapshot | null;
}, actorId: string) {
  return withTransaction(async (client) => {
    const quoteNumber = `Q-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const result = await client.query<{ id: string; quote_number: string }>(`
      insert into quotes (custom_request_id, quote_number, subtotal, shipping_fee, discount, total, valid_until, note, pricing_breakdown, pricing_config_id, model_snapshot)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id, quote_number`, [
      input.customRequestId, quoteNumber, input.subtotal, input.shippingFee ?? 0, input.discount ?? 0, input.total, input.validUntil, input.note ?? null,
      input.pricingBreakdown ? JSON.stringify(input.pricingBreakdown) : null, input.pricingConfigId ?? null,
      input.modelSnapshot ? JSON.stringify(input.modelSnapshot) : null,
    ]);
    await writeAuditLog(client, { actorId, action: 'QUOTE_CREATED', entityType: 'quote', entityId: result.rows[0].id, afterData: input });
    return { id: result.rows[0].id, quoteNumber: result.rows[0].quote_number };
  });
}

// Mints a token whose TTL matches quotes.valid_until at the moment this is called (frozen at mint
// time — see phase-13.md decision #4's "TTL đóng băng" note: extending valid_until later requires
// re-minting/re-sending a fresh link, it does not retroactively extend already-issued tokens).
// Called fresh on every admin page render (no persistence needed) rather than once at creation —
// re-minting is harmless (a token is a pure function of (quoteId, expiresAt) plus signature; earlier
// tokens already sent to a customer over Zalo keep working independently, they are never revoked).
export function mintQuoteAccessToken(quoteId: string, validUntil: Date): string {
  const ttlSeconds = Math.floor((validUntil.getTime() - Date.now()) / 1000);
  return createOrderConfirmationToken(quoteId, ttlSeconds);
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

// Phase 13 public quote page (/quotes/[quoteNumber]) — business-rules.md #18, mirroring #14/ADR-0021
// and the field-allowlist precedent (ADR-0015/getPublicOrderByNumber): NOT `select *`/a raw join,
// customer_email/customer_phone/internal_note are never selected into the returned DTO, and
// pricing_breakdown's internal cost fields (machineDepreciationVnd/electricityCostVnd/
// failureBufferVnd/laborCostVnd) are never serialized directly — only a purpose-built public
// pricing DTO derived from them.
type QuoteRow = {
  id: string; quoteNumber: string; status: string; validUntil: Date; createdAt: Date;
  subtotal: number; shippingFee: number; discount: number; total: number; note: string | null;
  pricingBreakdown: PricingBreakdown | null; modelSnapshot: QuoteModelSnapshot | null;
  customerName: string; customerPhone: string;
};

export type PublicQuoteMaterialLine = { label: string | null; gram: number; costVnd: number };
export type PublicQuotePricing = {
  materials: PublicQuoteMaterialLine[];
  /** Lumped electricity + machine depreciation + failure buffer — the individual named cost fields
   * never leave pricing.service's PricingBreakdown (business-rules.md #18). */
  printCostVnd: number;
  /** Renamed/isolated laborCostVnd — "hoàn thiện" (finishing/post-processing), not the raw field name. */
  finishingCostVnd: number;
  packagingFeeVnd: number;
  shippingFeeVnd: number;
  discountVnd: number;
  totalVnd: number;
  /** 50% deposit policy (phase-13.md decision #5's Zalo template), ceil'd to keep integer VND. */
  depositVnd: number;
};

export type PublicQuoteDetail = {
  quoteNumber: string;
  status: string;
  validUntil: string;
  createdAt: string;
  customerName: string;
  note: string | null;
  modelSnapshot: QuoteModelSnapshot | null;
  pricing: PublicQuotePricing;
};

async function getQuoteRowByNumber(quoteNumber: string): Promise<QuoteRow | null> {
  const result = await query<QuoteRow>(`
    select q.id, q.quote_number as "quoteNumber", q.status, q.valid_until as "validUntil", q.created_at as "createdAt",
      q.subtotal, q.shipping_fee as "shippingFee", q.discount, q.total, q.note,
      q.pricing_breakdown as "pricingBreakdown", q.model_snapshot as "modelSnapshot",
      cr.customer_name as "customerName", cr.customer_phone as "customerPhone"
    from quotes q join custom_requests cr on cr.id = q.custom_request_id
    where q.quote_number = $1`, [quoteNumber]);
  const row = result.rows[0];
  if (!row) return null;
  // ADR-0023: subtotal/shippingFee/discount/total are bigint columns — node-postgres returns them
  // as strings, not numbers. Coerce here so this function's declared return type is actually true
  // at runtime (same class of bug ADR-0023 documents for pricing-config.service/inventory.service).
  return { ...row, subtotal: Number(row.subtotal), shippingFee: Number(row.shippingFee), discount: Number(row.discount), total: Number(row.total) };
}

function toPublicQuotePricing(row: QuoteRow): PublicQuotePricing {
  const breakdown = row.pricingBreakdown;
  const materials = breakdown?.materialLines.map((line) => ({ label: line.label, gram: line.gram, costVnd: line.costVnd })) ?? [];
  const materialsTotalVnd = materials.reduce((sum, line) => sum + line.costVnd, 0);
  const printCostVnd = breakdown
    ? breakdown.electricityCostVnd + breakdown.machineDepreciationVnd + breakdown.failureBufferVnd
    : Math.max(row.subtotal - materialsTotalVnd, 0);
  return {
    materials,
    printCostVnd,
    finishingCostVnd: breakdown?.laborCostVnd ?? 0,
    packagingFeeVnd: breakdown?.packagingFeeVnd ?? 0,
    shippingFeeVnd: row.shippingFee,
    discountVnd: row.discount,
    totalVnd: row.total,
    depositVnd: Math.ceil(row.total / 2),
  };
}

function toPublicQuoteDetail(row: QuoteRow, options: { masked: boolean }): PublicQuoteDetail {
  return {
    quoteNumber: row.quoteNumber,
    status: row.status,
    validUntil: row.validUntil.toISOString(),
    createdAt: row.createdAt.toISOString(),
    customerName: options.masked ? maskCustomerName(row.customerName) : row.customerName,
    note: row.note,
    modelSnapshot: row.modelSnapshot,
    pricing: toPublicQuotePricing(row),
  };
}

/** Full-detail mode: requires a valid, unexpired HMAC token whose signed resourceId matches this
 * quote's id (mint via mintQuoteAccessToken). Never masks customerName. */
export async function getPublicQuoteByToken(quoteNumber: string, token: string): Promise<PublicQuoteDetail | null> {
  const verified = verifyOrderConfirmationToken(token);
  if (!verified) return null;
  const row = await getQuoteRowByNumber(quoteNumber);
  if (!row || row.id !== verified.resourceId) return null;
  return toPublicQuoteDetail(row, { masked: false });
}

/** Fallback mode (no/expired token): requires the secondary factor (last-4 phone digits, same
 * contract as getPublicOrderByNumber) and always masks customerName — business-rules.md #18. */
export async function getPublicQuoteByPhoneSuffix(quoteNumber: string, phoneSuffix: string): Promise<PublicQuoteDetail | null> {
  const row = await getQuoteRowByNumber(quoteNumber);
  if (!row) return null;
  if (digitsOnly(row.customerPhone).slice(-4) !== digitsOnly(phoneSuffix).slice(-4)) return null;
  return toPublicQuoteDetail(row, { masked: true });
}
