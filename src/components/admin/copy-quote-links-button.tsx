'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Phase 33 S7: one /bao-gia request → N quotes; staff paste all links into Zalo at once. */
export function CopyQuoteLinksButton({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false);
  if (!lines.length) return null;
  const text = `Dạ BaSa3D gửi bạn báo giá chính thức cho từng món:\n${lines.join('\n')}`;
  return (
    <Button type="button" size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? 'Đã sao chép' : `Sao chép tất cả link báo giá (${lines.length})`}
    </Button>
  );
}
