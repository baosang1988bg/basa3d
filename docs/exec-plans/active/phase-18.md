# Phase 18 — Storefront i18n (VI/EN, VI mặc định)

> **Mục đích**: Khách quốc tế hiện không đọc được storefront (100% tiếng Việt, không có bản dịch).
> Phase 18 thêm hạ tầng đa ngôn ngữ cho **storefront public** (không đụng admin), tiếng Việt vẫn là
> ngôn ngữ mặc định (URL không prefix), tiếng Anh là lựa chọn phụ (`/en/...`). Đây là phase hạ tầng
> + slice nội dung đầu tiên (nav/footer/trang chủ/danh sách & chi tiết sản phẩm) — các trang còn lại
> (cart/checkout/custom-print/blog/4 trang policy) để phase sau, theo AGENTS.md #10 (vertical slice).

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
- **[Phát hiện khi rà soát lại]** Project **đã có sẵn** `middleware.ts` ở root (không phải
  `src/middleware.ts`) — matcher `['/admin/:path*']`, gọi `updateSession()`
  (`src/lib/supabase/middleware.ts`) để refresh Supabase session cookie + redirect
  `/admin/login` khi chưa đăng nhập. Next.js chỉ cho phép **1 file middleware duy nhất** mỗi
  project — không thể thêm riêng `src/middleware.ts` cho next-intl như bản nháp ban đầu đã viết.
  2 middleware (auth session refresh cho `/admin`, locale routing cho storefront) phải được gộp
  chung vào 1 file. Xem quyết định #3 (đã sửa) và Question 1 trong prompt Gemini.

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
   sản phẩm (`/products`), chi tiết sản phẩm (`/products/[slug]`).

### Non-goals
- **Không dịch admin** — nội bộ, chỉ dùng tiếng Việt, giữ nguyên toàn bộ.
- **Không thêm cột/bảng dịch cho dữ liệu động** (tên/mô tả sản phẩm, category, blog content) — chỉ
  dịch UI string tĩnh. Tên/mô tả sản phẩm hiển thị nguyên bản ở cả 2 locale.
- **Không dịch các trang còn lại của storefront trong phase này**: `cart`, `checkout`,
  `custom-print`, `blog`, `order-confirmation`, `quotes/[quoteNumber]`, và 4 trang policy
  (`privacy-policy`, `shipping-policy`, `return-policy`, `file-confidentiality-policy`). Các trang
  này vẫn render được (không lỗi 404/crash) qua route `[locale]` mới, nhưng nội dung tạm thời vẫn
  chỉ có tiếng Việt kể cả khi truy cập qua `/en/...` — để dành cho phase kế tiếp.
- **Không đổi cơ chế xác thực/route-auth của admin hay bất kỳ route API nào.**

---

## 3. Quyết định kỹ thuật (đã chốt với Owner trong phiên brainstorm)

