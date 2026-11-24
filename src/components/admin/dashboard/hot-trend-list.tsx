import Link from 'next/link';
import { Flame, TrendingUp } from 'lucide-react';
import type { TrendWatchItem } from '@/services/trend-hunter.service';

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

/**
 * ADR-0064 — dashboard "Mẫu đang nóng": top active Trend Radar items by downloads/day (from the daily
 * snapshot cron). `items === null` means the trend tables are not migrated yet.
 */
export function HotTrendList({ items }: { items: TrendWatchItem[] | null }) {
  if (items === null) {
    return <p className="text-sm text-muted-foreground">Chưa có dữ liệu Trend Radar — chạy migration theo <code>docs/operations/trend-radar-owner-guide.md</code>.</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Chưa có mẫu nào đủ số liệu. Lưu mẫu vào Watchlist ở <Link href="/basaadmin/trend-hunter" className="font-medium text-primary underline-offset-2 hover:underline">Săn mẫu Trend</Link> — cron chụp số liệu mỗi ngày, cần ≥ 2 ngày để tính độ nóng.
      </p>
    );
  }
  return (
    <ol className="flex flex-col divide-y divide-border">
      {items.map((item, index) => {
        const pop = item.popularity;
        return (
          <li key={item.id} className="flex items-center gap-3 py-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-xs font-bold text-rose-600">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-foreground hover:underline">{item.title}</a>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span>{item.platform}</span>
                {pop?.downloads != null ? <span>⬇ {nf.format(pop.downloads)}</span> : null}
                {pop?.likes != null ? <span>♥ {nf.format(pop.likes)}</span> : null}
                <span className={item.licenseSafety.canDirectSell ? 'text-emerald-600' : 'text-rose-600'}>{item.licenseSafety.badgeLabel}</span>
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-foreground">
              {pop?.downloadsPerDay != null ? (
                <><TrendingUp className="size-4 text-rose-600" aria-hidden="true" />+{nf.format(pop.downloadsPerDay)}/ngày</>
              ) : (
                <><Flame className="size-4 text-muted-foreground" aria-hidden="true" /><span className="text-xs font-normal text-muted-foreground">chờ số liệu</span></>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
