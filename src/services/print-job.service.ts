import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';
import { resolveWarehouseForMaterial } from './inventory.service';

type PrintJobSummary = {
  id: string; orderId: string | null; customRequestId: string | null; quoteId: string | null;
  materialId: string | null; printerName: string | null; status: string; createdAt: Date;
};

export async function listPrintJobs(input: { page?: number; limit?: number; status?: string } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  const statusSql = input.status ? (values.push(input.status), `and status = $${values.length}`) : '';
  values.push(limit, offset);
  const result = await query<PrintJobSummary>(`
    select id, order_id as "orderId", custom_request_id as "customRequestId", quote_id as "quoteId",
      material_id as "materialId", printer_name as "printerName", status, created_at as "createdAt"
    from print_jobs where true ${statusSql} order by created_at desc limit $${values.length - 1} offset $${values.length}`, values);
  return { page, limit, items: result.rows };
}

type PrintJobDetail = PrintJobSummary & {
  estimatedWeightGrams: number | null; actualWeightGrams: number | null;
  estimatedPrintTimeMinutes: number | null; actualPrintTimeMinutes: number | null;
  startedAt: Date | null; completedAt: Date | null; note: string | null;
};

export async function getPrintJobById(id: string): Promise<PrintJobDetail | null> {
  const result = await query<PrintJobDetail>(`
    select id, order_id as "orderId", custom_request_id as "customRequestId", quote_id as "quoteId",
      material_id as "materialId", printer_name as "printerName", estimated_weight_grams as "estimatedWeightGrams",
      actual_weight_grams as "actualWeightGrams", estimated_print_time_minutes as "estimatedPrintTimeMinutes",
      actual_print_time_minutes as "actualPrintTimeMinutes", status, started_at as "startedAt",
      completed_at as "completedAt", note, created_at as "createdAt"
    from print_jobs where id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function assignPrintJobMaterial(id: string, input: { materialId: string; estimatedWeightGrams: number }, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query<{ material_id: string | null; estimated_weight_grams: number | null }>(
      'select material_id, estimated_weight_grams from print_jobs where id = $1 for update', [id],
    );
    if (!before.rowCount) throw new DomainError('PRINT_JOB_NOT_FOUND', 'Print job was not found.', 404);
    const updated = await client.query<{ id: string; material_id: string; estimated_weight_grams: number }>(`
      update print_jobs set material_id = $2, estimated_weight_grams = $3 where id = $1
      returning id, material_id, estimated_weight_grams`, [id, input.materialId, input.estimatedWeightGrams]);
    await writeAuditLog(client, { actorId, action: 'PRINT_JOB_MATERIAL_ASSIGNED', entityType: 'print_job', entityId: id, beforeData: before.rows[0], afterData: updated.rows[0] });
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
const PRINTING_ENTRY_STATUSES = new Set(['QUEUED', 'REPRINT']);

export async function updatePrintJobStatus(id: string, status: string, actorId: string) {
  return withTransaction(async (client) => {
    // Lock first, then validate/write — same ordering as updateOrderStatus/createOrder
    // ("lock-by-proxy", order.service.ts) — is what makes the PRINTING-transition guard below
    // race-free: a second concurrent request blocks here until the first commits, then reads a
    // status that already reflects it.
    const current = await client.query<{ status: string; material_id: string | null; estimated_weight_grams: number | null }>(
      'select status, material_id, estimated_weight_grams from print_jobs where id = $1 for update', [id],
    );
    if (!current.rowCount) throw new DomainError('PRINT_JOB_NOT_FOUND', 'Print job was not found.', 404);
    const previousStatus = current.rows[0].status;

    if (status === 'PRINTING') {
      if (!PRINTING_ENTRY_STATUSES.has(previousStatus)) {
        throw new DomainError('INVALID_PRINT_JOB_TRANSITION', `Cannot transition print job from ${previousStatus} to PRINTING.`, 409);
      }
      const { material_id: materialId, estimated_weight_grams: estimatedWeightGrams } = current.rows[0];
      if (!materialId || estimatedWeightGrams == null) {
        throw new DomainError('PRINT_JOB_MATERIAL_REQUIRED', 'Cần gán vật liệu và khối lượng ước tính trước khi bắt đầu in.', 409);
      }
      const warehouseId = await resolveWarehouseForMaterial(client, materialId, estimatedWeightGrams);
      const movement = await client.query<{ id: string }>(`
        insert into material_movements (warehouse_id, material_id, movement_type, quantity, reference_type, reference_id, created_by)
        values ($1,$2,'PRODUCTION_OUT',$3,'print_job',$4,$5) returning id`,
        [warehouseId, materialId, -estimatedWeightGrams, id, actorId]);
      await writeAuditLog(client, { actorId, action: 'MATERIAL_PRODUCTION_OUT', entityType: 'material_movement', entityId: movement.rows[0].id, afterData: { printJobId: id, materialId, quantity: estimatedWeightGrams } });
    }

    const result = await client.query('update print_jobs set status = $2 where id = $1 returning id, status', [id, status]);
    await writeAuditLog(client, { actorId, action: 'PRINT_JOB_STATUS_UPDATED', entityType: 'print_job', entityId: id, beforeData: { status: previousStatus }, afterData: result.rows[0] });
    return result.rows[0];
  });
}
