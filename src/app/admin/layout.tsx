import type { ReactNode } from 'react';
import { HtmlShell } from '@/components/layout/html-shell';

// Phase 42 (ADR-0045): admin renders its own document shell now that the root layout is a
// pass-through. Admin stays Vietnamese-only (phase-18.md) and never goes through the locale
// middleware, so `lang` is fixed rather than read from the request.
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <HtmlShell lang="vi">{children}</HtmlShell>;
}
