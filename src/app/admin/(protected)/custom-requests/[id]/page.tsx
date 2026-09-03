import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PricingCalculatorPanel } from '@/components/admin/pricing-calculator-panel';
import { MakerWorldQuotePanel } from '@/components/admin/makerworld-quote-panel';
import { CopyZaloQuoteButton } from '@/components/admin/copy-zalo-quote-button';
import { ProcessStepper } from '@/components/admin/process-stepper';
import { createCustomRequestAttachmentSignedUrl, getCustomRequestById, nextCustomRequestStatuses } from '@/services/custom-request.service';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listMaterials } from '@/services/inventory.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { listQuotesByCustomRequest, mintQuoteAccessToken } from '@/services/quote.service';
import { acceptQuoteAction, createQuoteAction, updateCustomRequestStatusAction } from '../actions';

const CUSTOM_REQUEST_STATUSES = ['NEW', 'REVIEWING', 'NEED_INFO', 'QUOTED', 'APPROVED', 'REJECTED', 'CONVERTED'];
const CUSTOM_REQUEST_STEPS = [
  { status: 'NEW', label: 'Mới' },
  { status: 'REVIEWING', label: 'Đang xem xét' },
  { status: 'QUOTED', label: 'Đã báo giá' },
  { status: 'APPROVED', label: 'Đã duyệt' },
  { status: 'CONVERTED', label: 'Đã chốt đơn' },
];
const CUSTOM_REQUEST_TERMINAL_STATUSES = [{ status: 'REJECTED', label: 'Yêu cầu đã bị từ chối' }];
// NEED_INFO loops back to REVIEWING (chờ khách bổ sung thông tin) rather than moving forward —
// normalize it onto the REVIEWING step so the stepper doesn't render it as regressing.
function stepperStatus(status: string) {
  return status === 'NEED_INFO' ? 'REVIEWING' : status;
}

