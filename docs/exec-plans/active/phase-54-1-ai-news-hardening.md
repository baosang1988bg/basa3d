# Phase 54.1 — Hardening Daily AI 3D News (follow-up review commit `e441943`)

**Status:** Implemented 2026-11-01 — chờ OWNER review + chạy full `npm test` với DB local.
**Owner:** Claude (review + implementation), OWNER duyệt gate.
**Trigger:** Review Phase 54 phát hiện 4 BLOCKER (C1–C4) + 7 IMPORTANT (W1–W7).

---

## 1. Phase brief

- **Goal:** Làm cho pipeline điểm tin AI an toàn để bật cron production: không lỗi khi chạy trùng,
  không vượt timeout serverless, output AI được validate + sanitize trước khi ghi DB, audit trail đúng.
- **Non-goals:** Không đổi schema DB. Không thêm dependency. Không làm tính năng "tạo lại bài" (regenerate).
  Không đổi renderer blog public (giữ phạm vi; xem follow-up).
- **Definition of Done:**
  - Bấm nút admin sau khi cron đã chạy → trả `SKIPPED_ALREADY_EXISTS`, không gọi Gemini, không lỗi 23505.
  - 2 request đồng thời → đúng 1 bài, request thua trả `SKIPPED_ALREADY_EXISTS` (không 500).
  - Tổng thời gian gọi Gemini bị chặn bởi deadline; route khai báo `maxDuration`.
  - Netlify scheduled function trả về < 5s, việc nặng chạy trong background function có kiểm tra secret.
  - Output AI qua Zod (`generatedArticleSchema` + `blogPostInputSchema`); link/ảnh/HTML ngoài allowlist bị loại.
  - Bài luôn là `DRAFT`; `created_by`/`actor_id` = `null` cho lần chạy cron.
  - Typecheck, lint, unit tests xanh.

## 2. Quyết định đã chốt với OWNER (2026-11-01)

| # | Quyết định | Lý do / trade-off |
|---|---|---|
| D1 | **Bỏ hẳn `AUTO_PUBLISH_DAILY_NEWS`** — luôn `DRAFT`. | Prompt injection từ RSS có thể chèn link spam; con người là lớp kiểm duyệt cuối. |
| D2 | **Nút thủ công: `requireAdmin` + cooldown 5 phút** (đếm `audit_logs.action = 'DAILY_NEWS_SYNC_TRIGGERED'`, claim trong transaction có `pg_advisory_xact_lock`). | Chặn spam quota Gemini mà không đổi mô hình quyền của blog. |
| D3 | **System actor = `null`** (`createBlogPost(input, actorId: string \| null)`), audit action `BLOG_POST_CREATED` với `actor_id null`. | Không dùng UUID test fixture trong production; cột `created_by`/`actor_id` vốn nullable, không FK. |
| D4 | **Netlify: scheduled → background function.** `daily-3d-news.mts` chỉ kích hoạt `daily-3d-news-run-background.mts` (15 phút), background fn kiểm tra `CRON_SECRET` rồi gọi route. | Scheduled function bị giới hạn 30s. Background fn có URL công khai nên bắt buộc auth. |
| D5 | **Idempotency = unique constraint + bắt `23505`** (không dùng advisory lock quanh lời gọi Gemini). | Không giữ transaction mở 30–60s qua pooler; chấp nhận tốn thêm 1 lượt Gemini khi race. |
| D6 | **Chuỗi model mặc định:** `gemini-3.8-flash` → `gemini-3.5-flash-lite` → `gemini-2.5-flash`; override bằng `GEMINI_NEWS_MODELS` (CSV). Bỏ `gemini-1.5-flash` (shutdown 2025-09-29). | 404 vẫn fallback, nên model không tồn tại chỉ tốn 1 request nhanh. OWNER cần xác nhận tên model trên Google AI Studio. |

## 3. Slices

### S0 — Service core (`src/services/ai-news.service.ts`)
- [x] `generatedArticleSchema` (Zod) + `blogPostInputSchema.parse` trước khi ghi DB (C4).
- [x] Bỏ `?key=` khỏi URL, chỉ dùng header `x-goog-api-key` (W1).
- [x] Phân loại lỗi: 400/401/403 dừng chuỗi; 404/408/429/5xx/timeout fallback; kiểm tra `finishReason`;
      `systemInstruction` tách riêng, `maxOutputTokens`, deadline tổng `GEMINI_BUDGET_MS` (C3, W2).
- [x] `sanitizeGeneratedMarkdown`: bỏ ảnh, HTML, link ngoài allowlist (nguồn RSS + basa3d) (W3).
- [x] Bắt `23505` cho bài viết + category (C2); bỏ `force`, `autoPublish` (C1, D1); actor `null` (D3).
- [x] Lọc tin theo `pubDate` (≤ 72h), thứ tự feed ổn định, sửa `stripHtml` multi-line + decode entity (W7, N1, N3).
- [x] Inject `fetchImpl`/`now` để test được mà không mock global.

### S1 — Entry points
- [x] `blog.service.ts`: `createBlogPost(input, actorId: string | null)`.
- [x] `actions.ts`: `claimManualNewsSync` (cooldown) + bỏ `force`; map lỗi sang thông báo thân thiện (C1, W6).
- [x] `route.ts`: `maxDuration = 60` (C3).
- [x] Netlify: scheduled fn kích hoạt background fn; background fn kiểm tra secret (D4).

### S2 — Tests (`tests/ai-news.test.ts`, `tests/netlify-deploy.test.ts`)
- [x] Fallback 429 → model kế; 401 dừng ngay; key không nằm trên URL.
- [x] `finishReason=MAX_TOKENS` → fallback; JSON lỗi / output vượt giới hạn → fallback; tất cả lỗi → `GEMINI_*`.
- [x] Deadline: không gọi model mới khi hết budget.
- [x] Sanitize: link ngoài, ảnh, HTML, `javascript:`.
- [x] RSS: tất cả feed lỗi → mảng rỗng; lọc theo `pubDate`; `stripHtml` multi-line.
- [x] DB (skip khi không có DB): idempotency, race 2 request → 1 bài, cooldown.
- [x] Netlify: schedule khớp `vercel.json`, background fn từ chối khi thiếu/sai secret.

### S3 — Verify & docs
- [x] `tsc --noEmit` (0 lỗi), `eslint` trên các file đổi (0 lỗi), unit tests không cần DB: 18 pass / 5 skip (DB).
- [x] Cập nhật ADR-0056 (addendum), plan Phase 54.

## 4. Known risks / follow-up
- Tên model `gemini-3.8-flash` / `gemini-3.5-flash-lite` chưa xác minh từ nguồn chính thức — OWNER kiểm tra trong AI Studio.
- Giới hạn sync function của Netlify cho route Next vẫn áp dụng cho chính route; nếu Gemini thường > giới hạn đó, cân nhắc chạy service trực tiếp trong background fn (cần bundling path alias).
- Follow-up: thêm `rel="nofollow noopener"` cho link ngoài trong renderer blog (`ReactMarkdown components.a`) — ảnh hưởng cả bài viết tay nên cần OWNER quyết riêng.
- DB-backed tests (idempotency, race, cooldown, NO_NEWS_FETCHED) chỉ chạy khi có `TEST_DATABASE_URL` local — cần chạy `npm test` đầy đủ trước khi merge.
- Cooldown đếm theo audit log nên lần bấm lỗi cũng bị tính — có chủ đích (chống tốn quota).
