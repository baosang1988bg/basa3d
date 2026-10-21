import { revalidateTag } from 'next/cache';

// Phase 42 (ADR-0045). Imported by the services' write paths — must not import any service itself
// (storefront-cache.ts does, and importing that from a service would create an import cycle).
export const STOREFRONT_CATALOG_TAG = 'storefront-catalog';
export const STOREFRONT_CATALOG_TTL_SECONDS = 60;

// Best-effort by design: call it only AFTER the write's transaction has committed (invalidating
// earlier lets a concurrent request re-cache pre-commit data). It never throws — the data is
// already committed and failing the caller now would only make it retry a successful write.
// Outside a Next.js request (node:test calling services directly) revalidateTag throws a
// "static generation store missing" invariant; that case is expected and silent.
export function invalidateStorefrontCatalog(): void {
  try {
    revalidateTag(STOREFRONT_CATALOG_TAG);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('static generation store missing')) return;
    console.warn(`[storefront-cache] revalidateTag(${STOREFRONT_CATALOG_TAG}) failed; entries expire within ${STOREFRONT_CATALOG_TTL_SECONDS}s`, message);
  }
}

// Wraps a write whose promise resolves only after COMMIT (withTransaction) so the invalidation runs
// after the data is durable, and never on a rolled-back write (a rejection skips it).
export async function invalidatesStorefrontCatalog<T>(committedWrite: Promise<T>): Promise<T> {
  const result = await committedWrite;
  invalidateStorefrontCatalog();
  return result;
}
