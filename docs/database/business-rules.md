# Database / Domain Business Rules

1. Stock is derived from inventory movements or a clearly defined stock ledger; avoid silent direct mutation.
2. A cart is not an order.
3. A paid/confirmed order must preserve the price and product name shown at purchase time.
4. Inventory reservation and deduction must be protected from concurrent overselling.
5. Custom print requests do not become production jobs until they pass the quote/approval step.
6. Every inventory adjustment needs a reason and actor.
7. Never delete financial/order history casually; prefer status changes or archival semantics.
8. Deposit policy: Deposits (`DEPOSIT_PAID`) are optional, required for orders with total value >= 300,000 VND. Orders under 300,000 VND may proceed without deposit unless requested by sales agent.
9. `MADE_TO_ORDER` products do not require finished goods inventory to be checked or reserved at checkout. Material consumption occurs upon production job start.
10. Cancelling an order that has already consumed finished goods (`SALE_OUT` at `PRODUCING`/`READY_TO_SHIP`) must automatically record an immutable `RETURN_IN` movement to restock.
11. Raw material movements during print job start must serialize under a `materials` table row lock to prevent negative raw material balances.
12. Customer 3D design files are strictly private; storage paths are referenced in DB and accessed only via short-lived authenticated signed URLs.
13. Workflow status transitions must follow strict directed graphs; unauthorized status jumps or backward transitions are forbidden for regular operations.
14. Public order tracking must mask sensitive PII (name, phone, detailed address) and require secondary verification (e.g. phone suffix).
15. Phase 12 — a print job consumes exactly one physical filament spool (`print_jobs.spool_id`); no multi-spool/AMS support. Spool consumption must lock the specific `filament_spools` row (`FOR UPDATE`) before checking `used_weight_grams + consumed <= initial_weight_grams` and inserting the `material_movements` row — never let two concurrent jobs (or a job racing a stock-count adjustment) push a spool's `used_weight_grams` past its `initial_weight_grams`.
16. Phase 12 — `filament_spools.status` only carries 2 manually-set values (`ACTIVE`, `ARCHIVED`); the 4-tier low-stock warning shown in the Admin UI is always computed at query/render time from `(initial_weight_grams - used_weight_grams) / initial_weight_grams`, never stored, so it can never drift out of sync with the weight columns.
17. Phase 12 — `expenses` (workshop expense tracking) is 100% OWNER-only; `deleteExpense` is a soft-cancel (`status = 'CANCELLED'`), never a real `DELETE`, per rule #7 above.
