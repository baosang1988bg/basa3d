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
