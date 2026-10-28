'use client';

import type { ReactNode } from 'react';
import { trackHandbookPresetDownload } from '@/lib/analytics';

/**
 * Phase 53 (S8) — Client island wrapping slicer preset download links to capture GA measurement.
 * Never imports from src/data/handbook. All parameters are passed as plain scalar props.
 */
export function PresetDownloadLink({
  presetId,
  href,
  download,
  className,
  children,
}: {
  presetId: string;
  href: string;
  download: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      download={download}
      data-preset-id={presetId}
      onClick={() => trackHandbookPresetDownload(presetId)}
      className={className}
    >
      {children}
    </a>
  );
}
