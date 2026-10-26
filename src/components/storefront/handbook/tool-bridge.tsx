import { ArrowRight, Wrench } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { storefrontButtonClasses } from '@/components/storefront/button';
import type { HandbookBlock } from '@/data/handbook/types';
import { resolveHandbookToolLink } from '@/data/handbook/tool-links';

type ToolBlock = Extract<HandbookBlock, { type: 'tool' }>;

/** Server component — conversion callout from a chapter to a BaSa3D tool / quote / custom print. */
export function ToolBridge({ block, baoGiaEnabled }: { block: ToolBlock; baoGiaEnabled: boolean }) {
  const link = resolveHandbookToolLink(block.toolId, { baoGiaEnabled });
  const copy = link.isFallback && block.fallback ? block.fallback : block;
  return (
    <aside className="not-prose flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:p-5">
      <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Wrench className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{copy.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.text}</p>
      </div>
      <Link href={link.href} className={storefrontButtonClasses('primary', 'shrink-0 gap-1.5 text-sm')}>
        {link.ctaLabel}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}
