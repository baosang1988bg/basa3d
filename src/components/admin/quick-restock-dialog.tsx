'use client';

// Phase 52 — "Nhập kho nhanh" (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md, P1).
// Staff pick WHY stock changes and type a positive number; the server (quick-restock.service) decides
// the movement type and sign. The preview below uses the same pure planStockEvent the server uses.
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { AlertTriangle, ClipboardCheck, Loader2, PackagePlus, Printer, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  QUICK_RESTOCK_INTENT_LABELS,
  planStockEvent,
  type QuickRestockIntentValue,
} from '@/lib/inventory/quick-restock-plan';
import {
  getQuickRestockContextAction,
  quickRestockAction,
  type QuickRestockDialogContext,
} from '@/app/admin/(protected)/product-inventory/actions';

export type QuickRestockVariantOption = { id: string; sku: string; name: string };

const INTENTS: { value: QuickRestockIntentValue; icon: typeof Printer; tone: string }[] = [
  { value: 'PRINTED', icon: Printer, tone: 'data-[active=true]:border-emerald-500 data-[active=true]:bg-emerald-500/10 [&_svg]:text-emerald-600' },
  { value: 'PURCHASED', icon: ShoppingCart, tone: 'data-[active=true]:border-sky-500 data-[active=true]:bg-sky-500/10 [&_svg]:text-sky-600' },
  { value: 'COUNTED', icon: ClipboardCheck, tone: 'data-[active=true]:border-amber-500 data-[active=true]:bg-amber-500/10 [&_svg]:text-amber-600' },
  { value: 'DAMAGED', icon: AlertTriangle, tone: 'data-[active=true]:border-rose-500 data-[active=true]:bg-rose-500/10 [&_svg]:text-rose-600' },
];

