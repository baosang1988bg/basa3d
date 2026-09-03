import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { resolveStatusFilter, StatusFilterTabs, type StatusFilterGroup } from '@/components/admin/status-filter-tabs';
import { listOrders } from '@/services/order.service';

const FILTER_GROUPS: StatusFilterGroup[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ', statuses: ['NEW', 'CONFIRMED'] },
  { key: 'in_progress', label: 'Đang xử lý', statuses: ['PRODUCING', 'READY_TO_SHIP', 'SHIPPED'] },
  { key: 'completed', label: 'Hoàn tất', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Đã huỷ', statuses: ['CANCELLED'] },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const { activeKey, statuses } = resolveStatusFilter(FILTER_GROUPS, filter);
  const { items: orders } = await listOrders({ limit: 100, statuses });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Đơn hàng</h1>

      <StatusFilterTabs basePath="/admin/orders" groups={FILTER_GROUPS} activeKey={activeKey} />

      <Card>
        <CardHeader><CardTitle>Danh sách đơn hàng ({orders.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Trạng thái đơn</TableHead>
                <TableHead>Trạng thái thanh toán</TableHead>
                <TableHead>Tổng tiền</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order: { id: string; orderNumber: string; customerName: string; status: string; paymentStatus: string; total: number; createdAt: string }) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell><Badge variant={order.status === 'CANCELLED' ? 'destructive' : 'default'}>{order.status}</Badge></TableCell>
                  <TableCell>{order.paymentStatus}</TableCell>
                  <TableCell>{Number(order.total).toLocaleString('vi-VN') + 'đ'}</TableCell>
                  <TableCell>{new Date(order.createdAt).toLocaleString('vi-VN')}</TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Link href={`/admin/orders/${order.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>Chi tiết</Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
