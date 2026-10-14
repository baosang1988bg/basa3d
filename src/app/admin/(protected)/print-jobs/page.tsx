import { ActionForm } from '@/components/admin/action-form';
import { AdminPagination } from '@/components/admin/admin-pagination';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { resolveStatusFilter, StatusFilterTabs, type StatusFilterGroup } from '@/components/admin/status-filter-tabs';
import { listPrintJobs, nextPrintJobStatuses } from '@/services/print-job.service';
import { updatePrintJobStatusAction } from '../custom-requests/actions';
import { Printer, Inbox, Play, AlertTriangle, ArrowRight } from 'lucide-react';

const FILTER_GROUPS: StatusFilterGroup[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ', statuses: ['QUEUED'] },
  { key: 'in_progress', label: 'Đang xử lý', statuses: ['PRINTING', 'QC', 'REPRINT', 'FAILED'] },
  { key: 'completed', label: 'Hoàn tất', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Đã huỷ', statuses: ['CANCELLED'] },
];

const STATUS_ACTION_LABELS: Record<string, string> = {
  PRINTING: '▶ Bắt đầu in',
  QC: '✓ Chuyển kiểm tra QC',
  COMPLETED: '★ Hoàn tất in',
  REPRINT: '↻ Xếp hàng in lại',
  FAILED: '✕ Báo in hỏng',
  CANCELLED: '⊘ Huỷ việc in',
};

const PRINT_JOB_STATUS_MAP: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  QUEUED: {
    label: 'Đang chờ in',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
  },
  PRINTING: {
    label: 'Đang in trên máy',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    dotClass: 'bg-blue-500 animate-pulse',
  },
  QC: {
    label: 'Kiểm tra QC',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    dotClass: 'bg-purple-500',
  },
  REPRINT: {
    label: 'Chờ in lại',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
    dotClass: 'bg-orange-500',
  },
  FAILED: {
    label: 'In thất bại',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    dotClass: 'bg-rose-500',
  },
  COMPLETED: {
    label: 'Hoàn tất',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Đã huỷ',
    badgeClass: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800',
    dotClass: 'bg-zinc-400',
  },
};

