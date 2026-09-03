import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getFilamentSpoolById, listSpoolUsageHistory } from '@/services/filament.service';
import { adjustSpoolStockAction } from '../actions';

function formatVnd(value: number | null) {
  if (value === null) return '—';
  return `${value.toLocaleString('vi-VN')}đ`;
}

export default async function FilamentSpoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  const spool = await getFilamentSpoolById(id, session.role);
  if (!spool) notFound();
  const history = await listSpoolUsageHistory(id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cuộn nhựa {spool.spoolCode}</h1>
        <Badge variant={spool.status === 'ACTIVE' ? 'secondary' : 'outline'}>{spool.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Thông tin</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <div><p className="text-muted-foreground">Loại nhựa</p><p>{spool.materialType}</p></div>
          <div><p className="text-muted-foreground">Màu</p><p>{spool.color ?? '—'}</p></div>
          <div><p className="text-muted-foreground">Lõi</p><p>{spool.hasSpool ? 'Có lõi' : 'Không lõi'}</p></div>
          <div><p className="text-muted-foreground">Khối lượng ban đầu</p><p>{spool.initialWeightGrams}g</p></div>
          <div><p className="text-muted-foreground">Đã dùng</p><p>{spool.usedWeightGrams}g</p></div>
          <div><p className="text-muted-foreground">Còn lại</p><p>{spool.remainingWeightGrams}g ({Math.round(spool.remainingPct)}%)</p></div>
          {session.role === 'OWNER' ? <div><p className="text-muted-foreground">Giá mua</p><p>{formatVnd(spool.purchaseCost)}</p></div> : null}
          <div><p className="text-muted-foreground">Ghi chú</p><p>{spool.note ?? '—'}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Điều chỉnh tồn kho (kiểm kê)</CardTitle></CardHeader>
        <CardContent>
          <form action={adjustSpoolStockAction.bind(null, id)} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newRemainingGrams">Khối lượng còn lại thực tế (g)</Label>
              <Input key={spool.remainingWeightGrams} id="newRemainingGrams" name="newRemainingGrams" type="number" min={0} max={spool.initialWeightGrams} required defaultValue={spool.remainingWeightGrams} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Lý do điều chỉnh</Label>
              <Textarea id="reason" name="reason" required placeholder="Ví dụ: cân lại sau khi in, phát hiện chênh lệch..." />
            </div>
            <div className="col-span-2">
              <Button type="submit" variant="outline" className="cursor-pointer">Lưu điều chỉnh</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lịch sử tiêu hao ({history.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại</TableHead>
                <TableHead>Số lượng</TableHead>
                <TableHead>Tham chiếu</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead>Thời gian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell><Badge variant="secondary">{movement.movementType}</Badge></TableCell>
                  <TableCell>{movement.quantity}g</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{movement.referenceType ? `${movement.referenceType}:${movement.referenceId}` : '—'}</TableCell>
                  <TableCell>{movement.note ?? '—'}</TableCell>
                  <TableCell>{new Date(movement.createdAt).toLocaleString('vi-VN')}</TableCell>
                </TableRow>
              ))}
              {!history.length ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có tiêu hao nào</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
