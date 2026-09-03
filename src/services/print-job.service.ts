import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';
import { lockMaterialForInventoryWrite, resolveWarehouseForMaterial } from './inventory.service';
import { recordSpoolUsage } from './filament.service';

type PrintJobSummary = {
  id: string; orderId: string | null; customRequestId: string | null; quoteId: string | null;
  materialId: string | null; printerName: string | null; status: string; createdAt: Date;
};

export async function listPrintJobs(input: { page?: number; limit?: number; status?: string; statuses?: string[] } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  const statusSql = input.statuses?.length
    ? (values.push(input.statuses), `and status = any($${values.length})`)
    : input.status ? (values.push(input.status), `and status = $${values.length}`) : '';
  values.push(limit, offset);
  const result = await query<PrintJobSummary>(`
    select id, order_id as "orderId", custom_request_id as "customRequestId", quote_id as "quoteId",
      material_id as "materialId", printer_name as "printerName", status, created_at as "createdAt"
    from print_jobs where true ${statusSql} order by created_at desc limit $${values.length - 1} offset $${values.length}`, values);
  return { page, limit, items: result.rows };
}

type PrintJobDetail = PrintJobSummary & {
  spoolId: string | null;
  estimatedWeightGrams: number | null; actualWeightGrams: number | null;
  estimatedPrintTimeMinutes: number | null; actualPrintTimeMinutes: number | null;
  startedAt: Date | null; completedAt: Date | null; note: string | null;
};

