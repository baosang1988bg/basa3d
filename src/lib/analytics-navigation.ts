// Decides whether a URL-driven state change (e.g. /products?q=…) was caused by the user acting on
// this page, so URL-observing trackers do not re-fire on reload, back/forward or external landings.
// Pure function + a tiny browser adapter. Rules: docs/marketing/ga4-tracking-guide.md § "Search & filter".

export type NavigationOrigin = 'user' | 'history' | 'reload' | 'landing';

export const POPSTATE_WINDOW_MS = 5_000;

export function classifyNavigationOrigin(input: {
  /** True when this URL is the document's initial load (no soft navigation has happened yet). */
  isInitialDocument: boolean;
  /** PerformanceNavigationTiming.type of the document load. */
  navigationType?: string;
  referrer: string;
  origin: string;
  /** ms since the last popstate (browser back/forward inside the SPA), null if none. */
  msSincePopstate: number | null;
}): NavigationOrigin {
  if (input.msSincePopstate !== null && input.msSincePopstate >= 0 && input.msSincePopstate < POPSTATE_WINDOW_MS) {
    return 'history';
  }
  if (input.isInitialDocument) {
    if (input.navigationType === 'reload') return 'reload';
    if (input.navigationType === 'back_forward') return 'history';
    // A plain GET <form> submit is a full load with a same-origin referrer → user action.
    if (!isSameOrigin(input.referrer, input.origin)) return 'landing';
  }
  return 'user';
}

function isSameOrigin(referrer: string, origin: string): boolean {
  if (!referrer) return false;
  try {
    return new URL(referrer).origin === origin;
  } catch {
    return false;
  }
}

// ---- Browser adapter -------------------------------------------------------------------------

let lastPopstateAt: number | null = null;
let listening = false;
let initialDocumentConsumed = false;

function ensurePopstateListener() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('popstate', () => {
    lastPopstateAt = performance.now();
  });
}

if (typeof window !== 'undefined') ensurePopstateListener();

/** Call once per observed URL change, from a client effect. */
export function currentNavigationOrigin(): NavigationOrigin {
  if (typeof window === 'undefined') return 'landing';
  ensurePopstateListener();
  const entry = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  const isInitialDocument = !initialDocumentConsumed && (!entry || entry.name === window.location.href);
  initialDocumentConsumed = true;
  return classifyNavigationOrigin({
    isInitialDocument,
    navigationType: entry?.type,
    referrer: document.referrer,
    origin: window.location.origin,
    msSincePopstate: lastPopstateAt === null ? null : performance.now() - lastPopstateAt,
  });
}
