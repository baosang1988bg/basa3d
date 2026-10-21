import '@/app/globals.css';
import type { ReactNode } from 'react';
import { Space_Grotesk, Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { themeBootstrapScript } from '@/lib/theme-script';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { VisualAiInspector } from '@/components/dev/visual-ai-inspector';
import { EnvironmentBadge } from './environment-badge';

const headingFont = Space_Grotesk({ subsets: ['latin', 'vietnamese'], weight: ['500', '600', '700'], variable: '--font-heading' });
const bodyFont = Inter({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600'], variable: '--font-sans' });

// Phase 42 (ADR-0045): the <html>/<body> document shell used to live in src/app/layout.tsx, which
// had to call getLocale() (reads a middleware header) to set `lang` — that single call forced every
// route in the app to render dynamically. The root layout is now a pass-through and each top-level
// area renders this shell itself with a `lang` it already knows without reading the request:
// `[locale]/layout.tsx` (from route params), `admin/layout.tsx` ('vi'), and `not-found.tsx`.
export function HtmlShell({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <html lang={lang} className={cn('font-sans', headingFont.variable, bodyFont.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="[font-feature-settings:'tnum']" suppressHydrationWarning>
        {children}
        <GoogleAnalytics />
        {/* Phase 44: PREVIEW/DEV tag on non-production builds; renders nothing in production. */}
        <EnvironmentBadge />
        {process.env.NODE_ENV === 'development' ? <VisualAiInspector /> : null}
      </body>
    </html>
  );
}
