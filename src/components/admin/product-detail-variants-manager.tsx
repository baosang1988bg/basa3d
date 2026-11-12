'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ImageOff, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductImageUploader } from '@/components/admin/product-image-picker';
import type { StaffRole } from '@/lib/auth/require-admin';
import {
  assignImageVariantAction,
  createVariantInlineAction,
  deleteImageInlineAction,
  deleteVariantInlineAction,
  saveVariantInlineAction,
  setProductCoverInlineAction,
} from '@/app/admin/(protected)/products/actions';

export type DetailVariantRow = {
  id: string;
  sku: string;
  name: string;
  price: number;
  weightGrams: number | null;
  isActive: boolean;
};

export type DetailImageRow = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  variantId: string | null;
};

const digitsOnly = (v: string) => v.replace(/[^\d]/g, '');

export function ProductDetailVariantsAndImages({
  productId,
  productName,
  role,
  variants,
  images,
}: {
  productId: string;
  productName: string;
  role: StaffRole;
  variants: DetailVariantRow[];
  images: DetailImageRow[];
}) {
  const router = useRouter();
  const isOwner = role === 'OWNER';
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, { name: string; priceText: string; weightText: string; isActive: boolean }>>(() => {
    const init: Record<string, { name: string; priceText: string; weightText: string; isActive: boolean }> = {};
    for (const v of variants) {
      init[v.id] = {
        name: v.name,
        priceText: String(v.price),
        weightText: v.weightGrams != null ? String(v.weightGrams) : '',
        isActive: v.isActive,
      };
    }
    return init;
  });

  // Keep drafts synced when variants prop updates (e.g. after adding a new variant)
  const effectiveDraft = (v: DetailVariantRow) => drafts[v.id] ?? {
    name: v.name,
    priceText: String(v.price),
    weightText: v.weightGrams != null ? String(v.weightGrams) : '',
    isActive: v.isActive,
  };

  // New variant form
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newPriceText, setNewPriceText] = useState('');
  const [newWeightText, setNewWeightText] = useState('');

  const imageByVariant = useMemo(() => {
    const map = new Map<string, DetailImageRow>();
    for (const img of images) {
      if (img.variantId && !map.has(img.variantId)) map.set(img.variantId, img);
    }
    return map;
  }, [images]);

  function updateDraft(variant: DetailVariantRow, patch: Partial<{ name: string; priceText: string; weightText: string; isActive: boolean }>) {
    const cur = effectiveDraft(variant);
    setDrafts((prev) => ({ ...prev, [variant.id]: { ...cur, ...patch } }));
  }

  async function saveVariant(variant: DetailVariantRow) {
    const d = effectiveDraft(variant);
    const price = Number(digitsOnly(d.priceText));
    if (!d.name.trim()) { setNotice({ tone: 'error', text: 'Tên biến thể không được trống.' }); return; }
    if (!Number.isSafeInteger(price) || price < 0) { setNotice({ tone: 'error', text: 'Giá biến thể phải ≥ 0.' }); return; }
    const weight = d.weightText.trim() ? Number(digitsOnly(d.weightText)) : null;

    setBusyId(variant.id);
    setNotice(null);
    try {
      const res = await saveVariantInlineAction(productId, variant.id, {
        name: d.name.trim(),
        price,
        weightGrams: weight,
        isActive: d.isActive,
      });
      if (!res.ok) { setNotice({ tone: 'error', text: res.error }); return; }
      setSavedId(variant.id);
      setTimeout(() => setSavedId((cur) => (cur === variant.id ? null : cur)), 2000);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssignVariantImage(variantId: string, imageId: string) {
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
      setNotice({ tone: 'ok', text: imageId ? 'Đã gắn ảnh cho biến thể.' : 'Đã bỏ gắn ảnh biến thể.' });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteVariant(variant: DetailVariantRow) {
    if (!window.confirm(`Xoá hẳn biến thể "${variant.name}" (${variant.sku})?`)) return;
    setBusyId(variant.id);
    setNotice(null);
    try {
      const res = await deleteVariantInlineAction(productId, variant.id);
      if (!res.ok) { setNotice({ tone: 'error', text: res.error }); return; }
      setNotice({ tone: 'ok', text: `Đã xoá biến thể "${variant.name}".` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateVariant(event: React.FormEvent) {
    event.preventDefault();
    const price = Number(digitsOnly(newPriceText));
    if (!newName.trim() || !Number.isSafeInteger(price) || price < 0) {
      setNotice({ tone: 'error', text: 'Nhập tên và giá hợp lệ cho biến thể mới.' });
      return;
    }
    const weight = newWeightText.trim() ? Number(digitsOnly(newWeightText)) : null;
    startTransition(async () => {
      const res = await createVariantInlineAction(productId, {
        sku: newSku.trim() || undefined,
        name: newName.trim(),
        price,
        weightGrams: weight,
      });
      if (!res.ok) { setNotice({ tone: 'error', text: res.error }); return; }
      setNewSku('');
      setNewName('');
      setNewPriceText('');
      setNewWeightText('');
      setNotice({ tone: 'ok', text: 'Đã thêm biến thể mới.' });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <div
          role="status"
          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
            notice.tone === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Variants card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Biến thể con ({variants.length})</span>
            <span className="text-xs font-normal text-muted-foreground">
              Sửa tên, giá, trạng thái bán và gắn ảnh riêng cho từng biến thể
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {variants.map((variant) => {
            const d = effectiveDraft(variant);
            const linkedImg = imageByVariant.get(variant.id);
            const isBusy = busyId === variant.id;
            const isSaved = savedId === variant.id;

            return (
              <div
                key={variant.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"
              >
                {/* Variant image preview + quick selector */}
                <div className="flex items-center gap-2.5 sm:w-52 shrink-0">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {linkedImg ? (
                      <img src={linkedImg.url} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageOff className="size-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] text-muted-foreground" title={variant.sku}>{variant.sku}</p>
                    <select
                      aria-label={`Chọn ảnh cho ${variant.name}`}
                      value={linkedImg?.id ?? ''}
                      disabled={isBusy}
                      onChange={(e) => void handleAssignVariantImage(variant.id, e.target.value)}
                      className="mt-1 h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs"
                    >
                      <option value="">— Chưa gắn ảnh —</option>
                      {images.map((img, idx) => (
                        <option key={img.id} value={img.id}>
                          Ảnh #{idx + 1}{img.altText ? ` (${img.altText.slice(0, 18)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fields */}
                <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_130px_90px_auto]">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`v-name-${variant.id}`} className="text-[11px] text-muted-foreground">Tên mẫu</Label>
                    <Input
                      id={`v-name-${variant.id}`}
                      value={d.name}
                      disabled={isBusy}
                      onChange={(e) => updateDraft(variant, { name: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`v-price-${variant.id}`} className="text-[11px] text-muted-foreground">Giá (VND)</Label>
                    <Input
                      id={`v-price-${variant.id}`}
                      inputMode="numeric"
                      value={d.priceText}
                      disabled={isBusy}
                      onChange={(e) => updateDraft(variant, { priceText: digitsOnly(e.target.value) })}
                      className="h-8 text-right text-sm tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`v-weight-${variant.id}`} className="text-[11px] text-muted-foreground">Gram</Label>
                    <Input
                      id={`v-weight-${variant.id}`}
                      inputMode="numeric"
                      value={d.weightText}
                      disabled={isBusy}
                      placeholder="—"
                      onChange={(e) => updateDraft(variant, { weightText: digitsOnly(e.target.value) })}
                      className="h-8 text-right text-sm tabular-nums"
                    />
                  </div>
                  <div className="flex items-end gap-2 pt-1 sm:pt-0">
                    <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs">
                      <input
                        type="checkbox"
                        checked={d.isActive}
                        disabled={isBusy}
                        onChange={(e) => updateDraft(variant, { isActive: e.target.checked })}
                        className="size-3.5 accent-primary"
                      />
                      Đang bán
                    </label>
                    <Button type="button" size="sm" variant={isSaved ? 'secondary' : 'outline'} disabled={isBusy} onClick={() => void saveVariant(variant)}>
                      {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : isSaved ? <><Check className="mr-1 size-3.5 text-emerald-600" /> Đã lưu</> : 'Lưu'}
                    </Button>
                    {isOwner ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => void handleDeleteVariant(variant)}
                        title="Xoá biến thể"
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

          {/* Add variant form */}
          <form onSubmit={handleCreateVariant} className="mt-2 flex flex-wrap items-end gap-2.5 rounded-xl border border-dashed border-border bg-muted/20 p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-v-name" className="text-xs">Tên biến thể mới *</Label>
              <Input id="new-v-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="VD: Combo 8 mẫu" required className="h-8 w-44" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-v-price" className="text-xs">Giá (VND) *</Label>
              <Input id="new-v-price" inputMode="numeric" value={newPriceText} onChange={(e) => setNewPriceText(digitsOnly(e.target.value))} placeholder="25000" required className="h-8 w-32 tabular-nums" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-v-weight" className="text-xs">Gram</Label>
              <Input id="new-v-weight" inputMode="numeric" value={newWeightText} onChange={(e) => setNewWeightText(digitsOnly(e.target.value))} placeholder="tuỳ chọn" className="h-8 w-24 tabular-nums" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-v-sku" className="text-xs">SKU (trống = tự tạo)</Label>
              <Input id="new-v-sku" value={newSku} onChange={(e) => setNewSku(e.target.value)} placeholder="tự tạo" className="h-8 w-36" />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              <Plus className="mr-1 size-3.5" /> Thêm biến thể
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Images & Cover card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Ảnh sản phẩm &amp; Ảnh bìa ({images.length})</span>
            <span className="text-xs font-normal text-muted-foreground">
              Ảnh đầu tiên là Ảnh bìa hiển thị ngoài trang bán hàng. Tải ảnh bìa mới bên dưới rồi bấm &quot;Đặt làm bìa&quot;.
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((image, index) => {
                const isCover = index === 0;
                const isBusy = busyId === image.id;
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
                          <Star className="size-2.5 fill-current" /> Ảnh bìa
                        </Badge>
                      ) : null}
                      <span className="absolute right-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                        #{index + 1}
                      </span>
                    </div>

                    <select
                      aria-label={`Gắn ảnh #${index + 1} cho biến thể`}
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
                          className="flex-1"
                          onClick={() => {
                            setBusyId(image.id);
                            void setProductCoverInlineAction(productId, image.id).then((res) => {
                              setBusyId(null);
                              if (!res.ok) setNotice({ tone: 'error', text: res.error });
                              else { setNotice({ tone: 'ok', text: 'Đã đổi ảnh bìa sản phẩm.' }); router.refresh(); }
                            });
                          }}
                        >
                          <Star className="mr-1 size-3" /> Đặt làm bìa
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
    </div>
  );
}
