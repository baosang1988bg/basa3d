import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SITE_CONFIG } from '@/config/site';
import { ContactLink } from './contact-link';

export function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <p className="font-heading text-lg font-bold text-foreground">{SITE_CONFIG.name}</p>
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
            <li><Link href="/products" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">{tNav('products')}</Link></li>
            <li><Link href="/custom-print" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">{t('customPrint')}</Link></li>
            <li><Link href="/blog" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">{tNav('blog')}</Link></li>
            <li><Link href="/admin/login" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">{t('adminLogin')}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t('policiesTitle')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/privacy-policy" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">{t('privacyPolicy')}</Link></li>
            <li><Link href="/shipping-policy" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">{t('shippingPolicy')}</Link></li>
            <li><Link href="/return-policy" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">{t('returnPolicy')}</Link></li>
            <li><Link href="/file-confidentiality-policy" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">{t('fileConfidentialityPolicy')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">{t('copyright', { year: new Date().getFullYear() })}</div>
    </footer>
  );
}