export default async function PrintJobsPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string; sort?: string }> }) {
  const { filter, page: pageParam, sort: sortParam } = await searchParams;
  const { activeKey, statuses } = resolveStatusFilter(FILTER_GROUPS, filter);
  const orderBy = sortParam === 'desc' ? 'created_desc' : sortParam === 'asc' ? 'created_asc' : 'queue';
  const { items: printJobs, page, hasNext } = await listPrintJobs({ page: Number(pageParam), statuses, orderBy });

  // Locate the first job in queue that staff should print next
  const nextUpJob = printJobs.find((job) => job.status === 'QUEUED' || job.status === 'REPRINT');

  // Track position counter for queue items on this page
  let queueIndexCounter = 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Việc in</h1>
          <Badge variant="outline" className="text-xs font-normal">Hàng đợi sản xuất</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Sắp xếp theo thứ tự hàng đợi (Queue). Giúp nhân viên xưởng nắm bắt ngay đơn hàng tiếp theo cần in, thông số vật liệu và phân công máy.
        </p>
      </div>

      {/* Prominent Next-In-Queue Card for Staff */}
      {nextUpJob && (activeKey === 'all' || activeKey === 'pending') ? (
        <Card className="border-amber-400/70 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-sm dark:border-amber-700/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
                  ⭐ VIỆC IN TIẾP THEO TRONG HÀNG ĐỢI (#1)
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">Chuẩn bị phôi & máy để in ngay</span>
              </div>
              <Link
                href={`/admin/print-jobs/${nextUpJob.id}`}
                className={buttonVariants({ size: 'sm', variant: 'outline', className: 'h-8 text-xs gap-1' })}
              >
                Mở chi tiết việc in <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-lg border bg-card p-3 shadow-2xs">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Đơn hàng / Khách hàng</p>
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                {nextUpJob.orderId ? (
                  <Link href={`/admin/orders/${nextUpJob.orderId}`} className="hover:underline">
                    #{nextUpJob.orderNumber ?? nextUpJob.orderId.slice(0, 8)}
                  </Link>
                ) : nextUpJob.customRequestId ? (
                  <Link href={`/admin/custom-requests/${nextUpJob.customRequestId}`} className="hover:underline">
                    #{nextUpJob.requestNumber ?? nextUpJob.customRequestId.slice(0, 8)}
                  </Link>
                ) : (
                  <span>#{nextUpJob.id.slice(0, 8)}</span>
                )}
              </div>
              <p className="text-xs text-foreground/80 mt-1">
                {nextUpJob.orderCustomerName || nextUpJob.requestCustomerName || 'Khách hàng'}
                {(nextUpJob.orderCustomerPhone || nextUpJob.requestCustomerPhone) ? (
                  <span className="text-muted-foreground"> ({nextUpJob.orderCustomerPhone || nextUpJob.requestCustomerPhone})</span>
                ) : null}
              </p>
            </div>

            <div className="rounded-lg border bg-card p-3 shadow-2xs">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Sản phẩm / Mẫu in</p>
              <p className="font-medium text-foreground line-clamp-2" title={nextUpJob.orderItemsSummary || nextUpJob.requestDescription || ''}>
                {nextUpJob.orderItemsSummary || nextUpJob.requestDescription || 'Theo file kỹ thuật'}
              </p>
              {nextUpJob.requestQuantity ? (
                <p className="text-xs text-muted-foreground mt-1">Số lượng: <strong>{nextUpJob.requestQuantity}</strong> cái</p>
              ) : null}
            </div>

            <div className="rounded-lg border bg-card p-3 shadow-2xs">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Vật liệu & Khối lượng</p>
              {nextUpJob.materialName ? (
                <div>
                  <p className="font-semibold text-foreground">{nextUpJob.materialName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ước tính: {nextUpJob.estimatedWeightGrams != null ? <strong>{nextUpJob.estimatedWeightGrams}g</strong> : 'Chưa nhập'}
                    {nextUpJob.spoolCode ? ` • Cuộn: ${nextUpJob.spoolCode}` : ''}
                  </p>
                </div>
              ) : (
                <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Chưa gán vật liệu — Cần gán vật liệu trước khi in</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-card p-3 shadow-2xs flex flex-col justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Máy in phân công</p>
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <Printer className="size-3.5 text-muted-foreground" />
                  {nextUpJob.printerName || 'Chưa gán máy'}
                </p>
              </div>
              <div className="pt-2 border-t border-border/60">
                <ActionForm action={updatePrintJobStatusAction.bind(null, nextUpJob.id)}>
                  <input type="hidden" name="status" value="PRINTING" />
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-8 text-xs font-medium cursor-pointer"
                    disabled={!nextUpJob.materialName}
                  >
                    <Play className="size-3 mr-1 fill-current" /> Bắt đầu in đơn này
                  </Button>
                </ActionForm>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusFilterTabs basePath="/admin/print-jobs" groups={FILTER_GROUPS} activeKey={activeKey} />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sắp xếp:</span>
          <Link
            href={`/admin/print-jobs?${new URLSearchParams({ ...(activeKey !== 'all' ? { filter: activeKey } : {}), sort: 'queue' }).toString()}`}
            className={`rounded-md px-2.5 py-1 border transition-colors ${
              orderBy === 'queue' ? 'border-primary bg-primary text-primary-foreground font-medium' : 'border-border hover:bg-muted'
            }`}
          >
            Hàng đợi (Queue)
          </Link>
          <Link
            href={`/admin/print-jobs?${new URLSearchParams({ ...(activeKey !== 'all' ? { filter: activeKey } : {}), sort: 'desc' }).toString()}`}
            className={`rounded-md px-2.5 py-1 border transition-colors ${
              orderBy === 'created_desc' ? 'border-primary bg-primary text-primary-foreground font-medium' : 'border-border hover:bg-muted'
            }`}
          >
            Mới nhất
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Danh sách việc in ({printJobs.length})</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500 animate-pulse"></span> Đang in</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500"></span> Đang chờ</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500"></span> Hoàn tất</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Hàng đợi &amp; Mã việc</TableHead>
                  <TableHead className="min-w-[200px]">Đơn hàng / Khách hàng</TableHead>
                  <TableHead className="min-w-[240px]">Sản phẩm cần in</TableHead>
                  <TableHead className="min-w-[190px]">Vật liệu &amp; Máy in</TableHead>
                  <TableHead className="w-[150px]">Trạng thái</TableHead>
                  <TableHead className="text-right min-w-[220px]">Cập nhật trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Inbox className="size-8 stroke-1" />
                        <p className="text-sm font-medium text-foreground">Không có việc in nào</p>
                        <p className="text-xs">Chưa có đơn hàng nào trong danh sách hoặc bộ lọc đã chọn.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  printJobs.map((job) => {
                    const statusInfo = PRINT_JOB_STATUS_MAP[job.status] ?? {
                      label: job.status,
                      badgeClass: 'bg-muted text-muted-foreground border-border',
                      dotClass: 'bg-muted-foreground',
                    };

                    const isQueued = job.status === 'QUEUED' || job.status === 'REPRINT';
                    const isPrinting = job.status === 'PRINTING';
                    const queueIndex = isQueued ? ++queueIndexCounter : null;
                    const isNextUpInQueue = isQueued && queueIndex === 1;

                    return (
                      <TableRow key={job.id} className="hover:bg-muted/40 transition-colors">
                        {/* Queue Position and Job ID */}
                        <TableCell className="align-top py-3.5">
                          <div className="flex flex-col gap-1.5">
                            <div>
                              {isPrinting ? (
                                <Badge className="bg-blue-600 text-white font-medium hover:bg-blue-600 gap-1 text-[11px] py-0.5">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-200 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                  </span>
                                  Đang in
                                </Badge>
                              ) : isNextUpInQueue ? (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] py-0.5 shadow-2xs">
                                  ⭐ #1 Tiếp theo
                                </Badge>
                              ) : isQueued ? (
                                <Badge variant="outline" className="font-semibold text-muted-foreground text-[11px] py-0.5 border-dashed">
                                  Hàng đợi #{queueIndex}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[11px] py-0.5">
                                  {statusInfo.label}
                                </Badge>
                              )}
                            </div>
                            <Link
                              href={`/admin/print-jobs/${job.id}`}
                              className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline block break-all"
                              title="Bấm để xem chi tiết việc in"
                            >
                              {job.id}
                            </Link>
                          </div>
                        </TableCell>

                        {/* Order / Custom Request Information */}
                        <TableCell className="align-top py-3.5">
                          <div className="flex flex-col gap-1">
                            {job.orderId ? (
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase font-bold tracking-wider text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40">
                                  Đơn hàng
                                </Badge>
                                <Link
                                  href={`/admin/orders/${job.orderId}`}
                                  className="font-semibold text-primary hover:underline text-sm"
                                  title="Mở chi tiết đơn hàng"
                                >
                                  #{job.orderNumber ?? job.orderId.slice(0, 8)}
                                </Link>
                              </div>
                            ) : job.customRequestId ? (
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase font-bold tracking-wider text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/40">
                                  Yêu cầu in
                                </Badge>
                                <Link
                                  href={`/admin/custom-requests/${job.customRequestId}`}
                                  className="font-semibold text-primary hover:underline text-sm"
                                  title="Mở chi tiết yêu cầu tùy chỉnh"
                                >
                                  #{job.requestNumber ?? job.customRequestId.slice(0, 8)}
                                </Link>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}

                            <div className="text-xs text-foreground/80 mt-0.5">
                              {job.orderCustomerName || job.requestCustomerName ? (
                                <span className="font-medium">{job.orderCustomerName || job.requestCustomerName}</span>
                              ) : (
                                <span className="text-muted-foreground">Khách vãng lai</span>
                              )}
                              {(job.orderCustomerPhone || job.requestCustomerPhone) ? (
                                <span className="text-muted-foreground"> • {job.orderCustomerPhone || job.requestCustomerPhone}</span>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>

                        {/* Product / Print Details */}
                        <TableCell className="align-top py-3.5">
                          <div className="flex flex-col gap-1">
                            {job.orderId ? (
                              <div className="text-sm font-medium text-foreground">
                                {job.orderItemsSummary || 'Sản phẩm theo đơn hàng'}
                              </div>
                            ) : job.customRequestId ? (
                              <div>
                                <p className="text-sm font-medium text-foreground line-clamp-2" title={job.requestDescription ?? ''}>
                                  {job.requestDescription || 'Theo file 3D yêu cầu'}
                                </p>
                                {job.requestQuantity ? (
                                  <span className="text-xs text-muted-foreground">Số lượng: <strong>{job.requestQuantity}</strong></span>
                                ) : null}
                                {job.requestMaterial || job.requestColor ? (
                                  <span className="text-xs text-muted-foreground ml-1.5">
                                    ({[job.requestMaterial, job.requestColor].filter(Boolean).join(' - ')})
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Material & Printer */}
                        <TableCell className="align-top py-3.5">
                          <div className="flex flex-col gap-1">
                            {job.materialName ? (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-semibold text-foreground">{job.materialName}</span>
                                {job.estimatedWeightGrams != null ? (
                                  <span className="text-muted-foreground">({job.estimatedWeightGrams}g)</span>
                                ) : null}
                              </div>
                            ) : (
                              <div className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="size-3.5 shrink-0" /> Chưa gán vật liệu
                              </div>
                            )}

                            {job.spoolCode ? (
                              <div className="text-[11px] font-mono text-muted-foreground">
                                Cuộn: {job.spoolCode}
                              </div>
                            ) : null}

                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Printer className="size-3 shrink-0" />
                              <span>{job.printerName ?? 'Chưa gán máy'}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Status & Timestamp */}
                        <TableCell className="align-top py-3.5">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border w-fit ${statusInfo.badgeClass}`}>
                              <span className={`size-1.5 rounded-full ${statusInfo.dotClass}`}></span>
                              {statusInfo.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(job.createdAt).toLocaleString('vi-VN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        </TableCell>

                        {/* Status Actions */}
                        <TableCell className="text-right align-top py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <ActionForm action={updatePrintJobStatusAction.bind(null, job.id)} className="flex items-center gap-1.5">
                              <select
                                name="status"
                                defaultValue=""
                                required
                                aria-label="Cập nhật trạng thái việc in"
                                className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              >
                                <option value="" disabled>— Đổi trạng thái —</option>
                                {nextPrintJobStatuses(job.status).map((status) => (
                                  <option key={status} value={status}>
                                    {STATUS_ACTION_LABELS[status] ?? status}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="submit"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs px-2.5 cursor-pointer"
                                disabled={nextPrintJobStatuses(job.status).length === 0}
                              >
                                Lưu
                              </Button>
                            </ActionForm>
                            <Link
                              href={`/admin/print-jobs/${job.id}`}
                              className={buttonVariants({ size: 'sm', variant: 'secondary', className: 'h-8 text-xs px-2.5' })}
                              title="Xem chi tiết việc in"
                            >
                              Chi tiết
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <AdminPagination basePath="/admin/print-jobs" page={page} hasNext={hasNext} filters={{ filter: activeKey, ...(sortParam ? { sort: sortParam } : {}) }} />
        </CardContent>
      </Card>
    </div>
  );
}