export default async function CustomRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  const [customRequest, quotes, materials, pricingConfig] = await Promise.all([
    getCustomRequestById(id), listQuotesByCustomRequest(id), listMaterials(), getCurrentPricingConfig(),
  ]);
  if (!customRequest) notFound();
  const attachmentSignedUrl = customRequest.attachmentPath
    ? await createCustomRequestAttachmentSignedUrl(customRequest.attachmentPath)
    : null;
  const statusOptions = session.role === 'OWNER'
    ? CUSTOM_REQUEST_STATUSES.filter((status) => status !== customRequest.status)
    : nextCustomRequestStatuses(customRequest.status);

  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{customRequest.requestNumber}</h1>
        <Badge variant="secondary">{customRequest.sourceChannel}</Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ProcessStepper
            steps={CUSTOM_REQUEST_STEPS}
            currentStatus={stepperStatus(customRequest.status)}
            terminalStatuses={CUSTOM_REQUEST_TERMINAL_STATUSES}
          />
          {customRequest.status === 'NEED_INFO' ? (
            <p className="mt-2 text-xs text-muted-foreground">Đang chờ khách bổ sung thông tin trước khi tiếp tục xem xét.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Thông tin yêu cầu</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-muted-foreground">Khách hàng</p><p>{customRequest.customerName}</p></div>
          <div><p className="text-muted-foreground">Số điện thoại</p><p>{customRequest.customerPhone}</p></div>
          <div><p className="text-muted-foreground">Email</p><p>{customRequest.customerEmail ?? '—'}</p></div>
          <div><p className="text-muted-foreground">Số lượng</p><p>{customRequest.quantity}</p></div>
          <div><p className="text-muted-foreground">Chất liệu yêu cầu</p><p>{customRequest.requestedMaterial ?? '—'}</p></div>
          <div><p className="text-muted-foreground">Màu sắc yêu cầu</p><p>{customRequest.requestedColor ?? '—'}</p></div>
          <div><p className="text-muted-foreground">Kích thước yêu cầu</p><p>{customRequest.requestedSize ?? '—'}</p></div>
          <div><p className="text-muted-foreground">Ngày tạo</p><p>{new Date(customRequest.createdAt).toLocaleString('vi-VN')}</p></div>
          <div className="col-span-2">
            <p className="text-muted-foreground">File đính kèm / Ảnh mẫu</p>
            {attachmentSignedUrl ? (
              <a href={attachmentSignedUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline break-all">
                📎 Mở file đính kèm (liên kết hết hạn sau 15 phút)
              </a>
            ) : (
              <p className="text-muted-foreground">Chưa có file đính kèm</p>
            )}
          </div>
          <div className="col-span-2"><p className="text-muted-foreground">Mô tả</p><p className="whitespace-pre-wrap">{customRequest.description}</p></div>
          {customRequest.internalNote ? (
            <div className="col-span-2"><p className="text-muted-foreground">Ghi chú nội bộ</p><p className="whitespace-pre-wrap">{customRequest.internalNote}</p></div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trạng thái: <Badge>{customRequest.status}</Badge></CardTitle></CardHeader>
        <CardContent>
          <form action={updateCustomRequestStatusAction.bind(null, id)} className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Cập nhật trạng thái</Label>
              <select id="status" name="status" defaultValue="" required className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="" disabled>— Chọn trạng thái —</option>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            {session.role === 'OWNER' ? <Input name="overrideReason" placeholder="Lý do nếu override" className="w-64" /> : null}
            <Button type="submit" size="sm" disabled={statusOptions.length === 0}>Lưu</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Báo giá ({quotes.length})</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã báo giá</TableHead>
                <TableHead>Tổng tiền</TableHead>
                <TableHead>Hiệu lực đến</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => {
                const isExpired = new Date(quote.validUntil).getTime() < now;
                const isFinal = quote.status === 'ACCEPTED' || quote.status === 'REJECTED' || quote.status === 'EXPIRED';
                const canAccept = !isFinal && !isExpired;
                return (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                    <TableCell>{Number(quote.total).toLocaleString('vi-VN')}đ</TableCell>
                    <TableCell>{new Date(quote.validUntil).toLocaleString('vi-VN')}</TableCell>
                    <TableCell><Badge variant={quote.status === 'ACCEPTED' ? 'default' : 'secondary'}>{quote.status}</Badge></TableCell>
                    <TableCell className="flex flex-wrap justify-end gap-2 text-right">
                      <CopyZaloQuoteButton
                        quoteNumber={quote.quoteNumber}
                        totalVnd={Number(quote.total)}
                        depositVnd={Math.ceil(Number(quote.total) / 2)}
                        model={quote.modelSnapshot ? {
                          title: quote.modelSnapshot.title,
                          totalPrintMinutes: quote.modelSnapshot.totalPrintMinutes,
                          platesCount: quote.modelSnapshot.platesCount,
                          colorsCount: quote.modelSnapshot.colorsCount,
                        } : null}
                        token={isExpired ? null : mintQuoteAccessToken(quote.id, new Date(quote.validUntil))}
                      />
                      {canAccept ? (
                        <form action={acceptQuoteAction.bind(null, quote.id, id)}>
                          <Button type="submit" size="sm">Chấp nhận báo giá</Button>
                        </form>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <form action={createQuoteAction.bind(null, id)} className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div className="col-span-2">
              <MakerWorldQuotePanel materials={materials} config={pricingConfig} priceInputIds={['subtotal', 'total']} />
            </div>
            <div className="col-span-2">
              <PricingCalculatorPanel materials={materials} config={pricingConfig} priceInputIds={['subtotal', 'total']} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subtotal">Tạm tính (VND)</Label>
              <Input id="subtotal" name="subtotal" type="number" min={0} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shippingFee">Phí vận chuyển (VND)</Label>
              <Input id="shippingFee" name="shippingFee" type="number" min={0} defaultValue={0} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discount">Giảm giá (VND)</Label>
              <Input id="discount" name="discount" type="number" min={0} defaultValue={0} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="total">Tổng tiền (VND)</Label>
              <Input id="total" name="total" type="number" min={0} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validUntil">Hiệu lực đến</Label>
              <Input id="validUntil" name="validUntil" type="datetime-local" required />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea id="note" name="note" />
            </div>
            <div className="col-span-2">
              <Button type="submit">Tạo báo giá</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
