import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import { createResourceAccessToken, verifyResourceAccessToken } from '../lib/order-confirmation-token';
import { maskCustomerName, verifyPhoneSuffixWithBudget } from './order.service';
import type { PricingBreakdown } from './pricing.service';
import { quoteModelSnapshotSchema, type QuoteModelSnapshotData } from '../domain/schemas';
import { sanitizeMakerWorldImageUrl } from '../lib/parsers/makerworld-image';
import { computeQuoteTotals } from '../lib/pricing/vat';

export function canAcceptQuote(validUntil: Date, now = new Date()): boolean { return validUntil >= now; }

// Phase 13: model metadata snapshot from the MakerWorld resolver, captured at "Tạo báo giá" time
// (immutable, like pricingBreakdown/pricingConfigId — ADR-0022) so the public quote page can render
// it without re-fetching MakerWorld. Optional — a manually-typed quote simply omits it.
// makerworld-profile-verification Phase A: versioned v1 | v2 — the type is inferred from the Zod
// schema so the TS type can never claim a field that legacy rows don't actually have.
export type QuoteModelSnapshot = QuoteModelSnapshotData;

/** Tolerant read path for `quotes.model_snapshot` (JSONB). Legacy Phase 13 rows (no
 * `schemaVersion`) parse as v1. A corrupted/unknown shape returns `null` and logs loudly instead of
 * crashing the public quote page the customer pays from — the pricing part of the page still renders. */
export function readQuoteModelSnapshot(raw: unknown, context: { quoteId?: string } = {}): QuoteModelSnapshot | null {
  if (raw === null || raw === undefined) return null;
  // Rows written before the B2 image allowlist existed may hold a cover URL on a host we no longer
  // trust. Drop just the image (render the placeholder) instead of discarding the whole snapshot.
  let candidate = raw;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const record = { ...(raw as Record<string, unknown>) };
    for (const key of ['coverImageUrl', 'profileCoverImageUrl'] as const) {
      if (key in record && record[key] !== null && record[key] !== undefined) record[key] = sanitizeMakerWorldImageUrl(record[key]);
    }
    candidate = record;
  }
  const parsed = quoteModelSnapshotSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  console.error('[QUOTE_SNAPSHOT_CORRUPTED]', { quoteId: context.quoteId ?? null, issues: parsed.error.issues });
  return null;
}

/** Tolerance for the B10 server-side consistency check between `pricingBreakdown` and
 * `modelSnapshot.totalPrintMinutes` (±15%, with a small absolute floor for per-line VND rounding). */
export const SNAPSHOT_PRINT_MINUTES_TOLERANCE_PCT = 15;
const SNAPSHOT_PRINT_MINUTES_ABSOLUTE_FLOOR = 3;

type PrintCostConfig = { electricityVndPerKwh: number; machinePriceVnd: number; machineLifetimeHours: number; printerPowerKw: number };

/** B10: PricingBreakdown does not store printMinutes, but computePricingBreakdown derives
 * machineDepreciationVnd and electricityCostVnd linearly from it — invert whichever has the larger
 * per-minute coefficient (less relative rounding error). Returns null when the config makes both
 * coefficients zero (nothing to compare). Pure — exported for tests. */
export function derivePrintMinutesFromBreakdown(breakdown: Pick<PricingBreakdown, 'machineDepreciationVnd' | 'electricityCostVnd'>, config: PrintCostConfig): number | null {
  const depreciationPerMinute = config.machineLifetimeHours > 0 ? config.machinePriceVnd / config.machineLifetimeHours / 60 : 0;
  const electricityPerMinute = (config.printerPowerKw * config.electricityVndPerKwh) / 60;
  if (depreciationPerMinute <= 0 && electricityPerMinute <= 0) return null;
  return depreciationPerMinute >= electricityPerMinute
    ? breakdown.machineDepreciationVnd / depreciationPerMinute
    : breakdown.electricityCostVnd / electricityPerMinute;
}

export function isPrintMinutesConsistent(derivedMinutes: number, snapshotMinutes: number): boolean {
  const tolerance = Math.max(snapshotMinutes * (SNAPSHOT_PRINT_MINUTES_TOLERANCE_PCT / 100), SNAPSHOT_PRINT_MINUTES_ABSOLUTE_FLOOR);
  return Math.abs(derivedMinutes - snapshotMinutes) <= tolerance;
}

