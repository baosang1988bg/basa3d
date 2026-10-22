import { AdminPagination } from '@/components/admin/admin-pagination';
import Link from 'next/link';
import { Warehouse } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PricingCalculatorPanel } from '@/components/admin/pricing-calculator-panel';
import { listMaterials } from '@/services/inventory.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { listCategories, listProducts } from '@/services/product.service';
import { archiveProductAction, createCategoryAction, createProductAction, unarchiveProductAction } from './actions';
import { requireAdmin } from '@/lib/auth/require-admin';
import { PublishBlockedNotice } from '@/components/admin/publish-blocked-notice';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ page?: string; publishBlocked?: string }> }) {
  // Phase 35 D1: never rely on the layout alone — RSC segment requests can render this page
  // without re-running the layout. requireAdmin() is cache()-memoized, so this is free.
  await requireAdmin();
  const params = await searchParams;
  const [{ items: products, page, hasNext }, { items: categories }, materials, pricingConfig] = await Promise.all([
    listProducts({ page: Number(params.page) }),
    listCategories({ limit: 100 }),
    listMaterials(),
    getCurrentPricingConfig(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PublishBlockedNotice value={params.publishBlocked} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sản phẩm</h1>
        <Link href="/admin/product-inventory" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Warehouse className="mr-1.5 size-4" />
          Kho sản phẩm &amp; Cấu hình giá
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <Warehouse className="size-6 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Quản lý tồn kho &amp; cấu hình giá nhanh</p>
            <p className="text-xs text-muted-foreground">
              Xem sản phẩm nào còn tồn, kiểm tra giá bán và cấu hình giá in 3D nhanh gọn mà không cần đi qua form tạo/sửa chi tiết phức tạp.
            </p>
          </div>
        </div>
        <Link href="/admin/product-inventory" className={buttonVariants({ size: 'sm' })}>
          Đến Kho sản phẩm
        </Link>
      </div>

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
            <div className="col-span-2">
              <PricingCalculatorPanel materials={materials} config={pricingConfig} priceInputIds={['basePrice']} defaultPrinterProfileId="BAMBU_P2S" />
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
            <div className="col-span-2 grid grid-cols-3 gap-4 rounded-lg border border-border p-3">
              <div className="col-span-3 text-sm font-semibold">Bản quyền &amp; nguồn model</div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="licenseType">Loại license</Label>
                <select id="licenseType" name="licenseType" defaultValue="OWN_DESIGN" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="OWN_DESIGN">Tự thiết kế</option>
                  <option value="CC_BY">CC BY</option>
                  <option value="CC0">CC0 / Public Domain</option>
                  <option value="COMMERCIAL_LICENSE">Đã mua Commercial License</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="licenseSourceUrl">Link nguồn model</Label>
                <Input id="licenseSourceUrl" name="licenseSourceUrl" type="url" placeholder="https://makerworld.com/..." />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="licenseProofUrl">Link bằng chứng license</Label>
                <Input id="licenseProofUrl" name="licenseProofUrl" type="url" placeholder="Link ảnh chụp màn hình license" />
              </div>
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
                  <TableCell>{product.basePrice != null ? Number(product.basePrice).toLocaleString('vi-VN') + 'đ' : '—'}</TableCell>
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
          <AdminPagination basePath="/admin/products" page={page} hasNext={hasNext} />
        </CardContent>
      </Card>
    </div>
  );
}
