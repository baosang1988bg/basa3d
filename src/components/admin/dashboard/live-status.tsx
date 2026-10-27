'use client';

// Dashboard "live" header control (UX refresh 2026-10-27): shows when the numbers were read, refreshes
// them on demand (R key or button) and, by default, every 60 s while the tab is visible. It only calls
// router.refresh() — the server re-renders with fresh queries; there is no socket or polling API.
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const AUTO_REFRESH_MS = 60_000;
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

export function LiveStatus({ updatedAt }: { updatedAt: string }) {
  const router = useRouter();
  const [auto, setAuto] = useState(true);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [auto, refresh]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === 'r' && !event.metaKey && !event.ctrlKey) refresh();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refresh]);

  return (
    <div className="flex items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
          auto ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400' : 'bg-muted text-muted-foreground ring-border',
        )}
      >
        <span className="relative flex size-1.5">
          {auto ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:hidden" /> : null}
          <span className={cn('relative inline-flex size-1.5 rounded-full', auto ? 'bg-emerald-500' : 'bg-muted-foreground')} />
        </span>
        {auto ? 'Tự cập nhật' : 'Đã tạm dừng'}
        <span className="font-mono tabular-nums opacity-80">{timeFormat.format(new Date(updatedAt))}</span>
      </span>
      <div className="inline-flex h-8 items-center rounded-md border border-border/70 bg-background/60 p-0.5">
        <button
          type="button"
          onClick={() => setAuto((value) => !value)}
          aria-pressed={auto}
          title={auto ? 'Tạm dừng tự cập nhật' : 'Bật tự cập nhật mỗi phút'}
          className="grid h-full w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {auto ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={refresh}
          title="Làm mới số liệu (phím R)"
          aria-label="Làm mới số liệu"
          className="grid h-full w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className={cn('size-3.5', isPending && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}
