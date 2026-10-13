import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/storefront/breadcrumb';
import { formatVnd } from '@/components/storefront/format';
import { QuoteFlow } from '@/components/bao-gia/quote-flow';
import { BAO_GIA_RESPONSE_TIME_TEXT, isBaoGiaEnabled } from '@/config/bao-gia';
import { BAO_GIA_FAQ, BAO_GIA_SAMPLES } from '@/config/bao-gia-samples';
import { FDM_MATERIALS } from '@/lib/pricing/fdm-estimate-model';
import { estimateFromMeshMetrics, loadPricingContext } from '@/services/instant-estimate.service';

// Live prices from the current pricing config — never prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Báo giá in 3D tức thì từ file STL | BaSa3D',
  description: 'Tải file STL/OBJ, chỉnh vật liệu, độ đặc, tỉ lệ, số lượng và xem giá ước tính ngay — xưởng xác nhận báo giá chính thức cho từng món.',
};

export default async function BaoGiaPage() {
  // D7: off until the estimate model is calibrated (S0).
  if (!isBaoGiaEnabled()) notFound();
  const ctx = await loadPricingContext();
  // O6: offer only FDM materials that have an active priced material in inventory.
  const materials = ctx ? FDM_MATERIALS.filter((type) => (ctx.medians.get(type) ?? 0) > 0) : [];
  const samples = BAO_GIA_SAMPLES.map((sample) => {
    const estimate = ctx ? estimateFromMeshMetrics(ctx, { metrics: sample.metrics, scalePermille: 1000, infillPct: sample.infillPct, materialType: sample.materialType, quantity: 1 }) : null;
    return { ...sample, priceVnd: estimate?.status === 'OK' ? estimate.lineSubtotalVnd : null };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="print:hidden">
        <Breadcrumb items={[{ label: 'Trang chủ', href: '/home' }, { label: 'Báo giá' }]} />
        <section className="text-center">
          <h1 className="font-heading text-3xl font-extrabold text-foreground md:text-4xl">Báo giá in 3D tức thì</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
            Kéo thả file STL/OBJ, chỉnh vật liệu, độ đặc, tỉ lệ và số lượng — giá ước tính cập nhật ngay, không cần tải file lên.
            Đây là giá ước tính; xưởng xác nhận báo giá chính thức cho từng món {BAO_GIA_RESPONSE_TIME_TEXT}.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-xl font-bold text-foreground">Giá tham khảo</h2>
          <p className="text-sm text-muted-foreground">Tính trực tiếp bằng cùng công thức với báo giá bên dưới, theo cấu hình giá hiện hành.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {samples.map((sample) => (
              <div key={sample.key} className="rounded-xl border border-border bg-card p-4">
                <p className="font-semibold text-foreground">{sample.title}</p>
                <p className="text-xs text-muted-foreground">{sample.description}</p>
                <p className="font-heading mt-2 text-xl font-bold text-foreground">{sample.priceVnd !== null ? `~${formatVnd(sample.priceVnd)}` : 'Xưởng báo giá'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <QuoteFlow materials={materials} />
      </section>

      <section className="mt-12 print:hidden">
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
