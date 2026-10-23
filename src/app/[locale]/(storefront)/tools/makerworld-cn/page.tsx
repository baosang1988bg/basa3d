import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';
import { Breadcrumb } from '@/components/storefront/breadcrumb';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';

const MakerWorldCnTool = dynamic(
  () => import('@/components/storefront/makerworld-cn-tool').then((m) => m.MakerWorldCnTool),
  { loading: () => <div className="min-h-[360px] animate-pulse rounded-2xl bg-muted" /> }
);

export const metadata: Metadata = {
  title: 'Xem & Tải mẫu MakerWorld China — BaSa3D',
  description: 'Công cụ bóc tách thông số bàn in, xem trước chi tiết và hỗ trợ tải file 3MF từ MakerWorld nội địa Trung Quốc.',
};

export default async function MakerWorldCnToolPage({
  params,
  searchParams,
}: {
  params: LocaleParams;
  searchParams?: Promise<{ url?: string }>;
}) {
  await applyRequestLocale(params);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialUrl = resolvedSearchParams?.url;
  const t = await getTranslations('tools');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumb
        items={[
          { label: t('breadcrumbHome'), href: '/home' },
          { label: t('breadcrumbTools'), href: '/tools' },
          { label: 'MakerWorld China' },
        ]}
      />
      <header className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Tiện ích 3D</p>
        <h1 className="font-heading mt-2 text-3xl font-extrabold md:text-4xl text-foreground">
          Khám phá & Tải mẫu MakerWorld
        </h1>
        <p className="mt-3 text-muted-foreground">
          Hỗ trợ tìm và tải mẫu 3D từ cả MakerWorld Quốc tế và nội địa Trung Quốc.
          Dán liên kết bất kỳ để xem trước 3D, bóc tách thông số bàn in, tải file .3mf và tính giá in xưởng ngay tức thì.
        </p>
      </header>
      <MakerWorldCnTool initialUrl={initialUrl} />
    </div>
  );
}
