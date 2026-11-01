'use client';

// Phase 54.2 (ADR-0057): source images are hotlinked from the cited article. A source may block
// hotlinking or delete the image — the card then removes itself instead of showing a broken icon.
import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * onError can fire before hydration attaches the handler (SSR-rendered <img> that already failed),
 * so also check the element once on mount.
 */
function useImageFailed() {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  return { ref, failed, onError: () => setFailed(true) };
}

export function SourceImage({ src, alt, className, fallback = null }: {
  src: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const { ref, failed, onError } = useImageFailed();
  if (failed) return <>{fallback}</>;
  return (
    // Plain <img>: next/image would proxy (= re-host) the third-party image through our server.
    <img ref={ref} src={src} alt={alt} className={className} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={onError} />
  );
}

export function SourceImageCard({ url, caption, sourceName, sourceUrl, large = false }: {
  url: string;
  caption?: string;
  sourceName: string;
  sourceUrl: string;
  large?: boolean;
}) {
  const { ref, failed, onError } = useImageFailed();
  if (failed) return null;
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card">
      <a href={sourceUrl} target="_blank" rel="nofollow noopener noreferrer" className="block bg-muted/50">
        {/* Plain <img>: hotlinked third-party image, never proxied/re-hosted. */}
        <img
          ref={ref}
          src={url}
          alt={caption ?? `Ảnh từ ${sourceName}`}
          className={`w-full object-cover ${large ? 'aspect-video' : 'aspect-[4/3]'}`}
          loading={large ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onError}
        />
      </a>
      <figcaption className="flex flex-col gap-0.5 px-3 py-2 text-xs text-muted-foreground">
        {caption ? <span className="line-clamp-2 text-foreground/80">{caption}</span> : null}
        <a href={sourceUrl} target="_blank" rel="nofollow noopener noreferrer" className="font-medium text-primary hover:underline">
          Ảnh: {sourceName} · Xem bài gốc ↗
        </a>
      </figcaption>
    </figure>
  );
}
