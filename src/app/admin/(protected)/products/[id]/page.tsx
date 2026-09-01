import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PricingCalculatorPanel } from '@/components/admin/pricing-calculator-panel';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listMaterials } from '@/services/inventory.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { getProductById, listProductImages } from '@/services/product.service';
import {
  createVariantAction,
  deleteProductAction,
  deleteProductImageAction,
  deleteVariantAction,
  updateProductAction,
  updateVariantAction,
  uploadProductImageAction,
} from '../actions';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ role }, product, images, materials, pricingConfig] = await Promise.all([
    requireAdmin(), getProductById(id), listProductImages(id), listMaterials(), getCurrentPricingConfig(),
  ]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        {role === 'OWNER' ? (
          <form action={deleteProductAction.bind(null, id)}>
            <Button type="submit" variant="destructive" size="sm">Xoá hẳn sản phẩm</Button>
          </form>
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle>Thông tin sản phẩm</CardTitle></CardHeader>
        <CardContent>
          <form action={updateProductAction.bind(null, id)} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Tên</Label>
              <Input id="name" name="name" defaultValue={product.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" defaultValue={product.slug} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Trạng thái</Label>
              <select id="status" name="status" defaultValue={product.status} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="basePrice">Giá cơ bản (VND)</Label>
              <Input id="basePrice" name="basePrice" type="number" min={0} defaultValue={product.basePrice ?? ''} />
            </div>
            <div className="col-span-2">
              <PricingCalculatorPanel materials={materials} config={pricingConfig} priceInputIds={['basePrice']} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="shortDescription">Mô tả ngắn</Label>
              <Input id="shortDescription" name="shortDescription" defaultValue={product.shortDescription ?? ''} />
            </div>
            <div className="flex items-end gap-2">
              <input id="isFeatured" name="isFeatured" type="checkbox" className="size-4" defaultChecked={product.isFeatured} />
              <Label htmlFor="isFeatured">Nổi bật</Label>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoTitle">SEO title</Label>
              <Input id="seoTitle" name="seoTitle" maxLength={200} defaultValue={product.seoTitle ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seoDescription">SEO description</Label>
              <Input id="seoDescription" name="seoDescription" maxLength={500} defaultValue={product.seoDescription ?? ''} />
            </div>
            <div className="col-span-2"><Button type="submit">Lưu thay đổi</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Biến thể ({product.variants.length})</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {product.variants.map((variant: { id: string; sku: string; name: string; price: number; isActive: boolean }) => (
            <form key={variant.id} action={updateVariantAction.bind(null, id, variant.id)} className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
              <div className="flex flex-col gap-1.5">
                <Label>SKU</Label>
                <p className="text-sm">{variant.sku}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`name-${variant.id}`}>Tên</Label>
                <Input id={`name-${variant.id}`} name="name" defaultValue={variant.name} className="w-40" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`price-${variant.id}`}>Giá</Label>
                <Input id={`price-${variant.id}`} name="price" type="number" min={0} defaultValue={variant.price} className="w-32" />
              </div>
              <div className="flex items-center gap-2">
                <input id={`active-${variant.id}`} name="isActive" type="checkbox" className="size-4" defaultChecked={variant.isActive} />
                <Label htmlFor={`active-${variant.id}`}>Đang bán</Label>
              </div>
              <Button type="submit" size="sm" variant="outline">Lưu</Button>
              {role === 'OWNER' ? (
                <Button type="submit" size="sm" variant="destructive" formAction={deleteVariantAction.bind(null, id, variant.id)}>Xoá hẳn</Button>
              ) : null}
            </form>
          ))}

          <form action={createVariantAction.bind(null, id)} className="flex flex-wrap items-end gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-sku">SKU mới</Label>
              <Input id="new-sku" name="sku" required placeholder="SKU-EXAMPLE" className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-name">Tên biến thể</Label>
              <Input id="new-name" name="name" required className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-price">Giá</Label>
              <Input id="new-price" name="price" type="number" min={0} required className="w-32" />
            </div>
            <Button type="submit" size="sm">Thêm biến thể</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ảnh sản phẩm ({images.length})</span>
            <span className="text-xs font-normal text-muted-foreground">Hỗ trợ JPG, PNG, WEBP tối đa 5MB</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {images.map((image) => (
                <div key={image.id} className="group relative flex flex-col items-center overflow-hidden rounded-lg border border-border bg-card p-2 shadow-xs transition-shadow hover:shadow-md">
                  <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                    <Image src={image.url} alt={image.altText ?? product.name} fill className="object-cover" unoptimized />
                  </div>
                  <form action={deleteProductImageAction.bind(null, id, image.id)} className="mt-2 w-full">
                    <Button type="submit" size="sm" variant="outline" className="w-full text-xs text-destructive hover:bg-destructive/10">Xoá ảnh</Button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sản phẩm này chưa có hình ảnh. Hãy tải lên ảnh đại diện bên dưới.</p>
          )}
          <form action={uploadProductImageAction.bind(null, id)} encType="multipart/form-data" className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="cursor-pointer text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90" />
            <Button type="submit" size="sm">Tải ảnh lên</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
