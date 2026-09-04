import Image from 'next/image';
import { headers } from 'next/headers';
import { getPublicQuoteByPhoneSuffix, getPublicQuoteByToken } from '@/services/quote.service';
import { formatVnd } from '@/components/storefront/format';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { QuoteCountdown } from '@/components/storefront/quote-countdown';
import { buildVietQrUrl } from '@/lib/vietqr';
import { createDatabaseRateLimiter } from '@/lib/rate-limit';

// business-rules.md #18 (mirrors #14/ADR-0021): new scope, does not collide with
// 'public-order-lookup' — a customer polling/refreshing a quote link is a different traffic
// pattern (lower volume, no checkout race) but still deserves its own throttle independent of the
// order lookup budget.
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const isRateLimited = createDatabaseRateLimiter({ scope: 'public-quote-lookup', maxRequests: RATE_LIMIT_MAX_REQUESTS, windowMs: RATE_LIMIT_WINDOW_MS });

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-4 py-12">{children}</div>;
}

function PhoneSuffixGate({ quoteNumber, invalid }: { quoteNumber: string; invalid: boolean }) {
  return (
    <Shell>
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-xs">
        <h1 className="font-heading text-xl font-bold text-foreground">Xác minh để xem báo giá</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Link xem báo giá đã hết hạn hoặc thiếu mã xác minh — vui lòng nhập 4 số cuối số điện thoại bạn đã dùng khi gửi yêu cầu để tiếp tục xem.
        </p>
        {invalid ? <p className="mt-2 text-sm font-medium text-destructive">Không tìm thấy báo giá khớp với số điện thoại này.</p> : null}
        <form method="GET" className="mt-4 flex justify-center gap-2">
          <input
            type="text" name="phoneSuffix" inputMode="numeric" maxLength={4} pattern="\d{4}" required
            placeholder="4 số cuối SĐT"
            className="w-40 rounded-lg border border-input bg-background px-3 py-2 text-center text-sm"
          />
          <button type="submit" className={storefrontButtonClasses('primary')}>Xem báo giá</button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">Mã báo giá: <span className="font-mono">{quoteNumber}</span></p>
      </div>
    </Shell>
  );
}

export default async function PublicQuotePage({
  params, searchParams,
}: {
  params: Promise<{ quoteNumber: string }>;
  searchParams: Promise<{ phoneSuffix?: string; token?: string }>;
}) {
  const { quoteNumber } = await params;
  const { phoneSuffix = '', token = '' } = await searchParams;

  const headerList = await headers();
  const ip = headerList.get('cf-connecting-ip')?.trim()
    || headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  if (await isRateLimited(ip)) {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-xs">
          <p className="text-sm font-medium text-foreground">Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.</p>
        </div>
      </Shell>
    );
  }

  const hasPhoneSuffixAttempt = /^\d{4}$/.test(phoneSuffix);
  const quote = (token ? await getPublicQuoteByToken(quoteNumber, token) : null)
    ?? (hasPhoneSuffixAttempt ? await getPublicQuoteByPhoneSuffix(quoteNumber, phoneSuffix) : null);

  if (!quote) return <PhoneSuffixGate quoteNumber={quoteNumber} invalid={hasPhoneSuffixAttempt} />;

  const isExpired = new Date(quote.validUntil).getTime() < Date.now();
  const qrUrl = !isExpired ? buildVietQrUrl(quote.pricing.depositVnd, quote.quoteNumber) : null;

  return (
    <Shell>
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">Báo giá của bạn</h1>
        <p className="mt-1 text-sm text-muted-foreground">Xin chào {quote.customerName} — BaSa3D gửi bạn chi tiết báo giá bên dưới.</p>
        <p className="mt-2 font-mono text-lg font-bold tracking-wide text-foreground">{quote.quoteNumber}</p>
        <div className="mt-2"><QuoteCountdown validUntil={quote.validUntil} /></div>
      </div>

      {quote.modelSnapshot ? (
        <div className="mt-8 flex items-start gap-4 rounded-xl border border-border bg-card p-6 shadow-xs">
          {quote.modelSnapshot.coverImageUrl ? (
            <Image
              src={quote.modelSnapshot.coverImageUrl} alt={quote.modelSnapshot.title}
              width={96} height={96} unoptimized className="size-24 rounded-lg border border-border object-cover"
            />
          ) : null}
          <div>
            <p className="font-semibold text-foreground">{quote.modelSnapshot.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {quote.modelSnapshot.platesCount} plates · {Math.round((quote.modelSnapshot.totalPrintMinutes / 60) * 10) / 10} giờ in · {quote.modelSnapshot.colorsCount} màu
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-xs">
        <p className="text-sm font-semibold text-foreground">Chi tiết vật liệu</p>
        <div className="mt-3 flex flex-col gap-2">
          {quote.pricing.materials.length ? quote.pricing.materials.map((line, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{line.label ?? 'Vật liệu'} — {line.gram}g</span>
              <span className="font-medium text-foreground">{formatVnd(line.costVnd)}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">Chưa có chi tiết vật liệu.</p>}
        </div>
        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Chi phí in</span><span>{formatVnd(quote.pricing.printCostVnd)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Hoàn thiện</span><span>{formatVnd(quote.pricing.finishingCostVnd)}</span></div>
          {quote.pricing.packagingFeeVnd > 0 && <div className="flex justify-between text-muted-foreground"><span>Đóng gói</span><span>{formatVnd(quote.pricing.packagingFeeVnd)}</span></div>}
          {quote.pricing.shippingFeeVnd > 0 && <div className="flex justify-between text-muted-foreground"><span>Phí vận chuyển</span><span>{formatVnd(quote.pricing.shippingFeeVnd)}</span></div>}
          {quote.pricing.discountVnd > 0 && <div className="flex justify-between text-muted-foreground"><span>Giảm giá</span><span>-{formatVnd(quote.pricing.discountVnd)}</span></div>}
          <div className="flex justify-between text-base font-bold text-foreground"><span>Tổng cộng</span><span>{formatVnd(quote.pricing.totalVnd)}</span></div>
        </div>
      </div>

      {quote.note ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-xs">
          <p className="text-sm font-semibold text-foreground">Ghi chú từ BaSa3D</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{quote.note}</p>
        </div>
      ) : null}

      {isExpired ? (
        <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">Báo giá này đã hết hạn. Vui lòng liên hệ BaSa3D để được báo giá lại.</p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center shadow-xs">
          <p className="text-sm font-semibold text-foreground">Đặt cọc trước ({formatVnd(quote.pricing.depositVnd)} — 50%)</p>
          {qrUrl ? (
            <>
              <Image src={qrUrl} alt="Mã QR chuyển khoản VietQR" width={220} height={220} unoptimized className="mx-auto mt-3 rounded-lg border border-border" />
              <p className="mt-2 text-xs text-muted-foreground">Quét mã bằng app ngân hàng — nội dung chuyển khoản đã tự động điền mã báo giá {quote.quoteNumber}.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Vui lòng liên hệ Zalo/hotline BaSa3D để được cung cấp thông tin chuyển khoản.</p>
          )}
        </div>
      )}
    </Shell>
  );
}
