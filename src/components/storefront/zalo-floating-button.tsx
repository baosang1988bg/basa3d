'use client';

import type { ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { trackContactClick } from '@/lib/analytics';

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.76 1.44-.04 2.73-1.01 3.07-2.4.11-.43.14-.88.14-1.32V.02z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.82 0-1.667.41-1.667 1.621v2.385h4.157l-.547 3.667h-3.61v7.98H9.101Z" />
    </svg>
  );
}

type FloatingItemConfig = {
  id: 'tiktok' | 'instagram' | 'facebook' | 'zalo';
  href?: string;
  ariaLabel: string;
  tooltip: string;
  bgClass: string;
  ringClass: string;
  sizeClass: string;
  icon: ReactNode;
  showRipple?: boolean;
  tooltipAlwaysVisibleOnDesktop?: boolean;
};

export function ZaloFloatingButton() {
  const items: FloatingItemConfig[] = [
    {
      id: 'tiktok',
      href: SITE_CONFIG.tiktokUrl,
      ariaLabel: 'TikTok BaSa3D',
      tooltip: '🎵 TikTok',
      bgClass: 'bg-black text-white hover:bg-neutral-900 border border-white/20',
      ringClass: 'focus-visible:ring-black',
      sizeClass: 'size-11 sm:size-12',
      icon: <TikTokIcon className="size-5" />,
    },
    {
      id: 'instagram',
      href: SITE_CONFIG.instagramUrl,
      ariaLabel: 'Instagram BaSa3D',
      tooltip: '📷 Instagram',
      bgClass: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white',
      ringClass: 'focus-visible:ring-[#ee2a7b]',
      sizeClass: 'size-11 sm:size-12',
      icon: <InstagramIcon className="size-5" />,
    },
    {
      id: 'facebook',
      href: SITE_CONFIG.facebookUrl || SITE_CONFIG.messengerUrl,
      ariaLabel: 'Facebook BaSa3D',
      tooltip: '📘 Facebook',
      bgClass: 'bg-[#1877F2] text-white hover:bg-[#166fe5]',
      ringClass: 'focus-visible:ring-[#1877F2]',
      sizeClass: 'size-11 sm:size-12',
      icon: <FacebookIcon className="size-5" />,
    },
    {
      id: 'zalo',
      href: SITE_CONFIG.zaloUrl,
      ariaLabel: 'Chat Zalo tư vấn 24/7',
      tooltip: '💬 Zalo tư vấn báo giá',
      bgClass: 'bg-[#0068FF] text-white hover:bg-[#005ce6]',
      ringClass: 'focus-visible:ring-[#0068FF]',
      sizeClass: 'size-14',
      icon: <MessageCircle className="relative size-7 fill-white/10 stroke-[2.25]" />,
      showRipple: true,
      tooltipAlwaysVisibleOnDesktop: true,
    },
  ];

  return (
    <aside
      aria-label="Kênh liên hệ mạng xã hội"
      className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2.5"
    >
      {items.map((item) => {
        const hasLink = Boolean(item.href);
        const commonClasses = `group relative flex ${item.sizeClass} items-center justify-center rounded-full ${item.bgClass} shadow-lg transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${item.ringClass} focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 cursor-pointer select-none`;

        const content = (
          <>
            {/* Phase 43: slow, faint ripple (2.4s) instead of Tailwind's animate-ping (1s, harsh). Hidden for reduced motion. */}
            {item.showRipple && (
              <span
                aria-hidden
                className="absolute inset-0 hidden rounded-full bg-[#0068FF] motion-safe:block motion-safe:animate-soft-ping"
              />
            )}

            {item.icon}

            {/* Hover Tooltip */}
            <span
              className={`pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 hidden whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-md group-hover:block ${
                item.tooltipAlwaysVisibleOnDesktop ? 'sm:inline-block' : ''
              }`}
            >
              {item.tooltip}
            </span>
          </>
        );

        if (hasLink) {
          return (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              aria-label={item.ariaLabel}
              onClick={() => trackContactClick(item.id, 'floating_button')}
              className={commonClasses}
            >
              {content}
            </a>
          );
        }

        return (
          <span
            key={item.id}
            role="button"
            tabIndex={0}
            aria-label={item.ariaLabel}
            onClick={() => trackContactClick(item.id, 'floating_button')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                trackContactClick(item.id, 'floating_button');
              }
            }}
            className={commonClasses}
          >
            {content}
          </span>
        );
      })}
    </aside>
  );
}
