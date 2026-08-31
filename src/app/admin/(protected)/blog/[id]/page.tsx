import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/admin/markdown-editor';
import { getBlogPostById, listBlogCategories } from '@/services/blog.service';
import { updateBlogPostAction } from '../actions';

export default async function BlogPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, categories] = await Promise.all([getBlogPostById(id), listBlogCategories()]);
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{post.title}</h1>
        <Badge variant={post.status === 'PUBLISHED' ? 'default' : 'secondary'}>{post.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Chỉnh sửa bài viết</CardTitle></CardHeader>
        <CardContent>
          <form action={updateBlogPostAction.bind(null, id)} encType="multipart/form-data" className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Tiêu đề</Label>
              <Input id="title" name="title" required defaultValue={post.title} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" required defaultValue={post.slug} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoryId">Danh mục</Label>
              <select id="categoryId" name="categoryId" defaultValue={post.categoryId ?? ''} className="h-10 cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— Không danh mục —</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Trạng thái</Label>
              <select id="status" name="status" defaultValue={post.status} className="h-10 cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="DRAFT">DRAFT (nháp)</option>
                <option value="PUBLISHED">PUBLISHED (đăng)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tags">Tags (phân cách bằng dấu phẩy)</Label>
              <Input id="tags" name="tags" defaultValue={post.tags.join(', ')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="coverImage">Đổi ảnh bìa (để trống nếu giữ nguyên)</Label>
              <input id="coverImage" name="coverImage" type="file" accept="image/*" className="cursor-pointer text-sm" />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="excerpt">Mô tả ngắn</Label>
              <Input id="excerpt" name="excerpt" maxLength={500} defaultValue={post.excerpt ?? ''} />
            </div>
            <div className="col-span-2">
              <MarkdownEditor name="content" defaultValue={post.content} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoTitle">SEO title</Label>
              <Input id="seoTitle" name="seoTitle" maxLength={200} defaultValue={post.seoTitle ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoDescription">SEO description</Label>
              <Input id="seoDescription" name="seoDescription" maxLength={500} defaultValue={post.seoDescription ?? ''} />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="cursor-pointer">Lưu thay đổi</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
