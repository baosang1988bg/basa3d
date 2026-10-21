import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Phone } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';

// Lives at the app root (not inside the (storefront) route group), so it renders for any
// completely unmatched path without the storefront Header/Footer — kept intentionally minimal
// rather than duplicating that component tree for a 404 edge case.
export default function NotFound() {
  const t = useTranslations('notFound');
  const hotline = SITE_CONFIG.hotline;
  const cleansedHotline = hotline.replace(/[^\d+]/g, '');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-heading text-6xl font-extrabold text-foreground">404</p>
      <h1 className="font-heading text-xl font-bold text-foreground">{t('title')}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t('description')}</p>
      
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link 
          href="/" 
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
        >
          {t('backHome')}
        </Link>
        
        <a
          href={`tel:${cleansedHotline}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
        >
          <Phone className="h-4 w-4" />
          {t('callHotline', { hotline })}
        </a>
      </div>
    </div>
  );
}
