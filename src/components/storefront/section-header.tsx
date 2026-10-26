import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    // Phase 43: `reveal` = fades up as it scrolls into view (pure CSS, see globals.css).
    <div className={cn('reveal mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end', className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-2 text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>}
        <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-base text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
