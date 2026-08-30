# Phase 3 — Admin + Inventory (real auth/RBAC + admin UI)

Theo `docs/roadmap.md`: Phase 3 là "admin + inventory". Chi tiết scope tham
khảo `3d-printing-website-development-plan.md` PHASE 3 (dòng 1136+, mục
3.1–3.6) và sitemap admin (mục 9.2). Public storefront thuộc Phase 4,
cart/checkout thuộc Phase 5.

## Goal
Chủ shop (OWNER) và nhân viên (STAFF) đăng nhập thật (cơ chế cụ thể — điểm
#5 — đang chờ Gemini phản biện) vào một khu `/admin` được bảo vệ thật (không
còn no-op ở dev), và dùng UI để: xem dashboard, quản lý sản phẩm/biến thể, quản lý tồn kho, quản
lý đơn hàng (đổi trạng thái dùng API đã có từ Phase 2), quản lý custom
request + báo giá + print job — **không cần mở SQL console** (định nghĩa
thành công gốc từ big-plan PHASE 3).

## Non-goals
- Không xây public storefront (`/products`, `/cart`, trang chủ...) — Phase 4.
- Không xây trang public `/custom-print` (form khách tự nộp yêu cầu +
  upload) — Phase 4. MVP hiện tại: khách nhắn qua Zalo/Facebook/Instagram/
  TikTok (`custom_requests.source_channel`), STAFF tự nhập request vào hệ
  thống bằng text (mô tả, số lượng, chất liệu/màu/size mong muốn — các cột
  đã có sẵn trong schema).
- **File đính kèm cho custom request (upload/download ảnh khách gửi) —
  chuyển hẳn sang Phase 4**, cùng lúc với public upload form, thay vì tách
  làm hai lần (STAFF upload riêng ở Phase 3 rồi khách upload ở Phase 4).
  Phase 3 admin UI cho custom request chỉ có text field, không có file.
- Không làm `/admin/customers`, `/admin/blog`, `/admin/media`,
  `/admin/reports`, `/admin/settings` từ sitemap 9.2 — các mục này không có
  trong checklist "phải làm được" gốc (3.1–3.6) của PHASE 3, để dành cho
  phase sau (blog/content thuộc Phase 7; customers/reports/settings chưa có
  yêu cầu cụ thể, tránh xây khi chưa có spec).
- Không tích hợp payment gateway thật (Phase 5+).
- Không xây RBAC nhiều role — chỉ `OWNER`/`STAFF` như big-plan đã chốt (3.6).
- Không dùng Supabase RLS/PostgREST làm biên giới bảo mật chính — codebase
  hiện tại (Phase 1/2) truy cập DB qua `pg.Pool` với `DATABASE_URL` (kết nối
  trực tiếp, không qua PostgREST/anon key), nên authorization tiếp tục nằm ở
  app/service layer (`requireAdmin()`/`requireOwner()`), giống nguyên tắc đã
  áp dụng từ Phase 2. RLS trên `staff_profiles` (nếu bật) chỉ là phòng thủ
  thêm, không phải cơ chế enforce chính.

## Quyết định đã chốt

1. **"Convert to order" (mục 3.5) → "quote ACCEPTED tạo `print_job`".**
   Xác nhận: không tạo `orders` row (đúng ADR-0007). Ghi lại ở
   `docs/architecture/decisions.md` (addendum ADR-0007, 2026-08-30).
2. **File đính kèm custom request → chuyển hẳn sang Phase 4**, làm cùng lúc
   với public upload form thay vì tách hai lần. Đã cập nhật vào Non-goals;
   bỏ khỏi Outputs/Risks/Checklist của Phase 3 (xem các mục dưới).
3. **`quote.service.acceptQuote` sẽ tạo `print_job` trong Phase 3** — mở
   rộng transaction hiện có để insert 1 `print_jobs` row (`quote_id`,
   `custom_request_id`, `material_id = null` cho tới khi staff chọn,
   `status = 'QUEUED'`) khi quote chuyển `ACCEPTED`.
