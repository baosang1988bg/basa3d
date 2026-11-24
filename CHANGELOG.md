# Changelog

Mọi thay đổi đáng kể của web BaSa3D được ghi ở đây. Định dạng theo
[Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), version theo [SemVer](https://semver.org/lang/vi/).
Quy trình đánh version và release: `docs/operations/versioning.md` (ADR-0046).

- Mục trên cùng là version **đang chuẩn bị** (= `version` trong `package.json`); ghi ngày khi release.
- Trước `1.0.0` web chưa đánh version — lịch sử theo phase ở `docs/roadmap.md`.

## [1.0.0] — chưa phát hành

Bản production đầu tiên có version.

### Thêm
- Nút tìm kiếm trên header (Ctrl/⌘+K): tìm sản phẩm của shop trước (gợi ý ngay khi gõ, gõ không dấu vẫn ra),
  không có thì tìm trên các kho mẫu 3D hoặc bằng ảnh, rồi dán link mẫu để xưởng báo giá; trang Sản phẩm tìm
  không dấu và gợi ý tìm kho mẫu khi không có kết quả; dashboard admin có thẻ "Mẫu đang nóng" (ADR-0064).
- Trend Radar (admin): lấy giấy phép trực tiếp từ Printables/Thingiverse, hệ thống tự chặn đưa lên web sản phẩm
  lấy từ mẫu chưa được phép bán khi chưa có bằng chứng license, theo dõi "độ nóng" (lượt tải/ngày) hằng ngày,
  ghi nhật ký thao tác; tìm mẫu bằng ảnh nhanh hơn nhờ bộ nhớ đệm (ADR-0062, ADR-0063).
- Đánh version cho web: version ở footer storefront (chữ mờ cạnh bản quyền) và cuối sidebar admin,
  `GET /api/version`, thẻ `<meta name="app-version">`,
  badge PREVIEW/DEV trên bản không phải production; script release kiểm tra đúng commit đã lên và tạo git tag (Phase 44).
- Animation tinh tế cho storefront: hiện dần khi cuộn, nút nhấn kiểu phím, FAQ mở/đóng mượt, gallery ảnh sản phẩm
  bấm đổi ảnh, menu mobile trượt, chuyển trang mềm (Phase 43).

### Thay đổi
- Tạm tắt hẳn tiếng Anh trên storefront (không chỉ ẩn nút VI/EN): `/en/*` chuyển hướng 308 về trang tiếng Việt,
  sitemap và thẻ hreflang không còn bản EN, nút VI/EN trong công cụ Organizer cũng ẩn. Bật lại bằng
  `NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED=true` rồi build lại (ADR-0048).
- Trang chủ và các trang tĩnh (chính sách, công cụ, đặt in, giỏ hàng) được cache thay vì render lại mỗi lần;
  dữ liệu catalog cache 60 giây và tự làm mới ngay khi admin sửa sản phẩm, tồn kho hoặc đơn hàng (Phase 42).

### Sửa
- Tìm mẫu bằng ảnh dùng model Gemini được hỗ trợ (bỏ `gemini-2.5-flash`), hộp thoại tìm mẫu có tiếng Anh, nút
  "mở nhanh" không còn bị trình duyệt chặn popup (ADR-0063).
- Công cụ nhập STL không còn lỗi "không tìm thấy file" với tên file tiếng Việt chép từ macOS khi chạy trên Linux.
- Giới hạn bấm "đồng bộ tin" thủ công tính đúng thời gian khi máy chủ DB không ở múi giờ UTC.
- Menu mobile bị kẹt trong header 64px, chữ menu đè lên trang và không có nền mờ (Phase 43).
