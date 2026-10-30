import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/storefront/breadcrumb';
import { BAO_GIA_FAQ, BAO_GIA_SAMPLES } from '@/config/bao-gia-samples';
import { isBaoGiaEnabled } from '@/config/bao-gia';
import { FDM_MATERIALS } from '@/lib/pricing/fdm-estimate-model';
import { estimateFromMeshMetrics, loadPricingContext } from '@/services/instant-estimate.service';
import { QuoteWorkspace, type QuoteTab } from '@/components/bao-gia/quote-workspace';

// Live prices from the current pricing config — never prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Báo giá in 3D tức thì từ file STL hoặc Link MakerWorld | BaSa3D',
  description: 'Tải file STL/OBJ hoặc dán link MakerWorld, chỉnh vật liệu, độ đặc, tỉ lệ, số lượng và xem giá ước tính ngay — xưởng xác nhận báo giá chính thức cho từng món.',
};

export default async function BaoGiaPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; url?: string }>;
}) {
  // D7: off until the estimate model is calibrated (S0).
  if (!isBaoGiaEnabled()) notFound();
  const ctx = await loadPricingContext();
  // O6: offer only FDM materials that have an active priced material in inventory.
  const materials = ctx ? FDM_MATERIALS.filter((type) => (ctx.medians.get(type) ?? 0) > 0) : [];
  const samples = BAO_GIA_SAMPLES.map((sample) => {
    const estimate = ctx ? estimateFromMeshMetrics(ctx, { metrics: sample.metrics, scalePermille: 1000, infillPct: sample.infillPct, materialType: sample.materialType, quantity: 1 }) : null;
    return { ...sample, priceVnd: estimate?.status === 'OK' ? estimate.lineSubtotalVnd : null };
  });

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialTab: QuoteTab = resolvedSearchParams?.tab === 'file' ? 'file' : 'link';
  const initialUrl = resolvedSearchParams?.url;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="print:hidden">
        <Breadcrumb items={[{ label: 'Trang chủ', href: '/home' }, { label: 'Báo giá' }]} />
        <section className="text-center mb-8">
          <h1 className="font-heading text-3xl font-extrabold text-foreground md:text-4xl">
            Báo giá in 3D tức thì
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
            Tính giá in 3D nhanh chóng và minh bạch. Vui lòng chọn phương thức phù hợp: dán link mẫu 3D từ MakerWorld để bóc tách tự động hoặc tải file STL/OBJ có sẵn từ máy tính.
          </p>
        </section>
      </div>

      <QuoteWorkspace
        materials={materials}
        samples={samples}
        initialTab={initialTab}
        initialUrl={initialUrl}
      />

      <section className="mt-14 print:hidden">
        <h2 className="font-heading text-xl font-bold text-foreground">Câu hỏi thường gặp</h2>
        <div className="mt-3 flex flex-col gap-2">
          {BAO_GIA_FAQ.map((entry) => (
            <details key={entry.q} className="rounded-lg border border-border bg-card p-4">
              <summary className="cursor-pointer font-medium text-foreground">{entry.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{entry.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Có file .3mf, file STEP hoặc chỉ có ý tưởng? <Link href="/custom-print" className="font-medium text-primary hover:underline">Gửi ở trang Đặt in theo yêu cầu</Link>.
        </p>
      </section>
    </div>
  );
}
