# Architecture Decision Log

## ADR-0001 — PostgreSQL is the source of truth
Status: accepted

Google Sheets is not the primary database. It may be used for import/export, reporting, and manual backup workflows.

## ADR-0002 — Modular monolith
Status: accepted

Keep the application in one repository and deployment until operational scale proves a split is necessary.

## ADR-0003 — Vertical slices
Status: accepted

Build features end-to-end in small increments instead of finishing an entire technical layer before integration.

## ADR-0004 — Order lifecycle: three independent status axes
Status: accepted

`orders` tracks three independent state machines instead of one combined status:
`status` (NEW → CONFIRMED → PRODUCING → READY_TO_SHIP → SHIPPED → COMPLETED,
plus CANCELLED), `payment_status` (UNPAID → PAID, plus REFUNDED), and
`shipping_status` (PENDING → SHIPPED → DELIVERED, plus RETURNED). Keeping them
separate allows querying "paid but not yet shipped" etc. without overloading
one enum. Full detail: `docs/database/schema.md`.

## ADR-0005 — Inventory: ledger only, SALE_OUT recorded at PRODUCING
Status: accepted

`inventory_movements` is the only source of stock truth (never a mutable
`stock` column). Movement types: PURCHASE, PRODUCTION_IN, SALE_OUT, RETURN_IN,
DAMAGE_OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_IN, TRANSFER_OUT.
`SALE_OUT` is recorded when `orders.status` moves to `PRODUCING` (not at order
creation) — before that, quantity is only "reserved" (tracked separately, not
a ledger entry, since a NEW/CONFIRMED order can still be cancelled).

## ADR-0006 — Pricing formula: cost-plus with placeholder inputs
Status: accepted (formula), inputs pending real data

Price = Total cost / (1 - target margin%), where Total cost = Material +
Electricity + Machine depreciation + Failure buffer + Labor + Packaging. The
owner had no existing formula, so Claude proposed this cost-plus model
(`docs/product/catalog-spec.md`, section 4) with Vietnam-market placeholder
inputs (electricity ~3.500đ/kWh, printer 15.000.000đ over 10.000h, labor
35.000đ/h, 10% failure buffer, 40% target margin) explicitly flagged as
starting points, not the owner's real costs. Replace with real numbers before
relying on this for actual pricing decisions.

## ADR-0007 — Product type simplified to two values; custom prints stay out of the catalog
Status: accepted

`products.product_type` only uses `READY_STOCK` and `MADE_TO_ORDER` — no
`CUSTOM` value. Fully bespoke print requests never become a `products` row;
they flow entirely through `custom_requests` → `quotes` → `print_jobs`.
`custom_requests` gains a `source_channel` column (`ZALO`, `FACEBOOK`,
`INSTAGRAM`, `TIKTOK`, `OTHER`) because intake is multi-channel and the owner
wants to know which channel converts. No Google Sheet migration was needed —
there was no existing product data (greenfield catalog).

**2026-08-30 addendum (Phase 3 kickoff):** the original research doc
(`3d-printing-website-development-plan.md`, PHASE 3 §3.5) describes an admin
action "convert [custom request] to order," which this ADR already
contradicts. Resolved: that action means quote `ACCEPTED` → create a
`print_jobs` row, never an `orders` row. See
`docs/exec-plans/active/phase-3.md`.

## ADR-0008 — Separate inventory ledgers for finished product variants vs raw materials
Status: accepted

Finished product variants (`product_variants`, counted in pcs) and raw printing materials (`materials`, tracked in grams/spools) have different tracking units and lifecycle triggers. Instead of a single polymorphic table, raw material stock movements are recorded in a dedicated `material_movements` table (`PURCHASE`, `PRODUCTION_OUT`, `RETURN_IN`, `DAMAGE_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`), keeping `inventory_movements` clean and strictly typed for `product_variants`. `material_movements` includes nullable `reference_type` and `reference_id` columns to tie material consumption to specific `print_jobs` or procurement receipts for accurate COGS auditing.

## ADR-0009 — Order payment status includes DEPOSIT_PAID (threshold >= 300,000 VND)
Status: accepted

Owner confirmed deposit policy: Deposits (`DEPOSIT_PAID`) are optional, required for orders with total value >= 300,000 VND (300k VND threshold), and flexible based on customer feedback. `orders.payment_status` includes `DEPOSIT_PAID` (`UNPAID → DEPOSIT_PAID → PAID`, plus `REFUNDED`) from Phase 1 migration onward to support partial deposit workflows.

## ADR-0010 — Price rounding rule (ceil to nearest 1,000 VND)
Status: accepted

Calculated selling prices from the cost-plus formula are rounded up to the nearest 1,000 VND (`Math.ceil(Price / 1000) * 1000`). This satisfies the integer money storage rule (VND = 1 unit, `AGENTS.md`) and matches standard retail pricing practice in Vietnam.

## ADR-0011 — Admin RBAC: 4-Boundary Model between OWNER and STAFF
Status: accepted

Phase 3 defines two internal roles (`OWNER` and `STAFF`) with 4 explicit risk boundaries:
1. `Staff Management` (`/api/staff`): `OWNER` only.
2. `Financial Dashboard & Profit Reports`: `OWNER` sees full revenue, COGS, and profit metrics; `STAFF` sees operational counts only (orders today, queued print jobs, low-stock items).
3. `Hard Deletion of Products/Variants`: `OWNER` only; `STAFF` can only change status to `ARCHIVED`.
4. `Audit Log Viewer` (`/api/audit-logs`): `OWNER` only.
All standard day-to-day operations (create/edit products, receive inventory, process orders, draft/send quotes, manage print jobs) are shared equally.

Extended by ADR-0026 with a 5th boundary (expenses/financial analytics). ADR-0027 records the
Phase 14 test-coverage audit of all 5 boundaries — a second, test-level layer of protection on top
of the `requireOwner()`/`requireAdmin()` calls this ADR defines.

## ADR-0012 — Admin Authentication: Supabase Auth with @supabase/ssr and direct pg.Pool role checks
Status: accepted

Admin authentication uses Supabase Auth (Email + Password) with `@supabase/ssr` for HTTP-Only cookie session management in Next.js App Router.
- Token refresh is handled in `middleware.ts` via `createServerClient`.
- Route handlers and server actions verify sessions via `await supabase.auth.getUser()`.
- Authorization and profile lookup (`staff_profiles`) are executed directly through the existing `pg.Pool` (`DATABASE_URL`), keeping database queries clean and consistent with Phase 1/2 patterns without relying on Supabase PostgREST or client-side RLS enforcement.

## ADR-0013 — Storefront Design System: Tactile Neo-Craft & Admin Token-Only Scope
Status: accepted

