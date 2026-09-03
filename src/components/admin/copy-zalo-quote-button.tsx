'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export type CopyZaloQuoteModelSummary = {
  title: string;
  totalPrintMinutes: number;
  platesCount: number;
  colorsCount: number;
};

function formatVnd(value: number): string {
  return value.toLocaleString('vi-VN');
}

// Phase 13 decision #5 — exact message template (bracketed values filled in). One deliberate
// deviation from the literal template text, flagged in the phase-13 delivery report: decision #4
// requires the link Staff pastes into Zalo to carry `?token=...` so the customer's first open shows
// full detail with no further phone-suffix challenge — the template line 3 as literally written has
// no token placeholder, which would be inconsistent with decision #4's whole reason for minting a
// token at all. We append it when present rather than silently dropping the mechanism.
function buildZaloMessage(input: { quoteNumber: string; totalVnd: number; depositVnd: number; model: CopyZaloQuoteModelSummary | null; token: string | null }): string {
  const modelTitle = input.model?.title ?? 'sản phẩm theo yêu cầu';
  const printTimeLine = input.model
    ? `- Thời gian in: ${Math.round((input.model.totalPrintMinutes / 60) * 10) / 10} giờ (${input.model.platesCount} plates, ${input.model.colorsCount} màu)\n`
    : '';
  const link = `https://basa3d.vn/quotes/${input.quoteNumber}${input.token ? `?token=${encodeURIComponent(input.token)}` : ''}`;
  return `Dạ BaSa3D xin gửi bạn Báo giá chi tiết cho mẫu ${modelTitle}:\n`
    + printTimeLine
    + `- Tổng chi phí: ${formatVnd(input.totalVnd)}đ (Cọc trước 50%: ${formatVnd(input.depositVnd)}đ)\n`
    + `- Xem chi tiết & thông số in tại: ${link}\n`
    + `BaSa3D sẽ tiến hành lên máy ngay sau khi nhận được xác nhận từ bạn ạ!`;
}

export function CopyZaloQuoteButton({ quoteNumber, totalVnd, depositVnd, model, token = null }: {
  quoteNumber: string;
  totalVnd: number;
  depositVnd: number;
  model: CopyZaloQuoteModelSummary | null;
  token?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const message = buildZaloMessage({ quoteNumber, totalVnd, depositVnd, model, token });
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard API can be unavailable (non-HTTPS/legacy browser) — fail silently, no crash.
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
      {copied ? 'Đã copy!' : 'Copy tin nhắn Zalo'}
    </Button>
  );
}
