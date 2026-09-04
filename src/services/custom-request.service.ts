import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { sendStaffNotification } from '../lib/notify/send-staff-notification';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';

const ATTACHMENT_BUCKET = 'custom-request-attachments';
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;

// Content-Type is resolved from this hardcoded extension map, NEVER from the client-supplied
// `file.type` (phase-6.md decision #1) — unlike uploadProductImage, which trusts `file.type`
// because its caller is always an authenticated admin. This route is public/anonymous, and
// `.stl/.step/.obj/.3mf` have no MIME type the browser can be trusted to report correctly, so
// trusting the client here would let this become a mislabeled anonymous file host.
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  stl: 'model/stl', step: 'model/step', stp: 'model/step', obj: 'application/octet-stream', '3mf': 'model/3mf',
};

export async function uploadCustomRequestAttachment(input: { file: Blob; fileName: string }) {
  if (input.file.size === 0) throw new DomainError('EMPTY_FILE', 'File is empty.', 400);
  if (input.file.size > MAX_ATTACHMENT_SIZE_BYTES) throw new DomainError('FILE_TOO_LARGE', 'File tối đa 20MB.', 400);
  const extension = input.fileName.toLowerCase().split('.').pop() ?? '';
  const contentType = CONTENT_TYPE_BY_EXTENSION[extension];
  if (!contentType) throw new DomainError('INVALID_FILE_TYPE', 'Chỉ chấp nhận ảnh (JPG, PNG, WEBP) hoặc file thiết kế 3D (.stl, .step, .stp, .obj, .3mf).', 400);

  // Random path, not the client's original filename — avoids path traversal / overwrite, same as
  // uploadProductImage.
  const storagePath = `requests/${randomUUID()}.${extension}`;
  const supabase = createSupabaseAdminClient();
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, bytes, { contentType });
  if (uploadError) throw new DomainError('ATTACHMENT_UPLOAD_FAILED', uploadError.message, 502);

  return { path: storagePath };
}

export async function createCustomRequestAttachmentSignedUrl(storagePath: string, expiresInSeconds = 15 * 60) {
  const { data, error } = await createSupabaseAdminClient().storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) throw new DomainError('ATTACHMENT_SIGNING_FAILED', error?.message ?? 'Could not create attachment URL.', 502);
  return data.signedUrl;
}

export async function createCustomRequest(input: Record<string, unknown>, actorId: string | null) {
  const created = await withTransaction(async (client) => {
    const requestNumber = `CR-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const result = await client.query<{ id: string; request_number: string }>(`
      insert into custom_requests (request_number, source_channel, customer_name, customer_phone, customer_email, description, quantity, requested_material, requested_color, requested_size, attachment_path)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id, request_number`, [requestNumber, input.sourceChannel, input.customerName, input.customerPhone, input.customerEmail ?? null, input.description, input.quantity, input.requestedMaterial ?? null, input.requestedColor ?? null, input.requestedSize ?? null, input.attachmentPath ?? null]);
    const action = actorId ? 'CUSTOM_REQUEST_CREATED' : 'CUSTOM_REQUEST_CREATED_PUBLIC';
    await writeAuditLog(client, { actorId, action, entityType: 'custom_request', entityId: result.rows[0].id, afterData: input });
    return { id: result.rows[0].id, requestNumber: result.rows[0].request_number };
  });
  // Notified only after the transaction has committed (phase-15.md decision #1) — never inside
  // the callback above, so a rolled-back insert can never trigger a staff notification.
  await sendStaffNotification({ type: 'CUSTOM_REQUEST', id: created.id, code: created.requestNumber });
  return created;
}

export const CUSTOM_REQUEST_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['REVIEWING', 'REJECTED'],
  REVIEWING: ['NEED_INFO', 'QUOTED', 'REJECTED'],
  NEED_INFO: ['REVIEWING', 'REJECTED'],
  QUOTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['CONVERTED'],
  REJECTED: [],
  CONVERTED: [],
};

export function nextCustomRequestStatuses(status: string) {
  return CUSTOM_REQUEST_STATUS_TRANSITIONS[status] ?? [];
}

export async function updateCustomRequestStatus(id: string, status: string, actorId: string, authorization?: { role: 'OWNER' | 'STAFF'; overrideReason?: string }) {
  return withTransaction(async (client) => {
    const current = await client.query<{ status: string }>('select status from custom_requests where id = $1 for update', [id]);
    if (!current.rowCount) throw new DomainError('CUSTOM_REQUEST_NOT_FOUND', 'Custom request was not found.', 404);
    const previousStatus = current.rows[0].status;
    const isForward = nextCustomRequestStatuses(previousStatus).includes(status);
    const isOwnerOverride = authorization?.role === 'OWNER' && Boolean(authorization.overrideReason?.trim());
    if (!isForward && !isOwnerOverride) throw new DomainError('INVALID_CUSTOM_REQUEST_TRANSITION', `Cannot transition custom request from ${previousStatus} to ${status}.`, 409);
    const result = await client.query('update custom_requests set status = $2 where id = $1 returning id, status', [id, status]);
    await writeAuditLog(client, {
      actorId, action: isForward ? 'CUSTOM_REQUEST_STATUS_UPDATED' : 'CUSTOM_REQUEST_STATUS_OVERRIDDEN', entityType: 'custom_request', entityId: id,
      beforeData: { status: previousStatus }, afterData: { ...result.rows[0], overrideReason: isForward ? undefined : authorization?.overrideReason },
    });
    return result.rows[0];
  });
}

type CustomRequestSummary = { id: string; requestNumber: string; sourceChannel: string; status: string; createdAt: Date };

export async function listCustomRequests(input: { page?: number; limit?: number; status?: string; statuses?: string[] } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  const statusSql = input.statuses?.length
    ? (values.push(input.statuses), `and status = any($${values.length})`)
    : input.status ? (values.push(input.status), `and status = $${values.length}`) : '';
  values.push(limit, offset);
  const result = await query<CustomRequestSummary>(
    `select id, request_number as "requestNumber", source_channel as "sourceChannel", status, created_at as "createdAt"
     from custom_requests where true ${statusSql} order by created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return { page, limit, items: result.rows };
}

type CustomRequestDetail = {
  id: string; requestNumber: string; sourceChannel: string; customerName: string; customerPhone: string;
  customerEmail: string | null; description: string; quantity: number; requestedMaterial: string | null;
  requestedColor: string | null; requestedSize: string | null; attachmentPath: string | null;
  status: string; internalNote: string | null; createdAt: Date;
};

export async function getCustomRequestById(id: string): Promise<CustomRequestDetail | null> {
  const result = await query<CustomRequestDetail>(`
    select id, request_number as "requestNumber", source_channel as "sourceChannel", customer_name as "customerName",
      customer_phone as "customerPhone", customer_email as "customerEmail", description, quantity,
      requested_material as "requestedMaterial", requested_color as "requestedColor", requested_size as "requestedSize",
      attachment_path as "attachmentPath", status, internal_note as "internalNote", created_at as "createdAt"
    from custom_requests where id = $1`, [id]);
  return result.rows[0] ?? null;
}
