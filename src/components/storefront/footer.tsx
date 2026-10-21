import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SITE_CONFIG } from '@/config/site';
import { ContactLink } from './contact-link';

// Phase 43: the underline fades in with the colour (text-decoration-color only — no layout shift).
const FOOTER_LINK_CLASS = 'cursor-pointer text-muted-foreground underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color] duration-200 hover:text-foreground hover:decoration-current';

export function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <Link href="/home" className="inline-flex cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <Image src="/brand/basa3d-logo-full.png" alt={t('logoAlt', { name: SITE_CONFIG.name })} width={1386} height={600} className="h-12 w-auto" />
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">{SITE_CONFIG.description}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('hotline')}:{' '}
            <ContactLink href={SITE_CONFIG.zaloUrl} channel="zalo" placement="footer" target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">
              {SITE_CONFIG.zaloPhone}
            </ContactLink>
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t('commitmentsTitle')}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>{t('commitment1')}</li>
            <li>{t('commitment2')}</li>
            <li>{t('commitment3')}</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t('linksTitle')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/products" className={FOOTER_LINK_CLASS}>{tNav('products')}</Link></li>
            <li><Link href="/custom-print" className={FOOTER_LINK_CLASS}>{t('customPrint')}</Link></li>
            {SITE_CONFIG.blogEnabled && (
              <li><Link href="/blog" className={FOOTER_LINK_CLASS}>{tNav('blog')}</Link></li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t('policiesTitle')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/privacy-policy" className={FOOTER_LINK_CLASS}>{t('privacyPolicy')}</Link></li>
            <li><Link href="/shipping-policy" className={FOOTER_LINK_CLASS}>{t('shippingPolicy')}</Link></li>
            <li><Link href="/return-policy" className={FOOTER_LINK_CLASS}>{t('returnPolicy')}</Link></li>
            <li><Link href="/file-confidentiality-policy" className={FOOTER_LINK_CLASS}>{t('fileConfidentialityPolicy')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">{t('copyright', { year: new Date().getFullYear() })}</div>
    </footer>
  );
}
