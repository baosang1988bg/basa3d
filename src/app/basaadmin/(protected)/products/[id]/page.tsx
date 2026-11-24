import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { ArrowLeft, Copy, Pencil, ExternalLink, ImageOff, Layers, Package, Printer, Star, Tag } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmSubmitButton } from '@/components/admin/confirm-submit-button';
import { PricingCalculatorPanel } from '@/components/admin/pricing-calculator-panel';
import { ProductDetailVariantsAndImages } from '@/components/admin/product-detail-variants-manager';
import { PublishBlockedNotice } from '@/components/admin/publish-blocked-notice';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getCategoryDisplayName } from '@/lib/categories';
import { listMaterials } from '@/services/inventory.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { getProductById, listCategories, listProductImages } from '@/services/product.service';
import { PUBLISH_READINESS_MESSAGES, getProductImportMeta, getPublishReadiness, type PublishReadinessReason } from '@/services/product-onboarding.service';
import { deleteProductAction, duplicateProductAction, updateProductAction } from '../actions';

// Phase 55 (D6): where on this page each missing item is fixed.
const MISSING_ANCHOR: Record<PublishReadinessReason, string> = {
  LICENSE_UNKNOWN: '#ban-quyen',
  NO_IMAGE: '#anh',
  NO_PRICE: '#thong-tin',
  UNCATEGORIZED: '#thong-tin',
  NOT_FOUND: '#thong-tin',
};

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
  searchParams: Promise<{ publishBlocked?: string; saveError?: string; duplicated?: string }>;
}) {
  const { id } = await params;
  const { publishBlocked, saveError, duplicated } = await searchParams;
  const [{ role }, product, images, materials, pricingConfig, { items: categories }, importMeta, missing] = await Promise.all([
    requireAdmin(),
    getProductById(id),
    listProductImages(id),
    listMaterials(),
    getCurrentPricingConfig(),
    listCategories({ limit: 100 }),
    getProductImportMeta(id),
    getPublishReadiness(id),
  ]);
  if (!product) notFound();

  const cover = images[0]?.url ?? null;
  const activeVariants = product.variants.filter((v: { isActive: boolean }) => v.isActive);
  const prices = product.variants.map((v: { price: number }) => v.price).filter((p: number) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : product.basePrice;
  const maxPrice = prices.length ? Math.max(...prices) : product.basePrice;
  const badge = STATUS_BADGE[product.status] ?? STATUS_BADGE.DRAFT;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <PublishBlockedNotice value={publishBlocked} />
      {saveError ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      ) : null}
      {duplicated ? (
        <div role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          Đã tạo bản sao ở trạng thái Nháp. Ảnh, tồn kho và bản quyền không được chép sang — hãy đổi tên, thêm ảnh và chọn nguồn mẫu trước khi đăng bán.
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {product.status === 'ACTIVE' ? (
            <Link href={`/vi/products/${product.slug}`} target="_blank" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Xem trên web <ExternalLink className="ml-1.5 size-3.5" />
            </Link>
          ) : null}
          {/* Phase 55 (D4): requestId is minted per render, so a double click replays the first copy. */}
          <form action={duplicateProductAction.bind(null, id, randomUUID())}>
            <Button type="submit" variant="outline" size="sm" title="Tạo bản nháp mới từ sản phẩm này (không chép ảnh, tồn kho, bản quyền)">
              <Copy className="mr-1.5 size-3.5" /> Nhân bản
            </Button>
          </form>
          {role === 'OWNER' ? (
            <form action={deleteProductAction.bind(null, id)}>
              <ConfirmSubmitButton variant="destructive" size="sm" confirmation={`Xoá hẳn "${product.name}"? Không khôi phục được. Nếu chỉ muốn ẩn khỏi web, hãy chọn trạng thái "Đã lưu trữ".`}>Xoá hẳn sản phẩm</ConfirmSubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      {/* Quick KPI Summary Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Sản phẩm con</p>
            <p className="text-sm font-semibold text-foreground">
              {product.variants.length} mẫu <span className="text-xs font-normal text-emerald-600">({activeVariants.length} bán)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <Tag className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Khoảng giá bán</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {minPrice != null
                ? minPrice === maxPrice
                  ? `${minPrice.toLocaleString('vi-VN')} ₫`
                  : `${minPrice.toLocaleString('vi-VN')} ~ ${maxPrice?.toLocaleString('vi-VN')} ₫`
                : 'Chưa đặt giá'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
            {product.productType === 'READY_STOCK' ? <Package className="size-4" /> : <Printer className="size-4" />}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Hình thức bán</p>
            <p className="text-sm font-semibold text-foreground">
              {product.productType === 'READY_STOCK' ? 'Có sẵn, giao ngay' : 'In theo yêu cầu'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <Star className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Ảnh &amp; File in</p>
            <p className="text-sm font-semibold text-foreground">
              {images.length} ảnh · {product.printLocalPath || product.variants.some((v: { printLocalPath: string | null }) => v.printLocalPath) ? 'Đã có .3mf' : 'Chưa có .3mf'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Nav Anchors */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/80 pb-2 text-xs">
        <a href="#san-pham-con" className="rounded-md bg-muted px-2.5 py-1 font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors">
          Sản phẩm con / Biến thể ({product.variants.length})
        </a>
        <a href="#anh" className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          Ảnh ({images.length})
        </a>
        <a href="#thong-tin" className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1">
          <Pencil className="size-3" /> Sửa chi tiết cha &amp; SEO
        </a>
        <a href="#ban-quyen" className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          Bản quyền &amp; 3MF
        </a>
      </div>

      {/* Variants & Images (most used for multi-variant merged products!) */}
      <div id="anh" className="scroll-mt-16">
      <ProductDetailVariantsAndImages
        productId={id}
        productName={product.name}
        productSlug={product.slug}
        productStatus={product.status}
        categoryId={product.categoryId}
        productType={product.productType}
        shortDescription={product.shortDescription}
        isFeatured={product.isFeatured}
        categories={categories.map((c) => ({ id: c.id, name: getCategoryDisplayName(c, 'vi') }))}
        categoryName={categories.find((c) => c.id === product.categoryId) ? getCategoryDisplayName(categories.find((c) => c.id === product.categoryId)!, 'vi') : null}
        basePrice={product.basePrice}
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
      </div>

      {/* General product info */}
      <Card id="thong-tin" className="scroll-mt-16 border-2 border-primary/20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Pencil className="size-5 text-primary" />
                <span>Chi tiết sản phẩm cha &amp; Cấu hình SEO</span>
              </CardTitle>
              <CardDescription className="mt-1">
                Chỉnh sửa toàn bộ thông tin đại diện của sản phẩm cha: tên, danh mục, mô tả chi tiết (Markdown), SEO Title/Description và giấy phép in 3MF.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary font-medium">
              Sản phẩm cha (ID: {product.slug})
            </Badge>
          </div>
        </CardHeader>
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
              <Input id="shortDescription" name="shortDescription" maxLength={500} defaultValue={product.shortDescription ?? ''} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="description">Mô tả chi tiết (Markdown)</Label>
              <Textarea id="description" name="description" rows={6} maxLength={20000} defaultValue={product.description ?? ''} />
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
            <div id="ban-quyen" className="sm:col-span-2 grid scroll-mt-16 gap-4 rounded-lg border border-border p-3 sm:grid-cols-3">
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
