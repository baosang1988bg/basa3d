'use client';

// Feature 003 — review grid: quick edit (OWNER + STAFF), bulk approve/reject (OWNER; the server
// checks the role again). Mobile first: 1 column, 2 from sm, 3–4 on large screens; 44 px targets.
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ImportListItem, DecisionBlockReason } from '@/services/stl-import.service';
import { approveImportItemsAction, quickEditImportItemAction, rejectImportItemsAction, requestRerenderAction, type StlImportActionResult } from './actions';

type Category = { id: string; name: string; slug: string };

const LICENSE_OPTIONS = [
  ['UNKNOWN', 'Chưa xác định'], ['OWN_DESIGN', 'Tự thiết kế'], ['CC_BY', 'CC BY'], ['CC0', 'CC0 / Public Domain'],
  ['COMMERCIAL_LICENSE', 'Đã mua Commercial License'], ['OTHER', 'Khác (ghi rõ ở link nguồn)'],
] as const;

const WARNING_LABELS: Record<string, string> = {
  UNIT_TOO_SMALL: 'Nghi sai đơn vị (quá nhỏ)', UNIT_TOO_LARGE: 'Nghi sai đơn vị (quá lớn)', MESH_NOT_WATERTIGHT: 'Mesh không kín',
  PARTS_OVERLAP: 'Các phần chồng nhau — có thể gộp sai', UNPRICED: 'Chưa ước được giá', OVERSIZE_SKIPPED_PART: 'Bỏ qua file quá lớn',
};

const REASON_LABELS: Record<DecisionBlockReason, string> = {
  NOT_APPROVED: 'chưa duyệt', LICENSE_NOT_REVIEWED: 'chưa kiểm tra bản quyền', NO_IMAGE: 'chưa có ảnh', NO_PRICE: 'giá chưa > 0',
  UNCATEGORIZED: 'chưa chọn danh mục', NOT_RENDERED: 'chưa có ảnh render', STALE: 'dữ liệu đã đổi — tải lại trang',
  NOT_PENDING: 'không còn ở trạng thái chờ duyệt', NOT_FOUND: 'không tìm thấy',
};

const STATUS_LABELS: Record<string, string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối' };

function formatVnd(value: number | null) {
  return value === null ? '—' : `${value.toLocaleString('vi-VN')} đ`;
}

