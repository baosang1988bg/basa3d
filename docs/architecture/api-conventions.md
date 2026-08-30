# API Conventions

- Validate request payloads at the boundary using Zod schemas.
- Return stable domain-oriented error codes.
- Never expose privileged DB columns by default.
- Use idempotency for retried operations where duplicate writes are dangerous.
- Keep pricing/inventory calculations on the server.
- Enforce standard pagination caps on list APIs (default: 20, max cap: 100).
- Inject actor IDs (`createdBy`, `actorId`) strictly from server session/auth context; do not trust client request bodies for audit identity.
