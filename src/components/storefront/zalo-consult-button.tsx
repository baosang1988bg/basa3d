'use client';

import { useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { dispatchZaloConsult, type ConsultPayload } from '@/lib/zalo-consult';

export function ZaloConsultButton({
  payload,
  label = 'Liên hệ Zalo để tư vấn',
  hotlineHint,
  className = '',
}: {
  payload: ConsultPayload | (() => ConsultPayload);
  label?: string;
  hotlineHint?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const resolved = typeof payload === 'function' ? payload() : payload;
    const withUrl: ConsultPayload = {
      ...resolved,
      referenceUrl:
        resolved.referenceUrl ??
        (typeof window !== 'undefined' ? window.location.href : undefined),
    };
    const result = await dispatchZaloConsult(withUrl);
    if (result.copied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <a
        href={SITE_CONFIG.zaloUrl}
        target="_blank"
        rel="noreferrer"
        onClick={handleClick}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0068FF] px-4 py-2.5 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 sm:w-auto"
      >
        <MessageCircle className="size-4" />
        {copied ? 'Đã copy thông tin · Đang mở Zalo...' : label}
      </a>
      {copied ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="size-3.5" /> Đã sao chép thông tin vào bộ nhớ tạm! Bạn chỉ cần dán (Paste) vào Zalo.
        </p>
      ) : hotlineHint ? (
        <p className="text-sm text-muted-foreground">{hotlineHint}</p>
      ) : null}
    </div>
  );
}
