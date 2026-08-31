import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { listPublishedPosts } from '@/services/blog.service';

export const metadata: Metadata = {
  title: 'Blog — BaSa3D',
  description: 'Kiến thức in 3D, mẫu mới, và tin tức từ xưởng in 3D BaSa3D.',
};

// Blog posts change independent of any request-time input, but publishing is a manual admin action
// rather than something readers trigger — force-dynamic keeps a freshly PUBLISHED post visible
// immediately without waiting for a rebuild, same reasoning as the homepage's featured products.
export const dynamic = 'force-dynamic';

export default async function BlogListPage() {
  const { items: posts } = await listPublishedPosts({ limit: 20 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">Blog</h1>
      <p className="mt-2 text-muted-foreground">Kiến thức in 3D, mẫu mới, và tin tức từ BaSa3D.</p>

      {posts.length === 0 ? (
        <p className="mt-16 text-center text-muted-foreground">Chưa có bài viết nào.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-colors duration-150 hover:border-primary/50">
              <div className="aspect-video overflow-hidden bg-muted/50">
                {post.coverImageUrl ? (
                  <Image src={post.coverImageUrl} alt={post.title} width={400} height={225} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-muted-foreground">BaSa3D</div>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-heading text-base font-semibold text-foreground">{post.title}</h2>
                {post.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString('vi-VN')}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
