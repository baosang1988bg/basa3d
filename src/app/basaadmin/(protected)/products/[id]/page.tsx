import Link from 'next/link';
import { ArrowLeft, ExternalLink, ImageOff } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PricingCalculatorPanel } from '@/components/admin/pricing-calculator-panel';
import { ProductDetailVariantsAndImages } from '@/components/admin/product-detail-variants-manager';
import { PublishBlockedNotice } from '@/components/admin/publish-blocked-notice';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getCategoryDisplayName } from '@/lib/categories';
import { listMaterials } from '@/services/inventory.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { getProductById, listCategories, listProductImages } from '@/services/product.service';
import { getProductImportMeta } from '@/services/product-onboarding.service';
import { deleteProductAction, updateProductAction } from '../actions';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang bán', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  DRAFT: { label: 'Nháp', className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  ARCHIVED: { label: 'Đã lưu trữ', className: 'border-border bg-muted text-muted-foreground' },
};

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publishBlocked?: string; saveError?: string }>;
}) {
  const { id } = await params;
  const { publishBlocked, saveError } = await searchParams;
  const [{ role }, product, images, materials, pricingConfig, { items: categories }, importMeta] = await Promise.all([
    requireAdmin(),
    getProductById(id),
    listProductImages(id),
    listMaterials(),
    getCurrentPricingConfig(),
    listCategories({ limit: 100 }),
    getProductImportMeta(id),
  ]);
  if (!product) notFound();

  const cover = images[0]?.url ?? null;
  const badge = STATUS_BADGE[product.status] ?? STATUS_BADGE.DRAFT;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <PublishBlockedNotice value={publishBlocked} />
      {saveError ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {cover ? <img src={cover} alt="" className="size-full object-cover" /> : <ImageOff className="size-6 text-muted-foreground/50" />}
          </div>
          <div className="min-w-0">
            <Link href="/basaadmin/products" className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-0.5 h-7 px-2 text-xs' })}>
              <ArrowLeft className="mr-1 size-3.5" /> Danh sách sản phẩm
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold">{product.name}</h1>
              <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {product.status === 'ACTIVE' ? (
            <Link href={`/vi/products/${product.slug}`} target="_blank" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Xem trên web <ExternalLink className="ml-1.5 size-3.5" />
            </Link>
          ) : null}
          {role === 'OWNER' ? (
            <form action={deleteProductAction.bind(null, id)}>
              <Button type="submit" variant="destructive" size="sm">Xoá hẳn sản phẩm</Button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Variants & Images (most used for multi-variant merged products!) */}
      <ProductDetailVariantsAndImages
        productId={id}
        productName={product.name}
        role={role}
        variants={product.variants.map((v: { id: string; sku: string; name: string; price: number; weightGrams: number | null; isActive: boolean; printLocalPath: string | null; printDriveUrl: string | null }) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: v.price,
          weightGrams: v.weightGrams,
          isActive: v.isActive,
          printLocalPath: v.printLocalPath,
          printDriveUrl: v.printDriveUrl,
        }))}
        images={images.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          sortOrder: img.sortOrder,
          variantId: img.variantId,
        }))}
      />

      {/* General product info */}
      <Card>
        <CardHeader><CardTitle>Thông tin chung &amp; SEO</CardTitle></CardHeader>
        <CardContent>
          <form action={updateProductAction.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Tên</Label>
              <Input id="name" name="name" defaultValue={product.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" defaultValue={product.slug} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categoryId">Danh mục</Label>
              <select id="categoryId" name="categoryId" defaultValue={product.categoryId ?? ''} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
                <option value="">— Chưa chọn danh mục —</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{getCategoryDisplayName(category, 'vi')}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="productType">Hình thức bán</Label>
              <select id="productType" name="productType" defaultValue={product.productType} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
                <option value="MADE_TO_ORDER">In theo yêu cầu</option>
                <option value="READY_STOCK">Có sẵn, giao ngay</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Trạng thái</Label>
              <select id="status" name="status" defaultValue={product.status} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
                <option value="DRAFT">Nháp (DRAFT)</option>
                <option value="ACTIVE">Đang bán (ACTIVE)</option>
                <option value="ARCHIVED">Đã lưu trữ (ARCHIVED)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="basePrice">Giá cơ bản (VND)</Label>
              <Input id="basePrice" name="basePrice" type="number" min={0} defaultValue={product.basePrice ?? ''} />
            </div>
            <div className="sm:col-span-2">
              <PricingCalculatorPanel materials={materials} config={pricingConfig} priceInputIds={['basePrice']} defaultPrinterProfileId="BAMBU_P2S" />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
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
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="seoDescription">SEO description</Label>
              <Input id="seoDescription" name="seoDescription" maxLength={500} defaultValue={product.seoDescription ?? ''} />
            </div>
            <div className="sm:col-span-2 grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-3">
              <div className="sm:col-span-3 text-sm font-semibold">Bản quyền &amp; nguồn model</div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="licenseType">Loại license</Label>
                <select id="licenseType" name="licenseType" defaultValue={product.licenseType} className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
              {importMeta ? (
                <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                  <input type="hidden" name="hasImportLicenseField" value="1" />
                  <label className="flex items-center gap-2 font-medium">
                    <input name="licenseReviewed" type="checkbox" className="size-4" defaultChecked={importMeta.licenseReviewed} />
                    Đã kiểm tra bản quyền STL (trạng thái duyệt: {importMeta.reviewStatus})
                  </label>
                  <span className="text-xs text-muted-foreground">Nguồn STL: {importMeta.sourceRelPath}</span>
                </div>
              ) : null}
            </div>
            <div className="sm:col-span-2 grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
              <div className="sm:col-span-2 text-sm font-semibold">File .3mf để in (nội bộ xưởng, không hiện ngoài web)</div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="printLocalPath">Đường dẫn file ổ D / máy xưởng</Label>
                <Input id="printLocalPath" name="printLocalPath" defaultValue={product.printLocalPath ?? ''} placeholder="VD: D:\data3D\Clicker\Cat_v8.3mf" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="printDriveUrl">Link Google Drive backup</Label>
                <Input id="printDriveUrl" name="printDriveUrl" type="url" defaultValue={product.printDriveUrl ?? ''} placeholder="https://drive.google.com/..." />
              </div>
            </div>
            <div className="sm:col-span-2"><Button type="submit">Lưu thông tin chung</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
