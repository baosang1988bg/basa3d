import { isBaoGiaEnabled } from '@/config/bao-gia';
import type { HandbookToolId } from './types';

// B1 (phase-50 review): the single place where a chapter's `toolId` becomes a URL. Every href here
// must match a real page.tsx (asserted in tests/phase-50-handbook.test.ts) — `/tools/keychain`
// never existed; the multi-colour keychain tool is `/tools/keychain-blocks`.
export const HANDBOOK_TOOL_ROUTES: Record<HandbookToolId, { href: string; ctaLabel: string }> = {
  'bao-gia': { href: '/bao-gia', ctaLabel: 'Báo giá tức thì theo file' },
  organizer: { href: '/tools/organizer', ctaLabel: 'Mở công cụ Khay phân loại' },
  'keychain-blocks': { href: '/tools/keychain-blocks', ctaLabel: 'Thiết kế móc khoá nhiều màu' },
  'hinge-box': { href: '/tools/hinge-box', ctaLabel: 'Tạo hộp bản lề in liền' },
  'custom-print': { href: '/custom-print', ctaLabel: 'Gửi yêu cầu in riêng' },
};

export type ResolvedToolLink = { toolId: HandbookToolId; href: string; ctaLabel: string; isFallback: boolean };

/**
 * `/bao-gia` is behind NEXT_PUBLIC_BAO_GIA_ENABLED. When it is off, the callout falls back to
 * `/custom-print` instead of linking to a 404. Evaluated at build time for this SSG page, same as
 * the header link (the flag is NEXT_PUBLIC_, so changing it already requires a redeploy).
 */
export function resolveHandbookToolLink(
  toolId: HandbookToolId,
  { baoGiaEnabled = isBaoGiaEnabled() }: { baoGiaEnabled?: boolean } = {},
): ResolvedToolLink {
  if (toolId === 'bao-gia' && !baoGiaEnabled) {
    return { toolId: 'custom-print', ...HANDBOOK_TOOL_ROUTES['custom-print'], isFallback: true };
  }
  return { toolId, ...HANDBOOK_TOOL_ROUTES[toolId], isFallback: false };
}
