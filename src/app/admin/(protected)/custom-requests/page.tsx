import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { resolveStatusFilter, StatusFilterTabs, type StatusFilterGroup } from '@/components/admin/status-filter-tabs';
import { listCustomRequests } from '@/services/custom-request.service';
import { createCustomRequestAction } from './actions';

const FILTER_GROUPS: StatusFilterGroup[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ', statuses: ['NEW', 'REVIEWING', 'NEED_INFO'] },
  { key: 'in_progress', label: 'Đang xử lý', statuses: ['QUOTED', 'APPROVED'] },
  { key: 'completed', label: 'Hoàn tất', statuses: ['CONVERTED'] },
  { key: 'cancelled', label: 'Đã từ chối', statuses: ['REJECTED'] },
];

export default async function CustomRequestsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const { activeKey, statuses } = resolveStatusFilter(FILTER_GROUPS, filter);
  const { items: customRequests } = await listCustomRequests({ limit: 100, statuses });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Yêu cầu in theo yêu cầu</h1>

      <StatusFilterTabs basePath="/admin/custom-requests" groups={FILTER_GROUPS} activeKey={activeKey} />

      <Card>
        <CardHeader><CardTitle>Ghi nhận yêu cầu mới</CardTitle></CardHeader>
        <CardContent>
          <form action={createCustomRequestAction} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sourceChannel">Kênh</Label>
              <select id="sourceChannel" name="sourceChannel" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
                <option value="ZALO">ZALO</option>
                <option value="FACEBOOK">FACEBOOK</option>
                <option value="INSTAGRAM">INSTAGRAM</option>
                <option value="TIKTOK">TIKTOK</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Số lượng</Label>
              <Input id="quantity" name="quantity" type="number" min={1} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customerName">Tên khách hàng</Label>
              <Input id="customerName" name="customerName" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customerPhone">Số điện thoại</Label>
              <Input id="customerPhone" name="customerPhone" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customerEmail">Email</Label>
              <Input id="customerEmail" name="customerEmail" type="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requestedMaterial">Chất liệu yêu cầu</Label>
              <Input id="requestedMaterial" name="requestedMaterial" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requestedColor">Màu sắc yêu cầu</Label>
              <Input id="requestedColor" name="requestedColor" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requestedSize">Kích thước yêu cầu</Label>
              <Input id="requestedSize" name="requestedSize" />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="description">Mô tả yêu cầu</Label>
              <Textarea id="description" name="description" required />
            </div>
            <div className="col-span-2">
              <Button type="submit">Ghi nhận yêu cầu</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danh sách yêu cầu ({customRequests.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã yêu cầu</TableHead>
                <TableHead>Kênh</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customRequests.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.requestNumber}</TableCell>
                  <TableCell><Badge variant="secondary">{item.sourceChannel}</Badge></TableCell>
                  <TableCell><Badge>{item.status}</Badge></TableCell>
                  <TableCell>{new Date(item.createdAt).toLocaleString('vi-VN')}</TableCell>
                  <TableCell className="flex justify-end">
                    <Link href={`/admin/custom-requests/${item.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>Chi tiết</Link>
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
