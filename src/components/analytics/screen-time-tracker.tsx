'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { sanitizeAnalyticsUrl, trackScreenTime } from '@/lib/analytics';
import { createDwellTimer, type DwellResult, type DwellTimer } from '@/lib/analytics-dwell-timer';

// Active dwell time per route → `screen_time`. Logic lives in the pure dwell timer; this component
// only wires browser signals to it. Rules: docs/marketing/ga4-tracking-guide.md § "Screen time".
//
// Keyed by pathname only (no query string) so filter/sort/pagination on one screen does not split
// the measurement into many tiny events.

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart', 'mousemove'] as const;
const TITLE_SETTLE_MS = 500;

function report(result: DwellResult | null, title: string) {
  if (!result) return;
  trackScreenTime({
    page_path: result.key,
    page_location: `${window.location.origin}${result.key}`,
    screen_time_msec: result.ms,
    page_title: title || undefined,
  });
}

export function ScreenTimeTracker({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const timerRef = useRef<DwellTimer | null>(null);
  const titleRef = useRef('');

  function getTimer(): DwellTimer {
    timerRef.current ??= createDwellTimer(() => performance.now());
    return timerRef.current;
  }

  // Browser signals — registered once.
  useEffect(() => {
    if (!gaId) return;
    const timer = getTimer();

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        // Last reliable moment on mobile (iOS may never fire pagehide/unload): flush here.
        timer.hide();
        report(timer.flush(), titleRef.current);
      } else {
        timer.show();
      }
    }
    function handlePageHide() {
      timer.hide();
      report(timer.flush(), titleRef.current);
    }
    function handlePageShow(event: PageTransitionEvent) {
      // Restored from bfcache: time spent frozen must not count.
      if (event.persisted && document.visibilityState === 'visible') timer.show();
    }
    function handleActivity() {
      timer.activity();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, handleActivity, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, handleActivity);
    };
  }, [gaId]);

  // One measurement per route. The cleanup is the single flush point for route changes.
  useEffect(() => {
    if (!gaId) return;
    const timer = getTimer();
    timer.start(sanitizeAnalyticsUrl(pathname), document.visibilityState === 'visible');

    // Capture the title of THIS route now and once metadata has settled — by cleanup time
    // document.title may already belong to the next route.
    titleRef.current = document.title;
    const titleTimer = window.setTimeout(() => {
      titleRef.current = document.title;
    }, TITLE_SETTLE_MS);

    return () => {
      window.clearTimeout(titleTimer);
      report(timer.flush(), titleRef.current);
    };
  }, [pathname, gaId]);

  return null;
}
