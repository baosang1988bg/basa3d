'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone } from 'lucide-react';

export type NotFoundMessages = { title: string; description: string; backHome: string; callHotline: string };

// Phase 42 (ADR-0045): Next.js serializes the root not-found boundary into EVERY page's render, so it
// must not read the request on the server (useTranslations/useLocale there fall back to the
// middleware header and turned every storefront page dynamic). The locale is taken from the URL in
// the browser instead; both message sets arrive as props from src/app/not-found.tsx.
// Unmatched URLs are answered with the one prerendered /_not-found page (built for the default
// 'vi'), so the language is switched after mount — reading it during render would make the server
// HTML and the first client render disagree (hydration mismatch) on /en/... 404s.
export function NotFoundContent({ messages, hotline }: { messages: Record<'vi' | 'en', NotFoundMessages>; hotline: string }) {
  const [locale, setLocale] = useState<'vi' | 'en'>('vi');
  const t = messages[locale];
  const cleansedHotline = hotline.replace(/[^\d+]/g, '');

  useEffect(() => {
    const pathname = window.location.pathname;
    const detected = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'vi';
    setLocale(detected);
    document.documentElement.lang = detected;
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-heading text-6xl font-extrabold text-foreground">404</p>
      <h1 className="font-heading text-xl font-bold text-foreground">{t.title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t.description}</p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
        >
          {t.backHome}
        </Link>

        <a
          href={`tel:${cleansedHotline}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
        >
          <Phone className="h-4 w-4" />
          {t.callHotline.replace('{hotline}', hotline)}
        </a>
      </div>
    </div>
  );
}
