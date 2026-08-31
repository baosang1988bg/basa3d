# Phase 7 — SEO / Content / Launch

Theo `docs/roadmap.md`: Phase 7 là "SEO/content/launch". Chi tiết scope tham
khảo `3d-printing-website-development-plan.md` PHASE 7 (mục 7.1–7.4).
`docs/product/requirements.md` liệt kê "Blog/content foundation" trong Must
have — đây là phần duy nhất của Phase 7 chưa có bất kỳ nền tảng nào trong
code (không có bảng blog nào trong `docs/database/schema.md`, không có
`generateMetadata`/sitemap/robots ở đâu trong `src/app`).

## Rà soát trước khi lập kế hoạch

- Không có bảng `blog_posts`/`blog_categories` nào trong migration hiện tại.
- `src/app/layout.tsx` chỉ có 1 `metadata` tĩnh dùng chung cho toàn site —
  chưa có `generateMetadata` theo từng trang (product detail, category,
  blog post).
- Không có `sitemap.ts`/`robots.ts` (Next.js App Router route conventions).
- Không có trang 404 tùy chỉnh, không có trang chính sách (privacy/shipping/
  return) nào trong `src/app/(storefront)`.
- Không có tích hợp GA4/Search Console nào trong code.
- `docs/product/requirements.md` không có mục Tag như dev plan gốc liệt kê
  (chỉ nói "Blog/content foundation" chung chung) — cần quyết định mức độ
  chi tiết của schema blog ở Phase 7 này, tránh xây quá tay cho một CMS chưa
  ai dùng thật.

## Goal
Cho website có thể được Google index đúng, có nội dung blog tối thiểu để
làm SEO/organic traffic, và có các trang pháp lý/404 cần thiết trước khi
launch thật. Không xây CMS phức tạp — chỉ đủ để OWNER tự đăng bài từ admin.

## Non-goals
- **Production DB/backup/domain/SSL/error tracking account/Search Console
  verification** (dev plan mục 7.4) — đây là hành động vận hành/hạ tầng của
  OWNER ngoài phạm vi code, không phải thứ Claude/Codex implement. Liệt kê
  thành checklist bàn giao cho OWNER ở cuối, không phải Outputs của phase
  này.
- **Rich CMS** (WYSIWYG editor phức tạp, revision history, scheduling nâng
  cao, multi-author workflow) — MVP dùng textarea + markdown thô hoặc HTML
  đơn giản, giống mức độ đơn giản của `description` sản phẩm hiện tại
  (`textarea`, không WYSIWYG). Nếu OWNER cần soạn bài phức tạp hơn, đó là
  việc của Phase 8.
- **Bảng `blog_tags` many-to-many riêng** — dev plan liệt kê Tag như 1 field
  riêng biệt với Category, nhưng dự án này chưa có nhu cầu lọc/tìm theo tag
  thật. Dùng `text[]` đơn giản trên `blog_posts` thay vì bảng join — tránh
  premature abstraction (AGENTS.md rule #8/#9). Nếu cần lọc theo tag phức
  tạp sau này, nâng cấp lên bảng riêng dễ dàng (migration nhỏ).
- **GA4/Search Console thật** — chỉ wiring code (đọc `NEXT_PUBLIC_GA_ID` từ
  env, gắn script nếu có set) — không tự tạo property GA4/Search Console
  (cần tài khoản Google của OWNER).
- Đa ngôn ngữ cho blog — site hiện tại chỉ tiếng Việt (`lang="vi"`), giữ
  nguyên.

## Quyết định cần chốt trước khi giao Codex (điền vào đây sau khi hỏi OWNER
   hoặc sau AI challenge review — đừng tự đoán nếu không rõ, ghi assumption)

