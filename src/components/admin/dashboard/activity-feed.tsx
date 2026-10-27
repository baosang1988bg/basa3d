'use client';

// "Việc cần xử lý" feed (UX refresh 2026-10-27): new orders and open custom requests in one timeline,
// newest first, with a segmented filter — replaces two stacked lists with English status codes.
// STAFF-safe: receives only ActionableRecentItems (no money).
import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, MessageSquareText, ShoppingBag } from 'lucide-react';
import type { ActionableRecentItems } from '@/services/dashboard.service';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'orders' | 'requests';

const ORDER_STATUS: Record<string, string> = { NEW: 'Đơn mới', CONFIRMED: 'Đã xác nhận' };
const REQUEST_STATUS: Record<string, string> = { NEW: 'Mới', REVIEWING: 'Đang xem', NEED_INFO: 'Cần thêm thông tin', QUOTED: 'Đã báo giá' };
const CHANNEL: Record<string, string> = { ZALO: 'Zalo', FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', WEBSITE: 'Website', OTHER: 'Khác' };

function relativeTime(date: Date, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

export function ActivityFeed({ items, now }: { items: ActionableRecentItems; now: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const nowMs = new Date(now).getTime();
  const rows = [
    ...items.pendingOrders.map((order) => ({
      kind: 'orders' as const, id: order.id, code: order.orderCode, who: order.customerName, createdAt: order.createdAt,
      status: ORDER_STATUS[order.status] ?? order.status, href: `/admin/orders/${order.id}`, extra: null as string | null,
    })),
    ...items.openCustomRequests.map((request) => ({
      kind: 'requests' as const, id: request.id, code: request.requestCode, who: request.customerName, createdAt: request.createdAt,
      status: REQUEST_STATUS[request.status] ?? request.status, href: `/admin/custom-requests/${request.id}`, extra: CHANNEL[request.sourceChannel] ?? request.sourceChannel,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const visible = filter === 'all' ? rows : rows.filter((row) => row.kind === filter);

  const segment = (value: Filter, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={filter === value}
      onClick={() => setFilter(value)}
      className={cn(
        'rounded px-2 py-1 text-xs transition-colors',
        filter === value ? 'bg-background text-foreground shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label} <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-4 pb-2 sm:px-5">
        <div role="group" aria-label="Lọc việc cần xử lý" className="inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-muted/40 p-0.5">
          {segment('all', 'Tất cả', rows.length)}
          {segment('orders', 'Đơn hàng', items.pendingOrders.length)}
          {segment('requests', 'Yêu cầu in', items.openCustomRequests.length)}
        </div>
      </div>
      {visible.length ? (
        <ul className="max-h-[420px] divide-y divide-border/60 overflow-y-auto border-t border-border/60">
          {visible.map((row) => (
            <li key={`${row.kind}-${row.id}`}>
              <Link href={row.href} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 sm:px-5">
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', row.kind === 'orders' ? 'bg-primary/10 text-primary' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400')}>
                  {row.kind === 'orders' ? <ShoppingBag className="size-4" /> : <MessageSquareText className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-medium">{row.who}</span>
                    <span className="text-muted-foreground"> · {row.kind === 'orders' ? 'đặt hàng' : `yêu cầu in${row.extra ? ` qua ${row.extra}` : ''}`}</span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <span className="font-mono">{row.code}</span> · {relativeTime(row.createdAt, nowMs)}
                  </p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">{row.status}</span>
                <span className="flex shrink-0 items-center text-xs font-medium text-primary">
                  Xử lý
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-border/60 px-5 py-10 text-center text-sm text-muted-foreground">Không có việc nào đang chờ — xưởng đang gọn gàng.</p>
      )}
    </div>
  );
}
