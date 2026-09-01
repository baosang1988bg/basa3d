import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { getPublicOrderByNumber } from '@/services/order.service';
import { formatVnd } from '@/components/storefront/format';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { SITE_CONFIG } from '@/config/site';

const DEPOSIT_SUGGESTED_THRESHOLD = 300_000; // ADR-0009 / business-rules.md #8

function buildVietQrUrl(amount: number, orderNumber: string): string | null {
  if (!SITE_CONFIG.bankId || !SITE_CONFIG.bankAccountNumber) return null;
  const params = new URLSearchParams({ amount: String(amount), addInfo: orderNumber });
  if (SITE_CONFIG.bankAccountName) params.set('accountName', SITE_CONFIG.bankAccountName);
  return `https://img.vietqr.io/image/${encodeURIComponent(SITE_CONFIG.bankId)}-${encodeURIComponent(SITE_CONFIG.bankAccountNumber)}-compact2.png?${params.toString()}`;
}

function formatAddress(address: Record<string, unknown>): string {
  return [address.line1, address.ward, address.city].filter((part) => typeof part === 'string' && part.trim() !== '').join(', ');
}

export default async function OrderConfirmationPage({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ phoneSuffix?: string }> }) {
  const { orderNumber } = await params;
  const { phoneSuffix = '' } = await searchParams;
  if (!/^\d{4}$/.test(phoneSuffix)) notFound();
  const order = await getPublicOrderByNumber(orderNumber, phoneSuffix);
  if (!order) notFound();

  const bankTransfer = order.paymentMethod === 'BANK_TRANSFER';
  const qrUrl = bankTransfer ? buildVietQrUrl(order.total, order.orderNumber) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h1 className="font-heading mt-4 text-2xl font-bold text-foreground md:text-[2rem]">Đặt hàng thành công!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Mã đơn hàng của bạn — vui lòng lưu lại để tra cứu sau này.</p>
        <p className="mt-2 font-mono text-lg font-bold tracking-wide text-foreground">{order.orderNumber}</p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-xs">
        <p className="text-sm font-semibold text-foreground">Sản phẩm</p>
        <div className="mt-3 flex flex-col gap-2">
          {order.items.map((item, index) => (
            <div key={`${item.skuSnapshot}-${index}`} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.productNameSnapshot} ({item.variantNameSnapshot}) × {item.quantity}</span>
              <span className="font-medium text-foreground">{formatVnd(item.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Tạm tính</span><span>{formatVnd(order.subtotal)}</span></div>
          {order.shippingFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Phí vận chuyển</span><span>{formatVnd(order.shippingFee)}</span></div>}
          {order.discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Giảm giá</span><span>-{formatVnd(order.discount)}</span></div>}
          <div className="flex justify-between text-base font-bold text-foreground"><span>Tổng cộng</span><span>{formatVnd(order.total)}</span></div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-xs">
        <p className="text-sm font-semibold text-foreground">Giao đến</p>
        <p className="mt-1 text-sm text-muted-foreground">{order.customerName} · {order.customerPhone}</p>
        <p className="text-sm text-muted-foreground">{formatAddress(order.shippingAddress)}</p>
      </div>

      {bankTransfer && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center shadow-xs">
          <p className="text-sm font-semibold text-foreground">Chuyển khoản thanh toán</p>
          {qrUrl ? (
            <>
              <Image src={qrUrl} alt="Mã QR chuyển khoản VietQR" width={220} height={220} unoptimized className="mx-auto mt-3 rounded-lg border border-border" />
              <p className="mt-2 text-xs text-muted-foreground">Quét mã bằng app ngân hàng — nội dung chuyển khoản đã tự động điền mã đơn {order.orderNumber}.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Vui lòng liên hệ Zalo/hotline {SITE_CONFIG.hotline} để được cung cấp thông tin chuyển khoản.</p>
          )}
          {order.total >= DEPOSIT_SUGGESTED_THRESHOLD && (
            <p className="mt-3 text-xs text-muted-foreground">Đơn hàng từ {formatVnd(DEPOSIT_SUGGESTED_THRESHOLD)} trở lên, BaSa3D có thể liên hệ để thoả thuận đặt cọc trước khi sản xuất.</p>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <Link href="/products" className={storefrontButtonClasses('secondary')}>Tiếp tục mua sắm</Link>
        <Link href="/" className={storefrontButtonClasses('primary')}>Về trang chủ</Link>
      </div>
    </div>
  );
}
