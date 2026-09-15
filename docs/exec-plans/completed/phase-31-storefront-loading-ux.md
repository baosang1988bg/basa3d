# Phase 31 — Storefront/tools loading UX & request waterfalls

**Status: DONE — verify 2026-09-15 (xem "Trước khi đóng phase").**

## Brief

Owner phản ánh chuyển trang/tab trên web (storefront + `(tools)`) rất chậm và không có
animation chờ. Claude audit code (2026-09-15) xác nhận nguyên nhân cấu trúc: toàn bộ
`(storefront)`/`(tools)`/`admin/(auth)` không có `loading.tsx` nên mọi lần điều hướng
render server (bao gồm round-trip Postgres) đều hiện màn hình đứng im thay vì skeleton;
trang sản phẩm gọi `getStorefrontProductBySlug()` hai lần mỗi request vì hàm không được
bọc `React.cache()`; vài trang admin có sequential-await có thể gộp `Promise.all`; trang
chi tiết expense fetch 500 dòng để lọc lấy 1 bản ghi. Phase này chỉ xử lý các điểm có
bằng chứng code rõ ràng, không đổi hành vi nghiệp vụ, không cần đo baseline trước
(khác với dashboard SQL ở Phase 28, các fix này đúng hướng độc lập với dataset thật).

- **Goal**: mọi điều hướng storefront/tools/admin-auth hiện skeleton/loading state tức
  thì thay vì màn hình trắng; loại bỏ double-fetch trên trang sản phẩm; loại bỏ waterfall
  tuần tự không cần thiết đã xác định; loại bỏ over-fetch 500 dòng ở trang chi tiết
  expense.
- **Non-goals**: đổi `force-dynamic` sang ISR/`revalidate` cho trang chủ/blog (đánh đổi
  độ tươi dữ liệu — cần Owner xác nhận trang chủ không hiển thị tồn kho/giá cần real-time
  trước khi đổi, chờ phase riêng); tái cấu trúc `middleware.ts`/`updateSession` để bỏ
  double auth-check trên route admin (đụng chuỗi auth đã được Phase 14 RBAC baseline
  test bảo vệ — rủi ro regression bảo mật cao hơn lợi ích UX, cần review riêng nếu làm);
  redesign UI skeleton (chỉ dùng pattern skeleton đã có ở
  `admin/(protected)/loading.tsx` và `tools/keychain-generator/page.tsx` fallback, không
  thêm dependency animation mới); thêm `sizes`/`priority` cho `next/image` (ảnh hưởng LCP
  ảnh, không phải tốc độ điều hướng — theo dõi riêng nếu Owner muốn).
- **Inputs**: review Claude 2026-09-15 (nội dung trong hội thoại này — chưa có file
  riêng, xem "Trước khi giao Codex" để trích dẫn lại), `AGENTS.md`, code hiện tại.
- **Outputs**: `loading.tsx` cho `(storefront)`, `(tools)`, `admin/(auth)`;
  `getStorefrontProductBySlug` bọc `React.cache()`; `products/[slug]/page.tsx` gộp
  `listCategories` vào `Promise.all` cùng `getStorefrontProductBySlug`;
  `admin/(protected)/layout.tsx` gộp `requireAdmin()` + `getAdminNavBadges()` bằng
  `Promise.all`; `materials/[id]/page.tsx` gộp fetch spool + lịch sử dùng bằng
  `Promise.all`; `expenses/[id]/page.tsx` đổi từ fetch 500 dòng + `Array.find` sang query
  lấy đúng 1 bản ghi theo id (thêm hàm service nếu chưa có, không đổi signature
  `listExpenses` hiện tại nếu nơi khác đang dùng).
