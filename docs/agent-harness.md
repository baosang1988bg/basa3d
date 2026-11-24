# Agent harness — BaSa3D

Harness = môi trường quanh agent (Claude / Codex / Gemini / swarm) để kết quả **đáng tin qua nhiều phiên**.
Tham chiếu: [walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering).
`AGENTS.md` → "Session lifecycle" là bản tóm tắt bắt buộc; file này giải thích chi tiết.

## 5 phân hệ và file tương ứng

| Phân hệ | BaSa3D dùng | Ghi chú |
|---|---|---|
| Instructions | `AGENTS.md` (bản đồ) → `CLAUDE.md` / `GEMINI.md` (vai trò) → `docs/**`, `.agents/skills/**` | Sửa luật ở `AGENTS.md`, không nhân bản sang file vai trò |
| State | `PROGRESS.md` (trạng thái chung) · `docs/exec-plans/active/*.md` (1 plan / task) · `KANBAN.md` (board Parallel Code) · git log | `PROGRESS.md` = "đang ở đâu"; exec-plan = "làm gì + bằng chứng"; KANBAN = "thứ tự ưu tiên" |
| Verification | `npm run check:agent` · `npm run check:arch` · `npm run test:e2e` | Xem "3 lớp kiểm tra" |
| Scope | WIP = 1 / agent · Definition of Done trong exec-plan · `PHASE_START_PROTOCOL.md` | |
| Lifecycle | `npm run agent:init` (start) · cập nhật `PROGRESS.md` + commit (end) · `close-phase` skill | |

## 3 lớp kiểm tra (không nhảy lớp)

1. **Static + unit** — `npm run check:agent` = lint → typecheck → check:arch → unit test.
   Không có `TEST_DATABASE_URL` thì test cần DB tự bỏ qua; CI (`.github/workflows/agent-check.yml`) chạy đúng chế độ này.
2. **Business invariants** — `npm run check:arch` (đã nằm trong lớp 1, chạy riêng được, < 1 giây).
   Luật ở `.harness/arch-rules.json`; output dạng WHAT / WHY / FIX để agent tự sửa.
3. **End-to-end** — `npm run test:e2e` (Playwright, cần Postgres/Supabase local disposable — xem `tests/helpers/test-environment.ts`).
   **Bắt buộc** khi thay đổi chạm checkout, tồn kho, báo giá, phân quyền admin, hoặc đi qua nhiều domain.
   `npm run check:full` = lớp 1 + lớp 3.

## Cổng cưỡng chế (enforcement)

Đặt ở tầng **git/CI** để áp dụng như nhau cho cả 3 agent (hook riêng của từng tool không đồng bộ được):

- `pre-push` (`.githooks/pre-push`, cài 1 lần mỗi clone: `npm run hooks:install`): lint + typecheck + check:arch.
- CI `Agent Check`: `npm run check:agent` trên PR vào `dev` / `vercel` / `main` và push vào `dev`.
  Sau khi chạy ổn định, Owner nên đặt check này thành **required** trong branch protection của `dev`/`vercel`.

## Session start / end

```bash
npm run agent:init          # env + context (PROGRESS.md, git log) + lint/typecheck/check:arch
npm run agent:init -- --full  # thêm unit test
```

Session end — checklist "clean state":

- [ ] Lớp kiểm tra phù hợp đã xanh (ghi lệnh + kết quả vào exec-plan, không chỉ tick ô).
- [ ] Không còn debug artifact (`console.log` tạm, file scratch, `.only` trong test).
- [ ] `PROGRESS.md`: Current State (commit + trạng thái check), In Progress, 1 dòng Handoff log.
- [ ] Commit atomic, message giải thích **vì sao** (Conventional Commits).
- [ ] Còn dở → ghi rõ "đang dở ở bước nào, lệnh nào đang fail" để phiên sau tiếp tục.

## Thêm luật vào check:arch (review → automation)

Mỗi khi code review (Claude) bắt được một **loại** lỗi có thể lặp lại, thêm rule vào `.harness/arch-rules.json`:

```json
{
  "id": "kebab-case-id",
  "scope": { "dirs": ["src"], "ext": [".ts", ".tsx"], "exclude": ["src/services/"], "onlyIfFileMatches": "^'use client'" },
  "forbid": "regex (flags gim, chạy trên toàn file)",
  "what": "Vi phạm là gì", "why": "Vì sao cấm (link luật)", "fix": "Sửa cụ thể thế nào", "source": "nguồn"
}
```

Kiểm tra rule mới bằng cách tạm tạo một file vi phạm, chạy `npm run check:arch` thấy đỏ, rồi xoá file.
Ngoại lệ có lý do: thêm `arch-allow:<rule-id> <lý do>` vào cuối dòng.

Luật hiện có: `money-integer-columns`, `ledger-no-mutation`, `ledger-writes-in-services-only`,
`client-no-server-modules`, `no-public-service-role`, `no-tracked-env` (built-in).

## Dọn định kỳ (mỗi tuần / cuối mỗi phase)

- Triage `docs/exec-plans/active/` (bảng trong `PROGRESS.md`): plan đủ `[x]` → `close-phase`; plan đứng yên > 3 tuần → `pending/`.
- Rút gọn Handoff log trong `PROGRESS.md` (git giữ lịch sử).
- Chạy lại audit: `bash <(curl -fsSL https://raw.githubusercontent.com/walkinglabs/learn-harness-engineering/main/tools/audit-harness.sh) .`
  (script tìm tên file chuẩn như `Makefile`, `DECISIONS.md` ở root — vài mục FAIL là do BaSa3D đặt ở chỗ khác, không phải thiếu thật).
