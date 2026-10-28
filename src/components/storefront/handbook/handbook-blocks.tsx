import { AlertTriangle, ArrowRight, Lightbulb } from 'lucide-react';
import { storefrontButtonClasses } from '@/components/storefront/button';
import type { HandbookBlock } from '@/data/handbook/types';
import { HANDBOOK_CHECKLIST } from '@/data/handbook/checklist';
import { ENCLOSURE_LABELS, HANDBOOK_MATERIALS, MATERIAL_TAG_LABELS } from '@/data/handbook/materials';
import { HANDBOOK_TOLERANCES } from '@/data/handbook/tolerances';
import { resolveHandbookToolLink } from '@/data/handbook/tool-links';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { FitCalculator } from './fit-calculator';
import { InteractiveChecklist } from './interactive-checklist';
import { MaterialTable } from './material-table';
import { PrintCostCalculator } from './print-cost-calculator';
import { ToleranceTable } from './tolerance-table';
import { ToolBridge } from './tool-bridge';
import { TroubleshootingTable } from './troubleshooting-table';

// Server component: renders typed content blocks to HTML. Client islands get their data as props
// here — this is the only bridge between src/data/handbook and 'use client' code.
export function HandbookBlocks({ blocks, baoGiaEnabled }: { blocks: HandbookBlock[]; baoGiaEnabled: boolean }) {
  return (
    <div className="space-y-4 leading-relaxed">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case 'p':
            return <p key={key}>{block.text}</p>;
          case 'h3':
            return <h3 key={key} className="font-heading pt-2 text-lg font-bold">{block.text}</h3>;
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
              <ListTag key={key} className={cn('space-y-1.5 pl-5', block.ordered ? 'list-decimal' : 'list-disc', 'marker:text-primary')}>
                {block.items.map((item) => <li key={item}>{item}</li>)}
              </ListTag>
            );
          }
          case 'terms':
            return (
              <dl key={key} className="grid gap-3 sm:grid-cols-2">
                {block.items.map((item) => (
                  <div key={item.term} className="rounded-lg border border-border bg-card p-3">
                    <dt className="font-semibold">{item.term}</dt>
                    <dd className="mt-1 text-sm text-muted-foreground">{item.definition}</dd>
                  </div>
                ))}
              </dl>
            );
          case 'callout': {
            const Icon = block.tone === 'warning' ? AlertTriangle : Lightbulb;
            return (
              <div
                key={key}
                className={cn(
                  'flex gap-3 rounded-xl border p-4',
                  block.tone === 'warning' ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5',
                )}
              >
                <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', block.tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')} />
                <div>
                  <p className="font-semibold">{block.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{block.text}</p>
                </div>
              </div>
            );
          }
          case 'materials':
            return <MaterialTable key={key} materials={HANDBOOK_MATERIALS} tagLabels={MATERIAL_TAG_LABELS} enclosureLabels={ENCLOSURE_LABELS} />;
          case 'tolerances':
            return <ToleranceTable key={key} />;
          case 'fit-calculator':
            // Trimmed to id/fit/clearanceMm: example/note text stays server-only (smaller RSC payload).
            return <FitCalculator key={key} options={HANDBOOK_TOLERANCES.map(({ id, fit, clearanceMm }) => ({ id, fit, clearanceMm }))} />;
          case 'cost-calculator': {
            // CTA rendered here (server) and passed as children: zero client JS for the link.
            const link = resolveHandbookToolLink('bao-gia', { baoGiaEnabled });
            return (
              <PrintCostCalculator key={key}>
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">Không có máy, hoặc không muốn mất công hiệu chỉnh? Để xưởng in giúp bạn.</p>
                  <Link href={link.href} className={storefrontButtonClasses('primary', 'shrink-0 gap-1.5 text-sm')}>
                    {link.ctaLabel}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </PrintCostCalculator>
            );
          }
          case 'troubleshooting':
            return <TroubleshootingTable key={key} />;
          case 'checklist':
            return <InteractiveChecklist key={key} items={HANDBOOK_CHECKLIST} />;
          case 'tool':
            return <ToolBridge key={key} block={block} baoGiaEnabled={baoGiaEnabled} />;
          default: {
            const exhaustive: never = block;
            return exhaustive;
          }
        }
      })}
    </div>
  );
}
