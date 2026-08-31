import Link from 'next/link';
import { Zap, ShieldCheck, Timer } from 'lucide-react';
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

// Each hero badge now links to the section/page that actually backs its claim, instead of being a
// plain unclickable <span> (Phase 8 feedback vấn đề 5).
const HERO_VALUE_PROPS = [
  { icon: Zap, label: 'In nhanh 24h', href: '/#workflow' },
  { icon: ShieldCheck, label: 'Nhựa nguyên sinh cao cấp', href: '/#materials' },
  { icon: Timer, label: 'Báo giá nhanh trong 30p', href: '/custom-print' },
];

const FAQ_ITEMS = [
  {
    question: 'Thời gian in và giao hàng mất bao lâu?',
    answer: 'Sản phẩm sẵn hàng đóng gói và giao trong 24–48 giờ làm việc. Đơn đặt in theo yêu cầu có thời gian sản xuất tuỳ độ phức tạp, được báo cụ thể ngay trong bước báo giá (trong vòng 30 phút sau khi gửi file).',
  },
  {
    question: 'File thiết kế 3D của tôi có được bảo mật không?',
    answer: 'File .stl/.step/.obj/.3mf bạn gửi chỉ dùng để báo giá và sản xuất đúng đơn hàng của bạn, không dùng cho mục đích khác và không chia sẻ cho bên thứ ba. Chi tiết xem Chính sách bảo mật file thiết kế 3D.',
  },
  {
    question: 'Vật liệu nào phù hợp với nhu cầu của tôi?',
    answer: 'PLA phù hợp mô hình trang trí chi tiết cao, PETG bền và chịu va đập tốt cho phụ kiện dùng hàng ngày, Resin cho độ mịn và chi tiết cực cao. Xem so sánh đầy đủ ở mục Vật liệu bên trên.',
  },
  {
    question: 'Tôi có thể thanh toán và đổi trả như thế nào?',
    answer: 'Hỗ trợ thanh toán khi nhận hàng (COD) hoặc chuyển khoản trước khi sản xuất. Sản phẩm lỗi sản xuất hoặc giao sai được đổi/trả trong 7 ngày kể từ ngày nhận hàng; đơn đặt in theo yêu cầu đã đúng file và đã duyệt báo giá thì không áp dụng đổi trả.',
  },
  {
    question: 'Không tìm thấy mẫu tôi cần trong danh mục sản phẩm thì sao?',
    answer: 'Gửi file thiết kế hoặc mô tả ý tưởng qua trang Đặt in theo yêu cầu — đội ngũ kỹ thuật sẽ tư vấn vật liệu và báo giá riêng cho đơn của bạn.',
  },
];

// Built from FAQ_ITEMS above, not fabricated content — same "real data only" rule as the
// LocalBusiness JSON-LD (phase-7.md decision #5).
const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
};

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
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
          {HERO_VALUE_PROPS.map(({ icon: Icon, label, href }) => (
            <Link
              key={label}
              href={href}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground transition-colors duration-150 hover:border-primary/50 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Icon className="size-4 text-primary" aria-hidden="true" />
              {label}
            </Link>
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

      <section id="workflow" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
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

        <div className="mt-6 rounded-xl border border-border bg-secondary/50 p-4">
          <p className="text-sm font-semibold text-foreground">Cách tính giá</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Chi phí = Vật liệu tiêu hao (gram) + Thời gian in (giờ) + Xử lý bề mặt. Vì mỗi file có
            khối lượng và độ phức tạp khác nhau, chúng tôi không niêm yết một bảng giá cố định — gửi
            file để nhận báo giá chính xác trong 30 phút.
          </p>
          <Link href="/custom-print" className={storefrontButtonClasses('secondary', 'mt-3 text-sm')}>
            Gửi file nhận báo giá
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader title="Cam kết chất lượng" description="Mỗi sản phẩm được kiểm tra độ bền và độ chính xác cơ khí trước khi giao đến khách hàng." />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader eyebrow="Hỗ trợ" title="Câu hỏi thường gặp" />
        <div className="flex flex-col gap-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="group rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer list-none font-heading text-base font-semibold text-foreground marker:content-none">
                {item.question}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
