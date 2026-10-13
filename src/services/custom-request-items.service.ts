// Phase 33 S5 (plan §6.3, T4, T8): turn the items a /bao-gia customer submitted into immutable
// custom_request_items rows. Order per item:
//   1. inspectUploadedObject — the object really exists, size, Content-Type, magic bytes (400 otherwise)
//   2. re-measure the stored file while the request's VERIFY_BUDGET_BYTES lasts:
//        server volume within 2% of the client's → VERIFIED; otherwise → MISMATCH (server numbers win)
//      beyond the budget → CLIENT_REPORTED (client numbers, flagged; admin locks pre-fill — §7.1)
//   3. price with the same estimateFromMeshMetrics the public estimate uses → UNPRICED if no price
// The browser never sends a price; prices in the snapshot are always computed here.
import { query } from '../lib/db';
import type { CustomRequestItemEstimate } from '../domain/schemas';
import { customRequestItemEstimateSchema } from '../domain/schemas';
import { MeshMetricsError, parseObjMetrics, parseStlMetrics, type MeshMetrics } from '../lib/pricing/mesh-metrics';
import { FDM_MODEL_VERSION } from '../lib/pricing/fdm-estimate-model';
import { downloadCustomRequestAttachment, inspectUploadedObject, MAX_ATTACHMENT_PARSE_BYTES } from './custom-request.service';
import { estimateFromMeshMetrics, type PricingContext } from './instant-estimate.service';

/** Total bytes re-measured per request (T8) — keeps the function's RAM/time bounded. */
export const VERIFY_BUDGET_BYTES = MAX_ATTACHMENT_PARSE_BYTES;
/** Volume difference above which the client's metrics are replaced by the server's (§6.3). */
export const MISMATCH_THRESHOLD_PCT = 2;

export type ItemVerification = 'VERIFIED' | 'CLIENT_REPORTED' | 'MISMATCH' | 'UNPRICED';

export type BaoGiaItemInput = {
  attachmentPath: string;
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

  for (const [index, item] of items.entries()) {
    const { sizeBytes } = await files.inspect(item.attachmentPath);

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
