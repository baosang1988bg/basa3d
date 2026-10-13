import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { createDatabaseRateLimiter, getClientIp } from '@/lib/rate-limit';
import { quoteEstimateRequestSchema } from '@/domain/schemas';
import { isBaoGiaEnabled } from '@/config/bao-gia';
import { FDM_MODEL_VERSION } from '@/lib/pricing/fdm-estimate-model';
import { estimateFromMeshMetrics, loadPricingContext, type MeshItemEstimate } from '@/services/instant-estimate.service';

// Phase 33 S4 (plan §6.1): estimate for /bao-gia from browser-computed mesh METRICS — no file
// upload, no DB write. The browser never sends a price (D5); the response carries no costs/margin
// (B1). Accepted trade-off (same as ADR-0034 SPEC): fake metrics show a fake estimate, but never
// change a binding price — staff Quotes are the only binding price (ADR-0022), and at submit the
// server re-measures the stored file (S5).
const isRateLimited = createDatabaseRateLimiter({ scope: 'quote-estimate', maxRequests: 120, windowMs: 60 * 60_000 });
const NO_STORE = { 'cache-control': 'no-store' };

type PublicItem =
  | { status: 'OK'; grams: number; printMinutes: number; sizeMm: { x: number; y: number; z: number }; unitPriceVnd: number; lineSubtotalVnd: number; floorApplied: boolean; vatVnd: number; lineTotalVnd: number }
  | { status: 'UNPRICED'; reason: string; sizeMm: { x: number; y: number; z: number } }
  | { status: 'NO_MATERIAL_PRICE'; sizeMm: { x: number; y: number; z: number } };

/** Explicit allowlist — volume/surface/modelVersion internals stay server-side. */
function toPublicItem(item: MeshItemEstimate): PublicItem {
  if (item.status === 'OK') {
    return {
      status: 'OK', grams: item.grams, printMinutes: item.printMinutes, sizeMm: item.sizeMm,
      unitPriceVnd: item.unitPriceVnd, lineSubtotalVnd: item.lineSubtotalVnd, floorApplied: item.floorApplied,
      vatVnd: item.vatVnd, lineTotalVnd: item.lineTotalVnd,
    };
  }
  if (item.status === 'UNPRICED') return { status: 'UNPRICED', reason: item.reason, sizeMm: item.sizeMm };
  return { status: 'NO_MATERIAL_PRICE', sizeMm: item.sizeMm };
}

export async function POST(request: Request) {
  if (!isBaoGiaEnabled()) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });
  try {
    if (await isRateLimited(getClientIp(request.headers))) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã yêu cầu báo giá quá nhiều lần, vui lòng thử lại sau.' }, { status: 429, headers: NO_STORE });
    }
    const input = quoteEstimateRequestSchema.parse(await request.json().catch(() => null));
    const ctx = await loadPricingContext();
    // ADR-0033 precedent: "no pricing config" is a 200 with a reason, not a 5xx.
    if (!ctx) return NextResponse.json({ reason: 'NO_PRICING_CONFIG', items: [], totals: null }, { headers: NO_STORE });
    const items = input.items.map((item) => estimateFromMeshMetrics(ctx, item));
    const priced = items.filter((item): item is Extract<MeshItemEstimate, { status: 'OK' }> => item.status === 'OK');
    const subtotalVnd = priced.reduce((sum, item) => sum + item.lineSubtotalVnd, 0);
    const vatVnd = priced.reduce((sum, item) => sum + item.vatVnd, 0);
    return NextResponse.json({
      items: items.map(toPublicItem),
      // T11: totals = sum of per-item numbers (= sum of the future per-item Quotes).
      totals: { subtotalVnd, vatVnd, totalVnd: subtotalVnd + vatVnd, pricedItems: priced.length },
      vat: { enabled: Boolean(ctx.vat?.enabled), rateBps: ctx.vat?.enabled ? ctx.vat.rateBps : 0 },
      modelVersion: FDM_MODEL_VERSION,
    }, { headers: NO_STORE });
  } catch (error) {
    return apiError(error);
  }
}
