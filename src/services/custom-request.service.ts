import { randomUUID } from 'node:crypto';
import { nextCustomRequestStatuses } from '../domain/custom-request-status';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { sendStaffNotification } from '../lib/notify/send-staff-notification';
import { detectIpRiskKeywords } from '../lib/copyright/ip-risk-keywords';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';
import type { PreparedCustomRequestItem } from './custom-request-items.service';
import type { CustomRequestAdminUpdate } from '../domain/schemas';
import { createUploadClaim } from '../lib/upload-claim';
import {
  CONTENT_TYPE_BY_EXTENSION,
  CUSTOM_REQUEST_ATTACHMENT_BUCKET as ATTACHMENT_BUCKET,
  MAX_UPLOAD_BYTES,
  type UploadExtension,
} from '../config/uploads';

export { CONTENT_TYPE_BY_EXTENSION };

/** ADR-0034 parse budget: the storefront only downloads + parses attachments up to this size for an
 * instant estimate. Uploads themselves may be up to MAX_UPLOAD_BYTES (Phase 33 S2). */
export const MAX_ATTACHMENT_PARSE_BYTES = 20 * 1024 * 1024;

/** Server-generated object path — the client never chooses it (no traversal, no overwrite). */
export const ATTACHMENT_PATH_RE = /^requests\/[0-9a-f-]+\.(?:jpg|jpeg|png|webp|stl|step|stp|obj|3mf)$/;

export type SignedUploadTarget = { path: string; token: string; contentType: string; uploadClaim: string };

/**
 * Phase 33 S2 (§6.2, T7): direct-to-Storage uploads. Mints one signed upload token per file for a
 * random `requests/<uuid>.<ext>` path. No upsert, so a token can never overwrite an existing object.
 * Tokens live 2 hours (fixed by Supabase — `createSignedUploadUrl` only accepts `{ upsert }`);
 * mitigated by the per-IP rate limit, bucket limits, magic bytes at submit and the orphan cron.
 */
export async function createCustomRequestUploadTargets(
  files: ReadonlyArray<{ ext: UploadExtension }>,
  options: { sign?: (path: string) => Promise<{ token: string }> } = {},
): Promise<SignedUploadTarget[]> {
  const sign = options.sign ?? (async (path: string) => {
    const { data, error } = await createSupabaseAdminClient().storage.from(ATTACHMENT_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) throw new DomainError('UPLOAD_URL_FAILED', 'Không tạo được liên kết tải lên, vui lòng thử lại.', 502);
    return { token: data.token };
  });
  const targets: SignedUploadTarget[] = [];
  for (const file of files) {
    const path = `requests/${randomUUID()}.${file.ext}`;
    const { token } = await sign(path);
    targets.push({ path, token, contentType: CONTENT_TYPE_BY_EXTENSION[file.ext], uploadClaim: createUploadClaim(path) });
  }
  return targets;
}

/** Bytes read from the start of an object for the magic-byte check (≥ 84 for the binary-STL header). */
export const MAGIC_HEAD_BYTES = 512;

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

function startsWithBytes(head: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (head.length < offset + signature.length) return false;
  return signature.every((byte, index) => head[offset + index] === byte);
}

/** Text after an optional UTF-8 BOM and leading whitespace. */
function leadingText(head: Uint8Array, length: number): string {
  let start = startsWithBytes(head, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  while (start < head.length && [0x09, 0x0a, 0x0d, 0x20].includes(head[start])) start += 1;
  return ascii(head, start, length);
}

function looksLikeText(head: Uint8Array): boolean {
  if (head.length === 0) return false;
  let printable = 0;
  for (const byte of head) {
    if (byte === 0) return false;
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d || byte >= 0x20) printable += 1;
  }
  return printable / head.length > 0.95;
}

/**
 * Pure magic-byte check (§6.3 step 2). `head` = the first bytes of the object (up to
 * MAGIC_HEAD_BYTES), `sizeBytes` = the real stored size (needed for the binary-STL length formula).
 */
