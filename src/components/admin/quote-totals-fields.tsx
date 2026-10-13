'use client';

import { useCallback, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeQuoteTotals, formatVatRatePct } from '@/lib/pricing/vat';

function readVnd(root: HTMLElement | null, id: string): number | null {
  const el = root?.querySelector<HTMLInputElement>(`#${id}`);
  if (!el || el.value.trim() === '') return null;
  const value = Number(el.value);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * Phase 33 S1: subtotal / shipping / discount inputs + a READ-ONLY VAT line and total for the admin
 * "Tạo báo giá" form. The total is derived with the same `computeQuoteTotals` the server uses, from
 * the CURRENT pricing config's VAT setting passed in by the page, so the submitted total matches
 * createQuote's server-side total (otherwise it throws QUOTE_TOTAL_MISMATCH).
 *
 * The inputs stay uncontrolled because the pricing panels write `#subtotal` directly through the
 * DOM (see setSiblingInputs / applyToForm) and then dispatch a bubbling `input` event, which the
 * `onInput` handler below picks up.
 */
export function QuoteTotalsFields({ vatEnabled, vatRateBps }: { vatEnabled: boolean; vatRateBps: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [vatAmount, setVatAmount] = useState<number | null>(null);

  const recompute = useCallback(() => {
    const root = rootRef.current;
    const totalInput = root?.querySelector<HTMLInputElement>('#total');
    if (!totalInput) return;
    const subtotal = readVnd(root, 'subtotal');
    if (subtotal === null) {
      totalInput.value = '';
      setVatAmount(null);
      return;
    }
    const totals = computeQuoteTotals(
      { subtotal, shippingFee: readVnd(root, 'shippingFee') ?? 0, discount: readVnd(root, 'discount') ?? 0 },
      { enabled: vatEnabled, rateBps: vatRateBps },
    );
    totalInput.value = totals.total >= 0 ? String(totals.total) : '';
    setVatAmount(totals.vatAmount);
  }, [vatEnabled, vatRateBps]);

  return (
    <div ref={rootRef} onInput={recompute} className="col-span-2 grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subtotal">Tạm tính (VND)</Label>
        <Input id="subtotal" name="subtotal" type="number" min={0} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shippingFee">Phí vận chuyển (VND)</Label>
        <Input id="shippingFee" name="shippingFee" type="number" min={0} defaultValue={0} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="discount">Giảm giá (VND)</Label>
        <Input id="discount" name="discount" type="number" min={0} defaultValue={0} />
      </div>
      {vatEnabled ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vatAmountPreview">VAT {formatVatRatePct(vatRateBps)}% (máy chủ tính)</Label>
          <Input id="vatAmountPreview" readOnly tabIndex={-1} value={vatAmount === null ? '' : String(vatAmount)} className="bg-muted/40" />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="total">Tổng tiền (VND){vatEnabled ? ' — đã gồm VAT' : ''}</Label>
        <Input id="total" name="total" type="number" min={0} required readOnly className="bg-muted/40" />
      </div>
    </div>
  );
}