4. **RBAC 4 ranh giới kiểm soát (OWNER vs STAFF) — chốt qua phản biện Gemini (ADR-0011):**
   - **Quản lý Staff (`/api/staff`)**: `OWNER` only.
   - **Dashboard tài chính (Doanh thu / Lợi nhuận)**: `OWNER` xem đầy đủ số tiền; `STAFF` chỉ xem số lượng vận hành (số đơn hôm nay, việc in đang chờ, cảnh báo sắp hết hàng).
   - **Hard Delete Sản phẩm / Biến thể**: `OWNER` only; `STAFF` chỉ được đổi trạng thái sang `ARCHIVED` (soft archive).
   - **Nhật ký hệ thống (`audit_logs`)**: `OWNER` only (nhân viên không soi vết kiểm toán của nhau).
   - **Mọi tác vụ vận hành còn lại** (Tạo/sửa sản phẩm, Nhập kho/xuất kho, Xử lý đơn, Báo giá, Quản lý print jobs): `STAFF` và `OWNER` đều có toàn quyền.
5. **Cơ chế Auth (Supabase Auth + `@supabase/ssr` + `pg.Pool`) — chốt qua phản biện Gemini (ADR-0012):**
   - Dùng Supabase Auth (Email + Password) cấp phát JWT session qua HTTP-Only cookie, tích hợp `@supabase/ssr`.
   - `middleware.ts` dùng `createServerClient` để tự động refresh token trong cookie (tránh footgun hết hạn session sau 1h).
   - `src/lib/auth/require-admin.ts` và `requireOwner()` dùng `await supabase.auth.getUser()` (đảm bảo xác thực server-side, không dùng `getSession()`), sau đó query bảng `staff_profiles` qua `pg.Pool` để kiểm tra `is_active = true` và `role`.
   - Bảng `staff_profiles` (`id uuid primary key references auth.users(id)`, `full_name`, `role` enum `OWNER`/`STAFF`, `is_active`, timestamps) tạo trong migration Phase 3.

## Inputs
- `docs/database/schema.md`, `docs/architecture/decisions.md` (đặc biệt
  ADR-0004, ADR-0005, ADR-0007), `docs/architecture/architecture.md`,
  `docs/architecture/api-conventions.md`.
- `3d-printing-website-development-plan.md` PHASE 3 (dòng 1136–1226) và mục
  17 (security checklist), mục 9.2 (sitemap admin).
- `docs/exec-plans/completed/phase-2.md` — toàn bộ service/API hiện có mà
  admin UI sẽ gọi (không viết lại service logic, chỉ thêm UI + auth layer).
- `src/lib/auth/require-admin.ts`, `src/lib/auth/dev-actor.ts` — sẽ bị thay
  thế hoàn toàn bởi cơ chế thật.

## Outputs
- Migration mới: bảng `staff_profiles` (`id` references `auth.users(id)`,
  `full_name`, `role` enum `OWNER`/`STAFF`, `is_active`, timestamps).
- `@supabase/supabase-js` + `@supabase/ssr` (client/server helpers cho Next.js
  App Router).
- `middleware.ts`: bảo vệ toàn bộ `/admin/*` (trừ `/admin/login`), redirect
  về login nếu chưa có session hợp lệ.
- Viết lại `src/lib/auth/require-admin.ts` (đổi hoàn toàn logic, có thể đổi
  tên nếu cần) thành hàm **async**, đọc session Supabase từ cookie, tra
  `staff_profiles`, trả về `{ actorId, role }`; throw `AUTH_REQUIRED` (401)
  nếu chưa đăng nhập, `FORBIDDEN` (403) nếu role không đủ. Thêm
  `requireOwner()` cho hành động OWNER-only (quản lý staff).
- Cập nhật **toàn bộ** route handler hiện có (`src/app/api/**/route.ts`) từ
  `requireAdmin()` đồng bộ + `DEV_ACTOR_ID` hardcode → `await requireAdmin()`
  lấy `actorId` thật từ session. Đây là thay đổi cơ học, không đổi service
  logic (đúng như Phase 2 đã dự tính: "chỉ cần đổi 1 chỗ").
- `src/app/admin/login/page.tsx` — form đăng nhập Supabase Auth.
- `src/app/admin/layout.tsx` — layout chung (nav, session), bọc mọi trang
  admin.
- `src/app/admin/dashboard/page.tsx` — orders today, revenue today, pending
  orders, low-stock items, custom requests count, print jobs count.
- `src/app/admin/products/**` — list/create/edit/archive, thêm variant,
  upload ảnh, đổi giá, set featured.
- `src/app/admin/inventory/**` — xem tồn kho, nhận hàng (PURCHASE/
  PRODUCTION_IN), điều chỉnh thủ công (ADJUSTMENT_IN/OUT), lịch sử movement.
- `src/app/admin/orders/**` — xem đơn, đổi trạng thái (gọi
  `PATCH /api/orders/[id]` đã có), ghi admin note, xem khách/thanh toán/vận
  chuyển.
