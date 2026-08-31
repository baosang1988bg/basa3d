import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';
import { SITE_CONFIG } from '@/config/site';

export const metadata: Metadata = { title: 'Chính sách đổi trả — BaSa3D', description: 'Chính sách đổi trả sản phẩm của BaSa3D.' };

export default function ReturnPolicyPage() {
  return (
    <LegalPage title="Chính sách đổi trả" updatedAt="2026-08-31">
      <section>
        <h2>1. Điều kiện đổi trả</h2>
        <p>
          Sản phẩm được đổi/trả trong vòng 7 ngày kể từ ngày nhận hàng nếu: sản phẩm bị lỗi sản xuất
          (nứt, vỡ, in sai kích thước/màu so với đơn xác nhận), hoặc giao sai sản phẩm.
        </p>
      </section>
      <section>
        <h2>2. Không áp dụng đổi trả</h2>
        <ul>
          <li>Sản phẩm đặt in theo yêu cầu (custom) đã đúng theo file/thông số khách hàng cung cấp và đã được khách duyệt báo giá</li>
          <li>Hư hỏng do quá trình sử dụng, va đập sau khi nhận hàng</li>
        </ul>
      </section>
      <section>
        <h2>3. Quy trình</h2>
        <p>Liên hệ Zalo/hotline: {SITE_CONFIG.hotline} kèm ảnh/video sản phẩm lỗi trong vòng 7 ngày để được hỗ trợ đổi trả hoặc hoàn tiền.</p>
      </section>
    </LegalPage>
  );
}
