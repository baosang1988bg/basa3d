import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { themeBootstrapScript } from '@/lib/theme-script';

const headingFont = Plus_Jakarta_Sans({ subsets: ['latin', 'vietnamese'], weight: ['600', '700', '800'], variable: '--font-heading' });
const bodyFont = Inter({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600'], variable: '--font-sans' });

export const metadata: Metadata = { title: 'BaSa3D', description: '3D-printing business platform' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={cn('font-sans', headingFont.variable, bodyFont.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="[font-feature-settings:'tnum']">{children}</body>
    </html>
  );
}
