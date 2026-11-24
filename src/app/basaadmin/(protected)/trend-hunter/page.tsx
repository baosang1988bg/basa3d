import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrendHunterClient } from '@/components/admin/trend-hunter-client';
import { listTrendWatchItems } from '@/services/trend-hunter.service';

export const metadata: Metadata = {
  title: 'Trung Tâm Săn Mẫu Trend — BaSa3D Admin',
  description: 'Theo dõi nguồn trend MakerWorld CN, Douyin, Thangs và lưu trữ mẫu hot đón đầu thị trường.',
};

export default async function AdminTrendHunterPage() {
  await requireAdmin();
  const initialItems = await listTrendWatchItems();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <TrendHunterClient initialItems={initialItems} />
    </div>
  );
}
