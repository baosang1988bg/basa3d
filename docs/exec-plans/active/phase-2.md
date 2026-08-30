# Phase 2 — Backend / Service Layer

Theo `docs/roadmap.md`: Phase 2 là backend/service layer. Admin UI/auth thuộc
Phase 3, public storefront UI thuộc Phase 4, cart/checkout UI thuộc Phase 5.

## Goal
Có Next.js app scaffold (chưa có gì ngoài `package.json`/`src/domain` hiện
tại) + repository/service layer + API route handlers cho các domain chính
(product, category, inventory, order, custom request, quote), tuân theo
layering `UI → Service → Repository` (`docs/architecture/architecture.md`,
`AGENTS.md`), có Zod validation ở boundary (đã có nền `src/domain/schemas.ts`
từ Phase 1), và transaction đúng cho các thao tác nhạy cảm (tạo order phải
atomic với reserve stock).

## Non-goals
- Không xây admin UI/trang đăng nhập (Phase 3).
- Không xây trang public storefront (Phase 4).
- Không xây cart/checkout UI (Phase 5).
- Không tích hợp payment gateway/shipping API thật (Phase 6+).
- Không xây auth thật (Supabase Auth, session, role) — chỉ có guard mỏng
  fail-safe cho production, xem "Quyết định đã chốt" bên dưới.
- Không làm môi trường staging riêng — chỉ phân biệt dev/production qua
  `NODE_ENV` cho đúng một việc (auth guard), không mở rộng thêm.

## Quyết định đã chốt

