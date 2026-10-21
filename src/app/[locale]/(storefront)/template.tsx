'use client';

import { useEffect, useState, type ReactNode } from 'react';

// Phase 43: a template (unlike a layout) re-mounts on every navigation, so the page content can ease
// in after a client-side route change. It must NOT animate on the first page load: fading in the
// server HTML would delay LCP and the ui-ux skill forbids load animations. The module-level flag is
// false on the server and on the hydrating first render (identical markup, no hydration mismatch)
// and becomes true after that first mount, so only later navigations get the class.
let hasMountedOnce = false;

export default function StorefrontTemplate({ children }: { children: ReactNode }) {
  const [animateIn] = useState(() => hasMountedOnce);

  useEffect(() => {
    hasMountedOnce = true;
  }, []);

  return <div className={animateIn ? 'motion-safe:animate-page-enter' : undefined}>{children}</div>;
}
