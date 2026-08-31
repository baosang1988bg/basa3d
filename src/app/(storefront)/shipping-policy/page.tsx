import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';
import { SITE_CONFIG } from '@/config/site';

export const metadata: Metadata = { title: 'Chính sách vận chuyển — BaSa3D', description: 'Chính sách vận chuyển và giao hàng của BaSa3D.' };

export default function ShippingPolicyPage() {
  return (
    <LegalPage title="Chính sách vận chuyển" updatedAt="2026-08-31">
      <section>
        <h2>1. Phương thức thanh toán khi giao hàng</h2>
        <p>
          {SITE_CONFIG.name} hỗ trợ Thanh toán khi nhận hàng (COD) và Chuyển khoản ngân hàng trước khi
          sản xuất. Đơn đặt in theo yêu cầu chỉ tiến hành sản xuất sau khi khách hàng chấp nhận báo
          giá.
        </p>
      </section>
      <section>
        <h2>2. Thời gian xử lý</h2>
        <ul>
          <li>Sản phẩm sẵn hàng: đóng gói và giao trong 24–48 giờ làm việc</li>
          <li>Đặt in theo yêu cầu: thời gian sản xuất phụ thuộc độ phức tạp, được thông báo cụ thể khi báo giá</li>
        </ul>
      </section>
      <section>
        <h2>3. Đơn vị vận chuyển</h2>
        <p>Giao hàng qua các đơn vị vận chuyển đối tác trên toàn quốc. Phí vận chuyển hiển thị rõ trước khi xác nhận đơn hàng.</p>
      </section>
      <section>
        <h2>4. Liên hệ</h2>
        <p>Theo dõi đơn hàng hoặc thắc mắc về giao nhận, liên hệ Zalo/hotline: {SITE_CONFIG.hotline}.</p>
      </section>
    </LegalPage>
  );
}
