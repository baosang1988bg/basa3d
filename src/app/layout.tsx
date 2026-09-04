import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import { cn } from '@/lib/utils';
import { themeBootstrapScript } from '@/lib/theme-script';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';

const headingFont = Plus_Jakarta_Sans({ subsets: ['latin', 'vietnamese'], weight: ['600', '700', '800'], variable: '--font-heading' });
const bodyFont = Inter({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600'], variable: '--font-sans' });

// metadataBase turns every relative `alternates.canonical`/`openGraph.images` in child routes'
// generateMetadata into an absolute URL (Next.js requires this for correct <link rel="canonical">
// and og:image tags) — falls back to localhost so `next build` doesn't warn when
// NEXT_PUBLIC_SITE_URL isn't set yet in dev.
export const metadata: Metadata = {
  title: 'BaSa3D', description: '3D-printing business platform',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // `/admin/**` and `/api/**` never go through the locale middleware (middleware.ts branches
  // them away from next-intl entirely), so getLocale() falls back to the default 'vi' there —
  // exactly the "admin stays Vietnamese-only" behavior phase-18.md requires.
  const locale = await getLocale();

  return (
    <html lang={locale} className={cn('font-sans', headingFont.variable, bodyFont.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="[font-feature-settings:'tnum']">
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
