import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedPostBySlug } from '@/services/blog.service';
import { BlogArticleView } from '@/components/blog/blog-article-view';
import { SITE_CONFIG } from '@/config/site';
import { Breadcrumb } from '@/components/storefront/breadcrumb';
import { ReadBlogPostTracker } from '@/components/analytics/storefront-trackers';
import { serializeJsonLd } from '@/lib/json-ld';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};
  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt ?? undefined;
  return {
    title, description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title, description, type: 'article', ...(post.coverImageUrl ? { images: [post.coverImageUrl] } : {}) },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://basa3d.example.com';
  // Posts aren't attributed to an individual byline (created_by is a staff_profiles uuid, no
  // display name join) — author/publisher both resolve to the business itself via SITE_CONFIG,
  // not a fabricated person, same "real data only" rule as the LocalBusiness JSON-LD on the homepage.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    datePublished: post.publishedAt,
    url: `${siteUrl}/blog/${post.slug}`,
    author: { '@type': 'Organization', name: SITE_CONFIG.name },
    publisher: { '@type': 'Organization', name: SITE_CONFIG.name },
    ...(post.coverImageUrl ? { image: [post.coverImageUrl] } : {}),
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <ReadBlogPostTracker title={post.title} slug={post.slug} category={post.categoryName} />
      {/* JSON-LD built server-side; serializeJsonLd escapes `</script>` in staff-entered fields. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <Breadcrumb items={[{ label: 'Trang chủ', href: '/home' }, { label: 'Blog', href: '/blog' }, { label: post.title }]} />

      <BlogArticleView
        title={post.title}
        dateLabel={new Date(post.publishedAt).toLocaleDateString('vi-VN')}
        coverImageUrl={post.coverImageUrl}
        content={post.content}
        tags={post.tags}
        media={post.media}
      />
    </article>
  );
}