1. **Auth boundary cho API ở Phase 2**: để mở, không xây auth thật ở phase
   này — ưu tiên tốc độ vì hiện chỉ chạy dev, Phase 3 mới cần. Nhưng để
   không lỡ tay deploy API không bảo vệ ra production, thêm một guard rất
   mỏng: `src/lib/auth/require-admin.ts` — hàm `requireAdmin()` là no-op khi
   `NODE_ENV !== 'production'` (dev nhanh, không cản gì), nhưng **throw lỗi
   rõ ràng nếu `NODE_ENV === 'production'`** ("Admin auth not implemented —
   see Phase 3") để tự chặn việc chạy production mà chưa có auth thật. Mọi
   route POST/PATCH/DELETE gọi `requireAdmin()` đầu handler; route GET công
   khai (product listing, v.v.) không cần gọi.
2. **Actor/Audit context**: Không nhận `createdBy` trực tiếp từ client request
   body trong API public. `actorId` / `createdBy` phải được inject từ server-side
   context trong service layer để đảm bảo toàn vẹn audit log.

   **Xung đột cần xử lý (Claude phát hiện khi review)**: quy tắc này giả định
   có server-side session để lấy actor, nhưng Phase 2 chưa có auth thật (mục
   1) — vậy service layer lấy `actorId` từ đâu? Nghiêm trọng hơn: migration
   Phase 1 có CHECK constraint bắt buộc `created_by IS NOT NULL` cho mọi
   `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` (cả `inventory_movements` lẫn
   `material_movements`) — nếu không có actor thật, insert sẽ bị DB từ chối.
   **Giải pháp cho Phase 2**: dùng một hằng số "dev actor" cố định trong code
   server (`DEV_ACTOR_ID`, một UUID cố định, không phải từ client) làm
   `actorId` mặc định khi chưa có session thật. Vẫn tuân thủ quy tắc "không
   tin client" (giá trị này server tự gán, client không truyền được), chỉ là
   chưa phải actor thật — thay bằng session thật ở Phase 3 chỉ cần đổi 1 chỗ
   (nơi lấy `actorId`), không đổi service logic hay schema.
3. **Quy tắc tính tồn kho khả dụng (Available Stock)**:
   Do `SALE_OUT` chỉ ghi vào ledger khi đơn sang `PRODUCING` (ADR-0005), tồn kho
   khả dụng để đặt hàng phải tính theo công thức:
   `Available Stock = SUM(inventory_movements) - SUM(số lượng order_items trong đơn có status IN ('NEW', 'CONFIRMED'))`.
4. **Cơ chế khóa đồng thời chống Oversell**:
   Trong transaction tạo đơn hàng, phải khóa các dòng biến thể bằng
   `SELECT id FROM product_variants WHERE id = ANY(...) ORDER BY id FOR UPDATE`
   (sắp xếp ID để chống deadlock) trước khi kiểm tra Available Stock và tạo order.
5. **Next.js scaffold**: xác nhận dùng App Router. Việc scaffold + code là
   của Codex — Claude chuẩn bị plan/spec dạng `.md`, Gemini review phản biện,
   không tự ý sửa cấu trúc ngoài phân công.

## Inputs
- `docs/database/schema.md`, `docs/architecture/architecture.md`,
  `docs/architecture/api-conventions.md`, `docs/database/business-rules.md`.
- `supabase/migrations/*.sql`, `src/domain/schemas.ts` (Phase 1 output).
- `DATABASE_URL` thật trỏ vào Supabase project (điền trong `.env`).

## Outputs
- Next.js app scaffold (App Router, TypeScript).
- `src/services/` — business logic:
  - `product.service`: truy vấn danh mục, sản phẩm, biến thể kèm phân trang (mặc định 20, tối đa 100).
  - `inventory.service`: ghi movement + tính stock từ ledger & trừ lượng đơn `NEW`/`CONFIRMED` đang giữ chỗ.
  - `order.service`: tạo order + order_items + kiểm tra tồn kho đồng thời với `SELECT ... FOR UPDATE` trong 1 transaction.
  - `custom-request.service`: tiếp nhận yêu cầu in theo kênh (`source_channel`), cập nhật trạng thái.
  - `quote.service`: tạo báo giá, duyệt báo giá (kiểm tra hạn `valid_until < now()` trước khi cho phép `ACCEPTED` tạo `print_job`).
- `src/app/api/` route handlers gọi qua service layer, không query DB trực
  tiếp từ route (đúng layering).
- Audit log: mọi thao tác PATCH/DELETE quan trọng (đổi giá, đổi trạng thái
  order, adjustment tồn kho) ghi vào `audit_logs`.
- `src/lib/auth/require-admin.ts` — guard mỏng (no-op ở dev, throw ở
  production), gọi ở đầu mọi route quản trị.
- Test: unit test cho service logic (tính stock, reserve/release, order
  total, kiểm tra hết hạn quote), test concurrency chống oversell khi có 2 request đồng thời.

## Risks
- Stock reservation cần transaction + `SELECT ... FOR UPDATE` đúng để tránh oversell khi 2
  request cùng lúc — đã đưa thành yêu cầu bắt buộc trong DoD.
- Tránh query N+1 khi load danh sách đơn hàng và danh sách sản phẩm kèm variants.
- `DATABASE_URL` thật chưa có trong `.env` — Codex cần cái này để test API
  chạy thật, không chỉ đọc code.
- Migration Phase 1 chưa có index trên `order_items.variant_id` — công thức
  Available Stock (mục "Quyết định đã chốt" #3) cần join `order_items` theo
  `variant_id` + `orders.status`, không có index này sẽ chậm dần khi có
  nhiều đơn. Thêm migration nhỏ trong Phase 2 để tạo index này.
- Đơn ở trạng thái `NEW` bị bỏ dở (khách rời trang, không thanh toán) sẽ giữ
  chỗ Available Stock mãi mãi vì chưa có cơ chế tự huỷ/hết hạn. Chấp nhận là
  giới hạn đã biết của Phase 2 (chưa cần xử lý), nhưng cần một job dọn dẹp
  (chuyển `NEW` quá hạn sang `CANCELLED`) ở phase sau — ghi lại đây để không
  quên.

## Checklist

### Trước khi giao Codex
- [x] Xác nhận auth boundary — để mở ở dev, guard fail-safe cho production
- [x] Xác nhận Next.js App Router
- [x] Chốt công thức tính Available Stock (trừ các đơn NEW/CONFIRMED)
- [x] Chốt cơ chế row lock `SELECT FOR UPDATE` chống race condition oversell
- [x] Chốt cách xử lý `actorId` khi chưa có auth thật (hằng số `DEV_ACTOR_ID`
      server-side, xem mục "Xung đột cần xử lý" ở trên)
- [ ] Điền `DATABASE_URL` thật vào `.env`

### Service layer & API
- [ ] Next.js scaffold chạy được (`npm run dev` không lỗi)
- [ ] `src/lib/auth/require-admin.ts` (no-op dev / throw production)
- [ ] Migration bổ sung: index trên `order_items.variant_id` (phục vụ
      Available Stock query)
- [ ] `src/services/` cho product, category, inventory, order, custom-request, quote
- [ ] `src/app/api/` route handlers tương ứng, validate Zod ở boundary, áp dụng pagination limit (max 100)
- [ ] Loại bỏ `createdBy` từ client body; inject `DEV_ACTOR_ID` (server-side
      constant, không phải từ session) cho inventory/material adjustments &
      audit logs — đủ để thoả CHECK constraint bắt buộc `created_by not null`
- [ ] Order creation atomic: tạo order + order_items + kiểm tra Available Stock với row lock `SELECT ... FOR UPDATE`
- [ ] Quote service: chặn accept khi quote đã quá hạn (`valid_until < now()`)
- [ ] Audit log ghi cho thao tác quan trọng
- [ ] Unit & Integration test cho service logic quan trọng (stock ledger, order creation, concurrency test chống oversell)
- [ ] Chạy skill `security-review` (`.agents/skills/security-review`) trên
      API trước khi coi là xong — đặc biệt xác nhận guard production hoạt
      động đúng (test giả lập `NODE_ENV=production` phải throw)
- [ ] Chạy skill `database-review` lại nếu có thay đổi schema/migration mới

## Definition of Done
Next.js chạy được, toàn bộ service/API trong Outputs hoạt động và có test,
`security-review` + `database-review` không còn BLOCKER, order creation đã
chứng minh không oversell khi có request đồng thời (test cụ thể cho việc
này, không chỉ code review).
