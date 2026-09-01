# BaSa3D Database — Initial Domain Map

## Core tables
- categories
- products
- product_variants
- product_images
- materials
- warehouses
- inventory_movements
- material_movements
- carts
- cart_items
- orders
- order_items
- custom_requests
- quotes
- print_jobs
- audit_logs
- staff_profiles

Phase 10 adds nullable `orders.analytics_purchase_sent_at timestamptz` as the server-side,
cross-device idempotency marker for the single GA4 `purchase` event. It does not affect order
financial state or fulfillment workflow.

## Rules
- UUID primary keys unless there is a clear reason otherwise.
- Add created_at/updated_at to mutable business tables.
- Use unique constraints for business identities such as SKU and slug.
- Use foreign keys deliberately.
- Add indexes based on real query patterns, not guesses.

## Status enums (Phase 0 decision — see ADR-0004/0005/0008/0009)

### `orders.status` — trạng thái xử lý đơn (chỉ tiến, không lùi trừ CANCELLED)
`NEW → CONFIRMED → PRODUCING → READY_TO_SHIP → SHIPPED → COMPLETED`, cộng
thêm `CANCELLED` (được phép từ NEW/CONFIRMED/PRODUCING/READY_TO_SHIP, không
lùi lại sau khi đã SHIPPED — trường hợp đó xử lý qua return riêng, không lùi
state).

### `orders.payment_status` (độc lập với `status`)
`UNPAID → DEPOSIT_PAID → PAID`, cộng `REFUNDED`. `DEPOSIT_PAID` dùng khi nhận cọc cho đơn hàng có giá trị từ 300.000 VNĐ trở lên (hoặc theo thoả thuận với khách hàng, ADR-0009).

### `orders.shipping_status` (độc lập với `status`)
`PENDING → SHIPPED → DELIVERED`, cộng `RETURNED`.

### `inventory_movements.movement_type` (Tồn kho sản phẩm `product_variants` — đếm theo cái)
`PURCHASE`, `PRODUCTION_IN`, `SALE_OUT`, `RETURN_IN`, `DAMAGE_OUT`,
`ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`.

Quy ước ghi `SALE_OUT`: ghi nhận khi `orders.status` chuyển sang `PRODUCING`
(không phải lúc tạo đơn) — thời điểm này áp dụng chung cho cả `READY_STOCK` và
`MADE_TO_ORDER` (với `READY_STOCK`, `PRODUCING` đại diện cho công đoạn soạn/chuẩn bị hàng).
Trước đó (NEW/CONFIRMED), số lượng chỉ ở trạng thái "reserved" (theo dõi riêng, không phải một movement trong ledger vì có thể bị huỷ/hết hạn).

### `material_movements.movement_type` (Tồn kho nguyên liệu `materials` — tính theo gram/cuộn, ADR-0008)
`PURCHASE`, `PRODUCTION_OUT`, `RETURN_IN`, `DAMAGE_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`.
Dùng để theo dõi nhập kho cuộn nhựa mới (`PURCHASE`) và tiêu hao nguyên liệu khi in sản phẩm (`PRODUCTION_OUT`).
Bảng `material_movements` có các cột tham chiếu: `reference_type` (varchar, nullable, ví dụ: `PRINT_JOB`, `PURCHASE_ORDER`, `ADJUSTMENT`) và `reference_id` (UUID, nullable) để gắn vết lượt tiêu hao nguyên liệu với đúng `print_job` hoặc đơn nhập hàng tương ứng (giúp đối chiếu COGS chuẩn xác).

### `custom_requests.source_channel`
`ZALO`, `FACEBOOK`, `INSTAGRAM`, `TIKTOK`, `OTHER` — thêm để biết kênh nào ra
đơn nhiều nhất (Phase 0 decision, xem ADR-0007).
Phase 4 bổ sung giá trị `WEBSITE`
(`supabase/migrations/20260831000000_public_custom_request_support.sql`) cho các
yêu cầu gửi từ form công khai trên storefront (`POST /api/public/custom-requests`).

### `custom_requests.attachment_path` (Hardening, ADR-0016)
`text`, nullable — bucket-relative path của file khách upload vào private bucket
`custom-request-attachments`. Không lưu public URL; admin lấy signed URL ngắn
hạn sau khi xác thực server-side.

### Enum bổ sung từ Phase 1 migration (Codex, chưa qua Phase 0 nhưng đã review)
Các enum sau chưa được thảo luận rõ ở Phase 0, do Codex tự quyết khi viết
migration thật (`supabase/migrations/20260830000000_initial_domain_schema.sql`).
Đã review, hợp lý, ghi lại đây để tài liệu khớp với schema thật:
- `products.status` (`product_status`): `DRAFT`, `ACTIVE`, `ARCHIVED`.
- `materials.unit` (`material_unit`): `GRAM`, `SPOOL`.
- `custom_requests.status` (`custom_request_status`): `NEW`, `REVIEWING`,
  `NEED_INFO`, `QUOTED`, `APPROVED`, `REJECTED`, `CONVERTED`.
- `quotes.status` (`quote_status`): `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`,
  `EXPIRED`.
- `print_jobs.status` (`print_job_status`): `QUEUED`, `PRINTING`, `FAILED`,
  `REPRINT`, `QC`, `COMPLETED`, `CANCELLED`.
- `product_variants.attributes` là `jsonb` (thay vì cột `color`/`size` cứng) —
  linh hoạt hơn, khớp tinh thần review ban đầu về việc tránh hard-code thuộc
  tính variant.

### `carts` / `cart_items` (Phase 0 — cố tình không dùng ở Phase 5, xem ADR-0014)
Thiết kế sẵn từ Phase 0 nhưng **chưa có service/API nào dùng** — Phase 5
(cart/checkout) chọn lưu cart hoàn toàn client-side (`localStorage`) vì MVP
chỉ có guest checkout, không có tài khoản khách hàng nên không cần cart đồng
bộ đa thiết bị. Không xoá, không migrate — nếu sau này có tài khoản khách
hàng và cần cart đa thiết bị, quay lại dùng 2 bảng này.

### `staff_profiles` (Phase 3 — xem ADR-0011 / ADR-0012)
Bảng hồ sơ phân quyền nhân viên nội bộ (liên kết 1-1 với `auth.users` của Supabase Auth):
- `id`: `uuid primary key references auth.users(id) on delete cascade`
- `full_name`: `varchar(200) not null check (btrim(full_name) <> '')`
- `role`: `staff_role not null default 'STAFF'` (`create type staff_role as enum ('OWNER', 'STAFF')`)
- `is_active`: `boolean not null default true`
- `created_at`, `updated_at`: `timestamptz not null default timezone('utc', now())`
