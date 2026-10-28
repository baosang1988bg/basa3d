import Image from 'next/image';
import type { HandbookDefect } from '@/data/handbook/types';

type Photos = NonNullable<HandbookDefect['photos']>;

/**
 * Phase 53 — before/after toggle with ZERO client JS (server component). Two native radio inputs drive
 * the swap through CSS `:has(:checked)` (Tailwind `group-has-*`), so it works without hydration and
 * with JS disabled. Keyboard: arrow keys move between the radios (native behaviour).
 *
 * Chosen over a drag slider (review Q2): "failed" and "fixed" are two different physical prints, so a
 * pixel-aligned slider would mislead unless every pair is shot on a jig. Images are lazy by default
 * and sit inside a closed <details>, so they don't load until the visitor opens the defect.
 */
export function DefectPhotoToggle({ defectId, defectName, photos }: { defectId: string; defectName: string; photos: Photos }) {
  const name = `defect-photo-${defectId}`;
  const { failed, fixed } = photos;
  const sizes = '(min-width: 768px) 42rem, 100vw';

  return (
    <figure className="group/cmp mx-4 mb-4">
      <div className="relative overflow-hidden rounded-lg bg-muted" style={{ aspectRatio: `${failed.width} / ${failed.height}` }}>
        <Image
          src={failed.src}
          alt={failed.alt}
          width={failed.width}
          height={failed.height}
          sizes={sizes}
          className="absolute inset-0 size-full object-cover transition-opacity duration-200 motion-reduce:transition-none group-has-[.cmp-fixed:checked]/cmp:opacity-0"
        />
        <Image
          src={fixed.src}
          alt={fixed.alt}
          width={fixed.width}
          height={fixed.height}
          sizes={sizes}
          className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-200 motion-reduce:transition-none group-has-[.cmp-fixed:checked]/cmp:opacity-100"
        />
      </div>
      <fieldset className="mt-2 flex gap-2">
        <legend className="sr-only">Xem ảnh {defectName}: trước hoặc sau khi khắc phục</legend>
        {(['failed', 'fixed'] as const).map((state) => (
          <label
            key={state}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-full border border-border bg-background px-3 text-sm text-muted-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <input type="radio" name={name} value={state} defaultChecked={state === 'failed'} className={`sr-only ${state === 'fixed' ? 'cmp-fixed' : ''}`} />
            {state === 'failed' ? 'Bị lỗi' : 'Đã khắc phục'}
          </label>
        ))}
      </fieldset>
      <figcaption className="mt-1 text-xs text-muted-foreground">Ảnh: {photos.credit}</figcaption>
    </figure>
  );
}
