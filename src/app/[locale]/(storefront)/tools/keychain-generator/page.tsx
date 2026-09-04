import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';
import { Breadcrumb } from '@/components/storefront/breadcrumb';

const KeychainGenerator = dynamic(() => import('@/components/storefront/keychain-generator').then((module) => module.KeychainGenerator), { loading: () => <div className="min-h-[360px] animate-pulse rounded-xl bg-muted" /> });

export const metadata: Metadata = { title: 'Tạo móc khoá khắc tên 3D', description: 'Tự tạo mẫu móc khoá khắc tên, xem trước 3D, tải STL hoặc gửi yêu cầu báo giá tới BaSa3D.' };

export default async function KeychainToolPage() {
  const t = await getTranslations('tools');
  return <div className="mx-auto max-w-6xl px-4 py-10"><Breadcrumb items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbTools'), href: '/tools' }, { label: t('keychainBreadcrumb') }]} /><header className="mb-8 max-w-3xl"><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('eyebrow')}</p><h1 className="font-heading mt-2 text-3xl font-extrabold md:text-4xl">{t('keychainTitle')}</h1><p className="mt-3 text-muted-foreground">{t('keychainDescription')}</p></header><KeychainGenerator /></div>;
}
