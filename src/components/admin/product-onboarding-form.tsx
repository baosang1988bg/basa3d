'use client';

// Phase 52 P2/P3 — "Đăng sản phẩm mới" (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md).
// Three blocks in the order a print shop thinks: photos → what it is → how it's sold. Slug and SKUs are
// generated on the server; licence must be chosen (D8); opening stock is per colour (D9).
// Flow on save: create (DRAFT, replay-safe by requestId) → upload photos → optionally publish.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, ChevronDown, Cloud, ExternalLink, FolderOpen, HardDrive, Loader2, Mic, Package, Plus, Printer, Sparkles, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PricingCalculatorPanel, type PricingConfigOption, type PricingMaterialOption } from '@/components/admin/pricing-calculator-panel';
import { ProductImagePicker, type PickedImage } from '@/components/admin/product-image-picker';
import { slugify } from '@/lib/catalog/naming';
import { ProductImageUploadError, uploadProductImages } from '@/lib/uploads/product-image-upload';
import { createProductOnboardingAction, publishProductAction } from '@/app/basaadmin/(protected)/products/new/actions';
import { createCategoryInlineAction } from '@/app/basaadmin/(protected)/products/actions';
import { detectCategoryFromName, getCategoryIconEmoji, type CategoryOptionLike } from '@/lib/categories';

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

const COMMON_PREFIXES = ['Móc khoá', 'Mô hình Fidget', 'Decor để bàn', 'Giá đỡ', 'Khay / Hộp'];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function choiceCard(active: boolean) {
  return `flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:bg-muted/40'}`;
}

