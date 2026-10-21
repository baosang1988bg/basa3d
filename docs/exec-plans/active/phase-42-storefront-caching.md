# Phase 42 — Cache trang storefront tĩnh (Home, policy, tools) + data cache catalog

> Yêu cầu OWNER (2026-10-21): "cache lại các trang static như home, đâu cần reload".
> Người làm: Claude (OWNER yêu cầu implement trực tiếp). ADR-0045.

## Brief (Step 1)
- **Goal:** Home và các trang không phụ thuộc request (policy, tools, custom-print) được render một lần rồi tái sử dụng
  (ISR), không còn query DB mỗi request; quay lại Home bằng `<Link>` không phải chờ server render lại.
- **Non-goals:** cache cart/checkout/order-confirmation/quotes/bao-gia (đọc headers/rate-limit, dữ liệu riêng từng khách);
  cache admin; blog (để follow-up, đang `force-dynamic` có chủ đích); đổi DB/migration; CDN/edge config ngoài Next.
- **Inputs:** `src/app/layout.tsx` (gọi `getLocale()` → ép toàn app dynamic), Home `force-dynamic`,
  `storefront-catalog.service.ts`, `product.service.ts`, `inventory.service.ts`, `order.service.ts`.
- **Outputs:** root layout pass-through; `<html>` render ở `[locale]/layout.tsx`, `admin/layout.tsx`, `not-found.tsx`;
  `src/lib/cache/storefront-cache{,-tags}.ts` (data cache + invalidation); Home `revalidate = 60`.
- **Risks:** xem mục Rủi ro.
- **DoD:** xem cuối file.

## Hiện trạng (đọc code 2026-10-21)
| Vấn đề | Chỗ | Hệ quả |
|---|---|---|
| Root layout gọi `getLocale()` (đọc header của middleware) | `src/app/layout.tsx` | **Mọi** route bị dynamic, kể cả 4 trang policy và 7 trang tools vốn tĩnh 100% |
| `export const dynamic = 'force-dynamic'` | Home | 2 query Postgres mỗi request; Router Cache phía client không giữ được trang |
| `react.cache()` trong service | storefront-catalog | Chỉ dedupe trong 1 request, không giữa các request |
| `revalidatePath('/products')` | `admin/(protected)/product-inventory/actions.ts` | Route thật là `/[locale]/products` → gần như chắc chắn không khớp; hiện vô hại vì trang dynamic, sẽ thành bug khi bật cache |
| Build không được cần DB | comment ở Home + `sitemap.ts` | Không thể prerender Home lúc `next build` |

## Quyết định (Step 2 — freeze; cập nhật sau khi verify)
1. **Root layout pass-through** (pattern chính thức của next-intl): `app/layout.tsx` chỉ `return children` + giữ
   `metadata`. `<html>/<body>` (fonts, theme script, GA) chuyển vào component dùng chung `HtmlShell`, render ở:
   - `app/[locale]/layout.tsx` với `lang={locale}` lấy từ **params** (không đọc header → static được);
   - `app/admin/layout.tsx` (mới) với `lang="vi"`;
   - `app/not-found.tsx` với `lang="vi"`.
   Không dùng multiple-root-layouts (đổi cấu trúc thư mục lớn hơn, chuyển admin ↔ storefront thành full reload).
2. **Prerender cả 2 locale lúc build** (`generateStaticParams` giữ `routing.locales`). ~~Ban đầu định trả `[]`~~ —
   bị loại khi verify: URL VI đi qua **middleware rewrite** (`/privacy-policy` → `/vi/privacy-policy`) và `next start`
   chỉ trả từ cache cho path rewrite **đã prerender**; ISR on-demand thuần bị render lại mỗi request (đã đo: `no-store`,
   không ghi file cache).
3. **Home**: `export const revalidate = 60` (literal ở cả `page.tsx` và `home/page.tsx`). Build **không có/không tới
   được DB** thì `loadHomeCatalog()` gọi `connection()` khi `NEXT_PHASE === 'phase-production-build'` → riêng build đó
   Home quay về render mỗi request như trước Phase 42, build vẫn xanh. Build có DB (Vercel) → Home là ISR.
4. **next-intl static rendering**: Next render layout và page **song song**, nên mọi layout/page/generateMetadata cần
   static phải gọi `applyRequestLocale(params)` (`src/i18n/request-locale.ts`): `(storefront)/layout` (Footer dùng
   `useTranslations`), `(tools)/layout`, `custom-print/layout`, Home, 4 trang policy, `tools`, `tools/keychain-generator`.
5. **Root not-found không được đọc request**: Next serialize boundary này vào **mọi** trang; `useTranslations` ở đó đã
   làm cả storefront dynamic (tìm ra bằng trace `headers()` lúc build). Giải pháp: server component chỉ truyền cả 2 bộ
   message `notFound` (vi/en) cho client component `NotFoundContent`, chọn ngôn ngữ theo URL **sau khi mount** (tránh
   hydration mismatch vì mọi URL lạ dùng chung trang `/_not-found` prerender bằng `vi`).
