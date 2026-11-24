import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrendHunterClient } from '@/components/admin/trend-hunter-client';
import { listTrendWatchItems, type TrendWatchItem } from '@/services/trend-hunter.service';

export const metadata: Metadata = {
  title: 'Trung Tâm Săn Mẫu Trend — BaSa3D Admin',
  description: 'Theo dõi nguồn trend MakerWorld CN, Douyin, Thangs và lưu trữ mẫu hot đón đầu thị trường.',
};

export default async function AdminTrendHunterPage() {
  await requireAdmin();
  let initialItems: TrendWatchItem[] = [];
  let loadError: string | null = null;
  try {
    initialItems = await listTrendWatchItems();
  } catch (error) {
    // Keep the feeds/capture tabs usable; surface the watchlist failure instead of an empty list.
    console.error('[TREND_WATCHLIST_LOAD_FAILED]', error instanceof Error ? error.message : error);
    loadError = 'Không tải được Watchlist. Kiểm tra migration 20261124000000_trend_watch_items đã chạy chưa.';
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <TrendHunterClient initialItems={initialItems} loadError={loadError} />
    </div>
  );
}
