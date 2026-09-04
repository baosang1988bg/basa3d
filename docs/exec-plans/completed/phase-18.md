# Phase 18 — Storefront i18n (VI/EN, VI mặc định)

> **Mục đích**: Khách quốc tế hiện không đọc được storefront (100% tiếng Việt, không có bản dịch).
> Phase 18 thêm hạ tầng đa ngôn ngữ cho **storefront public** (không đụng admin), tiếng Việt vẫn là
> ngôn ngữ mặc định (URL không prefix), tiếng Anh là lựa chọn phụ (`/en/...`). Đây là phase hạ tầng
> + slice nội dung đầu tiên (nav/footer/trang chủ/danh sách & chi tiết sản phẩm + 4 trang policy) — các
> trang giao dịch phức tạp còn lại (cart/checkout/custom-print/blog/quotes) để phase sau, theo AGENTS.md #10.

---

## 1. Rà soát hiện trạng

- Không có thư viện i18n nào trong `package.json` hiện tại. Toàn bộ UI string trong
  `src/app/(storefront)/**`, `src/components/storefront/**` là tiếng Việt hard-code.
- Cấu trúc route hiện tại: `src/app/(storefront)/*` (route group, không prefix), `src/app/admin/**`
  (route riêng, đã có `(auth)`/`(protected)`), `src/app/api/**`. `src/app/layout.tsx` là root layout
  dùng chung cho cả 3 nhánh — set `<html lang="vi">`, load font, `<GoogleAnalytics />`.
  `src/app/(storefront)/layout.tsx` bọc `Header`/`Footer`/`CartProvider`/`ZaloFloatingButton`.
- `src/app/sitemap.ts` liệt kê các route public tĩnh + động (product slugs, blog slugs) — chỉ 1
  locale hiện tại. `src/app/robots.ts` disallow `/admin`, `/api`, allow còn lại.
- Dữ liệu sản phẩm/category (tên, mô tả) lấy trực tiếp từ DB, không có cột đa ngôn ngữ — **ngoài
  phạm vi phase này** (xem Non-goals).
- **[Đã rà soát & chốt kiến trúc]** Project **đã có sẵn** `middleware.ts` ở root — matcher
  `['/admin/:path*']`, gọi `updateSession()` (`src/lib/supabase/middleware.ts`) để refresh Supabase
  session cookie + redirect `/admin/login` khi chưa đăng nhập. Sau Gemini challenge, 2 middleware
  được gộp chung vào 1 file duy nhất bằng cơ chế **Path Branching độc lập** (không wrap/chain).

---

## 2. Goal & Non-goals

### Goal
1. Storefront public hỗ trợ 2 ngôn ngữ: **VI (mặc định, không prefix)** và **EN (`/en/...`)**, dùng
   `next-intl` cho routing + message catalog + `useTranslations`/`getTranslations`.
2. Admin (`/admin/**`) và toàn bộ `/api/**` **hoàn toàn không đổi** — không có locale prefix, không
   qua middleware locale, không bọc `NextIntlClientProvider`.
3. Có nút chuyển ngôn ngữ ở `Header`, giữ đúng path hiện tại khi đổi locale (vd. đang ở
   `/products/moc-khoa-1` bấm sang EN ra `/en/products/moc-khoa-1`), nhớ lựa chọn qua cookie
   `NEXT_LOCALE` cho lần ghé sau.
4. SEO: `alternates.languages` (hreflang) cho từng trang có bản dịch, `sitemap.ts` liệt kê cả 2
   locale cho mỗi route tĩnh/động.
5. Slice nội dung đầu tiên được dịch đầy đủ VI/EN: `Header`, `Footer`, trang chủ (`/`), danh sách
   sản phẩm (`/products`), chi tiết sản phẩm (`/products/[slug]`), và **4 trang chính sách tĩnh**
   (`privacy-policy`, `shipping-policy`, `return-policy`, `file-confidentiality-policy`).
