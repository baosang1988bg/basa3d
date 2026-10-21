'use client';

import { MessageCircle } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { trackContactClick } from '@/lib/analytics';

export function ZaloFloatingButton() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
      <a
        href={SITE_CONFIG.zaloUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat Zalo tư vấn 24/7"
        onClick={() => trackContactClick('zalo', 'floating_button')}
        className="group relative flex size-14 items-center justify-center rounded-full bg-[#0068FF] text-white shadow-lg transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0068FF] focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0"
      >
        {/* Phase 43: slow, faint ripple (2.4s) instead of Tailwind's animate-ping (1s, harsh — and the old
            `duration-1000` never changed it: it sets transition-duration, not the animation's). Hidden
            entirely for reduced motion. */}
        <span aria-hidden className="absolute inset-0 hidden rounded-full bg-[#0068FF] motion-safe:block motion-safe:animate-soft-ping" />
        
        {/* Zalo Icon / Message Icon */}
        <MessageCircle className="relative size-7 fill-white/10 stroke-[2.25]" />

        {/* Hover Tooltip */}
        <span className="absolute right-16 hidden whitespace-nowrap rounded-lg bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-md border border-border group-hover:block sm:inline-block">
          💬 Zalo tư vấn báo giá
        </span>
      </a>
    </div>
  );
}
