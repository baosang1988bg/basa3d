// Feature 003 (FR-021): turns the publish-gate trigger's exception into a DomainError with readable
// reasons. The trigger (migration 20261022000000) is the source of truth; this only translates it.
import { DomainError } from '../domain-error';

export const PUBLISH_BLOCK_REASONS = ['NOT_APPROVED', 'LICENSE_NOT_REVIEWED', 'NO_IMAGE', 'NO_PRICE', 'UNCATEGORIZED'] as const;
export type PublishBlockReason = typeof PUBLISH_BLOCK_REASONS[number];

export const PUBLISH_BLOCK_LABELS: Record<PublishBlockReason, string> = {
  NOT_APPROVED: 'mẫu nhập chưa được OWNER duyệt ở "Kho nhập STL"',
  LICENSE_NOT_REVIEWED: 'chưa tick "đã kiểm tra bản quyền"',
  NO_IMAGE: 'chưa có ảnh',
  NO_PRICE: 'giá chưa > 0',
  UNCATEGORIZED: 'danh mục đang là "Chưa phân loại"',
};

export class PublishBlockedError extends DomainError {
  constructor(public readonly reasons: PublishBlockReason[]) {
    super('IMPORT_PUBLISH_BLOCKED', `Không thể đưa sản phẩm nhập từ kho STL lên web: ${reasons.map((reason) => PUBLISH_BLOCK_LABELS[reason]).join('; ')}.`, 409);
  }
}

function pgMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === 'P0001' && typeof message === 'string' ? message : null;
}

/** Reasons from an `IMPORT_PUBLISH_BLOCKED:<a,b>` exception, or null for any other error. */
export function publishBlockedReasons(error: unknown): PublishBlockReason[] | null {
  const message = pgMessage(error);
  if (!message?.startsWith('IMPORT_PUBLISH_BLOCKED:')) return null;
  return message.slice('IMPORT_PUBLISH_BLOCKED:'.length).split(',')
    .filter((reason): reason is PublishBlockReason => (PUBLISH_BLOCK_REASONS as readonly string[]).includes(reason));
}

/** Rethrows the gate triggers' exceptions as 409 DomainErrors; anything else passes through. */
export function translateImportGateError(error: unknown): unknown {
  const reasons = publishBlockedReasons(error);
  if (reasons) return new PublishBlockedError(reasons);
  if (pgMessage(error) === 'IMPORT_LINK_BLOCKED') {
    return new DomainError('IMPORT_LINK_BLOCKED', 'Sản phẩm đang bán: mẫu nhập phải giữ trạng thái đã duyệt và đã kiểm tra bản quyền.', 409);
  }
  return error;
}
