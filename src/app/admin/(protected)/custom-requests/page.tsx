import Link from 'next/link';
import { Phone, Inbox } from 'lucide-react';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { resolveStatusFilter, StatusFilterTabs, type StatusFilterGroup } from '@/components/admin/status-filter-tabs';
import { listCustomRequests } from '@/services/custom-request.service';
import { requireAdmin } from '@/lib/auth/require-admin';
import { CustomRequestRowActions } from '@/components/admin/custom-request-row-actions';
import { CustomRequestHeaderActions } from '@/components/admin/custom-request-header-actions';
import { CreateCustomRequestDialog } from '@/components/admin/create-custom-request-dialog';
import { AutoLinkText } from '@/components/ui/auto-link-text';
import { cn } from '@/lib/utils';

const FILTER_GROUPS: StatusFilterGroup[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ', statuses: ['NEW', 'REVIEWING', 'NEED_INFO'] },
  { key: 'in_progress', label: 'Đang xử lý', statuses: ['QUOTED', 'APPROVED'] },
  { key: 'completed', label: 'Hoàn tất', statuses: ['CONVERTED'] },
  { key: 'cancelled', label: 'Đã từ chối', statuses: ['REJECTED'] },
];

const STATUS_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  NEW: {
    label: 'Mới tiếp nhận',
    className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    dotColor: 'bg-sky-500',
  },
  REVIEWING: {
    label: 'Đang xem xét',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    dotColor: 'bg-amber-500',
  },
  NEED_INFO: {
    label: 'Cần bổ sung tin',
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    dotColor: 'bg-purple-500',
  },
  QUOTED: {
    label: 'Đã báo giá',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    dotColor: 'bg-cyan-500',
  },
  APPROVED: {
    label: 'Khách chốt in',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
  },
  CONVERTED: {
    label: 'Đã lên đơn',
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800',
    dotColor: 'bg-green-500',
  },
  REJECTED: {
    label: 'Đã từ chối',
    className: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800',
    dotColor: 'bg-zinc-400',
  },
};

const CHANNEL_LABELS: Record<string, string> = {
  ZALO: 'Zalo',
  FACEBOOK: 'Facebook',
  WEBSITE: 'Website',
  TIKTOK: 'TikTok',
  INSTAGRAM: 'Instagram',
  OTHER: 'Khác',
};

