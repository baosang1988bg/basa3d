import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';
import { SITE_CONFIG } from '@/config/site';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật file thiết kế 3D — BaSa3D',
  description: 'Cam kết bảo mật file thiết kế 3D (STL/STEP/OBJ/3MF) khách hàng gửi khi đặt in theo yêu cầu.',
};

export default function FileConfidentialityPolicyPage() {
  return (
    <LegalPage title="Chính sách bảo mật file thiết kế 3D" updatedAt="2026-08-31">
      <section>
        <h2>1. Cam kết</h2>
        <p>
          File thiết kế (.stl, .step/.stp, .obj, .3mf) hoặc ảnh mẫu bạn gửi qua trang{' '}
          <strong>Đặt in theo yêu cầu</strong> chỉ được {SITE_CONFIG.name} sử dụng cho đúng mục đích
          báo giá và sản xuất đơn hàng của bạn. Chúng tôi không sử dụng file thiết kế của khách hàng
          cho mục đích thương mại khác, không bán lại, và không chia sẻ cho bên thứ ba ngoài phạm vi
          cần thiết để in sản phẩm.
        </p>
      </section>
      <section>
        <h2>2. Lưu trữ</h2>
        <p>
          File được lưu trữ trên hạ tầng đám mây riêng của {SITE_CONFIG.name}, chỉ đội ngũ kỹ thuật xử
          lý đơn hàng của bạn được truy cập. File không được xem trước tự động — chỉ được nhân viên mở
          thủ công khi cần tư vấn/báo giá đơn của bạn.
        </p>
      </section>
      <section>
        <h2>3. Yêu cầu xoá file</h2>
        <p>Nếu bạn muốn yêu cầu xoá file thiết kế đã gửi sau khi đơn hàng hoàn tất, liên hệ Zalo/hotline: {SITE_CONFIG.hotline}.</p>
      </section>
      <section>
        <h2>4. Sở hữu trí tuệ</h2>
        <p>
          Bạn xác nhận có quyền hợp pháp đối với file thiết kế gửi cho chúng tôi để sản xuất.{' '}
          {SITE_CONFIG.name} không chịu trách nhiệm nếu file do khách hàng cung cấp vi phạm quyền sở
          hữu trí tuệ của bên thứ ba.
        </p>
      </section>
    </LegalPage>
  );
}
