'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';

type Result =
  | { status: 'OK'; grams: number; printMinutes: number; sizeMm: { x: number; y: number; z: number }; unitPriceVnd: number; lineSubtotalVnd: number; floorApplied: boolean; mismatchPct: number | null }
  | { status: 'TOO_LARGE' | 'UNREADABLE' | 'UNPRICED' | 'NO_PRICING_CONFIG'; reason?: string }
  | { status: 'ERROR'; message: string };

const MESSAGES: Record<string, string> = {
  TOO_LARGE: 'File lớn hơn 20MB — kiểm tra file thủ công.',
  UNREADABLE: 'Máy chủ không đọc được file — kiểm tra file thủ công.',
  UNPRICED: 'Không tính được giá tự động (vượt khổ / hình khối lỗi).',
  NO_PRICING_CONFIG: 'Chưa có cấu hình giá.',
};

/** Phase 33 S7: CLIENT_REPORTED items have browser numbers only — pre-fill is locked until staff
 * re-verify on the server. "Dùng giá này" writes #subtotal and lets QuoteTotalsFields recompute. */
export function ReverifyItemButton({ action, subtotalInputId = 'subtotal' }: { action: () => Promise<Result>; subtotalInputId?: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  function applyResult(value: number) {
    const el = document.getElementById(subtotalInputId);
    if (el instanceof HTMLInputElement) {
      el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => setResult(await action()))}>
        {pending ? 'Đang kiểm tra…' : 'Kiểm tra lại trên server'}
      </Button>
      {result?.status === 'OK' ? (
        <p className="text-xs">
          {result.grams}g · {Math.round((result.printMinutes / 60) * 10) / 10}h · {result.lineSubtotalVnd.toLocaleString('vi-VN')}đ
          {result.mismatchPct !== null ? ` · lệch ${result.mismatchPct}% so với số khách gửi` : ''}{' '}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => applyResult(result.lineSubtotalVnd)}>Dùng giá này</button>
        </p>
      ) : null}
      {result && result.status !== 'OK' ? <p className="text-xs text-muted-foreground">{result.status === 'ERROR' ? result.message : MESSAGES[result.status]}</p> : null}
    </div>
  );
}
