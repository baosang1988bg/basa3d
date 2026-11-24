import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { VERSION_LABEL } from '@/config/build-info';

// metadataBase turns every relative `alternates.canonical`/`openGraph.images` in child routes'
// generateMetadata into an absolute URL (Next.js requires this for correct <link rel="canonical">
// and og:image tags) — falls back to localhost so `next build` doesn't warn when
// NEXT_PUBLIC_SITE_URL isn't set yet in dev.
export const metadata: Metadata = {
  // QA-017: the fallback for every page without its own metadata — was English ("3D-printing business platform").
  title: 'BaSa3D — Xưởng in 3D theo yêu cầu',
  description: 'Xưởng in 3D BaSa3D: in theo file STL/3MF hoặc link MakerWorld, báo giá nhanh, mô hình, móc khoá khắc tên và phụ kiện in sẵn. Giao hàng toàn quốc.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  // Phase 44: <meta name="app-version"> on every page — view-source tells which build served it.
  other: { 'app-version': VERSION_LABEL },
};

// Phase 42 (ADR-0045): pass-through root layout (next-intl's documented pattern). It must NOT read
// the request (getLocale/headers/cookies) — doing so made every route dynamic and defeated all
// page caching. <html>/<body> are rendered by HtmlShell in `[locale]/layout.tsx`,
// `admin/layout.tsx` and `not-found.tsx`. A root layout file is still required because
// `app/not-found.tsx` lives at this level.
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
