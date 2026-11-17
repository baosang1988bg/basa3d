# Phase 56 — Hardening sau review bảo mật & pháp lý (phần làm được trong code)

**Status:** đã merge vào `dev` (2026-11-17); build Next 15.5.29 + test trên bản cài sạch xem cuối file — chờ OWNER `npm install` trên máy mình + xem trang chính sách; **nội dung pháp lý cần OWNER/luật sư duyệt trước khi lên Production**.
**Owner:** Claude (implement theo yêu cầu OWNER), OWNER (review, merge, việc hạ tầng bên dưới).
**Trigger:** review dự án 2026-11-17 (bảo mật, DDoS, crawl, pháp lý). OWNER loại 2 mục: **không tắt** route `makerworld-cn/download`, **không làm** hết hạn đơn NEW.

## Quyết định

| # | Quyết định | Lý do / trade-off |
|---|---|---|
| D1 | `next` 15.5.27 → **15.5.29**, `fast-xml-parser` 5.11.1 → 5.12.1. Chỉ sửa `package.json` + `package-lock.json` (`--package-lock-only`); **OWNER chạy `npm install`**. `zod` (high) **chưa nâng**. | `npm audit`: GHSA-2464-fhr4-w9xw (critical, Image Optimization + SVG), GHSA-p3m5-59mp-jv5r (DoS Server Actions). Zod cần lên bản 4 (breaking, đụng toàn bộ `domain/schemas.ts`) → phase riêng. Sandbox không cài được node_modules bản macOS. |
| D2 | `/blog` và `/blog/[slug]` đọc qua `unstable_cache` (`src/lib/cache/blog-cache.ts`, TTL 60s, tag `blog-public`); action admin blog gọi `invalidateBlogCache()`. Trang vẫn `force-dynamic` (không cần DB lúc build). Slug sai định dạng trả 404 không chạm DB. | Trước đây mỗi request ẩn danh là 1 query, không rate limit. Cùng pattern Phase 42. Trade-off: bài hẹn giờ hiện trễ tối đa 60s. |
| D3 | `/sitemap.xml` nhớ danh sách slug 10 phút bằng biến module (không dùng `unstable_cache`). | 2 lần quét toàn bảng mỗi request. Biến module để `sitemap()` vẫn gọi trực tiếp được trong test. Trade-off: mỗi instance serverless có bản nhớ riêng; sản phẩm mới vào sitemap trễ ≤ 10 phút. |
| D4 | `/products`: lọc tham số URL trước khi tới DB (`src/lib/catalog/listing-params.ts`) — `q` ≤ 80 ký tự, `categoryId` phải là UUID, `type` theo whitelist, `page` ≤ 500. `listStorefrontProducts` escape `% _ \` trong ILIKE. | `categoryId` rác gây lỗi cast (500); `q=%%%%` khớp mọi sản phẩm qua quét chậm. |
| D5 | Link gửi khách (xác nhận đơn, link báo giá copy sang Zalo) dùng `publicSiteUrl()` = `NEXT_PUBLIC_SITE_URL`, thay cho `https://basa3d.vn` viết cứng ở 3 chỗ. Không set env thì giữ giá trị cũ. | `.envv` Production đang là `basain3d.com` → link báo giá **kèm token** đang trỏ sang domain khác. Nếu `basa3d.vn` không thuộc OWNER thì đây là rò token. |
| D6 | Chính sách bảo mật (vi + en): thêm dữ liệu kỹ thuật, danh sách bên xử lý **đúng theo code** (Supabase, Vercel/Netlify, Google Analytics, Gemini cho ảnh chụp màn hình, đơn vị vận chuyển), lưu trữ ngoài VN, lưu giữ, quyền của khách. Footer: bỏ "Bảo mật tuyệt đối". | Luật BVDLCN 91/2025/QH15 (hiệu lực 1/1/2026). Không nêu Telegram/Resend vì thông báo staff chỉ chứa mã đơn (`send-staff-notification.ts`). **Không bịa**: không ghi số ngày lưu giữ/thời hạn phản hồi vì OWNER chưa quyết. |
| D7 | Footer hiện tên chủ thể · MST · địa chỉ khi có `NEXT_PUBLIC_BUSINESS_NAME / _TAX_ID / _ADDRESS`; để trống thì ẩn. | Luật TMĐT 122/2025/QH15 (hiệu lực 1/7/2026). Claude không có các thông tin này. |

## Slices
- [x] D1 dependency (lockfile)
- [x] D2 blog cache + invalidation ở `blog/actions.ts`, `blog/review/actions.ts`
- [x] D3 sitemap memo
- [x] D4 listing params + escape ILIKE
- [x] D5 `src/config/site-url.ts` + 3 chỗ dùng
- [x] D6 `messages/{vi,en}.json`, `privacy-policy/page.tsx`
- [x] D7 `site.ts`, `footer.tsx`, `.env.example`
- [x] Sửa `tests/phase-28-admin-pagination.test.ts:73` (fail từ Phase 54.2: thiếu `blogDrafts`)
- [x] `tests/phase-56-hardening.test.ts`

