import { SITE_CONFIG } from '@/config/site';
import { HtmlShell } from '@/components/layout/html-shell';
import { NotFoundContent } from '@/components/storefront/not-found-content';
import viMessages from '../../messages/vi.json';
import enMessages from '../../messages/en.json';

// Lives at the app root (not inside the (storefront) route group), so it renders for any
// completely unmatched path without the storefront Header/Footer — kept intentionally minimal
// rather than duplicating that component tree for a 404 edge case.
//
// Phase 42 (ADR-0045): the root layout is a pass-through, so this boundary renders its own <html>
// shell (it sits outside `[locale]/layout.tsx`, so there is never a nested <html>). It must stay
// free of request reads (no getLocale/useTranslations/headers): Next.js renders this boundary as
// part of every page, and one request read here made the whole storefront dynamic. `lang` starts
// as the default 'vi'; NotFoundContent picks the language from the URL and corrects it.
export default function NotFound() {
  return (
    <HtmlShell lang="vi">
      <NotFoundContent messages={{ vi: viMessages.notFound, en: enMessages.notFound }} hotline={SITE_CONFIG.hotline} />
    </HtmlShell>
  );
}
