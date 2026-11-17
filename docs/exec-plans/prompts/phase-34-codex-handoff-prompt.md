Context: You are the implementation owner for Phase 34 of BaSa3D (see AI_WORKFLOW.md — Codex implements, Claude/Gemini review). Phase 33 slices S0–S2 are closed. Phase 34 has completed its kickoff audit and Gemini architectural challenge (see docs/exec-plans/active/phase-34-gemini-challenge.md); all decisions D1–D5 are reconciled in docs/exec-plans/active/phase-34-security-hardening.md.

Read first, in this order:
1. AGENTS.md — canonical engineering rules.
2. docs/exec-plans/active/phase-34-security-hardening.md — reconciled brief, decisions D1–D5, scope, and Definition of Done.
3. docs/exec-plans/active/phase-34-gemini-challenge.md — full architectural challenge, failure modes, and concrete SQL/crypto specifications.
4. docs/architecture/decisions.md (ADR-0004, ADR-0012, ADR-0014, ADR-0015, ADR-0016, ADR-0033, ADR-0034, ADR-0036).
5. docs/database/schema.md, docs/database/business-rules.md, docs/operations/deployment.md.
6. Existing code files to extend or refactor:
   - `package.json`, `package-lock.json`
   - `next.config.mjs` (headers, CSP, image remote patterns)
   - `src/lib/rate-limit.ts` (CRITICAL: must refactor before extending to new routes)
   - `src/lib/order-confirmation-token.ts` (token minting and secret validation)
   - `src/services/order.service.ts` (`createOrder`, variant lock order, transaction, post-commit notification)
   - `src/app/api/public/orders/route.ts` (checkout intake, phone limit, secret check)
   - `src/services/custom-request.service.ts` (`createCustomRequestUploadTargets`, `inspectUploadedObject`, `ATTACHMENT_PATH_RE`)
   - `src/app/api/public/custom-requests/upload-urls/route.ts` (signed upload targets)
   - `src/app/api/public/custom-requests/route.ts` and `src/app/api/public/file-estimate/route.ts` (intake routes reading attachments)
   - `src/app/api/public/makerworld-estimate/route.ts` (storefront MakerWorld resolver/presets)
   - `src/lib/theme-script.ts` (theme bootstrap script string for static hash calculation)
   - `src/app/(storefront)/checkout/` and upload forms in `/custom-print` and `/bao-gia`

Task: implement Phase 34 — Pre-launch security hardening — ONLY. Non-goals: No payment integration, no customer accounts, no CAPTCHA/Turnstile, no Cloudflare orange-cloud proxying, no replacing Supabase Auth, and no major Next.js version upgrade (stay within 15.5.x).

Scope:

S1 — Dependency and response hardening:
- Upgrade `next` to the latest patched `15.5.x` release (e.g. `15.5.25+`) and run `npm install` to update `package-lock.json`. Verify with `npm audit --omit=dev`.
- Update `next.config.mjs` to add standard baseline headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Compute the static SHA-256 hash of `themeBootstrapScript` (from `src/lib/theme-script.ts`) and add `Content-Security-Policy-Report-Only` to `next.config.mjs` headers:
  - Directives: `default-src 'self'`; `script-src 'self' 'sha256-<HASH>' https://www.googletagmanager.com`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob: https://*.supabase.co https://img.vietqr.io https://*.bblmw.com https://image.makerworld.com`; `font-src 'self' data:`; `connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com`; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`.
- Do NOT add HSTS in application code; leave HSTS for Vercel production domain settings.
- Add automated tests in `tests/security-headers.test.ts` verifying all baseline headers and CSP report-only header.

S2 — Public abuse controls & Rate limiter refactor:
- Refactor `src/lib/rate-limit.ts` (D3 critical fix):
  - Remove `client.query('delete from rate_limit_attempts where window_expires_at <= now()')` from the request path.
  - Remove `withTransaction`. Execute a single atomic SQL query using `INSERT ... ON CONFLICT (scope, limiter_key) DO UPDATE SET attempt_count = CASE WHEN rate_limit_attempts.window_expires_at <= now() THEN 1 ELSE rate_limit_attempts.attempt_count + 1 END, window_expires_at = CASE WHEN rate_limit_attempts.window_expires_at <= now() THEN now() + ($3::bigint * interval '1 millisecond') ELSE rate_limit_attempts.window_expires_at END RETURNING (attempt_count > $4) AS is_limited`.
  - Add migration creating index `idx_rate_limit_expires_at` on `rate_limit_attempts(window_expires_at)`.
- Protect `POST /api/public/orders` and `POST /api/public/custom-requests`:
  - Enforce order: Honeypot check -> IP limiter -> Zod schema validation -> Phone limiter.
  - IP limiter on orders: 10 requests / 15 min per IP.
  - IP limiter on custom-requests: 15 requests / 15 min per IP.
  - All 429 responses must include header `'cache-control': 'no-store'`.
- Protect `POST /api/public/makerworld-estimate`:
  - Separate rate-limit budgets: strict budget for external AUTO resolver (5 req / 10 min / IP) and liberal budget for VERIFIED presets / spec parsing (60 req / 10 min / IP).