1. **Thư viện**: `next-intl` (App Router, hỗ trợ server + client component, middleware routing sẵn
   có) — thêm 1 dependency mới, lý do cụ thể: tránh tự viết lại locale-aware routing/redirect/
   `generateStaticParams`/pluralization mà next-intl đã giải quyết (đúng AGENTS.md #8).
2. **Cấu trúc route**: chuyển `src/app/(storefront)/*` (kể cả `page.tsx` trang chủ) vào
   `src/app/[locale]/(storefront)/*`. `src/app/admin/**` và `src/app/api/**` giữ nguyên vị trí,
   nằm ngoài segment `[locale]` — không bị ảnh hưởng.
3. **Middleware [TENTATIVE — cần Gemini challenge]**: gộp logic next-intl (`createMiddleware`,
   `locales: ['vi', 'en']`, `defaultLocale: 'vi'`, `localePrefix: 'as-needed'`) vào **cùng 1 file**
   `middleware.ts` ở root đang có sẵn, cạnh `updateSession()` hiện tại — vì Next.js chỉ chạy được 1
   middleware/project. Hướng đề xuất: `matcher` chung mở rộng ra toàn bộ site (bỏ giới hạn
   `/admin/:path*` cũ), trong hàm `middleware()` tự rẽ nhánh theo `pathname` — path bắt đầu
   `/admin` thì chạy `updateSession()` như cũ, còn lại chạy next-intl middleware; `/api` không chạy
   qua nhánh nào (return sớm/next()). Chưa chắc đây là cách an toàn nhất để không phá vỡ hành vi
   auth redirect hiện tại của `/admin` — xem Question 1 trong prompt Gemini.
4. **Root layout** (`src/app/layout.tsx`): chuyển thành async, dùng `getLocale()` từ
   `next-intl/server` để set `<html lang={locale}>` (fallback `vi` khi request không qua middleware
   locale, tức toàn bộ admin/api). Giữ nguyên font/GA hiện tại. Thêm `src/app/[locale]/layout.tsx`
   bọc `NextIntlClientProvider` quanh `StorefrontLayout` hiện có.
5. **Message files**: `messages/vi.json`, `messages/en.json` ở repo root, namespace theo khu vực
   (`nav`, `home`, `products`, `common`, ...). `next.config.ts` bọc `createNextIntlPlugin()`.
6. **Language switcher**: client component trong `Header`, dùng `usePathname`/`useRouter` locale-aware
   của next-intl để tính link sang locale còn lại giữ nguyên path. Lưu lựa chọn qua cookie
   `NEXT_LOCALE` mặc định của next-intl — không cần localStorage riêng.
7. **SEO**: `generateMetadata` các trang trong slice 1 thêm `alternates.languages`. `sitemap.ts`
   sinh 2 entry (vi/en) cho mỗi route tĩnh + động hiện có. `robots.ts` không đổi.

---

## 4. Kế hoạch triển khai theo Slices

### Slice 1: Hạ tầng routing/middleware (không đổi nội dung)
- [ ] Cài `next-intl`.
- [ ] Tạo `messages/vi.json`, `messages/en.json` (khung namespace rỗng/placeholder).
- [ ] `next.config.ts`: bọc `createNextIntlPlugin()`.
- [ ] Sửa `middleware.ts` (root, đã có sẵn) để gộp `updateSession()` (giữ nguyên cho `/admin`) với
  next-intl `createMiddleware` (storefront) theo hướng chốt ở Question 1 (Gemini) — không tạo file
  `src/middleware.ts` mới song song.
- [ ] Di chuyển `src/app/(storefront)/**` + `src/app/page.tsx` (nếu có) vào
  `src/app/[locale]/(storefront)/**`. Cập nhật mọi import/path liên quan (nếu route dùng
  absolute link nội bộ).
- [ ] Thêm `src/app/[locale]/layout.tsx` (bọc `NextIntlClientProvider`, `setRequestLocale`).
- [ ] Sửa `src/app/layout.tsx` thành async, set `lang` động qua `getLocale()`.
- [ ] Verify: `/admin/**`, `/api/**` build & chạy y hệt trước phase (không prefix, không đổi
  behavior) — không có regression.

### Slice 2: Language switcher + SEO
- [ ] Component `LanguageSwitcher` trong `Header`.
- [ ] `alternates.languages` cho các trang slice 3 (xem dưới).
- [ ] `sitemap.ts`: sinh 2 locale variant mỗi route tĩnh/động.

### Slice 3: Dịch nội dung slice đầu tiên
- [ ] `Header`, `Footer`: toàn bộ string qua `useTranslations`.
- [ ] Trang chủ (`/`).
- [ ] `/products` (danh sách + filter/search UI string).
- [ ] `/products/[slug]` (UI string: nút, label, breadcrumb — **không** dịch tên/mô tả sản phẩm lấy
  từ DB).
- [ ] Điền đầy đủ nội dung VI + EN vào `messages/vi.json` / `messages/en.json` cho các namespace
  trên.

### Slice 4: Test guard cho message files
- [ ] Test/script kiểm tra `vi.json` và `en.json` có cùng tập key (namespace/key set) — fail nếu
  lệch, tránh 1 locale thiếu string mà không phát hiện được.

### Slice 5: Verification & Tests
- [ ] Playwright E2E: mở `/`, đổi sang EN qua switcher → URL thành `/en`, string đổi → quay lại VI
  → URL về `/` (không prefix).
- [ ] Playwright E2E (hoặc mở rộng test hiện có): xác nhận `/admin/**` không có prefix locale, vẫn
  yêu cầu đăng nhập như cũ (không regression RBAC — Phase 14).
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.

### Slice 6: Documentation
- [ ] Cập nhật `docs/roadmap.md` (đánh dấu Phase 18 xong, ghi rõ phạm vi trang đã dịch).
- [ ] Ghi chú trong `docs/architecture/decisions.md`: chọn `next-intl`, `localePrefix: as-needed`,
  không dịch dữ liệu động, phạm vi trang slice 1.

---

## 5. Risks & Mitigations

- **Di chuyển route vào `[locale]` làm vỡ admin/api do matcher cấu hình sai**: Slice 1 verify riêng
  admin/api trước khi sang slice nội dung; matcher middleware liệt kê tường minh loại trừ
  `/admin`, `/api`.
- **SEO bị phạt duplicate content nếu thiếu hreflang**: Slice 2 làm `alternates.languages` đồng thời
  với switcher, không tách rời.
- **Message key lệch giữa 2 locale gây string rỗng/lỗi runtime**: Slice 4 có test guard tự động,
  chạy trong CI như các test khác.
- **Khách vào `/en/cart` hoặc `/en/checkout` (ngoài scope slice 1) thấy tiếng Việt lẫn trong khung
  EN**: Chấp nhận được cho v1 vì đây là giới hạn phạm vi đã thống nhất (Non-goals) — không phải
  bug, sẽ khép kín ở phase kế tiếp. Không che/chặn các trang này, chỉ đơn giản là chưa dịch.

---

## 6. Checklist

### Trước khi giao Codex
- [x] Owner chốt phạm vi: chỉ storefront public, không đụng admin.
- [x] Owner chốt: chỉ dịch UI string, không thêm cột dữ liệu đa ngôn ngữ cho product/category.
- [x] Owner chốt URL strategy: VI không prefix, EN `/en/...`.
- [x] Owner chốt thư viện: `next-intl`.
- [x] Owner chốt phạm vi nội dung Phase 18: slice 1 (nav/footer/home/products list/detail), các
  trang còn lại để phase sau.

### Tests & Verification
- [ ] Toàn bộ Slice 5 pass.
- [ ] Toàn bộ test suite không regression Phase 0-17 (đặc biệt RBAC/route-auth Phase 14).

### Definition of Done
1. `/` mặc định tiếng Việt, không prefix; `/en` hiển thị tiếng Anh cho nav/footer/home/products
   list/product detail.
2. `/admin/**` và `/api/**` không thay đổi hành vi, không có locale prefix.
3. Language switcher hoạt động, giữ nguyên path, nhớ lựa chọn qua cookie.
4. `sitemap.ts` liệt kê đủ 2 locale; các trang slice 1 có `alternates.languages`.
5. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
