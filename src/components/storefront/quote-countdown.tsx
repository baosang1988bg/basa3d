'use client';

import { useEffect, useState } from 'react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Đã hết hạn';
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Còn hiệu lực ${days} ngày ${hours} giờ`;
  if (hours > 0) return `Còn hiệu lực ${hours} giờ ${minutes} phút`;
  return `Còn hiệu lực ${minutes} phút — sắp hết hạn`;
}

// Client component so the countdown ticks in the browser without re-fetching the (server-rendered)
// page every minute. Purely cosmetic — actual expiry enforcement happens server-side in
// quote.service.ts (canAcceptQuote / token TTL), this never grants/denies access on its own.
export function QuoteCountdown({ validUntil }: { validUntil: string }) {
  const target = new Date(validUntil).getTime();
  const [remainingMs, setRemainingMs] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => setRemainingMs(target - Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [target]);

  const expired = remainingMs <= 0;
  return (
    <p className={expired ? 'text-sm font-medium text-destructive' : 'text-sm font-medium text-muted-foreground'}>
      {formatRemaining(remainingMs)}
    </p>
  );
}
