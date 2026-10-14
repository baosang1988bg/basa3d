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

const FILTER_GROUPS: StatusFilterGroup[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ', statuses: ['NEW', 'REVIEWING', 'NEED_INFO'] },
  { key: 'in_progress', label: 'Đang xử lý', statuses: ['QUOTED', 'APPROVED'] },
  { key: 'completed', label: 'Hoàn tất', statuses: ['CONVERTED'] },
  { key: 'cancelled', label: 'Đã từ chối', statuses: ['REJECTED'] },
];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NEW: {
    label: 'Mới tiếp nhận',
    className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  },
  REVIEWING: {
    label: 'Đang xem xét',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  },
  NEED_INFO: {
    label: 'Cần bổ sung tin',
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  },
  QUOTED: {
    label: 'Đã báo giá',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
  },
  APPROVED: {
    label: 'Khách chốt in',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  },
  CONVERTED: {
    label: 'Đã lên đơn hàng',
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  },
  REJECTED: {
    label: 'Đã từ chối',
    className: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800',
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
          <h1 className="text-2xl font-semibold tracking-tight">Yêu cầu in theo yêu cầu</h1>
          <p className="text-sm text-muted-foreground">
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base font-medium">
            Danh sách yêu cầu ({customRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Mã yêu cầu</TableHead>
                <TableHead className="w-[170px]">Khách hàng</TableHead>
                <TableHead>Nội dung yêu cầu</TableHead>
                <TableHead className="w-[140px]">Kênh tiếp nhận</TableHead>
                <TableHead className="w-[140px]">Trạng thái</TableHead>
                <TableHead className="text-right w-[160px]">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
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
                    className: 'bg-muted text-muted-foreground',
                  };

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="align-top">
                        <Link
                          href={`/admin/custom-requests/${item.id}`}
                          className="font-semibold text-primary hover:underline block"
                          title="Bấm để mở trang chi tiết và phân tích file 3D"
                        >
                          {item.requestNumber}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {item.ipRiskFlag ? (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1 font-normal">
                              ⚠️ Rủi ro SHTT
                            </Badge>
                          ) : null}
                          {item.itemCount > 0 ? (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal bg-background">
                              Đa món ({item.itemCount} file)
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {new Date(item.createdAt).toLocaleString('vi-VN')}
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="font-medium text-foreground">{item.customerName}</div>
                        <a
                          href={`tel:${item.customerPhone}`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-mono mt-0.5"
                          title="Bấm để gọi điện cho khách"
                        >
                          <Phone className="size-3" />
                          <span>{item.customerPhone}</span>
                        </a>
                        {item.customerEmail ? (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[150px] mt-0.5" title={item.customerEmail}>
                            {item.customerEmail}
                          </div>
                        ) : null}
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
                            SL: {item.quantity}
                          </span>
                          {(item.requestedMaterial || item.requestedColor || item.requestedSize) && (
                            <span className="text-xs text-muted-foreground font-medium">
                              {[item.requestedMaterial, item.requestedColor, item.requestedSize].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground mt-1" title={item.description}>
                          <AutoLinkText text={item.description} />
                        </p>
                      </TableCell>

                      <TableCell className="align-top">
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {CHANNEL_LABELS[item.sourceChannel] ?? item.sourceChannel}
                        </Badge>
                      </TableCell>

                      <TableCell className="align-top">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </TableCell>

                      <TableCell className="text-right align-top">
                        <CustomRequestRowActions item={item} isOwner={isOwner} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <AdminPagination
            basePath="/admin/custom-requests"
            page={page}
            hasNext={hasNext}
            filters={{ filter: activeKey }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
