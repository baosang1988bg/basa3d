'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { formatVnd } from '@/components/storefront/format';
import { SITE_CONFIG } from '@/config/site';
import { trackContactClick } from '@/lib/analytics';

export type ZaloOrderData = {
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  shippingAddress: {
    line1?: string;
    ward?: string;
    city?: string;
  } | Record<string, unknown>;
  paymentMethod: string;
  customerNote?: string | null;
  items: Array<{
    name: string;
    variantName?: string;
    sku?: string;
    quantity: number;
    price: number;
  }>;
  subtotal?: number;
  shippingFee?: number;
  discount?: number;
  total: number;
  confirmationUrl?: string;
};

export function buildZaloOrderMessage(order: ZaloOrderData): string {
  const addressParts = [
    typeof order.shippingAddress.line1 === 'string' ? order.shippingAddress.line1 : '',
    typeof order.shippingAddress.ward === 'string' ? order.shippingAddress.ward : '',
    typeof order.shippingAddress.city === 'string' ? order.shippingAddress.city : '',
  ].filter((part) => part.trim() !== '').join(', ');

  const paymentText = order.paymentMethod === 'BANK_TRANSFER'
    ? 'Chuyển khoản ngân hàng'
    : 'Thanh toán khi nhận hàng (COD)';

  const itemLines = order.items.map((item, index) => {
    const lineTotal = item.price * item.quantity;
    const variant = item.variantName ? ` (${item.variantName})` : '';
    const sku = item.sku ? ` [${item.sku}]` : '';
    return `${index + 1}. ${item.name}${variant}${sku}\n   • SL: ${item.quantity} × ${formatVnd(item.price)} = ${formatVnd(lineTotal)}`;
  }).join('\n');

  const lines = [
    'Chào BaSa3D, mình vừa đặt đơn hàng trên website:',
    order.orderNumber ? `📦 Mã đơn hàng: ${order.orderNumber}` : '',
    `👤 Khách hàng: ${order.customerName} - ${order.customerPhone}`,
    addressParts ? `📍 Địa chỉ nhận: ${addressParts}` : '',
    `💳 Thanh toán: ${paymentText}`,
    order.customerNote ? `📝 Ghi chú: ${order.customerNote}` : '',
    '',
    '🛒 Danh sách sản phẩm:',
    itemLines,
    '',
    '--------------------------------',
    `💰 Tổng cộng: ${formatVnd(order.total)}`,
    order.confirmationUrl ? `🔗 Link đơn hàng: ${order.confirmationUrl}` : '',
    '',
    'Nhờ BaSa3D kiểm tra kho và xác nhận đơn hàng giúp mình nhé!',
  ];

  return lines.filter((line) => line !== undefined && line !== null && line !== '').join('\n');
}

export function OrderZaloAction({ order, className = '' }: { order: ZaloOrderData; className?: string }) {
  const [copied, setCopied] = useState(false);
  const message = buildZaloOrderMessage(order);

  async function handleCopy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      // Fallback
    }
  }

  return (
    <div className={`rounded-xl border-2 border-[#0068FF]/30 bg-card p-6 shadow-xs ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#0068FF]/10 text-[#0068FF]">
          <MessageCircle className="size-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Xác nhận đơn hàng qua Zalo</h2>
          <p className="text-xs text-muted-foreground">Nhắn tin Zalo với BaSa3D để được tư vấn, chốt thông số in và giao hàng nhanh nhất.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {copied && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-4 shrink-0" />
            <span>Đã sao chép nội dung đơn hàng vào bộ nhớ tạm! Bạn chỉ cần dán (Paste) vào Zalo.</span>
          </div>
        )}

        <div className="relative">
          <textarea
            readOnly
            value={message}
            rows={8}
            className="w-full resize-none rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground select-all focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Sao chép tin nhắn"
            className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-xs transition hover:bg-muted cursor-pointer"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          💡 <strong className="font-medium text-foreground">Hướng dẫn:</strong> Bấm nút <strong className="font-medium text-foreground">&quot;Mở Zalo chat&quot;</strong> bên dưới, sau đó nhấn <strong>Ctrl + V</strong> (hoặc <strong>Cmd + V</strong> trên Mac / <strong>Nhấn giữ &gt; Dán</strong> trên điện thoại) để gửi tin nhắn cho BaSa3D.
        </p>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <a
            href={SITE_CONFIG.zaloUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              trackContactClick('zalo', 'order_confirmation');
              handleCopy();
            }}
            className={storefrontButtonClasses('accent', 'w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0068FF] text-white hover:bg-[#0068FF]/90')}
          >
            <MessageCircle className="size-4" />
            Mở Zalo chat ({SITE_CONFIG.zaloPhone})
          </a>
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            className="w-full sm:w-auto cursor-pointer"
          >
            {copied ? <Check className="mr-1.5 size-4 text-emerald-600" /> : <Copy className="mr-1.5 size-4" />}
            {copied ? 'Đã sao chép tin nhắn' : 'Sao chép nội dung đơn'}
          </Button>
        </div>
      </div>
    </div>
  );
}