/** Digits only — "15.000" and "15,000" both mean 15000 VND; empty → null. */
function parseWholeNumber(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

function newKey(): string {
  return globalThis.crypto.randomUUID();
}

export function QuickRestockButton({
  variants,
  productName,
  size = 'sm',
  className,
}: {
  variants: QuickRestockVariantOption[];
  productName: string;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!variants.length) return null;
  return (
    <>
      <Button
        type="button"
        size={size}
        variant="outline"
        className={className}
        onClick={() => setOpen(true)}
        aria-label={`Nhập kho ${productName}`}
      >
        <PackagePlus className="mr-1 size-3.5 text-emerald-600" />
        Nhập kho
      </Button>
      {open ? <QuickRestockDialog variants={variants} productName={productName} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function QuickRestockDialog({
  variants,
  productName,
  onClose,
}: {
  variants: QuickRestockVariantOption[];
  productName: string;
  onClose: () => void;
}) {
  // One idempotency key per opening (exec-plan D3): a retry of the same submit replays, never doubles.
  const idempotencyKey = useRef(newKey());
  const [variantId, setVariantId] = useState(variants[0].id);
  const [context, setContext] = useState<QuickRestockDialogContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [intent, setIntent] = useState<QuickRestockIntentValue>('PRINTED');
  const [quantityRaw, setQuantityRaw] = useState('');
  const [unitCostRaw, setUnitCostRaw] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const quantityInput = useRef<HTMLInputElement>(null);

  // Only the latest request may set state — switching variant A→B must never leave A's numbers (and
  // A's id, which is what gets saved) on screen when A's response arrives last.
  const loadSeq = useRef(0);
  const loadContext = useCallback(async (id: string) => {
    const seq = (loadSeq.current += 1);
    setLoadError(null);
    try {
      const next = await getQuickRestockContextAction(id);
      if (seq !== loadSeq.current) return;
      if (!next) { setLoadError('Không tìm thấy biến thể này.'); setContext(null); return; }
      setContext(next);
      setWarehouseId((current) => (next.warehouses.some((w) => w.id === current) ? current : next.warehouses[0]?.id ?? ''));
    } catch {
      if (seq === loadSeq.current) setLoadError('Không tải được số tồn. Thử lại sau.');
    }
  }, []);

  useEffect(() => { void loadContext(variantId); }, [variantId, loadContext]);

  const warehouse = context?.warehouses.find((w) => w.id === warehouseId) ?? null;
  const quantity = parseWholeNumber(quantityRaw);
  const unitCost = intent === 'PURCHASED' ? parseWholeNumber(unitCostRaw) : null;
  const notStockTracked = context !== null && context.productType !== 'READY_STOCK';

  const preview = useMemo(() => {
    if (!warehouse || quantity === null) return null;
    if (intent !== 'COUNTED' && quantity === 0) return null;
    return planStockEvent(intent, quantity, warehouse.onHand);
  }, [intent, quantity, warehouse]);

  // Client-side hint only; the server re-checks under the variant lock (Rule #23).
  const availableAfter = context && preview?.kind === 'MOVE' ? context.available + preview.signedQuantity : null;
  const outboundTooBig = preview?.kind === 'MOVE' && preview.signedQuantity < 0 && (preview.onHandAfter < 0 || (availableAfter !== null && availableAfter < 0));

  const noteRequired = intent === 'COUNTED' && preview?.kind === 'MOVE';
  const canSubmit = Boolean(context && context.variantId === variantId && warehouse && preview && !notStockTracked && !outboundTooBig && !isPending && !done && (!noteRequired || note.trim()));

  function selectIntent(next: QuickRestockIntentValue) {
    setIntent(next);
    setError(null);
    queueMicrotask(() => quantityInput.current?.focus());
  }

  function submit() {
    if (!canSubmit || !context || !warehouse || quantity === null || !preview) return;
    if (preview.kind === 'NO_CHANGE') { setDone('Số đếm khớp với sổ — không cần ghi gì.'); setTimeout(onClose, 1200); return; }
    setError(null);
    startTransition(async () => {
      const response = await quickRestockAction({
        idempotencyKey: idempotencyKey.current,
        productVariantId: context.variantId,
        warehouseId: warehouse.id,
        intent,
        quantity,
        expectedOnHand: intent === 'COUNTED' ? warehouse.onHand : null,
        unitCost,
        note: note.trim() || null,
      }).catch(() => ({ ok: false as const, code: 'NETWORK', message: 'Mất kết nối. Bấm Lưu lại — hệ thống sẽ không ghi trùng.' }));
      if (!response.ok) {
        setError(response.message);
        if (response.code === 'STOCK_CHANGED') void loadContext(context.variantId);
        if (response.code === 'IDEMPOTENCY_CONFLICT') {
          // The server says what the earlier save already wrote; show fresh numbers before any new save.
          idempotencyKey.current = newKey();
          void loadContext(context.variantId);
        }
        return;
      }
      const { result } = response;
      setDone(result.status === 'NO_CHANGE'
        ? 'Số đếm khớp với sổ — không cần ghi gì.'
        : `Đã ghi. Tồn kho ${warehouse.name}: ${result.onHandBefore} → ${result.onHandAfter}.`);
      setTimeout(onClose, 1200);
    });
  }

  const label = QUICK_RESTOCK_INTENT_LABELS[intent];

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhập kho nhanh</DialogTitle>
          <DialogDescription>Chọn lý do, gõ số lượng — hệ thống tự ghi đúng loại và dấu vào sổ kho.</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => { event.preventDefault(); submit(); }}
        >
          {/* Product */}
          <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
            {context?.coverUrl ? (
              <img src={context.coverUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="size-12 shrink-0 rounded-md bg-muted" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{productName}</div>
              {variants.length > 1 ? (
                <select
                  aria-label="Biến thể"
                  value={variantId}
                  onChange={(event) => { setVariantId(event.target.value); setContext(null); setError(null); }}
                  className="mt-1 h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  {variants.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.sku}</option>)}
                </select>
              ) : (
                <div className="truncate font-mono text-xs text-muted-foreground">{variants[0].name} · {variants[0].sku}</div>
              )}
            </div>
          </div>

          {loadError ? <p className="text-sm text-rose-600" role="alert">{loadError}</p> : null}
          {!context && !loadError ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Đang tải số tồn…</div>
          ) : null}

          {notStockTracked ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-sm text-amber-800 dark:text-amber-300" role="alert">
              Sản phẩm in theo yêu cầu không quản lý tồn kho thành phẩm.
            </p>
          ) : null}

          {context && !notStockTracked ? (
            <>
              {/* Stock summary */}
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-muted/50 p-2"><dt className="text-[11px] text-muted-foreground">Trên kệ</dt><dd className="text-lg font-bold tabular-nums">{context.onHand}</dd></div>
                <div className="rounded-md bg-muted/50 p-2"><dt className="text-[11px] text-muted-foreground">Giữ cho đơn</dt><dd className="text-lg font-bold tabular-nums text-amber-600">{context.reserved}</dd></div>
                <div className="rounded-md bg-muted/50 p-2"><dt className="text-[11px] text-muted-foreground">Còn bán được</dt><dd className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{context.available}</dd></div>
              </dl>

              {context.warehouses.length > 1 ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qr-warehouse">Kho</Label>
                  <select id="qr-warehouse" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                    {context.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code}) — {w.onHand} cái</option>)}
                  </select>
                </div>
              ) : null}

              {/* Intent */}
              <div role="radiogroup" aria-label="Lý do" className="grid grid-cols-2 gap-2">
                {INTENTS.map(({ value, icon: Icon, tone }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={intent === value}
                    data-active={intent === value}
                    onClick={() => selectIntent(value)}
                    className={`flex items-start gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] ${tone}`}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="text-sm font-semibold leading-tight">{QUICK_RESTOCK_INTENT_LABELS[value].title}</span>
                  </button>
                ))}
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">{label.hint}</p>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qr-quantity">{intent === 'COUNTED' ? 'Số đếm được trên kệ' : intent === 'DAMAGED' ? 'Số món hỏng' : 'Số lượng'}</Label>
                  <Input
                    id="qr-quantity"
                    ref={quantityInput}
                    autoFocus
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={quantityRaw}
                    onChange={(event) => { setQuantityRaw(event.target.value.replace(/[^\d]/g, '')); setError(null); }}
                    className="text-lg font-semibold tabular-nums"
                  />
                </div>
                {intent === 'PURCHASED' ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="qr-unit-cost">Giá nhập / món (đ, tuỳ chọn)</Label>
                    <Input
                      id="qr-unit-cost"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="VD: 45.000"
                      value={unitCost !== null ? unitCost.toLocaleString('vi-VN') : unitCostRaw}
                      onChange={(event) => setUnitCostRaw(event.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                ) : null}
              </div>

              {/* Formula preview */}
              {preview && warehouse ? (
                <div
                  className={`rounded-lg border p-2.5 text-sm tabular-nums ${outboundTooBig ? 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-border bg-muted/30'}`}
                  aria-live="polite"
                >
                  {preview.kind === 'NO_CHANGE' ? (
                    <>Đếm được <strong>{quantity}</strong> = sổ kho <strong>{warehouse.onHand}</strong> → khớp, không cần ghi.</>
                  ) : intent === 'COUNTED' ? (
                    <>Sổ kho <strong>{warehouse.onHand}</strong> → đếm được <strong>{quantity}</strong>: chênh <strong>{preview.signedQuantity > 0 ? `+${preview.signedQuantity}` : preview.signedQuantity}</strong></>
                  ) : (
                    <>Tồn cũ <strong>{warehouse.onHand}</strong> {preview.signedQuantity > 0 ? '+' : '−'} {Math.abs(preview.signedQuantity)} = Tồn mới <strong>{preview.onHandAfter}</strong></>
                  )}
                  {outboundTooBig ? (
                    <div className="mt-1 text-xs">
                      {preview.onHandAfter < 0
                        ? 'Không thể trừ quá số đang có trên kệ.'
                        : `Chỉ còn ${context.available} món bán được (${context.reserved} đang giữ cho đơn). Huỷ/điều chỉnh đơn trước.`}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Note */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qr-note">Ghi chú{noteRequired ? ' (bắt buộc khi kiểm kê lệch)' : ' (tuỳ chọn)'}</Label>
                <Textarea
                  id="qr-note"
                  rows={2}
                  maxLength={2000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={intent === 'COUNTED' ? 'VD: đếm lại kệ A, thiếu 2 món' : intent === 'DAMAGED' ? 'VD: rơi vỡ khi đóng gói' : 'VD: mẻ in máy X1C'}
                />
              </div>
            </>
          ) : null}

          {error ? <p className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}
          {done ? <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-sm text-emerald-700 dark:text-emerald-300" role="status">{done}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Lưu vào kho
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
