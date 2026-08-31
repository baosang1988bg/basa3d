import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MarkdownEditor } from '@/components/admin/markdown-editor';
import { listBlogCategories, listBlogPosts } from '@/services/blog.service';
import { createBlogCategoryAction, createBlogPostAction } from './actions';

export default async function BlogPage() {
  const [{ items: posts }, categories] = await Promise.all([
    listBlogPosts({ limit: 100 }),
    listBlogCategories(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Blog</h1>

      <Card>
        <CardHeader><CardTitle>Viết bài mới</CardTitle></CardHeader>
        <CardContent>
          <form action={createBlogPostAction} encType="multipart/form-data" className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Tiêu đề</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" required placeholder="tieu-de-bai-viet" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoryId">Danh mục</Label>
              <select id="categoryId" name="categoryId" className="h-10 cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— Không danh mục —</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Trạng thái</Label>
              <select id="status" name="status" defaultValue="DRAFT" className="h-10 cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="DRAFT">DRAFT (nháp)</option>
                <option value="PUBLISHED">PUBLISHED (đăng ngay)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tags">Tags (phân cách bằng dấu phẩy)</Label>
              <Input id="tags" name="tags" placeholder="pla, huong-dan, in-3d" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="coverImage">Ảnh bìa</Label>
              <input id="coverImage" name="coverImage" type="file" accept="image/*" className="cursor-pointer text-sm" />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="excerpt">Mô tả ngắn</Label>
              <Input id="excerpt" name="excerpt" maxLength={500} />
            </div>
            <div className="col-span-2">
              <MarkdownEditor name="content" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoTitle">SEO title</Label>
              <Input id="seoTitle" name="seoTitle" maxLength={200} placeholder="Để trống dùng tiêu đề bài viết" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoDescription">SEO description</Label>
              <Input id="seoDescription" name="seoDescription" maxLength={500} placeholder="Để trống dùng mô tả ngắn" />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="cursor-pointer">Lưu bài viết</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danh mục blog</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => <Badge key={category.id} variant="secondary">{category.name}</Badge>)}
          </div>
          <form action={createBlogCategoryAction} className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name">Tên danh mục mới</Label>
              <Input id="cat-name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input id="cat-slug" name="slug" required />
            </div>
            <Button type="submit" variant="outline" className="cursor-pointer">Thêm danh mục</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danh sách bài viết ({posts.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày đăng</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell><Badge variant={post.status === 'PUBLISHED' ? 'default' : 'secondary'}>{post.status}</Badge></TableCell>
                  <TableCell>{post.publishedAt ? new Date(post.publishedAt).toLocaleString('vi-VN') : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/blog/${post.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>Sửa</Link>
                  </TableCell>
                </TableRow>
              ))}
              {!posts.length ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Chưa có bài viết nào</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
