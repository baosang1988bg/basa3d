'use client';

// Phase 52 P3 — multi-image drop zone with cover selection (no dropzone dependency: native file input +
// drag events). Photos are shrunk in the browser as soon as they are added, so the size shown is what
// will be uploaded. Used by "Đăng sản phẩm mới" (upload after create) and the product detail page.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PRODUCT_IMAGE_ACCEPT,
  ProductImageUploadError,
  shrinkImage,
  uploadProductImages,
} from '@/lib/uploads/product-image-upload';

export const PRODUCT_IMAGE_PICKER_MAX = 12;

export type PickedImage = { key: string; name: string; previewUrl: string; blob: Blob | null; error: string | null };

let keyCounter = 0;
const nextKey = () => `img-${Date.now()}-${(keyCounter += 1)}`;

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ProductImagePicker({
  images,
  onImagesChange,
  coverKey,
  onCoverChange,
  disabled = false,
  uploadedKeys = {},
  allowCover = true,
}: {
  images: PickedImage[];
  onImagesChange: (update: (previous: PickedImage[]) => PickedImage[]) => void;
  coverKey: string | null;
  onCoverChange: (key: string | null) => void;
  disabled?: boolean;
  uploadedKeys?: Record<string, string>;
  /** false → no cover controls (the product already has a cover; change it in the image grid). */
  allowCover?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Revoke preview URLs on unmount.
  const latest = useRef(images);
  latest.current = images;
  useEffect(() => () => { for (const image of latest.current) URL.revokeObjectURL(image.previewUrl); }, []);

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((file) => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name));
    const room = PRODUCT_IMAGE_PICKER_MAX - images.length;
    setNotice(files.length > room ? `Tối đa ${PRODUCT_IMAGE_PICKER_MAX} ảnh — đã bỏ bớt ${files.length - Math.max(room, 0)} ảnh.` : null);
    const accepted = files.slice(0, Math.max(room, 0));
    if (!accepted.length) return;
    const added = accepted.map((file) => ({ file, image: { key: nextKey(), name: file.name, previewUrl: URL.createObjectURL(file), blob: null, error: null } as PickedImage }));
    onImagesChange((previous) => [...previous, ...added.map((entry) => entry.image)]);
    if (allowCover && !coverKey) onCoverChange(added[0].image.key);
    for (const { file, image: item } of added) {
      shrinkImage(file)
        .then((blob) => onImagesChange((previous) => previous.map((image) => (image.key === item.key ? { ...image, blob } : image))))
        .catch((error: unknown) => onImagesChange((previous) => previous.map((image) => (image.key === item.key
          ? { ...image, error: error instanceof ProductImageUploadError ? error.message : 'Không đọc được ảnh này.' }
          : image))));
    }
  }

  function remove(key: string) {
    const target = images.find((image) => image.key === key);
    if (target) URL.revokeObjectURL(target.previewUrl);
    const rest = images.filter((image) => image.key !== key);
    onImagesChange(() => rest);
    if (allowCover && coverKey === key) onCoverChange(rest[0]?.key ?? null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Kéo thả hoặc bấm để chọn ảnh"
        onClick={() => { if (!disabled) inputRef.current?.click(); }}
        onKeyDown={(event) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) addFiles(event.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <ImagePlus className="size-7 text-muted-foreground" />
        <p className="text-sm font-medium">Kéo thả ảnh chụp mẫu in vào đây, hoặc bấm để chọn</p>
        <p className="text-xs text-muted-foreground">Chọn nhiều ảnh cùng lúc · tự nén về ≤ 1600px · tối đa {PRODUCT_IMAGE_PICKER_MAX} ảnh</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={`${PRODUCT_IMAGE_ACCEPT},image/heic,image/heif`}
          className="hidden"
          onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }}
        />
      </div>
      {notice ? <p className="text-xs text-amber-700 dark:text-amber-400">{notice}</p> : null}

      {images.length ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((image) => {
            const isCover = allowCover && image.key === coverKey;
            return (
              <li key={image.key} className={`relative overflow-hidden rounded-lg border bg-card ${isCover ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}>
                <div className="relative aspect-square bg-muted">
                  <img src={image.previewUrl} alt={image.name} className="size-full object-cover" />
                  {!image.blob && !image.error ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60"><Loader2 className="size-5 animate-spin" /></div>
                  ) : null}
                  {uploadedKeys[image.key] ? <span className="absolute bottom-1 left-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Đã tải</span> : null}
                  <button
                    type="button"
                    aria-label={`Bỏ ảnh ${image.name}`}
                    disabled={disabled}
                    onClick={() => remove(image.key)}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow-sm hover:bg-background disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                  {!allowCover ? <span /> : isCover ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-primary"><Star className="size-3 fill-current" /> Ảnh bìa</span>
                  ) : (
                    <button type="button" disabled={disabled} onClick={() => onCoverChange(image.key)} className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50">
                      Đặt làm bìa
                    </button>
                  )}
                  <span className="text-[10px] tabular-nums text-muted-foreground">{image.blob ? formatSize(image.blob.size) : ''}</span>
                </div>
                {image.error ? <p className="px-1.5 pb-1 text-[11px] text-rose-600">{image.error}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Detail-page variant: pick, then upload + register right away for an existing product. */
export function ProductImageUploader({ productId, hasImages }: { productId: string; hasImages: boolean }) {
  const router = useRouter();
  const [images, setImages] = useState<PickedImage[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = images.filter((image) => image.blob && !image.error);
  const stillShrinking = images.some((image) => !image.blob && !image.error);

  async function upload() {
    setBusy(true);
    setError(null);
    try {
      const paths = await uploadProductImages(
        productId,
        ready.map((image) => ({ key: image.key, blob: image.blob as Blob })),
        // Only replace the current cover when the product has none yet.
        hasImages ? null : coverKey,
        uploaded,
        (done, total) => setProgress(`Đang tải ${done}/${total}…`),
      );
      setUploaded(paths);
      for (const image of images) URL.revokeObjectURL(image.previewUrl);
      setImages([]);
      setCoverKey(null);
      setUploaded({});
      setProgress(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ProductImageUploadError ? cause.message : 'Tải ảnh lên thất bại. Thử lại sau.');
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ProductImagePicker images={images} onImagesChange={setImages} coverKey={coverKey} onCoverChange={setCoverKey} disabled={busy} uploadedKeys={uploaded} allowCover={!hasImages} />
      {error ? <p className="text-sm text-rose-600" role="alert">{error}</p> : null}
      {images.length ? (
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" disabled={busy || stillShrinking || !ready.length} onClick={upload}>
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Tải {ready.length} ảnh lên
          </Button>
          {progress ? <span className="text-xs text-muted-foreground">{progress}</span> : null}
          {hasImages ? <span className="text-xs text-muted-foreground">Ảnh mới thêm vào cuối; đổi ảnh bìa ở lưới ảnh phía trên.</span> : null}
        </div>
      ) : null}
    </div>
  );
}
