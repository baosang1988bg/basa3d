# Phase 54 — Daily AI 3D News Cron & Auto-Draft (Cập nhật tin tức in 3D hằng ngày)

**Status:** Code implemented & verified (2026-10-30) — sẵn sàng để OWNER cấu hình GEMINI_API_KEY và kiểm tra nghiệm thu  
**Owner:** Gemini (kế hoạch & implementation)  
**Trigger:** Yêu cầu từ OWNER: cập nhật tin tức, xu hướng in 3D hàng ngày cho BaSa3D một cách tự động, hỗ trợ SEO và giữ chân khách hàng.

---

## 1. Phase brief

- **Goal:** Xây dựng hệ thống tự động quét tin tức in 3D quốc tế (All3DP, 3D Printing Industry, Prusa, Bambu Lab) mỗi ngày một lần, dùng Gemini API tổng hợp & dịch sang tiếng Việt theo tone giọng kỹ thuật của BaSa3D, tự động lưu thành bài viết nháp (`DRAFT`) hoặc đăng (`PUBLISHED`) vào chuyên mục Tin tức của Blog. Cung cấp nút kích hoạt thủ công `[Cào tin tức ngay]` trong trang `/admin/blog`.
- **Non-goals:**
  - Không thêm thư viện ngoài (zero-dependency: dùng `fast-xml-parser` đã có sẵn trong `package.json`, dùng native `fetch` gọi Gemini REST API).
  - Không làm scraper web phức tạp vượt rào Cloudflare/Bot-block (chỉ parse chuẩn RSS/Atom feed công khai).
  - Không thay đổi schema DB bảng `blog_posts` (tận dụng nguyên vẹn schema Phase 7).
  - Không tự ý generate ảnh bìa ảo bằng AI tốn kém (dùng fallback ảnh đại diện mặc định của xưởng hoặc trích xuất link ảnh từ RSS enclosure).
- **Inputs:** `src/services/blog.service.ts`, `src/lib/cron-auth.ts`, `fast-xml-parser`, `process.env.GEMINI_API_KEY`, `process.env.CRON_SECRET`.
- **Outputs:**
  - `src/services/ai-news.service.ts`: Parse RSS, chọn lọc tin nổi bật, gọi Gemini 2.5 Flash, tạo bài viết blog.
  - `src/app/api/cron/daily-3d-news/route.ts`: Cron route được bảo vệ bởi `CRON_SECRET`.
  - `netlify/functions/daily-3d-news.mts` & `vercel.json`: Lịch chạy định kỳ hằng ngày lúc 06:00 UTC+7 (`0 23 * * *`).
  - Nút kích hoạt thủ công tại `/admin/blog` với Server Action `triggerDailyNewsSyncAction`.
  - Bộ kiểm thử unit/integration `tests/ai-news.test.ts`.
- **Risks:**
  - Mạng ngoài bị lỗi / feed RSS timeout: Failsafe nhẹ nhàng, log cảnh báo, không gây chết cron.
  - Quota hoặc thiếu `GEMINI_API_KEY`: Báo lỗi rõ ràng `GEMINI_NOT_CONFIGURED` thay vì 500 crash server.
  - Trùng lặp bài viết khi chạy cron nhiều lần trong ngày: Idempotency theo slug định dạng `diem-tin-in-3d-YYYY-MM-DD`.
- **Definition of Done:**
  - Chạy cron route `/api/cron/daily-3d-news` với Bearer token hợp lệ sinh đúng 1 bài viết trong bảng `blog_posts`.
  - Chạy lại lần 2 trong cùng ngày trả về `ALREADY_EXISTS` / `NO_OP`, không sinh duplicate.
  - Admin vào `/admin/blog` thấy bài viết nháp với đầy đủ Title, Slug, Excerpt, Content Markdown, Tags, SEO fields.
  - Typecheck, Lint, và Unit test chạy xanh.

---

## 2. Quyết định kiến trúc (Design Decisions)

