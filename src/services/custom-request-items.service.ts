// Phase 33 S5 (plan §6.3, T4, T8): turn the items a /bao-gia customer submitted into immutable
// custom_request_items rows. Order per item:
//   1. inspectUploadedObject — the object really exists, size, Content-Type, magic bytes (400 otherwise)
//   2. re-measure the stored file while the request's VERIFY_BUDGET_BYTES lasts:
//        server volume within 2% of the client's → VERIFIED; otherwise → MISMATCH (server numbers win)
//      beyond the budget → CLIENT_REPORTED (client numbers, flagged; admin locks pre-fill — §7.1)
//   3. price with the same estimateFromMeshMetrics the public estimate uses → UNPRICED if no price
// The browser never sends a price; prices in the snapshot are always computed here.
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import type { CustomRequestItemEstimate } from '../domain/schemas';
import { customRequestItemEstimateSchema } from '../domain/schemas';
import { MeshMetricsError, parseObjMetrics, parseStlMetrics, type MeshMetrics } from '../lib/pricing/mesh-metrics';
import { FDM_MODEL_VERSION } from '../lib/pricing/fdm-estimate-model';
import { downloadCustomRequestAttachment, inspectUploadedObject, MAX_ATTACHMENT_PARSE_BYTES } from './custom-request.service';
import { estimateFromMeshMetrics, loadPricingContext, type PricingContext } from './instant-estimate.service';

/** Total bytes re-measured per request (T8) — keeps the function's RAM/time bounded. */
export const VERIFY_BUDGET_BYTES = MAX_ATTACHMENT_PARSE_BYTES;
/** Volume difference above which the client's metrics are replaced by the server's (§6.3). */
export const MISMATCH_THRESHOLD_PCT = 2;

export type ItemVerification = 'VERIFIED' | 'CLIENT_REPORTED' | 'MISMATCH' | 'UNPRICED';

export type BaoGiaItemInput = {
  attachmentPath: string;
  /** Verified at the public route boundary; ignored by the preparation service. */
  uploadClaim?: string;
  displayName: string;
  materialType: string;
  infillPct: number;
  scalePermille: number;
  color?: string | null;
  quantity: number;
  clientMetrics: MeshMetrics;
};

export type PreparedCustomRequestItem = {
  position: number;
  attachmentPath: string;
  displayName: string;
  fileSizeBytes: number;
  sourceKind: 'MESH';
  materialType: string;
  infillPct: number;
  scalePermille: number;
  color: string | null;
  quantity: number;
  verification: ItemVerification;
  estimateSnapshot: CustomRequestItemEstimate;
};

export type ItemFileAccess = {
  inspect: (path: string) => Promise<{ sizeBytes: number }>;
  download: (path: string) => Promise<Uint8Array>;
};

const defaultFileAccess: ItemFileAccess = { inspect: (path) => inspectUploadedObject(path), download: downloadCustomRequestAttachment };

function measure(path: string, bytes: Uint8Array): MeshMetrics | null {
  try {
    return path.endsWith('.obj') ? parseObjMetrics(bytes) : parseStlMetrics(bytes);
  } catch (error) {
    if (error instanceof MeshMetricsError) return null;
    throw error;
  }
}