- **Risks**: `Promise.all` gộp `requireAdmin()` với hàm khác có thể làm lỗi auth bị che
  bởi lỗi khác nếu không giữ nguyên thứ tự throw ưu tiên — kiểm tra `requireAdmin()` vẫn
  throw/redirect đúng khi chưa đăng nhập ngay cả khi chạy song song; đổi
  `expenses/[id]` sang query mới có thể lệch điều kiện WHERE/role-scoping so với
  `listExpenses` gốc nếu copy thiếu — đối chiếu kỹ điều kiện lọc trước khi tách hàm;
  thêm `loading.tsx` cho route có `searchParams` (filter/pagination) cần đảm bảo skeleton
  không đứng yên vĩnh viễn nếu Suspense boundary đặt sai chỗ.
- **Definition of Done**: mọi acceptance criteria bên dưới có test xanh; typecheck/lint/
  unit pass; không regression `tests/phase-3-route-auth.test.ts` (Phase 14 RBAC
  baseline); production build (`next build && next start`) xác nhận skeleton hiện ra khi
  throttle network trên các route đã liệt kê.

## Scope

### Slice 1 — `loading.tsx` cho storefront/tools/admin-auth
- File mới: `src/app/[locale]/(storefront)/loading.tsx`,
  `src/app/[locale]/(tools)/loading.tsx`, `src/app/admin/(auth)/loading.tsx`.
- Dùng skeleton đơn giản (giữ layout chính: header/khối nội dung placeholder), tái dùng
  class Tailwind/shadcn `Skeleton` đã có trong `admin/(protected)/loading.tsx` làm mẫu,
  không cần khác nhau theo từng route con trong slice này (route-segment-level
  `loading.tsx` là đủ cho App Router, không cần 1 file/route con).

### Slice 2 — Bỏ double-fetch product detail
- File: `src/services/storefront-catalog.service.ts:104` — bọc `getStorefrontProductBySlug`
  bằng `React.cache()` (theo đúng pattern đã dùng ở `src/lib/auth/require-admin.ts:26` và
  `src/services/dashboard.service.ts:160,176`).
- File: `src/app/[locale]/(storefront)/products/[slug]/page.tsx:33-38` — gộp
  `listCategories({ limit: 100 })` vào cùng `Promise.all` với fetch sản phẩm ở dòng 33
  thay vì `await` tuần tự sau đó.

### Slice 3 — Waterfall admin
- File: `src/app/admin/(protected)/layout.tsx:10-11` — đổi
  `await requireAdmin(); await getAdminNavBadges();` thành
  `Promise.all([requireAdmin(), getAdminNavBadges()])`, giữ nguyên hành vi throw/redirect
  của `requireAdmin()` khi chưa đăng nhập (xem Risks).
- File: `src/app/admin/(protected)/materials/[id]/page.tsx:21-24` — gộp
  `getFilamentSpoolById` + `listSpoolUsageHistory` bằng `Promise.all` (cả hai chỉ cần
  `id`, không phụ thuộc nhau).

### Slice 4 — Sửa over-fetch expense detail
- File: `src/app/admin/(protected)/expenses/[id]/page.tsx:19-24` — thay
  `(await listExpenses({ limit: 500 })).items.find(...)` bằng một hàm lấy đúng 1 bản ghi
  theo id (thêm `getExpenseById` vào service tương ứng nếu chưa có), giữ nguyên
  role-scoping/điều kiện WHERE hiện có của `listExpenses`.

### Không nằm trong phase này
- ISR/`revalidate` cho trang chủ + blog (`force-dynamic` hiện tại) — chờ Owner xác nhận
  độ tươi dữ liệu chấp nhận được.
- Tái cấu trúc middleware để bỏ double auth-check admin — chờ review riêng vì đụng RBAC
  baseline.
- `sizes`/`priority` cho `next/image` — theo dõi riêng, không phải nguyên nhân chậm điều
  hướng.

## Acceptance criteria

