import { revalidateTag, unstable_cache } from 'next/cache';
import { getPublishedPostBySlug, listPublishedPosts } from '@/services/blog.service';

// Phase 56 — cross-request cache for the public blog reads, same pattern as storefront-cache.ts
// (Phase 42, ADR-0045). /blog and /blog/[slug] are force-dynamic and used to run their queries on
// every request with no rate limit, so a burst of anonymous traffic went straight to PostgreSQL.
// Services stay framework-free; only pages import these wrappers. Blog admin actions call
// invalidateBlogCache() after a write; the TTL is the safety net (cron-created drafts are not public,
// and a scheduled post appears at most BLOG_CACHE_TTL_SECONDS late).

export const BLOG_CACHE_TAG = 'blog-public';
export const BLOG_CACHE_TTL_SECONDS = 60;
const cacheOptions = { tags: [BLOG_CACHE_TAG], revalidate: BLOG_CACHE_TTL_SECONDS };

/** Slugs are generated as lower-case ASCII; anything else cannot exist, so it never reaches the DB. */
const BLOG_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BLOG_SLUG_MAX = 200;
export function isPlausibleBlogSlug(slug: string): boolean {
  return slug.length <= BLOG_SLUG_MAX && BLOG_SLUG_RE.test(slug);
}

// Bounded key space: the list page only ever asks for one size.
export const getCachedPublishedPosts = unstable_cache(
  (limit: number) => listPublishedPosts({ limit }),
  ['blog:listPublishedPosts'],
  cacheOptions,
);

// Unknown slugs are not cached (arbitrary URLs would each create an entry): the cached function
// throws for a miss — unstable_cache never stores a rejection — and the wrapper maps it back to null.
class BlogSlugMiss extends Error {}
type PublishedPost = NonNullable<Awaited<ReturnType<typeof getPublishedPostBySlug>>>;

const cachedPostBySlug = unstable_cache(
  async (slug: string): Promise<PublishedPost> => {
    const post = await getPublishedPostBySlug(slug);
    if (!post) throw new BlogSlugMiss(slug);
    return post;
  },
  ['blog:getPublishedPostBySlug'],
  cacheOptions,
);

export async function getCachedPublishedPostBySlug(slug: string): Promise<PublishedPost | null> {
  if (!isPlausibleBlogSlug(slug)) return null;
  try {
    return await cachedPostBySlug(slug);
  } catch (error) {
    if (error instanceof BlogSlugMiss) return null;
    throw error;
  }
}

/** Best-effort, never throws — call after the write has committed (see storefront-cache-tags.ts). */
export function invalidateBlogCache(): void {
  try {
    revalidateTag(BLOG_CACHE_TAG);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('static generation store missing')) return;
    console.warn(`[blog-cache] revalidateTag failed; entries expire within ${BLOG_CACHE_TTL_SECONDS}s`, message);
  }
}
