import type { ReactNode } from 'react';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';

/**
 * Phase 45: tools that mirror a reference app 1:1 fill the whole viewport, like the reference — no shared
 * tools header. The viewport size matters: OrbitControls scales rotate/zoom by the canvas height, so a
 * header would make the same drag feel different. Same URL space as `(tools)` (`/tools/...`).
 */
export default async function FullscreenToolsLayout({ children, params }: { children: ReactNode; params: LocaleParams }) {
  await applyRequestLocale(params);
  return <main className="min-h-dvh">{children}</main>;
}
