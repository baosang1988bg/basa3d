'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  ImageOff,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  Split,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductImageUploader } from '@/components/admin/product-image-picker';
import type { StaffRole } from '@/lib/auth/require-admin';
import {
  assignImageVariantAction,
  createVariantInlineAction,
  deleteImageInlineAction,
  deleteVariantInlineAction,
  duplicateVariantInlineAction,
  quickUpdateCatalogProductAction,
  saveVariantInlineAction,
  setProductCoverInlineAction,
  splitVariantToProductAction,
} from '@/app/basaadmin/(protected)/products/actions';

export type DetailVariantRow = {
  id: string;
  sku: string;
  name: string;
  price: number;
  weightGrams: number | null;
  isActive: boolean;
  printLocalPath: string | null;
  printDriveUrl: string | null;
};

export type DetailImageRow = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  variantId: string | null;
};

const digitsOnly = (v: string) => v.replace(/[^\d]/g, '');

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang bán', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  DRAFT: { label: 'Nháp', className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  ARCHIVED: { label: 'Đã lưu trữ', className: 'border-border bg-muted text-muted-foreground' },
};

export function ProductDetailVariantsAndImages({
  productId,
  productName,
  productSlug,
  productStatus = 'DRAFT',
  categoryId,
  productType = 'MADE_TO_ORDER',
  shortDescription,
  isFeatured = false,
  categories = [],
  categoryName,
  basePrice,
  role,
  variants,
  images,
}: {
  productId: string;
  productName: string;
  productSlug?: string;
  productStatus?: string;
  categoryId?: string | null;
  productType?: string | null;
  shortDescription?: string | null;
  isFeatured?: boolean;
  categories?: { id: string; name: string }[];
  categoryName?: string | null;
  basePrice?: number | null;
  role: StaffRole;
  variants: DetailVariantRow[];
  images: DetailImageRow[];
}) {
  const router = useRouter();
  const isOwner = role === 'OWNER';
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string; link?: { href: string; label: string } } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Drafts for inline editing
  const [drafts, setDrafts] = useState<Record<string, { name: string; priceText: string; weightText: string; isActive: boolean; printLocalPath: string; printDriveUrl: string }>>(() => {
    const init: Record<string, { name: string; priceText: string; weightText: string; isActive: boolean; printLocalPath: string; printDriveUrl: string }> = {};
    for (const v of variants) {
      init[v.id] = {
        name: v.name,
        priceText: String(v.price),
        weightText: v.weightGrams != null ? String(v.weightGrams) : '',
        isActive: v.isActive,
        printLocalPath: v.printLocalPath ?? '',
        printDriveUrl: v.printDriveUrl ?? '',
      };
    }
    return init;
  });

  const effectiveDraft = (v: DetailVariantRow) => drafts[v.id] ?? {
    name: v.name,
    priceText: String(v.price),
    weightText: v.weightGrams != null ? String(v.weightGrams) : '',
    isActive: v.isActive,
    printLocalPath: v.printLocalPath ?? '',
    printDriveUrl: v.printDriveUrl ?? '',
  };

  // Live range giá calculated from all children (min to max)
  const allVariantPrices = useMemo(() => {
    return variants
      .map((v) => {
        const d = drafts[v.id];
        if (d?.priceText) {
          const p = Number(digitsOnly(d.priceText));
          return Number.isSafeInteger(p) && p > 0 ? p : null;
        }
        return v.price > 0 ? v.price : null;
      })
      .filter((p): p is number => p !== null);
  }, [variants, drafts]);

  const rangeMin = allVariantPrices.length ? Math.min(...allVariantPrices) : basePrice;
  const rangeMax = allVariantPrices.length ? Math.max(...allVariantPrices) : basePrice;

  const rangeLabel = useMemo(() => {
    if (rangeMin != null && rangeMax != null) {
      if (rangeMin === rangeMax) return `${rangeMin.toLocaleString('vi-VN')} ₫`;
      return `${rangeMin.toLocaleString('vi-VN')} ₫ – ${rangeMax.toLocaleString('vi-VN')} ₫`;
    }
    return 'Chưa có giá';
  }, [rangeMin, rangeMax]);

  const coverImage = images[0] ?? null;
  const parentBadge = STATUS_BADGE[productStatus] ?? STATUS_BADGE.DRAFT;

  // Dialog state for photo selection
  const [photoPickerVariantId, setPhotoPickerVariantId] = useState<string | null>(null);

  // Dialog state for splitting variant into standalone product
  const [splitTarget, setSplitTarget] = useState<DetailVariantRow | null>(null);
  const [splitNewName, setSplitNewName] = useState('');
  const [splitDeleteOriginal, setSplitDeleteOriginal] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  // Parent quick edit dialog state
  const [isEditParentOpen, setIsEditParentOpen] = useState(false);
  const [parentName, setParentName] = useState(productName);
  const [parentCategoryId, setParentCategoryId] = useState(categoryId ?? '');
  const [parentProductType, setParentProductType] = useState<string>(productType ?? 'MADE_TO_ORDER');
  const [parentStatus, setParentStatus] = useState(productStatus);
  const [parentShortDesc, setParentShortDesc] = useState(shortDescription ?? '');
  const [parentIsFeatured, setParentIsFeatured] = useState(isFeatured);
  const [isSavingParent, setIsSavingParent] = useState(false);

  // Quick Cover (Avatar) Selector State
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);

  const handleSaveParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim()) {
      setNotice({ tone: 'error', text: 'Tên sản phẩm cha không được để trống.' });
      return;
    }
    setIsSavingParent(true);
    try {
      const res = await quickUpdateCatalogProductAction({
        productId,
        name: parentName.trim(),
        categoryId: parentCategoryId || null,
        productType: parentProductType as 'READY_STOCK' | 'MADE_TO_ORDER',
        status: parentStatus as 'ACTIVE' | 'DRAFT' | 'ARCHIVED',
        shortDescription: parentShortDesc.trim() || null,
        isFeatured: parentIsFeatured,
      });
      if (!res.ok) {
        setNotice({ tone: 'error', text: res.error || 'Cập nhật thất bại' });
        return;
      }
      setNotice({ tone: 'ok', text: 'Đã cập nhật thông tin sản phẩm cha thành công!' });
      setIsEditParentOpen(false);
      router.refresh();
    } catch {
      setNotice({ tone: 'error', text: 'Lỗi không xác định khi cập nhật sản phẩm cha.' });
    } finally {
      setIsSavingParent(false);
    }
  };

  const handleSetCover = (imageId: string) => {
    startTransition(async () => {
      const res = await setProductCoverInlineAction(productId, imageId);
      if (res.ok) {
        setNotice({ tone: 'ok', text: 'Đã đổi ảnh đại diện (AVT) của sản phẩm cha.' });
        setIsCoverPickerOpen(false);
        router.refresh();
      } else {
        setNotice({ tone: 'error', text: res.error });
      }
    });
  };

  // Form state for creating a new variant
  const [newName, setNewName] = useState('');
  const [newPriceText, setNewPriceText] = useState('');
  const [newWeightText, setNewWeightText] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newPrintLocalPath, setNewPrintLocalPath] = useState('');
  const [newPrintDriveUrl, setNewPrintDriveUrl] = useState('');
  const [newSelectedImageId, setNewSelectedImageId] = useState<string>('');

  const imageByVariant = useMemo(() => {
    const map = new Map<string, DetailImageRow>();
    for (const img of images) {
      if (img.variantId && !map.has(img.variantId)) map.set(img.variantId, img);
    }
    return map;
  }, [images]);

  const filteredVariants = useMemo(() => {
    if (!searchQuery.trim()) return variants;
    const q = searchQuery.trim().toLowerCase();
    return variants.filter((v) => v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q));
  }, [variants, searchQuery]);

  function updateDraft(variant: DetailVariantRow, patch: Partial<{ name: string; priceText: string; weightText: string; isActive: boolean; printLocalPath: string; printDriveUrl: string }>) {
    const cur = effectiveDraft(variant);
    setDrafts((prev) => ({ ...prev, [variant.id]: { ...cur, ...patch } }));
  }

  async function saveVariant(variant: DetailVariantRow) {
    const d = effectiveDraft(variant);
    const price = Number(digitsOnly(d.priceText));
    if (!d.name.trim()) { setNotice({ tone: 'error', text: 'Tên sản phẩm con không được để trống.' }); return; }
    if (!Number.isSafeInteger(price) || price < 0) { setNotice({ tone: 'error', text: 'Giá sản phẩm con phải ≥ 0.' }); return; }
    const weight = d.weightText.trim() ? Number(digitsOnly(d.weightText)) : null;

    setBusyId(variant.id);
    setNotice(null);
    try {
      const res = await saveVariantInlineAction(productId, variant.id, {
        name: d.name.trim(),
        price,
        weightGrams: weight,
        isActive: d.isActive,
        printLocalPath: d.printLocalPath.trim() || null,
        printDriveUrl: d.printDriveUrl.trim() || null,
      });
      if (!res.ok) { setNotice({ tone: 'error', text: res.error }); return; }
      setSavedId(variant.id);
      setTimeout(() => setSavedId((cur) => (cur === variant.id ? null : cur)), 2000);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssignVariantImage(variantId: string, imageId: string | null) {
    setBusyId(variantId);
    setNotice(null);
    try {
      const currentLinked = imageByVariant.get(variantId);
      if (currentLinked && currentLinked.id !== imageId) {
        await assignImageVariantAction(productId, currentLinked.id, null);
      }
      if (imageId) {
        const res = await assignImageVariantAction(productId, imageId, variantId);
        if (!res.ok) { setNotice({ tone: 'error', text: res.error }); return; }
      }
      setNotice({ tone: 'ok', text: imageId ? 'Đã gắn ảnh riêng cho sản phẩm con.' : 'Đã bỏ gắn ảnh riêng.' });
      setPhotoPickerVariantId(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDuplicateVariant(variant: DetailVariantRow) {
    setBusyId(variant.id);
    setNotice(null);
    try {
      const res = await duplicateVariantInlineAction(productId, variant.id);
      if (!res.ok) { setNotice({ tone: 'error', text: res.error }); return; }
      setNotice({ tone: 'ok', text: `Đã nhân bản "${variant.name}" thành sản phẩm con mới (${res.data.name}).` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmSplit() {
    if (!splitTarget) return;
    setIsSplitting(true);
    setNotice(null);
    try {
      const res = await splitVariantToProductAction(productId, splitTarget.id, {
        newProductName: splitNewName.trim() || undefined,
        deleteOriginal: splitDeleteOriginal,
      });
      if (!res.ok) { setNotice({ tone: 'error', text: res.error }); return; }
      setNotice({
        tone: 'ok',
        text: `Đã tách thành công sản phẩm mới "${res.data.name}"!`,
        link: { href: `/basaadmin/products/${res.data.productId}`, label: 'Xem sản phẩm mới' },
      });
      setSplitTarget(null);
      router.refresh();
    } finally {
      setIsSplitting(false);
    }
  }

  async function handleDeleteVariant(variant: DetailVariantRow) {
    if (variants.length <= 1) {
      alert('Không thể xoá sản phẩm con duy nhất. Mỗi sản phẩm phải có ít nhất 1 biến thể/mẫu.');
      return;
    }
    if (!window.confirm(`Xoá hẳn sản phẩm con "${variant.name}" (${variant.sku})?`)) return;
    setBusyId(variant.id);
    setNotice(null);
    try {
      const res = await deleteVariantInlineAction(productId, variant.id);
      if (!res.ok) { setNotice({ tone: 'error', text: res.error }); return; }
      setNotice({ tone: 'ok', text: `Đã xoá sản phẩm con "${variant.name}".` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateVariant(event: React.FormEvent) {
    event.preventDefault();
    const price = Number(digitsOnly(newPriceText));
    if (!newName.trim() || !Number.isSafeInteger(price) || price < 0) {
      setNotice({ tone: 'error', text: 'Nhập tên và giá hợp lệ cho sản phẩm con mới.' });
      return;
    }
    const weight = newWeightText.trim() ? Number(digitsOnly(newWeightText)) : null;
    startTransition(async () => {
      const res = await createVariantInlineAction(productId, {
        sku: newSku.trim() || undefined,
        name: newName.trim(),
        price,
        weightGrams: weight,
        printLocalPath: newPrintLocalPath.trim() || null,
        printDriveUrl: newPrintDriveUrl.trim() || null,
      });
      if (!res.ok) { setNotice({ tone: 'error', text: res.error }); return; }

      // If staff pre-selected an image for this new variant
      if (newSelectedImageId) {
        await assignImageVariantAction(productId, newSelectedImageId, res.data.id);
      }

      setNewSku('');
      setNewName('');
      setNewPriceText('');
      setNewWeightText('');
      setNewPrintLocalPath('');
      setNewPrintDriveUrl('');
      setNewSelectedImageId('');
      setNotice({ tone: 'ok', text: 'Đã thêm sản phẩm con mới.' });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-sm transition-all ${
            notice.tone === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notice.text}</span>
            {notice.link ? (
              <Link
                href={notice.link.href}
                className="font-medium underline underline-offset-2 hover:opacity-80"
              >
                {notice.link.label} &rarr;
              </Link>
            ) : null}
          </div>
          <button type="button" onClick={() => setNotice(null)} aria-label="Đóng" className="p-1 hover:opacity-70">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/* SẢN PHẨM CHA (PARENT PRODUCT) - ĐẠI DIỆN NGOÀI WEB & CATALOG */}
      {/* ============================================================ */}
      <Card className="border-2 border-primary/45 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground font-bold text-xs gap-1.5 px-2.5 py-0.5">
              <Package className="size-3.5" /> SẢN PHẨM CHA
            </Badge>
            <span className="text-xs font-semibold text-foreground">
              Hình ảnh đại diện ở ngoài web &amp; danh mục
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`text-[11px] ${parentBadge.className}`}>
              {parentBadge.label}
            </Badge>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsEditParentOpen(true)}
              className="h-7 gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-xs"
            >
              <Pencil className="size-3" /> Sửa sản phẩm cha
            </Button>
            <a
              href="#thong-tin"
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-7 gap-1 text-xs' })}
            >
              <FileText className="size-3" /> Chi tiết &amp; SEO ↓
            </a>
            {productSlug ? (
              <Link
                href={`/vi/products/${productSlug}`}
                target="_blank"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <span>Xem ngoài web</span>
                <ExternalLink className="size-3" />
              </Link>
            ) : null}
          </div>
        </div>

        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
            {/* 1. AVATAR / ẢNH ĐẠI DIỆN CỦA CHA */}
            <div className="flex flex-col items-center gap-1.5 shrink-0 self-center sm:self-start">
              <div className="group relative size-28 sm:size-32 rounded-2xl border-2 border-primary/50 bg-muted overflow-hidden shadow-sm flex items-center justify-center">
                {coverImage ? (
                  <img src={coverImage.url} alt={productName} className="size-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground p-2 text-center">
                    <ImageOff className="size-7 text-muted-foreground/50" />
                    <span className="text-[11px] font-medium">Chưa có ảnh đại diện</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsCoverPickerOpen(true)}
                  className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-medium gap-1 text-center p-2"
                  title="Nhấp để đổi ảnh đại diện (AVT)"
                >
                  <Camera className="size-4" />
                  <span>Đổi AVT cha</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsCoverPickerOpen(true)}
                className="text-[11px] font-semibold text-primary hover:underline uppercase tracking-wider flex items-center gap-1 mt-0.5"
              >
                <Star className="size-3 fill-primary" /> Ảnh đại diện (AVT) · <span className="underline">Đổi ảnh</span>
              </button>
            </div>

            {/* 2. NAME & RANGE GIÁ */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              {/* NAME */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Tên sản phẩm cha (NAME đại diện ngoài web)
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditParentOpen(true)}
                    className="h-6 px-2 text-xs text-primary hover:bg-primary/10 gap-1"
                  >
                    <Pencil className="size-3" /> Sửa nhanh
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate" title={productName}>
                    {productName}
                  </h2>
                </div>
                {shortDescription ? (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {shortDescription}
                  </p>
                ) : null}
              </div>

              {/* 3. RANGE GIÁ TỪ TOÀN BỘ CÁC CON */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 flex flex-col">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Range giá đại diện ngoài web (Min – Max)
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-lg sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {rangeLabel}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      ({variants.length} sản phẩm con)
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Layers className="size-3.5 text-primary" />
                    <span>Gồm <strong>{variants.length} sản phẩm con</strong> ({variants.filter(v => drafts[v.id]?.isActive ?? v.isActive).length} đang bán)</span>
                  </div>
                  {categoryName ? (
                    <div>
                      Danh mục: <strong className="text-foreground">{categoryName}</strong>
                    </div>
                  ) : (
                    <div className="text-amber-600 font-medium">
                      Chưa gán danh mục
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span>Hình thức: <strong className="text-foreground">{productType === 'READY_STOCK' ? 'Có sẵn' : 'In theo yêu cầu'}</strong></span>
                    {isFeatured ? <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">Nổi bật</Badge> : null}
                  </div>
                  <p className="text-[11px] italic text-muted-foreground/80">
                    * Range giá tự động tính toán từ toàn bộ giá của các sản phẩm con bên dưới.
                  </p>
                </div>
              </div>

              {/* Direct Edit Shortcuts on Parent Card */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsEditParentOpen(true)}
                  className="gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs text-xs h-8"
                >
                  <Pencil className="size-3.5" /> Chỉnh sửa sản phẩm cha
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCoverPickerOpen(true)}
                  className="gap-1.5 text-xs h-8"
                >
                  <Camera className="size-3.5" /> Đổi ảnh bìa đại diện
                </Button>
                <a
                  href="#thong-tin"
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-1.5 text-xs h-8' })}
                >
                  <FileText className="size-3.5" /> Sửa chi tiết &amp; SEO (#thong-tin) ↓
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Hierarchy Connector (Cha -> Các con) */}
      <div className="flex items-center justify-center -my-3 z-10">
        <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-background px-4 py-1 text-xs font-semibold text-primary shadow-xs">
          <span>↓ Gồm {variants.length} sản phẩm con trực thuộc bên dưới ↓</span>
        </div>
      </div>

      {/* Sub-Products / Variants List */}
      <Card id="san-pham-con" className="border-border shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="size-5 text-primary" />
                <span>Danh sách sản phẩm con / Biến thể ({variants.length})</span>
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Mỗi biến thể được quản lý như 1 sản phẩm con: có hình ảnh riêng, mã SKU, giá bán, trọng lượng và file in xưởng 3MF.
              </p>
            </div>

            {/* Quick search if multiple variants */}
            {variants.length > 3 ? (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên hoặc SKU..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          {filteredVariants.map((variant, index) => {
            const d = effectiveDraft(variant);
            const linkedImg = imageByVariant.get(variant.id);
            const isBusy = busyId === variant.id;
            const isSaved = savedId === variant.id;

            return (
              <div
                key={variant.id}
                className={`group relative flex flex-col gap-3 rounded-xl border p-3.5 transition-all ${
                  d.isActive
                    ? 'border-border bg-card shadow-xs hover:border-primary/40'
                    : 'border-border/60 bg-muted/20 opacity-80'
                }`}
              >
                <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
                  {/* Left: Thumbnail & Image Action */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setPhotoPickerVariantId(variant.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setPhotoPickerVariantId(variant.id); }}
                      className="group/thumb relative flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/60 transition-colors hover:border-primary"
                      title="Bấm để chọn hoặc đổi ảnh cho sản phẩm con này"
                    >
                      {linkedImg ? (
                        <img src={linkedImg.url} alt="" className="size-full object-cover transition-transform group-hover/thumb:scale-105" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImageOff className="size-5" />
                          <span className="text-[10px]">Chưa có ảnh</span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/thumb:opacity-100">
                        <span className="text-[10px] font-medium text-white flex items-center gap-1">
                          <ImageIcon className="size-3" /> Đổi ảnh
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={isBusy}
                      onClick={() => setPhotoPickerVariantId(variant.id)}
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <ImageIcon className="mr-1 size-3" /> {linkedImg ? 'Đổi ảnh' : 'Gắn ảnh'}
                    </Button>
                  </div>

                  {/* Center: Details */}
                  <div className="grid flex-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Variant Name */}
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`v-name-${variant.id}`} className="text-xs font-semibold text-foreground">
                          Tên sản phẩm con #{index + 1}
                        </Label>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          <span className="bg-muted px-1.5 py-0.5 rounded border border-border/60" title="Mã SKU">{variant.sku}</span>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(variant.sku);
                              setNotice({ tone: 'ok', text: `Đã copy mã SKU: ${variant.sku}` });
                            }}
                            className="p-1 hover:text-foreground"
                            title="Copy SKU"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                      </div>
                      <Input
                        id={`v-name-${variant.id}`}
                        value={d.name}
                        disabled={isBusy}
                        onChange={(e) => updateDraft(variant, { name: e.target.value })}
                        placeholder="VD: Mèo Tuxedo, Chó Shiba..."
                        className="h-8 text-sm font-medium"
                      />
                    </div>

                    {/* Price */}
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`v-price-${variant.id}`} className="text-xs font-medium text-muted-foreground">
                        Giá bán (VND)
                      </Label>
                      <div className="relative">
                        <Input
                          id={`v-price-${variant.id}`}
                          inputMode="numeric"
                          value={d.priceText}
                          disabled={isBusy}
                          onChange={(e) => updateDraft(variant, { priceText: digitsOnly(e.target.value) })}
                          className="h-8 pr-7 text-right text-sm font-semibold tabular-nums"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₫</span>
                      </div>
                    </div>

                    {/* Weight & Active Toggle */}
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`v-weight-${variant.id}`} className="text-xs font-medium text-muted-foreground">
                        Trọng lượng (gram)
                      </Label>
                      <div className="relative">
                        <Input
                          id={`v-weight-${variant.id}`}
                          inputMode="numeric"
                          value={d.weightText}
                          disabled={isBusy}
                          placeholder="—"
                          onChange={(e) => updateDraft(variant, { weightText: digitsOnly(e.target.value) })}
                          className="h-8 pr-7 text-right text-sm tabular-nums"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
                      </div>
                    </div>

                    {/* Workshop Print Files */}
                    <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 p-2">
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Printer className="size-3 text-primary" /> File in xưởng .3mf &amp; Google Drive (Nội bộ)
                      </span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="flex items-center gap-1">
                          <Input
                            value={d.printLocalPath}
                            disabled={isBusy}
                            onChange={(e) => updateDraft(variant, { printLocalPath: e.target.value })}
                            placeholder="File .3mf ổ D: D:\data3D\..."
                            aria-label={`File in .3mf cho ${variant.name}`}
                            className="h-7 flex-1 font-mono text-[11px]"
                          />
                          {d.printLocalPath ? (
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              title="Copy đường dẫn file"
                              onClick={() => {
                                void navigator.clipboard?.writeText(d.printLocalPath);
                                setNotice({ tone: 'ok', text: `Đã copy đường dẫn: ${d.printLocalPath}` });
                              }}
                            >
                              <Copy className="size-3" />
                            </Button>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="url"
                            value={d.printDriveUrl}
                            disabled={isBusy}
                            onChange={(e) => updateDraft(variant, { printDriveUrl: e.target.value })}
                            placeholder="Link Google Drive: https://drive.google.com/..."
                            aria-label={`Link Drive cho ${variant.name}`}
                            className="h-7 flex-1 text-[11px]"
                          />
                          {d.printDriveUrl ? (
                            <a
                              href={d.printDriveUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Mở Google Drive"
                              className="inline-flex size-6 items-center justify-center rounded border border-border hover:bg-muted"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Status switch */}
                    <div className="flex items-center justify-between sm:justify-start gap-2 pt-1 lg:col-span-1 lg:justify-center">
                      <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={d.isActive}
                          disabled={isBusy}
                          onChange={(e) => updateDraft(variant, { isActive: e.target.checked })}
                          className="size-3.5 accent-primary"
                        />
                        <span className={d.isActive ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}>
                          {d.isActive ? 'Đang bán' : 'Tạm ngưng'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 lg:flex-col lg:border-t-0 lg:border-l lg:pl-3 lg:pt-0 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant={isSaved ? 'secondary' : 'default'}
                      disabled={isBusy}
                      onClick={() => void saveVariant(variant)}
                      className="h-8 text-xs font-medium min-w-[70px]"
                    >
                      {isBusy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : isSaved ? (
                        <>
                          <Check className="mr-1 size-3.5 text-emerald-600" /> Đã lưu
                        </>
                      ) : (
                        'Lưu con'
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => void handleDuplicateVariant(variant)}
                      title="Nhân bản sản phẩm con này để tạo mẫu tương tự"
                      className="h-8 text-xs"
                    >
                      <Copy className="mr-1 size-3" /> Nhân bản
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => {
                        setSplitTarget(variant);
                        setSplitNewName(`${productName} - ${variant.name}`);
                        setSplitDeleteOriginal(false);
                      }}
                      title="Tách sản phẩm con này thành 1 sản phẩm độc lập riêng trong catalog"
                      className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <Split className="mr-1 size-3" /> Tách thành SP riêng
                    </Button>

                    {isOwner ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => void handleDeleteVariant(variant)}
                        title="Xoá hẳn sản phẩm con này"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredVariants.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Không tìm thấy sản phẩm con nào khớp với &quot;{searchQuery}&quot;.
            </div>
          ) : null}

          {/* Form: Add New Variant / Sub-Product */}
          <form
            onSubmit={handleCreateVariant}
            className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4"
          >
            <div className="flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Thêm sản phẩm con mới vào &quot;{productName}&quot;
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2 flex flex-col gap-1">
                <Label htmlFor="new-v-name" className="text-xs font-medium">Tên sản phẩm con *</Label>
                <Input
                  id="new-v-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Mèo Tuxedo, Size Lớn, Màu Cam..."
                  required
                  className="h-8 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="new-v-price" className="text-xs font-medium">Giá bán (VND) *</Label>
                <Input
                  id="new-v-price"
                  inputMode="numeric"
                  value={newPriceText}
                  onChange={(e) => setNewPriceText(digitsOnly(e.target.value))}
                  placeholder="VD: 35000"
                  required
                  className="h-8 text-right text-sm tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="new-v-weight" className="text-xs font-medium">Trọng lượng (g)</Label>
                <Input
                  id="new-v-weight"
                  inputMode="numeric"
                  value={newWeightText}
                  onChange={(e) => setNewWeightText(digitsOnly(e.target.value))}
                  placeholder="tuỳ chọn"
                  className="h-8 text-right text-sm tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="new-v-sku" className="text-xs font-medium">Mã SKU (để trống = tự sinh)</Label>
                <Input
                  id="new-v-sku"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  placeholder="VD: CLK-BALO-CAT"
                  className="h-8 text-sm font-mono uppercase"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="new-v-img" className="text-xs font-medium">Ảnh riêng cho con</Label>
                <select
                  id="new-v-img"
                  value={newSelectedImageId}
                  onChange={(e) => setNewSelectedImageId(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                >
                  <option value="">— Dùng ảnh chung —</option>
                  {images.map((img, i) => (
                    <option key={img.id} value={img.id}>
                      Ảnh #{i + 1}{img.altText ? ` (${img.altText.slice(0, 20)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <Label htmlFor="new-v-print" className="text-xs font-medium">File in xưởng .3mf ổ D (tuỳ chọn)</Label>
                <Input
                  id="new-v-print"
                  value={newPrintLocalPath}
                  onChange={(e) => setNewPrintLocalPath(e.target.value)}
                  placeholder="D:\data3D\..."
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Thêm sản phẩm con
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Images & Cover Card */}
      <Card id="anh" className="border-border shadow-xs">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Ảnh sản phẩm &amp; Ảnh bìa ({images.length})</span>
            <span className="text-xs font-normal text-muted-foreground">
              Ảnh đầu tiên là Ảnh bìa hiển thị ngoài trang web. Tải ảnh mới rồi bấm &quot;Đặt làm bìa&quot;.
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((image, index) => {
                const isCover = index === 0;
                const isBusy = busyId === image.id;
                const linkedVariant = variants.find((v) => v.id === image.variantId);
                return (
                  <div
                    key={image.id}
                    className={`flex flex-col gap-2 rounded-xl border bg-card p-2 transition-colors ${
                      isCover ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                    }`}
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
                      <img src={image.url} alt={image.altText ?? productName} className="size-full object-cover" />
                      {isCover ? (
                        <Badge className="absolute left-1.5 top-1.5 gap-1 text-[10px]">
                          <Star className="size-2.5 fill-current" /> Ảnh bìa (Cha)
                        </Badge>
                      ) : null}
                      <span className="absolute right-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                        #{index + 1}
                      </span>
                      {linkedVariant ? (
                        <Badge variant="secondary" className="absolute bottom-1.5 left-1.5 text-[9px] max-w-[90%] truncate">
                          {linkedVariant.name}
                        </Badge>
                      ) : null}
                    </div>

                    <select
                      aria-label={`Gắn ảnh #${index + 1} cho sản phẩm con`}
                      value={image.variantId ?? ''}
                      disabled={isBusy}
                      onChange={(e) => {
                        const nextVariantId = e.target.value || null;
                        setBusyId(image.id);
                        void assignImageVariantAction(productId, image.id, nextVariantId).then((res) => {
                          setBusyId(null);
                          if (!res.ok) setNotice({ tone: 'error', text: res.error });
                          else router.refresh();
                        });
                      }}
                      className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs"
                    >
                      <option value="">Ảnh chung (không gắn riêng)</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>

                    <div className="flex gap-1">
                      {!isCover ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={isBusy}
                          className="flex-1 text-[11px]"
                          onClick={() => {
                            setBusyId(image.id);
                            void setProductCoverInlineAction(productId, image.id).then((res) => {
                              setBusyId(null);
                              if (!res.ok) setNotice({ tone: 'error', text: res.error });
                              else { setNotice({ tone: 'ok', text: 'Đã đổi ảnh bìa sản phẩm cha.' }); router.refresh(); }
                            });
                          }}
                        >
                          <Star className="mr-1 size-3" /> Làm bìa
                        </Button>
                      ) : (
                        <span className="flex-1 text-center text-[11px] font-medium text-primary py-1">Đang làm bìa</span>
                      )}
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={isBusy}
                        title="Xoá ảnh"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setBusyId(image.id);
                          void deleteImageInlineAction(productId, image.id).then((res) => {
                            setBusyId(null);
                            if (!res.ok) setNotice({ tone: 'error', text: res.error });
                            else router.refresh();
                          });
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sản phẩm này chưa có hình ảnh. Hãy tải lên ảnh đại diện bên dưới.</p>
          )}
          <ProductImageUploader productId={productId} hasImages={images.length > 0} />
        </CardContent>
      </Card>

      {/* Modal: Visual Photo Picker for Variant */}
      <Dialog open={Boolean(photoPickerVariantId)} onOpenChange={(open) => { if (!open) setPhotoPickerVariantId(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Chọn ảnh riêng cho sản phẩm con</DialogTitle>
            <DialogDescription>
              Bấm vào ảnh bạn muốn gán riêng cho biến thể này để hiển thị khi khách bấm chọn mẫu.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-4 max-h-[360px] overflow-y-auto">
            {images.map((img, i) => {
              const isSelected = photoPickerVariantId ? imageByVariant.get(photoPickerVariantId)?.id === img.id : false;
              return (
                <button
                  type="button"
                  key={img.id}
                  onClick={() => {
                    if (photoPickerVariantId) void handleAssignVariantImage(photoPickerVariantId, img.id);
                  }}
                  className={`group relative aspect-square overflow-hidden rounded-lg border text-left transition-all ${
                    isSelected ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <img src={img.url} alt="" className="size-full object-cover transition-transform group-hover:scale-105" />
                  {isSelected ? (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="rounded-full bg-primary p-1 text-primary-foreground shadow">
                        <Check className="size-4" />
                      </div>
                    </div>
                  ) : null}
                  <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-[10px] tabular-nums">
                    #{i + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (photoPickerVariantId) void handleAssignVariantImage(photoPickerVariantId, null);
              }}
              className="text-xs"
            >
              Bỏ gắn ảnh (dùng ảnh chung)
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPhotoPickerVariantId(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Split Variant into Standalone Product */}
      <Dialog open={Boolean(splitTarget)} onOpenChange={(open) => { if (!open) setSplitTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Split className="size-5 text-primary" />
              <span>Tách thành sản phẩm độc lập</span>
            </DialogTitle>
            <DialogDescription>
              Biến thể &quot;{splitTarget?.name}&quot; ({splitTarget?.sku}) sẽ trở thành 1 sản phẩm riêng biệt trong danh mục, kế thừa ảnh, giá và file in xưởng.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="split-name" className="text-xs font-semibold">Tên sản phẩm mới</Label>
              <Input
                id="split-name"
                value={splitNewName}
                onChange={(e) => setSplitNewName(e.target.value)}
                placeholder="VD: Clicker Mèo Tuxedo..."
                className="h-9"
              />
            </div>

            {variants.length > 1 ? (
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={splitDeleteOriginal}
                  onChange={(e) => setSplitDeleteOriginal(e.target.checked)}
                  className="size-4 accent-primary mt-0.5"
                />
                <span>
                  Đồng thời xoá biến thể này khỏi sản phẩm cha (&quot;{productName}&quot;) sau khi tách xong.
                </span>
              </label>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" disabled={isSplitting} onClick={() => setSplitTarget(null)}>
              Huỷ
            </Button>
            <Button type="button" disabled={isSplitting || !splitNewName.trim()} onClick={() => void handleConfirmSplit()}>
              {isSplitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Split className="mr-1.5 size-3.5" />}
              Tách thành sản phẩm mới
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Quick Edit Parent Product */}
      <Dialog open={isEditParentOpen} onOpenChange={setIsEditParentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-primary" /> Sửa thông tin sản phẩm cha
            </DialogTitle>
            <DialogDescription>
              Cập nhật thông tin đại diện của sản phẩm cha hiển thị ở trang chủ, danh mục và bộ lọc ngoài web.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveParent} className="space-y-3.5 py-2">
            <div>
              <Label htmlFor="parent-name" className="text-xs font-semibold">
                Tên sản phẩm cha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="parent-name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Ví dụ: Clicker Balo Động Vật"
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="parent-category" className="text-xs font-semibold">
                  Danh mục
                </Label>
                <select
                  id="parent-category"
                  value={parentCategoryId}
                  onChange={(e) => setParentCategoryId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="">— Chưa chọn —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="parent-status" className="text-xs font-semibold">
                  Trạng thái
                </Label>
                <select
                  id="parent-status"
                  value={parentStatus}
                  onChange={(e) => setParentStatus(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="DRAFT">Nháp (DRAFT)</option>
                  <option value="ACTIVE">Đang bán (ACTIVE)</option>
                  <option value="ARCHIVED">Đã lưu trữ (ARCHIVED)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="parent-type" className="text-xs font-semibold">
                  Hình thức bán
                </Label>
                <select
                  id="parent-type"
                  value={parentProductType}
                  onChange={(e) => setParentProductType(e.target.value as 'READY_STOCK' | 'MADE_TO_ORDER')}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="MADE_TO_ORDER">In theo yêu cầu</option>
                  <option value="READY_STOCK">Có sẵn, giao ngay</option>
                </select>
              </div>

              <div className="flex flex-col justify-end pb-1.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={parentIsFeatured}
                    onChange={(e) => setParentIsFeatured(e.target.checked)}
                    className="size-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Sản phẩm nổi bật</span>
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="parent-short-desc" className="text-xs font-semibold">
                Mô tả ngắn đại diện
              </Label>
              <Input
                id="parent-short-desc"
                value={parentShortDesc}
                onChange={(e) => setParentShortDesc(e.target.value)}
                placeholder="Tóm tắt ngắn gọn 1-2 câu về sản phẩm..."
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditParentOpen(false)}
                disabled={isSavingParent}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingParent}
                className="gap-1.5 font-semibold"
              >
                {isSavingParent ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Quick Choose Avatar / Cover for Parent Product */}
      <Dialog open={isCoverPickerOpen} onOpenChange={setIsCoverPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="size-4 text-primary" /> Chọn ảnh đại diện (AVT) cho sản phẩm cha
            </DialogTitle>
            <DialogDescription>
              Chọn một ảnh từ thư viện bên dưới để làm ảnh bìa đại diện ngoài web và danh mục.
            </DialogDescription>
          </DialogHeader>

          {images.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground space-y-3">
              <ImageOff className="size-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm">Chưa có ảnh nào được tải lên cho sản phẩm này.</p>
              <a
                href="#anh"
                onClick={() => setIsCoverPickerOpen(false)}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Cuộn xuống mục Quản lý ảnh để tải ảnh lên
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-3 max-h-80 overflow-y-auto">
              {images.map((img, idx) => {
                const isCurrentCover = idx === 0;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => handleSetCover(img.id)}
                    className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all p-0.5 ${
                      isCurrentCover
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/60'
                    }`}
                  >
                    <img src={img.url} alt={img.altText ?? productName} className="size-full object-cover rounded-lg" />
                    {isCurrentCover ? (
                      <span className="absolute top-1 right-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-xs">
                        Bìa hiện tại
                      </span>
                    ) : (
                      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                        Đặt làm bìa
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <a
              href="#anh"
              onClick={() => setIsCoverPickerOpen(false)}
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-xs' })}
            >
              Tải ảnh mới lên (#anh) ↓
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCoverPickerOpen(false)}
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
