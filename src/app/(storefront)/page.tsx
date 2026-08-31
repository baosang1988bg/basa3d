import Link from 'next/link';
import { listStorefrontProducts } from '@/services/storefront-catalog.service';
import { ProductCard } from '@/components/storefront/product-card';
import { SectionHeader } from '@/components/storefront/section-header';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { MaterialBadge } from '@/components/storefront/material-badge';
import { SITE_CONFIG } from '@/config/site';

// LocalBusiness JSON-LD data comes straight from SITE_CONFIG (already env-driven with sensible
// fallbacks) — not fabricated (phase-7.md decision #5). SITE_CONFIG.address is city-level only, so
// this uses addressLocality rather than a full street address that doesn't exist yet.
const LOCAL_BUSINESS_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
  telephone: SITE_CONFIG.hotline,
  email: SITE_CONFIG.email,
  address: { '@type': 'PostalAddress', addressLocality: SITE_CONFIG.address, addressCountry: 'VN' },
};

const CATEGORIES = [
  { name: 'Mô hình / Art Toys', description: 'Nhân vật, mô hình sưu tầm chi tiết cao' },
  { name: 'Decor bàn làm việc', description: 'Vật trang trí, đèn, chậu cây mini' },
  { name: 'Phụ kiện tiện ích', description: 'Giá đỡ, hộp đựng, phụ kiện đời sống' },
  { name: 'Linh kiện kỹ thuật', description: 'Chi tiết máy, gá lắp, prototype' },
];

const WORKFLOW_STEPS = [
  { step: '1', title: 'Gửi file', description: 'Gửi file .stl/.step/.obj/.3mf hoặc ảnh vẽ mẫu' },
  { step: '2', title: 'Tư vấn & Tối ưu', description: 'Đội ngũ kỹ thuật kiểm tra và tư vấn vật liệu phù hợp' },
  { step: '3', title: 'Báo giá 30 phút', description: 'Nhận báo giá minh bạch trong vòng 30 phút' },
  { step: '4', title: 'In & Giao hàng', description: 'Sản xuất và giao hàng tận nơi' },
];

// Forces on-demand rendering instead of build-time static generation: this page reads live
// catalog/stock data (product status and inventory availability change frequently), and without
// this, Next.js would try to statically prerender it at `next build` time using whatever
// DATABASE_URL happens to be set in the build environment — stale forever until the next deploy.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { items: featuredProducts } = await listStorefrontProducts({ limit: 8 });

  return (
    <>
      {/* Static JSON-LD constructed server-side from our own data, not user input rendered as HTML. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_JSON_LD) }} />
      <section className="mx-auto max-w-6xl px-4 py-16 text-center md:py-24">
        <h1 className="font-heading mx-auto max-w-3xl text-4xl font-extrabold text-foreground md:text-[3.25rem] md:leading-[1.15]">
          Hiện Thực Hóa Mọi Ý Tưởng Với Công Nghệ In 3D Chuẩn Xác
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Xưởng in 3D BaSa3D — từ mô hình sưu tầm đến linh kiện kỹ thuật chính xác, sản xuất theo yêu cầu với vật liệu nguyên sinh cao cấp.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/custom-print" className={storefrontButtonClasses('accent')}>Gửi file in theo yêu cầu</Link>
          <Link href="/products" className={storefrontButtonClasses('secondary')}>Khám phá sản phẩm</Link>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {['In nhanh 24h', 'Nhựa nguyên sinh cao cấp', 'Báo giá nhanh trong 30p'].map((badge) => (
            <span key={badge} className="rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground">{badge}</span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader eyebrow="Danh mục" title="Khám phá theo danh mục" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {CATEGORIES.map((category) => (
            <div key={category.name} className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-base font-semibold text-foreground">{category.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            </div>
          ))}
        </div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeader eyebrow="Nổi bật" title="Sản phẩm tiêu biểu" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader eyebrow="Quy trình" title="Đặt in theo yêu cầu chỉ với 4 bước" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {WORKFLOW_STEPS.map((item) => (
            <div key={item.step} className="rounded-xl border border-border bg-card p-4">
              <span className="font-heading inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{item.step}</span>
              <h3 className="font-heading mt-3 text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/custom-print" className={storefrontButtonClasses('primary')}>Bắt đầu đặt in</Link>
        </div>
      </section>

      <section id="materials" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <SectionHeader eyebrow="Vật liệu" title="So sánh nhanh vật liệu in 3D" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <MaterialBadge material="PLA" />
            <p className="mt-2 text-sm text-muted-foreground">Dễ in, chi tiết cao, phù hợp mô hình trang trí, giá thành thấp.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <MaterialBadge material="PETG" />
            <p className="mt-2 text-sm text-muted-foreground">Bền, chịu va đập tốt, phù hợp phụ kiện sử dụng hàng ngày.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <MaterialBadge material="RESIN" />
            <p className="mt-2 text-sm text-muted-foreground">Độ chi tiết cực cao, bề mặt mịn, phù hợp mô hình sưu tầm cao cấp.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader title="Cam kết chất lượng" description="Mỗi sản phẩm được kiểm tra độ bền và độ chính xác cơ khí trước khi giao đến khách hàng." />
      </section>
    </>
  );
}
