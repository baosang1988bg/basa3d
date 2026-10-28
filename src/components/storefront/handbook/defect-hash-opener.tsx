'use client';

import { useEffect } from 'react';
import { parseDefectHash } from '@/lib/handbook/defect-anchor';

// Phase 53 S7 — opens the <details> a shared link points at (`/cam-nang#loi-stringing`). The browser
// already scrolls to the element; this only sets `open`, so it causes no scroll jump. Not every
// browser expands a <details> that is itself the fragment target, hence this tiny island. Renders
// nothing; without JS the visitor still lands on the right (collapsed) defect.

function openDefectFromHash() {
  const anchor = parseDefectHash(window.location.hash);
  if (!anchor) return;
  const element = document.getElementById(anchor);
  if (element instanceof HTMLDetailsElement) element.open = true;
}

export function DefectHashOpener() {
  useEffect(() => {
    openDefectFromHash();
    window.addEventListener('hashchange', openDefectFromHash);
    return () => window.removeEventListener('hashchange', openDefectFromHash);
  }, []);
  return null;
}
