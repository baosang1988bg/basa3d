'use client';

// Phase 52 P2/P3 — "Đăng sản phẩm mới" (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md).
// Three blocks in the order a print shop thinks: photos → what it is → how it's sold. Slug and SKUs are
// generated on the server; licence must be chosen (D8); opening stock is per colour (D9).
// Flow on save: create (DRAFT, replay-safe by requestId) → upload photos → optionally publish.
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, Loader2, Package, Plus, Printer, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PricingCalculatorPanel, type PricingConfigOption, type PricingMaterialOption } from '@/components/admin/pricing-calculator-panel';
import { ProductImagePicker, type PickedImage } from '@/components/admin/product-image-picker';
import { slugify } from '@/lib/catalog/naming';
import { ProductImageUploadError, uploadProductImages } from '@/lib/uploads/product-image-upload';
import { createProductOnboardingAction, publishProductAction } from '@/app/admin/(protected)/products/new/actions';

type ColorOption = { key: string; label: string; color: string; material: string };
type VariantRow = { key: string; name: string; color: string | null; material: string | null; priceText: string; stockText: string };
type LicenseMode = '' | 'OWN_DESIGN' | 'LICENSED' | 'UNKNOWN';
type LicensedType = 'CC_BY' | 'CC0' | 'COMMERCIAL_LICENSE' | 'OTHER';
type Done = { productId: string; published: boolean; reasons: string[]; imageCount: number };

const BASE_PRICE_INPUT_ID = 'onboard-base-price';
const LICENSED_LABELS: Record<LicensedType, string> = {
  COMMERCIAL_LICENSE: 'Đã mua Commercial License',
  CC_BY: 'CC BY (ghi công tác giả)',
  CC0: 'CC0 / Public Domain',
  OTHER: 'Khác',
};

const digitsOnly = (value: string) => value.replace(/[^\d]/g, '');
const toInt = (value: string): number | null => (digitsOnly(value) ? Number(digitsOnly(value)) : null);
const formatVnd = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

function choiceCard(active: boolean) {
  return `flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:bg-muted/40'}`;
}

