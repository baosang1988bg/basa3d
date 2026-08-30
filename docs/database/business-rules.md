# Database / Domain Business Rules

1. Stock is derived from inventory movements or a clearly defined stock ledger; avoid silent direct mutation.
2. A cart is not an order.
3. A paid/confirmed order must preserve the price and product name shown at purchase time.
4. Inventory reservation and deduction must be protected from concurrent overselling.
5. Custom print requests do not become production jobs until they pass the quote/approval step.
6. Every inventory adjustment needs a reason and actor.
7. Never delete financial/order history casually; prefer status changes or archival semantics.
8. Deposit policy: Deposits (`DEPOSIT_PAID`) are optional, required for orders with total value >= 300,000 VND. Orders under 300,000 VND may proceed without deposit unless requested by sales agent.
