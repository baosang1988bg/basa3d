import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getPrintJobById, nextPrintJobStatuses } from '@/services/print-job.service';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listMaterials, listMaterialMovementsByReference } from '@/services/inventory.service';
import { updatePrintJobStatusAction } from '../../custom-requests/actions';
import { assignPrintJobMaterialAction, recordPrintJobActualsAction } from '../actions';

const PRINT_JOB_STATUSES = ['QUEUED', 'PRINTING', 'FAILED', 'REPRINT', 'QC', 'COMPLETED', 'CANCELLED'];

function formatVariance(estimated: number | null, actual: number | null) {
  if (estimated == null || actual == null) return null;
  const diff = actual - estimated;
  const percent = estimated === 0 ? null : Math.round((diff / estimated) * 1000) / 10;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff}g${percent !== null ? ` (${sign}${percent}%)` : ''}`;
}

export default async function PrintJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, printJob, materials, movements] = await Promise.all([
    requireAdmin(),
    getPrintJobById(id),
    listMaterials(),
    listMaterialMovementsByReference('print_job', id),
  ]);
  if (!printJob) notFound();
  const statusOptions = session.role === 'OWNER'
    ? PRINT_JOB_STATUSES.filter((status) => status !== printJob.status)
    : nextPrintJobStatuses(printJob.status);

  const variance = formatVariance(printJob.estimatedWeightGrams, printJob.actualWeightGrams);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Việc in {printJob.id}</h1>
        <Badge>{printJob.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Thông tin</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-muted-foreground">Đơn hàng</p><p>{printJob.orderId ?? '—'}</p></div>
          <div><p className="text-muted-foreground">Yêu cầu tùy chỉnh</p><p>{printJob.customRequestId ?? '—'}</p></div>
          <div><p className="text-muted-foreground">Máy in</p><p>{printJob.printerName ?? '—'}</p></div>
          <div><p className="text-muted-foreground">Ngày tạo</p><p>{new Date(printJob.createdAt).toLocaleString('vi-VN')}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trạng thái: <Badge>{printJob.status}</Badge></CardTitle></CardHeader>
        <CardContent>
          <form action={updatePrintJobStatusAction.bind(null, id)} className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Cập nhật trạng thái</Label>
              <select id="status" name="status" defaultValue="" required className="h-8 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="" disabled>— Chọn trạng thái —</option>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            {session.role === 'OWNER' ? <Input name="overrideReason" placeholder="Lý do nếu override" className="w-64" /> : null}
            <Button type="submit" size="sm" className="cursor-pointer" disabled={statusOptions.length === 0}>Lưu</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Chuyển sang PRINTING sẽ tự động trừ kho nguyên liệu theo khối lượng ước tính bên dưới — cần gán vật liệu trước.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vật liệu &amp; khối lượng ước tính</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Vật liệu đã gán</p><p>{materials.find((m) => m.id === printJob.materialId)?.name ?? '—'}</p></div>
            <div><p className="text-muted-foreground">Khối lượng ước tính</p><p>{printJob.estimatedWeightGrams != null ? `${printJob.estimatedWeightGrams}g` : '—'}</p></div>
          </div>
          <form action={assignPrintJobMaterialAction.bind(null, id)} className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="materialId">Vật liệu</Label>
              <select id="materialId" name="materialId" required defaultValue={printJob.materialId ?? ''} className="h-9 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="" disabled>Chọn vật liệu</option>
                {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="estimatedWeightGrams">Khối lượng ước tính (gram)</Label>
              <Input id="estimatedWeightGrams" name="estimatedWeightGrams" type="number" min={1} required defaultValue={printJob.estimatedWeightGrams ?? ''} />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="cursor-pointer">Gán vật liệu</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Khối lượng / thời gian thực tế</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {printJob.actualWeightGrams != null ? (
            <div className="text-sm">
              <p className="text-muted-foreground">Chênh lệch so với ước tính</p>
              <p className="font-medium">{variance ?? '—'}</p>
            </div>
          ) : null}
          <form action={recordPrintJobActualsAction.bind(null, id)} className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="actualWeightGrams">Khối lượng thực tế (gram)</Label>
              <Input id="actualWeightGrams" name="actualWeightGrams" type="number" min={0} defaultValue={printJob.actualWeightGrams ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="actualPrintTimeMinutes">Thời gian in thực tế (phút)</Label>
              <Input id="actualPrintTimeMinutes" name="actualPrintTimeMinutes" type="number" min={0} defaultValue={printJob.actualPrintTimeMinutes ?? ''} />
            </div>
            <div className="col-span-2">
              <Button type="submit" variant="outline" className="cursor-pointer">Lưu số liệu thực tế</Button>
            </div>
          </form>
          {printJob.actualWeightGrams != null && printJob.estimatedWeightGrams != null && printJob.actualWeightGrams !== printJob.estimatedWeightGrams ? (
            <p className="text-xs text-muted-foreground">
              Nếu chênh lệch quá lớn, điều chỉnh tồn kho nguyên liệu thủ công bằng ADJUSTMENT_OUT ở trang Tồn kho.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lịch sử tiêu hao nguyên liệu ({movements.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vật liệu</TableHead>
                <TableHead>Kho</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Số lượng</TableHead>
                <TableHead>Thời gian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{movement.materialName}</TableCell>
                  <TableCell>{movement.warehouseName}</TableCell>
                  <TableCell><Badge variant="secondary">{movement.movementType}</Badge></TableCell>
                  <TableCell>{movement.quantity}g</TableCell>
                  <TableCell>{new Date(movement.createdAt).toLocaleString('vi-VN')}</TableCell>
                </TableRow>
              ))}
              {!movements.length ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có tiêu hao nào</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
