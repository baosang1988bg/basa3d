import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import type { ActionableRecentItems } from '@/services/dashboard.service';

export function RecentActionableCard({ actionableItems }: { actionableItems: ActionableRecentItems }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium">Đơn hàng mới cần xử lý</p>
        <ul className="flex flex-col divide-y divide-border">
          {actionableItems.pendingOrders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{order.orderCode}</span>
                <span className="truncate text-xs text-muted-foreground">{order.customerName}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{order.status}</Badge>
                <Link href={`/admin/orders/${order.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>Xử lý</Link>
              </div>
            </li>
          ))}
          {!actionableItems.pendingOrders.length ? <li className="py-2 text-sm text-muted-foreground">Không có đơn nào cần xử lý ngay</li> : null}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Yêu cầu tuỳ chỉnh mới</p>
        <ul className="flex flex-col divide-y divide-border">
          {actionableItems.openCustomRequests.map((request) => (
            <li key={request.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{request.requestCode}</span>
                <span className="truncate text-xs text-muted-foreground">{request.customerName} · {request.sourceChannel}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{request.status}</Badge>
                <Link href={`/admin/custom-requests/${request.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>Xử lý</Link>
              </div>
            </li>
          ))}
          {!actionableItems.openCustomRequests.length ? <li className="py-2 text-sm text-muted-foreground">Không có yêu cầu nào cần xử lý ngay</li> : null}
        </ul>
      </div>
    </div>
  );
}
