# Feature Specification: Thêm nút Gọi hotline vào trang 404 (NotFound)

**Feature Branch**: `feature/002-them-nut-goi-hotline-tel-vao-trang-src-a`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Thêm nút Gọi hotline (tel:) vào trang src/app/not-found.tsx, dùng SITE_CONFIG.hotline, chuỗi qua messages/{vi,en}.json"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gọi hỗ trợ nhanh từ trang 404 khi truy cập liên kết hỏng (Priority: P1)

Là một người dùng storefront truy cập vào một đường dẫn không tồn tại (trang 404), tôi muốn thấy nút "Gọi hotline" trực tiếp với số điện thoại liên hệ của BaSa3D để có thể liên hệ ngay lập tức với xưởng nhằm hỗ trợ tìm kiếm sản phẩm hoặc đặt hàng theo yêu cầu mà không bị gián đoạn trải nghiệm.

**Why this priority**: Người dùng gặp trang 404 dễ nản lòng và rời bỏ website. Cung cấp nút gọi hotline ngay lập tức giúp giữ chân khách hàng và chuyển đổi người dùng gặp lỗi thành yêu cầu tư vấn trực tiếp.

**Independent Test**: Có thể kiểm thử độc lập bằng cách truy cập vào bất kỳ đường dẫn không tồn tại nào trên hệ thống (ví dụ `/duong-dan-khong-ton-tai`), xác nhận sự xuất hiện của nút gọi hotline, và nhấp vào nút để kiểm tra liên kết `tel:` mở trình quay số điện thoại chính xác.

**Acceptance Scenarios**:

1. **Given** Người dùng truy cập đường dẫn không tồn tại trên storefront, **When** trang 404 (`not-found.tsx`) hiển thị, **Then** nút "Gọi hotline" xuất hiện bên cạnh hoặc dưới nút "Về trang chủ" với liên kết dạng `tel:<số_hotline>`.
2. **Given** Người dùng đang ở trang 404 trên thiết bị di động, **When** nhấp vào nút "Gọi hotline", **Then** ứng dụng điện thoại/quay số trên thiết bị mở lên sẵn sàng gọi tới số hotline cấu hình trong `SITE_CONFIG.hotline`.
3. **Given** Trang 404 hiển thị, **When** kiểm tra nhãn chữ trên nút hotline, **Then** nội dung hiển thị được lấy từ file ngôn ngữ tương ứng (`messages/vi.json` hoặc `messages/en.json`) thông qua cơ chế i18n của hệ thống.

---

### User Story 2 - Đa ngôn ngữ và hiển thị nhất quán giao diện (Priority: P2)

Là một khách hàng quốc tế hoặc tiếng Việt, tôi muốn thông điệp hỗ trợ và nút gọi hotline hiển thị chuẩn xác bằng ngôn ngữ tương ứng với locale hiện tại (`vi` hoặc `en`).

**Why this priority**: Đảm bảo trải nghiệm đồng nhất với chiến lược i18n của toàn bộ hệ thống storefront (Phase 18).

**Independent Test**: Thay đổi locale hoặc truy cập trang 404 ở các ngữ cảnh locale khác nhau và kiểm tra văn bản hiển thị trên nút hotline khớp với tệp ngôn ngữ `messages/vi.json` và `messages/en.json`.

**Acceptance Scenarios**:

1. **Given** Locale hiện tại là `vi`, **When** trang 404 hiển thị, **Then** nút gọi hotline hiển thị chuỗi tiếng Việt (ví dụ: "Gọi hotline: {hotline}" hoặc "Gọi ngay {hotline}").
2. **Given** Locale hiện tại là `en`, **When** trang 404 hiển thị, **Then** nút gọi hotline hiển thị chuỗi tiếng Anh (ví dụ: "Call hotline: {hotline}" hoặc "Call {hotline}").

---

### Edge Cases

- **Số điện thoại hotline có chứa khoảng trắng hoặc ký tự đặc biệt**: Nếu `SITE_CONFIG.hotline` định dạng dạng chuỗi có khoảng trắng (ví dụ `0333 698 638`), thuộc tính `href` của thẻ liên kết phải được làm sạch thành đường dẫn gọi chuẩn `tel:0333698638` để tránh lỗi ứng dụng quay số trên một số hệ điều hành di động.
- **Truy cập từ trình duyệt Desktop không hỗ trợ handler `tel:`**: Khi nhấp vào nút trên máy tính bàn không cài app gọi điện (như Skype/FaceTime/Phone Link), trình duyệt có thể không phản hồi hoặc hiện hộp thoại cảnh báo của hệ điều hành. Nút cần hiển thị rõ số điện thoại để người dùng máy tính bàn có thể tự bấm số thủ công nếu cần.
- **Missing translation keys**: Trường hợp key i18n chưa được khai báo đầy đủ ở cả `vi.json` và `en.json`, hệ thống kiểm thử parity (`tests/phase-18-i18n-message-parity.test.ts` hoặc tương đương) phải phát hiện và báo lỗi khi build.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Trang `src/app/not-found.tsx` MUST hiển thị nút Gọi hotline với liên kết chuẩn `tel:`.
- **FR-002**: Giá trị số điện thoại trong href `tel:` và nhãn hiển thị MUST sử dụng từ cấu hình trung tâm `SITE_CONFIG.hotline` (được định nghĩa tại `src/config/site.ts`).
- **FR-003**: Số điện thoại truyền vào thẻ `tel:` MUST được chuẩn hoá chỉ chứa chữ số và dấu cộng (`+`), loại bỏ tất cả ký tự khoảng trắng hoặc dấu gạch nối.
- **FR-004**: Tất cả chuỗi văn bản liên quan đến nút Gọi hotline trên trang 404 MUST được định nghĩa trong `messages/vi.json` và `messages/en.json` (đảm bảo tính đồng nhất i18n parity).
- **FR-005**: Nút Gọi hotline MUST sử dụng các component/style chuẩn của hệ thống (Tailwind CSS / shadcn/ui) phù hợp với giao diện trang 404 hiện tại, đảm bảo responsive mượt mà trên cả Mobile và Desktop.
- **FR-006**: Nút Gọi hotline không được làm ảnh hưởng hoặc che khuất nút "Về trang chủ" (`/`) hiện có.

### Key Entities

- **SITE_CONFIG**: Đơn vị cấu hình hệ thống chứa tham số `hotline` (string).
- **Messages (i18n)**: Tệp từ điển chứa bản dịch key `notFound` cho cả hai ngôn ngữ `vi` và `en`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% lượt truy cập trang 404 hiển thị nút Gọi hotline rõ ràng, nhấp được và điều hướng chính xác tới URI `tel:<cleansed_phone>`.
- **SC-002**: Đạt 100% đồng bộ key dịch thuật (i18n parity) giữa `messages/vi.json` và `messages/en.json` cho các chuỗi mới thêm vào.
- **SC-003**: Tất cả các lệnh kiểm tra tự động `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` đều xanh 100%.

## Assumptions

- Trang `src/app/not-found.tsx` nằm ở căn gốc Next.js App Router, sử dụng đúng cơ chế đọc i18n/translations tương thích với cách hệ thống `next-intl` thiết lập cho root not-found.
- Cấu hình `SITE_CONFIG.hotline` luôn trả về số điện thoại hợp lệ (chuỗi không rỗng, ví dụ `"0333698638"`).
- Việc thêm nút gọi hotline không làm thay đổi luồng nghiệp vụ DB hay backend, hoàn toàn thuộc lát cắt UI/UX storefront.
