import type { MetadataRoute } from 'next';
import { listAllActiveProductSlugs } from '@/services/storefront-catalog.service';
import { listAllPublishedPostSlugs } from '@/services/blog.service';

// Only public, indexable routes — never list /admin/* here (phase-7.md decision #6). No
// per-category route: `/products` only filters by `type` (READY_STOCK/MADE_TO_ORDER) and search,
// there is no dedicated category URL to list, so category rows aren't emitted here either.
//
// Each entry is emitted for both locales (phase-18.md decision #7): VI unprefixed (matches
// `localePrefix: 'as-needed'`) and EN under `/en`. This does not claim every EN URL has
// translated content yet — pages outside Phase 18's content slice still render Vietnamese under
// `/en` (see <UntranslatedNotice />) but are still the same canonical page worth indexing once.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  const [products, posts] = await Promise.all([
    listAllActiveProductSlugs(),
    listAllPublishedPostSlugs(),
  ]);

  type RouteEntry = { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number; lastModified?: Date };

  const routes: RouteEntry[] = [
    { path: '/', changeFrequency: 'daily', priority: 1 },
    { path: '/products', changeFrequency: 'daily', priority: 0.8 },
    { path: '/custom-print', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/custom-print/tao-mau-khac-ten', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/blog', changeFrequency: 'daily', priority: 0.6 },
    { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.2 },
    { path: '/shipping-policy', changeFrequency: 'yearly', priority: 0.2 },
    { path: '/return-policy', changeFrequency: 'yearly', priority: 0.2 },
    { path: '/file-confidentiality-policy', changeFrequency: 'yearly', priority: 0.2 },
    ...products.map((product) => ({
      path: `/products/${product.slug}`, changeFrequency: 'weekly' as const, priority: 0.7, lastModified: new Date(product.updatedAt),
    })),
    ...posts.map((post) => ({
      path: `/blog/${post.slug}`, changeFrequency: 'monthly' as const, priority: 0.5, lastModified: new Date(post.publishedAt),
    })),
  ];

  return routes.flatMap((route) => ([
    { url: `${siteUrl}${route.path}`, changeFrequency: route.changeFrequency, priority: route.priority, ...(route.lastModified ? { lastModified: route.lastModified } : {}) },
    { url: `${siteUrl}/en${route.path === '/' ? '' : route.path}`, changeFrequency: route.changeFrequency, priority: route.priority * 0.9, ...(route.lastModified ? { lastModified: route.lastModified } : {}) },
  ]));
}
