# Feature Plan: MakerWorld Zalo Order Flow (Showcase-only, No Customer PII)

> **Branch:** `feat/makerworld-zalo-order-flow` (from `dev`) · **Target:** `dev` → `vercel` (local only, no push)
> **Agent:** Gemini · **Context:** Tiêu chuẩn không làm sàn TMĐT giai đoạn này, ẩn toàn bộ việc lấy thông tin khách hàng, chuyển hướng 100% sang Zalo.

## 1. Context & Motivation
- BaSa3D vận hành ở chế độ giới thiệu dịch vụ / công cụ báo giá tham khảo (showcase-only), không làm sàn thương mại điện tử (e-commerce).
- Loại bỏ toàn bộ việc thu thập thông tin định danh cá nhân (Họ tên, SĐT, Email, Địa chỉ nhận hàng) vào cơ sở dữ liệu để tuân thủ pháp lý (tránh bị phân loại là website TMĐT theo NĐ 52/2013, NĐ 85/2021 và giảm thiểu nghĩa vụ lưu trữ PII theo NĐ 13/2023).
- Tối ưu tỷ lệ chuyển đổi: Người dùng xem trước thông số profile, tùy biến thông số in ấn (số lượng, màu, kích thước, ghi chú), xem live preview đoạn text mẫu, bấm nút là tự động copy vào clipboard và mở Zalo trao đổi trực tiếp với xưởng.

## 2. Changes
- `src/lib/zalo-consult.ts`: Bổ sung `greeting?: string` vào `ConsultPayload` và `buildZaloConsultMessage`.
- `src/components/storefront/makerworld-order-modal.tsx`:
  - Loại bỏ hoàn toàn form PII: Họ tên, SĐT, Email, Địa chỉ giao hàng, Remember contact.
  - Loại bỏ logic submit `POST /api/public/custom-requests` và các state error/submitting DB.
  - Bổ sung bộ điều khiển thông số in: Số lượng (1..100), Màu sắc mong muốn, Kích thước mong muốn, Ghi chú in ấn thêm.
  - Bổ sung khung Live Message Preview cập nhật nội dung tin nhắn thời gian thực khi thay đổi thông số.
  - Nút chính nổi bật: `[ Mở Zalo đặt in ngay ]` (Zalo brand blue `#0068FF`), tự động copy tin nhắn và mở `https://zalo.me/84333698638`.
  - Nút phụ: `[ Sao chép tin nhắn ]` thủ công.
  - Hỗ trợ Desktop: Nút toggle xem mã QR Zalo để quét bằng camera điện thoại.
- `tests/showcase-only.test.ts`: Thêm test case cho `buildZaloConsultMessage` với custom greeting và MakerWorld source.

## 3. Evidence
- [x] `npm run lint`: passed cleanly
- [x] `npm run typecheck`: passed cleanly
- [x] `npm run check:arch`: 6 rules passed
- [x] `npx tsx --test tests/showcase-only.test.ts`: 4/4 passing