6. Các trang giao dịch phức tạp chưa dịch (`cart`, `checkout`, `custom-print`, `blog`, `quotes`) vẫn
   truy cập được qua `/en/...` nhưng có component thông báo tinh tế (`<UntranslatedNotice />`) báo rõ
   nội dung đang tạm thời hiển thị bằng tiếng Việt để đảm bảo trải nghiệm tin cậy cho khách quốc tế.

### Non-goals
- **Không dịch admin** — nội bộ, chỉ dùng tiếng Việt, giữ nguyên toàn bộ.
- **Không thêm cột/bảng dịch cho dữ liệu động** (tên/mô tả sản phẩm, category, blog content) — chỉ
  dịch UI string tĩnh. Tên/mô tả sản phẩm hiển thị nguyên bản ở cả 2 locale.
- **Không dịch các luồng giao dịch/tương tác phức tạp trong phase này**: `cart`, `checkout`,
  `custom-print`, `blog`, `order-confirmation`, `quotes/[quoteNumber]`. Các trang này sẽ được dịch
  toàn diện ở phase kế tiếp.
- **Không đổi cơ chế xác thực/route-auth của admin hay bất kỳ route API nào.**

---

## 3. Quyết định kỹ thuật (Đã chốt sau Gemini Challenge)

1. **Thư viện**: `next-intl` (App Router, hỗ trợ server + client component, middleware routing sẵn
   có) — thêm 1 dependency mới, lý do cụ thể: chuẩn hóa toàn bộ routing/redirect `as-needed`,
   `generateStaticParams`, `setRequestLocale` (SSG), type-safe messages mà không cần duy trì 300+
   dòng code tự viết (đúng AGENTS.md #8).
2. **Cấu trúc route**: chuyển `src/app/(storefront)/*` (kể cả `page.tsx` trang chủ) vào
   `src/app/[locale]/(storefront)/*`. `src/app/admin/**` và `src/app/api/**` giữ nguyên vị trí,
   nằm ngoài segment `[locale]` — không bị ảnh hưởng.
3. **Middleware [Đã triển khai, vị trí sửa so với bản nháp]**: gộp logic `next-intl`
   (`createMiddleware`, `locales: ['vi', 'en']`, `defaultLocale: 'vi'`, `localePrefix: 'as-needed'`,
   **`localeDetection: false`**) vào **cùng 1 file** cạnh `updateSession()` theo mô hình **Path
   Branching độc lập**:
   - File này nằm ở **`src/middleware.ts`** (không phải `middleware.ts` ở root như bản nháp ban
     đầu) — Next.js tìm middleware cạnh `src/app` khi project dùng thư mục `src/`, không phải ở
     repo root.
   - `matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']`
   - `pathname.startsWith('/admin')` $\rightarrow$ gọi `updateSession(request)` (không qua next-intl).
   - Còn lại $\rightarrow$ gọi `intlMiddleware(request)`.
   - `/api` tự động bypass qua matcher.
   - Đảm bảo storefront không bị dính latency của Supabase auth và admin không bị rewrite locale.
   - **`localeDetection: false`** (phát hiện khi viết E2E test): next-intl mặc định tự suy ra
     locale từ header `Accept-Language` của trình duyệt — nếu bật, một khách dùng trình duyệt tiếng
     Anh sẽ tự động thấy `/` bằng EN, trái với yêu cầu "VI luôn là mặc định". Tắt detection để `/`
     luôn là VI bất kể ngôn ngữ trình duyệt; khách chỉ chuyển sang EN khi bấm `LanguageSwitcher`.
4. **Root layout** (`src/app/layout.tsx`): chuyển thành async, dùng `getLocale()` từ
   `next-intl/server` để set `<html lang={locale}>` (fallback `vi` khi request không qua middleware
   locale, tức toàn bộ admin/api). Giữ nguyên font/GA hiện tại. Thêm `src/app/[locale]/layout.tsx`
   bọc `NextIntlClientProvider` quanh `StorefrontLayout` hiện có.
5. **Message files**: `messages/vi.json`, `messages/en.json` ở repo root, namespace theo khu vực
   (`nav`, `footer`, `home`, `products`, `policies`, `common`, ...). `next.config.ts` bọc `createNextIntlPlugin()`.
6. **Language switcher [Đã triển khai, khác bản nháp]**: client component trong `Header`, dùng
   `usePathname`/`getPathname` locale-aware của next-intl để tính href sang locale còn lại giữ
   nguyên path — nhưng render bằng thẻ **`<a>` thường (full page navigation)**, không phải
   `router.replace()` của next-intl như bản nháp ban đầu. Lý do (phát hiện khi viết E2E test):
   `<html lang>` nằm ở root layout, **ngoài** segment `[locale]` — layout đó không re-render khi
   chuyển trang bằng client-side soft navigation giữa 2 locale, chỉ full navigation mới chạy lại
   middleware + root layout với locale mới. Đổi ngôn ngữ là thao tác không thường xuyên nên chấp
   nhận full reload để đảm bảo đúng. Lưu lựa chọn qua cookie `NEXT_LOCALE` mặc định của next-intl.
7. **SEO**: `generateMetadata` các trang trong slice 1 thêm `alternates.languages`. `sitemap.ts`
   sinh 2 entry (vi/en) cho mỗi route tĩnh + động hiện có. `robots.ts` không đổi.
8. **Untranslated Fallback Notice**: Tạo component `<UntranslatedNotice />` hiển thị banner ngắn
   ở đầu các trang chưa dịch khi `locale === 'en'` để minh bạch ngữ cảnh với người dùng.

---

## 4. Kế hoạch triển khai theo Slices

### Slice 1: Hạ tầng routing/middleware & components dùng chung
- [x] Cài `next-intl`.
- [x] Tạo `messages/vi.json`, `messages/en.json` (khung namespace rỗng/placeholder).
- [x] `next.config.mjs`: bọc `createNextIntlPlugin()`.
- [x] Sửa `src/middleware.ts` gộp `updateSession()` và `intlMiddleware()` bằng Path Branching.
- [x] Di chuyển `src/app/(storefront)/**` vào `src/app/[locale]/(storefront)/**`. Cập nhật import.
- [x] Thêm `src/app/[locale]/layout.tsx` (bọc `NextIntlClientProvider`, `setRequestLocale`).
- [x] Sửa `src/app/layout.tsx` thành async, set `lang` động qua `getLocale()`.
- [x] Tạo component `<UntranslatedNotice />` và gắn vào layout/page của `cart`, `checkout`,
  `custom-print`, `blog`, `quotes` (qua `layout.tsx` riêng từng route, vì `UntranslatedNotice` là
  server component còn `cart`/`checkout` là client component — không import trực tiếp được).
- [x] Verify: `/admin/**`, `/api/**` build & chạy y hệt trước phase (không prefix, không đổi behavior).

### Slice 2: Language switcher + SEO
- [x] Component `LanguageSwitcher` trong `Header`.
- [x] `alternates.languages` cho các trang trong slice nội dung (home, products, 4 policy pages).
- [x] `sitemap.ts`: sinh 2 locale variant mỗi route tĩnh/động.

### Slice 3: Dịch nội dung slice đầu tiên
- [x] `Header`, `Footer`: toàn bộ string qua `useTranslations`.
- [x] Trang chủ (`/`).
- [x] `/products` (danh sách + filter/search UI string).
- [x] `/products/[slug]` (UI string: nút, label, breadcrumb — **không** dịch tên/mô tả DB).
- [x] 4 trang chính sách: `privacy-policy`, `shipping-policy`, `return-policy`, `file-confidentiality-policy`.
- [x] Điền đầy đủ nội dung VI + EN vào `messages/vi.json` / `messages/en.json` cho các namespace trên.

### Slice 4: Test guard cho message files
- [x] `tests/phase-18-i18n-message-parity.test.ts`: kiểm tra `vi.json`/`en.json` cùng tập key +
  cùng độ dài các mảng (`categories`, `workflowSteps`, `faq`, `heroValueProps`).

### Slice 5: Verification & Tests
- [x] Playwright E2E (`e2e/i18n.spec.ts`): mở `/`, đổi sang EN qua switcher $\rightarrow$ URL thành `/en`,
  `<html lang>` và string đổi $\rightarrow$ quay lại VI $\rightarrow$ URL về `/` (không prefix).
- [x] Playwright E2E / Route tests (`e2e/i18n.spec.ts`):
  - Unauthenticated `GET /admin/dashboard` $\rightarrow$ redirect về `/admin/login`.
  - `GET /en/admin/dashboard` $\rightarrow$ 404 (admin không đi qua locale routing).
  - `/en/cart` hiển thị đúng `<UntranslatedNotice />`.
  - `GET /api/products` không bị redirect/rewrite, trả 200 bình thường.
- [x] `npm test` (171/171 pass), `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
  Playwright full suite: 18/20 pass — 2 fail (`checkout.spec.ts`) là do thiếu biến môi trường
  `ORDER_CONFIRMATION_SECRET` trong `.env` cục bộ (pre-existing, không liên quan Phase 18 — xác
  nhận bằng cách kiểm tra `.env`/`next/env` trước khi sửa bất kỳ file nào của Phase 18).

### Slice 6: Documentation
- [x] Cập nhật `docs/roadmap.md` (thêm dòng Phase 18, ghi rõ phạm vi trang đã dịch).
- [x] Ghi chú trong `docs/architecture/decisions.md` (ADR-0029): chọn `next-intl`, `localePrefix:
  as-needed`, `localeDetection: false`, Path Branching middleware (tại `src/middleware.ts`),
  LanguageSwitcher dùng full navigation, dịch 4 trang policy + gắn notice banner cho trang deferred.

---

## 5. Risks & Mitigations

- **Di chuyển route vào `[locale]` làm vỡ admin/api do matcher cấu hình sai**: Slice 1 verify riêng
  admin/api trước khi sang slice nội dung; matcher middleware loại trừ tường minh `api`, `_next`, static.
- **SEO bị phạt duplicate content nếu thiếu hreflang**: Slice 2 làm `alternates.languages` đồng thời
  với switcher, không tách rời.
- **Message key lệch giữa 2 locale gây string rỗng/lỗi runtime**: Slice 4 có test guard tự động,
  chạy trong CI như các test khác.
- **Khách vào `/en/cart` hoặc `/en/checkout` thấy lẫn lộn ngôn ngữ**: Đã giải quyết bằng cách dịch
  sớm 4 trang policy và gắn component `<UntranslatedNotice />` thông báo minh bạch cho các trang chưa dịch.

---

## 6. Checklist

### Trước khi giao Codex
- [x] Owner chốt phạm vi: chỉ storefront public, không đụng admin.
- [x] Owner chốt: chỉ dịch UI string, không thêm cột dữ liệu đa ngôn ngữ cho product/category.
- [x] Owner chốt URL strategy: VI không prefix, EN `/en/...`.
- [x] Owner chốt thư viện: `next-intl`.
- [x] Đã hoàn thành Gemini Challenge (Middleware Path Branching, mở rộng 4 trang policy, fallback notice).
- [x] Owner chốt phạm vi nội dung Phase 18: slice 1 (nav/footer/home/products list/detail/4 policies).

### Tests & Verification
- [x] Toàn bộ Slice 5 pass.
- [x] Toàn bộ test suite không regression Phase 0-17 (đặc biệt RBAC/route-auth Phase 14) — xác
  nhận qua `e2e/admin.spec.ts` (RBAC), `e2e/dashboard.spec.ts`, `e2e/pricing.spec.ts`,
  `e2e/keychain.spec.ts`, `e2e/storefront.spec.ts` đều pass sau khi di chuyển route vào `[locale]`.

### Definition of Done
1. `/` mặc định tiếng Việt, không prefix; `/en` hiển thị tiếng Anh cho nav/footer/home/products
   list/product detail và 4 trang policy.
2. `/admin/**` và `/api/**` không thay đổi hành vi, không có locale prefix.
3. Language switcher hoạt động, giữ nguyên path, nhớ lựa chọn qua cookie.
4. Banner `<UntranslatedNotice />` hiển thị đúng ở `/en/cart`, `/en/checkout`, `/en/custom-print`, `/en/blog`, `/en/quotes`.
5. `sitemap.ts` liệt kê đủ 2 locale; các trang slice 1 có `alternates.languages`.
6. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