1. **Schema `blog_posts` & Định dạng Markdown**: `id, title, slug (unique), excerpt, content
   (text - định dạng Markdown), cover_image_path (Storage, giống product_images), category_id
   (FK -> `blog_categories` mới), tags (text[]), seo_title, seo_description,
   status (DRAFT/PUBLISHED), published_at (nullable), created_by (FK
   staff_profiles), created_at, updated_at`. `blog_categories`: `id, name,
   slug`. Mirror pattern `categories`/`products` đã có (slug unique, status
   enum kiểu `productStatusSchema`).
   - **Xử lý nội dung Blog bằng Markdown (Thay vì Plain Text/HTML thô):** Nội dung lưu dưới dạng Markdown. Trang Admin `/admin/blog` hỗ trợ ô nhập kèm tab Xem trước (Preview). Màn hình công khai `/blog/[slug]` render Markdown an toàn, giúp hiển thị tiêu đề (H2, H3), danh sách, ảnh chèn trong bài và trích dẫn chuyên nghiệp mà không bị lỗi an ninh XSS.
2. **Routing công khai**: `/blog` (list, phân trang), `/blog/[slug]` (detail)
   — trong route group `(storefront)` hiện có. Chỉ hiển thị bài `PUBLISHED`
   và `published_at <= now()`.
3. **Admin**: `/admin/blog` (list + tạo/sửa), theo đúng pattern
   `admin/(protected)/products` (server actions, `requireAdmin`).
4. **SEO metadata & OpenGraph**: dùng Next.js Metadata API — `generateMetadata` cho
   `/products/[slug]`, `/blog/[slug]`, và static cho trang tĩnh khác. Bổ sung `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL)` tại root layout để tránh lỗi canonical URL. Ảnh OG lấy từ `cover_image_path`/`product_images`, có ảnh mặc định fallback (`/images/og-default.jpg`).
5. **JSON-LD Structured Data**:
   - `schema.org/Product` cho trang sản phẩm (tên, giá VND, tình trạng hàng).
   - `schema.org/BlogPosting` cho bài viết blog.
   - **`schema.org/LocalBusiness` (Xưởng in 3D BaSa3D)** đặt tại trang chủ & footer: tên xưởng, số điện thoại, Zalo, địa chỉ, khoảng giá — giúp tối ưu SEO địa phương (Local SEO "in 3D Hà Nội / xưởng in 3D").
6. **sitemap.xml/robots.txt**: dùng Next.js file convention
   (`src/app/sitemap.ts`, `src/app/robots.ts`) — sitemap liệt kê
   product/category/blog PUBLISHED, không liệt kê trang admin.
7. **GA4**: 1 component nhỏ đọc `NEXT_PUBLIC_GA_ID`, không set thì không
   render gì (an toàn cho dev/local).
8. **Trang pháp lý & Cam kết bảo mật**: `/privacy-policy`, `/shipping-policy`,
   `/return-policy`, và **`/file-confidentiality-policy` (Chính sách bảo mật File thiết kế 3D / CAD Non-Disclosure)** — đặc biệt quan trọng để tạo niềm tin cho khách hàng kỹ thuật/doanh nghiệp khi gửi file thiết kế 3D độc quyền.
9. **Trang 404**: `src/app/not-found.tsx` tùy chỉnh theo style storefront
   hiện có (hiện dùng mặc định Next.js).

## Inputs
- `docs/roadmap.md`, `3d-printing-website-development-plan.md` PHASE 7.
- `src/services/product.service.ts` (`pagination`, slug pattern,
  `uploadProductImage`) — pattern tái dùng cho `blog.service.ts` +
  cover-image upload.
- `src/app/admin/(protected)/products/` — pattern admin CRUD (actions.ts,
  page.tsx, [id]/page.tsx) để mirror cho `/admin/blog`.
- `src/app/layout.tsx` — nơi thêm GA4 script (nếu set env) và có thể cần
  điều chỉnh `metadata` gốc thành `metadataBase` cho canonical URL tuyệt
  đối.

## Outputs
- Migration mới: `blog_categories`, `blog_posts` (+ bucket Storage
  `blog-images`, mirror `product-images`).
- `src/services/blog.service.ts`: CRUD + `listPublishedPosts`,
  `getPublishedPostBySlug`.