function ImportCard({ item, categories, isOwner, selected, onToggle }: {
  item: ImportListItem; categories: Category[]; isOwner: boolean; selected: boolean; onToggle: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    name: item.name ?? '', categoryId: item.categoryId ?? '', basePrice: item.basePrice === null ? '' : String(item.basePrice),
    licenseType: item.licenseType ?? 'UNKNOWN', licenseSourceUrl: item.licenseSourceUrl ?? '', licenseReviewed: item.licenseReviewed,
  });
  const editable = Boolean(item.productId) && item.reviewStatus !== 'REJECTED';
  const isNonCommercial = /NC|UNKNOWN|OTHER/.test(form.licenseType) || /\bnc\b|non-?commercial/i.test(form.licenseSourceUrl);

  function report(result: StlImportActionResult, okText: string) {
    if (result.ok) { setMessage({ tone: 'ok', text: okText }); router.refresh(); return; }
    setMessage({ tone: 'error', text: result.code === 'STALE_WRITE' ? 'Dữ liệu đã thay đổi trên thiết bị khác — đã tải lại, hãy sửa lại.' : result.error });
    if (result.code === 'STALE_WRITE') router.refresh();
  }

  function save() {
    if (!item.productId || !item.productUpdatedAt) return;
    const price = form.basePrice.trim() === '' ? null : Number(form.basePrice);
    if (price !== null && (!Number.isSafeInteger(price) || price < 0)) { setMessage({ tone: 'error', text: 'Giá phải là số nguyên VND ≥ 0.' }); return; }
    startTransition(async () => {
      report(await quickEditImportItemAction({
        itemId: item.itemId, productId: item.productId, expectedItemUpdatedAt: item.itemUpdatedAt, expectedProductUpdatedAt: item.productUpdatedAt,
        name: form.name, categoryId: form.categoryId || null, basePrice: price, licenseType: form.licenseType,
        licenseSourceUrl: form.licenseSourceUrl.trim() || null, licenseReviewed: form.licenseReviewed,
      }), 'Đã lưu.');
    });
  }

  function rerender() {
    startTransition(async () => {
      report(await requestRerenderAction({ itemId: item.itemId, expectedItemUpdatedAt: item.itemUpdatedAt }), 'Lần nhập sau sẽ làm lại ảnh.');
    });
  }

  const flags: { label: string; tone: 'destructive' | 'secondary' | 'outline' }[] = [
    ...(item.renderStatus === 'ERROR' ? [{ label: 'Lỗi xử lý', tone: 'destructive' as const }] : []),
    ...(!item.licenseReviewed ? [{ label: 'Chưa kiểm tra bản quyền', tone: 'destructive' as const }] : []),
    ...(item.needsPriceReview ? [{ label: 'Cần xem lại giá', tone: 'secondary' as const }] : []),
    ...(item.sourceChangedAt ? [{ label: 'Nguồn đã đổi — cần xem lại', tone: 'destructive' as const }] : []),
    ...(item.needsRerender ? [{ label: 'Chờ làm lại ảnh', tone: 'outline' as const }] : []),
    ...item.warnings.map((warning) => ({ label: WARNING_LABELS[warning] ?? warning, tone: 'outline' as const })),
  ];

  return (
    <article className={`flex flex-col gap-2 rounded-xl border bg-card p-3 ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        {item.coverUrl
          ? <Image src={item.coverUrl} alt={item.name ?? ''} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover" />
          : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chưa có ảnh</div>}
        {isOwner && item.reviewStatus === 'PENDING' && item.renderStatus === 'RENDERED' ? (
          <label className="absolute left-2 top-2 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg bg-background/90">
            <input type="checkbox" checked={selected} onChange={onToggle} className="size-5" aria-label={`Chọn ${item.name ?? 'mẫu'}`} />
          </label>
        ) : null}
        <Badge variant="secondary" className="absolute right-2 top-2">{STATUS_LABELS[item.reviewStatus] ?? item.reviewStatus}</Badge>
      </div>

      <div className="flex flex-wrap gap-1">
        {flags.map((flag) => <Badge key={flag.label} variant={flag.tone}>{flag.label}</Badge>)}
        {isNonCommercial ? <Badge variant="destructive">Giấy phép: {LICENSE_OPTIONS.find(([value]) => value === form.licenseType)?.[1] ?? form.licenseType}</Badge> : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {item.bboxMm ? `${item.bboxMm.x} × ${item.bboxMm.y} × ${item.bboxMm.z} mm` : '—'}
        {item.volumeCm3 !== null ? ` · ${item.volumeCm3} cm³` : ''} · {formatVnd(item.basePrice)}
      </p>
      <p className="break-all text-xs text-muted-foreground" title="Đường dẫn file gốc (chỉ admin thấy)">📁 {item.sourceRelPath}</p>
      {item.processError ? <p className="break-words text-xs text-destructive">{item.processError}</p> : null}

      {editable ? (
        <div className="flex flex-col gap-2">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Tên" className="h-11" maxLength={200} />
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} aria-label="Danh mục" className="h-11 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="">— Chọn danh mục —</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <Input value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} inputMode="numeric" placeholder="Giá (VND)" aria-label="Giá (VND)" className="h-11" />
          <select value={form.licenseType} onChange={(e) => setForm({ ...form, licenseType: e.target.value })} aria-label="Loại giấy phép" className="h-11 rounded-lg border border-input bg-background px-3 text-sm">
            {LICENSE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Input value={form.licenseSourceUrl} onChange={(e) => setForm({ ...form, licenseSourceUrl: e.target.value })} placeholder="Link nguồn giấy phép" aria-label="Link nguồn giấy phép" className="h-11" />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={form.licenseReviewed} onChange={(e) => setForm({ ...form, licenseReviewed: e.target.checked })} className="size-5" />
            Đã kiểm tra bản quyền (tôi chịu trách nhiệm)
          </label>
          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={pending} className="h-11 flex-1">Lưu</Button>
            {item.reviewStatus === 'PENDING' ? <Button type="button" variant="outline" onClick={rerender} disabled={pending} className="h-11">Làm lại ảnh</Button> : null}
          </div>
        </div>
      ) : item.reviewStatus === 'PENDING' ? (
        <Button type="button" variant="outline" onClick={rerender} disabled={pending} className="h-11">Làm lại ảnh</Button>
      ) : null}
      {message ? <p role="status" className={`text-sm ${message.tone === 'ok' ? 'text-emerald-700' : 'text-destructive'}`}>{message.text}</p> : null}
    </article>
  );
}

export function ImportGrid({ items, categories, isOwner }: { items: ImportListItem[]; categories: Category[]; isOwner: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmReject, setConfirmReject] = useState(false);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{ text: string; blocked: { name: string; reasons: string }[] } | null>(null);
  const byId = useMemo(() => new Map(items.map((item) => [item.itemId, item])), [items]);

  function toggle(itemId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  function decide(kind: 'approve' | 'reject') {
    const refs = [...selected].map((itemId) => ({ itemId, expectedItemUpdatedAt: byId.get(itemId)?.itemUpdatedAt ?? '' }));
    startTransition(async () => {
      const result = await (kind === 'approve' ? approveImportItemsAction : rejectImportItemsAction)({ items: refs });
      setConfirmReject(false);
      if (!result.ok || !result.decision) { setOutcome({ text: result.ok ? 'Không có thay đổi.' : result.error, blocked: [] }); return; }
      const { done, blocked } = result.decision;
      setOutcome({
        text: `${kind === 'approve' ? 'Đã duyệt lên web' : 'Đã từ chối'}: ${done.length} mẫu.${blocked.length ? ` Bị chặn: ${blocked.length}.` : ''}`,
        blocked: blocked.map((entry) => ({ name: byId.get(entry.itemId)?.name ?? entry.itemId, reasons: entry.reasons.map((reason) => REASON_LABELS[reason] ?? reason).join(', ') })),
      });
      setSelected(new Set());
      router.refresh();
    });
  }

  if (!items.length) return <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Không có mẫu nào khớp bộ lọc.</p>;

  return (
    <>
      {outcome ? (
        <div role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-medium">{outcome.text}</p>
          {outcome.blocked.length ? (
            <ul className="mt-1 list-disc pl-5">
              {outcome.blocked.map((entry) => <li key={entry.name}><b>{entry.name}</b>: {entry.reasons}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <ImportCard key={`${item.itemId}-${item.itemUpdatedAt}-${item.productUpdatedAt}`} item={item} categories={categories} isOwner={isOwner}
            selected={selected.has(item.itemId)} onToggle={() => toggle(item.itemId)} />
        ))}
      </div>
      {isOwner && selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <span className="text-sm">Đã chọn {selected.size}</span>
            <Button type="button" onClick={() => decide('approve')} disabled={pending} className="h-11 flex-1 sm:flex-none">Duyệt lên web</Button>
            {confirmReject ? (
              <>
                <Button type="button" variant="destructive" onClick={() => decide('reject')} disabled={pending} className="h-11">Xác nhận từ chối</Button>
                <Button type="button" variant="outline" onClick={() => setConfirmReject(false)} className="h-11">Huỷ</Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirmReject(true)} disabled={pending} className="h-11">Từ chối</Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setSelected(new Set())} className="h-11">Bỏ chọn</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