S3 — Checkout idempotency:
- Migration `supabase/migrations/<timestamp>_order_checkout_idempotency.sql`:
  - Add `checkout_request_id uuid NULL` and `checkout_request_hash varchar(64) NULL` to `orders`.
  - Create partial unique index: `CREATE UNIQUE INDEX orders_checkout_request_id_idx ON orders (checkout_request_id) WHERE checkout_request_id IS NOT NULL;`.
- Fail-fast secret check:
  - Add `assertOrderConfirmationConfigured()` in `src/lib/order-confirmation-token.ts` checking `process.env.ORDER_CONFIRMATION_SECRET` (must be >= 32 chars).
  - Call `assertOrderConfirmationConfigured()` at the very beginning of `POST /api/public/orders` before any database queries.
- Order creation & conflict resolution in `src/services/order.service.ts`:
  - Canonicalize the request payload (sort items by `variantId`, trim customer strings) and compute `checkout_request_hash = sha256(canonicalPayload)`.
  - Inside `withTransaction`, attempt inserting `checkout_request_id` and `checkout_request_hash`.
  - Catch PostgreSQL error `23505` on `orders_checkout_request_id_idx`.
  - On conflict, query `orders` by `checkout_request_id`. If `checkout_request_hash` matches incoming hash, return the existing order with `{ isReplay: true, ... }`. If hash differs, throw `DomainError('IDEMPOTENCY_CONFLICT', 'Mã yêu cầu đặt hàng đã được sử dụng cho một giỏ hàng khác.', 409)`.
  - Suppress `sendStaffNotification` when `isReplay === true`, guaranteeing exactly one notification.
- Update `publicCheckoutOrderInputSchema` to require `checkoutRequestId: z.string().uuid()`.
- Update browser checkout caller to generate and retain a UUID until terminal order confirmation.

S4 — Attachment capability:
- Create `src/lib/upload-claim.ts`:
  - `createUploadClaim(path: string, ttlSeconds?: number): string`
  - `verifyUploadClaim(path: string, claim: string): boolean`
  - Format: `${path}.${expiresAt}.${signature}` using `HMAC-SHA256` with domain prefix `"cr_upload:" + path + ":" + expiresAt` and `process.env.UPLOAD_CLAIM_SECRET`.
  - Verification uses `crypto.timingSafeEqual` and validates expiration (`now + buffer < expiresAt`).
- Update `POST /api/public/custom-requests/upload-urls`:
  - Return `uploadClaim` alongside `path`, `token`, and `contentType` in `SignedUploadTarget`.
- Update `POST /api/public/file-estimate` and `POST /api/public/custom-requests`:
  - Require `uploadClaim` in the input Zod schemas whenever `attachmentPath` is provided.
  - Call `verifyUploadClaim(attachmentPath, uploadClaim)` before `estimateAttachment` or `inspectUploadedObject`. If invalid or expired, return 403 `DomainError('INVALID_UPLOAD_CLAIM', 'Liên kết tải lên không hợp lệ hoặc đã hết hạn, vui lòng tải lại file.')`.
- Update browser upload forms in `/custom-print` and `/bao-gia` to retain `uploadClaim` from the upload target response and send it during estimate and submission.

S5 — Verification and documentation:
- Run focused tests for idempotency, rate-limiting, upload claims, and security headers.
- Update `docs/architecture/decisions.md` (ADR-0037 for Phase 34 security hardening decisions), `docs/database/business-rules.md`, and `docs/operations/deployment.md` (`UPLOAD_CLAIM_SECRET` env setup, Vercel firewall verification, HSTS notes).
- Ensure `npm audit --omit=dev`, `npm run lint`, `npm run typecheck`, and `npm test` pass.

Before reporting done:
- Run `npm test` and verify full suite passes without regressions.
- Verify that `npm audit --omit=dev` shows 0 high/critical vulnerabilities on runtime packages.
- Test concurrent order checkout with identical `checkoutRequestId` in integration test: assert exactly 1 row in `orders`, 1 call to notification, and identical response body returned to both requests.
- Test key reuse with a altered payload: assert `409 IDEMPOTENCY_CONFLICT`.
- Test upload claim tampering: assert 403 response without invoking Supabase Storage `download()` or `info()`.
- Test rate limiter concurrency: verify no transaction locks or deadlocks under parallel calls.
- Run `.agents/skills/security-review/SKILL.md` checklist and document findings.

Commit style: small commits, Conventional Commits:
- `fix(deps): upgrade next to patched 15.5.x`
- `feat(security): add baseline headers and report-only csp`
- `refactor(rate-limit): atomic upsert rate limiter and multi-dimension public abuse limits`
- `feat(orders): checkout idempotency key on orders table`
- `feat(uploads): stateless hmac upload claims for attachment authorization`
- `docs(phase-34): update adr and deployment runbook`

Report back in exactly this format (per AGENTS.md):
1. Files changed
2. Behavior
3. Tests/checks run
4. Known risks
5. Follow-up work, if any
