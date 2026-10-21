import { MaterialBadge } from '@/components/storefront/material-badge';
import { Breadcrumb } from '@/components/storefront/breadcrumb';
import { CustomRequestForm } from './custom-request-form';
import Link from 'next/link';
import { storefrontButtonClasses } from '@/components/storefront/button';
import { MakerWorldIntakeCard } from '@/components/storefront/makerworld-intake-card';

const STEPS = [
  { step: '1', title: 'Tải file, xem giá ngay', description: 'File .3mf đã slice cho giá ước tính tức thì; .stl/.obj cho khoảng giá; .step hoặc ảnh mẫu thì xưởng báo giá' },
  { step: '2', title: 'Tư vấn & Tối ưu', description: 'Đội ngũ kỹ thuật kiểm tra tính khả thi và tối ưu thiết kế để in' },
  { step: '3', title: 'Chốt giá chính thức', description: 'Ưng giá thì để lại liên hệ — xưởng xác nhận giá chính thức trong 2 giờ làm việc' },
  { step: '4', title: 'In & Giao hàng', description: 'Sản xuất theo đúng thông số đã thống nhất và giao hàng tận nơi' },
];

const MATERIALS = [
  { material: 'PLA' as const, durability: 'Trung bình', heat: 'Thấp (~60°C)', finish: 'Chi tiết cao, dễ hoàn thiện', cost: 'Thấp' },
  { material: 'PETG' as const, durability: 'Cao', heat: 'Trung bình (~80°C)', finish: 'Bóng, dẻo dai', cost: 'Trung bình' },
  { material: 'ABS' as const, durability: 'Cao', heat: 'Cao (~100°C)', finish: 'Cần hậu xử lý để mịn', cost: 'Trung bình' },
  { material: 'TPU' as const, durability: 'Rất cao (đàn hồi)', heat: 'Trung bình', finish: 'Mềm dẻo', cost: 'Trung bình - cao' },
];

export default function CustomPrintPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumb items={[{ label: 'Trang chủ', href: '/home' }, { label: 'Đặt in' }]} />
      <section className="text-center">
        <h1 className="font-heading text-3xl font-extrabold text-foreground md:text-4xl">Đặt in 3D theo yêu cầu</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          Gửi file thiết kế hoặc ý tưởng của bạn — BaSa3D tư vấn vật liệu, báo giá minh bạch và sản xuất chính xác.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-2xl font-bold text-foreground">Gửi yêu cầu đặt in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Điền thông tin bên dưới, chúng tôi sẽ liên hệ lại sớm nhất.</p>
        <div className="mt-4">
          <CustomRequestForm />
        </div>
      </section>

      <section className="reveal-stagger mt-12 grid grid-cols-1 gap-4 md:grid-cols-4">
        {STEPS.map((item) => (
          <div key={item.step} className="group rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-accent/50">
            <span className="font-heading inline-flex size-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground transition-transform duration-200 ease-out group-hover:scale-110 motion-reduce:transition-none">{item.step}</span>
            <h3 className="font-heading mt-3 text-base font-semibold text-foreground">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </section>

      <MakerWorldIntakeCard />

      <section className="reveal mt-12 rounded-xl border border-primary/20 bg-primary/5 p-6 md:flex md:items-center md:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-primary">Chưa có file 3D?</p><h2 className="font-heading mt-1 text-2xl font-bold">Tự tạo móc khoá khắc tên</h2><p className="mt-2 text-sm text-muted-foreground">Nhập tên, xem trước 3D và gửi file STL thẳng tới xưởng.</p></div>
        <Link href="/tools/keychain-generator" className={storefrontButtonClasses('accent', 'mt-4 md:mt-0')}>Mở công cụ tạo mẫu</Link>
      </section>

      <section className="reveal mt-12">
        <h2 className="font-heading text-2xl font-bold text-foreground">Bảng tra cứu vật liệu</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4">Vật liệu</th>
                <th className="py-2 pr-4">Độ bền</th>
                <th className="py-2 pr-4">Chịu nhiệt</th>
                <th className="py-2 pr-4">Độ mịn bề mặt</th>
                <th className="py-2">Chi phí</th>
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map((row) => (
                <tr key={row.material} className="border-b border-border/60 transition-colors duration-150 hover:bg-muted/40">
                  <td className="py-2 pr-4"><MaterialBadge material={row.material} /></td>
                  <td className="py-2 pr-4 text-foreground">{row.durability}</td>
                  <td className="py-2 pr-4 text-foreground">{row.heat}</td>
                  <td className="py-2 pr-4 text-foreground">{row.finish}</td>
                  <td className="py-2 text-foreground">{row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
