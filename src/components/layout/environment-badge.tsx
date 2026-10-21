import { BUILD_INFO, CHANNEL_LABELS, VERSION_LABEL } from '@/config/build-info';

// Phase 44 (ADR-0046): a small corner tag on every non-production build (Vercel Preview, local dev)
// so a test deployment is never mistaken for the live shop — e.g. orders placed on a Preview
// that points at the Development database. Production renders nothing. Bottom-left, because the
// Zalo button owns bottom-right; `pointer-events-none` so it never blocks a click underneath.
export function EnvironmentBadge() {
  if (BUILD_INFO.channel === 'production') return null;
  const tone = BUILD_INFO.channel === 'preview'
    ? 'bg-amber-500 text-amber-950'
    : 'bg-slate-800 text-slate-50 dark:bg-slate-200 dark:text-slate-900';
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed bottom-2 left-2 z-[60] rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold shadow-sm print:hidden ${tone}`}
    >
      {`${CHANNEL_LABELS[BUILD_INFO.channel].toUpperCase()} · ${VERSION_LABEL}`}
    </div>
  );
}
