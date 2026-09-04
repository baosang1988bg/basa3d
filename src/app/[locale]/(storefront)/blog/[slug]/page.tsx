import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getPublishedPostBySlug } from '@/services/blog.service';
import { MARKDOWN_PROSE_CLASSES } from '@/lib/markdown';
import { SITE_CONFIG } from '@/config/site';
import { Breadcrumb } from '@/components/storefront/breadcrumb';
import { ReadBlogPostTracker } from '@/components/analytics/storefront-trackers';

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
      {/* Static JSON-LD constructed server-side from our own data, not user input rendered as HTML. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Blog', href: '/blog' }, { label: post.title }]} />

      {post.coverImageUrl && (
        <div className="aspect-video overflow-hidden rounded-xl bg-muted/50">
          <Image src={post.coverImageUrl} alt={post.title} width={800} height={450} className="size-full object-cover" priority />
        </div>
      )}

      <h1 className="font-heading mt-6 text-2xl font-bold text-foreground md:text-[2rem]">{post.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString('vi-VN')}</p>

      <div className={`mt-6 text-base text-foreground ${MARKDOWN_PROSE_CLASSES}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </div>

      {post.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">#{tag}</span>
          ))}
        </div>
      )}
    </article>
  );
}
