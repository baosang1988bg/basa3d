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
`UNPAID → DEPOSIT_PAID → PAID`, cộng `REFUNDED`. `DEPOSIT_PAID` dùng khi nhận cọc
(thường là 50%) cho đơn MADE_TO_ORDER/custom trước khi sản xuất (ADR-0009).

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

### `custom_requests.source_channel`
`ZALO`, `FACEBOOK`, `INSTAGRAM`, `TIKTOK`, `OTHER` — thêm để biết kênh nào ra
đơn nhiều nhất (Phase 0 decision, xem ADR-0007).
