import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { canTransitionOrderStatus, getOrderById } from '@/services/order.service';
import { updateOrderAdminFieldsAction, updateOrderStatusAction } from '../actions';

const ORDER_STATUSES = ['NEW', 'CONFIRMED', 'PRODUCING', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
const PAYMENT_STATUSES = ['UNPAID', 'DEPOSIT_PAID', 'PAID', 'REFUNDED'];
const SHIPPING_STATUSES = ['PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED'];

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const nextStatusCandidates = ORDER_STATUSES.filter((candidate) => canTransitionOrderStatus(order.status, candidate));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Đơn hàng {order.orderNumber}</h1>
        <div className="flex gap-2">
          <Badge>{order.status}</Badge>
          <Badge variant="secondary">{order.paymentStatus}</Badge>
          <Badge variant="secondary">{order.shippingStatus}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Thông tin khách hàng</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tên khách hàng</Label>
            <p className="text-sm">{order.customerName}</p>
          </div>
          <div>
            <Label>Số điện thoại</Label>
            <p className="text-sm">{order.customerPhone}</p>
          </div>
          <div>
            <Label>Email</Label>
            <p className="text-sm">{order.customerEmail ?? '—'}</p>
          </div>
          <div>
            <Label>Ngày tạo</Label>
            <p className="text-sm">{new Date(order.createdAt).toLocaleString('vi-VN')}</p>
          </div>
          <div className="col-span-2">
            <Label>Địa chỉ giao hàng</Label>
            <p className="text-sm break-all">{JSON.stringify(order.shippingAddress)}</p>
          </div>
          <div className="col-span-2">
            <Label>Ghi chú của khách</Label>
            <p className="text-sm">{order.customerNote ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sản phẩm ({order.items.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Biến thể</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>SL</TableHead>
                <TableHead>Đơn giá</TableHead>
                <TableHead>Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.productNameSnapshot}</TableCell>
                  <TableCell>{item.variantNameSnapshot}</TableCell>
                  <TableCell>{item.skuSnapshot}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{Number(item.unitPrice).toLocaleString('vi-VN') + 'đ'}</TableCell>
                  <TableCell>{Number(item.lineTotal).toLocaleString('vi-VN') + 'đ'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trạng thái đơn</CardTitle></CardHeader>
        <CardContent>
          <form action={updateOrderStatusAction.bind(null, id)} className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Chuyển sang trạng thái</Label>
              <select id="status" name="status" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" defaultValue="">
                <option value="" disabled>— Chọn trạng thái —</option>
                {nextStatusCandidates.map((candidate) => (
                  <option key={candidate} value={candidate}>{candidate}</option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" disabled={nextStatusCandidates.length === 0}>Cập nhật</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Thanh toán, vận chuyển & ghi chú nội bộ</CardTitle></CardHeader>
        <CardContent>
          <form action={updateOrderAdminFieldsAction.bind(null, id)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="paymentStatus">Trạng thái thanh toán</Label>
                <select id="paymentStatus" name="paymentStatus" defaultValue={order.paymentStatus} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shippingStatus">Trạng thái vận chuyển</Label>
                <select id="shippingStatus" name="shippingStatus" defaultValue={order.shippingStatus} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {SHIPPING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminNote">Ghi chú nội bộ</Label>
              <Textarea id="adminNote" name="adminNote" defaultValue={order.adminNote ?? ''} />
            </div>
            <div>
              <Button type="submit" size="sm">Lưu thay đổi</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
