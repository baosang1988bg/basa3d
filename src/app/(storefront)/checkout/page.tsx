'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { StorefrontButton, storefrontButtonClasses } from '@/components/storefront/button';
import { formatVnd } from '@/components/storefront/format';
import { useCart } from '@/lib/cart/cart-context';

type SubmitState = { status: 'idle' | 'submitting' | 'error'; message?: string };

const ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_STOCK: 'Một sản phẩm trong giỏ hàng không còn đủ số lượng tồn kho. Vui lòng quay lại giỏ hàng và điều chỉnh số lượng.',
  VARIANT_NOT_FOUND: 'Một sản phẩm trong giỏ hàng không còn tồn tại. Vui lòng quay lại giỏ hàng và kiểm tra lại.',
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => setHasMounted(true), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;
    const form = new FormData(event.currentTarget);
    setState({ status: 'submitting' });

    const payload = {
      customerName: String(form.get('customerName') ?? ''),
      customerPhone: String(form.get('customerPhone') ?? ''),
      customerEmail: form.get('customerEmail') ? String(form.get('customerEmail')) : null,
      shippingAddress: {
        line1: String(form.get('addressLine1') ?? ''),
        ward: String(form.get('ward') ?? ''),
        city: String(form.get('city') ?? ''),
      },
      paymentMethod: String(form.get('paymentMethod') ?? 'COD'),
      customerNote: form.get('customerNote') ? String(form.get('customerNote')) : null,
      items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      honeypot: String(form.get('company-website') ?? ''),
    };

    try {
      const response = await fetch('/api/public/orders', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setState({ status: 'error', message: ERROR_MESSAGES[body.code] ?? body.message ?? 'Có lỗi xảy ra, vui lòng kiểm tra lại thông tin.' });
        return;
      }
      clearCart();
      router.push(`/order-confirmation/${body.orderNumber}`);
    } catch {
      setState({ status: 'error', message: 'Không thể kết nối máy chủ, vui lòng thử lại.' });
    }
  }

  if (hasMounted && items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">Giỏ hàng trống</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bạn cần thêm sản phẩm vào giỏ hàng trước khi đặt hàng.</p>
        <Link href="/products" className={storefrontButtonClasses('accent', 'mt-6')}>Khám phá sản phẩm</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">Thông tin đặt hàng</h1>

      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-xs md:col-span-2">
          {/* Honeypot: visually hidden from real users, same pattern as the custom-print form */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor="company-website">Company website</label>
            <input id="company-website" name="company-website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customerName" className="text-sm font-semibold text-foreground">Họ tên *</label>
              <input id="customerName" name="customerName" required maxLength={200} placeholder="Ví dụ: Nguyễn Văn A" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customerPhone" className="text-sm font-semibold text-foreground">SĐT nhận hàng *</label>
              <input id="customerPhone" name="customerPhone" required maxLength={30} placeholder="098xxxxxxx" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="customerEmail" className="text-sm font-semibold text-foreground">Email (không bắt buộc)</label>
              <input id="customerEmail" name="customerEmail" type="email" maxLength={320} placeholder="name@example.com" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="addressLine1" className="text-sm font-semibold text-foreground">Địa chỉ nhận hàng *</label>
              <input id="addressLine1" name="addressLine1" required maxLength={500} placeholder="Số nhà, tên đường" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ward" className="text-sm font-semibold text-foreground">Phường/Xã *</label>
                <input id="ward" name="ward" required maxLength={200} className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="city" className="text-sm font-semibold text-foreground">Tỉnh/Thành phố *</label>
                <input id="city" name="city" required maxLength={200} className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
              </div>
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-foreground">Phương thức thanh toán *</legend>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input type="radio" name="paymentMethod" value="COD" defaultChecked className="cursor-pointer" />
              Thanh toán khi nhận hàng (COD)
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input type="radio" name="paymentMethod" value="BANK_TRANSFER" className="cursor-pointer" />
              Chuyển khoản ngân hàng (quét mã QR ở bước xác nhận)
            </label>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerNote" className="text-sm font-semibold text-foreground">Ghi chú (không bắt buộc)</label>
            <textarea id="customerNote" name="customerNote" maxLength={2000} rows={3} placeholder="Ghi chú cho đơn hàng, ví dụ giờ giao hàng thuận tiện..." className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
          </div>

          {state.status === 'error' && <p className="text-sm font-medium text-destructive">{state.message}</p>}

          <StorefrontButton type="submit" variant="accent" disabled={state.status === 'submitting' || items.length === 0} className="w-full">
            {state.status === 'submitting' ? 'Đang đặt hàng...' : 'Xác nhận đặt hàng'}
          </StorefrontButton>
        </form>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs md:col-span-1">
          <p className="text-sm font-semibold text-foreground">Đơn hàng của bạn</p>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div key={item.variantId} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.productName} × {item.quantity}</span>
                <span className="font-medium text-foreground">{formatVnd(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
            <span>Tạm tính</span>
            <span>{formatVnd(subtotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Số tiền chính xác sẽ được xác nhận lại ở trang kế tiếp — giá có thể thay đổi nếu admin cập nhật giá sau khi bạn thêm vào giỏ.</p>
        </div>
      </div>
    </div>
  );
}