type QuoteSummary = {
  id: string; quoteNumber: string; subtotal: number; shippingFee: number; discount: number; total: number;
  vatRateBps: number; vatAmount: number;
  validUntil: Date; status: string; note: string | null; createdAt: Date; modelSnapshot: QuoteModelSnapshot | null;
  customRequestItemId: string | null;
};

export async function listQuotesByCustomRequest(customRequestId: string): Promise<QuoteSummary[]> {
  const result = await query<QuoteSummary>(`
    select id, quote_number as "quoteNumber", subtotal, shipping_fee as "shippingFee", discount, total,
      vat_rate_bps as "vatRateBps", vat_amount as "vatAmount", custom_request_item_id as "customRequestItemId", valid_until as "validUntil", status, note, created_at as "createdAt", model_snapshot as "modelSnapshot"
    from quotes where custom_request_id = $1 order by created_at desc`, [customRequestId]);
  // ADR-0023: bigint money columns come back from node-postgres as strings — coerce once here.
  return result.rows.map((row) => ({
    ...row,
    subtotal: Number(row.subtotal), shippingFee: Number(row.shippingFee), discount: Number(row.discount), total: Number(row.total),
    vatRateBps: Number(row.vatRateBps), vatAmount: Number(row.vatAmount),
    modelSnapshot: readQuoteModelSnapshot(row.modelSnapshot, { quoteId: row.id }),
  }));
}