## Evidence (2026-11-17, sandbox Linux arm64, Node 22.23)
- `npx tsc --noEmit`: 0 lỗi ngoài `.next*/types` cũ. `npx eslint src tests/phase-56-*.ts`: sạch. `check:arch`: 6/6.
- `npm audit --omit=dev` sau khi sửa lockfile: còn **1** (zod, high); trước đó 3 (1 critical).
- PostgreSQL thật (embedded, 33 migration), 11 file / 83 test → **77 pass**:
  - `tests/phase-56-hardening.test.ts` 9/9 (gồm 2 test DB: `%`/`_` là ký tự thường; sitemap gọi lần 2 không đọc DB).
  - `phase-28-admin-pagination` (đã sửa), `phase-7-sitemap`, `phase-18-i18n-message-parity`, `phase-42-storefront-cache`, `ai-news`, `phase-37`, `phase-43`, `header-category-dropdown`: pass.
  - **6 fail không do phase này:** 4 test DB trong `tests/blog-review.test.ts` báo `Cannot use a pool after calling end on the pool` — chạy trên `dev` nguyên bản cũng fail y hệt với runner này (chưa tìm nguyên nhân); 2 test Storage trong `tests/phase-7-blog.test.ts` cần Supabase local ở `127.0.0.1:54321` (sandbox không có).
- **Chưa làm được:** `npm install` (binary macOS), `next build`, `npm test` qua runner chính thức, Playwright, xem trang trên trình duyệt. **`unstable_cache` của blog chưa được chạy thật trong Next** — mới kiểm bằng typecheck + đối chiếu với `storefront-cache.ts`.

## OWNER cần làm
1. `git checkout fix/phase-56-security-legal-hardening && npm install && rm -rf .next .next-test && npm run check:agent && npm run build`.
2. Mở `/blog`, một bài blog, `/sitemap.xml`, `/products?q=%25%25`, `/privacy-policy` (vi + en).
3. **Xác nhận domain:** `NEXT_PUBLIC_SITE_URL` trên Production đúng domain đang chạy; kiểm tra `basa3d.vn` có thuộc mình không. Nếu không, các link báo giá đã gửi trước đây trỏ sang domain đó.
4. Điền `NEXT_PUBLIC_BUSINESS_NAME / _TAX_ID / _ADDRESS` trên Vercel/Netlify.
5. Đọc lại chính sách bảo mật; bổ sung thời hạn lưu giữ và thời hạn phản hồi yêu cầu theo quyết định của bạn (nên hỏi luật sư).

## Chưa làm — cần OWNER hoặc phase riêng
- **Tách DB dev khỏi Production + rotate key** (`.env` và `.envv` cùng một Supabase project) — việc hạ tầng.
- **Cloudflare/WAF + Turnstile** — cần tài khoản và site key; khi bật phải đổi `getClientIp` sang `cf-connecting-ip` và thêm domain vào CSP.
- **CSP đang Report-Only** — chuyển sang enforce cần xem report thật trên trình duyệt.
- **MFA admin**, **nâng zod 4**, **banner đồng ý cho Google Analytics**, **trang Điều khoản dịch vụ**, **robots cho AI crawler** (quyết định kinh doanh).
- Bộ keycap nhân vật có bản quyền, cơ sở "in giúp cá nhân" cho mẫu MakerWorld NC, ảnh hotlink ở blog AI — quyết định pháp lý của OWNER.
- Theo yêu cầu OWNER: giữ nguyên route `makerworld-cn/download`, không làm hết hạn đơn NEW.

## Evidence bổ sung sau khi merge vào `dev` (2026-11-17, bản cài sạch trong sandbox)
Clone `dev` đã merge Phase 55 + 56 sang thư mục riêng, `npm ci` (binary Linux), rồi chạy:
- `npm run lint`, `npm run typecheck`, `npm run check:arch`: **xanh** (typecheck sạch hoàn toàn khi không có `.next*/types` cũ).
- `next build` với **Next 15.5.29**: **thành công**. Google Fonts bị chặn mạng trong sandbox nên build dùng font giả lập qua `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` — chỉ ảnh hưởng file font, không đụng code.
- `next start` + PostgreSQL thật, gọi thử: `/home`, `/products`, `/products?q=%25%25%25&categoryId=not-a-uuid&type=X&page=abc` (200, trước đây 500), `/blog`, `/blog/<slug không có>`, `/sitemap.xml`, `/robots.txt`, `/privacy-policy`, `/en/privacy-policy`, `/admin/dashboard` (307 → `/admin/login`), `/api/version` — không có lỗi trong log server.
- Toàn bộ 132 file test theo đúng lệnh của `tests/helpers/test-runner.ts` (server đang chạy): **962 test, 929 pass, 19 skip, 14 fail**.
- **14 fail đều có sẵn trên `dev` gốc (`223af23`)** — đã build và chạy lại đúng các file đó trên bản gốc, ra y hệt: `ai-news` (6, `syncDaily3DNews`/`claimManualNewsSync`), `blog-review` (4), `makerworld-estimate` (1, "look-alike URLs"), `phase-15-staff-notification-failure` (1), `stl-import-cli` (2). Chưa điều tra nguyên nhân; một phần có thể do sandbox không có Supabase local/Chrome.
- **Phát hiện thêm:** trên `dev` gốc `npm ci` **thất bại** (`Missing: @swc/helpers@0.5.24 from lock file`) — lockfile lệch `package.json`. Lockfile mới của Phase 56 đã đồng bộ lại, `npm ci` chạy được.
- **Vẫn chưa làm được:** Playwright E2E (cần trình duyệt + Supabase Auth) và nhìn UI bằng mắt (nav mobile, trang chi tiết sản phẩm). Admin sau đăng nhập chưa được render thử vì không có Supabase Auth trong sandbox.
