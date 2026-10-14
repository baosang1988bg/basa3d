# Phase 34 — Pre-launch security hardening

**Status:** implementation complete locally — awaiting disposable-DB integration run and OWNER Vercel verification  
**Owner:** Codex  
**Trigger:** security audit on 2026-10-14 before Cloudflare domain purchase / Vercel go-live

## Phase brief

- **Goal:** close the concrete pre-launch security gaps found in the 2026-10-14 audit without changing product behavior or introducing a new infrastructure service.
- **Non-goals:** payment integration, customer accounts, CAPTCHA/Turnstile, Cloudflare orange-cloud proxying, replacing Supabase Auth, or redesigning checkout/upload UX.
- **Inputs:** existing Next.js/Supabase implementation, private attachment bucket, DB-backed rate limiter, Vercel DNS-only deployment decision, and the current dirty worktree owned by the user/Gemini.
- **Outputs:** patched production dependencies, baseline HTTP security headers, in-app abuse limits for public write/resolver routes, retry-safe public checkout, upload-path capability validation, tests, and deployment documentation.
- **Risks:** changing the order transaction can create duplicate/incorrect orders; capability enforcement can strand existing clients or uploads; CSP can break Next.js hydration/images; edits must not overwrite unrelated in-progress Phase 28/32/33 work.
- **Definition of Done:** all scoped controls are implemented, migration/docs agree with code, focused tests plus lint/typecheck/full test/build pass, `npm audit --omit=dev` has no unresolved applicable high findings, and deployment-required settings are explicit.

## Evidence from audit

- `next@15.5.24` and transitive runtime packages have known advisories with fixes available.
- `POST /api/public/orders` and `POST /api/public/custom-requests` rate-limit only by phone number.
- `/api/public/makerworld-estimate` relies only on a manually configured Vercel Firewall rule.
- Public order creation commits before minting the response token and has no client request id.
- Attachment estimate/submit trusts possession of a random storage path; the path is not paired with a server-verifiable capability.
- `next.config.mjs` has no application security-header baseline.
- Local feature flags enable cart, MakerWorld resolver, and `/bao-gia`; Production state remains an operational verification item, not an assumption.

## Reconciled decisions (post-Gemini challenge)

### D1 — Checkout idempotency stored on `orders` (Confirmed & Enhanced)

Add nullable `checkout_request_id uuid` and `checkout_request_hash varchar(64)` to `orders`, with a unique partial index on non-null request IDs (`orders_checkout_request_id_idx`).
- **Canonical Hashing:** Payload is canonicalized (items sorted by `variantId`, customer strings trimmed) before SHA-256 hashing.
- **Conflict Handling:** Catch PostgreSQL error `23505` on `orders_checkout_request_id_idx`. If `checkout_request_hash` matches, return the existing order with `{ isReplay: true }`; if mismatched, return `409 IDEMPOTENCY_CONFLICT`.
- **Notification Guard:** `sendStaffNotification` runs outside the transaction and is suppressed when `isReplay === true`, guaranteeing exactly one notification under simultaneous retries.
- **Fail-fast Config Check:** `assertOrderConfirmationConfigured()` is evaluated at the start of `POST /api/public/orders` before any database connection or transaction begins, preventing committed orders with 500 response errors.
- Staff-created orders keep both fields null.

### D2 — Upload ownership via stateless HMAC capability (Confirmed)

Return an `uploadClaim` beside every server-generated upload path/token (`requests/<uuid>.<ext>.<expiresAt>.<signature>`) signed with `UPLOAD_CLAIM_SECRET`.
- Public estimate and submit schemas require `uploadClaim`.
- Verify with `crypto.timingSafeEqual` before any service-role Storage read or parse.
- Single-use consumption table rejected to prevent DB write latency on preflight and avoid breaking multi-step estimate tuning.

### D3 — Refactor rate limiter before expansion (Modified)

**Critical Fix:** `src/lib/rate-limit.ts` must be refactored before adding it to new routes.
- **Eliminate DoS vector:** Remove the synchronous `DELETE FROM rate_limit_attempts WHERE window_expires_at <= now()` and remove `withTransaction`.
- **Atomic UPSERT:** Use a single atomic `INSERT ... ON CONFLICT DO UPDATE RETURNING (attempt_count > maxRequests) AS is_limited` query, cutting WAN round-trips from 3 to 1. Expired windows reset in place. Stale row cleanup is moved to an asynchronous/probabilistic task.
- **Add Index:** `CREATE INDEX IF NOT EXISTS idx_rate_limit_expires_at ON rate_limit_attempts (window_expires_at)`.
- **Dimension Ordering:** Enforce `Honeypot -> IP limiter -> Schema validation -> Phone limiter` to prevent attackers locking out victim phone numbers from a single IP.
- **Budget Separation:** Separate `/api/public/makerworld-estimate` into strict budget for the AUTO external resolver (5 req / 10 min / IP) and liberal budget for VERIFIED presets / spec parsing (60 req / 10 min / IP).

### D4 — Baseline headers plus Report-Only CSP (Modified)

