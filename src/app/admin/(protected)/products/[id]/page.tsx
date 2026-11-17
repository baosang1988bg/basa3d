import { randomUUID } from 'node:crypto';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronDown, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QuickRestockButton } from '@/components/admin/quick-restock-dialog';
import { getCategoryDisplayName } from '@/lib/categories';
import { PricingCalculatorPanel } from '@/components/admin/pricing-calculator-panel';
import { requireAdmin } from '@/lib/auth/require-admin';
import { PublishBlockedNotice } from '@/components/admin/publish-blocked-notice';
import { listMaterials } from '@/services/inventory.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { getProductById, listCategories, listProductImages } from '@/services/product.service';
import { PUBLISH_READINESS_MESSAGES, getPublishReadiness, type PublishReadinessReason } from '@/services/product-onboarding.service';
import {
  createVariantAction,
  deleteProductAction,
  duplicateProductAction,
  deleteProductImageAction,
  deleteVariantAction,
  updateProductAction,
  updateVariantAction,
} from '../actions';
import { setProductCoverImageAction } from '../new/actions';
import { ProductImageUploader } from '@/components/admin/product-image-picker';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Nháp', ACTIVE: 'Đang bán', ARCHIVED: 'Đã lưu trữ' };

// Phase 55 (D6): same anchors the catalogue list links to from "Còn thiếu: …".
const MISSING_ANCHOR: Record<PublishReadinessReason, string> = {
  LICENSE_UNKNOWN: '#ban-quyen',
  NO_IMAGE: '#anh',
  NO_PRICE: '#thong-tin',
  UNCATEGORIZED: '#thong-tin',
  NOT_FOUND: '#thong-tin',
};