export function ProductOnboardingForm({
  categories,
  colors,
  warehouses,
  materials,
  pricingConfig,
  initialData,
}: {
  categories: CategoryOptionLike[];
  colors: ColorOption[];
  warehouses: { id: string; name: string; code: string }[];
  materials: PricingMaterialOption[];
  pricingConfig: PricingConfigOption | null;
  initialData?: {
    name?: string;
    basePrice?: number;
    sourceUrl?: string;
    description?: string;
    printLocalPath?: string;
    printDriveUrl?: string;
    /** Trend Radar verdict (ADR-0062 §5). Only COMMERCIAL_ALLOWED pre-selects "Có license". */
    licenseStatus?: string;
  };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const requestId = useRef<string | null>(null);

  // Block 1 — photos
  const [images, setImages] = useState<PickedImage[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [uploadedPaths, setUploadedPaths] = useState<Record<string, string>>({});

  // Block 2 — what it is
  const [name, setName] = useState(initialData?.name ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [categoriesList, setCategoriesList] = useState<CategoryOptionLike[]>(categories);
  const [autoCatReason, setAutoCatReason] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catCreating, setCatCreating] = useState(false);
  const userManuallyPickedCatRef = useRef(false);
  const [shortDescription, setShortDescription] = useState('');
  const prefillCanSell = Boolean(initialData?.sourceUrl) && initialData?.licenseStatus === 'COMMERCIAL_ALLOWED';
  const [licenseMode, setLicenseMode] = useState<LicenseMode>(
    initialData?.sourceUrl ? (prefillCanSell ? 'LICENSED' : 'UNKNOWN') : 'OWN_DESIGN',
  );
  const [licensedType, setLicensedType] = useState<LicensedType>(prefillCanSell ? 'CC_BY' : 'COMMERCIAL_LICENSE');
  const [licenseSourceUrl, setLicenseSourceUrl] = useState(initialData?.sourceUrl ?? '');
  const [licenseProofUrl, setLicenseProofUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState(initialData?.sourceUrl ?? '');
  const [printLocalPath, setPrintLocalPath] = useState(initialData?.printLocalPath ?? '');
  const [printDriveUrl, setPrintDriveUrl] = useState(initialData?.printDriveUrl ?? '');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Block 3 — how it's sold
  const [productType, setProductType] = useState<'MADE_TO_ORDER' | 'READY_STOCK'>('MADE_TO_ORDER');
  const [basePriceText, setBasePriceText] = useState(initialData?.basePrice ? String(initialData.basePrice) : '');
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [defaultStockText, setDefaultStockText] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : '');

  // Advanced
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // Submit
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  // AI Suggestions & Quick Flow
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState<'local_ollama' | 'ai_vision' | 'fallback' | null>(null);
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);
  const lastAnalyzedKeyRef = useRef<string | null>(null);

  // Success Notice when saving and adding next
  const [savedNotice, setSavedNotice] = useState<{
    productId: string;
    name: string;
    published: boolean;
    imageCount: number;
  } | null>(null);

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

  const primaryImage = images.find((i) => i.key === coverKey) || images[0];

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setSpeechSupported(true);
    }
  }, []);

  function toggleVoiceInput() {
    if (typeof window === 'undefined') return;
    type SpeechRecognitionEventLike = {
      results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
    };
    type SpeechRecognitionLike = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      onresult: ((event: SpeechRecognitionEventLike) => void) | null;
      start: () => void;
    };
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechConstructor = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    if (!SpeechConstructor) return;

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechConstructor();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          handleNameChange(transcript.trim());
          setTimeout(() => {
            const priceInput = document.getElementById(BASE_PRICE_INPUT_ID);
            if (priceInput) priceInput.focus();
          }, 80);
        }
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  }


  async function runAiSuggestion(blob: Blob, key: string, force = false) {
    if (!force && lastAnalyzedKeyRef.current === key) return;
    lastAnalyzedKeyRef.current = key;
    setAiLoading(true);
    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch('/api/admin/catalog/ai-suggest-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: blob.type || 'image/jpeg',
          categories: categories.map((c) => ({ id: c.id, name: c.label })),
          hint: name.trim() || undefined,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: {
            suggestedNames?: string[];
            suggestedCategoryId?: string | null;
            suggestedShortDescription?: string | null;
            source?: 'local_ollama' | 'ai_vision' | 'fallback';
          };
        };
        if (json?.data) {
          const { suggestedNames: names, suggestedCategoryId, suggestedShortDescription, source } = json.data;
          if (source) setAiSource(source);
          if (Array.isArray(names) && names.length > 0) {
            setSuggestedNames(names);
          }
          if (suggestedCategoryId && !userManuallyPickedCatRef.current) {
            const foundCat = categoriesList.find((c) => c.id === suggestedCategoryId);
            if (foundCat) setAutoCatReason(`AI nhận diện: "${foundCat.label}"`);
            setCategoryId(suggestedCategoryId);
          }
          if (suggestedShortDescription && !shortDescription.trim()) {
            setShortDescription(suggestedShortDescription);
          }
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (primaryImage?.blob && !primaryImage.error && !name.trim() && lastAnalyzedKeyRef.current !== primaryImage.key) {
      void runAiSuggestion(primaryImage.blob, primaryImage.key);
    }
  }, [primaryImage?.blob, primaryImage?.key, primaryImage?.error, name]);

  function handleNameChange(newName: string) {
    setName(newName);
    if (!userManuallyPickedCatRef.current) {
      const detected = detectCategoryFromName(newName, categoriesList);
      if (detected && detected.categoryId !== categoryId) {
        setCategoryId(detected.categoryId);
        setAutoCatReason(`Tự động chọn "${detected.categoryLabel}"`);
      }
    }
  }

  async function handleCreateCategoryInline() {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    setCatCreating(true);
    try {
      const res = await createCategoryInlineAction({ name: trimmed });
      if (res.ok && res.data) {
        const newCat: CategoryOptionLike = {
          id: res.data.id,
          label: res.data.name,
          slug: res.data.slug,
        };
        setCategoriesList((prev) => [...prev, newCat]);
        setCategoryId(newCat.id);
        userManuallyPickedCatRef.current = true;
        setAutoCatReason(`Đã tạo & chọn: "${newCat.label}"`);
        setNewCatName('');
        setShowAddCategory(false);
      }
    } finally {
      setCatCreating(false);
    }
  }

  function applySuggestedName(suggested: string) {
    handleNameChange(suggested);
    setTimeout(() => {
      const priceInput = document.getElementById(BASE_PRICE_INPUT_ID);
      if (priceInput) priceInput.focus();
    }, 50);
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
      licenseSourceUrl: (licenseMode === 'LICENSED' ? licenseSourceUrl.trim() : sourceUrl.trim()) || null,
      licenseProofUrl: licenseMode === 'LICENSED' ? licenseProofUrl.trim() || null : null,
      printLocalPath: printLocalPath.trim() || null,
      printDriveUrl: printDriveUrl.trim() || null,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      isFeatured,
      warehouseId: warehouseId || null,
      variants: variantPayload,
    };
  }

  async function save(publish: boolean, addNext = false) {
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
      if (addNext) {
        setSavedNotice({
          productId,
          name: name.trim() || 'Sản phẩm mới',
          published,
          imageCount: ready.length,
        });
        setImages([]);
        setCoverKey(null);
        setUploadedPaths({});
        setName('');
        setShortDescription('');
        setDescription('');
        setBasePriceText('');
        setDefaultStockText('');
        setVariants([]);
        setCreatedProductId(null);
        setSuggestedNames([]);
        setAiSource(null);
        setPrintLocalPath('');
        setPrintDriveUrl('');
        setSourceUrl('');
        userManuallyPickedCatRef.current = false;
        setAutoCatReason(null);
        setShowAddCategory(false);
        lastAnalyzedKeyRef.current = null;
        requestId.current = null;
        const priceInput = document.getElementById(BASE_PRICE_INPUT_ID) as HTMLInputElement | null;
        if (priceInput) priceInput.value = '';
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        setDone({ productId, published, reasons, imageCount: ready.length });
      }
    } catch {
      setError('Mất kết nối tới máy chủ. Bấm lưu lại — hệ thống sẽ không tạo trùng sản phẩm.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!busy && !createdProductId) {
          void save(licenseMode !== 'UNKNOWN' && Boolean(basePrice && basePrice > 0), true);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    busy,
    createdProductId,
    licenseMode,
    basePrice,
    images,
    name,
    categoryId,
    warehouseId,
    variants,
    defaultStockText,
    shortDescription,
    description,
    seoTitle,
    seoDescription,
    isFeatured,
  ]);

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
            <Link href={`/basaadmin/products/${done.productId}`} className={buttonVariants({ size: 'sm' })}>Mở trang chi tiết</Link>
            <a href="/basaadmin/products/new" className={buttonVariants({ size: 'sm', variant: 'outline' })}>Đăng sản phẩm khác</a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form ref={formRef} className="flex flex-col gap-6" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
      {savedNotice ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-950 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-semibold">
                Đã lưu thành công: &ldquo;{savedNotice.name}&rdquo; ({savedNotice.published ? 'Đã đăng bán' : 'Bản nháp'}, {savedNotice.imageCount} ảnh).
              </p>
              <p className="text-xs text-muted-foreground">Khung đã được làm mới — hãy thả ảnh sản phẩm tiếp theo vào bên dưới.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/basaadmin/products/${savedNotice.productId}`}
              target="_blank"
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-8 text-xs' })}
            >
              Xem chi tiết
            </Link>
            <button
              type="button"
              onClick={() => setSavedNotice(null)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Đóng thông báo"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
      {/* Quick Staff Guide (Collapsible) */}
      <details className="group rounded-xl border border-primary/25 bg-primary/5 transition-all">
        <summary className="flex cursor-pointer items-center justify-between p-3.5 text-xs font-semibold text-primary select-none hover:bg-primary/10 rounded-xl">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 shrink-0 text-primary" />
            <span>📖 Hướng dẫn nhanh cho Staff: 4 bước đăng sản phẩm siêu tốc (10–15s/món)</span>
          </div>
          <span className="text-[11px] text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="border-t border-primary/15 p-4 pt-3 flex flex-col gap-3 text-xs text-foreground bg-background/50 rounded-b-xl">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 shadow-2xs">
              <span className="font-semibold text-primary flex items-center gap-1.5">
                📸 1. Thả ảnh (AI Vision)
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Kéo ảnh mẫu in vào khung ảnh. Card đồ họa RTX 4060 quét ảnh trong ~300ms và gợi ý 3 tên tiếng Việt chuẩn SEO.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 shadow-2xs">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                🎙️ 2. Đặt tên (Click / Nói)
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Click 1 tên gợi ý HOẶC bấm nút <strong>&quot;Nói tên&quot;</strong> để đọc tiếng Việt. Danh mục sẽ tự động gán và con trỏ tự nhảy sang ô Giá!
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 shadow-2xs">
              <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                ⌨️ 3. Phím tắt Ctrl + Enter
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Gõ giá bán xong bấm tổ hợp <strong>Ctrl + Enter</strong> (Mac: <strong>Cmd + Enter</strong>) để Lưu &amp; làm mới form cho món kế tiếp ngay lập tức.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 shadow-2xs">
              <span className="font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                📁 4. Nơi lưu file in xưởng
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Điền đường dẫn file trên máy tính xưởng (VD: <code className="text-[10px] bg-muted px-1 rounded">D:\3D_Models\...</code>) để thợ mở Bambu Studio in ngay.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
            <span>💡 <strong>Mẹo:</strong> Nếu chạy web trên mạng mà muốn dùng GPU RTX 4060 ở xưởng, hãy chạy file <code className="font-mono text-primary bg-muted px-1 rounded">Mo_Cong_Ollama_Cloudflare.bat</code>.</span>
            <span className="text-primary font-medium">Bấm lại thanh tiêu đề để thu gọn</span>
          </div>
        </div>
      </details>

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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="onboard-name" className="flex items-center gap-1.5">
                    Tên sản phẩm <span className="text-rose-600">*</span>
                  </Label>
                  {speechSupported ? (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={toggleVoiceInput}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-all ${
                        isListening
                          ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30 animate-pulse'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                      }`}
                      title={isListening ? 'Đang nghe... bấm để dừng' : 'Nói tên sản phẩm bằng giọng nói (tiếng Việt)'}
                    >
                      <Mic className={`size-3.5 ${isListening ? 'text-rose-600 animate-bounce' : ''}`} />
                      {isListening ? 'Đang nghe…' : 'Nói tên'}
                    </button>
                  ) : null}
                </div>
                {primaryImage?.blob ? (
                  <button
                    type="button"
                    disabled={aiLoading || locked}
                    onClick={() => primaryImage?.blob && void runAiSuggestion(primaryImage.blob, primaryImage.key, true)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="size-3 animate-spin" /> Đang nhận diện ảnh…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3" /> Nhận diện lại từ ảnh
                      </>
                    )}
                  </button>
                ) : null}
              </div>
              <Input id="onboard-name" value={name} onChange={(event) => handleNameChange(event.target.value)} maxLength={200} disabled={locked} placeholder="VD: Móc khoá mèo Shiba" autoFocus />
              {slugPreview ? <p className="truncate font-mono text-[11px] text-muted-foreground">/products/{slugPreview}</p> : null}

              {aiLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                  <span>AI đang quan sát ảnh mẫu in để gợi ý 3 tên tiếng Việt chuẩn SEO…</span>
                </div>
              ) : suggestedNames.length > 0 ? (
                <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-2.5">
                  <div className="flex items-center justify-between text-xs font-medium text-foreground">
                    <span className="flex items-center gap-1 text-primary font-semibold">
                      <Sparkles className="size-3.5" /> Gợi ý tên từ ảnh (chọn 1 tên để điền nhanh &amp; nhảy tới Giá):
                    </span>
                    {aiSource === 'local_ollama' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/25" title="Chạy bằng LLaVA cục bộ trên card RTX 4060 - 0 tốn token, bảo mật 100%">
                        ⚡ AI Local (RTX 4060)
                      </span>
                    ) : aiSource === 'ai_vision' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300 border border-sky-500/25" title="Chạy qua Cloud Gemini Vision">
                        ✨ Cloud Gemini
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedNames.map((sName) => (
                      <button
                        key={sName}
                        type="button"
                        onClick={() => applySuggestedName(sName)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95 ${
                          name === sName
                            ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                            : 'border-border bg-background hover:border-primary/50 hover:bg-muted text-foreground'
                        }`}
                      >
                        + {sName}
                      </button>
                    ))}
                  </div>
                </div>
              ) : !name.trim() ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-muted-foreground">Tiền tố nhanh:</span>
                  {COMMON_PREFIXES.map((prefix) => (
                    <button
                      key={prefix}
                      type="button"
                      onClick={() => {
                        handleNameChange(`${prefix} `);
                        document.getElementById('onboard-name')?.focus();
                      }}
                      className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
                    >
                      + {prefix}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="onboard-category" className="flex items-center gap-1.5 text-sm font-medium">
                  Danh mục <span className="text-rose-600">*</span>
                </Label>
                {autoCatReason ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                    <Sparkles className="size-3 shrink-0" /> {autoCatReason}
                  </span>
                ) : null}
              </div>

              {/* Interactive Category Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {categoriesList.map((category) => {
                  const active = categoryId === category.id;
                  const icon = getCategoryIconEmoji(category.label);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        userManuallyPickedCatRef.current = true;
                        setCategoryId(category.id);
                        setAutoCatReason(null);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20'
                          : 'border-border bg-muted/40 hover:bg-muted hover:border-primary/40 text-foreground'
                      }`}
                    >
                      <span className="text-sm leading-none">{icon}</span>
                      <span>{category.label}</span>
                    </button>
                  );
                })}

                {!showAddCategory ? (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setShowAddCategory(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground active:scale-95 transition-all"
                    title="Tạo nhanh danh mục mới ngay tại đây"
                  >
                    <Plus className="size-3" /> Thêm mục
                  </button>
                ) : null}
              </div>

              {/* Inline Add Category input */}
              {showAddCategory ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1.5 animate-in fade-in">
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Tên danh mục mới (VD: Cosplay, Dụng cụ)…"
                    maxLength={60}
                    className="h-7 text-xs max-w-xs bg-background"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleCreateCategoryInline();
                      } else if (e.key === 'Escape') {
                        setShowAddCategory(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={catCreating || !newCatName.trim()}
                    onClick={() => void handleCreateCategoryInline()}
                    className="h-7 px-2.5 text-xs"
                  >
                    {catCreating ? <Loader2 className="size-3 animate-spin" /> : 'Tạo'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(false)}
                    className="px-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              ) : null}
              <select id="onboard-category" value={categoryId} onChange={(event) => { userManuallyPickedCatRef.current = true; setCategoryId(event.target.value); setAutoCatReason(null); }} disabled={locked} className="sr-only" aria-hidden="true" tabIndex={-1}>
                <option value="">— Chọn danh mục —</option>
                {categoriesList.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
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

          {/* File lưu trữ & Nguồn mẫu (Tuỳ chọn cho xưởng) */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <FolderOpen className="size-4 text-primary" /> Lưu trữ file 3D &amp; Nguồn model (Tuỳ chọn):
              </span>
              <span className="text-[11px] text-muted-foreground">Lưu đường dẫn máy xưởng hoặc Drive để khi có đơn thợ mở in ngay</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="onboard-source-url" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <ExternalLink className="size-3" /> Link nguồn mẫu (MakerWorld/Web)
                </Label>
                <Input
                  id="onboard-source-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSourceUrl(val);
                    if (licenseMode === 'LICENSED') setLicenseSourceUrl(val);
                  }}
                  disabled={locked}
                  placeholder="https://makerworld.com/…"
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="onboard-local-path" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <HardDrive className="size-3" /> Nơi lưu file trên máy xưởng (Local)
                </Label>
                <Input
                  id="onboard-local-path"
                  value={printLocalPath}
                  onChange={(e) => setPrintLocalPath(e.target.value)}
                  disabled={locked}
                  placeholder="VD: D:\3D_Models\MocKhoa\meo.3mf"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="onboard-drive-url" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Cloud className="size-3" /> Link Google Drive file 3D
                </Label>
                <Input
                  id="onboard-drive-url"
                  type="url"
                  value={printDriveUrl}
                  onChange={(e) => setPrintDriveUrl(e.target.value)}
                  disabled={locked}
                  placeholder="https://drive.google.com/…"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>
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
          Sản phẩm đã được tạo (nháp). Thông tin đã khoá — sửa ở <Link href={`/basaadmin/products/${createdProductId}`} className="font-medium underline">trang chi tiết</Link>; bấm lưu lại chỉ để tải tiếp ảnh / đăng bán.
        </p>
      ) : null}
      {error ? <p className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {progress ? <span className="mr-auto flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{progress}</span> : null}
        <Button type="submit" variant="outline" disabled={busy}>Lưu nháp</Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void save(licenseMode !== 'UNKNOWN' && Boolean(basePrice && basePrice > 0), true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium active:scale-[0.98] transition-all"
          title="Lưu sản phẩm hiện tại và làm mới khung để tiếp tục thêm món tiếp theo (Phím tắt: Ctrl + Enter)"
        >
          Lưu &amp; Thêm tiếp <span className="ml-1 text-[11px] opacity-80">(Ctrl+Enter)</span>
        </Button>
        <Button type="button" disabled={busy || licenseMode === 'UNKNOWN'} onClick={() => void save(true)} title={licenseMode === 'UNKNOWN' ? 'Mẫu chưa rõ bản quyền chỉ lưu nháp' : undefined}>
          Lưu &amp; đăng bán
        </Button>
      </div>
    </form>
  );
}
