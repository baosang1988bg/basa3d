import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';

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

export async function updatePrintJobStatus(id: string, status: string, actorId: string) {
  return withTransaction(async (client) => {
    const result = await client.query('update print_jobs set status = $2 where id = $1 returning id, status', [id, status]);
    if (!result.rowCount) throw new DomainError('PRINT_JOB_NOT_FOUND', 'Print job was not found.', 404);
    await writeAuditLog(client, { actorId, action: 'PRINT_JOB_STATUS_UPDATED', entityType: 'print_job', entityId: id, afterData: result.rows[0] });
    return result.rows[0];
  });
}