export function ProductOnboardingForm({
  categories,
  colors,
  warehouses,
  materials,
  pricingConfig,
}: {
  categories: { id: string; label: string }[];
  colors: ColorOption[];
  warehouses: { id: string; name: string; code: string }[];
  materials: PricingMaterialOption[];
  pricingConfig: PricingConfigOption | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const requestId = useRef<string | null>(null);

  // Block 1 — photos
  const [images, setImages] = useState<PickedImage[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [uploadedPaths, setUploadedPaths] = useState<Record<string, string>>({});

  // Block 2 — what it is
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [licenseMode, setLicenseMode] = useState<LicenseMode>('');
  const [licensedType, setLicensedType] = useState<LicensedType>('COMMERCIAL_LICENSE');
  const [licenseSourceUrl, setLicenseSourceUrl] = useState('');
  const [licenseProofUrl, setLicenseProofUrl] = useState('');

  // Block 3 — how it's sold
  const [productType, setProductType] = useState<'MADE_TO_ORDER' | 'READY_STOCK'>('MADE_TO_ORDER');
  const [basePriceText, setBasePriceText] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [defaultStockText, setDefaultStockText] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : '');

  // Advanced
  const [description, setDescription] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // Submit
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const basePrice = toInt(basePriceText);
  const slugPreview = name.trim() ? slugify(name) : '';
  const locked = Boolean(createdProductId) || busy;
  const isStock = productType === 'READY_STOCK';
  const selectedKeys = useMemo(() => new Set(variants.map((variant) => variant.key)), [variants]);
  const needsWarehouse = isStock && warehouses.length > 1 && (variants.length ? variants.some((v) => toInt(v.stockText)) : Boolean(toInt(defaultStockText)));

  function toggleColor(option: ColorOption) {
    setVariants((previous) => (previous.some((variant) => variant.key === option.key)
      ? previous.filter((variant) => variant.key !== option.key)
      : [...previous, { key: option.key, name: option.label, color: option.color, material: option.material, priceText: '', stockText: '' }]));
  }

  function addCustomColor() {
    const label = customColor.trim();
    if (!label) return;
    const key = `custom|${label.toLocaleLowerCase('vi')}`;
    if (!selectedKeys.has(key)) setVariants((previous) => [...previous, { key, name: label, color: label, material: null, priceText: '', stockText: '' }]);
    setCustomColor('');
  }

  function updateVariant(key: string, patch: Partial<VariantRow>) {
    setVariants((previous) => previous.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)));
  }

  function clientCheck(): string | null {
    if (!name.trim()) return 'Nhập tên sản phẩm.';
    if (!categoryId) return 'Chọn danh mục.';
    if (!licenseMode) return 'Chọn nguồn mẫu (tự thiết kế / có license / chưa rõ).';
    if (licenseMode === 'LICENSED' && licensedType !== 'OTHER' && !licenseSourceUrl.trim()) return 'Mẫu có license cần link nguồn model.';
    if (!basePrice || basePrice <= 0) return 'Nhập giá bán lớn hơn 0.';
    if (needsWarehouse && !warehouseId) return 'Chọn kho để nhập tồn ban đầu.';
    if (images.some((image) => !image.blob && !image.error)) return 'Đợi ảnh nén xong rồi lưu.';
    return null;
  }

  function buildPayload() {
    const form = formRef.current ? new FormData(formRef.current) : null;
    const breakdownRaw = form?.get('pricingBreakdown');
    const configId = form?.get('pricingConfigId');
    const licenseType = licenseMode === 'LICENSED' ? licensedType : licenseMode;
    const variantPayload = variants.length
      ? variants.map((variant) => ({
        name: variant.name.trim(),
        color: variant.color,
        material: variant.material,
        price: toInt(variant.priceText),
        openingStock: isStock ? toInt(variant.stockText) ?? 0 : 0,
      }))
      : [{ name: 'Mặc định', openingStock: isStock ? toInt(defaultStockText) ?? 0 : 0 }];
    return {
      requestId: (requestId.current ??= globalThis.crypto.randomUUID()),
      name: name.trim(),
      categoryId,
      shortDescription: shortDescription.trim() || null,
      description: description.trim() || null,
      productType,
      basePrice: basePrice ?? 0,
      pricingBreakdown: typeof breakdownRaw === 'string' && breakdownRaw ? JSON.parse(breakdownRaw) : null,
      pricingConfigId: typeof breakdownRaw === 'string' && breakdownRaw && typeof configId === 'string' ? configId : null,
      licenseType,
      licenseSourceUrl: licenseMode === 'LICENSED' ? licenseSourceUrl.trim() || null : null,
      licenseProofUrl: licenseMode === 'LICENSED' ? licenseProofUrl.trim() || null : null,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      isFeatured,
      warehouseId: warehouseId || null,
      variants: variantPayload,
    };
  }

  async function save(publish: boolean) {
    setError(null);
    const problem = createdProductId ? null : clientCheck();
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      let productId = createdProductId;
      if (!productId) {
        setProgress('Đang tạo sản phẩm…');
        const created = await createProductOnboardingAction(buildPayload());
        if (!created.ok) { setError(created.message); return; }
        productId = created.data.productId;
        setCreatedProductId(productId);
      }

      const ready = images.filter((image) => image.blob && !image.error);
      if (ready.length) {
        try {
          const paths = await uploadProductImages(
            productId,
            ready.map((image) => ({ key: image.key, blob: image.blob as Blob })),
            coverKey,
            uploadedPaths,
            (count, total) => setProgress(`Đang tải ảnh ${count}/${total}…`),
          );
          setUploadedPaths(paths);
        } catch (cause) {
          setError(`${cause instanceof ProductImageUploadError ? cause.message : 'Tải ảnh thất bại.'} Sản phẩm đã được lưu nháp — bấm lưu lại để tải tiếp ảnh còn thiếu.`);
          return;
        }
      }

      let published = false;
      let reasons: string[] = [];
      if (publish) {
        setProgress('Đang đăng bán…');
        const result = await publishProductAction(productId);
        if (!result.ok) { setError(result.message); return; }
        published = result.data.published;
        reasons = result.data.reasons;
      }
      setDone({ productId, published, reasons, imageCount: ready.length });
    } catch {
      setError('Mất kết nối tới máy chủ. Bấm lưu lại — hệ thống sẽ không tạo trùng sản phẩm.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <CheckCircle2 className="size-8 text-emerald-600" />
          <p className="text-lg font-semibold">{done.published ? 'Đã đăng bán sản phẩm.' : 'Đã lưu sản phẩm (nháp).'}</p>
          <p className="text-sm text-muted-foreground">{done.imageCount} ảnh đã tải lên.</p>
          {done.reasons.length ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              Chưa đăng bán được vì: {done.reasons.join('; ')}. Bổ sung ở trang chi tiết rồi đổi trạng thái sang ACTIVE.
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/admin/products/${done.productId}`} className={buttonVariants({ size: 'sm' })}>Mở trang chi tiết</Link>
            <a href="/admin/products/new" className={buttonVariants({ size: 'sm', variant: 'outline' })}>Đăng sản phẩm khác</a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form ref={formRef} className="flex flex-col gap-6" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
      {/* Block 1 — photos */}
      <Card>
        <CardHeader><CardTitle>1. Ảnh mẫu in</CardTitle></CardHeader>
        <CardContent>
          <ProductImagePicker images={images} onImagesChange={setImages} coverKey={coverKey} onCoverChange={setCoverKey} disabled={busy} uploadedKeys={uploadedPaths} />
        </CardContent>
      </Card>

      {/* Block 2 — what it is */}
      <Card>
        <CardHeader><CardTitle>2. Thông tin mẫu in</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboard-name">Tên sản phẩm</Label>
              <Input id="onboard-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} disabled={locked} placeholder="VD: Móc khoá mèo Shiba" autoFocus />
              {slugPreview ? <p className="truncate font-mono text-[11px] text-muted-foreground">/products/{slugPreview}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboard-category">Danh mục</Label>
              <select id="onboard-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={locked} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">— Chọn danh mục —</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onboard-short">Mô tả ngắn</Label>
            <Textarea id="onboard-short" rows={3} maxLength={500} value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} disabled={locked} placeholder="Kích thước, cảm giác cầm nắm, lưu ý khi dùng…" />
          </div>

          <fieldset className="flex flex-col gap-2" disabled={locked}>
            <legend className="mb-1 text-sm font-medium">Nguồn mẫu / bản quyền <span className="text-rose-600">*</span></legend>
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
              {([
                ['OWN_DESIGN', 'Xưởng tự thiết kế', 'Mẫu do BaSa3D vẽ.'],
                ['LICENSED', 'Có license', 'Mua/tải từ MakerWorld, Printables… được phép bán.'],
                ['UNKNOWN', 'Chưa rõ', 'Chỉ lưu nháp, chưa đăng bán được.'],
              ] as const).map(([value, title, hint]) => (
                <button key={value} type="button" role="radio" aria-checked={licenseMode === value} onClick={() => setLicenseMode(value)} className={choiceCard(licenseMode === value)}>
                  <span className="flex flex-col"><span className="text-sm font-semibold">{title}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
                </button>
              ))}
            </div>
            {licenseMode === 'LICENSED' ? (
              <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="onboard-license-type">Loại license</Label>
                  <select id="onboard-license-type" value={licensedType} onChange={(event) => setLicensedType(event.target.value as LicensedType)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                    {(Object.keys(LICENSED_LABELS) as LicensedType[]).map((key) => <option key={key} value={key}>{LICENSED_LABELS[key]}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="onboard-license-source">Link nguồn model{licensedType !== 'OTHER' ? ' *' : ''}</Label>
                  <Input id="onboard-license-source" type="url" value={licenseSourceUrl} onChange={(event) => setLicenseSourceUrl(event.target.value)} placeholder="https://makerworld.com/…" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="onboard-license-proof">Link bằng chứng license</Label>
                  <Input id="onboard-license-proof" type="url" value={licenseProofUrl} onChange={(event) => setLicenseProofUrl(event.target.value)} placeholder="Ảnh chụp hoá đơn/license" />
                </div>
              </div>
            ) : null}
          </fieldset>
        </CardContent>
      </Card>

      {/* Block 3 — how it's sold */}
      <Card>
        <CardHeader><CardTitle>3. Hình thức bán &amp; giá</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset className="grid gap-2 sm:grid-cols-2" disabled={locked}>
            <legend className="sr-only">Hình thức bán</legend>
            <button type="button" role="radio" aria-checked={!isStock} onClick={() => setProductType('MADE_TO_ORDER')} className={choiceCard(!isStock)}>
              <Printer className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="flex flex-col"><span className="text-sm font-semibold">In theo yêu cầu</span><span className="text-xs text-muted-foreground">Khách đặt mới in · giao sau 1–2 ngày · không quản lý tồn.</span></span>
            </button>
            <button type="button" role="radio" aria-checked={isStock} onClick={() => setProductType('READY_STOCK')} className={choiceCard(isStock)}>
              <Package className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <span className="flex flex-col"><span className="text-sm font-semibold">Có sẵn, giao ngay</span><span className="text-xs text-muted-foreground">Hàng in sẵn trên kệ · nhập số lượng đang có.</span></span>
            </button>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={BASE_PRICE_INPUT_ID}>Giá bán niêm yết (đ)</Label>
              {/* Uncontrolled + onInput so the pricing assistant's "Dùng giá này" (DOM write + input event) is picked up. */}
              <Input
                id={BASE_PRICE_INPUT_ID}
                inputMode="numeric"
                autoComplete="off"
                placeholder="VD: 89000"
                defaultValue=""
                onInput={(event) => setBasePriceText(event.currentTarget.value)}
                disabled={locked}
                className="text-lg font-semibold tabular-nums"
              />
              <p className="text-xs text-muted-foreground">{basePrice ? `= ${formatVnd(basePrice)} · áp cho mọi màu, sửa riêng từng màu bên dưới nếu cần` : 'Giá chung cho mọi màu.'}</p>
            </div>
            {isStock && !variants.length ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="onboard-default-stock">Số lượng đang có trên kệ</Label>
                <Input id="onboard-default-stock" inputMode="numeric" value={defaultStockText} onChange={(event) => setDefaultStockText(digitsOnly(event.target.value))} disabled={locked} placeholder="0" className="tabular-nums" />
              </div>
            ) : null}
          </div>

          <details className="group rounded-lg border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium">
              Trợ lý tính giá (gram nhựa + giờ in → giá đề xuất)
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border p-3">
              <PricingCalculatorPanel materials={materials} config={pricingConfig} priceInputIds={[BASE_PRICE_INPUT_ID]} defaultPrinterProfileId="BAMBU_P2S" />
            </div>
          </details>

          <fieldset className="flex flex-col gap-2" disabled={locked}>
            <legend className="mb-1 text-sm font-medium">Màu nhựa (mỗi màu = 1 biến thể, tự sinh SKU)</legend>
            {colors.length ? (
              <div className="flex flex-wrap gap-2">
                {colors.map((option) => {
                  const active = selectedKeys.has(option.key);
                  return (
                    <button key={option.key} type="button" role="checkbox" aria-checked={active} onClick={() => toggleColor(option)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted/50'}`}>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-xs text-muted-foreground">Chưa có vật liệu nào khai báo màu — thêm màu tay bên dưới hoặc vào trang Vật liệu.</p>}
            <div className="flex gap-2">
              <Input value={customColor} onChange={(event) => setCustomColor(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomColor(); } }} maxLength={60} placeholder="Màu khác, VD: Silk Đồng" className="max-w-xs" aria-label="Thêm màu khác" />
              <Button type="button" variant="outline" size="sm" onClick={addCustomColor}><Plus className="mr-1 size-3.5" /> Thêm</Button>
            </div>
            {!variants.length ? <p className="text-xs text-muted-foreground">Không chọn màu → tạo 1 biến thể &quot;Mặc định&quot;.</p> : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left font-medium">Biến thể</th><th className="px-3 py-2 text-right font-medium">Giá riêng (đ)</th>{isStock ? <th className="px-3 py-2 text-right font-medium">Đang có</th> : null}<th className="w-8" /></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {variants.map((variant) => (
                      <tr key={variant.key}>
                        <td className="px-3 py-1.5"><Input value={variant.name} onChange={(event) => updateVariant(variant.key, { name: event.target.value })} maxLength={200} aria-label="Tên biến thể" className="h-8" /></td>
                        <td className="px-3 py-1.5"><Input inputMode="numeric" value={variant.priceText} onChange={(event) => updateVariant(variant.key, { priceText: digitsOnly(event.target.value) })} placeholder={basePrice ? basePrice.toLocaleString('vi-VN') : 'giá chung'} aria-label={`Giá ${variant.name}`} className="h-8 text-right tabular-nums" /></td>
                        {isStock ? <td className="px-3 py-1.5"><Input inputMode="numeric" value={variant.stockText} onChange={(event) => updateVariant(variant.key, { stockText: digitsOnly(event.target.value) })} placeholder="0" aria-label={`Tồn ${variant.name}`} className="h-8 w-20 text-right tabular-nums" /></td> : null}
                        <td className="pr-2"><button type="button" aria-label={`Bỏ ${variant.name}`} onClick={() => setVariants((previous) => previous.filter((v) => v.key !== variant.key))} className="rounded p-1 hover:bg-muted"><X className="size-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {needsWarehouse ? (
              <div className="flex max-w-xs flex-col gap-1.5">
                <Label htmlFor="onboard-warehouse">Nhập tồn vào kho</Label>
                <select id="onboard-warehouse" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  <option value="">— Chọn kho —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>
            ) : null}
          </fieldset>
        </CardContent>
      </Card>

      {/* Advanced */}
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
          Nâng cao: mô tả chi tiết, SEO, nổi bật (không bắt buộc)
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <fieldset className="flex flex-col gap-4 border-t border-border p-4" disabled={locked}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onboard-description">Mô tả chi tiết (Markdown)</Label>
            <Textarea id="onboard-description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={20000} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboard-seo-title">SEO title</Label>
              <Input id="onboard-seo-title" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} maxLength={200} placeholder="Để trống dùng tên sản phẩm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboard-seo-description">SEO description</Label>
              <Input id="onboard-seo-description" value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} maxLength={500} placeholder="Để trống dùng mô tả ngắn" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} className="size-4" /> Nổi bật trên trang chủ
          </label>
        </fieldset>
      </details>

      {createdProductId ? (
        <p className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-800 dark:text-sky-300">
          Sản phẩm đã được tạo (nháp). Thông tin đã khoá — sửa ở <Link href={`/admin/products/${createdProductId}`} className="font-medium underline">trang chi tiết</Link>; bấm lưu lại chỉ để tải tiếp ảnh / đăng bán.
        </p>
      ) : null}
      {error ? <p className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {progress ? <span className="mr-auto flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{progress}</span> : null}
        <Button type="submit" variant="outline" disabled={busy}>Lưu nháp</Button>
        <Button type="button" disabled={busy || licenseMode === 'UNKNOWN'} onClick={() => void save(true)} title={licenseMode === 'UNKNOWN' ? 'Mẫu chưa rõ bản quyền chỉ lưu nháp' : undefined}>
          Lưu &amp; đăng bán
        </Button>
      </div>
    </form>
  );
}