export function matchesMagicBytes(extension: string, head: Uint8Array, sizeBytes: number): boolean {
  switch (extension) {
    case '3mf':
      return startsWithBytes(head, [0x50, 0x4b, 0x03, 0x04]); // ZIP local file header "PK\x03\x04"
    case 'stl': {
      // Binary STL: 80-byte header + uint32 triangle count + 50 bytes per triangle — exact length.
      if (head.length >= 84 && sizeBytes >= 84) {
        const triangles = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(80, true);
        if (84 + triangles * 50 === sizeBytes) return true;
      }
      // ASCII STL starts with "solid" (binary files may too, hence the length check first).
      return /^solid\b/i.test(leadingText(head, 6)) && looksLikeText(head);
    }
    case 'obj':
      return looksLikeText(head);
    case 'step':
    case 'stp':
      return leadingText(head, 12) === 'ISO-10303-21';
    case 'jpg':
    case 'jpeg':
      return startsWithBytes(head, [0xff, 0xd8, 0xff]);
    case 'png':
      return startsWithBytes(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'webp':
      return ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP';
    default:
      return false;
  }
}

export type StoredObjectStat = { size: number; contentType: string | null };

export type UploadedObjectStorage = {
  /** Real stored size + stored Content-Type, or null when the object does not exist. */
  stat: (path: string) => Promise<StoredObjectStat | null>;
  /** The first `length` bytes of the object. */
  readHead: (path: string, length: number) => Promise<Uint8Array>;
};

/** Reads only the first `length` bytes: signed URL + HTTP `Range` (storage-js 2.112's `download()`
 * has no range option). If a server ignores Range and answers 200, the body is streamed and
 * cancelled after `length` bytes, so a 50MB object is never buffered in the function. */
async function readObjectHead(path: string, length: number): Promise<Uint8Array> {
  const { data, error } = await createSupabaseAdminClient().storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new DomainError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy file đã tải lên — vui lòng tải lại.', 400);
  const response = await fetch(data.signedUrl, { headers: { Range: `bytes=0-${length - 1}` }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok || !response.body) throw new DomainError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy file đã tải lên — vui lòng tải lại.', 400);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < length) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      received += value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const head = new Uint8Array(Math.min(received, length));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, head.length - offset);
    head.set(slice, offset);
    offset += slice.length;
    if (offset >= head.length) break;
  }
  return head;
}

const supabaseObjectStorage: UploadedObjectStorage = {
  // storage-js 2.112.4 exposes `info(path)` (GET /object/info) returning `size` and `contentType`;
  // `list()` would need a prefix scan. A missing object comes back as an error → null.
  async stat(path) {
    const { data, error } = await createSupabaseAdminClient().storage.from(ATTACHMENT_BUCKET).info(path);
    if (error || !data || typeof data.size !== 'number') return null;
    return { size: data.size, contentType: typeof data.contentType === 'string' ? data.contentType : null };
  },
  readHead: readObjectHead,
};

/**
 * Phase 33 S2 (§6.3 step 2): before a customer-supplied path is stored on a custom request, confirm
 * the object really exists in the bucket, its real size is within MAX_UPLOAD_BYTES, and its first
 * bytes match the extension. Throws a 400 DomainError otherwise. The path is never trusted as proof
 * that an upload happened.
 */
export async function inspectUploadedObject(path: string, storage: UploadedObjectStorage = supabaseObjectStorage): Promise<{ sizeBytes: number }> {
  if (!ATTACHMENT_PATH_RE.test(path)) throw new DomainError('INVALID_ATTACHMENT_PATH', 'Đường dẫn file không hợp lệ.', 400);
  const stat = await storage.stat(path);
  if (stat === null) throw new DomainError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy file đã tải lên — vui lòng tải lại.', 400);
  const sizeBytes = stat.size;
  if (sizeBytes <= 0) throw new DomainError('EMPTY_FILE', 'File tải lên bị rỗng — vui lòng tải lại.', 400);
  if (sizeBytes > MAX_UPLOAD_BYTES) throw new DomainError('FILE_TOO_LARGE', 'File vượt quá dung lượng cho phép.', 400);
  const extension = path.split('.').pop() ?? '';
  // The uploader picks the stored Content-Type (a signed upload token is not bound to one), so a
  // `.stl` path could be stored as image/jpeg. Require exactly the type this extension maps to.
  const expectedType = CONTENT_TYPE_BY_EXTENSION[extension as UploadExtension];
  const storedType = stat.contentType?.split(';')[0].trim().toLowerCase() ?? null;
  if (!expectedType || storedType !== expectedType) {
    throw new DomainError('ATTACHMENT_CONTENT_MISMATCH', 'Nội dung file không đúng với định dạng của nó — vui lòng kiểm tra và tải lại.', 400);
  }
  const head = await storage.readHead(path, Math.min(MAGIC_HEAD_BYTES, sizeBytes));
  if (!matchesMagicBytes(extension, head, sizeBytes)) {
    throw new DomainError('ATTACHMENT_CONTENT_MISMATCH', 'Nội dung file không đúng với định dạng của nó — vui lòng kiểm tra và tải lại.', 400);
  }
  return { sizeBytes };
}

/** Real stored size (bytes) of an attachment, or null when it does not exist. */
export async function getCustomRequestAttachmentSize(path: string): Promise<number | null> {
  if (!ATTACHMENT_PATH_RE.test(path)) throw new DomainError('INVALID_ATTACHMENT_PATH', 'Đường dẫn file không hợp lệ.', 400);
  return (await supabaseObjectStorage.stat(path))?.size ?? null;
}

/** ADR-0034: server-side read of a just-uploaded attachment so the storefront can price it before the
 * customer leaves contact details. Path shape is re-validated here (never trust the client). */
export async function downloadCustomRequestAttachment(storagePath: string): Promise<Uint8Array> {
  if (!ATTACHMENT_PATH_RE.test(storagePath)) throw new DomainError('INVALID_ATTACHMENT_PATH', 'Đường dẫn file không hợp lệ.', 400);
  const { data, error } = await createSupabaseAdminClient().storage.from(ATTACHMENT_BUCKET).download(storagePath);
  if (error || !data) throw new DomainError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy file đã tải lên — vui lòng tải lại.', 404);
  if (data.size > MAX_ATTACHMENT_PARSE_BYTES) throw new DomainError('FILE_TOO_LARGE', 'File quá lớn để tính giá tự động.', 400);
  return new Uint8Array(await data.arrayBuffer());
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
    // Phase 29: copyright_confirmed/tos_version only come from the public form
    // (publicCustomRequestInputSchema) — the admin-entered variant (customRequestInputSchema, staff
    // typing on a customer's behalf) has no such fields, so they default to false/null there.
    // ip_risk_flag is computed for every channel, not just public — a heuristic keyword check on the
    // description, advisory only (see ip-risk-keywords.ts).
    const ipRiskFlag = detectIpRiskKeywords(String(input.description ?? ''));
    const result = await client.query<{ id: string; request_number: string }>(`
      insert into custom_requests (request_number, source_channel, customer_name, customer_phone, customer_email, description, quantity, requested_material, requested_color, requested_size, attachment_path, copyright_confirmed, tos_version, ip_risk_flag, makerworld_snapshot, quote_estimate_snapshot)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id, request_number`, [
      requestNumber, input.sourceChannel, input.customerName, input.customerPhone, input.customerEmail ?? null, input.description, input.quantity, input.requestedMaterial ?? null, input.requestedColor ?? null, input.requestedSize ?? null, input.attachmentPath ?? null,
      input.copyrightConfirmed === true, input.tosVersion ?? null, ipRiskFlag,
      // Phase B: built server-side by the public route (never the raw client object).
      input.makerworldSnapshot ? JSON.stringify(input.makerworldSnapshot) : null,
      input.quoteEstimateSnapshot ? JSON.stringify(input.quoteEstimateSnapshot) : null,
    ]);
    // Phase 33 S5: /bao-gia items, inserted in the SAME transaction as their request (immutable
    // afterwards — prevent_custom_request_item_mutation). Prices were computed server-side.
    const items = (input.items as PreparedCustomRequestItem[] | undefined) ?? [];
    for (const item of items) {
      await client.query(`
        insert into custom_request_items (custom_request_id, position, attachment_path, display_name, file_size_bytes, source_kind,
          material_type, infill_pct, scale_permille, color, quantity, verification, estimate_snapshot)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
        result.rows[0].id, item.position, item.attachmentPath, item.displayName, item.fileSizeBytes, item.sourceKind,
        item.materialType, item.infillPct, item.scalePermille, item.color, item.quantity, item.verification, JSON.stringify(item.estimateSnapshot),
      ]);
    }
    // ADR-0039: a screenshot estimate is single use — consumed in the SAME transaction, so two
    // concurrent submissions of one estimate can never both create a request.
    if (typeof input.screenshotEstimateId === 'string') {
      const consumed = await client.query(
        `update makerworld_screenshot_estimates set consumed_at = now(), custom_request_id = $2
         where id = $1 and consumed_at is null and expires_at > now() returning id`,
        [input.screenshotEstimateId, result.rows[0].id]);
      if (!consumed.rowCount) {
        throw new DomainError('SCREENSHOT_ESTIMATE_USED', 'Ảnh báo giá này đã được dùng hoặc đã hết hạn — vui lòng chụp và xem giá lại.', 409);
      }
    }
    const action = actorId ? 'CUSTOM_REQUEST_CREATED' : 'CUSTOM_REQUEST_CREATED_PUBLIC';
    await writeAuditLog(client, { actorId, action, entityType: 'custom_request', entityId: result.rows[0].id, afterData: input });
    return { id: result.rows[0].id, requestNumber: result.rows[0].request_number };
  });
  // Notified only after the transaction has committed (phase-15.md decision #1) — never inside
  // the callback above, so a rolled-back insert can never trigger a staff notification.
  const customerName = typeof input.customerName === 'string' ? input.customerName : null;
  const customerPhone = typeof input.customerPhone === 'string' ? input.customerPhone : null;
  const quantity = typeof input.quantity === 'number' ? input.quantity : null;
  const material = typeof input.requestedMaterial === 'string' ? input.requestedMaterial : null;
  const description = typeof input.description === 'string' ? input.description : null;
  const quoteSnapshot = input.quoteEstimateSnapshot as { priceVnd?: number } | null | undefined;
  const mwSnapshot = input.makerworldSnapshot as {
    sourceUrl?: string;
    modelTitle?: string;
    profileTitle?: string;
    estimatedPriceVnd?: number;
  } | null | undefined;
  const totalVnd = quoteSnapshot?.priceVnd ?? mwSnapshot?.estimatedPriceVnd ?? null;

  let modelUrl: string | null = null;
  let modelTitle: string | null = null;

  if (mwSnapshot?.sourceUrl) {
    modelUrl = mwSnapshot.sourceUrl;
    modelTitle = mwSnapshot.modelTitle ? `MakerWorld: ${mwSnapshot.modelTitle}` : 'Xem trên MakerWorld';
  } else if (typeof input.attachmentPath === 'string' && input.attachmentPath) {
    modelTitle = input.attachmentPath.split('/').pop() ?? 'File 3D đính kèm';
    try {
      modelUrl = await createCustomRequestAttachmentSignedUrl(input.attachmentPath, 7 * 24 * 3600);
    } catch {
      // Non-fatal
    }
  } else if (Array.isArray(input.items) && input.items.length > 0) {
    const firstItem = input.items[0] as { displayName?: string; attachmentPath?: string };
    if (firstItem?.displayName) {
      modelTitle = input.items.length === 1 ? firstItem.displayName : `${input.items.length} file 3D (${firstItem.displayName})`;
    }
    if (firstItem?.attachmentPath) {
      try {
        modelUrl = await createCustomRequestAttachmentSignedUrl(firstItem.attachmentPath, 7 * 24 * 3600);
      } catch {
        // Non-fatal
      }
    }
  }

  await sendStaffNotification({
    type: 'CUSTOM_REQUEST',
    id: created.id,
    code: created.requestNumber,
    customerName,
    customerPhone,
    quantity,
    material,
    description,
    totalVnd,
    modelUrl,
    modelTitle,
  });
  return created;
}

// Moved to src/domain so client components can use it (Phase 36); re-exported for existing callers.
export { CUSTOM_REQUEST_STATUS_TRANSITIONS, nextCustomRequestStatuses } from '../domain/custom-request-status';

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

export type CustomRequestSummary = {
  id: string;
  requestNumber: string;
  sourceChannel: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  description: string;
  quantity: number;
  requestedMaterial: string | null;
  requestedColor: string | null;
  requestedSize: string | null;
  internalNote: string | null;
  status: string;
  createdAt: Date;
  ipRiskFlag: boolean;
  itemCount: number;
};

export async function listCustomRequests(input: { page?: number; limit?: number; status?: string; statuses?: string[] } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  const statusSql = input.statuses?.length
    ? (values.push(input.statuses), `and status = any($${values.length})`)
    : input.status ? (values.push(input.status), `and status = $${values.length}`) : '';
  values.push(limit + 1, offset);
  const result = await query<CustomRequestSummary>(
    `select id, request_number as "requestNumber", source_channel as "sourceChannel",
       customer_name as "customerName", customer_phone as "customerPhone", customer_email as "customerEmail",
       description, quantity, requested_material as "requestedMaterial", requested_color as "requestedColor",
       requested_size as "requestedSize", internal_note as "internalNote",
       status, created_at as "createdAt", ip_risk_flag as "ipRiskFlag",
       -- Phase 33 (B3): the "Đa món" badge counts real items, never attachment_path IS NULL.
       (select count(*)::int from custom_request_items i where i.custom_request_id = custom_requests.id) as "itemCount"
     from custom_requests where true ${statusSql} order by created_at desc, id limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return { page, limit, hasNext: result.rows.length > limit, items: result.rows.slice(0, limit) };
}

export async function updateCustomRequest(id: string, input: CustomRequestAdminUpdate, actorId: string) {
  return withTransaction(async (client) => {
    const current = await client.query('select * from custom_requests where id = $1 for update', [id]);
    if (!current.rowCount) throw new DomainError('CUSTOM_REQUEST_NOT_FOUND', 'Yêu cầu không tồn tại.', 404);

    // Phase 36 S1 (business-rules.md #13): the general edit form may move the status forward only.
    // Anything else (e.g. CONVERTED → NEW) needs updateCustomRequestStatus with an OWNER override
    // reason, so it is audited as an override instead of a plain field edit.
    const previousStatus = current.rows[0].status as string;
    if (input.status !== undefined && input.status !== previousStatus && !nextCustomRequestStatuses(previousStatus).includes(input.status)) {
      throw new DomainError('INVALID_CUSTOM_REQUEST_TRANSITION', `Không thể chuyển trạng thái từ ${previousStatus} sang ${input.status} trong form sửa. Dùng "Override trạng thái" kèm lý do.`, 409);
    }

    const updates: string[] = [];
    const values: unknown[] = [id];

    const mapping: Record<keyof CustomRequestAdminUpdate, string> = {
      sourceChannel: 'source_channel',
      customerName: 'customer_name',
      customerPhone: 'customer_phone',
      customerEmail: 'customer_email',
      description: 'description',
      quantity: 'quantity',
      requestedMaterial: 'requested_material',
      requestedColor: 'requested_color',
      requestedSize: 'requested_size',
      status: 'status',
      internalNote: 'internal_note',
    };

    for (const [key, col] of Object.entries(mapping)) {
      const val = (input as Record<string, unknown>)[key];
      if (val !== undefined) {
        values.push(val);
        updates.push(`${col} = $${values.length}`);
      }
    }

    if (updates.length === 0) return current.rows[0];

    const result = await client.query(
      `update custom_requests set ${updates.join(', ')} where id = $1 returning *`,
      values,
    );

    await writeAuditLog(client, {
      actorId,
      action: 'CUSTOM_REQUEST_UPDATED',
      entityType: 'custom_request',
      entityId: id,
      beforeData: current.rows[0],
      afterData: result.rows[0],
    });

    return result.rows[0];
  });
}

// Phase 36 S1 (business-rules.md #7): hard delete is for spam/test/mistaken requests only. Once a
// request carries financial or production history — an ACCEPTED quote, or a print job that has
// started (anything other than QUEUED/CANCELLED) — it can only be REJECTED, never erased.
const DELETABLE_PRINT_JOB_STATUSES = ['QUEUED', 'CANCELLED'];

export async function deleteCustomRequest(id: string, actorId: string, options: { removeStorage?: (paths: string[]) => Promise<void> } = {}) {
  const { pathsToRemove } = await withTransaction(async (client) => {
    const current = await client.query('select * from custom_requests where id = $1 for update', [id]);
    if (!current.rowCount) throw new DomainError('CUSTOM_REQUEST_NOT_FOUND', 'Yêu cầu không tồn tại.', 404);

    const history = await client.query<{ accepted_quotes: number; started_jobs: number }>(`
      select
        (select count(*)::int from quotes where custom_request_id = $1 and status = 'ACCEPTED') as accepted_quotes,
        (select count(*)::int from print_jobs pj where pj.custom_request_id = $1 and (
          pj.status <> all($2::print_job_status[])
          or exists (select 1 from material_movements mm where mm.reference_type = 'print_job' and mm.reference_id = pj.id)
        )) as started_jobs`,
    [id, DELETABLE_PRINT_JOB_STATUSES]);
    if (history.rows[0].accepted_quotes > 0 || history.rows[0].started_jobs > 0) {
      throw new DomainError('CUSTOM_REQUEST_HAS_HISTORY', 'Yêu cầu đã có báo giá được chấp nhận hoặc print job đã chạy — không thể xoá. Hãy chuyển sang REJECTED thay vì xoá.', 409);
    }

    // Allow item purge in this transaction (satisfies trigger prevent_custom_request_item_mutation).
    await client.query("set local basa3d.allow_item_purge = 'on'");

    // Every removed child row goes into the audit log, so the delete stays reconstructable.
    const printJobs = await client.query('delete from print_jobs where custom_request_id = $1 returning *', [id]);
    const quotes = await client.query('delete from quotes where custom_request_id = $1 returning *', [id]);
    const items = await client.query<{ attachment_path: string | null }>('delete from custom_request_items where custom_request_id = $1 returning *', [id]);
    await client.query('delete from custom_requests where id = $1', [id]);

    await writeAuditLog(client, {
      actorId,
      action: 'CUSTOM_REQUEST_DELETED',
      entityType: 'custom_request',
      entityId: id,
      beforeData: { request: current.rows[0], quotes: quotes.rows, printJobs: printJobs.rows, items: items.rows },
    });

    return {
      pathsToRemove: [current.rows[0].attachment_path, ...items.rows.map((row) => row.attachment_path)]
        .filter((path): path is string => Boolean(path)),
    };
  });

  // Storage is cleaned only AFTER the delete has committed — a failed commit must not lose files
  // for a request that still exists. Best-effort: the orphan-upload cron catches anything left.
  if (pathsToRemove.length > 0) {
    try {
      if (options.removeStorage) await options.removeStorage(pathsToRemove);
      else await createSupabaseAdminClient().storage.from(ATTACHMENT_BUCKET).remove(pathsToRemove);
    } catch {
      // Storage removal is best-effort.
    }
  }
  return { id };
}

type CustomRequestDetail = {
  id: string; requestNumber: string; sourceChannel: string; customerName: string; customerPhone: string;
  customerEmail: string | null; description: string; quantity: number; requestedMaterial: string | null;
  requestedColor: string | null; requestedSize: string | null; attachmentPath: string | null;
  status: string; internalNote: string | null; createdAt: Date;
  copyrightConfirmed: boolean; tosVersion: string | null; ipRiskFlag: boolean;
  makerworldSnapshot: CustomRequestMakerWorldSnapshot | null;
  quoteEstimateSnapshot: CustomRequestQuoteEstimateSnapshot | null;
};

/** ADR-0034: automatic estimate shown for an uploaded file, recomputed at submission. */
export type CustomRequestQuoteEstimateSnapshot = {
  kind: 'SLICED' | 'MESH';
  option: 'ASSEMBLED' | 'KIT' | 'STANDARD';
  priceVnd: number | null;
  minVnd: number | null;
  maxVnd: number | null;
  materialType: string;
  specs: { printMinutes: number | null; netWeightGrams: number | null; platesCount: number | null; colorsCount: number; sizeMm?: { x: number; y: number; z: number } };
  estimatedAt: string;
};

/** Phase B (makerworld-phase-b-storefront-estimate.md §4): what a storefront customer picked and the
 * reference price they were shown — computed server-side at submission, never sent by the browser. */
export type CustomRequestMakerWorldSnapshot = {
  sourceUrl: string;
  modelId: string;
  profileId: string | null;
  modelTitle: string | null;
  profileTitle: string | null;
  tier: 'ASSEMBLED' | 'KIT';
  profileConfirmed: true;
  estimateSource: 'VERIFIED' | 'AUTO' | 'SPEC' | 'SCREENSHOT' | 'NONE';
  estimatedPriceVnd: number | null;
  estimatedAt: string;
  /** ADR-0034: the spec line the customer pasted (estimateSource SPEC) — staff should double-check it.
   * ADR-0039: for a screenshot estimate, a spec line rebuilt from what the vision model read. */
  specText?: string;
  /** ADR-0039: screenshot estimate details (the image itself is the request's attachment_path). */
  screenshot?: CustomRequestScreenshotSnapshot;
};

export type CustomRequestScreenshotSnapshot = {
  estimateId: string;
  matchStatus: 'MATCH' | 'MISMATCH' | 'UNKNOWN';
  modelTitleExtracted: string | null;
  selectedProfileKey: string;
  profiles: Array<{ key: string; title: string; specLine: string; dataIncomplete: boolean }>;
};

export async function getCustomRequestById(id: string): Promise<CustomRequestDetail | null> {
  const result = await query<CustomRequestDetail>(`
    select id, request_number as "requestNumber", source_channel as "sourceChannel", customer_name as "customerName",
      customer_phone as "customerPhone", customer_email as "customerEmail", description, quantity,
      requested_material as "requestedMaterial", requested_color as "requestedColor", requested_size as "requestedSize",
      attachment_path as "attachmentPath", status, internal_note as "internalNote", created_at as "createdAt",
      copyright_confirmed as "copyrightConfirmed", tos_version as "tosVersion", ip_risk_flag as "ipRiskFlag",
      makerworld_snapshot as "makerworldSnapshot", quote_estimate_snapshot as "quoteEstimateSnapshot"
    from custom_requests where id = $1`, [id]);
  return result.rows[0] ?? null;
}
