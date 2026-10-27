'use client';

// Phase 52 P4 — "Nhập theo mẻ": one reason + one warehouse for many variants, saved in one transaction
// (all lines or none). Search replaces the old flat <select> of every variant.
import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QUICK_RESTOCK_INTENT_LABELS, planStockEvent, type QuickRestockIntentValue } from '@/lib/inventory/quick-restock-plan';
import { quickRestockBatchAction } from '@/app/admin/(protected)/product-inventory/actions';
import type { StockTrackedVariant } from '@/services/quick-restock.service';

type Line = { variantId: string; quantityText: string; unitCostText: string };

const INTENT_ORDER: QuickRestockIntentValue[] = ['PRINTED', 'PURCHASED', 'COUNTED', 'DAMAGED'];
const MAX_RESULTS = 8;

const digitsOnly = (value: string) => value.replace(/[^\d]/g, '');
const toInt = (value: string): number | null => (digitsOnly(value) ? Number(digitsOnly(value)) : null);
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function BatchRestockButton({
  variants,
  warehouses,
}: {
  variants: StockTrackedVariant[];
  warehouses: { id: string; name: string; code: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!variants.length || !warehouses.length}>
        <Layers className="mr-1.5 size-4 text-emerald-600" />
        Nhập theo mẻ
      </Button>
      {open ? <BatchRestockDialog variants={variants} warehouses={warehouses} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function BatchRestockDialog({
  variants,
  warehouses,
  onClose,
}: {
  variants: StockTrackedVariant[];
  warehouses: { id: string; name: string; code: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const batchKey = useRef(globalThis.crypto.randomUUID());
  const [intent, setIntent] = useState<QuickRestockIntentValue>('PRINTED');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(variants.map((variant) => [variant.id, variant])), [variants]);
  const searchIndex = useMemo(() => variants.map((variant) => ({ variant, text: fold(`${variant.productName} ${variant.name} ${variant.sku}`) })), [variants]);
  const results = useMemo(() => {
    const needle = fold(search.trim());
    if (!needle) return [];
    const taken = new Set(lines.map((line) => line.variantId));
    return searchIndex.filter((entry) => !taken.has(entry.variant.id) && needle.split(/\s+/).every((word) => entry.text.includes(word))).slice(0, MAX_RESULTS).map((entry) => entry.variant);
  }, [search, searchIndex, lines]);

  const rows = lines.map((line) => {
    const variant = byId.get(line.variantId)!;
    const onHand = variant.onHandByWarehouse[warehouseId] ?? 0;
    const quantity = toInt(line.quantityText);
    const plan = quantity === null || (intent !== 'COUNTED' && quantity === 0) ? null : planStockEvent(intent, quantity, onHand);
    const totalOnHand = Object.values(variant.onHandByWarehouse).reduce((sum, value) => sum + value, 0);
    const available = totalOnHand - variant.reserved;
    const tooBig = plan?.kind === 'MOVE' && plan.signedQuantity < 0 && (plan.onHandAfter < 0 || available + plan.signedQuantity < 0);
    return { line, variant, onHand, quantity, plan, tooBig };
  });
  // The server requires a note for every count (DB CHECK on ADJUSTMENT_*), so ask for it up front.
  const noteRequired = intent === 'COUNTED';
  const complete = rows.length > 0 && rows.every((row) => row.plan !== null);
  const canSubmit = complete && !rows.some((row) => row.tooBig) && Boolean(warehouseId) && (!noteRequired || note.trim()) && !isPending && !done;

  function addLine(variantId: string) {
    setLines((previous) => [...previous, { variantId, quantityText: '', unitCostText: '' }]);
    setSearch('');
    setError(null);
  }

  function updateLine(variantId: string, patch: Partial<Line>) {
    setLines((previous) => previous.map((line) => (line.variantId === variantId ? { ...line, ...patch } : line)));
    setError(null);
  }

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const response = await quickRestockBatchAction({
        batchKey: batchKey.current,
        warehouseId,
        intent,
        note: note.trim() || null,
        lines: rows.map((row) => ({
          productVariantId: row.variant.id,
          quantity: row.quantity ?? 0,
          expectedOnHand: intent === 'COUNTED' ? row.onHand : null,
          unitCost: intent === 'PURCHASED' ? toInt(row.line.unitCostText) : null,
        })),
      }).catch(() => ({ ok: false as const, code: 'NETWORK', message: 'Mất kết nối. Bấm Lưu lại — hệ thống sẽ không ghi trùng.' }));
      if (!response.ok) {
        setError(response.message);
        if (response.code === 'IDEMPOTENCY_CONFLICT') batchKey.current = globalThis.crypto.randomUUID();
        // Stock changed (or an earlier save went through): reload the on-hand numbers this form shows.
        if (response.code === 'STOCK_CHANGED' || response.code === 'IDEMPOTENCY_CONFLICT') router.refresh();
        return;
      }
      const written = response.result.lines.filter((line) => line.status !== 'NO_CHANGE').length;
      setDone(`Đã ghi ${written}/${response.result.lines.length} dòng vào sổ kho.`);
      setTimeout(onClose, 1400);
    });
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhập kho theo mẻ</DialogTitle>
          <DialogDescription>Một lý do, nhiều sản phẩm, lưu 1 lần. Lỗi ở bất kỳ dòng nào thì cả mẻ không ghi.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div role="radiogroup" aria-label="Lý do" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {INTENT_ORDER.map((value) => (
              <button key={value} type="button" role="radio" aria-checked={intent === value} onClick={() => { setIntent(value); setError(null); }}
                className={`rounded-lg border p-2 text-left text-sm font-semibold transition-colors ${intent === value ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:bg-muted/40'}`}>
                {QUICK_RESTOCK_INTENT_LABELS[value].title}
              </button>
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{QUICK_RESTOCK_INTENT_LABELS[intent].hint}</p>

          {warehouses.length > 1 ? (
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="batch-warehouse">Kho</Label>
              <select id="batch-warehouse" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </div>
          ) : null}

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên sản phẩm, màu hoặc SKU…" className="pl-8" aria-label="Tìm sản phẩm" autoFocus
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (results[0]) addLine(results[0].id); } }} />
            {results.length ? (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                {results.map((variant) => (
                  <li key={variant.id}>
                    <button type="button" onClick={() => addLine(variant.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                      <span className="truncate"><span className="font-medium">{variant.productName}</span> — {variant.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{variant.sku}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : search.trim() ? <p className="mt-1 text-xs text-muted-foreground">Không thấy sản phẩm có sẵn (READY_STOCK) nào khớp.</p> : null}
          </div>

          {rows.length ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Sản phẩm</th>
                    <th className="px-2 py-2 text-right font-medium">Trên kệ</th>
                    <th className="px-2 py-2 text-right font-medium">{intent === 'COUNTED' ? 'Đếm được' : 'Số lượng'}</th>
                    {intent === 'PURCHASED' ? <th className="px-2 py-2 text-right font-medium">Giá nhập/món</th> : null}
                    <th className="px-2 py-2 text-right font-medium">Sau</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(({ line, variant, onHand, plan, tooBig }) => (
                    <tr key={line.variantId} className={tooBig ? 'bg-rose-500/5' : undefined}>
                      <td className="px-3 py-1.5"><div className="font-medium">{variant.productName}</div><div className="font-mono text-[11px] text-muted-foreground">{variant.name} · {variant.sku}</div></td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{onHand}</td>
                      <td className="px-2 py-1.5"><Input inputMode="numeric" value={line.quantityText} onChange={(event) => updateLine(line.variantId, { quantityText: digitsOnly(event.target.value) })} placeholder="0" aria-label={`Số lượng ${variant.productName} ${variant.name}`} className="h-8 w-20 text-right tabular-nums" /></td>
                      {intent === 'PURCHASED' ? <td className="px-2 py-1.5"><Input inputMode="numeric" value={line.unitCostText} onChange={(event) => updateLine(line.variantId, { unitCostText: digitsOnly(event.target.value) })} placeholder="tuỳ chọn" aria-label={`Giá nhập ${variant.productName}`} className="h-8 w-28 text-right tabular-nums" /></td> : null}
                      <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${tooBig ? 'text-rose-600' : ''}`}>
                        {plan ? (plan.kind === 'NO_CHANGE' ? 'khớp' : plan.onHandAfter) : '—'}
                      </td>
                      <td className="pr-2"><button type="button" aria-label={`Bỏ ${variant.productName}`} onClick={() => setLines((previous) => previous.filter((l) => l.variantId !== line.variantId))} className="rounded p-1 hover:bg-muted"><X className="size-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Tìm và chọn các sản phẩm trong mẻ.</p>}
          {rows.some((row) => row.tooBig) ? <p className="text-xs text-rose-600">Dòng tô đỏ trừ quá số trên kệ hoặc quá số còn bán được (đang giữ cho đơn).</p> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-note">Ghi chú{noteRequired ? ' (bắt buộc khi kiểm kê)' : ' (tuỳ chọn)'}</Label>
            <Textarea id="batch-note" rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="VD: mẻ in sáng 27/10, máy X1C" />
          </div>

          {error ? <p className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}
          {done ? <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-sm text-emerald-700 dark:text-emerald-300" role="status">{done}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Lưu {rows.length ? `${rows.length} dòng` : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
