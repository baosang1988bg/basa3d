'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Globe, ExternalLink, Sparkles, ArrowRight, Link2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { cn } from '@/lib/utils';

export function MakerWorldDiscoveryBanner({ className }: { className?: string } = {}) {
  const t = useTranslations('products');
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState('');

  function handleQuickAnalyze(e: FormEvent) {
    e.preventDefault();
    const trimmed = inputUrl.trim();
    if (trimmed) {
      router.push(`/tools/makerworld-cn?url=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/tools/makerworld-cn');
    }
  }

  return (
    <section
      aria-labelledby="makerworld-discovery-title"
      className={cn(
        'mt-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm transition-all sm:p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        {/* Badges & Heading */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {t('makerworldDiscoveryBadge')}
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {t('makerworldDiscoveryNewTag')}
            </span>
          </div>

          <h2
            id="makerworld-discovery-title"
            className="font-heading mt-2.5 text-lg font-bold text-foreground sm:text-xl"
          >
            {t('makerworldDiscoveryTitle')}
          </h2>

          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t('makerworldDiscoveryDesc')}
          </p>
        </div>

        {/* Action Row: Direct Links & Tool Highlight Button */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Direct link Global */}
          <a
            href="https://makerworld.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          >
            <Globe className="size-4 text-primary" aria-hidden="true" />
            <span>{t('makerworldDirectGlobal')}</span>
            <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </a>

          {/* Direct link China */}
          <a
            href="https://makerworld.com.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          >
            <span className="text-base leading-none" aria-hidden="true">🇨🇳</span>
            <span>{t('makerworldDirectChina')}</span>
            <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </a>

          {/* New Tool Highlight CTA Button */}
          <Link
            href="/tools/makerworld-cn"
            className={cn(
              storefrontButtonClasses('primary'),
              'group gap-2 px-4 py-2 text-xs shadow-tactile sm:text-sm'
            )}
          >
            <Sparkles className="size-4 transition-transform group-hover:rotate-12 motion-reduce:group-hover:transform-none" aria-hidden="true" />
            <span>{t('makerworldOpenTool')}</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:transform-none" aria-hidden="true" />
          </Link>
        </div>

        {/* Quick Link Input Bar */}
        <div className="mt-1 border-t border-border/60 pt-4">
          <form onSubmit={handleQuickAnalyze} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder={t('makerworldInputPlaceholder')}
                className="h-10 w-full rounded-lg border border-input bg-background/80 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>
            <button
              type="submit"
              className={cn(
                storefrontButtonClasses('accent'),
                'h-10 px-4 py-0 text-xs font-semibold whitespace-nowrap sm:text-sm'
              )}
            >
              {t('makerworldAnalyzeBtn')}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
