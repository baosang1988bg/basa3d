import Link from 'next/link';
import { Bot, CheckCircle2, ImageIcon, PencilLine, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BlogArticleView } from '@/components/blog/blog-article-view';
import { SourceImage } from '@/components/blog/source-media';
import { BlogReviewDecision } from '@/components/admin/blog-review-decision';
import { youtubeThumbnailUrl } from '@/lib/blog-media';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getBlogPostForReview, listDraftPostsForReview } from '@/services/blog.service';
import { approveBlogPostAction, rejectBlogDraftAction, updateBlogMediaSelectionAction } from './actions';

export const dynamic = 'force-dynamic';

// Phase 54.2 (ADR-0057): review queue — every DRAFT is checked here before it goes public.
export default async function BlogReviewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  // Phase 35 D1: never rely on the layout alone.
  await requireAdmin();
  const { id } = await searchParams;
  const drafts = await listDraftPostsForReview();
  const selectedId = drafts.find((draft) => draft.id === id)?.id ?? drafts[0]?.id;
  const post = selectedId ? await getBlogPostForReview(selectedId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Duyệt bài</h1>
          <p className="text-sm text-muted-foreground">Bài nháp (DRAFT) chỉ hiển thị công khai sau khi được duyệt ở đây.</p>
        </div>
        <Link href="/basaadmin/blog" className={buttonVariants({ variant: 'outline', size: 'sm' })}>← Quản lý blog</Link>
      </div>

      {drafts.length === 0 || !post ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="size-8 text-emerald-600" />
            <p className="font-medium">Không còn bài nào chờ duyệt.</p>
            <p className="text-sm text-muted-foreground">Bài điểm tin AI được tạo lúc 06:00 mỗi sáng, hoặc bấm “Quét tin tức hôm nay” ở trang Blog.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Danh sách bài chờ duyệt" className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chờ duyệt ({drafts.length})</p>
            {drafts.map((draft) => {
              const active = draft.id === post.id;
              return (
                <Link
                  key={draft.id}
                  href={`/basaadmin/blog/review?id=${draft.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col gap-1 rounded-lg border p-3 text-sm transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'}`}
                >
                  <span className="line-clamp-2 font-medium">{draft.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {draft.isAiNews ? <Badge variant="secondary" className="gap-1"><Bot className="size-3" />AI</Badge> : null}
                    {draft.mediaCount > 0 ? <span className="inline-flex items-center gap-1"><ImageIcon className="size-3" />{draft.mediaCount}</span> : null}
                    <span>{new Date(draft.createdAt).toLocaleString('vi-VN')}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-6">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">/blog/{post.slug}</p>
                  <p className="text-sm text-muted-foreground">{post.categoryName ?? 'Không danh mục'} · tạo lúc {new Date(post.createdAt).toLocaleString('vi-VN')}</p>
                  <Link href={`/basaadmin/blog/${post.id}`} className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <PencilLine className="size-4" /> Sửa nội dung trước khi duyệt
                  </Link>
                </div>
                <BlogReviewDecision
                  title={post.title}
                  approve={approveBlogPostAction.bind(null, post.id)}
                  reject={rejectBlogDraftAction.bind(null, post.id)}
                />
              </CardContent>
            </Card>

            {post.media.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Media từ nguồn tin ({post.media.filter((m) => m.selected).length}/{post.media.length} đang hiển thị)</CardTitle>
                  <p className="text-sm text-muted-foreground">Ảnh được hiển thị dạng thẻ có ghi nguồn và link bài gốc (không tải về). Bỏ chọn ảnh/video không liên quan.</p>
                </CardHeader>
                <CardContent>
                  <form action={updateBlogMediaSelectionAction.bind(null, post.id)} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {post.media.map((item) => (
                        <label key={item.id} className="flex cursor-pointer flex-col gap-1.5 rounded-lg border border-border p-2 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                          <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
                            <SourceImage
                              src={item.kind === 'youtube' ? youtubeThumbnailUrl(item.videoId) : item.url}
                              alt={item.caption ?? item.sourceName}
                              className="size-full object-cover"
                              fallback={<span className="flex size-full items-center justify-center text-muted-foreground">Ảnh không tải được</span>}
                            />
                            {item.kind === 'youtube' ? <PlayCircle className="absolute inset-0 m-auto size-10 text-white drop-shadow" /> : null}
                          </div>
                          <span className="flex items-center gap-2">
                            <input type="checkbox" name="media" value={item.id} defaultChecked={item.selected} className="size-4 accent-primary" />
                            <span className="font-medium">{item.kind === 'youtube' ? 'Video' : 'Ảnh'} · {item.sourceName}</span>
                          </span>
                          {item.caption ? <span className="line-clamp-2 text-muted-foreground">{item.caption}</span> : null}
                          <a href={item.kind === 'youtube' ? `https://www.youtube.com/watch?v=${item.videoId}` : item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            Mở {item.kind === 'youtube' ? 'video' : 'bài gốc'} ↗
                          </a>
                        </label>
                      ))}
                    </div>
                    <div>
                      <Button type="submit" variant="outline" size="sm" className="cursor-pointer">Lưu lựa chọn media</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Xem trước (giống trang công khai)</CardTitle></CardHeader>
              <CardContent>
                <article className="mx-auto max-w-3xl">
                  <BlogArticleView
                    title={post.title}
                    dateLabel={`Bản nháp · ${new Date(post.createdAt).toLocaleDateString('vi-VN')}`}
                    coverImageUrl={post.coverImageUrl}
                    content={post.content}
                    tags={post.tags}
                    media={post.media}
                  />
                </article>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
