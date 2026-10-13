import { ActionForm } from '@/components/admin/action-form';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { QuoteToolSwitcher } from '@/components/admin/quote-tool-switcher';
import { QuoteTotalsFields } from '@/components/admin/quote-totals-fields';
import { ASSEMBLY_TIERS } from '@/lib/pricing/assembly-tiers';
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

function statusLabel(status: string) {
  return [...CUSTOM_REQUEST_STEPS, ...CUSTOM_REQUEST_TERMINAL_STATUSES].find((item) => item.status === status)?.label ?? (status === 'NEED_INFO' ? 'Cần bổ sung thông tin' : status);
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
        <div className="flex items-center gap-2">
          {customRequest.ipRiskFlag ? <Badge variant="destructive">⚠️ Rủi ro SHTT</Badge> : null}
          <Badge variant="secondary">{customRequest.sourceChannel}</Badge>
        </div>
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
          {customRequest.makerworldSnapshot ? (
            <div className="col-span-2 rounded-lg border border-emerald-600/40 bg-emerald-600/5 p-3">
              <p className="font-medium">Yêu cầu từ MakerWorld (Storefront)</p>
              <a href={customRequest.makerworldSnapshot.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                {customRequest.makerworldSnapshot.modelTitle ?? customRequest.makerworldSnapshot.sourceUrl}
              </a>
              <p className="mt-1 text-muted-foreground">
                Profile: {customRequest.makerworldSnapshot.profileTitle ?? (customRequest.makerworldSnapshot.profileId ? `#${customRequest.makerworldSnapshot.profileId}` : 'khách chưa chọn')}
                {' · '}{ASSEMBLY_TIERS[customRequest.makerworldSnapshot.tier].label}
              </p>
              <p className="text-muted-foreground">
                Giá tham khảo khách đã thấy:{' '}
                {customRequest.makerworldSnapshot.estimatedPriceVnd !== null
                  ? `${customRequest.makerworldSnapshot.estimatedPriceVnd.toLocaleString('vi-VN')}đ (${customRequest.makerworldSnapshot.estimateSource === 'VERIFIED' ? 'giá đã duyệt' : customRequest.makerworldSnapshot.estimateSource === 'SPEC' ? 'ước tính từ thông số khách dán' : 'ước tính tự động'})`
                  : 'không có (chưa có giá)'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Panel báo giá bên dưới đã điền sẵn link và phương án — bấm &quot;Tự động lấy dữ liệu&quot; hoặc nhập tay.</p>
            </div>
          ) : null}
          {customRequest.quoteEstimateSnapshot ? (
            <div className="col-span-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="font-medium">Giá tự động khách đã thấy (từ file)</p>
              <p className="text-muted-foreground">
                {customRequest.quoteEstimateSnapshot.option === 'STANDARD' ? 'Giá in' : ASSEMBLY_TIERS[customRequest.quoteEstimateSnapshot.option].label}:{' '}
                {customRequest.quoteEstimateSnapshot.priceVnd !== null
                  ? `${customRequest.quoteEstimateSnapshot.priceVnd.toLocaleString('vi-VN')}đ`
                  : `${(customRequest.quoteEstimateSnapshot.minVnd ?? 0).toLocaleString('vi-VN')}đ – ${(customRequest.quoteEstimateSnapshot.maxVnd ?? 0).toLocaleString('vi-VN')}đ`}
                {' · '}{customRequest.quoteEstimateSnapshot.kind === 'SLICED' ? 'từ file .3mf đã slice' : 'ước tính sơ bộ từ thể tích'}
                {' · '}{customRequest.quoteEstimateSnapshot.materialType}
              </p>
              <p className="text-xs text-muted-foreground">
                {customRequest.quoteEstimateSnapshot.specs.printMinutes !== null ? `${Math.round((customRequest.quoteEstimateSnapshot.specs.printMinutes / 60) * 10) / 10}h · ` : ''}
                {customRequest.quoteEstimateSnapshot.specs.netWeightGrams !== null ? `${customRequest.quoteEstimateSnapshot.specs.netWeightGrams}g · ` : ''}
                {customRequest.quoteEstimateSnapshot.specs.platesCount !== null ? `${customRequest.quoteEstimateSnapshot.specs.platesCount} plates` : ''}
                {customRequest.quoteEstimateSnapshot.specs.sizeMm ? `kích thước ${customRequest.quoteEstimateSnapshot.specs.sizeMm.x}×${customRequest.quoteEstimateSnapshot.specs.sizeMm.y}×${customRequest.quoteEstimateSnapshot.specs.sizeMm.z} mm` : ''}
              </p>
            </div>
          ) : null}
          {customRequest.makerworldSnapshot?.specText ? (
            <div className="col-span-2 text-xs text-muted-foreground">Thông số khách dán (cần đối chiếu MakerWorld): <span className="font-mono">{customRequest.makerworldSnapshot.specText}</span></div>
          ) : null}
          <div className="col-span-2"><p className="text-muted-foreground">Mô tả</p><p className="whitespace-pre-wrap">{customRequest.description}</p></div>
          {customRequest.internalNote ? (
            <div className="col-span-2"><p className="text-muted-foreground">Ghi chú nội bộ</p><p className="whitespace-pre-wrap">{customRequest.internalNote}</p></div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trạng thái: <Badge>{statusLabel(customRequest.status)}</Badge></CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={updateCustomRequestStatusAction.bind(null, id)} className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Cập nhật trạng thái</Label>
              <select id="status" name="status" defaultValue="" required className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="" disabled>— Chọn trạng thái —</option>
                {statusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
            </div>
            {session.role === 'OWNER' ? <Input name="overrideReason" placeholder="Lý do nếu override" className="w-64" /> : null}
            <Button type="submit" size="sm" disabled={statusOptions.length === 0}>Lưu</Button>
          </ActionForm>
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
                    <TableCell className="font-medium">
                      {quote.quoteNumber}
                      {quote.modelSnapshot?.schemaVersion === 2 ? (
                        <p className="text-xs font-normal text-muted-foreground">
                          {quote.modelSnapshot.profileTitle}
                          {quote.modelSnapshot.tier ? ` · ${ASSEMBLY_TIERS[quote.modelSnapshot.tier].label}` : ''}
                          {quote.modelSnapshot.dataSource === 'MANUAL' ? ' · nhập tay' : ''}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {Number(quote.total).toLocaleString('vi-VN')}đ
                      {quote.vatAmount > 0 ? (
                        <p className="text-xs text-muted-foreground">gồm VAT {quote.vatRateBps / 100}%: {quote.vatAmount.toLocaleString('vi-VN')}đ</p>
                      ) : null}
                    </TableCell>
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
                        <ActionForm action={acceptQuoteAction.bind(null, quote.id, id)}>
                          <Button type="submit" size="sm">Chấp nhận báo giá</Button>
                        </ActionForm>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <ActionForm action={createQuoteAction.bind(null, id)} className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div className="col-span-2">
              {/* B7: exactly one pricing tool mounted at a time — see QuoteToolSwitcher. */}
              <QuoteToolSwitcher
                materials={materials} config={pricingConfig} priceInputIds={['subtotal']}
                initialMakerWorld={customRequest.makerworldSnapshot ? { url: customRequest.makerworldSnapshot.sourceUrl, tier: customRequest.makerworldSnapshot.tier } : null}
              />
            </div>
            {/* Phase 33 S1: VAT line (read-only) + derived total, from the CURRENT pricing config. */}
            <QuoteTotalsFields vatEnabled={pricingConfig?.vatEnabled ?? false} vatRateBps={pricingConfig?.vatRateBps ?? 0} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validUntil">Hiệu lực đến</Label>
              <Input id="validUntil" name="validUntil" type="datetime-local" required />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea id="note" name="note" />
            </div>
            {customRequest.ipRiskFlag ? (
              <div className="col-span-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <input id="ipRiskAcknowledged" name="ipRiskAcknowledged" type="checkbox" required className="mt-0.5 size-4" />
                <Label htmlFor="ipRiskAcknowledged" className="cursor-pointer text-sm font-normal">
                  Đã kiểm tra yêu cầu này không vi phạm SHTT hoặc in chi tiết phi thương mại theo yêu cầu cá nhân.
                </Label>
              </div>
            ) : null}
            <div className="col-span-2">
              <Button type="submit">Tạo báo giá</Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