Do not defer CSP. Ship baseline headers **and** a staged CSP in Phase 34:
- Baseline headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Staged CSP:** Add `Content-Security-Policy-Report-Only` immediately in `next.config.mjs`.
- **Theme Bootstrap Script:** Use a static SHA-256 hash (`'sha256-...'`) for `themeBootstrapScript` in `script-src`. This avoids dynamic nonces (which break Next.js App Router SSG/ISR static optimization) and avoids external script network latency (which causes theme flash).
- **HSTS:** Keep HSTS out of app code (`next.config.mjs`) to avoid poisoning `localhost` or preview deployments. Document as an OWNER step in Vercel custom domain settings once apex domain SSL is active.

### D5 — Patch dependencies with the narrowest compatible upgrade

Upgrade Next.js to at least the patched `15.5.x` release and regenerate the lockfile. Do not take a major framework upgrade in this phase. Re-run `npm audit --omit=dev`; document any residual advisory and its applicability instead of applying `--force` blindly.

## Scope / files likely to change

- `package.json`, `package-lock.json`, `next.config.mjs`
- `supabase/migrations/20261016*_order_checkout_idempotency.sql`
- `src/domain/schemas.ts`
- `src/lib/rate-limit.ts`, new small upload-claim helper under `src/lib/`
- Public order, custom-request, upload URL, file-estimate, and MakerWorld routes
- Checkout/upload browser callers needed to carry request IDs and claims
- Order/custom-request services only where transaction or claim boundaries require it
- Focused tests under `tests/`, `.env.example`, deployment/architecture/database docs

## Non-goals / explicit deferrals

- No CAPTCHA until measured abuse justifies the UX and vendor dependency.
- No Cloudflare proxy/WAF; keep DNS-only and preserve Vercel-sanitized `x-forwarded-for` trust model.
- No malware scanning claim for STL/OBJ/3MF; current bounded parsing, size, MIME, and magic-byte checks remain. Antivirus/content-disarm is a separate operational decision.
- No live Vercel/Cloudflare mutation by Codex in this phase; dashboard configuration remains an OWNER deployment step.

## Implementation slices

### S0 — Challenge and freeze design

- [x] Read the relevant product, architecture, database, deployment, and security-review docs.
- [x] Record the audit evidence, scope, tentative decisions, risks, and DoD here.
- [x] Generate `phase-34-gemini-prompt.md` with the highest-risk questions.
- [x] Receive Gemini challenge and reconcile D1–D4 in this file.
- [x] Confirm no overlap with the user's existing dirty changes before each edited file; Phase 28 changes in shared service/schema files were preserved.

### S1 — Dependency and response hardening

- [x] Upgrade Next.js to 15.5.27 and override vulnerable transitive runtime packages without a major upgrade.
- [x] Add and test baseline headers plus Report-Only CSP with the real theme-script hash.
- [x] `npm audit --omit=dev` reports 0 vulnerabilities; typecheck and focused lint/header tests pass.

### S2 — Public abuse controls

- [x] Add IP limiter to public order creation and custom-request creation while retaining phone limits.
- [x] Add separate local/verified and AUTO in-app budgets to MakerWorld estimate while retaining Vercel Firewall defense in depth.
- [x] Ensure new 429 responses are `no-store` and occur before expensive work.
- [x] Add atomic-concurrency coverage and retain trusted-header/phone-limit route coverage; DB-backed execution awaits the disposable DB run below.

### S3 — Checkout idempotency

- [x] Add migration and schema/database documentation.
- [x] Require and persist a public checkout request ID and canonical payload hash.
- [x] Implement replay of the same order for a matching retry and 409 for changed payload reuse.
- [ ] Prove concurrent retries create one order and one notification attempt against a disposable PostgreSQL instance (test written; skipped without `TEST_DATABASE_URL`).
- [x] Fail fast on missing/short confirmation secret before any database query.

### S4 — Attachment capability

- [x] Implement domain-separated HMAC upload claims with expiry and constant-time verification.
- [x] Return claims with signed upload targets and carry them through estimate/submit clients.
- [x] Reject missing, expired, malformed, wrong-path, and wrong-signature claims before Storage access.
- [x] Keep admin signed-download behavior unchanged.
- [x] Add focused unit/route tests and document `UPLOAD_CLAIM_SECRET` deployment requirements (live route case awaits local Supabase credentials).

### S5 — Verification and release handoff

- [x] Focused unit/security tests pass; DB/Storage integration cases are present but skipped without disposable services.
- [x] Full `npm test` passes (437 total: 297 pass, 140 environment-gated skip); typecheck and production build pass. Full-repo lint is blocked by unrelated `.agents/skills/ui-ux` globals and one pre-existing unused import; all Phase 34 files pass ESLint.
- [x] Re-run the project security-review checklist and record remaining risks without claiming absolute security.
- [x] Update `docs/architecture/decisions.md`, database docs, deployment runbook, and roadmap status.
- [ ] Verify Production/Preview env checklist: confirmation secret, upload-claim secret, cron secret, site URL, feature flags.
- [ ] Do not close the phase until OWNER verifies the Vercel Firewall rule and production smoke tests.