export async function getPrintJobById(id: string): Promise<PrintJobDetail | null> {
  const result = await query<PrintJobDetail>(`
    select id, order_id as "orderId", custom_request_id as "customRequestId", quote_id as "quoteId",
      material_id as "materialId", spool_id as "spoolId", printer_name as "printerName", estimated_weight_grams as "estimatedWeightGrams",
      actual_weight_grams as "actualWeightGrams", estimated_print_time_minutes as "estimatedPrintTimeMinutes",
      actual_print_time_minutes as "actualPrintTimeMinutes", status, started_at as "startedAt",
      completed_at as "completedAt", note, created_at as "createdAt"
    from print_jobs where id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function assignPrintJobMaterial(id: string, input: { materialId: string; estimatedWeightGrams: number; spoolId?: string | null }, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query<{ material_id: string | null; estimated_weight_grams: number | null; spool_id: string | null }>(
      'select material_id, estimated_weight_grams, spool_id from print_jobs where id = $1 for update', [id],
    );
    if (!before.rowCount) throw new DomainError('PRINT_JOB_NOT_FOUND', 'Print job was not found.', 404);
    const updated = await client.query<{ id: string; material_id: string; estimated_weight_grams: number; spool_id: string | null }>(`
      update print_jobs set material_id = $2, estimated_weight_grams = $3, spool_id = $4 where id = $1
      returning id, material_id, estimated_weight_grams, spool_id`, [id, input.materialId, input.estimatedWeightGrams, input.spoolId ?? null]);
    await writeAuditLog(client, { actorId, action: 'PRINT_JOB_MATERIAL_ASSIGNED', entityType: 'print_job', entityId: id, beforeData: before.rows[0], afterData: updated.rows[0] });
    return updated.rows[0];
  });
}

// Standalone spool assignment/change for the print-job start dialog's spool picker (Slice 3) — kept
// separate from assignPrintJobMaterial so choosing a spool doesn't require re-submitting material/weight.
export async function assignPrintJobSpool(id: string, spoolId: string, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query<{ material_id: string | null; spool_id: string | null }>(
      'select material_id, spool_id from print_jobs where id = $1 for update', [id],
    );
    if (!before.rowCount) throw new DomainError('PRINT_JOB_NOT_FOUND', 'Print job was not found.', 404);
    const spool = await client.query<{ material_id: string }>("select material_id from filament_spools where id = $1 and status = 'ACTIVE'", [spoolId]);
    if (!spool.rowCount) throw new DomainError('SPOOL_NOT_FOUND', 'Filament spool was not found or is not ACTIVE.', 404);
    if (before.rows[0].material_id && before.rows[0].material_id !== spool.rows[0].material_id) {
      throw new DomainError('SPOOL_MATERIAL_MISMATCH', 'Cuộn nhựa đã chọn không cùng loại vật liệu với print job này.', 409);
    }
    const updated = await client.query<{ id: string; spool_id: string }>(
      'update print_jobs set spool_id = $2 where id = $1 returning id, spool_id', [id, spoolId],
    );
    await writeAuditLog(client, { actorId, action: 'PRINT_JOB_SPOOL_ASSIGNED', entityType: 'print_job', entityId: id, beforeData: before.rows[0], afterData: updated.rows[0] });
    return updated.rows[0];
  });
}

export async function recordPrintJobActuals(id: string, input: { actualWeightGrams?: number | null; actualPrintTimeMinutes?: number | null }, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query('select actual_weight_grams, actual_print_time_minutes from print_jobs where id = $1 for update', [id]);
    if (!before.rowCount) throw new DomainError('PRINT_JOB_NOT_FOUND', 'Print job was not found.', 404);
    const updated = await client.query<{ id: string; actual_weight_grams: number | null; actual_print_time_minutes: number | null }>(`
      update print_jobs set actual_weight_grams = $2, actual_print_time_minutes = $3 where id = $1
      returning id, actual_weight_grams, actual_print_time_minutes`, [id, input.actualWeightGrams ?? null, input.actualPrintTimeMinutes ?? null]);
    await writeAuditLog(client, { actorId, action: 'PRINT_JOB_ACTUALS_RECORDED', entityType: 'print_job', entityId: id, beforeData: before.rows[0], afterData: updated.rows[0] });
    return updated.rows[0];
  });
}

// Only the two points in a print job's lifecycle where "starting to print" is real (first attempt,
// or after a REPRINT decision) — phase-6.md decision #2, lỗi #3. PRINTING itself is deliberately
// excluded: re-entering PRINTING from PRINTING is not a valid transition, so a second concurrent
// request that reads the row after the first one's commit is rejected here, before it ever reaches
// the stock deduction below. This guard applies ONLY to transitions targeting PRINTING — every other
// status change is intentionally left unvalidated (out of scope for Phase 6, see phase-6.md).
export const PRINT_JOB_STATUS_TRANSITIONS: Record<string, string[]> = {
  QUEUED: ['PRINTING', 'CANCELLED'],
  PRINTING: ['QC', 'FAILED', 'CANCELLED'],
  FAILED: ['REPRINT', 'CANCELLED'],
  REPRINT: ['PRINTING', 'CANCELLED'],
  QC: ['COMPLETED', 'REPRINT', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextPrintJobStatuses(status: string) {
  return PRINT_JOB_STATUS_TRANSITIONS[status] ?? [];
}

export async function updatePrintJobStatus(id: string, status: string, actorId: string, authorization?: { role: 'OWNER' | 'STAFF'; overrideReason?: string }) {
  return withTransaction(async (client) => {
    // Lock first, then validate/write — same ordering as updateOrderStatus/createOrder
    // ("lock-by-proxy", order.service.ts) — is what makes the PRINTING-transition guard below
    // race-free: a second concurrent request blocks here until the first commits, then reads a
    // status that already reflects it.
    const current = await client.query<{ status: string; material_id: string | null; estimated_weight_grams: number | null; spool_id: string | null }>(
      'select status, material_id, estimated_weight_grams, spool_id from print_jobs where id = $1 for update', [id],
    );
    if (!current.rowCount) throw new DomainError('PRINT_JOB_NOT_FOUND', 'Print job was not found.', 404);
    const previousStatus = current.rows[0].status;
    const isForward = nextPrintJobStatuses(previousStatus).includes(status);
    const isOwnerOverride = authorization?.role === 'OWNER' && Boolean(authorization.overrideReason?.trim());
    if (!isForward && !isOwnerOverride) {
      throw new DomainError('INVALID_PRINT_JOB_TRANSITION', `Cannot transition print job from ${previousStatus} to ${status}.`, 409);
    }

    if (status === 'PRINTING') {
      const { material_id: materialId, estimated_weight_grams: estimatedWeightGrams, spool_id: spoolId } = current.rows[0];
      if (!materialId || estimatedWeightGrams == null) {
        throw new DomainError('PRINT_JOB_MATERIAL_REQUIRED', 'Cần gán vật liệu và khối lượng ước tính trước khi bắt đầu in.', 409);
      }
      if (spoolId) {
        // Q1 (phase-12.md): spool-tracked material — reuse the same locking/ledger helper the
        // Admin "kiểm kê" flow uses, instead of duplicating the lock+insert logic here.
        await recordSpoolUsage(client, spoolId, estimatedWeightGrams, 'print_job', id, actorId);
      } else {
        // Only require spool selection when this material actually has ACTIVE spools tracked —
        // materials with no spools yet (or jobs created before Phase 12) keep the pre-Phase-12 path.
        const activeSpools = await client.query('select 1 from filament_spools where material_id = $1 and status = \'ACTIVE\' limit 1', [materialId]);
        if (activeSpools.rowCount) {
          throw new DomainError('PRINT_JOB_SPOOL_REQUIRED', 'Cần chọn cuộn nhựa cụ thể trước khi bắt đầu in.', 409);
        }
        await lockMaterialForInventoryWrite(client, materialId);
        const warehouseId = await resolveWarehouseForMaterial(client, materialId, estimatedWeightGrams);
        const movement = await client.query<{ id: string }>(`
          insert into material_movements (warehouse_id, material_id, movement_type, quantity, reference_type, reference_id, created_by)
          values ($1,$2,'PRODUCTION_OUT',$3,'print_job',$4,$5) returning id`,
          [warehouseId, materialId, -estimatedWeightGrams, id, actorId]);
        await writeAuditLog(client, { actorId, action: 'MATERIAL_PRODUCTION_OUT', entityType: 'material_movement', entityId: movement.rows[0].id, afterData: { printJobId: id, materialId, quantity: estimatedWeightGrams } });
      }
    }

    const result = await client.query('update print_jobs set status = $2 where id = $1 returning id, status', [id, status]);
    await writeAuditLog(client, {
      actorId, action: isForward ? 'PRINT_JOB_STATUS_UPDATED' : 'PRINT_JOB_STATUS_OVERRIDDEN', entityType: 'print_job', entityId: id,
      beforeData: { status: previousStatus }, afterData: { ...result.rows[0], overrideReason: isForward ? undefined : authorization?.overrideReason },
    });
    return result.rows[0];
  });
}
