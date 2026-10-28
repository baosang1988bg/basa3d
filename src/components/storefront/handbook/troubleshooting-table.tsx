import { Link2 } from 'lucide-react';
import { HANDBOOK_DEFECTS } from '@/data/handbook/troubleshooting';
import { defectAnchorId } from '@/lib/handbook/defect-anchor';
import { DefectHashOpener } from './defect-hash-opener';
import { DefectPhotoToggle } from './defect-photo-toggle';

/**
 * Server component. Native <details> gives expand/collapse without client JS; the fixes stay in the
 * HTML (indexable), and Chromium's find-in-page auto-opens a matching <details>.
 *
 * Phase 53 S7 (I6 DEFER): each defect has a stable anchor (`#loi-<id>`) so it can be shared and
 * deep-linked from search; DefectHashOpener opens the targeted one. scroll-mt matches the chapters'
 * offset below the sticky header + mobile TOC bar.
 */
export function TroubleshootingTable() {
  return (
    <div className="not-prose space-y-2">
      <DefectHashOpener />
      {HANDBOOK_DEFECTS.map((defect) => {
        const anchor = defectAnchorId(defect.id);
        return (
          <details key={defect.id} id={anchor} className="group scroll-mt-28 rounded-xl border border-border bg-card lg:scroll-mt-24">
            <summary className="flex min-h-12 cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-semibold">{defect.name}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{defect.symptom}</span>
              </span>
              <span aria-hidden="true" className="mt-1 text-muted-foreground transition-transform duration-150 group-open:rotate-45">+</span>
            </summary>
            {defect.photos && <DefectPhotoToggle defectId={defect.id} defectName={defect.name} photos={defect.photos} />}
            <ol className="list-decimal space-y-1.5 px-4 pl-9 text-sm marker:font-semibold marker:text-primary">
              {defect.fixes.map((fix) => (
                <li key={fix}>{fix}</li>
              ))}
            </ol>
            <p className="px-4 pt-2 pb-4">
              <a
                href={`#${anchor}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Link2 className="size-3.5" aria-hidden="true" />
                Link tới lỗi này
                <span className="sr-only">: {defect.name}</span>
              </a>
            </p>
          </details>
        );
      })}
    </div>
  );
}
