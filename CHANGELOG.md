# Changelog

Mọi thay đổi đáng kể của web BaSa3D được ghi ở đây. Định dạng theo
[Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), version theo [SemVer](https://semver.org/lang/vi/).
Quy trình đánh version và release: `docs/operations/versioning.md` (ADR-0046).

- Mục trên cùng là version **đang chuẩn bị** (= `version` trong `package.json`); ghi ngày khi release.
- Trước `1.0.0` web chưa đánh version — lịch sử theo phase ở `docs/roadmap.md`.

## [1.0.0] — chưa phát hành

Bản production đầu tiên có version.

### Thêm
- Đánh version cho web: nhãn version ở footer admin, `GET /api/version`, thẻ `<meta name="app-version">`,
  badge PREVIEW/DEV trên bản không phải production; script release kiểm tra đúng commit đã lên và tạo git tag (Phase 44).
- Animation tinh tế cho storefront: hiện dần khi cuộn, nút nhấn kiểu phím, FAQ mở/đóng mượt, gallery ảnh sản phẩm
  bấm đổi ảnh, menu mobile trượt, chuyển trang mềm (Phase 43).

### Thay đổi
- Trang chủ và các trang tĩnh (chính sách, công cụ, đặt in, giỏ hàng) được cache thay vì render lại mỗi lần;
  dữ liệu catalog cache 60 giây và tự làm mới ngay khi admin sửa sản phẩm, tồn kho hoặc đơn hàng (Phase 42).

### Sửa
- Menu mobile bị kẹt trong header 64px, chữ menu đè lên trang và không có nền mờ (Phase 43).
