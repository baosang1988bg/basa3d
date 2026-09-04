import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Breadcrumb } from '@/components/storefront/breadcrumb';

const KeychainGenerator = dynamic(
  () => import('@/components/storefront/keychain-generator').then((module) => module.KeychainGenerator),
  { loading: () => <div className="min-h-[360px] animate-pulse rounded-xl bg-muted" /> },
);

export const metadata: Metadata = {
  title: 'Tạo móc khoá khắc tên 3D',
  description: 'Tự tạo mẫu móc khoá khắc tên, xem trước 3D, tải STL hoặc gửi yêu cầu báo giá tới BaSa3D.',
};

export default function KeychainToolPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Đặt in', href: '/custom-print' }, { label: 'Tạo mẫu khắc tên' }]} />
      <header className="mb-8 max-w-3xl"><p className="text-sm font-semibold uppercase tracking-wide text-primary">Công cụ miễn phí</p><h1 className="font-heading mt-2 text-3xl font-extrabold md:text-4xl">Tạo móc khoá khắc tên 3D</h1><p className="mt-3 text-muted-foreground">Nhập tên tiếng Việt, xoay và phóng to mẫu ngay trên trình duyệt. Bạn có thể tải một file STL gộp hoặc gửi thẳng tới xưởng để nhận báo giá.</p></header>
      <KeychainGenerator />
    </div>
  );
}
