# Runbook: Spec Kit + Multi-Provider Agent Swarm (`/speckit-auto`) cho BaSa3D

> Một lệnh chạy trọn quy trình Spec Kit bằng đội đa tác tử, phân vai theo `AI_WORKFLOW.md`:
> **Gemini** (challenger) viết spec → *bạn duyệt* → **Claude** (architect) lập plan + tasks → *bạn duyệt* →
> **OpenAI** (vai Codex) code → **Claude** review cuối → **Ollama** sửa lint vặt → cổng chất lượng → commit cục bộ.
> Port từ HacDaoTruyen (`tools/swarm/`), đã đổi cổng kiểm tra, rào chắn và prompt cho Next.js/Supabase.

---

## 0. Spec Kit thủ công (không cần swarm)

Spec Kit v1.2.2 cài cho Claude Code: `.specify/` (template, script bash, hiến pháp) + `.claude/skills/speckit-*`
(bản sao cho Codex/Gemini ở `.agents/skills/speckit-*`). Thứ tự lệnh:

`/speckit-specify <mô tả>` → (`/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` → (`/speckit-analyze`) →
`/speckit-implement` → `/speckit-converge`. Đặc tả lưu ở `specs/NNN-slug/`.

- **Hiến pháp**: `.specify/memory/constitution.md` — cô đọng từ `AGENTS.md` (AGENTS.md thắng khi mâu thuẫn).
- **Template override**: `.specify/templates/overrides/{plan,tasks}-template.md` thêm mục **BaSa3D Phase Bridge**
  (phase brief, lát cắt dọc, rủi ro theo thứ tự ưu tiên review, ADR/business-rules phải cập nhật, cổng chất lượng).
  Bản core giữ nguyên để `specify integration upgrade` không đè mất.
- Nâng cấp Spec Kit: `specify integration upgrade` rồi chép lại `.claude/skills/speckit-*` sang `.agents/skills/`.

## 1. Cầu nối với PHASE_START_PROTOCOL

| Bước protocol | Trong Spec Kit / swarm |
|---|---|
| 1. Contract (phase brief) | `spec.md` + mục Phase Bridge trong `plan.md` |
| 2. Freeze scope (`exec-plans/active/…`) | Swarm tự sinh `docs/exec-plans/active/feature-NNN-slug.md` khi plan được duyệt |
| 3. Challenge trước khi code | Gemini viết spec theo hướng phản biện + gate duyệt spec của bạn |
| 4. Một implementation owner | Chỉ vai Coder (OpenAI/Codex) được ghi code |
| 5. Lát cắt dọc | `tasks.md` xếp theo DB → service/API → UI → test → docs |
| 6. Verify | Cổng: lint · typecheck · test · build · e2e |
| 7. Record decisions | Task bắt buộc cập nhật ADR / business-rules / schema / roadmap |
| 8. Close phase | Skill `close-phase` trên file `feature-NNN-slug.md` |

**Chiều ngược lại**: đã soạn sẵn `phase-X.md` theo protocol cũ? Dùng nó làm đầu vào:
`tools/swarm/speckit-auto.sh --from-file docs/exec-plans/active/phase-37.md` — Spec Lead được dặn giữ nguyên
các quyết định đã chốt trong file.

## 2. Cài đặt (một lần, trên Mac)

1. **Python 3.11+** (`brew install python@3.12`), **Node 22**, **git**. Script tự tạo venv `.venv-swarm/` lần đầu.
2. **Ollama** cho Local Healer (tuỳ chọn — không có thì dùng Claude): `ollama pull qwen2.5-coder:7b`.
3. **API key** — `cp tools/swarm/env.swarm.example .env.swarm` (đã gitignore), điền
   `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`.
   **Chỉ có một key cũng chạy được**: model thiếu key bị bỏ qua và Gemini nằm cuối mọi chuỗi dự phòng,
   nên chỉ cần `GEMINI_API_KEY` là đủ (mọi vai dùng `gemini-3.1-pro-preview`, Healer dùng `gemini-3.8-flash`).
   Đổi lại là mất phần "khác hãng phản biện nhau" giữa Coder và Reviewer.
   Swarm **chỉ đọc `.env.swarm`**, không đọc `.env`/`.env.local` (secret production). Dùng key RIÊNG,
   đừng tái dùng `GEMINI_API_KEY` của tính năng screenshot-estimate; đặt hạn mức chi tiêu ở trang từng hãng.
4. **DB test local (khuyến nghị)** — để cổng `test` chạy cả test DB và cổng `e2e` chạy được:
   `supabase start`, rồi điền `TEST_DATABASE_URL`, `TEST_SUPABASE_*` vào `.env.swarm`.
   Chỉ URL `localhost`/`127.0.0.1` được chấp nhận — có một URL hosted là swarm bỏ HẾT biến `TEST_*`.
   Playwright browser phải cài sẵn (`npx playwright install chromium`); swarm dùng lại cache trên máy.
5. **Xác minh tên model + giá** trong `tools/swarm/agents.toml` (sao từ HacDaoTruyen, nguồn thứ ba 2026-10-18).
   Ngân sách mỗi run tính từ bảng giá này. Khi không chắc, để giá CAO hơn thực tế.
6. Kiểm tra: `tools/swarm/speckit-auto.sh check` (thêm `--ping` để gọi thử từng model, tốn < 1 cent).

## 3. Chạy

| Cách | Lệnh |
|---|---|
| Trong Claude Code | `/speckit-auto Thêm mã giảm giá cho đơn hàng` |
| Terminal | `tools/swarm/speckit-auto.sh "Mô tả tính năng" [--budget 3]` |
| Từ exec-plan có sẵn | `tools/swarm/speckit-auto.sh --from-file docs/exec-plans/active/phase-37.md` |
| Chỉ mở dashboard | `tools/swarm/speckit-auto.sh serve` |
| Không trình duyệt (duyệt trong terminal) | `tools/swarm/speckit-auto.sh run "Mô tả"` |
| **Chạy thử miễn phí** | `tools/swarm/speckit-auto.sh --demo` |

Lệnh in `Dashboard: http://127.0.0.1:8765/#token=…` và tự mở trình duyệt. **Không chia sẻ link có token.**
Ctrl+C để tắt (run dở sẽ dừng).

Dashboard: thẻ agent (vai trò, model, trạng thái, token, $), thanh ngân sách, khung duyệt
(Duyệt / Yêu cầu sửa — tối đa 3 lần / Dừng; gate ngân sách: Duyệt = +$1 hoặc số ghi trong ô góp ý),
tab tài liệu (spec, plan, tasks, exec-plan, diff, báo cáo review), luồng hội thoại.

## 4. Cổng chất lượng

| Cổng | Lệnh | Khi nào chạy |
|---|---|---|
| `lint` | `npm run lint` | luôn |
| `typecheck` | `npm run typecheck` | luôn |
| `test` | `npm test` | luôn (có `TEST_DATABASE_URL` → kèm test DB + `next build` vào `.next-test`) |
| `build` | `npm run build` | khi đổi `src/`, `messages/`, `public/`, `next.config`, tailwind… (`[run] build`) |
| `e2e` | `npx playwright test` | khi đổi `src/`, `e2e/`, `supabase/migrations/` **và** có đủ `TEST_*` (`[run] e2e`) |

Lần đầu mỗi worktree chạy `npm ci` (vài phút). Lint đỏ → Healer sửa; cổng khác đỏ → Coder sửa tối đa
`max_fix_rounds` vòng. Vẫn đỏ thì vẫn commit, gắn `[WIP: checks failed]`.

## 5. Sau khi run xong

Kết quả là **một commit trên nhánh `feature/NNN-slug`** trong `../BaSa3D-swarm/NNN-slug`. Swarm **không push, không deploy**.
```bash
cd ../BaSa3D-swarm/NNN-slug
git log -1 --stat; git diff HEAD~1          # review: BLOCKERS → IMPORTANT → NICE TO HAVE
npx playwright test                         # nếu cổng e2e bị bỏ qua
git push -u origin feature/NNN-slug         # bạn tự push → PR → CI (attestation gate)
git worktree remove ../BaSa3D-swarm/NNN-slug   # dọn sau khi merge
```
Rồi đóng `docs/exec-plans/active/feature-NNN-slug.md` bằng skill `close-phase`.

## 6. An toàn — cái gì chặn cái gì

| Rủi ro | Rào chắn |
|---|---|
| Đụng working tree đang làm dở / Codex đang sửa | Mỗi run một **git worktree** riêng ngoài repo |
| Lộ secret production | Worktree chỉ có file đã track → **không có `.env*`**; công cụ agent chặn đọc `.env*`, `.mcp.json`, `.vercel/`, `.git/` |
| Test chạm DB/Supabase thật | Chỉ `TEST_*` trỏ localhost được truyền vào; `tests/helpers/test-environment.ts` chặn thêm lớp nữa — và file đó, `test-runner.ts`, `playwright.config.ts` bị **cấm ghi** |
| Agent chạy lệnh tuỳ ý / deploy | **Không có shell** — chỉ 5 cổng cố định; `package.json` bị cấm ghi (không chèn lệnh vào npm scripts, không thêm dependency lén) |
| Phá lịch sử migration | `supabase/migrations/` chỉ được **tạo file mới**, không sửa file cũ |
| Agent tự nới rào chắn | Cấm ghi `tools/swarm/`, `.github/`, `.claude/`, `.agents/`, `.specify/`, `.vnx*/`, `scripts/deploy/`, `vercel.json`, `AGENTS.md`, `CODEOWNERS` |
| Code agent đọc phiên `vercel`/`gh`/`supabase` | Tiến trình check nhận env đã lọc, `HOME` trỏ thư mục tạm |
| Trang web lạ gọi API localhost | Server chỉ bind `127.0.0.1`, kiểm Host header, mọi API cần token ngẫu nhiên |
| Chi phí vượt dự kiến | Ước lượng trước mỗi lời gọi; vượt ngân sách → dừng hỏi |

**Giới hạn còn lại:** chạy test = chạy code agent viết, với quyền user macOS của bạn. Luôn review diff trước khi push.

## 7. Tuỳ chỉnh (`tools/swarm/agents.toml`)

- `[run] budget_usd`, `max_coder_steps`, `max_qa_rounds`, `max_fix_rounds`, `e2e`, `build` (`auto|always|never`).
- `[roles.<vai trò>] models` — chuỗi dự phòng, model đầu là chính. Ví dụ Coder dùng Claude:
  `models = ["anthropic/claude-sonnet-5-5"]`.
- Thêm model: khai báo giá ở `[models."provider/model"]` rồi đưa vào `models` của vai trò.

Chi phí ước tính một run tính năng nhỏ: **~$0.4–1.0** (spec ~$0.2, plan ~$0.2, phần còn lại tuỳ số lượt Coder).

## 8. Trạng thái xác minh (2026-10-20)

- Run thật đầu tiên `20261020-161450-12c3` (Mac, chỉ có `GEMINI_API_KEY`, model `gemini-3.8-flash`):
  ✅ gọi Gemini thật · ✅ spec.md + plan.md/tasks.md đúng định dạng · ✅ 2 gate · ✅ exec-plan cầu nối ·
  ✅ Coder gọi tool (thought signature không gây 400). ⏳ Đang chờ Coder/QA/cổng kiểm tra + commit.
- Mỗi lượt gọi mất 90–293s (spec 293s, sát timeout 300s cũ) vì Gemini 3 mặc định thinking_level=high.
  Đã sửa: `[providers.google] reasoning_effort = "low"` + `http_timeout_s = 600`.
- Sandbox của Claude bị proxy chặn `generativelanguage.googleapis.com` → swarm chỉ chạy được trên Mac
  (hoặc khi domain đó được thêm vào danh sách mạng cho phép).

## 9. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| "Thiếu token" trên dashboard | Mở đúng link có `#token=…` |
| Thẻ agent ghi "thiếu …_API_KEY" | Điền `.env.swarm`, chạy lại |
| Healer luôn chuyển sang Claude | `ollama serve` chưa chạy / chưa pull model |
| `HTTP 404 … model` | Tên model đã đổi — sửa `agents.toml`, `check --ping` |
| Cổng `test` hỏng vì cổng 3411 bận | Đang có run khác / `npm test` khác chạy song song — chờ xong |
| "Bỏ qua E2E" | Chưa có đủ `TEST_*` localhost trong `.env.swarm` |
| `BỊ CHẶN` trong log Coder | Agent đụng vùng cấm — nếu thật sự cần (vd thêm dependency), tự làm tay sau run |
| Mỗi lượt Gemini rất chậm (> 1 phút) | Kiểm tra `reasoning_effort = "low"` ở `[providers.google]`; tăng `http_timeout_s` |
| Log chi tiết | `.swarm/runs/<run-id>/events.jsonl` (đã gitignore) |
