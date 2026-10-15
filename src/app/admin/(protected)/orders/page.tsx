import { AdminPagination } from '@/components/admin/admin-pagination';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { resolveStatusFilter, StatusFilterTabs, type StatusFilterGroup } from '@/components/admin/status-filter-tabs';
import { listOrders, getOrderZoneCounts, type OrderListRow } from '@/services/order.service';
import {
  Printer,
  Package,
  Clock,
  Truck,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';

const FILTER_GROUPS: StatusFilterGroup[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'wait_print', label: 'Chờ in', statuses: ['NEW', 'CONFIRMED'] },
  { key: 'wait_pack', label: 'Chờ gói hàng', statuses: ['PRODUCING'] },
  { key: 'wait_ship', label: 'Chờ giao', statuses: ['READY_TO_SHIP'] },
  { key: 'shipping', label: 'Đang giao', statuses: ['SHIPPED'] },
  { key: 'completed', label: 'Hoàn thành', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Đã huỷ', statuses: ['CANCELLED'] },
];

const ZONE_CONFIG: Record<
  string,
  {
    zoneName: string;
    label: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  NEW: {
    zoneName: 'Chờ in',
    label: 'Chờ in (Mới)',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
    icon: Printer,
  },
  CONFIRMED: {
    zoneName: 'Chờ in',
    label: 'Chờ in (Đã duyệt)',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    icon: Printer,
  },
  PRODUCING: {
    zoneName: 'Chờ gói hàng',
    label: 'Chờ gói hàng (Đang SX)',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    icon: Package,
  },
  READY_TO_SHIP: {
    zoneName: 'Chờ giao',
    label: 'Chờ giao (Đã đóng gói)',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    icon: Clock,
  },
  SHIPPED: {
    zoneName: 'Đang giao',
    label: 'Đang giao vận',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
    icon: Truck,
  },
  COMPLETED: {
    zoneName: 'Hoàn thành',
    label: 'Hoàn tất',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  CANCELLED: {
    zoneName: 'Đã huỷ',
    label: 'Đã huỷ',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
    icon: AlertCircle,
  },
};

const PAYMENT_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  UNPAID: {
    label: 'Chưa TT',
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400',
  },
  DEPOSIT_PAID: {
    label: 'Đã cọc',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  },
  PAID: {
    label: 'Đã TT',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  },
  REFUNDED: {
    label: 'Hoàn tiền',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  },
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  // Phase 35 D1: never rely on the layout alone — RSC segment requests can render this page
  // without re-running the layout. requireAdmin() is cache()-memoized, so this is free.
  await requireAdmin();
  const { filter, page: pageParam } = await searchParams;
  const { activeKey, statuses } = resolveStatusFilter(FILTER_GROUPS, filter);
  const [{ items: orders, page, hasNext }, counts] = await Promise.all([
    listOrders({ page: Number(pageParam), statuses }),
    getOrderZoneCounts(),
  ]);

  const groupsWithCounts: StatusFilterGroup[] = [
    { key: 'all', label: 'Tất cả', count: counts.all },
    { key: 'wait_print', label: 'Chờ in', statuses: ['NEW', 'CONFIRMED'], count: counts.waitPrint },
    { key: 'wait_pack', label: 'Chờ gói hàng', statuses: ['PRODUCING'], count: counts.waitPack },
    { key: 'wait_ship', label: 'Chờ giao', statuses: ['READY_TO_SHIP'], count: counts.waitShip },
    { key: 'shipping', label: 'Đang giao', statuses: ['SHIPPED'], count: counts.shipping },
    { key: 'completed', label: 'Hoàn thành', statuses: ['COMPLETED'], count: counts.completed },
    { key: 'cancelled', label: 'Đã huỷ', statuses: ['CANCELLED'], count: counts.cancelled },
  ];

  const zonePipelineCards = [
    {
      key: 'wait_print',
      zoneNumber: 1,
      title: 'Chờ in',
      desc: 'Đơn mới & đã duyệt, chờ in 3D',
      count: counts.waitPrint,
      icon: Printer,
      color: 'text-sky-600 dark:text-sky-400',
      activeRing: 'ring-2 ring-sky-500 border-sky-500 bg-sky-50/40 dark:bg-sky-950/20',
      hoverBorder: 'hover:border-sky-300 dark:hover:border-sky-800',
    },
    {
      key: 'wait_pack',
      zoneNumber: 2,
      title: 'Chờ gói hàng',
      desc: 'Đang SX/in, chờ kiểm & đóng kiện',
      count: counts.waitPack,
      icon: Package,
      color: 'text-amber-600 dark:text-amber-400',
      activeRing: 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20',
      hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-800',
    },
    {
      key: 'wait_ship',
      zoneNumber: 3,
      title: 'Chờ giao',
      desc: 'Đã đóng gói xong, chờ shipper lấy',
      count: counts.waitShip,
      icon: Clock,
      color: 'text-purple-600 dark:text-purple-400',
      activeRing: 'ring-2 ring-purple-500 border-purple-500 bg-purple-50/40 dark:bg-purple-950/20',
      hoverBorder: 'hover:border-purple-300 dark:hover:border-purple-800',
    },
    {
      key: 'shipping',
      zoneNumber: 4,
      title: 'Đang giao',
      desc: 'Bưu tá đã nhận, đang phát hàng',
      count: counts.shipping,
      icon: Truck,
      color: 'text-cyan-600 dark:text-cyan-400',
      activeRing: 'ring-2 ring-cyan-500 border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20',
      hoverBorder: 'hover:border-cyan-300 dark:hover:border-cyan-800',
    },
    {
      key: 'completed',
      zoneNumber: 5,
      title: 'Hoàn thành',
      desc: 'Giao hàng thành công & hoàn tất',
      count: counts.completed,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      activeRing: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20',
      hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-800',
    },
  ];

  const activeGroup = groupsWithCounts.find((g) => g.key === activeKey) ?? groupsWithCounts[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Đơn hàng</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý luân chuyển đơn hàng theo 5 phân khu vận hành: Chờ in, Chờ gói hàng, Chờ giao, Đang giao và Hoàn thành.
        </p>
      </div>

      {/* 5 Operational Zone Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {zonePipelineCards.map((zone) => {
          const Icon = zone.icon;
          const isActive = activeKey === zone.key;
          return (
            <a
              key={zone.key}
              href={`/admin/orders?filter=${zone.key}`}
              className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                isActive
                  ? zone.activeRing
                  : `border-border bg-card text-card-foreground shadow-xs ${zone.hoverBorder} hover:shadow-sm`
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Khu {zone.zoneNumber}
                </span>
                <Icon className={`size-4.5 ${zone.color}`} />
              </div>
              <div className="mt-2">
                <div className="text-xl font-bold tracking-tight">{zone.count}</div>
                <div className="text-sm font-medium">{zone.title}</div>
                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{zone.desc}</div>
              </div>
            </a>
          );
        })}
      </div>

      {/* Filter Tabs */}
      <StatusFilterTabs basePath="/admin/orders" groups={groupsWithCounts} activeKey={activeKey} />

      {/* Main Order Table Card */}
      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              Danh sách đơn hàng — {activeGroup.label} ({orders.length})
            </CardTitle>
            <CardDescription>
              {activeKey === 'all'
                ? 'Toàn bộ đơn hàng trên hệ thống'
                : `Các đơn hàng hiện đang ở khu vực ${activeGroup.label}`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <Inbox className="size-6" />
              </div>
              <h3 className="mt-3 text-base font-medium">Không có đơn hàng nào</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeKey === 'all'
                  ? 'Chưa có đơn hàng nào được tạo trên hệ thống.'
                  : `Hiện không có đơn hàng nào thuộc phân khu "${activeGroup.label}".`}
              </p>
              {activeKey !== 'all' && (
                <a
                  href="/admin/orders"
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-4' })}
                >
                  Xem tất cả đơn hàng
                </a>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Mã đơn</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Phân khu / Trạng thái</TableHead>
                    <TableHead className="w-[100px]">Số lượng</TableHead>
                    <TableHead>Thanh toán</TableHead>
                    <TableHead className="text-right">Tổng tiền</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: OrderListRow) => {
                    const zoneMeta = ZONE_CONFIG[order.status] ?? {
                      zoneName: order.status,
                      label: order.status,
                      badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
                      icon: Package,
                    };
                    const ZoneIcon = zoneMeta.icon;
                    const paymentMeta = PAYMENT_CONFIG[order.paymentStatus] ?? {
                      label: order.paymentStatus,
                      badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
                    };

                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-mono text-sm font-semibold hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.customerName}</div>
                          {order.customerPhone ? (
                            <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 font-medium ${zoneMeta.badgeClass}`}>
                            <ZoneIcon className="size-3" />
                            <span>{zoneMeta.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.itemCount ? `${order.itemCount} món` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={paymentMeta.badgeClass}>
                            {paymentMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(order.total).toLocaleString('vi-VN')}đ
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className={buttonVariants({ size: 'sm', variant: 'outline' })}
                          >
                            Chi tiết
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <AdminPagination basePath="/admin/orders" page={page} hasNext={hasNext} filters={{ filter: activeKey }} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
