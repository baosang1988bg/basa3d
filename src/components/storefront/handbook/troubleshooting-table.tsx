import { HANDBOOK_DEFECTS } from '@/data/handbook/troubleshooting';
import { DefectPhotoToggle } from './defect-photo-toggle';

/**
 * Server component. Native <details> gives expand/collapse without client JS; the fixes stay in the
 * HTML (indexable), and Chromium's find-in-page auto-opens a matching <details>.
 */
export function TroubleshootingTable() {
  return (
    <div className="not-prose space-y-2">
      {HANDBOOK_DEFECTS.map((defect) => (
        <details key={defect.id} className="group rounded-xl border border-border bg-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block font-semibold">{defect.name}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{defect.symptom}</span>
            </span>
            <span aria-hidden="true" className="mt-1 text-muted-foreground transition-transform duration-150 group-open:rotate-45">+</span>
          </summary>
          {defect.photos && <DefectPhotoToggle defectId={defect.id} defectName={defect.name} photos={defect.photos} />}
          <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-9 text-sm marker:font-semibold marker:text-primary">
            {defect.fixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}
