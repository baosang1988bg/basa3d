import { Check, X } from 'lucide-react';

export type ProcessStepState = 'completed' | 'current' | 'upcoming' | 'terminated';

export interface ProcessStep {
  status: string;
  label: string;
}

const STATE_STYLES: Record<ProcessStepState, { circle: string; label: string; line: string }> = {
  completed: { circle: 'border-emerald-500 bg-emerald-500 text-white', label: 'text-foreground', line: 'bg-emerald-500' },
  current: { circle: 'border-amber-500 bg-amber-500 text-white', label: 'text-foreground font-medium', line: 'bg-border' },
  upcoming: { circle: 'border-border bg-muted text-muted-foreground', label: 'text-muted-foreground', line: 'bg-border' },
  terminated: { circle: 'border-destructive bg-destructive text-white', label: 'text-destructive font-medium', line: 'bg-border' },
};

// Renders a horizontal step-by-step process (orders / custom requests / print jobs), plus an
// optional trailing "terminated" state (CANCELLED / REJECTED / FAILED) that sits outside the
// forward-only step list — those statuses don't advance the pointer, they replace it, since the
// underlying state machines don't step backward through them (see business-rules.md).
export function ProcessStepper({
  steps,
  currentStatus,
  terminalStatuses = [],
}: {
  steps: ProcessStep[];
  currentStatus: string;
  /** Statuses that don't occupy a forward step (CANCELLED, REJECTED, FAILED, REPRINT, ...). */
  terminalStatuses?: { status: string; label: string }[];
}) {
  const terminatedStatus = terminalStatuses.find((entry) => entry.status === currentStatus) ?? null;
  const isTerminated = terminatedStatus != null;
  const currentIndex = steps.findIndex((step) => step.status === currentStatus);

  function stateFor(index: number): ProcessStepState {
    if (isTerminated) return index === steps.length - 1 ? 'upcoming' : 'completed';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const state = stateFor(index);
          const style = STATE_STYLES[state];
          const isLast = index === steps.length - 1;
          return (
            <li key={step.status} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${style.circle}`}>
                  {state === 'completed' ? <Check className="size-4" /> : index + 1}
                </span>
                <span className={`whitespace-nowrap text-xs ${style.label}`}>{step.label}</span>
              </div>
              {!isLast ? <span className={`mx-2 h-0.5 flex-1 rounded ${state === 'completed' ? STATE_STYLES.completed.line : STATE_STYLES.upcoming.line}`} /> : null}
            </li>
          );
        })}
      </ol>
      {isTerminated && terminatedStatus ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
          <X className="size-3.5" /> {terminatedStatus.label}
        </div>
      ) : null}
    </div>
  );
}
