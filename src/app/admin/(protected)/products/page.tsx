import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listCategories, listProducts } from '@/services/product.service';
import { archiveProductAction, createCategoryAction, createProductAction, unarchiveProductAction } from './actions';

export default async function ProductsPage() {
  const [{ items: products }, { items: categories }] = await Promise.all([
    listProducts({ limit: 100 }),
    listCategories({ limit: 100 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Sản phẩm</h1>

      <Card>
        <CardHeader><CardTitle>Tạo sản phẩm mới</CardTitle></CardHeader>
        <CardContent>
          <form action={createProductAction} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Tên sản phẩm</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" required placeholder="ten-san-pham" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoryId">Danh mục</Label>
              <select id="categoryId" name="categoryId" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— Không danh mục —</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="productType">Loại sản phẩm</Label>
              <select id="productType" name="productType" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                <option value="READY_STOCK">READY_STOCK</option>
                <option value="MADE_TO_ORDER">MADE_TO_ORDER</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="basePrice">Giá cơ bản (VND)</Label>
              <Input id="basePrice" name="basePrice" type="number" min={0} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="isFeatured" name="isFeatured" type="checkbox" className="size-4 rounded border-input" />
              <Label htmlFor="isFeatured" className="cursor-pointer">Nổi bật</Label>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seoTitle">SEO title</Label>
              <Input id="seoTitle" name="seoTitle" maxLength={200} placeholder="Để trống dùng tên sản phẩm" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seoDescription">SEO description</Label>
              <Input id="seoDescription" name="seoDescription" maxLength={500} placeholder="Để trống dùng mô tả ngắn" />
            </div>
            <div className="col-span-2 flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-3">
                <Button type="submit">Tạo sản phẩm</Button>
                <span className="text-xs text-muted-foreground">
                  💡 Sau khi tạo, bấm <strong>Chi tiết</strong> để tải ảnh sản phẩm lên
                </span>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danh mục</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => <Badge key={category.id} variant="secondary">{category.name}</Badge>)}
          </div>
          <form action={createCategoryAction} className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name">Tên danh mục mới</Label>
              <Input id="cat-name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input id="cat-slug" name="slug" required />
            </div>
            <Button type="submit" variant="outline">Thêm danh mục</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danh sách sản phẩm ({products.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Giá cơ bản</TableHead>
                <TableHead>Biến thể</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product: { id: string; name: string; status: string; basePrice: number | null; variants?: unknown[] }) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell><Badge variant={product.status === 'ACTIVE' ? 'default' : 'secondary'}>{product.status}</Badge></TableCell>
                  <TableCell>{product.basePrice ? Number(product.basePrice).toLocaleString('vi-VN') + 'đ' : '—'}</TableCell>
                  <TableCell>{product.variants?.length ?? 0}</TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Link href={`/admin/products/${product.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>Chi tiết</Link>
                    {product.status === 'ARCHIVED' ? (
                      <form action={unarchiveProductAction.bind(null, product.id)}><Button type="submit" size="sm" variant="outline">Bỏ lưu trữ</Button></form>
                    ) : (
                      <form action={archiveProductAction.bind(null, product.id)}><Button type="submit" size="sm" variant="outline">Lưu trữ</Button></form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