const SELECT_CLASS = 'h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ publishBlocked?: string; duplicated?: string }> }) {
  const { id } = await params;
  const { publishBlocked, duplicated } = await searchParams;
  const [{ role }, product, images, materials, pricingConfig, { items: categories }, missing] = await Promise.all([
    requireAdmin(), getProductById(id), listProductImages(id), listMaterials(), getCurrentPricingConfig(),
    listCategories({ limit: 100 }), getPublishReadiness(id),
  ]);
  if (!product) notFound();
  const isReadyStock = product.productType === 'READY_STOCK';
  // A product may sit in a category that is no longer listed (inactive). The select then offers an
  // empty "keep current" option — an empty value is not sent, so saving never silently re-categorises.
  const categoryListed = categories.some((category) => category.id === product.categoryId);

  return (
    <div className="flex flex-col gap-6">
      <PublishBlockedNotice value={publishBlocked} />
      {duplicated ? (
        <div role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          Đã tạo bản sao ở trạng thái Nháp. Ảnh, tồn kho và bản quyền không được chép sang — hãy đổi tên, thêm ảnh và chọn nguồn mẫu trước khi đăng bán.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/admin/products" className="text-xs text-muted-foreground hover:underline">← Danh sách sản phẩm</Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <Badge variant="outline">{STATUS_LABEL[product.status] ?? product.status}</Badge>
            <Badge variant="outline" className="text-muted-foreground">{isReadyStock ? 'Có sẵn, giao ngay' : 'In theo yêu cầu'}</Badge>
          </div>
          {product.status === 'DRAFT' ? (
            missing.length ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-amber-700 dark:text-amber-400">
                <span>Còn thiếu để đăng bán:</span>
                {missing.map((reason) => (
                  <a key={reason} href={MISSING_ANCHOR[reason]} className="underline underline-offset-2">{PUBLISH_READINESS_MESSAGES[reason]}</a>
                ))}
              </p>
            ) : <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">Đủ thông tin — đổi trạng thái sang “Đang bán” rồi Lưu để lên web.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isReadyStock ? (
            <Link href="/admin/product-inventory" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Kho &amp; giá</Link>
          ) : null}
          {/* requestId is minted per render: a double click replays the first copy (idempotent). */}
          <form action={duplicateProductAction.bind(null, id, randomUUID())}>
            <Button type="submit" variant="outline" size="sm" title="Tạo bản nháp mới từ sản phẩm này (không chép ảnh, tồn kho, bản quyền)">
              <Copy className="mr-1.5 size-3.5" /> Nhân bản
            </Button>
          </form>
          {role === 'OWNER' ? (
            <form action={deleteProductAction.bind(null, id)}>
              <Button type="submit" variant="destructive" size="sm">Xoá hẳn sản phẩm</Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card id="thong-tin" className="scroll-mt-16">
        <CardHeader><CardTitle>Thông tin sản phẩm</CardTitle></CardHeader>
        <CardContent>
          <form action={updateProductAction.bind(null, id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Tên sản phẩm</Label>
              <Input id="name" name="name" defaultValue={product.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categoryId">Danh mục</Label>
              <select id="categoryId" name="categoryId" defaultValue={categoryListed ? product.categoryId ?? '' : ''} className={SELECT_CLASS}>
                {categoryListed ? null : <option value="">{product.categoryId ? '— Giữ danh mục hiện tại —' : '— Chưa chọn —'}</option>}
                {categories.map((category) => <option key={category.id} value={category.id}>{getCategoryDisplayName(category, 'vi')}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Trạng thái</Label>
              <select id="status" name="status" defaultValue={product.status} className={SELECT_CLASS}>
                <option value="DRAFT">Nháp (chưa lên web)</option>
                <option value="ACTIVE">Đang bán</option>
                <option value="ARCHIVED">Đã lưu trữ (ẩn khỏi web)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="basePrice">Giá bán niêm yết (đ)</Label>
              <Input id="basePrice" name="basePrice" type="number" min={0} defaultValue={product.basePrice ?? ''} />
            </div>
            <div className="sm:col-span-2">
              <PricingCalculatorPanel materials={materials} config={pricingConfig} priceInputIds={['basePrice']} defaultPrinterProfileId="BAMBU_P2S" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="shortDescription">Mô tả ngắn</Label>
              <Input id="shortDescription" name="shortDescription" maxLength={500} defaultValue={product.shortDescription ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="description">Mô tả chi tiết (Markdown)</Label>
              <Textarea id="description" name="description" rows={6} maxLength={20000} defaultValue={product.description ?? ''} />
            </div>
            <div id="ban-quyen" className="grid scroll-mt-16 grid-cols-1 gap-4 rounded-lg border border-border p-3 sm:col-span-2 sm:grid-cols-3">
              <div className="text-sm font-semibold sm:col-span-3">Bản quyền &amp; nguồn model</div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="licenseType">Loại license</Label>
                <select id="licenseType" name="licenseType" defaultValue={product.licenseType} className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="OWN_DESIGN">Tự thiết kế</option>
                  <option value="CC_BY">CC BY</option>
                  <option value="CC0">CC0 / Public Domain</option>
                  <option value="COMMERCIAL_LICENSE">Đã mua Commercial License</option>
                  <option value="OTHER">Khác</option>
                  <option value="UNKNOWN">Chưa xác định (hàng nhập kho STL)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="licenseSourceUrl">Link nguồn model</Label>
                <Input id="licenseSourceUrl" name="licenseSourceUrl" type="url" defaultValue={product.licenseSourceUrl ?? ''} placeholder="https://makerworld.com/..." />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="licenseProofUrl">Link bằng chứng license</Label>
                <Input id="licenseProofUrl" name="licenseProofUrl" type="url" defaultValue={product.licenseProofUrl ?? ''} placeholder="Link ảnh chụp màn hình license" />
              </div>
            </div>
            {/* Rarely touched — tucked away like on "Đăng sản phẩm mới". Closed <details> fields still submit. */}
            <details className="group rounded-lg border border-border sm:col-span-2">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium">
                Nâng cao (đường dẫn, SEO, nổi bật)
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-1 gap-4 border-t border-border p-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="slug">Đường dẫn (slug)</Label>
                  <Input id="slug" name="slug" defaultValue={product.slug} />
                  <p className="text-xs text-muted-foreground">Đổi đường dẫn của sản phẩm đang bán sẽ làm hỏng link đã chia sẻ.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="seoTitle">SEO title</Label>
                  <Input id="seoTitle" name="seoTitle" maxLength={200} defaultValue={product.seoTitle ?? ''} placeholder="Để trống dùng tên sản phẩm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="seoDescription">SEO description</Label>
                  <Input id="seoDescription" name="seoDescription" maxLength={500} defaultValue={product.seoDescription ?? ''} placeholder="Để trống dùng mô tả ngắn" />
                </div>
                <div className="flex items-center gap-2">
                  <input id="isFeatured" name="isFeatured" type="checkbox" className="size-4" defaultChecked={product.isFeatured} />
                  <Label htmlFor="isFeatured">Nổi bật trên trang chủ</Label>
                </div>
              </div>
            </details>
            <div className="sm:col-span-2"><Button type="submit">Lưu thay đổi</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card id="bien-the" className="scroll-mt-16">
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
              {isReadyStock ? (
                <QuickRestockButton variants={[{ id: variant.id, sku: variant.sku, name: variant.name }]} productName={product.name} />
              ) : null}
              {role === 'OWNER' ? (
                <Button type="submit" size="sm" variant="destructive" formAction={deleteVariantAction.bind(null, id, variant.id)}>Xoá hẳn</Button>
              ) : null}
            </form>
          ))}

          <form action={createVariantAction.bind(null, id)} className="flex flex-wrap items-end gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-sku">SKU (để trống = tự tạo)</Label>
              <Input id="new-sku" name="sku" placeholder="Tự tạo" className="w-40" />
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

      <Card id="anh" className="scroll-mt-16">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ảnh sản phẩm ({images.length})</span>
            <span className="text-xs font-normal text-muted-foreground">Ảnh đầu tiên là ảnh bìa</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {images.map((image, index) => (
                <div key={image.id} className="group relative flex flex-col items-center overflow-hidden rounded-lg border border-border bg-card p-2 shadow-xs transition-shadow hover:shadow-md">
                  <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                    <Image src={image.url} alt={image.altText ?? product.name} fill className="object-cover" unoptimized />
                  </div>
                  {index === 0 ? (
                    <span className="mt-2 w-full text-center text-xs font-semibold text-primary">★ Ảnh bìa</span>
                  ) : (
                    <form action={setProductCoverImageAction.bind(null, id, image.id)} className="mt-2 w-full">
                      <Button type="submit" size="sm" variant="ghost" className="w-full text-xs">Đặt làm bìa</Button>
                    </form>
                  )}
                  <form action={deleteProductImageAction.bind(null, id, image.id)} className="mt-1 w-full">
                    <Button type="submit" size="sm" variant="outline" className="w-full text-xs text-destructive hover:bg-destructive/10">Xoá ảnh</Button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sản phẩm này chưa có hình ảnh. Hãy tải lên ảnh đại diện bên dưới.</p>
          )}
          {/* Phase 52 P3: multi-image, shrunk in the browser, uploaded straight to Storage. */}
          <ProductImageUploader productId={id} hasImages={images.length > 0} />
        </CardContent>
      </Card>
    </div>
  );
}
