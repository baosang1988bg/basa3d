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

## 2 điểm cần bạn xác nhận trước khi viết migration

Gemini vừa bổ sung 3 quyết định vào Phase 0 (ADR-0008/0009/0010) — hai cái
đầu ổn, nhưng có 2 điểm mình muốn bạn xác nhận trước khi biến thành migration
thật, vì sửa enum/thêm cột sau khi đã có dữ liệu thật sẽ tốn công hơn nhiều:

1. **ADR-0009 — `DEPOSIT_PAID` (cọc 50%)**: đây là giả định của Gemini
   ("3D printing bespoke thường yêu cầu cọc trước"), bạn chưa từng xác nhận
   là có nhận cọc thật hay không, và nếu có thì % bao nhiêu. Đúng quy trình
   (`AGENTS.md`: "If a business rule is unclear, do not silently invent
   one") thì cái này nên được bạn chốt lại, không phải suy luận từ thông lệ
   chung. Bạn có nhận cọc cho đơn MADE_TO_ORDER/custom không? Nếu không, bỏ
   `DEPOSIT_PAID` cũng không sao — thêm lại sau dễ hơn bớt đi.
2. **ADR-0008 — `material_movements` thiếu cột tham chiếu**: bảng mới này
   không có `reference_type`/`reference_id` (kiểu như `inventory_movements`
   đã có) để biết một lần `PRODUCTION_OUT` tiêu hao nguyên liệu cho
   `print_job`/`order` nào. Thiếu cột này thì sau không tính được "đơn này
   tốn bao nhiêu nguyên liệu thật" để đối chiếu COGS. Đề xuất: thêm
   `reference_type varchar nullable`, `reference_id uuid nullable` vào
   `material_movements` trước khi viết migration.

Nếu bạn đồng ý với đề xuất ở mục 2 và trả lời câu hỏi ở mục 1, mình sẽ cập
nhật `docs/database/schema.md` + `decisions.md` trước khi mở migration.

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
  liệu/migration khác phụ thuộc vào — nên chốt 2 điểm ở trên trước khi viết
  migration, không phải sau.
- Repo hiện chưa có commit git nào — nên tạo commit baseline (`chore:
  initialize project`) trước khi Codex bắt đầu viết migration, để review được
  diff từng bước thay vì một khối thay đổi lớn.

## Checklist

### Trước khi viết migration
- [ ] Xác nhận có nhận cọc (`DEPOSIT_PAID`) cho MADE_TO_ORDER/custom hay
      không — giữ, sửa %, hoặc bỏ enum value này
- [ ] Thêm `reference_type`/`reference_id` (nullable) vào `material_movements`
- [ ] Tạo Supabase project, điền `.env` với connection string thật
- [ ] Commit baseline vào git (repo hiện chưa có commit nào)

### Migration & seed
- [ ] Viết migration cho toàn bộ bảng trong `docs/database/schema.md`
- [ ] Migration chạy sạch từ database rỗng (test thực tế, không chỉ đọc code)
- [ ] Viết seed script tối thiểu (deterministic, theo `migrations.md`)
- [ ] Chạy skill `database-review` (`.claude/skills/database-review` /
      `.agents/skills/database-review`) trên migration trước khi coi là xong

## Definition of Done
Migration chạy được từ DB rỗng, seed script tạo dữ liệu hợp lệ, schema khớp
100% với `docs/database/schema.md`, `database-review` không còn BLOCKER. Khi
đó mới giao Codex bước tiếp theo (Phase 2 — backend/service layer) theo
"Standard AI handoff prompt" trong `PHASE_START_PROTOCOL.md`.
