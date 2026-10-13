// Phase 33 S1 (plan §4A, §5.3, T9–T11): the ONE place the VAT formula lives. The DB only checks
// that `total` includes `vat_amount` and that there is no VAT money without a rate — it never
// encodes the base or the rounding, so either can change here without a migration.
//
// PENDING accountant confirmation (O2): base = subtotal + shipping fee − discount, rounded half-up
// to whole VND. VAT stays disabled by default until O2 is answered.

/** Basis points: 10000 = 100%, 800 = 8%. */
export const VAT_RATE_BPS_MAX = 10_000;

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer, got ${value}`);
}

/** Integer VND VAT for an integer VND base at an integer basis-point rate. */
export function computeVat(baseVnd: number, rateBps: number): number {
  assertNonNegativeSafeInteger(baseVnd, 'baseVnd');
  assertNonNegativeSafeInteger(rateBps, 'rateBps');
  if (rateBps > VAT_RATE_BPS_MAX) throw new RangeError(`rateBps must be at most ${VAT_RATE_BPS_MAX}, got ${rateBps}`);
  if (rateBps === 0 || baseVnd === 0) return 0;
  // Exact integer arithmetic (BigInt) so very large bases never lose precision before rounding;
  // half-up on .5, same result as Math.round(baseVnd * rateBps / 10000) for every in-range value.
  const numerator = BigInt(baseVnd) * BigInt(rateBps);
  const vat = (numerator * 2n + 10_000n) / 20_000n;
  return Number(vat);
}

/** The VAT base of a quote (O2 — keep the base definition in this one function). */
export function quoteVatBase(input: { subtotal: number; shippingFee: number; discount: number }): number {
  return Math.max(input.subtotal + input.shippingFee - input.discount, 0);
}

export type QuoteTotals = { vatRateBps: number; vatAmount: number; total: number };

/** Server-authoritative quote totals. `vatRateBps` is 0 whenever VAT is disabled. */
export function computeQuoteTotals(
  input: { subtotal: number; shippingFee: number; discount: number },
  vat: { enabled: boolean; rateBps: number },
): QuoteTotals {
  const vatRateBps = vat.enabled ? vat.rateBps : 0;
  const base = input.subtotal + input.shippingFee - input.discount;
  const vatAmount = computeVat(quoteVatBase(input), vatRateBps);
  return { vatRateBps, vatAmount, total: base + vatAmount };
}

/** Admin form input: VAT as a percent string ("8", "8.5", "8,5") → integer basis points.
 * Empty → 0. Anything else (negative, > 2 decimals, text) → NaN so the Zod integer check rejects it. */
export function vatPercentToBps(raw: unknown): number {
  const text = typeof raw === 'string' ? raw.trim().replace(',', '.') : '';
  if (text === '') return 0;
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 100);
}

/** 800 → "8", 850 → "8.5" (display only). */
export function formatVatRatePct(rateBps: number): string {
  return String(rateBps / 100);
}
