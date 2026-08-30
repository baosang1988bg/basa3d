# API Conventions

- Validate request payloads at the boundary.
- Return stable domain-oriented error codes.
- Never expose privileged DB columns by default.
- Use idempotency for retried operations where duplicate writes are dangerous.
- Keep pricing/inventory calculations on the server.
