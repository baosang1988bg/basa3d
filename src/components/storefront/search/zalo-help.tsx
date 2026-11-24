'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { trackContactClick } from '@/lib/analytics';

/**
 * Owner feedback 2026-11-25 — "user chưa tìm được thứ mình cần thì sao": every search dialog ends with a
 * human fallback. Opens BaSa3D's Zalo; the customer sends a photo or description and the shop finds the model.
 */
export function ZaloHelpBox({ placement }: { placement: string }) {
  const t = useTranslations('headerSearch');
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#0068FF]/25 bg-[#0068FF]/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">{t('zaloTitle')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('zaloText')}</p>
      </div>
      <a
        href={SITE_CONFIG.zaloUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackContactClick('zalo', placement)}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0068FF] px-4 text-sm font-semibold text-white hover:bg-[#0055D4]"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {t('zaloButton')}
      </a>
    </div>
  );
}

/** "How it works" strip shown at the top of the header search so first-time users know what the tabs are for. */
export function SearchHowItWorks() {
  const t = useTranslations('headerSearch');
  const steps = [t('step1'), t('step2'), t('step3')];
  return (
    <ol className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step} className="flex items-start gap-2 rounded-lg bg-secondary/50 px-2.5 py-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{index + 1}</span>
          <span className="leading-snug">{step}</span>
        </li>
      ))}
    </ol>
  );
}