const INSPECT_CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(values: T[], limit: number, work: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await work(values[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export function volumeMismatchPct(server: MeshMetrics, client: MeshMetrics): number {
  if (server.volumeMm3 <= 0) return 100;
  return (Math.abs(server.volumeMm3 - client.volumeMm3) / server.volumeMm3) * 100;
}

export async function prepareCustomRequestItems(
  items: BaoGiaItemInput[],
  ctx: PricingContext | null,
  options: { files?: ItemFileAccess; now?: Date; budgetBytes?: number } = {},
): Promise<PreparedCustomRequestItem[]> {
  const files = options.files ?? defaultFileAccess;
  const estimatedAt = (options.now ?? new Date()).toISOString();
  let budget = options.budgetBytes ?? VERIFY_BUDGET_BYTES;
  const prepared: PreparedCustomRequestItem[] = [];

  // Up to 50 items × 2 Storage calls each: inspect in parallel (bounded), then re-measure in order so
  // the verify budget is spent deterministically on the first files.
  const inspected = await mapWithConcurrency(items, INSPECT_CONCURRENCY, (item) => files.inspect(item.attachmentPath));
  for (const [index, item] of items.entries()) {
    const { sizeBytes } = inspected[index];

    let verification: ItemVerification;
    let metrics: MeshMetrics = item.clientMetrics;
    let mismatchPct: number | undefined;
    let serverUnreadable = false;
    if (sizeBytes <= budget) {
      budget -= sizeBytes;
      const server = measure(item.attachmentPath, await files.download(item.attachmentPath));
      if (!server) {
        serverUnreadable = true;
        verification = 'UNPRICED';
      } else {
        mismatchPct = Math.round(volumeMismatchPct(server, item.clientMetrics) * 100) / 100;
        verification = mismatchPct > MISMATCH_THRESHOLD_PCT ? 'MISMATCH' : 'VERIFIED';
        metrics = server; // server numbers always win when we have them
      }
    } else {
      verification = 'CLIENT_REPORTED';
    }

    const estimate = ctx && !serverUnreadable
      ? estimateFromMeshMetrics(ctx, { metrics, scalePermille: item.scalePermille, infillPct: item.infillPct, materialType: item.materialType, quantity: item.quantity })
      : null;
    const ok = estimate?.status === 'OK' ? estimate : null;
    if (!ok) verification = 'UNPRICED';

    const s = item.scalePermille / 1000;
    const round1 = (value: number) => Math.round(value * 10) / 10;
    const snapshot: CustomRequestItemEstimate = {
      schemaVersion: 1,
      modelVersion: estimate?.modelVersion ?? FDM_MODEL_VERSION,
      status: estimate ? estimate.status : 'NO_PRICING_CONFIG',
      unpricedReason: serverUnreadable ? 'SERVER_UNREADABLE' : estimate?.status === 'UNPRICED' ? estimate.reason : null,
      sizeMm: estimate?.sizeMm ?? { x: round1(metrics.sizeMm.x * s), y: round1(metrics.sizeMm.y * s), z: round1(metrics.sizeMm.z * s) },
      volumeCm3: ok ? ok.volumeCm3 : null,
      surfaceCm2: ok ? ok.surfaceCm2 : null,
      triangles: metrics.triangles,
      grams: ok ? ok.grams : null,
      printMinutes: ok ? ok.printMinutes : null,
      platesCount: null,
      unitPriceVnd: ok ? ok.unitPriceVnd : null,
      lineSubtotalVnd: ok ? ok.lineSubtotalVnd : null,
      floorApplied: ok ? ok.floorApplied : false,
      vatRateBps: ok ? ok.vatRateBps : 0,
      vatVnd: ok ? ok.vatVnd : 0,
      lineTotalVnd: ok ? ok.lineTotalVnd : null,
      pricingConfigId: ctx?.pricingConfigId ?? null,
      // Kept whenever the server did not (or could not) confirm the numbers, for staff review.
      ...(verification !== 'VERIFIED' ? { clientMetrics: { volumeMm3: item.clientMetrics.volumeMm3, surfaceMm2: item.clientMetrics.surfaceMm2, sizeMm: item.clientMetrics.sizeMm, triangles: item.clientMetrics.triangles } } : {}),
      ...(mismatchPct !== undefined ? { mismatchPct } : {}),
      estimatedAt,
    };

    prepared.push({
      position: index + 1,
      attachmentPath: item.attachmentPath,
      displayName: item.displayName,
      fileSizeBytes: sizeBytes,
      sourceKind: 'MESH',
      materialType: item.materialType,
      infillPct: item.infillPct,
      scalePermille: item.scalePermille,
      color: item.color?.trim() ? item.color.trim() : null,
      quantity: item.quantity,
      verification,
      estimateSnapshot: customRequestItemEstimateSchema.parse(snapshot),
    });
  }
  return prepared;
}

/** "Báo giá từ /bao-gia: 2 file (a.stl, b.stl)" — custom_requests.description is NOT NULL. */
export function describeBaoGiaRequest(items: Array<{ displayName: string }>, typed?: string | null): string {
  const note = typed?.trim();
  const names = items.map((item) => item.displayName).join(', ');
  const summary = `Báo giá từ /bao-gia: ${items.length} file (${names.length > 500 ? `${names.slice(0, 497)}…` : names})`;
  return note ? `${note}\n\n${summary}` : summary;
}

export type CustomRequestItemRow = PreparedCustomRequestItem & { id: string; createdAt: Date };

export function readItemEstimateSnapshot(raw: unknown, itemId: string): CustomRequestItemEstimate | null {
  const parsed = customRequestItemEstimateSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  console.error('[CUSTOM_REQUEST_ITEM_SNAPSHOT_CORRUPTED]', { itemId, issues: parsed.error.issues });
  return null;
}

export async function listCustomRequestItems(customRequestId: string): Promise<Array<Omit<CustomRequestItemRow, 'estimateSnapshot'> & { estimateSnapshot: CustomRequestItemEstimate | null }>> {
  const result = await query<Record<string, unknown>>(`
    select id, position, attachment_path as "attachmentPath", display_name as "displayName", file_size_bytes as "fileSizeBytes",
      source_kind as "sourceKind", material_type as "materialType", infill_pct as "infillPct", scale_permille as "scalePermille",
      color, quantity, verification, estimate_snapshot as "estimateSnapshot", created_at as "createdAt"
    from custom_request_items where custom_request_id = $1 order by position`, [customRequestId]);
  return result.rows.map((row) => ({
    id: String(row.id),
    position: Number(row.position),
    attachmentPath: String(row.attachmentPath),
    displayName: String(row.displayName),
    fileSizeBytes: Number(row.fileSizeBytes),
    sourceKind: 'MESH' as const,
    materialType: String(row.materialType),
    infillPct: Number(row.infillPct),
    scalePermille: Number(row.scalePermille),
    color: (row.color as string | null) ?? null,
    quantity: Number(row.quantity),
    verification: row.verification as ItemVerification,
    estimateSnapshot: readItemEstimateSnapshot(row.estimateSnapshot, String(row.id)),
    createdAt: row.createdAt as Date,
  }));
}

// ---------------------------------------------------------------------------------------------
// Phase 33 S7 (§6.5, B2): on-demand re-verification of ONE item by staff. The result is NEVER
// written into custom_request_items (immutable, T6) — it goes to audit_logs and back to the caller
// to pre-fill the Quote form (needed for CLIENT_REPORTED items, whose numbers came from the browser).
// ---------------------------------------------------------------------------------------------

export const REVERIFY_MAX_BYTES = 20 * 1024 * 1024;

export type ReverifyResult =
  | { status: 'OK'; grams: number; printMinutes: number; sizeMm: { x: number; y: number; z: number }; unitPriceVnd: number; lineSubtotalVnd: number; floorApplied: boolean; mismatchPct: number | null }
  | { status: 'TOO_LARGE' | 'UNREADABLE' | 'UNPRICED' | 'NO_PRICING_CONFIG'; reason?: string };

export async function reverifyCustomRequestItem(
  itemId: string,
  actorId: string,
  deps: { download?: (path: string) => Promise<Uint8Array>; loadContext?: () => Promise<PricingContext | null> } = {},
): Promise<ReverifyResult> {
  const found = await query<{ attachment_path: string; file_size_bytes: string; material_type: string; infill_pct: number | null; scale_permille: number; quantity: number; estimate_snapshot: unknown }>(
    `select attachment_path, file_size_bytes, material_type, infill_pct, scale_permille, quantity, estimate_snapshot
     from custom_request_items where id = $1`, [itemId]);
  const item = found.rows[0];
  if (!item) throw new DomainError('CUSTOM_REQUEST_ITEM_NOT_FOUND', 'Không tìm thấy món này.', 404);

  let result: ReverifyResult;
  let metrics: MeshMetrics | null = null;
  let pricingConfigId: string | null = null;
  if (Number(item.file_size_bytes) > REVERIFY_MAX_BYTES) {
    result = { status: 'TOO_LARGE' };
  } else {
    metrics = measure(item.attachment_path, await (deps.download ?? downloadCustomRequestAttachment)(item.attachment_path));
    const ctx = await (deps.loadContext ?? loadPricingContext)();
    pricingConfigId = ctx?.pricingConfigId ?? null;
    if (!metrics) result = { status: 'UNREADABLE' };
    else if (!ctx) result = { status: 'NO_PRICING_CONFIG' };
    else {
      const estimate = estimateFromMeshMetrics(ctx, {
        metrics, scalePermille: item.scale_permille, infillPct: item.infill_pct ?? 15, materialType: item.material_type, quantity: item.quantity,
      });
      const client = readItemEstimateSnapshot(item.estimate_snapshot, itemId)?.clientMetrics;
      result = estimate.status === 'OK'
        ? {
            status: 'OK', grams: estimate.grams, printMinutes: estimate.printMinutes, sizeMm: estimate.sizeMm,
            unitPriceVnd: estimate.unitPriceVnd, lineSubtotalVnd: estimate.lineSubtotalVnd, floorApplied: estimate.floorApplied,
            mismatchPct: client ? Math.round(volumeMismatchPct(metrics, { ...client }) * 100) / 100 : null,
          }
        : { status: 'UNPRICED', reason: estimate.status === 'UNPRICED' ? estimate.reason : estimate.status };
    }
  }
  await withTransaction((tx) => writeAuditLog(tx, {
    actorId, action: 'CUSTOM_REQUEST_ITEM_REVERIFIED', entityType: 'custom_request_item', entityId: itemId,
    afterData: { result, metrics, pricingConfigId, modelVersion: FDM_MODEL_VERSION },
  }));
  return result;
}