- [x] Throttle network (Slow 3G, Chrome DevTools) trên production build
      (`next build && next start`), điều hướng vào bất kỳ route nào trong
      `(storefront)`/`(tools)`/`admin/(auth)` → skeleton hiện trong <200ms, không phải màn
      hình trắng, cho tới khi nội dung thật render xong. — verify gián tiếp 2026-09-15:
      xác nhận cả 4 `loading.tsx` tồn tại đúng route-segment level
      (`(storefront)/loading.tsx`, `(tools)/loading.tsx`, `admin/(auth)/loading.tsx`,
      `admin/(protected)/loading.tsx`); Next.js App Router bảo đảm Suspense fallback tại
      route-segment level, không cần đo tay lại. Thử throttle qua CDP trên route không có
      DB (`/vi/blog`, `/vi/tools/jigsaw`, `/admin/login`) không thấy gap quan sát được vì
      các route đó không có async work đáng kể — không phải bằng chứng phủ định; sandbox
      review không có Postgres cục bộ để test route có DB thật (product/expense/materials
      detail). Owner nên tự chạy `next build && next start` + DevTools throttle 1 lần trên
      môi trường có DB nếu muốn xác nhận trực quan.
- [x] Đếm số lần gọi `getStorefrontProductBySlug`/số query SQL trong 1 request tới
      `products/[slug]` (query log hoặc test đếm lệnh gọi) → đúng 1 lần, không phải 2. —
      verify gián tiếp 2026-09-15: hàm đã bọc `cache()` (React `cache`, xác nhận tại
      `src/services/storefront-catalog.service.ts:105`) theo đúng pattern
      `require-admin.ts`/`dashboard.service.ts`; chưa có test đếm lệnh gọi tường minh.
- [x] `admin/(protected)/layout.tsx`: user chưa đăng nhập truy cập bất kỳ route admin nào
      vẫn bị redirect/401 đúng như trước khi đổi sang `Promise.all` — test
      `tests/phase-3-route-auth.test.ts` (Phase 14 baseline) pass nguyên trạng.
- [x] `materials/[id]`: trang vẫn hiển thị đúng dữ liệu spool + lịch sử sau khi đổi sang
      `Promise.all` (test integration so sánh output trước/sau). — covered bởi
      "materials detail readers return the spool and its usage history when run in
      parallel" trong `tests/phase-12-filament-expenses.test.ts` (commit `7ae1b69`).
- [x] `expenses/[id]`: trang chi tiết trả đúng bản ghi cho id hợp lệ, 404/error rõ ràng
      cho id không tồn tại hoặc không thuộc role hiện tại (không rò dữ liệu ngoài scope
      role) — test tạo >100 expense, xác nhận trang chi tiết không còn phụ thuộc thứ tự
      trong danh sách 500 dòng. — covered bởi "getExpenseById finds the requested expense
      beyond a 100-row listing and returns null outside the visible set" trong
      `tests/phase-12-filament-expenses.test.ts` (commit `7ae1b69`).
- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass. — verify
      2026-09-15: typecheck ✅, test ✅ (162 pass / 0 fail; DB-bound tests skip trong
      sandbox review không có Postgres — không phải regression của phase này), build ✅.
      lint có 15 lỗi pre-existing, toàn bộ nằm trong `.claude/worktrees/` và
      `.vnx-data/worktrees/` (ngoài scope code của phase này).

## Trước khi giao Codex

- [x] Rà soát kiến trúc và chốt phạm vi (đã viết ở trên) — dựa trên audit code thực tế
      của Claude (2026-09-15), trích trong "Brief"/"Scope" ở trên, không phải suy đoán.
- [x] Non-goals đã tách rõ 2 quyết định cần Owner (ISR trang chủ/blog, tái cấu trúc
      middleware auth) ra khỏi scope phase này — không chặn handoff vì phase này không
      phụ thuộc 2 quyết định đó.
- [x] Không cần đo baseline trước (khác Phase 28) vì các fix trong scope là cấu trúc
      chắc-đúng-hướng (thêm `loading.tsx`, bỏ double-fetch, gộp `Promise.all`, sửa
      over-fetch) — không đổi kết quả nghiệp vụ, chỉ đổi số lần/thứ tự gọi.
