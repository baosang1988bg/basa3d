import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';
import { SITE_CONFIG } from '@/config/site';

export const metadata: Metadata = { title: 'Chính sách bảo mật — BaSa3D', description: 'Chính sách bảo mật thông tin khách hàng của BaSa3D.' };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Chính sách bảo mật" updatedAt="2026-08-31">
      <section>
        <h2>1. Thông tin chúng tôi thu thập</h2>
        <p>
          Khi bạn đặt hàng hoặc gửi yêu cầu đặt in tại {SITE_CONFIG.name}, chúng tôi thu thập: họ tên,
          số điện thoại, email (nếu cung cấp), địa chỉ giao hàng, và nội dung/file thiết kế bạn gửi
          kèm yêu cầu đặt in. Chúng tôi không yêu cầu tạo tài khoản — mỗi đơn hàng/yêu cầu được xử lý
          độc lập.
        </p>
      </section>
      <section>
        <h2>2. Mục đích sử dụng</h2>
        <ul>
          <li>Liên hệ tư vấn, báo giá, và xác nhận đơn hàng</li>
          <li>Sản xuất và giao hàng đúng yêu cầu</li>
          <li>Chăm sóc khách hàng sau bán</li>
        </ul>
      </section>
      <section>
        <h2>3. Chia sẻ thông tin</h2>
        <p>
          Chúng tôi không bán hoặc chia sẻ thông tin cá nhân của bạn cho bên thứ ba ngoài mục đích vận
          chuyển đơn hàng (đơn vị giao hàng) và các dịch vụ hạ tầng kỹ thuật cần thiết để vận hành
          website.
        </p>
      </section>
      <section>
        <h2>4. Liên hệ</h2>
        <p>Mọi thắc mắc về chính sách bảo mật, liên hệ qua Zalo/hotline: {SITE_CONFIG.hotline}.</p>
      </section>
    </LegalPage>
  );
}