| # | Quyết định | Lý do |
|---|---|---|
| **D1** | **Zero new dependency**: Sử dụng `fast-xml-parser` có sẵn trong `package.json` để parse RSS và `fetch` native để gọi Google Gemini API (`models/gemini-2.5-flash:generateContent`). | Tuân thủ tuyệt đối quy tắc Rule #8 trong `AGENTS.md` (không thêm dependency bừa bãi). |
| **D2** | **Bảo vệ xác thực Cron**: Dùng `isAuthorizedCronRequest` từ `src/lib/cron-auth.ts` đối chiếu `CRON_SECRET`. Hỗ trợ song song cả Vercel Cron (`vercel.json`) và Netlify Scheduled Function (`netlify/functions/daily-3d-news.mts`). | Đồng bộ kiến trúc với Phase 33 & Phase 51 (`cleanup-orphan-uploads`). |
| **D3** | **Idempotency theo ngày**: Slug bài viết tự động sinh theo mẫu `diem-tin-in-3d-YYYY-MM-DD`. Trước khi tạo mới, service kiểm tra xem slug này đã tồn tại hay chưa. | Tránh spam trùng bài viết nếu cron retry nhiều lần. |
| **D4** | **Trạng thái mặc định DRAFT (An toàn SEO)**: Mặc định bài tạo ra ở trạng thái `DRAFT` để Owner duyệt nhanh trong 30s trước khi publish. Nếu có biến môi trường `AUTO_PUBLISH_DAILY_NEWS=true` thì mới tự động chuyển sang `PUBLISHED`. | Tránh rủi ro Google phạt nội dung AI tự động (AI uncurated content penalty) và đảm bảo kiểm duyệt từ ngữ kỹ thuật. |
| **D5** | **Tự động gắn danh mục "Tin tức"**: Kiểm tra category slug `tin-tuc`, nếu chưa có trong DB thì tự động tạo mới `createBlogCategory({ name: 'Tin tức', slug: 'tin-tuc' })`. | Đảm bảo tính liên kết dữ liệu quan hệ trong `blog_posts.category_id`. |
| **D6** | **Nút kích hoạt thủ công tại Admin**: Thêm nút `[Quét tin hôm nay]` ở trang `/admin/blog` để Owner có thể chủ động bấm lấy tin tức bất cứ lúc nào thay vì chờ đến giờ chạy cron. | Trải nghiệm người dùng thực tế thuận tiện, kiểm tra tức thì. |

---

## 3. Các lát cắt triển khai (Slices)

### S0 — AI News Service & Unit Tests (Logic cốt lõi)
- [x] Tạo `src/services/ai-news.service.ts`:
  - `fetchRssFeeds(urls: string[])`: Đọc và parse XML RSS sang mảng tin thô (Title, Link, PubDate, Snippet).
  - `generateNewsArticleWithGemini(items: RssItem[])`: Gửi prompt chuẩn hóa sang Gemini API, nhận về JSON có cấu trúc (title, excerpt, content markdown, tags, seoTitle, seoDescription).
  - `syncDaily3DNews(options: { force?: boolean; autoPublish?: boolean })`: Kiểm tra trùng slug ngày, gọi AI, tìm/tạo category `tin-tuc`, lưu bài viết bằng `createBlogPost`.
- [x] Tạo `tests/ai-news.test.ts`: Test parse RSS mẫu, mock Gemini response, kiểm tra kiểm soát lỗi khi thiếu key, kiểm tra tính idempotent không tạo trùng slug.

### S1 — Cron API Route & Deployment Schedules
- [x] Tạo `src/app/api/cron/daily-3d-news/route.ts` với xác thực `isAuthorizedCronRequest`.
- [x] Cập nhật `vercel.json` thêm lịch cron `0 23 * * *` (06:00 sáng UTC+7).
- [x] Tạo `netlify/functions/daily-3d-news.mts` mirror theo `cleanup-orphan-uploads.mts` với lịch `0 23 * * *`.

### S2 — Admin Action & Nút kích hoạt trên UI
- [x] Tạo Server Action `triggerDailyNewsSyncAction` trong `src/app/admin/(protected)/blog/actions.ts` (`requireAdmin`).
- [x] Thêm nút `[Quét tin hôm nay]` vào đầu trang `src/app/admin/(protected)/blog/page.tsx` kèm thông báo trạng thái (`BlogSyncNewsButton`).

### S3 — Verification & Quality Gate
- [x] Chạy `npm run typecheck` (passed, zero errors)
- [x] Chạy `npm run lint` (passed, zero errors)
- [x] Chạy `npm test` / unit tests (`tests/ai-news.test.ts`, `tests/netlify-deploy.test.ts` passed)
- [x] Cập nhật `docs/roadmap.md` & `docs/architecture/decisions.md` (ADR-0056).
