'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { quoteHrefForModelUrl } from '@/lib/search/quote-link';
import { BAO_GIA_ENABLED_IN_BROWSER } from '@/config/bao-gia';

/**
 * ADR-0064 — "Đã tìm được mẫu? Dán link để báo giá". Always lands on the quote page /bao-gia (see
 * quoteHrefForModelUrl); falls back to the MakerWorld tool / custom-print only when /bao-gia is disabled.
 */
export function QuoteLinkBox({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('headerSearch');
  const router = useRouter();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const href = quoteHrefForModelUrl(value, { baoGiaEnabled: BAO_GIA_ENABLED_IN_BROWSER });
    if (!href) {
      setInvalid(true);
      return;
    }
    onNavigate?.();
    router.push(href);
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-primary/25 bg-primary/5 p-3">
      <label htmlFor="quote-link-input" className="text-xs font-semibold text-foreground">{t('quoteTitle')}</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="quote-link-input"
            type="url"
            inputMode="url"
            value={value}
            onChange={(event) => { setValue(event.target.value); setInvalid(false); }}
            placeholder={t('quotePlaceholder')}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'quote-link-error' : undefined}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <button type="submit" className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          {t('quoteButton')}
        </button>
      </div>
      {invalid ? <p id="quote-link-error" role="alert" className="mt-1.5 text-xs text-destructive">{t('quoteInvalid')}</p> : null}
    </form>
  );
}
