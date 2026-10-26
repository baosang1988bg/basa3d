// Phase 50 — "Kiến thức in 3D" header dropdown. Imported by the (client) Header, so it must stay
// tiny: plain hrefs + message keys only. The `#anchor`s are handbook chapter ids; a test asserts
// each one exists in src/data/handbook/sections.ts (importing that file here would ship all nine
// chapters to every storefront page).

export type KnowledgeNavKey = 'handbook' | 'troubleshooting' | 'materials' | 'tolerances' | 'tools' | 'blog';

export type KnowledgeNavItem = { key: KnowledgeNavKey; href: string };

export const KNOWLEDGE_NAV_ITEMS: KnowledgeNavItem[] = [
  { key: 'handbook', href: '/cam-nang' },
  { key: 'troubleshooting', href: '/cam-nang#xu-ly-loi' },
  { key: 'materials', href: '/cam-nang#vat-lieu' },
  { key: 'tolerances', href: '/cam-nang#dung-sai' },
  { key: 'tools', href: '/tools' },
  { key: 'blog', href: '/blog' },
];

/** Items to show — the blog entry follows SITE_CONFIG.blogEnabled like the old top-level link. */
export function visibleKnowledgeNavItems({ blogEnabled }: { blogEnabled: boolean }): KnowledgeNavItem[] {
  return KNOWLEDGE_NAV_ITEMS.filter((item) => item.key !== 'blog' || blogEnabled);
}

/** The trigger shows as active on any page the dropdown leads to. */
export function isKnowledgeSectionActive(pathname: string): boolean {
  return pathname === '/cam-nang' || pathname.startsWith('/cam-nang/') || pathname === '/blog' || pathname.startsWith('/blog/');
}