- `src/app/admin/custom-requests/**` — list, mở request (text only, không
  file đính kèm — xem Non-goals), tạo/xem báo giá, đổi trạng thái, chấp nhận
  báo giá → tạo print_job (điểm #3).
- Extra API cần thêm để UI hoạt động (ngoài những gì Phase 2 đã có):
  `POST /api/quotes` đã có, nhưng cần review lại `acceptQuote` (điểm #3);
  `POST /api/staff` (OWNER-only, tạo STAFF profile) nếu không dùng dashboard
  thủ công.

## Risks
- Đổi `requireAdmin()` từ sync → async là breaking change cho **mọi** route
  handler hiện có — cần sửa đồng loạt, dễ sót 1 route quên `await`. Giảm rủi
  ro: viết 1 test kiểm tra tất cả route trong `src/app/api/**` đều gọi
  `requireAdmin`/`requireOwner` đúng cho method POST/PATCH/DELETE (lặp lại
  tinh thần review đã làm ở Phase 2).
- `staff_profiles` tách khỏi Supabase `auth.users` — nếu quên tạo profile
  khi tạo user mới (qua dashboard) thì user đăng nhập được nhưng
  `requireAdmin()` sẽ throw `FORBIDDEN` một cách khó hiểu nếu không có
  thông báo lỗi rõ ràng. Cần message lỗi cụ thể ("Tài khoản chưa được cấp
  quyền truy cập admin").
- Middleware bảo vệ `/admin/*` chỉ chặn ở tầng UI — API route vẫn phải tự
  gọi `requireAdmin()` (không được tin middleware là đủ, đúng AGENTS.md rule
  5 "Authorization is enforced server-side; UI hiding is not security").

## Checklist

### Trước khi giao Codex
- [x] Xác nhận resolution cho điểm #1 (convert to order → tạo print_job)
- [x] Xác nhận điểm #2 (file upload/download chuyển hẳn sang Phase 4)
- [x] Xác nhận điểm #3 (acceptQuote tạo print_job)
- [x] Xác nhận RBAC (điểm #4) — mô hình 4 ranh giới kiểm soát (ADR-0011)
- [x] Xác nhận auth mechanism (điểm #5) — Supabase Auth + @supabase/ssr + direct pg.Pool (ADR-0012)

### Auth & RBAC
- [x] Migration `staff_profiles` + enum `staff_role ('OWNER', 'STAFF')`
- [x] `@supabase/supabase-js` + `@supabase/ssr` cài đặt, client Server/Browser tách riêng
- [x] `middleware.ts` bảo vệ `/admin/*` và auto-refresh session cookie
- [x] Viết lại `require-admin.ts` thành async, thật sự đọc session + role qua `getUser()` + `pg.Pool`
- [x] `requireOwner()` cho hành động OWNER-only (quản lý staff, audit logs, hard delete product, doanh thu/lợi nhuận dashboard)
- [x] Cập nhật toàn bộ route handler hiện có sang `await requireAdmin()` + actorId thật
- [x] Trang `/admin/login`

### Admin UI
- [x] Dashboard (5/6 chỉ số theo big-plan 3.1 — role-gated theo ADR-0011 #2: STAFF không thấy doanh thu)
- [x] Product management (3.2: create/edit/archive/variant/ảnh/giá/featured — hard delete OWNER-only)
- [x] Inventory management (3.3: xem tồn kho/nhận hàng/điều chỉnh/lịch sử)
- [x] Order management (3.4: xem/đổi trạng thái/note/khách/thanh toán/vận chuyển)
- [x] Custom request + quote + print job management (3.5, gồm điểm #1 #2 #3)
- [x] shadcn/ui init (`components.json`) — component tái dùng (Button, Card, Table, Input, Label, Badge, Select, Textarea, Dialog)
- [x] Staff management UI (`/admin/staff`, OWNER-only) + Audit log viewer (`/admin/audit-logs`, OWNER-only) — không có trong Outputs gốc nhưng cần thiết để RBAC boundary #1/#4 (ADR-0011) thật sự dùng được từ UI, không chỉ qua API

### Tests
- [x] Unit/integration test: `resolveStaffSession()` (phần lõi của `requireAdmin`) — không session → 401
      (`tests/phase-3-auth.test.ts`), session hợp lệ nhưng không có `staff_profiles`/`is_active=false`
      → 403, đủ điều kiện → trả đúng role. Verify bằng tài khoản Supabase Auth thật (tạo/xoá trong
      test qua service-role key), không mock.
- [x] Integration test: mọi route POST/PATCH/DELETE (+ GET đã khoá) trong `src/app/api/**` đều bị
      chặn khi chưa đăng nhập — `tests/phase-3-route-auth.test.ts`, dựng `next start` thật trong
      test, gọi 22 route không kèm cookie, assert 401/403. Bắt được đúng cách này khi review phát
      hiện 2 route quên `requireAdmin()` (xem Addendum).
- [x] E2E (Playwright, `e2e/admin.spec.ts`, `playwright.config.ts`) — 2/5 flow theo skill
      `e2e-testing` khả thi ở Phase 3 (3 flow còn lại — browse→cart, checkout, custom request
      submission — cần public storefront, Phase 4/5, chưa tồn tại): "Admin đăng nhập rồi tạo sản
      phẩm mới", "Admin ghi nhận biến động tồn kho". Cả hai dùng tài khoản Supabase Auth thật
      (tạo/xoá trong test). **Bắt được 1 bug production thật** khi chạy lần đầu — xem Addendum.
- [x] Chạy `security-review` — 2 BLOCKER + 2 IMPORTANT tìm thấy, đã fix (xem Addendum)
- [x] Chạy `database-review` — 1 BLOCKER + 2 IMPORTANT tìm thấy, đã fix (xem Addendum)

## Addendum — implementation notes (2026-08-30, Claude, Codex was unavailable)

- **Node.js >= 22 is now required** (`package.json` `engines`). `@supabase/supabase-js@2.112.4`'s
  own `package.json` requires it (its realtime client needs the global `WebSocket` constructor,
  stable only from Node 22 — confirmed by testing: Node 18 and Node 20 both throw
  `Node.js detected but native WebSocket not found` the instant any Supabase client is
  constructed, not just when realtime features are used). This blocks **every** admin page/action,
  since `requireAdmin()` constructs a Supabase server client on every call. Verified working after
  switching to Node 22 via `nvm` — dev server serves `/admin/login` (200) and correctly redirects
  unauthenticated `/admin/dashboard` requests (307 → `/admin/login`). Whoever runs this project next
  needs `nvm install 22 && nvm use 22` (or equivalent) before `npm run dev`/`npm test`/`npm run build`.
- shadcn/ui's CLI (`npx shadcn@latest init`) itself requires Node >= 20 (separate issue from the
  above, only matters for adding *more* components later) — used a temporary `nvm use 20` subshell
  to run it. It also defaults to Tailwind v4 output (`@import "shadcn/tailwind.css"`,
  `border-border`/`outline-ring/50` utilities) which doesn't work with this project's pinned
  Tailwind v3.4.17 — manually fixed `src/app/globals.css` and `tailwind.config.ts` to the classic v3
  CSS-variable + `tailwindcss-animate` pattern instead of upgrading Tailwind (out of scope for this
  phase). The shadcn "base-nova" style's `Button` component uses `@base-ui/react` (not Radix) and has
  **no `asChild` prop** — every link-styled button in the admin UI uses `buttonVariants({...})` as a
  plain `<Link>` className instead.
- Design choice: admin pages call service functions **directly** (Server Components/Server Actions),
  not through the `/api/**` HTTP routes — matches `docs/architecture/architecture.md`'s stated
  layering ("UI → Service → Repository", not "UI → API → Service") and avoids an unnecessary network
  hop + duplicate auth check inside the same Next.js process. The `/api/**` routes from Phase 2
  still exist unchanged for any future non-browser client.
- Deferred (see Tests section): a route-by-route "everything 401s when logged out" regression test
  and Playwright E2E coverage. Both need a real running Next.js server inside the test process,
  which is more infra than this pass had budget for — flag before treating Phase 3 as fully closed.
- First OWNER account still needs to be created — `scripts-tmp-bootstrap-owner.ts` (present at repo
  root, not committed) does this: `npx tsx scripts-tmp-bootstrap-owner.ts <email> <password> <full name>`.
  Delete it after use (it's a one-off, not part of the app).

### `security-review` + `database-review` findings — all fixed
- **BLOCKER (security):** `GET /api/products/variants` had no auth and returned `cost_price`
  (COGS) for every SKU. Fixed: `product.service.listVariants` no longer selects `cost_price` (this
  endpoint is meant for public catalog browsing only — the admin UI reads variants through
  `getProductById`/`listAllVariantsWithProductName`, not this route) and now filters to
  `is_active = true`.
- **BLOCKER (security):** `GET /api/inventory/[variantId]` had zero auth check, leaking exact
  on-hand/reserved stock per variant. Fixed: now requires `requireAdmin()`.
- **IMPORTANT (security):** `GET /api/products` was unauthenticated and passed a client-supplied
  `status` filter straight through, so `?status=DRAFT` exposed unpublished products. Fixed: this
  route now always forces `status: 'ACTIVE'`, ignoring any client value (admin UI doesn't use this
  HTTP route anyway — it calls `listProducts()` directly).
- **IMPORTANT (security):** `staff.service.createStaffAccount`'s rollback path (deleting the
  just-created Supabase Auth user if the `staff_profiles` insert fails) could mask the original
  error if the rollback itself failed. Fixed: rollback failure is now caught and logged separately
  (`console.error`, includes the orphaned user id/email for manual cleanup) without swallowing the
  original error.
- **BLOCKER (database):** `quote.service.acceptQuote` never checked `quotes.status` before
  accepting — a double-click or duplicate request against an already-`ACCEPTED` quote would
  silently insert a second `print_jobs` row. Fixed: now throws `QUOTE_ALREADY_FINALIZED` (409)
  unless `status` is `DRAFT`/`SENT`; added a DB-level backstop too
  (`20260830000004_print_jobs_quote_unique.sql`, partial unique index on
  `print_jobs(quote_id) where quote_id is not null`). Regression test:
  `tests/phase-3-quote-print-job.test.ts`.
- **IMPORTANT (database):** `product.service.uploadProductImage` could orphan a Storage file if
  the Storage upload succeeded but the DB insert failed afterward. Fixed: the DB-failure path now
  removes the just-uploaded Storage object.
- **IMPORTANT (database), not fixed — documented only:** `staff_profiles.id` uses
  `on delete cascade` against `auth.users(id)`. If an OWNER ever deletes a Supabase Auth user
  directly (dashboard, not through this app's `setStaffActive` soft-deactivate), the
  `staff_profiles` row silently vanishes with no trace, unlike `audit_logs` (deliberately has no FK
  to preserve history). `on delete restrict` would force explicit deactivation first and better
  match "never delete history casually" — left as-is for this pass since no current code path
  triggers the risky case, but flagged for whoever revisits this table next.
- Minor **SUGGESTIONS** not acted on (informational only): `staff_profiles.role` has no DB-level
  `default` despite `docs/database/schema.md` describing one (code always supplies `role`
  explicitly, so no behavioral gap); `uploadProductImage` trusts the browser-supplied `file.type`
  header rather than sniffing magic bytes (low severity — still allowlisted to 3 image MIME types
  into a scoped path, not executable content).

### Production bug caught by the E2E test (not by any other check)
`src/lib/supabase/client.ts` originally read `process.env.NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`
through a shared helper using **bracket/variable property access**
(`process.env[name]`) — the same pattern used safely in `server.ts`/`middleware.ts`. But those
two only ever run in Node.js, where `process.env` is real at runtime; `client.ts` runs in the
**browser bundle**, where Next.js has to statically replace `process.env.NEXT_PUBLIC_*` at build
time — and that static analysis only recognizes a literal dot-path, not a bracket/variable access.
The result: `NEXT_PUBLIC_SUPABASE_URL` was silently `undefined` in every browser build, so
`createSupabaseBrowserClient()` threw on every real user's very first login attempt in production
— `npm run build`/`typecheck`/`lint` all stayed green throughout, because none of them execute
browser JS. Only the Playwright E2E test (which runs a real browser against a real production
build) caught it. Fixed by inlining the two reads directly as literal
`process.env.NEXT_PUBLIC_...` in `client.ts` (see the comment left in that file). **Lesson for next
time:** any file that ships to the browser must not read `NEXT_PUBLIC_*` through a shared/dynamic
helper — this is exactly the kind of gap that justifies keeping the E2E suite in CI, not just unit
tests.

## Definition of Done
Đăng nhập thật hoạt động (Supabase Auth), mọi route quản trị (UI lẫn API)
chặn được truy cập trái phép (test xác nhận, không chỉ code review), toàn bộ
6 khu vực admin UI (3.1–3.5) dùng được, `security-review`/`database-review`
không còn BLOCKER — đạt tiêu chí gốc: "chủ shop điều hành được business
trong một ngày mà không cần mở SQL console".
