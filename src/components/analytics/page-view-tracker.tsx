'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { sendGAEvent } from '@/lib/analytics';

export function PageViewTracker({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    const pagePath = query ? `${pathname}?${query}` : pathname;
    sendGAEvent('page_view', {
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
      send_to: gaId,
      ...(process.env.NODE_ENV !== 'production' || searchParams.has('debug_mode') ? { debug_mode: true } : {}),
    });
  }, [gaId, pathname, query, searchParams]);
  return null;
}