- `src/domain/schemas.ts`: `blogPostInputSchema`, `blogCategoryInputSchema`.
- `src/app/(storefront)/blog/page.tsx`, `[slug]/page.tsx` — public, có
  `generateMetadata` + JSON-LD `BlogPosting`.
- `src/app/(storefront)/products/[slug]/page.tsx` — thêm `generateMetadata`
  + JSON-LD `Product` (sửa file có sẵn, không viết lại).
- `src/app/admin/(protected)/blog/` — list + create/edit, theo pattern
  products.
- `src/app/sitemap.ts`, `src/app/robots.ts`.
- `src/app/not-found.tsx`.
- `src/app/(storefront)/privacy-policy/page.tsx`,
  `shipping-policy/page.tsx`, `return-policy/page.tsx`.
- Component GA4 nhỏ, gắn vào `src/app/layout.tsx`, gated theo
  `NEXT_PUBLIC_GA_ID`.

## Risks
- Nội dung trang pháp lý là placeholder — launch thật cần OWNER tự thay nội
  dung, không phải nội dung pháp lý có hiệu lực thật do AI viết. Phải nói rõ
  trong DoD, không được coi placeholder là "xong".
- SEO/JSON-LD viết sai schema.org có thể khiến Google Rich Results reject
  thầm lặng — nên test qua Rich Results Test sau khi implement (thủ công,
  ngoài phạm vi automated test).
- `blog_posts.content` dạng text thô (không WYSIWYG) — OWNER phải tự viết
  HTML/markdown cơ bản; nếu OWNER thấy khó dùng, cân nhắc thêm thư viện
  markdown editor ở Phase 8, không phải bây giờ.

## Checklist

### Trước khi giao Codex
- [ ] Rà soát code hiện có trước khi lập kế hoạch (đã làm ở trên)
- [ ] Chốt schema `blog_posts`/`blog_categories` với OWNER (mục Quyết định
      #1 ở trên) — đặc biệt xác nhận bỏ bảng tag riêng có chấp nhận được
      không
- [ ] Chốt nội dung placeholder cho trang pháp lý có cần OWNER cung cấp
      trước hay để AI viết tạm
- [ ] Ask AI for challenge trước khi implement (Step 3 `PHASE_START_PROTOCOL.md`)

### Tests
- [ ] Test `listPublishedPosts`/`getPublishedPostBySlug` chỉ trả bài
      `PUBLISHED` và `published_at <= now()`, không trả `DRAFT`
- [ ] Test `blogPostInputSchema` reject slug trùng, reject input không hợp
      lệ
- [ ] Test `/sitemap.xml` chỉ liệt kê nội dung công khai (không có route
      admin)
- [ ] Test admin blog CRUD yêu cầu `requireAdmin` giống pattern
      `phase-3-route-auth.test.ts`
- [ ] Chạy lại toàn bộ test hiện có — xác nhận không regression

### Pre-delivery (UI mới)
- [ ] `cursor-pointer` cho mọi phần tử có thể click
- [ ] Hover/focus state theo pattern component dùng chung
- [ ] Ảnh có `alt` text (SEO + a11y)

## Definition of Done
- Google/Rich Results Test đọc được JSON-LD `Product` và `BlogPosting` hợp
  lệ trên trang sản phẩm và trang blog.
- `/sitemap.xml`, `/robots.txt` trả về đúng nội dung, không lộ route admin.
- OWNER đăng được 1 bài blog thật từ `/admin/blog`, bài hiện đúng ở `/blog`
  và `/blog/[slug]` với metadata/OG đúng.
- Trang 404 tùy chỉnh hiển thị khi truy cập route không tồn tại.
- Trang pháp lý tồn tại (nội dung placeholder, OWNER biết cần thay trước
  launch thật — ghi rõ trong risk/handoff, không tự nhận là "xong" pháp lý
  thật).
- `npm test` + build pass, không regression Phase 3–6.
- Checklist "Launch" hạ tầng (production DB/backup/domain/SSL/GA4 account/
  Search Console) được bàn giao cho OWNER như một danh sách riêng, không
  tính vào DoD code.