export default async function CustomRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const session = await requireAdmin();
  const isOwner = session.role === 'OWNER';
  const { filter, page: pageParam } = await searchParams;
  const { activeKey, statuses } = resolveStatusFilter(FILTER_GROUPS, filter);
  const { items: customRequests, page, hasNext } = await listCustomRequests({
    page: Number(pageParam),
    statuses,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Yêu cầu in theo yêu cầu</h1>
            <Badge variant="outline" className="text-xs font-normal">Tùy biến &amp; Báo giá</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tiếp nhận file 3D, phân tích kỹ thuật, báo giá và theo dõi tiến độ xử lý
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateCustomRequestDialog />
          <CustomRequestHeaderActions isOwner={isOwner} />
        </div>
      </div>

      {/* Status Filter Tabs */}
      <StatusFilterTabs basePath="/admin/custom-requests" groups={FILTER_GROUPS} activeKey={activeKey} />

      {/* Prioritized List of Requests */}
      <Card className="border border-border shadow-xs overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-3.5 px-6 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <CardTitle className="text-base font-semibold">
              Danh sách yêu cầu
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-medium">
              {customRequests.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[170px] pl-6 font-semibold text-xs text-muted-foreground">Mã &amp; Thời gian</TableHead>
                  <TableHead className="w-[200px] font-semibold text-xs text-muted-foreground">Khách hàng &amp; Kênh</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground">Nội dung yêu cầu</TableHead>
                  <TableHead className="w-[145px] font-semibold text-xs text-muted-foreground">Trạng thái</TableHead>
                  <TableHead className="text-right w-[170px] pr-6 font-semibold text-xs text-muted-foreground">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Inbox className="size-8 stroke-1" />
                        <p className="text-sm font-medium text-foreground">Không có yêu cầu nào</p>
                        <p className="text-xs">Chưa có yêu cầu in phù hợp với bộ lọc hiện tại.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  customRequests.map((item) => {
                    const statusInfo = STATUS_CONFIG[item.status] ?? {
                      label: item.status,
                      className: 'bg-muted text-muted-foreground border-border',
                      dotColor: 'bg-muted-foreground',
                    };

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30 transition-colors border-b border-border/60">
                        {/* 1. Mã & Thời gian */}
                        <TableCell className="align-top pl-6 py-4 whitespace-normal">
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <Link
                              href={`/admin/custom-requests/${item.id}`}
                              className="font-mono font-semibold text-sm text-primary hover:underline truncate block"
                              title="Bấm để mở trang chi tiết và phân tích file 3D"
                            >
                              {item.requestNumber}
                            </Link>
                            {(item.ipRiskFlag || item.itemCount > 0) && (
                              <div className="flex flex-wrap items-center gap-1">
                                {item.ipRiskFlag ? (
                                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-normal h-4.5">
                                    ⚠️ SHTT
                                  </Badge>
                                ) : null}
                                {item.itemCount > 0 ? (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal h-4.5 bg-background text-muted-foreground">
                                    {item.itemCount} file
                                  </Badge>
                                ) : null}
                              </div>
                            )}
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                              <span>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="text-muted-foreground/80">
                                {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. Khách hàng & Kênh */}
                        <TableCell className="align-top py-4 whitespace-normal">
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground text-sm truncate" title={item.customerName}>
                                {item.customerName}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 font-normal h-4.5 shrink-0 bg-muted/40 border-border text-muted-foreground"
                              >
                                {CHANNEL_LABELS[item.sourceChannel] ?? item.sourceChannel}
                              </Badge>
                            </div>
                            <a
                              href={`tel:${item.customerPhone}`}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-mono w-fit"
                              title="Bấm để gọi điện cho khách"
                            >
                              <Phone className="size-3 shrink-0 text-muted-foreground/70" />
                              <span>{item.customerPhone}</span>
                            </a>
                            {item.customerEmail ? (
                              <div className="text-[11px] text-muted-foreground/80 truncate" title={item.customerEmail}>
                                {item.customerEmail}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* 3. Nội dung yêu cầu */}
                        <TableCell className="align-top py-4 whitespace-normal">
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground shrink-0 border border-border/40">
                                SL: {item.quantity}
                              </span>
                              {(item.requestedMaterial || item.requestedColor || item.requestedSize) && (
                                <span className="text-xs text-foreground/85 font-medium">
                                  {[item.requestedMaterial, item.requestedColor, item.requestedSize].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </div>
                            {item.description ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed break-words" title={item.description}>
                                <AutoLinkText text={item.description} />
                              </p>
                            ) : (
                              <span className="text-xs text-muted-foreground/40 italic">Chưa có ghi chú mô tả</span>
                            )}
                          </div>
                        </TableCell>

                        {/* 4. Trạng thái */}
                        <TableCell className="align-top py-4 whitespace-normal">
                          <div className="flex items-center">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
                                statusInfo.className
                              )}
                            >
                              <span className={cn('size-1.5 rounded-full shrink-0', statusInfo.dotColor)} />
                              {statusInfo.label}
                            </span>
                          </div>
                        </TableCell>

                        {/* 5. Thao tác */}
                        <TableCell className="text-right align-top pr-6 py-4 whitespace-normal">
                          <CustomRequestRowActions item={item} isOwner={isOwner} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 py-3 border-t border-border">
            <AdminPagination
              basePath="/admin/custom-requests"
              page={page}
              hasNext={hasNext}
              filters={{ filter: activeKey }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
