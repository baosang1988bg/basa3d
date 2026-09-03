import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { resolveStatusFilter, StatusFilterTabs, type StatusFilterGroup } from '@/components/admin/status-filter-tabs';
import { listPrintJobs, nextPrintJobStatuses } from '@/services/print-job.service';
import { updatePrintJobStatusAction } from '../custom-requests/actions';

const FILTER_GROUPS: StatusFilterGroup[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ', statuses: ['QUEUED'] },
  { key: 'in_progress', label: 'Đang xử lý', statuses: ['PRINTING', 'QC', 'REPRINT', 'FAILED'] },
  { key: 'completed', label: 'Hoàn tất', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Đã huỷ', statuses: ['CANCELLED'] },
];

export default async function PrintJobsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const { activeKey, statuses } = resolveStatusFilter(FILTER_GROUPS, filter);
  const { items: printJobs } = await listPrintJobs({ limit: 100, statuses });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Việc in</h1>

      <StatusFilterTabs basePath="/admin/print-jobs" groups={FILTER_GROUPS} activeKey={activeKey} />

      <Card>
        <CardHeader><CardTitle>Danh sách việc in ({printJobs.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Liên kết</TableHead>
                <TableHead>Máy in</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Cập nhật trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/admin/print-jobs/${job.id}`} className="hover:underline">{job.id}</Link>
                  </TableCell>
                  <TableCell>
                    {job.customRequestId ? `Custom request: ${job.customRequestId}` : null}
                    {job.orderId ? `Đơn hàng: ${job.orderId}` : null}
                    {!job.customRequestId && !job.orderId ? '—' : null}
                  </TableCell>
                  <TableCell>{job.printerName ?? '—'}</TableCell>
                  <TableCell><Badge>{job.status}</Badge></TableCell>
                  <TableCell>{new Date(job.createdAt).toLocaleString('vi-VN')}</TableCell>
                  <TableCell className="text-right">
                    <form action={updatePrintJobStatusAction.bind(null, job.id)} className="flex justify-end gap-2">
                      <select name="status" defaultValue="" required className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                        <option value="" disabled>— Chọn —</option>
                        {nextPrintJobStatuses(job.status).map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <Button type="submit" size="sm" variant="outline" disabled={nextPrintJobStatuses(job.status).length === 0}>Lưu</Button>
                    </form>
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