Storefront adopts **Tactile Neo-Craft (Modern Maker Aesthetic)** instead of full Claymorphism:
- Storefront components use standard `rounded-xl` (12–16px), 1px crisp borders, and subtle tactile drop-shadows on CTAs/material badges only. This preserves high readability, fast mobile rendering, and WCAG AA contrast while letting physical 3D print photos stand out.
- Dual-mode calibrated palette: Teal (`#0F766E` Light / `#2DD4BF` Dark) + Terracotta/Amber (`#D97706` Light / `#F59E0B` Dark).
- Phase 4 Admin scope is strictly **Token & Font alignment** via CSS variables. Full Admin UI redesign / densification is deferred to Phase 8 to avoid regression risks on tested Phase 3 modules.

**2026-08-31 addendum (Phase 4):** `audit_logs.actor_id` was made `NOT NULL` in the Phase 3
migration `20260830000002_audit_logs_actor_id_not_null.sql` on the assumption every write path has
an authenticated actor. Phase 4 introduces the project's first unauthenticated write path
(`POST /api/public/custom-requests`, see `docs/exec-plans/active/phase-4.md` decision #3), which
must still write an audit log entry (`action: 'CUSTOM_REQUEST_CREATED_PUBLIC'`) with `actor_id =
null` so OWNER can distinguish customer-submitted requests from staff-entered ones in the audit
log. Migration `20260831000000_public_custom_request_support.sql` reverts the column back to
nullable — its original Phase 0 design (`docs/database/schema.md`). Every existing authenticated
write path is unaffected since it already supplies a real `actorId`.

## ADR-0014 — Phase 5 cart is client-side only; `carts`/`cart_items` intentionally unused

Status: accepted

The `carts`/`cart_items` tables designed in Phase 0 are not used by Phase 5's checkout flow.
Cart state (selected variant, quantity, and display-only snapshots of name/image/price) lives in
the browser (`localStorage`, via `CartProvider`/`useCart` in `src/lib/cart/cart-context.tsx`), not
in Postgres. This was a deliberate choice (not an oversight) confirmed with the project owner
2026-08-31: Phase 5 ships guest checkout only (no customer accounts), so there is no cross-device
cart to preserve, and skipping the server round-trip on every cart edit is simpler to build and
reason about. `POST /api/public/orders` still recomputes price and validates stock from
`product_variants` server-side at checkout time (`createOrder`, unchanged from Phase 2) — the
client-side cart never influences what a customer is actually charged. If customer accounts are
added later and cross-device cart sync becomes a real requirement, `carts`/`cart_items` are still
there, unmodified, ready to be wired up. Full detail: `docs/exec-plans/completed/phase-5.md`.

## ADR-0015 — Public order lookup and payment method are additive, no new order columns

Status: accepted

Two Phase 5 additions deliberately avoid new `orders` columns:
- **Payment method** (COD vs. bank transfer) is reference-only for admin's manual reconciliation
  (no payment gateway in Phase 5, per business-rules.md and dev-plan PHASE 5 §5.3) — it's folded
  into `orders.customer_note` as a plain text line by `POST /api/public/orders`
  (`src/app/api/public/orders/route.ts`), not a new enum column.
- **`GET /api/public/orders/[orderNumber]`** (public order lookup, no account/OTP) uses
  `orders.order_number` itself as the access token — it already has 48 bits of random entropy
  (`ORD-` + 12 hex chars from `randomUUID()`, unchanged since Phase 2) — instead of adding a
  separate lookup secret. The response is a field allowlist (`getPublicOrderByNumber` in
  `order.service.ts`) that excludes `customer_email` and `admin_note`; there is no listing/search
  variant of this query, only exact-`order_number` lookup, so it cannot be used to enumerate other
  customers' orders. Full detail: `docs/exec-plans/completed/phase-5.md`.

## ADR-0016 — Private storage bucket for custom request 3D attachments

Status: accepted (Debate 2026-09-01)

Customer 3D models (STL/STEP/3MF/OBJ) contain proprietary intellectual property and confidential design data.
- The `custom-request-attachments` bucket is changed to `public = false`.
- The database stores relative `attachment_path` (e.g. `requests/uuid.stl`), never a public URL.
- Admins access attachments via short-lived (15–30 min) server-generated Signed URLs verified behind `requireAdmin()`.
- Public intake routes upload directly via server action / service-role without exposing public bucket URLs.

## ADR-0017 — `MADE_TO_ORDER` catalog & order checkout lifecycle

Status: accepted (Debate 2026-09-01)

`MADE_TO_ORDER` products represent standard designs printed on-demand without pre-existing finished goods stock.
- Storefront displays `MADE_TO_ORDER` as available for ordering ("In theo yêu cầu / 1-2 ngày") and does not disable Add to Cart.
- `createOrder` skips finished goods inventory reservation (`assertAvailableStock`) for `MADE_TO_ORDER` variants.
- When an order enters `PRODUCING`, the system automatically creates an empty `print_jobs` row in `QUEUED`; no raw material is deducted at this step.
- Staff then manually assigns the material and estimated weight with `assignPrintJobMaterial()`. Raw material is deducted as a `PRODUCTION_OUT` movement only when staff transitions that print job to `PRINTING` through `updatePrintJobStatus()`.

## ADR-0018 — Raw material concurrency lock protocol

Status: accepted (Debate 2026-09-01)

To prevent concurrent print jobs from overselling raw materials into negative balances:
- Material deduction paths must lock the parent `materials` row (`SELECT id FROM materials WHERE id = $1 FOR UPDATE`) before calculating available warehouse stock via `resolveWarehouseForMaterial` and inserting `material_movements`.
- This mirrors the lock-by-proxy pattern established in `product_variants` inventory management.

## ADR-0019 — Order cancellation inventory compensation

Status: accepted (Debate 2026-09-01)

To preserve strict append-only ledger integrity when orders are cancelled after inventory has been deducted:
- When an order transitions from `PRODUCING` or `READY_TO_SHIP` to `CANCELLED`, the system automatically inserts compensating `RETURN_IN` movements in `inventory_movements` for all deducted items.
- Historical `SALE_OUT` records are immutable and never modified or deleted.

## ADR-0020 — Enforced workflow state machine & transition boundaries

Status: accepted (Debate 2026-09-01)

- Service layer enforces strict forward-only transition maps for `custom_requests`, `print_jobs`, `payment_status`, and `shipping_status`.
- Regular `STAFF` can only transition along approved forward directed acyclic paths.
- Backward transitions or administrative overrides require `OWNER` authorization with mandatory audit reasons logged.

## ADR-0021 — Public order lookup privacy & PII masking

Status: accepted (Debate 2026-09-01)

Public order tracking (`/tracking` / public API) requires dual verification (Order Number + recipient phone number / last 4 digits). Public responses strictly mask PII (Customer name `Ng*** V** A**`, phone `098***123`, address masked to district/province level) to prevent data leakage via shared URLs.

## ADR-0022 — Pricing snapshot immutability means different things for Quotes vs Products

Status: accepted (Phase 9 second-pass review, 2026-09-01)

`quotes.pricing_breakdown`/`pricing_config_id` and `products.pricing_breakdown`/`pricing_config_id` (Phase 9) are the same column shape but not the same guarantee:

- **Quote**: bất biến thật — không có `updateQuote` nào trong codebase; một Quote chỉ được tạo một lần rồi chuyển trạng thái (SENT/ACCEPTED/REJECTED/EXPIRED). Bất biến là hệ quả của việc không tồn tại đường update, không phải một rule phải tự canh giữ riêng.
- **Product**: không bất biến, và không nên coi là vậy — `updateProduct` đã cho sửa `basePrice` bằng tay từ trước Phase 9 (Product là catalog listing sống, không phải bản ghi giao dịch). Staff được phép chủ động mở lại pricing calculator panel trên trang edit Product và ghi đè `basePrice` + `pricing_breakdown` + `pricing_config_id` cùng lúc — đây là tái định giá chủ động (staff bấm nút), không phải side-effect ngầm.
- Điều không đổi ở cả hai: tạo một `pricing_configs` row mới **không bao giờ** tự động cascade-update snapshot của Quote/Product đã có — tái định giá chỉ xảy ra khi staff chủ động submit lại qua panel.
- Bảo đảm "giá đúng tại thời điểm bán" cho đơn hàng thật nằm ở `order_items` (business-rules.md #3 — snapshot tên/giá sản phẩm lúc mua), độc lập với `products.pricing_breakdown` hiện tại là gì. Vì vậy Product không cần một snapshot bất biến kiểu ledger.

Xem `docs/exec-plans/active/phase-9.md` quyết định #4 để biết chi tiết implementation.

## ADR-0023 — `bigint`/`numeric` Postgres columns must be coerced to `number` at the service boundary

Status: accepted (Phase 9 second-pass review, browser E2E, 2026-09-01)

`node-postgres` (`pg`) returns `bigint` and `numeric`/`decimal` columns as **strings**, not `number` — a deliberate driver default to avoid silent precision loss, but it means a service function typed as returning `number` (e.g. `PricingConfigRow.marginPct: number`) can lie about its own runtime shape if the SELECT result is passed straight through without an explicit `Number(...)` coercion.

This produced a real, 100%-reproducible crash in Phase 9: `pricing_configs`/`materials` have several `bigint`/`numeric` columns (`electricity_vnd_per_kwh`, `margin_pct`, `printer_power_kw`, `cost_per_spool`, `current_unit_cost`, ...). `pricing.service.computePricingBreakdown`'s input-validation guard uses `Number.isFinite(value)` — which returns `false` for a numeric string like `"3500.00"` (unlike the coercing global `isFinite`) — so every real config/material read from the DB threw a `RangeError`, crashing `PricingCalculatorPanel` client-side. Found via a real Playwright browser run (`e2e/pricing.spec.ts`), not by unit tests (which only ever exercised the pure function with hand-typed JS number literals, never a real DB row).

Fix: `pricing-config.service.getCurrentPricingConfig`/`listPricingConfigs` and `inventory.service.listMaterials` now map every `bigint`/`numeric` column through `Number(...)` before returning, so their declared TypeScript return types are actually true at runtime.

**Going forward**: any new service function selecting a `bigint`/`numeric` column and typing it as `number` must apply the same coercion at the read boundary — don't assume `pg` gives you a real number just because the SQL column is numeric. `integer` columns are unaffected (already returned as real numbers).

## ADR-0024 — GA4 purchase idempotency is claimed server-side

Status: accepted (Phase 10 reviewed plan, 2026-09-01)

The confirmation page atomically sets nullable `orders.analytics_purchase_sent_at` with
`UPDATE ... WHERE analytics_purchase_sent_at IS NULL RETURNING`. Only the request that claims the
row renders the client `purchase` tracker. This prevents duplicate revenue across refreshes,
shared confirmation links, and multiple devices; browser storage cannot provide that guarantee.
The accepted tradeoff is at-most-once delivery: if analytics is blocked or the browser closes
after the server claim, the application does not retry that purchase event.

## ADR-0025 — Filament spool tracking extends ADR-0018's lock protocol to per-spool granularity

Status: accepted (Phase 12, self-review 2026-09-01)

`filament_spools` tracks individual physical spools (spool code, weight consumed, purchase cost)
on top of the existing `materials`/`material_movements` raw-material ledger (ADR-0008), instead of
replacing it. `material_movements.spool_id` (nullable FK) attributes ledger rows to a specific
spool when one is known; `filament_spools.used_weight_grams` is a cached counter that must only
ever be updated in the same transaction as the `material_movements` insert that justifies it.

- **Locking**: extends ADR-0018's "lock the parent row before writing" pattern down to the spool
  level — `SELECT id FROM filament_spools WHERE id = $1 FOR UPDATE` before checking
  `used_weight_grams + consumed <= initial_weight_grams`. Scope is deliberately narrow: only one
  row is ever locked (no ordering concern, unlike multi-row lock protocols), because Phase 12 scope
  is **one print job = one spool** (see Non-Goals below) — never a set of spools locked together.
- **`print_jobs.spool_id`** (nullable FK) is the single point of integration with the real
  production flow: `updatePrintJobStatus`'s `PRINTING` transition now branches on it. When set, it
  calls `recordSpoolUsage` (the same helper the Admin "kiểm kê"/adjustment flow uses) instead of
  the pre-Phase-12 `lockMaterialForInventoryWrite` + manual insert. When unset, it falls back to the
  pre-Phase-12 path unchanged — but only when that material actually has no `ACTIVE` spools; if
  ACTIVE spools exist for the assigned material, a missing `spool_id` is rejected
  (`PRINT_JOB_SPOOL_REQUIRED`) rather than silently deducting from the material-level ledger and
  leaving spool weights stale.
- **Non-Goals**: multi-spool/AMS support for a single print job is explicitly out of scope — the
  workshop has no AMS-capable printer yet, and `print_jobs.material_id` is already a single column.
  Adding a `print_job_spool_usages` join table now would be speculative infrastructure (AGENTS.md
  Rule #8/#9); if a real multi-spool need appears, that becomes its own phase.
- **`filament_spools.status`** carries only 2 manually-set values (`ACTIVE`, `ARCHIVED`) — the
  4-tier low-stock warning (Còn nhiều/Cần theo dõi/Sắp hết/Đã hết) shown in the Admin UI is always
  computed at query/render time from the weight columns, never stored, so it cannot drift out of
  sync with `used_weight_grams`.

## ADR-0026 — Expenses/financial analytics is the 5th OWNER/STAFF boundary; reuses `requireOwner()`, no service-level role check

Status: accepted (Phase 12, self-review 2026-09-01)

Extends ADR-0011's 4-boundary model with a 5th: **Workshop expense tracking & financial
analytics** (`/admin/expenses`, `expense.service.ts`) is 100% OWNER-only — `STAFF` has no partial
or masked view of it (unlike `filament_spools.purchase_cost`, which STAFF simply can't see a value
for; here STAFF can't reach the feature at all).

Enforcement follows the existing convention from `pricing-config.service.ts`: the route/Server
Action calls `requireOwner()` (`src/lib/auth/require-admin.ts`) before invoking anything in
`expense.service.ts`; the service itself never re-checks role, trusting an already-authorized
`actorId`. This was a deliberate choice over writing a service-level `assertOwnerRole` helper
(considered and rejected in the original draft) — a second enforcement point would duplicate
`requireOwner()`'s logic without adding real defense, and every other OWNER-only surface in this
codebase (staff management, audit logs, pricing config) already follows the caller-enforces
pattern.

`filament_spools` sits on the other side of this boundary: `STAFF` needs it for day-to-day
workshop operations (checking remaining stock, picking a spool to start a print), so it uses
`requireAdmin()` (any active staff role), with only the `purchase_cost` column field-masked by role
via a small reusable helper, `maskIfNotOwner<T>` (`src/lib/mask.ts`) — the first field-level
role-based masking in this codebase (`product.service.ts`/`cost_price` has no precedent for it).

Re-audited as part of ADR-0027 (Phase 14) — see that ADR for the Server Action call-site check.

## ADR-0027 — Phase 14 RBAC test-coverage audit: route×minRole matrix + Server Action manual audit baseline

Status: accepted (Phase 14, 2026-09-03)

Phase 3-12 built ADR-0011's 4 boundaries + ADR-0026's 5th on a single layer of protection: a
`requireOwner()`/`requireAdmin()` call at the top of each route handler or Server Action. Nothing
in the test suite would have caught a refactor that silently dropped one of those calls — the only
HTTP-level auth test (`tests/phase-3-route-auth.test.ts`) accepted both 401 *and* 403 as a pass,
which cannot distinguish "no session" from "valid STAFF session hitting an OWNER-only route." Phase
14 closes that gap. No boundary, no middleware, and no route handler changed — this is a
test-coverage-only phase (see `docs/exec-plans/completed/phase-14.md`).

**Route-level audit (`src/app/api/**/route.ts`).** Every route method was read and assigned a
`minRole: 'STAFF' | 'OWNER'` (24 files, 24 protected method+path combinations once the deliberately
public GET/`/api/public/*` routes are excluded — see the comment block in
`tests/phase-3-route-auth.test.ts`). One route was found with **zero** auth-test coverage:
`POST /api/admin/pricing/parse-3mf` (shipped in Phase 9, calls `requireAdmin()` correctly in code —
this was a test gap, not a real permission bug). It has been added to the route table. No route was
found missing its `requireOwner()`/`requireAdmin()` call — the 4+1 boundaries from ADR-0011/ADR-0026
map cleanly onto `DELETE /api/products/[id]`, `DELETE /api/products/variants/[id]` (boundary #3),
`GET/POST /api/staff` + `PATCH /api/staff/[id]` (boundary #1), and `GET /api/audit-logs`
(boundary #4) all correctly calling `requireOwner()`; every other protected route correctly calls
`requireAdmin()`.

`tests/phase-3-route-auth.test.ts` was rewritten (not replaced with a new file — same discovery
path in `tests/helpers/test-runner.ts`) to run 3 scenarios per route: no cookie (expect 401 or
403), a real STAFF session cookie against an OWNER-only route (expect **exactly** 403, the actual
fix — no longer accepting 401 as an equivalent pass), and a session cookie meeting the route's
minimum role (expect neither 401 nor 403). The STAFF/OWNER accounts are minted for real via
`tests/helpers/rbac-accounts.ts`, reusing `e2e/admin.spec.ts`'s
`supabase.auth.admin.createUser`/`deleteUser` throwaway-account pattern, then signed in through
`@supabase/ssr`'s own `createServerClient` + `auth.signInWithPassword()` storage adapter so the
resulting `Cookie` header is produced by the same code the app uses in production — not a
hand-built/faked JWT.

**Server Action manual audit (`expense.service.ts`, `pricing-config.service.ts`,
`filament.service.ts`).** These are Server Actions, not `route.ts` handlers, and are out of scope
for the HTTP-level table above (Next.js Server Action endpoints are opaque, encoded POSTs, not
stable URLs — building an equivalent HTTP harness for them was judged not worth the cost against
manually auditing 3 files once; see `docs/exec-plans/completed/phase-14.md` Non-goals). All three
services trust an already-authorized `actorId`/`actorRole` passed in by the caller and never
re-check role themselves (as ADR-0026 already documents for `expense.service.ts`). Every caller was
read and confirmed to call `requireOwner()`/`requireAdmin()` as its first line, before any input
parsing or service call:
- `src/app/admin/(protected)/expenses/actions.ts` — `createExpenseAction`, `updateExpenseAction`,
  `cancelExpenseAction` all call `requireOwner()` first.
- `src/app/admin/(protected)/expenses/page.tsx` and `expenses/[id]/page.tsx` (Server Components
  reading `expense.service.ts` directly) also call `requireOwner()` first — necessary because the
  shared `(protected)` layout only enforces `requireAdmin()` (any active staff), not `requireOwner()`
  specifically, so an OWNER-only page must still gate itself.
- `src/app/admin/(protected)/settings/pricing/actions.ts` (`createPricingConfigAction`) and
  `settings/pricing/page.tsx` both call `requireOwner()` first, for the same reason.
- `src/app/admin/(protected)/materials/actions.ts` (`createFilamentSpoolAction`,
  `adjustSpoolStockAction`) call `requireAdmin()` first, matching `filament_spools`' `STAFF`-visible
  boundary from ADR-0026.

No bug was found — this audit is a baseline recorded for the *next* re-audit, not a fix. **Re-audit
trigger:** re-run this manual check whenever a new Server Action is added to any of these three
files, or whenever this ADR is more than ~6 months old, whichever comes first — a dated baseline
with no re-audit process attached decays into false confidence (this ADR's own stated risk).

## ADR-0028 — Phase 17 browser keychain geometry and advisory pricing

Status: accepted (Phase 17, 2026-09-04)

The public keychain tool creates geometry in millimetres in the browser. Enclosed volume is the
absolute signed-tetrahedron sum over every triangle, divided by 1,000 to convert mm³ to cm³. PLA
weight uses `volumeCm3 × 1.24 g/cm³`, assuming a solid thin part. Print time uses the fixed Phase 17
heuristic `12 + weightGrams × 1.8` minutes. The owner must validate the weight heuristic against
five physical prints; that manual measurement is deliberately not claimed by the implementation.

The keyring hole is a `THREE.Path` attached to the base `THREE.Shape.holes` before extrusion. This
lets Three.js/Earcut triangulate the through-hole without a CSG dependency or coplanar boolean
artifacts. Base and raised-text geometries remain separate for the two-colour preview, then are
merged into one `BufferGeometry` and exported as exactly one STL file. Colours are request metadata,
not separate materials in the STL.

The browser sends only estimated grams and minutes to the public price-estimate route. That route
loads the current pricing config and active PLA unit cost from PostgreSQL, runs the existing
cost-plus calculator server-side with five minutes of handling labor, and returns only a range. The
range is the calculated price ±15%, rounded outward to 1,000 VND. This range width and handling-time
allowance fill a gap left unspecified in the Phase 17 brief and are intentionally advisory. No raw
pricing config or cost breakdown crosses the public boundary, and no Quote row is created.

## ADR-0029 — Phase 18 storefront i18n: next-intl, Path Branching middleware, VI-forced default

Status: accepted (Phase 18, 2026-09-04)

`next-intl` handles storefront routing/messages: VI is unprefixed default, EN lives under `/en`
(`localePrefix: 'as-needed'`). The pre-existing admin-auth `middleware.ts` (Supabase session
refresh + login redirect, matcher `/admin/:path*`) and next-intl's locale middleware cannot
coexist as separate files — Next.js only runs one middleware per project — so they're merged into
a single `middleware.ts` (relocated to `src/middleware.ts`, alongside `src/app`, which is where
Next.js actually looks for it when the app lives under `src/`) using independent path branching:
`/admin/*` always calls `updateSession()` exactly as before; everything else goes through
next-intl. Neither branch wraps or calls into the other, so a future change to one can't silently
affect the other.

`routing.localeDetection` is explicitly set to `false`. next-intl's default behavior negotiates a
locale from the visitor's `Accept-Language` header, which would silently serve EN on the
unprefixed `/` to any browser configured for English — directly contradicting the product
requirement that VI is the default regardless of browser language. With detection off, `/` always
serves VI; a visitor only gets EN by explicitly using the `LanguageSwitcher`.

The `LanguageSwitcher` renders plain `<a>` tags (a full page navigation) rather than next-intl's
client router. The root layout's `<html lang>` lives above the `[locale]` segment and does not
re-render on a client-side soft navigation between locales — only a real navigation re-runs
middleware and the root layout with the new locale. This was caught by a Playwright test
(`e2e/i18n.spec.ts`) asserting `<html lang>` after a locale switch; the fix trades a full-reload
cost (acceptable for an infrequent action) for correctness.

Content translation is scoped to nav/footer/home/products list & detail/4 static policy pages
(phase-18.md's Non-goals). Pages outside that slice (`cart`, `checkout`, `custom-print`, `blog`,
`quotes/[quoteNumber]`) are still reachable under `/en/...` but render their existing Vietnamese
content, with a `<UntranslatedNotice />` banner (added via a nested `layout.tsx` per route, since
it's a server component and several of those pages are client components) making that explicit
rather than silently mixing languages.


## Phase 20 — Organizer implementation clarifications
- Auto-fit preserves preceding custom cells and fills the last cell with remaining clear space after all walls; it rejects nonpositive cells. The 30mm minimum applies to all three outer tray dimensions.
- The locked overlapping-box merge produces intersecting closed shells, not a boolean-unioned manifold. The unchanged mesh estimator counts overlap volume; advisory estimates can consequently be slightly high. Slicer inspection and owner physical prints remain required.
- `(tools)` inherits the locale provider; route groups do not change URLs. Existing middleware applies i18n to public tool URLs and Supabase session handling only to `/admin`. No middleware changes are required.

## Admin correction UX — 2026-09-05

Owner reports that accidental admin input cannot conveniently be corrected. First slice:
spool metadata editing and reversible archival, using the existing ACTIVE/ARCHIVED status
and phase-12 inventory semantics. Admins may edit spool code, core flag and notes; stock
corrections still require a reason and an immutable movement. Material, warehouse, purchase
cost and original weight are deliberately outside this metadata patch to avoid rewriting
inventory/financial history. Archive hides the spool from the default active list and active
spool totals, without changing weight or ledger entries; restoring makes it active again.
An archived spool cannot be consumed (existing recordSpoolUsage row lock/status check).
Archive does not cancel assigned print jobs: operators must pick an active spool before
starting them. Archive is not a reversal of an erroneous PURCHASE movement.

Existing admin auth is enforced by every new server action; all successful edits/status
changes write audit records in the same transaction. Repeated status submissions are no-ops.
The UI asks for confirmation before archive/restore and exposes recoverable error messages.

## ADR-0030 — `QuoteModelSnapshot` is versioned (v1 | v2) and read tolerantly

Status: accepted (makerworld-profile-verification Phase A, 2026-10-12)

- `quotes.model_snapshot` (JSONB) now has two shapes. v1 = Phase 13 (`sourceUrl`, `title`, `coverImageUrl`, `platesCount`, `totalPrintMinutes`, `colorsCount`); legacy rows carry no `schemaVersion` and are tagged `1` by a `z.preprocess` step. v2 adds the verified print profile (`profileId`, `profileTitle`, `profileCoverImageUrl`, `printerTarget`, `netWeightGrams`, `amsRequired`, `tier`, `dataSource`, `license`, `licenseAcknowledged`) and the hard gate `profileVerified: z.literal(true)`.
- `z.discriminatedUnion('schemaVersion', …)` instead of `z.union([v2, v1])`: a plain union reports the v1 branch's "unrecognized keys" error and hides the real v2 failure (e.g. `profileVerified`). `.default(2)` was rejected because it would turn every legacy v1 row into an invalid v2.
- The TS type is `z.infer` of the schema, so UI code must narrow on `schemaVersion` — a field legacy rows lack can't be assumed.
- Reads go through `readQuoteModelSnapshot()` (`safeParse`; corrupted → `null` + `[QUOTE_SNAPSHOT_CORRUPTED]` log). An image URL that no longer passes the allowlist is dropped (placeholder), not the whole snapshot.
- Immutability is unchanged (ADR-0022): no update path; v2 is only produced at quote creation. No migration (JSONB).
- Server-side consistency (B10): when a quote has both `pricing_breakdown` and a snapshot, `createQuote` inverts `machineDepreciationVnd`/`electricityCostVnd` with the referenced `pricing_configs` row to recover the print minutes the price was computed from, and rejects (`QUOTE_SNAPSHOT_MISMATCH`) if it differs from `totalPrintMinutes` by > ±15% (floor 3 min) or if priced grams are > 15% below a v2 `netWeightGrams`. Manual price edits are allowed and audited as `MANUAL_PRICE_OVERRIDE`.

## ADR-0031 — MakerWorld resolver: verified payload shape and exact-host image allowlist

Status: accepted (makerworld-profile-verification Phase A, 2026-10-12)

- Verified on the live page of model 3246150: data is at `props.pageProps.design` (Phase 13 assumed `designDetail` and could never have parsed a real page). `#profileId-<n>` in model URLs matches `instances[].id` (not `instances[].profileId`). `prediction` = seconds, `weight` and `instanceFilaments[].usedG` = grams (usedG is a string), plates = `extention.modelInfo.plates.length`, printer = `extention.modelInfo.compatibility.devProductName`, `needAms` boolean, `design.license` string.
- Every third-party value is Zod-bounded; profiles with missing time/grams are returned with `dataIncomplete: true` and cannot be priced from resolver data (they would otherwise become 0đ cost lines that B10 cannot catch, since 0 = 0).
- One 6 s deadline for the whole redirect chain + body read; body streamed and capped at 3 MB.
- Image URLs (rendered on the PUBLIC quote page next to the VietQR code) are restricted to EXACT hosts: `makerworld.com`, `image.makerworld.com`, `makerworld.bblmw.com` (the real CDN). Rejected wildcards: `*.aliyuncs.com` (any Alibaba OSS customer — owner decision), `*.bambulab.com` / `*.makerworld.com` (forum/wiki hosts serve user uploads). Add a host only after seeing it in a real payload. Residual risk: an allowlisted profile cover is still chosen by whoever uploaded the model — staff verification is the control.
- Measured, not assumed: the admin route logs `[MAKERWORLD_RESOLVER] { outcome }` so the Cloudflare block rate from the datacenter IP is known before any public (Phase B) flow is built.

## ADR-0032 — Two finishing tiers = two quotes; same-link siblings auto-reject; license acknowledgement

Status: accepted (makerworld-profile-verification Phase A, 2026-10-12)

- One quote carries exactly one price and one `snapshot.tier` (`ASSEMBLED` | `KIT`), so `quotes.total`, the 50% deposit and its VietQR stay a single immutable number. Storing `options[]` in one quote was rejected (would make the deposit/QR dynamic and break ADR-0022).
- When the customer has not chosen, staff create one quote per tier. `acceptQuote` then rejects the still-open (`DRAFT`/`SENT`) quotes with the exact same `model_snapshot.sourceUrl` (audit `QUOTE_AUTO_REJECTED_SIBLING`) and refuses to accept a same-link sibling once one is `ACCEPTED` (`QUOTE_SIBLING_ALREADY_ACCEPTED`). Quotes without a snapshot, or for a different link/profile, are never touched. `sourceUrl` is canonicalised to the model URL + `#profileId-<selected profile>` (manual entries get `#manual-<fingerprint>`), so tiers of one profile group together and different profiles don't.
- Lock order in `acceptQuote` is `custom_requests` row → quote row (same as `createQuote`), which serialises concurrent accepts of siblings instead of deadlocking.
- Tier default labor lives in code (`ASSEMBLY_TIERS`: ASSEMBLED 50 min + optional glue/consumable line, KIT 20 min) and stays staff-editable; move it to `pricing_configs` if it starts changing often.
- B6 (Phase A part) — **revised by Owner 2026-10-12**: BaSa3D quotes third-party designs as a personal, non-commercial print-on-request service, so a design whose license forbids commercial use (MakerWorld's default "Standard Digital File License", CC *-NC) is quoted **directly** — no per-quote checkbox. The admin panel writes the shop-wide basis onto the v2 snapshot (`licenseAcknowledged: true`, `licenseBasis: 'PERSONAL_NON_COMMERCIAL'`, from `src/lib/copyright/print-service-policy.ts`) together with the `license` name. The schema still rejects a restricted-license snapshot WITHOUT a basis, so every such quote keeps an auditable reason. The parser never classifies a license as "allowed"; if the business model changes (e.g. selling printed stock), change the policy, don't delete the check. The license-compliance judgement itself remains the Owner's.

## ADR-0033 — Storefront MakerWorld prices come from admin-verified presets

Status: accepted (makerworld Phase B, 2026-10-12; owner decisions D1–D5 in `docs/exec-plans/active/makerworld-phase-b-storefront-estimate.md`)

- A customer pasting a MakerWorld link at `/custom-print` sees a price only from (1) **VERIFIED** presets — pricing inputs staff saved from the admin MakerWorld panel ("Lưu làm giá Storefront"), re-priced on every lookup with the current `pricing_configs` row and material costs (D3); or (2) **AUTO** — the server resolver + the same rules with the median active material cost of each type, rounded to 5.000đ, behind `MAKERWORLD_PUBLIC_RESOLVER_ENABLED` (off by default, D4), cached 24h per model with a global hourly call budget. Otherwise **NONE**: no price, the customer can still send a request. No guessed numbers.
- Admin panel, presets and the auto estimate all go through `src/lib/pricing/makerworld-pricing.ts` (waste via `defaultWasteRatioPctForProfile`, labor via `ASSEMBLY_TIERS`, `computePricingBreakdown`, ADR-0010 rounding), with a parity test.
- The public endpoint accepts only `{ url }` (B1: no client grams/minutes → no margin reverse-engineering) and returns a DTO without breakdowns, unit costs, material ids or config ids. "No pricing config" is a 200 with `reason: NO_PRICING_CONFIG`, not a 503.
- Abuse protection is a Vercel Firewall rate-limit rule on `/api/public/makerworld-estimate` (B5 — no DB rate limiter); the VERIFIED path only reads the DB.
- Intake stores `custom_requests.makerworld_snapshot` (choice + the reference price recomputed server-side at submission). Prices are never accepted from the browser.
- B6 is superseded by the owner's personal/non-commercial print policy (ADR-0032): MakerWorld requests are not auto-flagged `ip_risk_flag`.
- STAFF and OWNER may save presets; only OWNER may enable/disable them (D2). VERIFIED prices are shown exactly (D1).
- **Update 2026-10-12 (Owner, D4 changed):** the AUTO estimate is turned on (`MAKERWORLD_PUBLIC_RESOLVER_ENABLED=true`) so pasting any link returns a price immediately. When MakerWorld doesn't state AMS for a multi-color profile, AUTO prices it as AMS (higher waste) so an automatic estimate never undercharges. The flag stays as a kill-switch if Cloudflare blocking or abuse shows up in the `[MAKERWORLD_RESOLVER]` logs.

## ADR-0034 — Quote-first instant estimates without MakerWorld's servers (spec paste, sliced 3MF, mesh)

Status: accepted (Owner, 2026-10-12)

- Context: MakerWorld now puts a Cloudflare challenge in front of every automated request (its own JSON API returns 403 without a browser-solved `cf_clearance`), so server-side reads fail even from a home IP. Bypassing that (headless solvers, borrowed cookies, proxies) is out of scope (non-goal; bot-detection must not be circumvented).
- Decision — all estimates use the same shared rules as the admin panel (`makerworld-pricing.ts` → `computePricingBreakdown`), rounded to 5.000đ, labelled "ước tính", recomputed server-side at submission (the browser never sends a price):
  1. **MakerWorld link, no verified price** → the card asks the customer to paste the profile's spec line from the MakerWorld page; `/api/public/makerworld-estimate` accepts `{ url, specText }`, parses it with the admin spec-text parser and returns both tiers (`source: SPEC`). Unknown AMS on multi-color is priced as AMS.
  2. **Uploaded file** (`/custom-print`) → quote-first: upload (existing rate-limited private upload) → `/api/public/file-estimate { attachmentPath, materialType }`: sliced `.3mf` = exact (slice_info time + grams, no extra waste; ráp sẵn/kit tiers when >1 plate); `.stl/.obj` = price range from mesh volume × PLA density × fill 0.35–0.75; `.step`, images, resin = staff quote. Contact details are asked only after the customer chooses to go ahead. The chosen option is stored in `custom_requests.quote_estimate_snapshot` (migration `20261014000000`).
  3. Verified presets (ADR-0033) remain the exact path and are unaffected.
- Trade-off accepted by the Owner: SPEC lets a customer feed arbitrary minutes/grams, so a determined person can approximate the shop's rates; mitigated by 5.000đ rounding, server-side parsing bounds and the Vercel Firewall rule. File parsing is bounded (20MB, 3M triangles, strict storage-path regex) and rate-limited per IP (DB limiter, same precedent as `tool-price-estimate`).

## ADR-0035 — `/bao-gia`: browser-side metrics, 1 item = 1 Quote, versioned VAT

Status: accepted for implementation (Phase 33, 2026-10-13; Owner decisions D1–D5, O3–O6 and D6–D7 in
`docs/exec-plans/active/phase-33-bao-gia-instant-quote.md` §2 and §12b). Production enablement waits for
the S0 calibration.

- **Estimates from metrics, never from a price.** On `/bao-gia` the browser parses STL/OBJ in a Web
  Worker with the shared `src/lib/pricing/mesh-metrics.ts` (same code the server runs) and sends only
  metrics to `POST /api/public/quote-estimate`; the server prices them with the cost-plus engine and
  the gram + print-time model `src/lib/pricing/fdm-estimate-model.ts` (shell + infill + support grams;
  layer-aware minutes), rounded to 5.000đ, 25.000đ floor per line, > 256 mm → staff quote. Metrics are
  checked for physical plausibility (V ≤ box, isoperimetric inequality). Accepted trade-off (as ADR-0034
  SPEC): fake metrics show a fake estimate but never change a binding price.
- **v1 is STL/OBJ only** (D6). `.3mf` stays on `/custom-print` (sliced → exact, unsliced → range, which
  `/custom-print` keeps until calibration, O3). v2 may read `slice_info` of sliced 3MF in the browser.
- **Submission re-verifies.** Files go browser → Storage via signed upload URLs (tokens live 2 h,
  Supabase-fixed; mitigated by per-IP rate limit, bucket limits, Content-Type + magic-byte checks and a
  daily orphan cleanup). At submit the server inspects each object and re-measures it within a 20MB
  budget: VERIFIED / MISMATCH (> 2% volume difference → server numbers) / CLIENT_REPORTED (beyond budget)
  / UNPRICED. Request + items are written in one transaction.
- **1 item = 1 Quote** (D2). Items live in `custom_request_items` (UPDATE never, DELETE only behind the
  session flag `basa3d.allow_item_purge`); `quotes.custom_request_item_id` with a composite FK to the same
  request. Sibling auto-reject keys on the item, else the MakerWorld `sourceUrl`. Staff re-verification of
  a CLIENT_REPORTED item is on demand and audited, never written to the item.
- **VAT is versioned config**, snapshotted on quotes/orders; the DB checks only the total and "no VAT
  money without a rate"; the formula is `src/lib/pricing/vat.ts` (base pending O2). VAT per item/quote,
  so the estimate total equals the sum of the N quotes.
- Up to **50 items** per request (Owner, 2026-10-13; DB check `custom_request_items_position_range`).
  The browser preview measures the part directly (X/Y/Z arrows + fixed-size labels) and lets the
  customer resize it uniformly by mm per axis or %; scale is stored as permille (0.1% steps).
- **No deposit/payment** in this flow (D4); the public quote page's deposit QR is unchanged (O1).
- The model ships as `fdm-v0-uncalibrated` with the plan's placeholder constants; every item snapshot
  records `modelVersion`. `/bao-gia`, its nav link, sitemap entry and APIs are behind
  `NEXT_PUBLIC_BAO_GIA_ENABLED` (default off) until `scripts/fdm-model-calibration` passes on the shop's
  own sliced files and the constants become `fdm-v1`.

## ADR-0036 — Admin performance: connection pooling, instant click feedback, and query consolidation

Status: accepted (2026-10-13, implemented in Phase 28 follow-up)

- **Root cause of admin lag & unresponsiveness**: Remote Supabase database is hosted in Tokyo (~90ms RTT from Vietnam). Concurrently firing 10+ queries on admin dashboard caused pool queue starvation when pool was constrained. The client navigation previously lacked immediate visual feedback, giving a "frozen" feeling. An attempt to force `router.push()` inside `<Link>` created competing transitions that aborted fetches and triggered `error.tsx` ("Không thể tải nội dung quản trị").
- **Connection pooling (`src/lib/db.ts`)**: Increased pool capacity to `max: 20` to comfortably accommodate parallel dashboard queries; relaxed `connectionTimeoutMillis` to 30s (`30000`) to avoid false-positive connection aborts over international WAN latency; persisted pool on `globalThis.__basa3d_pool` during `next dev` to prevent connection leaks across hot reloads.
- **Zero-lag navigation feedback without route abortion (`src/components/admin/admin-nav.tsx`)**: Menu items use Next.js native `<Link>` with a local `navigatingHref` click state. On click, the clicked nav item immediately renders an active border and `<Loader2>` spinner (0ms visual confirmation), while `<Link>` performs standard App Router soft navigation. State resets when `pathname` updates. No double `router.push()` or `useTransition()` conflicts.
- **Query consolidation (`src/services/dashboard.service.ts`)**: Subquery batching combines independent count metrics into single SQL statements (`getOperationalMetrics` combines 4 counts; `getFinancialMetrics` combines 2 revenue sums), cutting multiple remote network round-trips to Tokyo.
- **Site contact configuration (`src/config/site.ts`)**: Updated official email to `basa3d.vn@gmail.com` and shop location to `Hồ Chí Minh, Việt Nam`.

## ADR-0037 — UI/UX design system standard and automated Playwright probe (evondevKit)

Status: accepted (Owner, 2026-10-14)

- **Context**: BaSa3D contains complex operational screens (admin production tracking, inventory movements, machine status), customer intake flows (instant quotes on `/bao-gia`, multi-step upload of STL/3MF files), and storefront product displays. Without a strict UI design system and verification protocol, AI code generation risks producing inconsistent components, missing boundary states (loading skeletons, empty states, error fallbacks), or breaking mobile viewports.
- **Decision**: Adopt the open-source `evondevKit` (by Tran Anh Tuan / evondev) as a canonical agent skill in `.agents/skills/ui-ux/` (thin mirror at `.claude/skills/ui-ux/`):
  1. **Stack adherence**: Skill audits existing components first (`src/components/ui/` with shadcn/ui) and forbids reinventing buttons/inputs or adding competing UI libraries.
  2. **Comprehensive state handling**: All screens must account for initial empty states, loading skeletons, validation errors, and disabled triggers.
  3. **Automated visual inspection (`probe.mjs`)**: Leverages project-level Playwright to audit routes across viewports (375px to 1920px), catching horizontal overflows, tap targets < 32px, keyboard navigation traps, and contrast issues.
  4. **Non-disruptive integration**: Kept as an engineering guideline and automated verification tool; does not introduce extra runtime npm dependencies to the production app.
## ADR-0038 — Pre-launch public-boundary hardening

Status: accepted (Phase 34, Gemini challenge reconciled 2026-10-14)

- Public checkout idempotency is stored atomically on `orders` with a unique nullable
  `checkout_request_id` and canonical SHA-256 request hash. Same-key/same-payload retries replay
  the committed order without another notification; changed payloads return 409.
- Private direct uploads carry a stateless, expiring, path-bound HMAC capability signed with a
  dedicated `UPLOAD_CLAIM_SECRET`. A random Storage path alone never authorizes a public
  service-role read.
- Public abuse limits remain in application code even when Vercel Firewall is configured. The
  shared PostgreSQL limiter is one atomic UPSERT; stale-row deletion never runs synchronously on
  the request path.
- Baseline browser headers are enforced by the app. CSP begins in Report-Only mode with a static
  hash for the fixed theme bootstrap; HSTS remains a production-domain deployment control.

## ADR-0039 — MakerWorld estimate from a customer screenshot (vision model)

Status: accepted for implementation, behind `MAKERWORLD_SCREENSHOT_ESTIMATE_ENABLED` (default off).
Plan: `docs/exec-plans/active/makerworld-screenshot-estimate.md`.

- Context: ADR-0034's spec paste works but customers rarely copy/type the spec line. Circumventing
  MakerWorld's Cloudflare challenge stays a non-goal.
- Decision: the customer uploads a screenshot of the profile section (existing signed-upload flow)
  and sends it **in the same request** as the link. The server asks a vision model (Gemini via REST,
  no SDK; default `gemini-3.5-flash-lite`) for a JSON list of profiles, Zod-bounds every value, prices each complete profile with the
  SPEC rules (`estimateFromSpec`) and stores the result in `makerworld_screenshot_estimates`. The
  browser only gets `screenshotEstimateId` + profile keys `p0..p9`; submission sends the id + key and
  the row is consumed in the same transaction that creates the custom request (single use, 2 h TTL).
- Link ↔ screenshot check is model-level only (model id visible in the screenshot, else URL slug vs
  extracted title): MATCH / MISMATCH / UNKNOWN; MISMATCH hides prices. Profile-level correctness is
  confirmed by staff in the Phase A panel.
- Trade-offs: a fake screenshot yields a fake *estimate* only (same as SPEC); customer screenshots
  are sent to a third-party AI provider; per-call cost bounded by 10/h/IP and 200/h global.

## ADR-0040 — Phase 36 data-integrity guards (post-go-live audit)

**Context.** A 4-way audit (orders/inventory, auth/RBAC, public surface, migrations) before DNS
cut-over found no blocker but ~20 integrity gaps; several were reproduced against a real PostgreSQL
(the sandbox now runs migrations + `next build` + the full test runner).

**Decisions.**
- Idempotent checkout replay is resolved **inside** the transaction right after the variant lock,
  before stock/catalog checks — a retry for the last unit returns the original order (rule #21).
- Order cancel cascades to unstarted print jobs; payment/shipping on a `CANCELLED` order is limited
  to `REFUNDED`/`RETURNED` without an OWNER override (rule #22).
- Manual stock-outs check warehouse on-hand and Available Stock (rule #23). Chosen over "allow and
  warn" because the failure otherwise surfaces later as `INSUFFICIENT_STOCK_FOR_FULFILLMENT` at
  PRODUCING, far from the cause. Trade-off: staff must cancel reserving orders before recording a
  physical loss that exceeds unreserved stock.
- **Assumption (owner to confirm):** manual quotes with no item and no MakerWorld link are revisions
  of one another — at most one can be accepted per request. Multi-part manual work should use
  `/bao-gia` items or separate requests. If the shop needs several accepted manual quotes per
  request, relax `acceptQuote`'s null-sibling rule.
- History deletion is refused in the service and backstopped by triggers
  (`prevent_accepted_quote_delete`, `prevent_started_print_job_delete`). Test cleanup may opt out per
  transaction via `set local basa3d.allow_history_purge = 'on'` — never from app code.
- `pricing_configs` becomes truly insert-only (UPDATE/TRUNCATE refused, FKs `RESTRICT`).
- Migration `20261019000000` fixes Phase 35's function-privilege revoke, which was a no-op: the
  PUBLIC EXECUTE default is global and can only be removed by `alter default privileges` **without**
  `in schema` (verified: a new function was executable by `anon` before the fix).

**Migration cost.** One forward migration, no data rewrite except a nullable
`order_items.product_type_snapshot` backfill. FK swap and new triggers take brief locks on small
tables.

## ADR-0041 — Timestamps are `now()`; calendar buckets are Asia/Ho_Chi_Minh

**Context.** Column defaults used `timezone('utc', now())`, which yields a timestamp *without* time
zone that PostgreSQL re-interprets in the session TimeZone. Hosted Supabase (UTC) stored correct
values, but any non-UTC session (the owner's Homebrew test DB) stored times 7 h early — which made the
phone-number rate limits on public submissions silently never trigger (reproduced by
`phase-4`/`phase-5` route tests and `pricing-config-service.test.ts`). Separately, dashboard
"orders today", "revenue this month" and expense months used the session/UTC calendar, so 00:00–07:00
Vietnam time counted as the previous day in production.

**Decision.** All defaults and `set_updated_at()` use `now()`. Every calendar bucket goes through
`src/lib/business-time.ts` (`at time zone 'Asia/Ho_Chi_Minh'`), never `current_date` /
`::date` on a timestamptz.

**Trade-off.** Constant time zone (no DST in Vietnam); a future multi-country shop would make it a
setting.

## ADR-0042 — Purpose-bound access tokens, per-resource phone-suffix budget, /64 IPv6 rate-limit keys

- Tokens are `o1.<id>.<exp>.<sig>` (order) / `q1.<id>.<exp>.<sig>` (quote); the purpose is part of
  the signed message. Legacy 3-part quote links already sent over Zalo stay valid until they expire,
  but only if they expire before 2027-01-31 — delete the legacy branch in
  `src/lib/order-confirmation-token.ts` after that date. Legacy order links (45 min TTL) are not
  accepted after deploy; affected customers fall back to the phone-suffix page.
- The 4-digit phone check gets 10 wrong guesses per order/quote per 24 h, counted atomically before
  the compare and refunded on success (rule #25). Trade-off: an attacker who knows an order number
  can lock the phone-suffix path for that order for a day; the token link and staff remain.
- Rate-limit keys group IPv6 by /64 and fold IPv4-mapped addresses; `x-real-ip` is preferred.
- Server-action positional args are parsed with `src/lib/action-args.ts`; a static test enforces it
  for every `actions.ts`, and another walks the import graph so no `'use client'` module can reach
  `db`, secrets or `services/*` (instead of adding the `server-only` package).
