# Phase 1 — Database / Domain Model

Theo `docs/roadmap.md`, Phase 1 chỉ là database/domain model. API, service
layer, và admin auth thuộc Phase 2/3 — không làm trong phase này.

## Goal
Có một Supabase/PostgreSQL project thật, migration chạy sạch từ DB rỗng,
đúng 100% với domain model đã chốt ở Phase 0 (`docs/database/schema.md`,
`docs/architecture/decisions.md` ADR-0004 → ADR-0010), kèm seed data tối
thiểu để kiểm thử.

## Non-goals
- Không viết API/route handler/service layer (Phase 2).
- Không dựng authentication/admin (Phase 2/3).
- Không code UI.

## 2 điểm cần xác nhận trước khi viết migration — đã chốt (qua Gemini)

1. **ADR-0009 — `DEPOSIT_PAID`**: chốt là bắt buộc với đơn từ 300.000đ trở
   lên, tuỳ chọn (theo thoả thuận sales) với đơn dưới mức đó. Đã ghi vào
   `docs/database/business-rules.md` (rule 8) và `decisions.md` (ADR-0009).
2. **ADR-0008 — `material_movements` cột tham chiếu**: đã thêm
   `reference_type` (`PRINT_JOB`/`PURCHASE_ORDER`/`ADJUSTMENT`, nullable) và
   `reference_id` (uuid, nullable) vào `docs/database/schema.md` + ADR-0008.

Đã đối chiếu: cả hai đều được cập nhật nhất quán ở cả 3 chỗ
(`schema.md`, `decisions.md`, `business-rules.md`) — không có lệch nội dung.
Không còn điểm nào chặn việc viết migration.

## Inputs
- `docs/database/schema.md`, `docs/database/business-rules.md`,
  `docs/database/migrations.md` — domain model & quy tắc migration.
- `docs/architecture/decisions.md` (ADR-0001 → ADR-0010).
- Tài khoản Supabase (bạn tự tạo — việc tạo tài khoản/project trả phí nằm
  ngoài khả năng của mình, cần bạn hoặc Codex thực hiện và cung cấp connection
  string qua `.env`, không dán secret trực tiếp vào chat).

## Outputs
- Supabase project + connection string trong `.env` (không commit).
- `.env.example` cập nhật đúng biến cần thiết.
- Migration files cho toàn bộ bảng trong `docs/database/schema.md` (đã gồm
  `material_movements`, các status enum, `source_channel`).
- Seed script tạo dữ liệu mẫu tối thiểu (vài category, product, variant,
  material, một order mẫu, một custom_request mẫu).

## Risks
- Đổi enum/thêm cột sau khi Phase 1 xong sẽ tốn công hơn nhiều nếu đã có dữ
  liệu/migration khác phụ thuộc vào — 2 điểm này đã được chốt (xem checklist),
  rủi ro này coi như đã xử lý.
- Chưa có Supabase project thật — nếu Codex viết migration nhắm thẳng vào
  Supabase cú pháp riêng (RLS, extensions) mà chưa test được trên project
  thật, có thể phải sửa lại khi kết nối lần đầu. Giảm rủi ro bằng cách test
  trên Postgres local trước, review kỹ phần đặc thù Supabase khi có project
  thật.

## Checklist

### Trước khi viết migration
- [x] Xác nhận có nhận cọc (`DEPOSIT_PAID`) cho đơn hàng từ 300.000đ trở lên (ADR-0009, business-rules.md)
- [x] Thêm `reference_type`/`reference_id` (nullable) vào `material_movements` (Đã bổ sung vào schema.md & ADR-0008)
- [x] Commit baseline vào git — done (`7a4bb75`, `86a235b`; xem `close-phase`
      skill để đóng phase sau này)
- [x] Tạo Supabase project — done. `.env` thật đã điền
      `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/
      `SUPABASE_SERVICE_ROLE_KEY`. `DATABASE_URL` (cần cho migration/test
      chạy trực tiếp bằng `pg`) chưa điền — carry sang việc chuẩn bị trước
      khi Phase 2 cần kết nối DB thật, không chặn đóng Phase 1 (đã verify
      migration trên Postgres sạch riêng, xem mục Migration & seed).

### Migration & seed
- [x] Viết migration cho toàn bộ bảng trong `docs/database/schema.md` —
      `supabase/migrations/20260830000000_initial_domain_schema.sql`, đủ 16
      bảng + toàn bộ enum đã chốt.
- [x] Migration chạy sạch từ database rỗng — **verify độc lập bởi Claude**
      (không chỉ tin theo báo cáo của Codex): dựng Postgres 18 tạm thời trong
      sandbox, chạy migration trên 2 database rỗng khác nhau, cả hai đều
      apply sạch không lỗi.
- [x] Viết seed script tối thiểu (`supabase/seed.sql`) — chạy thành công trên
      DB vừa migrate.
- [x] Chạy `npm test` với `DATABASE_URL` trỏ vào Postgres thật — cả 7 test
      pass, bao gồm test integration (`database-integration.test.ts`) trước đó
      bị skip vì thiếu `DATABASE_URL`. Test integration xác nhận CHECK
      constraint hoạt động đúng: chặn được order sai tổng tiền, chặn được
      inventory adjustment thiếu note/actor.
- [x] Chạy review theo checklist `database-review` — không có BLOCKER. Ghi
      chú: 2 điểm SUGGESTION cho Phase 2 (không chặn đóng phase): (1) concurrency
      lock (`SELECT ... FOR UPDATE`/advisory lock) cho bước reserve stock khi
      checkout; (2) đặt tên các CHECK constraint tường minh hơn (hiện Postgres
      tự đặt tên như `orders_check`) để dễ đọc log lỗi sau này.

## Definition of Done
Migration chạy được từ DB rỗng, seed script tạo dữ liệu hợp lệ, schema khớp
100% với `docs/database/schema.md`, `database-review` không còn BLOCKER.

**Trạng thái: đạt DoD.** Đã verify thật (không chỉ dựa vào báo cáo Codex).
Việc còn lại — tạo Supabase project thật + trỏ `.env` vào đó — không chặn
việc đóng Phase 1 (migration đã chứng minh chạy đúng trên Postgres sạch),
nhưng cần làm trước khi Phase 2 cần kết nối DB thật. Có thể đóng Phase 1 và
giao Codex bước tiếp theo (Phase 2 — backend/service layer) theo "Standard AI
handoff prompt" trong `PHASE_START_PROTOCOL.md`.
