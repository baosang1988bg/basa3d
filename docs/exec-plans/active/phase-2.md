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
   khai (product listing, v.v.) không cần gọi. Đây là toàn bộ "cơ chế
   dev/prod" cho auth ở Phase 2 — không làm staging riêng, không cần thêm vì
   chưa có nhu cầu thật.
2. **Next.js scaffold**: xác nhận dùng App Router. Việc scaffold + code là
   của Codex — Claude (mình) chỉ chuẩn bị plan/spec dạng `.md`, không tự viết
   code (đúng vai trò trong `CLAUDE.md`).

## Inputs
- `docs/database/schema.md`, `docs/architecture/architecture.md`,
  `docs/architecture/api-conventions.md`, `docs/database/business-rules.md`.
- `supabase/migrations/*.sql`, `src/domain/schemas.ts` (Phase 1 output).
- `DATABASE_URL` thật trỏ vào Supabase project (đã tạo project, còn thiếu
  biến này trong `.env` — cần điền trước khi Codex test API kết nối DB thật).

## Outputs
- Next.js app scaffold (App Router, TypeScript).
- `src/services/` — business logic: `product.service`, `inventory.service`
  (ghi movement + tính stock từ ledger), `order.service` (tạo order +
  order_items + reserve stock trong 1 transaction), `custom-request.service`,
  `quote.service`.
- `src/app/api/` route handlers gọi qua service layer, không query DB trực
  tiếp từ route (đúng layering).
- Audit log: mọi thao tác PATCH/DELETE quan trọng (đổi giá, đổi trạng thái
  order, adjustment tồn kho) ghi vào `audit_logs`.
- `src/lib/auth/require-admin.ts` — guard mỏng (no-op ở dev, throw ở
  production), gọi ở đầu mọi route POST/PATCH/DELETE.
- Test: unit test cho service logic (tính stock, reserve/release, order
  total), integration test cho ít nhất 1 API route full-path.

## Risks
- Stock reservation cần transaction + lock đúng để tránh oversell khi 2
  request cùng lúc — đã ghi chú ở Phase 1 review (SUGGESTION), giờ là lúc
  thực sự cần xử lý, không thể hoãn tiếp.
- Nếu không chốt auth boundary trước, Codex có thể tự chọn (hoặc bỏ qua hoàn
  toàn) — nên chốt câu hỏi 1 ở trên trước khi giao việc.
- `DATABASE_URL` thật chưa có trong `.env` — Codex cần cái này để test API
  chạy thật, không chỉ đọc code.

## Checklist

### Trước khi giao Codex
- [x] Xác nhận auth boundary — để mở ở dev, guard fail-safe cho production
- [x] Xác nhận Next.js App Router
- [ ] Điền `DATABASE_URL` thật vào `.env`

### Service layer & API
- [ ] Next.js scaffold chạy được (`npm run dev` không lỗi)
- [ ] `src/lib/auth/require-admin.ts` (no-op dev / throw production)
- [ ] `src/services/` cho product, category, inventory, order,
      custom-request, quote
- [ ] `src/app/api/` route handlers tương ứng, validate Zod ở boundary, gọi
      `requireAdmin()` cho mọi route POST/PATCH/DELETE
- [ ] Order creation atomic: tạo order + order_items + reserve stock trong 1
      transaction, có concurrency lock (theo SUGGESTION từ Phase 1 review)
- [ ] Audit log ghi cho thao tác quan trọng
- [ ] Unit test cho service logic quan trọng (stock, order total, reserve)
- [ ] Chạy skill `security-review` (`.agents/skills/security-review`) trên
      API trước khi coi là xong — đặc biệt xác nhận guard production hoạt
      động đúng (test giả lập `NODE_ENV=production` phải throw)
- [ ] Chạy skill `database-review` lại nếu có thay đổi schema/migration mới

## Definition of Done
Next.js chạy được, toàn bộ service/API trong Outputs hoạt động và có test,
`security-review` + `database-review` không còn BLOCKER, order creation đã
chứng minh không oversell khi có request đồng thời (test cụ thể cho việc
này, không chỉ code review).
