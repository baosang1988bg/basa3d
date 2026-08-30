# Phase 0 — Project Foundation & Product Decisions

## Goal
Chốt toàn bộ quyết định nghiệp vụ và cách tính giá thành spec rõ ràng, trước
khi tạo database hay viết code. Đây là dự án greenfield — không có dữ liệu cũ
cần migrate.

## Non-goals
- Không tạo Supabase/PostgreSQL project (Phase 1).
- Không viết migration hay seed data (Phase 1).
- Không code UI/API (Phase 2+).

## Quyết định đã chốt

- **Brand:** BaSa3D.
- **Domain:** hướng tới `basa3d.com`, chưa mua (chưa cần gấp).
- **Dữ liệu cũ:** Google Sheet hiện tại không có data thật → bỏ toàn bộ bước
  "chuẩn hoá dữ liệu cũ" / "đối chiếu Sheet vs DB" khỏi Phase 0.
- **Product type:** chỉ dùng hai giá trị `READY_STOCK` và `MADE_TO_ORDER` trên
  bảng `products`. Không dùng `product_type = CUSTOM` riêng — đơn in hoàn toàn
  theo yêu cầu đi qua `custom_requests` → `quotes` → `print_jobs`, tách hẳn
  khỏi catalog sản phẩm.
- **Custom request intake:** khách liên hệ qua Zalo, Facebook, Instagram,
  TikTok (đa kênh) → 1 bạn sale báo giá thủ công, thường mất ~30 phút để tính
  cost rồi ra giá. Hệ quả cho schema:
  - thêm cột `source_channel` vào `custom_requests` (giá trị đề xuất:
    `ZALO` / `FACEBOOK` / `INSTAGRAM` / `TIKTOK` / `OTHER`) để sau này biết
    kênh nào ra đơn nhiều nhất;
  - thời gian phản hồi (30 phút) tính được từ
    `custom_requests.created_at` so với `quotes.created_at`, không cần thêm
    cột riêng cho việc này.
- **Category tree & SKU rule:** đề xuất chi tiết trong
  `docs/product/catalog-spec.md` — vì `categories` cho phép thêm/sửa nhánh tự
  do sau này, không cần chốt hoàn hảo ngay, cứ dùng bản đề xuất và điều chỉnh
  khi có sản phẩm thật.

## Cách tính giá — công thức đã duyệt

Mô hình cost-plus (material + điện + khấu hao máy + dự phòng lỗi in + nhân
công + đóng gói, sau đó chia cho (1 − % margin) để ra giá bán). Chi tiết đầy
đủ + ví dụ nằm ở `docs/product/catalog-spec.md` (mục 4) — không lặp lại ở đây
để tránh lệch nội dung khi chỉnh sửa sau này.

Công thức đã được duyệt; số liệu hiện dùng là **placeholder** tham khảo mặt
bằng chung (xem `docs/product/catalog-spec.md`), không phải chi phí thật của
bạn. Không chặn việc mở Phase 1, nhưng nên thay bằng số thật trước khi dùng
công thức này để báo giá thật cho khách.

## Inputs còn để ngỏ (không chặn Phase 1, làm khi có điều kiện)

- Danh sách sản phẩm dự kiến bán đầu tiên (tên, READY_STOCK hay MADE_TO_ORDER,
  giá ước tính) — để thử công thức tính giá và tạo SKU mẫu thật.
- Giá điện thật (theo hoá đơn), giá máy in đang có + tuổi thọ ước tính (giờ),
  đơn giá nhân công/giờ thật — để thay placeholder trong công thức tính giá.
- % margin mong muốn thật (placeholder đang là 40%).

## Outputs
- `docs/product/catalog-spec.md` — category tree, product type, quy tắc SKU,
  công thức tính giá kèm số liệu placeholder & quy tắc làm tròn giá bán.
- `docs/database/schema.md` (cập nhật) — status enums, movement_type (tồn kho sản phẩm & nguyên liệu `material_movements`),
  `DEPOSIT_PAID` cho `payment_status`, `source_channel` cho `custom_requests`.
- `docs/architecture/decisions.md` (cập nhật) — ADR-0004 → ADR-0010.

## Risks
- Công thức tính giá đề xuất chưa được kiểm chứng bằng đơn thật, có thể phải
  điều chỉnh sau vài đơn đầu tiên.
- Chưa mua domain `basa3d.com` — nếu quan tâm giữ tên, nên kiểm tra/đăng ký
  sớm để tránh bị người khác mua trước.

## Checklist

### Quyết định nghiệp vụ
- [x] Chốt brand name (BaSa3D)
- [x] Chốt hướng domain (basa3d.com, chưa mua)
- [x] Xác nhận không có dữ liệu Google Sheet cũ cần migrate
- [x] Chốt product type: `READY_STOCK`, `MADE_TO_ORDER` (bỏ `CUSTOM` khỏi
      product_type, dùng custom_requests riêng)
- [x] Mô tả quy trình custom order thực tế (đa kênh, sales quote thủ công
      ~30 phút) → thêm quyết định `source_channel`
- [x] Thống nhất category tree (đề xuất, xem `docs/product/catalog-spec.md`)
- [x] Tạo quy tắc SKU (đề xuất, xem `docs/product/catalog-spec.md`)
- [x] Duyệt công thức tính giá (cost-plus, xem `docs/product/catalog-spec.md`) + quy tắc làm tròn 1.000 VNĐ (ADR-0010)
- [x] Điền số liệu placeholder vào công thức tính giá (giá điện, giá máy, nhân
      công, % margin — xem `docs/product/catalog-spec.md` mục "Số liệu
      placeholder". Đây là số tham khảo mặt bằng chung, chưa phải số thật của
      bạn — thay khi có hoá đơn/giá máy/lương thật)
- [x] Chốt trạng thái order (order lifecycle) — 3 trục độc lập `status` /
      `payment_status` (bao gồm `DEPOSIT_PAID`, ADR-0009) / `shipping_status`, xem `docs/database/schema.md`
- [x] Chốt movement_type cho inventory ledger sản phẩm & nguyên liệu (`material_movements`, ADR-0008) — xem `docs/database/schema.md`

### Chốt spec
- [x] Viết `docs/product/catalog-spec.md` (category tree, SKU rule, công thức
      tính giá & rounding rule)
- [x] Cập nhật `docs/database/schema.md` (status enums, `material_movements`,
      `DEPOSIT_PAID`, `source_channel` cho `custom_requests`)
- [x] Ghi các quyết định ở trên vào `docs/architecture/decisions.md`
      (ADR-0004 → ADR-0010)

## Definition of Done
Tất cả checkbox trên hoàn thành; Phase 1 (database/domain model) có thể bắt
đầu viết migration mà không cần dừng lại hỏi thêm quyết định nghiệp vụ nào.

**Trạng thái: đạt DoD.** Toàn bộ checklist đã hoàn thành (pricing dùng số
placeholder có ghi chú rõ, không chặn Phase 1). Có thể đóng Phase 0 — chuyển
file này sang `docs/exec-plans/completed/` — và mở Phase 1 theo
`PHASE_START_PROTOCOL.md`.
