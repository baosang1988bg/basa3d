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

## ADR-0008 — Separate inventory ledgers for finished product variants vs raw materials
Status: accepted

Finished product variants (`product_variants`, counted in pcs) and raw printing materials (`materials`, tracked in grams/spools) have different tracking units and lifecycle triggers. Instead of a single polymorphic table, raw material stock movements are recorded in a dedicated `material_movements` table (`PURCHASE`, `PRODUCTION_OUT`, `RETURN_IN`, `DAMAGE_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`), keeping `inventory_movements` clean and strictly typed for `product_variants`.

## ADR-0009 — Order payment status includes DEPOSIT_PAID
Status: accepted

3D printing bespoke / made-to-order requests standardly require an upfront deposit (e.g. 50%) before production begins. `orders.payment_status` includes `DEPOSIT_PAID` (`UNPAID → DEPOSIT_PAID → PAID`, plus `REFUNDED`) from Phase 1 migration onward to support partial payments natively without schema migrations later.

## ADR-0010 — Price rounding rule (ceil to nearest 1,000 VND)
Status: accepted

Calculated selling prices from the cost-plus formula are rounded up to the nearest 1,000 VND (`Math.ceil(Price / 1000) * 1000`). This satisfies the integer money storage rule (VND = 1 unit, `AGENTS.md`) and matches standard retail pricing practice in Vietnam.
