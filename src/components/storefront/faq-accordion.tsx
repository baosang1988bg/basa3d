'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FaqItem = { question: string; answer: string };

// Phase 43: replaces <details>/<summary>, which open and close instantly in every browser (ui-ux
// skill rule I30). The answer slides with a `grid-template-rows` 0fr ↔ 1fr transition — no height
// measured in JS — and a closed answer is `inert`, so Tab never lands inside hidden text. The answer
// text stays in the server HTML either way (SEO, and the FAQPage JSON-LD on the home page).
export function FaqAccordion({ items, className }: { items: FaqItem[]; className?: string }) {
  const baseId = useId();
  const [openIndexes, setOpenIndexes] = useState<ReadonlySet<number>>(() => new Set());

  function toggle(index: number) {
    setOpenIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {items.map((item, index) => {
        const isOpen = openIndexes.has(index);
        const buttonId = `${baseId}-q${index}`;
        const panelId = `${baseId}-a${index}`;
        return (
          <div
            key={item.question}
            className={cn(
              'rounded-xl border bg-card transition-colors duration-200',
              isOpen ? 'border-primary/40' : 'border-border hover:border-primary/30',
            )}
          >
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl p-4 text-left font-heading text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {item.question}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-200 ease-out group-hover:text-foreground motion-reduce:transition-none',
                    isOpen && 'rotate-180 text-primary',
                  )}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!isOpen}
              className={cn(
                'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-sm text-muted-foreground">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