6. **Data cache**: `unstable_cache` bọc `listStorefrontProducts`, `listCategories`, `getStorefrontProductBySlug` trong
   `src/lib/cache/storefront-cache.ts`, tag `storefront-catalog`, `revalidate: 60`. **Service giữ nguyên thuần**.
   Không cache: search tự do, trang > 5, slug không tồn tại (giới hạn số key — tránh bị bơm cache).
   `/products` (searchParams) và `/products/[slug]` vẫn render dynamic nhưng dữ liệu lấy từ cache.
7. **Invalidation ở tầng service, sau commit** (`src/lib/cache/storefront-cache-tags.ts`, tách riêng để service import
   không tạo vòng import): `invalidatesStorefrontCatalog(withTransaction(...))` trong
   `createCategory, createProduct, updateProduct, deleteProduct, createVariant, updateVariant, deleteVariant,
   uploadProductImage, deleteProductImage, recordInventoryMovement, updateOrderStatus`; `createOrder` gọi sau commit,
   bỏ qua replay. Một chỗ chặn cho cả server action **và** API route. Best-effort, không throw; TTL 60s là lưới an toàn.
8. **Không bật `experimental.staleTimes.dynamic`**: sẽ làm admin hiển thị số liệu tồn kho/đơn cũ sau khi điều hướng.
   Home static đã được Router Cache mặc định (static 5 phút) giữ khi quay lại.
9. Xoá 3 lệnh `revalidatePath('/products')` (không khớp route `/[locale]/products`).

## Rủi ro
- **Data integrity:** badge "còn hàng" ở Home/listing có thể cũ tối đa 60s nếu một đường ghi bị sót invalidation.
  Chỉ là hiển thị — `order.service.createOrder` vẫn khoá variant + `assertAvailableStock` lúc ghi. Không ảnh hưởng tiền/kho.
- **Build có `DATABASE_URL` nhưng DB không tới được**: chờ timeout kết nối (30s) rồi Home thành dynamic cho build đó.
- **404 tiếng Anh**: HTML server là tiếng Việt, đổi sang EN sau khi JS chạy (trước đây SSR đúng EN). Chấp nhận.
- **Mọi trang** mang thêm ~0,5 KB message 404 (vi+en) trong RSC payload.
- Cache trên `next start` nhiều instance cần cache handler chung; hiện deploy Vercel (Data Cache dùng chung) → không áp dụng.

## Lát cắt
- [x] A. Root layout pass-through + `HtmlShell` + `admin/layout.tsx` + `not-found.tsx` + `NotFoundContent`.
- [x] B. `src/lib/cache/storefront-cache{,-tags}.ts` + invalidation sau commit trong 3 service + bỏ `revalidatePath('/products')`.
- [x] C. Home/products/product-detail dùng wrapper; Home `revalidate = 60` + fallback build không DB; `applyRequestLocale`.
- [x] D. Tests: `tests/phase-42-storefront-cache.test.ts` (10 test: helper, giới hạn key, contract layout/not-found/Home,
      mọi hàm ghi đều invalidate).
- [x] E. Docs: ADR-0045, roadmap.

## Kết quả verify (Claude, 2026-10-21, sandbox Linux, bản copy repo)
- `tsc --noEmit` ✅ · `eslint .` ✅ · toàn bộ `tests/*.test.ts` không DB: **393 pass / 0 fail / 159 skip** (skip = cần DB).
- `next build` **không `DATABASE_URL`** ✅ (Google Fonts được mock vì sandbox không ra mạng). 37 trang prerender
  (4 policy, tools ×9, custom-print, cart, checkout × 2 locale); Home tự quay về dynamic.
- `next build` **có DB** (Postgres giả lập PGlite, schema tối thiểu): `/vi`, `/en`, `/vi/home`, `/en/home` prerender, `revalidate 60`.
- `next start` + DB:
  - `/home` & `/en/home`: `x-nextjs-cache: HIT` (cả URL VI qua rewrite).
  - Sửa DB trực tiếp (không invalidate) → vẫn HIT dữ liệu cũ; sau 62s → `STALE` rồi `HIT` dữ liệu mới (ISR đúng).
  - Gọi `invalidatesStorefrontCatalog(...)` trong route handler (route probe tạm, chỉ ở bản copy) → request kế tiếp
    `MISS` với dữ liệu mới ngay, rồi `HIT`.
- `/admin/login`, `/privacy-policy`, `/en/tools`, 404: đúng 1 thẻ `<html>`, `lang` đúng, còn favicon + `og:image`.

## Definition of Done
- [x] typecheck, lint, test (phần không cần DB) xanh.
- [x] `next build` không có `DATABASE_URL` thành công; build có DB → Home `●` ISR 60s.
- [ ] OWNER smoke trên Vercel Preview: sửa sản phẩm featured ở admin → Home cập nhật ngay; `/khong-ton-tai` và
      `/en/khong-ton-tai` ra trang 404 có style; chuyển admin ↔ storefront bình thường; DevTools → Network: quay lại Home
      bằng menu không gọi lại server (trong 5 phút).
- [ ] `npm test` có `TEST_DATABASE_URL` + E2E `storefront`, `checkout`, `i18n` trên máy OWNER.
