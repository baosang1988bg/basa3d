# Codex Handoff Skill

## Purpose
Sinh ra prompt hoàn chỉnh để giao một phase cho Codex implement, từ nội dung
đã có sẵn trong `docs/exec-plans/active/phase-X.md` — theo đúng format và
mức độ chi tiết đã dùng cho Phase 1 và Phase 2 (không phải đoán lại từ đầu
mỗi lần).

## Khi nào dùng
- User nói "giao Codex phase X", "soạn prompt cho Codex", "handoff phase X",
  "chuẩn bị đưa Codex".
- Ngay sau khi mục "Trước khi giao Codex" trong `phase-X.md` đã hết `[ ]`
  (toàn bộ quyết định/câu hỏi mở đã được chốt).

## Điều kiện trước khi sinh prompt

Đọc `docs/exec-plans/active/phase-X.md` trước. Nếu mục "Trước khi giao
Codex" (hoặc phần tương đương ở đầu checklist) còn dòng `[ ]` chưa xong,
**dừng lại** và báo cho user biết còn thiếu gì — không sinh prompt cho một
phase còn quyết định treo, Codex sẽ phải tự đoán đúng thứ mà quy trình này
muốn tránh.

## Cách sinh prompt

Đọc toàn bộ `phase-X.md` và các phần liên quan (`AGENTS.md`,
`docs/roadmap.md` để biết phase nào đã đóng trước đó), rồi lắp vào template
dưới đây. Không bịa thêm scope không có trong `phase-X.md` — nếu thấy
`phase-X.md` thiếu chi tiết cần thiết để Codex làm việc (ví dụ: không rõ tên
bảng, không rõ hàm nào gọi hàm nào), hỏi lại user hoặc bổ sung vào
`phase-X.md` trước, đừng tự chế trong prompt.

### Template

```
Context: You are the implementation owner for Phase <N> of BaSa3D (see
AI_WORKFLOW.md — Codex implements, Claude/Gemini review). <One line noting
which prior phase(s) are closed and where their output lives, e.g. "Phase
<N-1> is closed — see docs/exec-plans/completed/phase-<N-1>.md and
<key output file>.">

Read first, in this order:
1. AGENTS.md — canonical engineering rules.
2. docs/exec-plans/active/phase-<N>.md — this phase's brief, all decisions
   already locked in ("Quyết định đã chốt" section), and Definition of Done.
   <Point at any specific sub-section worth flagging, e.g. a resolved
   conflict note.>
3. <Other docs phase-X.md's Inputs section names — architecture docs,
   database docs, api-conventions, etc.>
4. <Existing code files this phase must extend rather than duplicate, e.g.
   src/domain/schemas.ts from a prior phase.>

Task: implement Phase <N> — <short phase name from phase-X.md's title> —
ONLY. <Restate phase-X.md's Non-goals in one sentence.>

Scope:
<One bullet per concrete deliverable, derived by combining phase-X.md's
Outputs list with its "Quyết định đã chốt" decisions — each decision that
constrains HOW something is built (a formula, a locking strategy, a naming
convention, a security rule) becomes a concrete instruction here, not just
a restated goal. Be as concrete as the source doc is: name exact files,
exact function/table/column names when phase-X.md names them.>

Before reporting done:
<One bullet per verification step, derived from phase-X.md's Checklist
"the actual implementation work" section and its Definition of Done —
include exact test scenarios phase-X.md describes (e.g. a named concurrency
scenario), and name every review skill phase-X.md's checklist references
(.agents/skills/<name>/SKILL.md), with what to specifically check.>

<If phase-X.md's Risks section has any item explicitly marked as an
accepted/non-blocking limitation, add a paragraph here telling Codex NOT to
fix it, and where to leave a pointer instead. Skip this section entirely if
there is no such item — don't invent one.>

Commit style: small commits, Conventional Commits (see AGENTS.md examples),
one logical group per commit — <2-4 example commit messages matching this
phase's actual scope groups, not generic placeholders>. Do not move
phase-<N>.md to docs/exec-plans/completed/ yourself — that happens after
human/Claude review.

Report back in exactly this format (per AGENTS.md):
1. Files changed
2. Behavior
3. Tests/checks run
4. Known risks
5. Follow-up work, if any
```

## Sau khi sinh prompt

Đưa prompt cho user trong một code block để copy nguyên khối. Nhắc user (1
câu, không dài dòng) nếu `phase-X.md` còn input nào chưa điền (ví dụ biến
môi trường thật) mà Codex sẽ cần để test thật, không chỉ chạy được code.

## Không tự động làm

- Không tự sinh prompt khi còn câu hỏi mở chưa chốt trong `phase-X.md`.
- Không thêm scope/quy tắc không có trong `phase-X.md` vào prompt — nếu
  thiếu, sửa `phase-X.md` trước (hoặc hỏi user), rồi mới sinh prompt.
- Không tự giao việc (gửi prompt) thay user — chỉ soạn prompt, user là
  người đưa cho Codex.
