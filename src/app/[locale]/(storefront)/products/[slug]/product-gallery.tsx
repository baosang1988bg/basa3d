'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type GalleryImage = { url: string; altText: string | null };

// Phase 43: thumbnails used to be display-only. Now they switch the main image, which cross-fades
// (all images stay stacked in one square, only opacity changes — no layout shift, no reload of an
// image already seen). The first image is `priority`: it is the product page's LCP element.
// QA-018: stacked <Image>s all sit inside the viewport, so lazy-loading never kicked in and a product
// with 15 photos downloaded 15 full-size images up front. Only images the customer has opened are
// mounted now (the first one, then each one picked) — the cross-fade still works between those.
export function ProductGallery({
  images,
  productName,
  noImageLabel,
  thumbnailLabels,
  activeIndex: controlledIndex,
  onActiveIndexChange,
}: {
  images: GalleryImage[];
  productName: string;
  noImageLabel: string;
  /** One accessible label per image ("Xem ảnh 2"), translated on the server. */
  thumbnailLabels: string[];
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}) {
  const [uncontrolledIndex, setUncontrolledIndex] = useState(0);
  const activeIndex = controlledIndex ?? uncontrolledIndex;
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([0]));
  // Remember every image shown so far ("adjust state while rendering" — no effect, no extra paint).
  if (!mounted.has(activeIndex)) setMounted(new Set(mounted).add(activeIndex));
  const setActiveIndex = onActiveIndexChange ?? setUncontrolledIndex;

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-muted/50 text-sm text-muted-foreground">{noImageLabel}</div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted/50">
        {images.map((image, index) => (index === activeIndex || mounted.has(index)) && (
          <Image
            key={image.url}
            src={image.url}
            alt={image.altText ?? productName}
            width={600}
            height={600}
            sizes="(min-width: 1024px) 600px, 100vw"
            priority={index === 0}
            aria-hidden={index !== activeIndex}
            className={cn(
              'absolute inset-0 size-full object-cover transition-opacity duration-300 ease-out motion-reduce:transition-none',
              index === activeIndex ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={image.url}
                type="button"
                aria-label={thumbnailLabels[index]}
                aria-pressed={isActive}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'size-16 cursor-pointer overflow-hidden rounded-lg bg-muted/50 ring-offset-2 ring-offset-background transition-[box-shadow,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100',
                )}
              >
                <Image src={image.url} alt="" width={64} height={64} className="size-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
