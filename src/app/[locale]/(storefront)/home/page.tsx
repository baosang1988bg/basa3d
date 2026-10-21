export { default, metadata } from '../page';

// Route segment config must be a literal in this file — Next.js does not follow re-exports for it.
// Same value as ../page.tsx (Phase 42, ADR-0045).
export const revalidate = 60;
