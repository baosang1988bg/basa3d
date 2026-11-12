import { formatPhoneNumber } from '@/lib/format';

function sanitizePhoneNumber(val?: string): string {
  if (!val || val === '0333638698' || val === '0333698638') return '0333 698 638';
  return formatPhoneNumber(val);
}

function sanitizeZaloUrl(val?: string): string {
  if (!val || val.includes('363869')) return 'https://zalo.me/84333698638';
  return val;
}

export const SITE_CONFIG = {
  name: 'BaSa3D',
  description: 'Dịch vụ in 3D chuyên nghiệp & Sản phẩm độc đáo',
  zaloPhone: sanitizePhoneNumber(process.env.NEXT_PUBLIC_ZALO_PHONE),
  zaloUrl: sanitizeZaloUrl(process.env.NEXT_PUBLIC_ZALO_URL),
  hotline: sanitizePhoneNumber(process.env.NEXT_PUBLIC_HOTLINE),
  // Messenger: no Fanpage created yet, so left empty on purpose — an m.me link only works
  // reliably for a Facebook Page, not a personal profile. Once a Fanpage exists, set this to
  // https://m.me/<fanpage-username> and the contact CTA will pick it up automatically.
  messengerUrl: process.env.NEXT_PUBLIC_MESSENGER_URL || '',
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL || '',
  tiktokUrl: process.env.NEXT_PUBLIC_TIKTOK_URL || '',
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || '',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'basa3d.vn@gmail.com',
  address: 'Hồ Chí Minh, Việt Nam',
  // Blog link temporarily hidden while no published articles exist. Flip
  // NEXT_PUBLIC_BLOG_ENABLED=true to restore the /blog link in navigation.
  blogEnabled: process.env.NEXT_PUBLIC_BLOG_ENABLED === 'true',
  // EN temporarily switched off as a whole — flip NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED=true (and
  // rebuild) to restore the Header VI/EN toggle, the Organizer toggle, `/en/*` routing, EN sitemap
  // entries and hreflang. Routing reads the same env var via isEnglishEnabled in src/i18n/routing.ts.
  languageSwitcherEnabled: process.env.NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED === 'true',
};
