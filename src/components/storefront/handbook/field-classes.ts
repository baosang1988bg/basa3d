// Phase 53 — shared native-control styling for the handbook calculators. Plain <input>/<select>
// instead of the Base UI wrappers in components/ui: same look, zero extra client JS on /cam-nang.

export const handbookFieldClasses =
  'h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-card';

export const handbookLabelClasses = 'text-sm font-medium';

export const handbookPanelClasses = 'not-prose rounded-xl border border-border bg-card p-4 sm:p-5';
