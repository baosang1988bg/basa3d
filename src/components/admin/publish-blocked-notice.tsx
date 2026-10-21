import { PUBLISH_BLOCK_LABELS, PUBLISH_BLOCK_REASONS, type PublishBlockReason } from '@/lib/stl-import/publish-gate';

// Feature 003: shown after a product save/unarchive was refused by the import publish gate. The
// reasons come back through `?publishBlocked=a,b` (server actions redirect there instead of throwing,
// so the admin sees why rather than the generic error page). Unknown values are ignored.
export function PublishBlockedNotice({ value }: { value?: string }) {
  const reasons = (value ?? '').split(',').filter((reason): reason is PublishBlockReason => (PUBLISH_BLOCK_REASONS as readonly string[]).includes(reason));
  if (!reasons.length) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <p className="font-medium">Không thể đưa sản phẩm nhập từ kho STL lên web:</p>
      <ul className="mt-1 list-disc pl-5">{reasons.map((reason) => <li key={reason}>{PUBLISH_BLOCK_LABELS[reason]}</li>)}</ul>
      <p className="mt-1">Xử lý ở trang <a href="/admin/stl-import" className="underline">Kho nhập STL</a>.</p>
    </div>
  );
}
