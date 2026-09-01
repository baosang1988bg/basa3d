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
