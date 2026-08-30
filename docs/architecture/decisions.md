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
