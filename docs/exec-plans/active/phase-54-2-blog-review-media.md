# Phase 54.2 — Trang duyệt bài blog + Media nguồn (ảnh preview, video YouTube)

**Status:** Implemented 2026-11-01 — chờ OWNER review, chạy `npm test` với DB local, apply migration.
**Owner:** Claude (implementation), OWNER duyệt gate.
**Trigger:** OWNER: bài điểm tin cần được review trước khi public ở một trang riêng; bài chỉ có
chữ nên khó giữ người đọc → cần hình minh hoạ / clip.

---

## 1. Phase brief

- **Goal:**
  1. Trang riêng `/admin/blog/review` ("Duyệt bài" trên menu, có badge số bài nháp): danh sách bài
     DRAFT, xem trước giống hệt trang public, chọn media, **Duyệt & đăng** hoặc **Từ chối & xoá**.
  2. Bài điểm tin AI tự gắn media lấy từ bài gốc: **thẻ ảnh preview** (og:image / RSS
     `media:content`, hotlink, ghi "Ảnh: <nguồn>" + link bài gốc) và **video YouTube** có sẵn trong
     bài gốc (nhúng `youtube-nocookie.com`). Admin bật/tắt từng media ở trang duyệt.
- **Non-goals:** Không tải ảnh bản quyền về storage (không rehost). Không gọi YouTube Data API.
  Không dùng ảnh nguồn làm `og:image`/JSON-LD của BaSa3D. Không thêm dependency.

## 2. Quyết định đã chốt với OWNER (2026-11-01)

| # | Quyết định | Lý do / trade-off |
|---|---|---|
| D1 | **Media = thẻ preview nguồn + YouTube từ bài gốc.** Không rehost. | og:image là ảnh publisher chủ động cung cấp cho link preview; hiển thị như thẻ trích dẫn có ghi nguồn + link là rủi ro thấp nhất. Nhúng YouTube hợp lệ theo điều khoản YouTube. Đổi lại: ảnh có thể hỏng nếu nguồn chặn hotlink (UI tự ẩn ảnh lỗi). |
| D2 | **Page riêng `/admin/blog/review`**, menu "Duyệt bài" + badge số DRAFT. | Quy trình duyệt mỗi sáng không bị chôn dưới form viết bài. |
| D3 | **Từ chối = xoá bản nháp + audit log `BLOG_POST_REJECTED`** (before_data giữ title/slug/excerpt). | Không cần đổi enum. Hôm đó có thể quét lại để tạo bài mới. |
| D4 | **Mọi admin/staff (`requireAdmin`) được duyệt & đăng.** | Đồng nhất với quyền sửa blog hiện tại. |
| D5 | **Lưu media ở cột `blog_posts.media jsonb`** (mảng item có `selected`), validate bằng Zod (`src/lib/blog-media.ts`). Render có kiểm soát, **không** nhúng URL ảnh vào markdown. | Sanitizer markdown giữ nguyên quy tắc "không ảnh"; renderer quyết định cách hiển thị (lazy, no-referrer, ẩn khi lỗi). Migration additive. |
| D6 | **Ảnh chỉ nhận khi host trùng domain bài gốc** (hoặc CDN `*.wp.com`), chỉ `https`. Video chỉ nhận ID 11 ký tự hợp lệ. | Chặn nguồn chèn ảnh từ host lạ (tracking pixel). |
| D7 | **Fetch trang bài gốc song song với lời gọi Gemini** (timeout 6s, đọc tối đa 1.5MB). | Không cộng thêm thời gian vào budget 60s của route. |
| D8 | **Duyệt có điều kiện** `update ... where status = 'DRAFT'` → 2 người bấm cùng lúc chỉ 1 lần đăng; lần sau nhận `BLOG_POST_NOT_DRAFT`. | Tránh ghi đè/audit trùng. |

## 3. Slices

### S0 — Data
- [x] Migration `20261101000000_blog_post_media.sql`: `media jsonb not null default '[]'`, check mảng ≤ 20 phần tử.
- [x] `src/lib/blog-media.ts`: `blogMediaItemSchema` (`source_image` | `youtube`), helpers render.
- [x] `blog.service.ts`: `createBlogPost` nhận `media`; `publishBlogPostDraft`, `rejectBlogDraft`,
      `updateBlogPostMediaSelection`, `listDraftPostsForReview`, `getBlogPostForReview`, `countDraftPosts`;
      public queries trả `media` + `previewImageUrl` (fallback thumbnail cho trang danh sách).

### S1 — Ingest (`ai-news.service.ts`)
- [x] RSS: lấy `media:content`/`media:thumbnail`/`enclosure` ảnh + YouTube ID trong `content:encoded`; bỏ tham số `utm_*` khỏi link.
- [x] `extractArticleMedia(html, pageUrl)`: og:image / twitter:image + YouTube ID (embed, watch, youtu.be, shorts).
- [x] `buildMediaCandidates`: chỉ nguồn được bài viết trích dẫn; ảnh: og > RSS; video: tối đa 2/nguồn, 6/bài, dedupe; mặc định chọn ảnh + video đầu tiên mỗi nguồn.

### S2 — UI
- [x] `BlogArticleView` + `BlogMediaGallery` dùng chung cho trang public và xem trước admin.
- [x] `/admin/blog/review`: danh sách nháp, xem trước, chọn media, Duyệt & đăng, Từ chối & xoá (confirm).
- [x] Menu "Duyệt bài" + badge `blogDrafts`; active state chọn mục khớp dài nhất.
- [x] Trang `/blog` dùng ảnh nguồn làm thumbnail khi bài không có ảnh bìa.
- [x] CSP (report-only): `frame-src` YouTube nocookie, `img-src` các domain nguồn.

### S3 — Tests & docs
- [x] Unit: parse media RSS, extractArticleMedia, buildMediaCandidates, schema media.
- [x] DB (skip khi không có DB): sync lưu media; publish có điều kiện; reject chỉ xoá DRAFT; cập nhật lựa chọn media.
- [x] ADR-0057.
- [x] Verify: `tsc --noEmit` 0 lỗi; `eslint` file đổi 0 lỗi; unit tests không cần DB: 27 pass / 10 skip (DB). `security-headers.test.ts` + `netlify-deploy.test.ts` cần chạy trên máy dev (sandbox thiếu native `@parcel/watcher`).

## 4. Known risks / follow-up
- Nguồn chặn hotlink → ảnh bị ẩn (không vỡ layout). Nếu tỉ lệ hỏng cao, cân nhắc xin phép nguồn hoặc dùng ảnh xưởng.
- Video lấy từ HTML trang bài gốc có thể là video sidebar không liên quan → mặc định chỉ chọn video đầu tiên/nguồn, admin kiểm tra ở trang duyệt.
- All3DP feed có thể chặn bot (fetch trả rỗng trong lúc khảo sát) — media chủ yếu từ 3D Printing Industry / Hackaday.
