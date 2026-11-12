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
import { PRINTER_PROFILES } from '@/lib/pricing/printer-profiles';
import { CopyZaloQuoteButton } from '@/components/admin/copy-zalo-quote-button';
import { ProcessStepper } from '@/components/admin/process-stepper';
import { createCustomRequestAttachmentSignedUrl, getCustomRequestById, nextCustomRequestStatuses } from '@/services/custom-request.service';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listMaterials } from '@/services/inventory.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { listQuotesByCustomRequest, mintQuoteAccessToken } from '@/services/quote.service';
import { acceptQuoteAction, createQuoteAction, reverifyCustomRequestItemAction, updateCustomRequestStatusAction } from '../actions';
import { listCustomRequestItems } from '@/services/custom-request-items.service';
import { ReverifyItemButton } from '@/components/admin/reverify-item-button';
import { CopyQuoteLinksButton } from '@/components/admin/copy-quote-links-button';
import { AutoLinkText } from '@/components/ui/auto-link-text';
import { parseMakerWorldSpecText } from '@/lib/parsers/makerworld-spec-text';
import { parseMakerWorldDescription } from '@/lib/parsers/makerworld-description';

function getModelDisplayTitle(sourceUrl: string, modelTitle?: string | null, profileTitle?: string | null): string {
  if (modelTitle && modelTitle !== profileTitle && !/^\d+(\.\d+)?\s*mm\s+layer/i.test(modelTitle)) {
    return modelTitle;
  }
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/\/models\/\d+(?:-([^/?#]+))?/);
    if (match && match[1]) {
      const clean = match[1].replace(/[-_]+/g, ' ').trim();
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  } catch {
    // fallback
  }
  return modelTitle ?? sourceUrl;
}

const VERIFICATION_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  VERIFIED: { label: 'Đã xác minh', variant: 'default' },
  MISMATCH: { label: 'Lệch số liệu', variant: 'destructive' },
  CLIENT_REPORTED: { label: 'Số khách gửi', variant: 'outline' },
  UNPRICED: { label: 'Chưa có giá', variant: 'secondary' },
};

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

export default async function CustomRequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ item?: string }> }) {
  const { id } = await params;
  const { item: selectedItemId } = await searchParams;
  const session = await requireAdmin();
  const [customRequest, quotes, materials, pricingConfig, items] = await Promise.all([
    getCustomRequestById(id), listQuotesByCustomRequest(id), listMaterials(), getCurrentPricingConfig(), listCustomRequestItems(id),
  ]);
  if (!customRequest) notFound();
  const attachmentSignedUrl = customRequest.attachmentPath
    ? await createCustomRequestAttachmentSignedUrl(customRequest.attachmentPath)
    : null;
  // Phase 33 S7: /bao-gia items — 1 item = 1 Quote (D2).
  const itemLinks = await Promise.all(items.map((item) => createCustomRequestAttachmentSignedUrl(item.attachmentPath).catch(() => null)));
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  // §7.1 pre-fill rules: VERIFIED / MISMATCH (already server numbers) → pre-fill; CLIENT_REPORTED →
  // locked until "Kiểm tra lại trên server"; UNPRICED → nothing.
  const prefillSubtotal = selectedItem && (selectedItem.verification === 'VERIFIED' || selectedItem.verification === 'MISMATCH')
    ? selectedItem.estimateSnapshot?.lineSubtotalVnd ?? null
    : null;
  const quotesByItem = new Map<string, typeof quotes>();
  for (const quote of quotes) {
    if (!quote.customRequestItemId) continue;
    quotesByItem.set(quote.customRequestItemId, [...(quotesByItem.get(quote.customRequestItemId) ?? []), quote]);
  }
  const itemPosition = new Map(items.map((item) => [item.id, item.position]));
  const quoteLinkLines = quotes
    .filter((quote) => quote.status !== 'REJECTED' && quote.status !== 'EXPIRED' && new Date(quote.validUntil).getTime() >= Date.now())
    .map((quote) => {
      const position = quote.customRequestItemId ? itemPosition.get(quote.customRequestItemId) : undefined;
      const item = position ? items[position - 1] : undefined;
      const token = mintQuoteAccessToken(quote.id, new Date(quote.validUntil));
      return `${item ? `Món ${position} (${item.displayName})` : quote.quoteNumber}: ${Number(quote.total).toLocaleString('vi-VN')}đ — https://basa3d.vn/quotes/${quote.quoteNumber}?token=${encodeURIComponent(token)}`;
    });

  const statusOptions = session.role === 'OWNER'
    ? CUSTOM_REQUEST_STATUSES.filter((status) => status !== customRequest.status)
    : nextCustomRequestStatuses(customRequest.status);

  const now = Date.now();

  const parsedDesc = parseMakerWorldDescription(customRequest.description);
  const isMakerWorld = Boolean(customRequest.makerworldSnapshot || parsedDesc.isMakerWorld);
  const effectiveMkw = isMakerWorld ? {
    sourceUrl: customRequest.makerworldSnapshot?.sourceUrl || parsedDesc.sourceUrl || '',
    modelId: customRequest.makerworldSnapshot?.modelId || (parsedDesc.sourceUrl ? parsedDesc.sourceUrl.match(/\/models\/(\d+)/)?.[1] ?? null : null),
    profileId: customRequest.makerworldSnapshot?.profileId || parsedDesc.profileId || null,
    modelTitle: customRequest.makerworldSnapshot?.modelTitle || parsedDesc.modelTitle || null,
    profileTitle: customRequest.makerworldSnapshot?.profileTitle || parsedDesc.profileTitle || null,
    tier: customRequest.makerworldSnapshot?.tier || parsedDesc.tier || 'ASSEMBLED',
    profileConfirmed: true as const,
    estimateSource: (customRequest.makerworldSnapshot?.estimateSource && customRequest.makerworldSnapshot.estimateSource !== 'NONE')
      ? customRequest.makerworldSnapshot.estimateSource
      : (parsedDesc.estimatedPriceVnd ? 'AUTO' as const : 'NONE' as const),
    estimatedPriceVnd: customRequest.makerworldSnapshot?.estimatedPriceVnd ?? parsedDesc.estimatedPriceVnd,
    estimatedAt: customRequest.makerworldSnapshot?.estimatedAt ?? customRequest.createdAt.toISOString(),
    specText: customRequest.makerworldSnapshot?.specText || (parsedDesc.printTimeText ? `${parsedDesc.printTimeText} · ${parsedDesc.weightText ?? ''} · ${parsedDesc.platesText ?? ''} · ${parsedDesc.printerTarget ?? ''} · ${parsedDesc.amsText ?? ''}`.trim() : null),
    screenshot: customRequest.makerworldSnapshot?.screenshot,
  } : null;

  const displayMaterial = customRequest.requestedMaterial || parsedDesc.material || (isMakerWorld ? 'PLA' : null);
  const displayColor = customRequest.requestedColor || parsedDesc.requestedColor || (parsedDesc.fileColors ? `${parsedDesc.fileColors}` : null);
  const displaySize = customRequest.requestedSize || null;
  const defaultSubtotalValue = prefillSubtotal ?? (effectiveMkw?.estimatedPriceVnd ? effectiveMkw.estimatedPriceVnd * customRequest.quantity : null);

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
          <div><p className="text-muted-foreground">Khách hàng</p><p className="font-medium text-foreground">{customRequest.customerName}</p></div>
          <div>
            <p className="text-muted-foreground">Số điện thoại</p>
            <p className="font-medium text-foreground">
              <a href={`tel:${customRequest.customerPhone}`} className="hover:text-primary transition-colors underline-offset-2 hover:underline">
                {customRequest.customerPhone}
              </a>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium text-foreground">
              {customRequest.customerEmail ? (
                <a href={`mailto:${customRequest.customerEmail}`} className="hover:text-primary transition-colors underline-offset-2 hover:underline">
                  {customRequest.customerEmail}
                </a>
              ) : '—'}
            </p>
          </div>
          <div><p className="text-muted-foreground">Số lượng</p><p className="font-medium text-foreground">{customRequest.quantity}</p></div>
          <div>
            <p className="text-muted-foreground">Chất liệu yêu cầu</p>
            <p className="font-medium text-foreground">
              {displayMaterial ?? '—'}
              {!customRequest.requestedMaterial && parsedDesc.material ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(từ file mẫu)</span>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Màu sắc yêu cầu</p>
            <p className="font-medium text-foreground">
              {displayColor ?? '—'}
              {!customRequest.requestedColor && parsedDesc.fileColors ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(màu theo file)</span>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Kích thước yêu cầu</p>
            <p className="font-medium text-foreground">{displaySize ?? '—'}</p>
          </div>
          <div><p className="text-muted-foreground">Ngày tạo</p><p className="font-medium text-foreground">{new Date(customRequest.createdAt).toLocaleString('vi-VN')}</p></div>
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
          {effectiveMkw ? (() => {
            const mw = effectiveMkw;
            const parsedSpec = mw.specText ? parseMakerWorldSpecText(mw.specText) : null;
            const modelDisplayTitle = mw.modelTitle || getModelDisplayTitle(mw.sourceUrl, mw.modelTitle, mw.profileTitle);
            const sourceBadge = mw.estimateSource === 'VERIFIED'
              ? { label: 'Giá đã duyệt (Verified)', variant: 'default' as const }
              : mw.estimateSource === 'AUTO'
                ? { label: 'Tự động (Auto)', variant: 'secondary' as const }
                : mw.estimateSource === 'SPEC'
                  ? { label: 'Khách dán thông số / Nhập tay (Spec)', variant: 'outline' as const }
                  : mw.estimateSource === 'SCREENSHOT'
                    ? { label: 'AI đọc từ ảnh chụp (Screenshot)', variant: 'outline' as const }
                    : mw.estimatedPriceVnd
                      ? { label: 'Giá ước tính storefront', variant: 'secondary' as const }
                      : { label: 'Chưa có giá tham khảo', variant: 'secondary' as const };
            const shot = mw.screenshot;
            const matchLabel = shot?.matchStatus === 'MATCH' ? 'Khớp link' : shot?.matchStatus === 'MISMATCH' ? 'KHÔNG khớp link' : 'Chưa đối chiếu được';

            const printMinutesVal = parsedSpec?.printMinutes ?? parsedDesc.printMinutes;
            const weightGramsVal = parsedSpec?.netWeightGrams ?? parsedDesc.weightGrams;
            const platesCountVal = parsedSpec?.platesCount ?? parsedDesc.platesCount;
            const printerTargetVal = parsedSpec?.printerTarget ?? parsedDesc.printerTarget;
            const amsRequiredVal = parsedSpec?.amsRequired ?? parsedDesc.amsRequired;

            return (
              <div className="col-span-2 flex flex-col gap-3 rounded-lg border border-emerald-600/40 bg-emerald-600/5 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-600/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-emerald-950 dark:text-emerald-100">Yêu cầu từ MakerWorld (Storefront)</span>
                    <Badge variant={sourceBadge.variant}>{sourceBadge.label}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Phương án: <strong className="text-foreground">{ASSEMBLY_TIERS[mw.tier]?.label ?? parsedDesc.tierLabel ?? 'Bản Ráp sẵn'}</strong>
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Mô hình &amp; Liên kết gốc</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={mw.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline break-all">
                      🔗 {modelDisplayTitle}
                    </a>
                    {parsedDesc.author ? (
                      <span className="text-xs text-muted-foreground">· Tác giả: <strong className="font-medium text-foreground">{parsedDesc.author}</strong></span>
                    ) : null}
                  </div>
                </div>

                {/* Bảng dữ liệu đã lưu trước đó để đối chiếu */}
                <div className="rounded-md border border-emerald-600/20 bg-background/90 p-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-border/50">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Dữ liệu đã lưu trước đó (Đối chiếu khi làm báo giá)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {mw.estimatedAt ? `Ghi nhận lúc: ${new Date(mw.estimatedAt).toLocaleString('vi-VN')}` : null}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Profile yêu cầu</span>
                      <span className="font-medium text-foreground">{mw.profileTitle ?? (mw.profileId ? `#${mw.profileId}` : 'Chưa chỉ định')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Thời gian in</span>
                      <span className="font-medium text-foreground">
                        {printMinutesVal != null ? `${Math.round(printMinutesVal / 60 * 10) / 10}h (${printMinutesVal}p)` : 'Chưa có'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Trọng lượng (net)</span>
                      <span className="font-medium text-foreground">{weightGramsVal != null ? `${weightGramsVal}g` : 'Chưa có'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Số plate</span>
                      <span className="font-medium text-foreground">{platesCountVal != null ? `${platesCountVal} plates` : 'Chưa có'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Máy in mục tiêu</span>
                      <span className="font-medium text-foreground">{printerTargetVal ?? 'Chưa rõ'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Hệ thống AMS</span>
                      <span className="font-medium text-foreground">
                        {amsRequiredVal === false ? 'Không AMS' : amsRequiredVal === true ? 'Có AMS (Đa màu)' : 'Chưa rõ'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Giá tham khảo khách thấy</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {mw.estimatedPriceVnd !== null && mw.estimatedPriceVnd !== undefined ? `${mw.estimatedPriceVnd.toLocaleString('vi-VN')}đ` : 'Chưa có giá'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Mã Profile ID</span>
                      <span className="font-mono text-muted-foreground">{mw.profileId ? `#${mw.profileId}` : '—'}</span>
                    </div>
                  </div>

                  {shot ? (
                    <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border/50 pt-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">Ảnh chụp ↔ link:</span>
                        <Badge variant={shot.matchStatus === 'MISMATCH' ? 'destructive' : shot.matchStatus === 'MATCH' ? 'default' : 'secondary'}>{matchLabel}</Badge>
                        {shot.modelTitleExtracted ? <span className="text-muted-foreground">Tên mẫu AI đọc: <span className="text-foreground">{shot.modelTitleExtracted}</span></span> : null}
                      </div>
                      <span className="text-muted-foreground">Ảnh gốc ở mục &quot;File đính kèm / Ảnh mẫu&quot;. Các profile AI đọc được (★ = khách chọn) — AI có thể đọc sai, hãy mở link MakerWorld để xác nhận:</span>
                      <ul className="flex flex-col gap-0.5">
                        {shot.profiles.map((p) => (
                          <li key={p.key} className={p.key === shot.selectedProfileKey ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                            {p.key === shot.selectedProfileKey ? '★ ' : '• '}{p.specLine}{p.dataIncomplete ? ' (thiếu số liệu)' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {mw.specText && !shot ? (
                    <div className="mt-2.5 pt-2 border-t border-border/50 text-xs">
                      <span className="text-muted-foreground block mb-1">Đoạn thông số ghi nhận:</span>
                      <code className="block rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground break-words select-all">
                        {mw.specText}
                      </code>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-emerald-500/10 rounded px-2.5 py-1.5 border border-emerald-500/20">
                  <span>💡</span>
                  <span>
                    Dữ liệu trên đã được nạp sẵn xuống panel báo giá bên dưới. Bạn có thể bấm <strong>&quot;Tự động lấy dữ liệu&quot;</strong> để hệ thống đối chiếu song song 2 giá trị (số liệu khách gửi vs số liệu thực tế trên MakerWorld).
                  </span>
                </div>
              </div>
            );
          })() : null}
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
          <div className="col-span-2">
            <p className="text-muted-foreground">Mô tả / Ghi chú của khách</p>
            {parsedDesc.isMakerWorld ? (
              <div className="mt-1 flex flex-col gap-2">
                {parsedDesc.customerNote ? (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Ghi chú từ khách hàng:</p>
                    <p className="whitespace-pre-wrap"><AutoLinkText text={parsedDesc.customerNote} /></p>
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">Không có ghi chú thêm từ khách hàng (thông số kỹ thuật MakerWorld đã được tổng hợp ở bảng trên).</p>
                )}
                <details className="text-xs text-muted-foreground group">
                  <summary className="cursor-pointer hover:text-foreground select-none py-1 transition-colors">
                    ▶ Xem nội dung đầy đủ từ storefront (raw text)
                  </summary>
                  <pre className="mt-1.5 p-2.5 rounded bg-muted/60 text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-words border border-border/40">
                    {customRequest.description}
                  </pre>
                </details>
              </div>
            ) : (
              <p className="whitespace-pre-wrap mt-1"><AutoLinkText text={customRequest.description} /></p>
            )}
          </div>
          {customRequest.internalNote ? (
            <div className="col-span-2"><p className="text-muted-foreground">Ghi chú nội bộ</p><p className="whitespace-pre-wrap"><AutoLinkText text={customRequest.internalNote} /></p></div>
          ) : null}
        </CardContent>
      </Card>

      {items.length ? (
        <Card>
          <CardHeader><CardTitle>Các món ({items.length}) — 1 món = 1 báo giá</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Cấu hình</TableHead>
                  <TableHead>Ước tính</TableHead>
                  <TableHead>Xác minh</TableHead>
                  <TableHead>Báo giá</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const snap = item.estimateSnapshot;
                  const badge = VERIFICATION_LABEL[item.verification] ?? { label: item.verification, variant: 'secondary' as const };
                  const itemQuotes = quotesByItem.get(item.id) ?? [];
                  return (
                    <TableRow key={item.id} className={selectedItemId === item.id ? 'bg-primary/5' : undefined}>
                      <TableCell>{item.position}</TableCell>
                      <TableCell className="max-w-[220px]">
                        {itemLinks[index] ? <a href={itemLinks[index]!} target="_blank" rel="noreferrer" className="break-all font-medium text-primary hover:underline">{item.displayName}</a> : <span className="break-all">{item.displayName}</span>}
                        <p className="text-xs text-muted-foreground">{(item.fileSizeBytes / 1_048_576).toFixed(1)} MB · link hết hạn sau 15 phút</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.materialType} · {item.infillPct}% · tỉ lệ {item.scalePermille / 10}% · SL {item.quantity}
                        {item.color ? ` · ${item.color}` : ''}
                        {snap ? <p className="text-muted-foreground">{snap.sizeMm.x} × {snap.sizeMm.y} × {snap.sizeMm.z} mm</p> : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {snap?.lineSubtotalVnd != null ? (
                          <>
                            <p className="font-medium">{snap.lineSubtotalVnd.toLocaleString('vi-VN')}đ{snap.floorApplied ? ' (giá sàn)' : ''}</p>
                            <p className="text-muted-foreground">{snap.grams}g · {Math.round(((snap.printMinutes ?? 0) / 60) * 10) / 10}h · {snap.modelVersion}</p>
                          </>
                        ) : <span className="text-muted-foreground">{snap?.unpricedReason ?? snap?.status ?? '—'}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        {item.verification === 'MISMATCH' && snap?.mismatchPct !== undefined ? <p className="text-xs text-destructive">lệch {snap.mismatchPct}%</p> : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {itemQuotes.length ? itemQuotes.map((quote) => <p key={quote.id}>{quote.quoteNumber} · {quote.status}</p>) : <span className="text-muted-foreground">Chưa có</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <a href={`?item=${item.id}#quote-form`} className="text-sm font-medium text-primary hover:underline">Tạo báo giá cho món này</a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div><CopyQuoteLinksButton lines={quoteLinkLines} /></div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Trạng thái: <Badge>{statusLabel(customRequest.status)}</Badge></CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={updateCustomRequestStatusAction.bind(null, id)} className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Cập nhật trạng thái</Label>
              <select
                id="status"
                name="status"
                defaultValue=""
                required
                className="h-8 cursor-pointer rounded-lg border border-input bg-background text-foreground px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card dark:text-card-foreground dark:border-white/15 [&>option]:bg-background [&>option]:text-foreground dark:[&>option]:bg-card dark:[&>option]:text-card-foreground"
              >
                <option value="" disabled className="text-muted-foreground">— Chọn trạng thái —</option>
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
                <TableHead>Món</TableHead>
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
                      {quote.printerProfileId ? (
                        <p className="text-xs font-normal text-muted-foreground">Máy in: {PRINTER_PROFILES[quote.printerProfileId].shortName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{quote.customRequestItemId && itemPosition.get(quote.customRequestItemId) ? `#${itemPosition.get(quote.customRequestItemId)}` : '—'}</TableCell>
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
            <span id="quote-form" className="sr-only" />
            {selectedItem ? (
              <div className="col-span-2 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                <input type="hidden" name="customRequestItemId" value={selectedItem.id} />
                <div>
                  <p className="font-medium">Đang báo giá cho món #{selectedItem.position}: {selectedItem.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedItem.verification === 'CLIENT_REPORTED'
                      ? 'Số liệu do trình duyệt khách gửi (file vượt ngân sách kiểm tra) — chưa điền sẵn giá. Bấm kiểm tra lại hoặc nhập tay.'
                      : selectedItem.verification === 'UNPRICED'
                        ? 'Món này không có giá tự động — nhập giá tay.'
                        : 'Đã điền sẵn giá ước tính từ số liệu máy chủ — kiểm tra lại trước khi tạo.'}
                  </p>
                </div>
                {selectedItem.verification === 'CLIENT_REPORTED' ? <ReverifyItemButton action={reverifyCustomRequestItemAction.bind(null, selectedItem.id)} /> : null}
                <a href="?#quote-form" className="text-xs text-muted-foreground hover:underline">Bỏ chọn món</a>
              </div>
            ) : null}
            <div className="col-span-2">
              {/* B7: exactly one pricing tool mounted at a time — see QuoteToolSwitcher. */}
              <QuoteToolSwitcher
                materials={materials} config={pricingConfig} priceInputIds={['subtotal']}
                initialMakerWorld={effectiveMkw ? {
                  url: effectiveMkw.sourceUrl,
                  tier: effectiveMkw.tier,
                  specText: effectiveMkw.specText,
                  profileTitle: effectiveMkw.profileTitle,
                  estimatedPriceVnd: effectiveMkw.estimatedPriceVnd,
                  estimateSource: effectiveMkw.estimateSource,
                  modelTitle: effectiveMkw.modelTitle,
                } : null}
              />
            </div>
            {/* Phase 33 S1: VAT line (read-only) + derived total, from the CURRENT pricing config. */}
            <QuoteTotalsFields vatEnabled={pricingConfig?.vatEnabled ?? false} vatRateBps={pricingConfig?.vatRateBps ?? 0} defaultSubtotal={defaultSubtotalValue} />
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