// pricingBreakdown/pricingConfigId are an optional immutable snapshot (Phase 9) — a Quote created
// by hand (no pricing engine involved) simply omits both, and the DB pair constraint
// (quotes_pricing_snapshot_pair) rejects setting only one of the two.
export async function createQuote(input: {
  customRequestId: string; subtotal: number; shippingFee?: number; discount?: number; total: number;
  validUntil: Date; note?: string | null; pricingBreakdown?: unknown | null; pricingConfigId?: string | null;
  modelSnapshot?: QuoteModelSnapshot | null; ipRiskAcknowledged?: boolean; customRequestItemId?: string | null;
}, actorId: string) {
  return withTransaction(async (client) => {
    // Phase 29 soft gate: a custom request flagged for third-party IP risk (ip-risk-keywords.ts)
    // requires staff to explicitly acknowledge they checked it before a quote can be created — does
    // not touch CUSTOM_REQUEST_STATUS_TRANSITIONS (custom-request.service.ts), only blocks this one
    // write. A request that was never flagged never needs ipRiskAcknowledged.
    const customRequest = await client.query<{ ip_risk_flag: boolean }>('select ip_risk_flag from custom_requests where id = $1 for update', [input.customRequestId]);
    if (!customRequest.rowCount) throw new DomainError('CUSTOM_REQUEST_NOT_FOUND', 'Custom request was not found.', 404);
    if (customRequest.rows[0].ip_risk_flag && !input.ipRiskAcknowledged) {
      throw new DomainError('IP_RISK_ACKNOWLEDGEMENT_REQUIRED', 'Yêu cầu này có rủi ro SHTT — cần xác nhận đã kiểm tra trước khi tạo báo giá.', 409);
    }
    // Phase 33 S7: a clear 400 instead of a raw FK violation when the item is not this request's.
    if (input.customRequestItemId) {
      const item = await client.query('select 1 from custom_request_items where id = $1 and custom_request_id = $2', [input.customRequestItemId, input.customRequestId]);
      if (!item.rowCount) throw new DomainError('CUSTOM_REQUEST_ITEM_NOT_FOUND', 'Món này không thuộc yêu cầu đang báo giá.', 400);
    }
    // B10 server-side consistency check: when a quote carries BOTH the pricing breakdown and the
    // model snapshot, the print time the price was computed from must match the snapshot's print
    // time (±15%). Catches "price of profile A saved with snapshot of profile B" even if the
    // client-side clearApplied() guard is bypassed. Manual price edits stay allowed — they are not
    // a mismatch of these two fields, they are audited below as MANUAL_PRICE_OVERRIDE.
    const breakdown = input.pricingBreakdown as PricingBreakdown | null | undefined;
    if (breakdown && input.pricingConfigId && input.modelSnapshot) {
      const config = await client.query<{ electricityVndPerKwh: string; machinePriceVnd: string; machineLifetimeHours: number; printerPowerKw: string }>(`
        select electricity_vnd_per_kwh as "electricityVndPerKwh", machine_price_vnd as "machinePriceVnd",
          machine_lifetime_hours as "machineLifetimeHours", printer_power_kw as "printerPowerKw"
        from pricing_configs where id = $1`, [input.pricingConfigId]);
      if (!config.rowCount) throw new DomainError('PRICING_CONFIG_NOT_FOUND', 'Pricing config was not found.', 404);
      const row = config.rows[0];
      const derivedMinutes = derivePrintMinutesFromBreakdown(breakdown, {
        electricityVndPerKwh: Number(row.electricityVndPerKwh),
        machinePriceVnd: Number(row.machinePriceVnd),
        machineLifetimeHours: Number(row.machineLifetimeHours),
        printerPowerKw: Number(row.printerPowerKw),
      });
      // Second, cheaper signal: the priced material can't be far BELOW the profile's net weight
      // (waste/consumables only ever add grams). Catches two profiles with similar print times but
      // different weights (e.g. 170g vs 285g) that the minutes check alone would let through.
      const pricedGrams = breakdown.materialLines.reduce((sum, line) => sum + line.gram, 0);
      const gramsTooLow = input.modelSnapshot.schemaVersion === 2
        && pricedGrams < input.modelSnapshot.netWeightGrams * (1 - SNAPSHOT_PRINT_MINUTES_TOLERANCE_PCT / 100);
      if (gramsTooLow || (derivedMinutes !== null && !isPrintMinutesConsistent(derivedMinutes, input.modelSnapshot.totalPrintMinutes))) {
        throw new DomainError(
          'QUOTE_SNAPSHOT_MISMATCH',
          'Giá tính toán không khớp với thời gian in của profile đã chọn — vui lòng bấm "Dùng giá này" lại cho đúng profile.',
          422,
        );
      }
    }

    // Phase 33 S1 (§6.4, T9): VAT is computed HERE from the CURRENT pricing config — never from the
    // client, and never from input.pricingConfigId (null for manual quotes, and possibly an older
    // row). The client-submitted total must equal the server total, otherwise staff saw a different
    // number than the one that would be stored.
    const vatConfig = await client.query<{ id: string; vat_enabled: boolean; vat_rate_bps: number }>(`
      select id, vat_enabled, vat_rate_bps from pricing_configs
      where effective_from <= now()
      order by effective_from desc, created_at desc limit 1`);
    const shippingFee = input.shippingFee ?? 0;
    const discount = input.discount ?? 0;
    const totals = computeQuoteTotals(
      { subtotal: input.subtotal, shippingFee, discount },
      { enabled: Boolean(vatConfig.rows[0]?.vat_enabled), rateBps: Number(vatConfig.rows[0]?.vat_rate_bps ?? 0) },
    );
    if (input.total !== totals.total) {
      throw new DomainError(
        'QUOTE_TOTAL_MISMATCH',
        `Tổng tiền không khớp (máy chủ tính ${totals.total.toLocaleString('vi-VN')}đ, gồm VAT ${totals.vatAmount.toLocaleString('vi-VN')}đ) — vui lòng tải lại trang và nhập lại.`,
        400,
      );
    }

    const quoteNumber = `Q-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const result = await client.query<{ id: string; quote_number: string }>(`
      insert into quotes (custom_request_id, quote_number, subtotal, shipping_fee, discount, total, valid_until, note, pricing_breakdown, pricing_config_id, model_snapshot, vat_rate_bps, vat_amount, custom_request_item_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id, quote_number`, [
      input.customRequestId, quoteNumber, input.subtotal, shippingFee, discount, totals.total, input.validUntil, input.note ?? null,
      input.pricingBreakdown ? JSON.stringify(input.pricingBreakdown) : null, input.pricingConfigId ?? null,
      input.modelSnapshot ? JSON.stringify(input.modelSnapshot) : null,
      totals.vatRateBps, totals.vatAmount, input.customRequestItemId ?? null,
    ]);
    await writeAuditLog(client, {
      actorId, action: 'QUOTE_CREATED', entityType: 'quote', entityId: result.rows[0].id,
      // vatPricingConfigId: which config the VAT came from (may differ from input.pricingConfigId,
      // which is the config the cost breakdown was computed with, or null for a manual quote).
      afterData: { ...input, vatRateBps: totals.vatRateBps, vatAmount: totals.vatAmount, vatPricingConfigId: vatConfig.rows[0]?.id ?? null },
    });
    if (breakdown && input.subtotal !== breakdown.finalPriceVnd) {
      await writeAuditLog(client, {
        actorId, action: 'MANUAL_PRICE_OVERRIDE', entityType: 'quote', entityId: result.rows[0].id,
        beforeData: { finalPriceVnd: breakdown.finalPriceVnd },
        afterData: { subtotal: input.subtotal, deltaVnd: input.subtotal - breakdown.finalPriceVnd },
      });
    }
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
  return createResourceAccessToken('quote', quoteId, ttlSeconds);
}

export async function acceptQuote(id: string, actorId: string) {
  return withTransaction(async (client) => {
    // Lock order = custom_requests row FIRST, then the quote (same order as createQuote). Without the
    // parent lock, two staff accepting two tier siblings at once each lock their own quote, then the
    // sibling auto-reject UPDATE waits on the other's row → Postgres deadlock (40P01) → 500.
    // Serializing on the parent row makes the second accept see the first one's result instead.
    const parent = await client.query<{ custom_request_id: string }>('select custom_request_id from quotes where id = $1', [id]);
    if (!parent.rowCount) throw new DomainError('QUOTE_NOT_FOUND', 'Quote was not found.', 404);
    const request = await client.query<{ status: string }>('select status from custom_requests where id = $1 for update', [parent.rows[0].custom_request_id]);
    // Phase 36 S1: a REJECTED request is closed — accepting one of its quotes would start production
    // for work the shop already declined. Re-open it (OWNER override) first if that was a mistake.
    if (request.rows[0]?.status === 'REJECTED') {
      throw new DomainError('CUSTOM_REQUEST_CLOSED', 'Yêu cầu đã bị từ chối — không thể chấp nhận báo giá. Mở lại yêu cầu trước nếu cần.', 409);
    }

    // Phase 33 §6.4: the sibling key is the /bao-gia ITEM when there is one (alternatives of the same
    // item), else the MakerWorld sourceUrl (tiers of the same profile). Quotes of OTHER items of the
    // same request never touch each other.
    const quote = await client.query<{ valid_until: Date; custom_request_id: string; status: string; sibling_key: string | null }>(
      `select valid_until, custom_request_id, status,
         coalesce(custom_request_item_id::text, model_snapshot->>'sourceUrl') as sibling_key
       from quotes where id = $1 for update`, [id]);
    if (!quote.rowCount) throw new DomainError('QUOTE_NOT_FOUND', 'Quote was not found.', 404);
    if (quote.rows[0].status !== 'DRAFT' && quote.rows[0].status !== 'SENT') {
      throw new DomainError('QUOTE_ALREADY_FINALIZED', `Quote is already ${quote.rows[0].status} and cannot be accepted again.`, 409);
    }
    if (!canAcceptQuote(quote.rows[0].valid_until)) throw new DomainError('QUOTE_EXPIRED', 'Expired quotes cannot be accepted.', 409);
    // A tier alternative of the same link created AFTER a sibling was accepted is still open — it must
    // not become a second print_job for the same item.
    const siblingKey = quote.rows[0].sibling_key;
    // Phase 36 S1 (decisions.md ADR-0040): a quote with no item and no MakerWorld link is a manual
    // revision of "the request" itself, so all such quotes of one request are siblings of each other —
    // v1 and v2 of the same manual quote must never both become print jobs. `is not distinct from`
    // makes the null key match other null keys.
    const acceptedSibling = await client.query(
      `select id from quotes where custom_request_id = $1 and id <> $2 and status = 'ACCEPTED'
         and coalesce(custom_request_item_id::text, model_snapshot->>'sourceUrl') is not distinct from $3 limit 1`,
      [quote.rows[0].custom_request_id, id, siblingKey]);
    if (acceptedSibling.rowCount) {
      throw new DomainError('QUOTE_SIBLING_ALREADY_ACCEPTED', 'Một phương án khác của cùng mẫu/profile này đã được chấp nhận — không thể chấp nhận thêm.', 409);
    }
    const result = await client.query('update quotes set status = $2 where id = $1 returning id, status', [id, 'ACCEPTED']);
    await writeAuditLog(client, { actorId, action: 'QUOTE_ACCEPTED', entityType: 'quote', entityId: id, afterData: result.rows[0] });

    // B4/B8: tier alternatives (ASSEMBLED vs KIT) of the SAME MakerWorld link are separate quotes —
    // accepting one auto-rejects its still-open siblings so only one print_job is ever created. Scoped
    // to the exact same model_snapshot.sourceUrl so a multi-item request or a non-MakerWorld revision
    // quote is never touched. Quotes without a snapshot (source_url null) never auto-reject anything.
    if (siblingKey) {
      const siblings = await client.query<{ id: string }>(`
        update quotes set status = 'REJECTED'
        where custom_request_id = $1 and id <> $2 and status in ('DRAFT', 'SENT')
          and coalesce(custom_request_item_id::text, model_snapshot->>'sourceUrl') = $3
        returning id`, [quote.rows[0].custom_request_id, id, siblingKey]);
      for (const sibling of siblings.rows) {
        await writeAuditLog(client, {
          actorId, action: 'QUOTE_AUTO_REJECTED_SIBLING', entityType: 'quote', entityId: sibling.id,
          afterData: { status: 'REJECTED', acceptedQuoteId: id, siblingKey },
        });
      }
    }

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
  vatRateBps: number; vatAmount: number;
  pricingBreakdown: PricingBreakdown | null; modelSnapshot: QuoteModelSnapshot | null;
  customerName: string; customerPhone: string;
  itemDisplayName: string | null; itemMaterialType: string | null; itemQuantity: number | null;
  itemSizeMm: { x: number; y: number; z: number } | null;
};

/** Phase 33 S7: the /bao-gia item a quote prices (1 item = 1 Quote) — what the customer sees. */
export type PublicQuoteItem = { displayName: string; materialType: string; quantity: number; sizeMm: { x: number; y: number; z: number } | null };

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
  /** Phase 33 S1: VAT snapshot of this quote (0/0 when VAT was disabled at creation). */
  vatRateBps: number;
  vatAmountVnd: number;
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
  item: PublicQuoteItem | null;
  pricing: PublicQuotePricing;
};

async function getQuoteRowByNumber(quoteNumber: string): Promise<QuoteRow | null> {
  const result = await query<QuoteRow>(`
    select q.id, q.quote_number as "quoteNumber", q.status, q.valid_until as "validUntil", q.created_at as "createdAt",
      q.subtotal, q.shipping_fee as "shippingFee", q.discount, q.total, q.note,
      q.vat_rate_bps as "vatRateBps", q.vat_amount as "vatAmount",
      q.pricing_breakdown as "pricingBreakdown", q.model_snapshot as "modelSnapshot",
      cr.customer_name as "customerName", cr.customer_phone as "customerPhone",
      i.display_name as "itemDisplayName", i.material_type as "itemMaterialType", i.quantity as "itemQuantity",
      i.estimate_snapshot->'sizeMm' as "itemSizeMm"
    from quotes q join custom_requests cr on cr.id = q.custom_request_id
    left join custom_request_items i on i.id = q.custom_request_item_id
    where q.quote_number = $1`, [quoteNumber]);
  const row = result.rows[0];
  if (!row) return null;
  // ADR-0023: subtotal/shippingFee/discount/total are bigint columns — node-postgres returns them
  // as strings, not numbers. Coerce here so this function's declared return type is actually true
  // at runtime (same class of bug ADR-0023 documents for pricing-config.service/inventory.service).
  return { ...row, modelSnapshot: readQuoteModelSnapshot(row.modelSnapshot, { quoteId: row.id }), subtotal: Number(row.subtotal), shippingFee: Number(row.shippingFee), discount: Number(row.discount), total: Number(row.total), vatRateBps: Number(row.vatRateBps), vatAmount: Number(row.vatAmount) };
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
    vatRateBps: row.vatRateBps,
    vatAmountVnd: row.vatAmount,
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
    item: row.itemDisplayName && row.itemMaterialType
      ? { displayName: row.itemDisplayName, materialType: row.itemMaterialType, quantity: Number(row.itemQuantity ?? 1), sizeMm: row.itemSizeMm }
      : null,
    pricing: toPublicQuotePricing(row),
  };
}

/** Full-detail mode: requires a valid, unexpired HMAC token whose signed resourceId matches this
 * quote's id (mint via mintQuoteAccessToken). Never masks customerName. */
export async function getPublicQuoteByToken(quoteNumber: string, token: string): Promise<PublicQuoteDetail | null> {
  const verified = verifyResourceAccessToken(token, 'quote');
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
  if (!(await verifyPhoneSuffixWithBudget(`quote:${row.quoteNumber}`, row.customerPhone, phoneSuffix))) return null;
  return toPublicQuoteDetail(row, { masked: true });
}
