import type { MetadataRoute } from 'next';
import { listAllActiveProductSlugs } from '@/services/storefront-catalog.service';
import { listAllPublishedPostSlugs } from '@/services/blog.service';

// Only public, indexable routes — never list /admin/* here (phase-7.md decision #6). No
// per-category route: `/products` only filters by `type` (READY_STOCK/MADE_TO_ORDER) and search,
// there is no dedicated category URL to list, so category rows aren't emitted here either.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  const [products, posts] = await Promise.all([
    listAllActiveProductSlugs(),
    listAllPublishedPostSlugs(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/products`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/custom-print`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/blog`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${siteUrl}/privacy-policy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/shipping-policy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/return-policy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/file-confidentiality-policy`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/products/${product.slug}`, lastModified: new Date(product.updatedAt), changeFrequency: 'weekly', priority: 0.7,
  }));
  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`, lastModified: new Date(post.publishedAt), changeFrequency: 'monthly', priority: 0.5,
  }));

  return [...staticRoutes, ...productRoutes, ...postRoutes];
}
