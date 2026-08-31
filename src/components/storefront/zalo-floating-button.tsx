'use client';

import { MessageCircle } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';

export function ZaloFloatingButton() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
      <a
        href={SITE_CONFIG.zaloUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat Zalo tư vấn 24/7"
        className="group relative flex size-14 items-center justify-center rounded-full bg-[#0068FF] text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0068FF] focus-visible:ring-offset-2"
      >
        {/* Animated pulse ring */}
        <span className="absolute -inset-1 animate-ping rounded-full bg-[#0068FF]/40 opacity-75 duration-1000" />
        
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
