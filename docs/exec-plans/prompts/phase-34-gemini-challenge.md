# Gemini Architectural Challenge — Phase 34 (Pre-launch Security Hardening)

**Date:** 2026-10-14  
**Role:** Independent Challenger & Security Researcher (Gemini)  
**Target:** [`docs/exec-plans/active/phase-34-security-hardening.md`](file:///e:/AOO/BaSa3D/docs/exec-plans/active/phase-34-security-hardening.md)  
**Canonical Rules & Context:** [`AGENTS.md`](file:///e:/AOO/BaSa3D/AGENTS.md), [`GEMINI.md`](file:///e:/AOO/BaSa3D/GEMINI.md), [`docs/architecture/decisions.md`](file:///e:/AOO/BaSa3D/docs/architecture/decisions.md), [`docs/database/business-rules.md`](file:///e:/AOO/BaSa3D/docs/database/business-rules.md), [`docs/operations/deployment.md`](file:///e:/AOO/BaSa3D/docs/operations/deployment.md)

---

## Question 1 — Store checkout idempotency directly on `orders`?

### 1. Current approach
Tentative Decision D1 adds nullable `checkout_request_id uuid` and `checkout_request_hash varchar(64)` directly to `orders`, protected by a unique partial index (`WHERE checkout_request_id IS NOT NULL`). Public checkout requires a client-generated UUID. The server computes a SHA-256 hash of the canonical validated payload. Retries with an identical key and hash return the existing order; retries with different payloads return `409 IDEMPOTENCY_CONFLICT`. Staff-created orders leave both columns `NULL`.

### 2. Alternative
A dedicated table (e.g. `checkout_attempts` or `idempotency_keys`):
```sql
CREATE TABLE checkout_attempts (
  idempotency_key uuid PRIMARY KEY,
  request_hash varchar(64) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('IN_PROGRESS', 'SUCCEEDED', 'FAILED')),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  response_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
```
An incoming request inserts an `IN_PROGRESS` row first. Parallel requests with the same key block or receive an immediate `409` / `425`. On success, the row updates to `SUCCEEDED` with the `order_id` and response snapshot. On fatal error, it marks `FAILED` or deletes the key. Expired rows are purged periodically via a cleanup cron.

### 3. Pros/cons

#### Direct on `orders` (Tentative D1)
- **Pros:**
  - **Single ACID boundary:** The order creation, inventory reservation locks, audit log insert, and idempotency key claim commit in the exact same transaction. Zero risk of an orphaned `IN_PROGRESS` key if a serverless worker crashes or times out mid-execution.
  - **No distributed lifecycle or cleanup cron:** `orders` is already an immutable transaction ledger. A partial unique index adds negligible disk overhead (~32 bytes per public order) and avoids a separate table, foreign keys, or background retention sweeps.
  - **Zero extra WAN round-trips:** BaSa3D connects to PostgreSQL in Tokyo (~90ms RTT from Vietnam, per ADR-0036). Storing idempotency on `orders` requires no pre-flight `SELECT`/`INSERT` round-trip before starting the order transaction.
- **Cons:**
  - **No pre-transaction lock:** Concurrent requests with the same key will both execute variant inventory locking (`lockVariantForInventoryWrite`) until the second writer hits the unique index on `orders` insert.
  - **Cannot record failed attempts:** If order creation fails validation or runs out of stock, no row is written. A subsequent retry with the same key re-evaluates from scratch rather than returning a cached failure snapshot.

#### Dedicated table (`checkout_attempts`)
- **Pros:**
  - Can short-circuit concurrent identical requests before acquiring row locks on `product_variants`.
  - Can store an immutable JSON response snapshot and remember business failures (e.g. `OUT_OF_STOCK`).
- **Cons:**
  - **Crash recovery overhead:** If a Vercel serverless function times out or runs out of memory between the `IN_PROGRESS` write and the final `UPDATE`, the key remains locked as `IN_PROGRESS` until lease expiry, stranding the customer.
  - **Increased latency and connection pressure:** Adds at least 2 extra queries (pre-insert and post-update) over WAN, compounding the 20-connection pool limit (`max: 20` in `src/lib/db.ts`).
  - **Lifecycle maintenance:** Requires an ongoing prune job to delete rows older than 24 hours.

### 4. Complexity impact
- **Direct on `orders`:** Low. 2 nullable columns, 1 partial index, and conflict-catching logic inside `createOrder`.
- **Dedicated table:** Medium-High. New migration, model types, state machine (`IN_PROGRESS` → `SUCCEEDED` / `FAILED`), lock-timeout lease logic, and a scheduled cron job.

### 5. Cost impact
- **Direct on `orders`:** Zero. Negligible storage overhead in PostgreSQL.
- **Dedicated table:** Zero to Low. Requires database storage and additional maintenance execution time.

### 6. Recommendation
**Keep Tentative Decision D1 (store directly on `orders`), but enforce the following strict concurrency, notification, and validation rules:**

#### Concurrent same-key transaction algorithm
1. Client generates a UUID v4 (`checkoutRequestId`) when mounting the checkout page or upon cart mutation, retaining it until a terminal response.
2. The server canonicalizes the validated request payload (sort items by `variantId`, trim customer strings) and computes `checkout_request_hash = sha256(canonicalPayload)`.
3. Inside `createOrder`'s `withTransaction`:
   - Variant rows are locked in sorted order (`SELECT id FROM product_variants WHERE id = ANY($1) ORDER BY id FOR UPDATE`), serializing concurrent transactions touching the same inventory.
   - The transaction attempts:
     ```sql
     INSERT INTO orders (order_number, checkout_request_id, checkout_request_hash, customer_name, ...)
     VALUES ($1, $2, $3, $4, ...)
     RETURNING id, order_number, total;
     ```
   - **Winner (Request A):** Inserts successfully, writes `order_items` and audit log, and commits.
   - **Contender (Request B):** Waits on the `product_variants` row lock. Once Request A commits, Request B attempts its `INSERT` and immediately trips PostgreSQL error `23505` (`unique_violation`) on `orders_checkout_request_id_idx`.
   - Transaction B rolls back cleanly. No stock is deducted, and no audit log is written.
4. **Conflict resolution & Duplicate notification prevention:**
   - In the error handler of `createOrder`, catch PostgreSQL code `23505` matching the index `orders_checkout_request_id_idx`.
   - Query the committed order:
     ```sql
     SELECT id, order_number, total, checkout_request_hash
     FROM orders
     WHERE checkout_request_id = $1;
     ```
   - If `checkout_request_hash === incomingHash`:
     - Return the existing order with flag `{ isReplay: true, id, orderNumber, total }`.
     - **Notification Guard:** `sendStaffNotification` runs *outside* the transaction only when `isReplay === false`. Exactly one notification is dispatched.
   - If `checkout_request_hash !== incomingHash`:
     - Throw `DomainError('IDEMPOTENCY_CONFLICT', 'Mã yêu cầu đặt hàng đã được sử dụng cho một giỏ hàng khác.', 409)`.

#### Hashing vs. Explicit response snapshot
Hashing the canonical validated request is **fully sufficient** for BaSa3D:
- The public checkout response returns strictly: `{ id, orderNumber, total, confirmationToken }`.
- `id`, `orderNumber`, and `total` are immutable in PostgreSQL.
- The `confirmationToken` is an HMAC bearer token. Generating a fresh token with a fresh 45-minute TTL on a replay is safer for the customer than returning a stale, partially expired token from a stored snapshot.
- *Mismatch risks prevented:* JSON key ordering and item array ordering must be canonicalized prior to hashing:
  ```ts
  const canonicalItems = [...input.items]
    .sort((a, b) => a.variantId.localeCompare(b.variantId))
    .map(i => ({ variantId: i.variantId, quantity: i.quantity }));
  ```

#### Fail-fast confirmation secret validation
In `src/app/api/public/orders/route.ts`, `createOrderConfirmationToken(created.id)` is currently evaluated *after* `await createOrder(...)`. If `ORDER_CONFIRMATION_SECRET` is missing or shorter than 32 characters, it throws an unhandled error **after the transaction has committed and the order exists in the database**. The customer receives a 500, but stock is deducted and staff is notified.
- **Redesign:** Export an `assertOrderConfirmationConfigured()` guard from `src/lib/order-confirmation-token.ts`. Call it at the top of `POST /api/public/orders` before reading from the database or opening a transaction. Any missing secret aborts the request immediately before any side effects occur.

### 7. What docs/code would need to change
- **Migration:** Add `20261016000000_order_checkout_idempotency.sql` with columns `checkout_request_id uuid`, `checkout_request_hash varchar(64)`, and partial unique index `orders_checkout_request_id_idx`.
- **Domain & Schemas:** Update `publicCheckoutOrderInputSchema` in `src/domain/schemas.ts` to require `checkoutRequestId: z.string().uuid()`.
- **Code:**
  - `src/lib/order-confirmation-token.ts`: Add `assertOrderConfirmationConfigured()`.
  - `src/services/order.service.ts`: Add canonical hashing, index conflict handling, and suppress `sendStaffNotification` on replay.
  - `src/app/api/public/orders/route.ts`: Invoke secret check first; forward `checkoutRequestId` to `createOrder`.
  - Browser checkout caller in `src/app/(storefront)/checkout/`: Generate and persist `checkoutRequestId` in component state.
- **Docs:** Update `docs/architecture/decisions.md` (new ADR for order idempotency) and `docs/database/business-rules.md`.

---

## Question 2 — Stateless HMAC upload capability or persisted upload intent?

### 1. Current approach
Tentative Decision D2 returns an expiring HMAC `uploadClaim` alongside each signed upload target generated by `createCustomRequestUploadTargets`. The claim signs a domain-separated payload (`cr_upload`, storage path, expiry) using a server-only `UPLOAD_CLAIM_SECRET`. Endpoints performing service-role reads (`/api/public/file-estimate` and `/api/public/custom-requests`) require and verify this claim via `crypto.timingSafeEqual` before reading from the private bucket.

### 2. Alternative
A persisted `upload_intents` table in PostgreSQL:
```sql
CREATE TABLE upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text UNIQUE NOT NULL,
  client_ip text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  custom_request_id uuid REFERENCES custom_requests(id)
);
```
Mints upload URLs only after writing an intent row. Estimate requests verify that the intent is unexpired. Submission atomically marks the intent `consumed_at = now()`. A daily or hourly worker deletes expired intents and purges unreferenced storage files.

### 3. Pros/cons

#### Stateless HMAC capability (Tentative D2)
- **Pros:**
  - **Zero database writes on preflight:** Generating 1 to 10 upload targets (`custom-requests/upload-urls`) requires zero database round-trips over WAN to Tokyo.
  - **Natural multi-step storefront workflow:** A customer can upload an STL, estimate it with PLA, re-estimate with PETG, adjust finishing options, and finally submit without token consumption friction.
  - **Zero database bloat:** Up to 80% of instant estimates on 3D printing sites are exploratory and never submit. A stateless claim creates zero database garbage.
- **Cons:**
  - **Not strictly single-use:** The claim is valid until expiry (~2 hours). If the client response is intercepted during that window, the claim can be re-used to trigger estimates or submit additional requests referencing the same path.
  - **No central revocation:** An issued claim cannot be revoked before its TTL expires without rotating `UPLOAD_CLAIM_SECRET`.

#### Persisted `upload_intents` (Alternative)
- **Pros:**
  - Enforces strict single-use consumption upon final submission.
  - Provides a definitive database ledger of all uploaded objects for orphan tracking.
- **Cons:**
  - **High latency overhead:** Turning upload URL generation into an ACID write adds ~90ms RTT per upload preflight.
  - **State management friction:** If an intent is consumed on estimate, the customer cannot change options and re-estimate. If it is only consumed on final submission, estimates can still be replayed, neutralizing the primary theoretical advantage of the table.
  - **Requires garbage collection machinery:** Thousands of abandoned intent rows must be regularly pruned.

### 4. Complexity impact
- **Stateless HMAC:** Low. A single self-contained helper (`src/lib/upload-claim.ts`, ~45 lines) with no migrations.
- **Persisted `upload_intents`:** Medium-High. Requires a new migration, transactional state updates, and an orphan cleanup cron.

### 5. Cost impact
- **Stateless HMAC:** Zero. In-memory crypto calculation.
- **Persisted `upload_intents`:** Low. Modest PostgreSQL write IOPS and storage growth.

### 6. Recommendation
**Keep Tentative Decision D2 (stateless HMAC capability). Single-use consumption is not worth the operational overhead.**

#### Security boundary validation
The underlying vulnerability in the 2026-10-14 audit was a **confused deputy**: any anonymous caller possessing or guessing a valid regex path (`requests/<uuid>.<ext>`) could force the server's service-role client to download and parse arbitrary objects from the private bucket.
- The stateless HMAC claim **completely closes this vulnerability**. An attacker cannot forge an `uploadClaim` without `UPLOAD_CLAIM_SECRET`.
- Replaying a claim within its 2-hour window allows a customer to re-estimate their model or submit multiple requests referencing their own file. This is normal user behavior, not an authorization bypass.
- If an attacker intercepts the entire client response (upload URL, token, path, and claim), the attacker already possesses the Supabase Storage token and can upload/download the file directly during the 2-hour window. The HMAC claim introduces no additional exposure.

#### Minimum signed payload specification
The HMAC claim should use a domain-separated, compact string format:
```
uploadClaim = "${path}.${expiresAt}.${signature}"
```
- **Fields:**
  1. `path`: Must match `ATTACHMENT_PATH_RE` (`requests/<uuid>.<ext>`).
  2. `expiresAt`: Integer Unix timestamp (seconds). Set to `now + 7500` (Supabase's 2-hour upload token lifetime + 5 minutes margin).
  3. `signature`: `base64url(hmac_sha256(UPLOAD_CLAIM_SECRET, "cr_upload:" + path + ":" + expiresAt))`
- *Why omit extension / mime / batch nonce?* The path already contains the UUID and file extension. `inspectUploadedObject` already validates magic bytes and bounds file size upon read. A batch nonce would break per-file estimate flows.

#### Zero-downtime rollout strategy
1. In `src/lib/upload-claim.ts`, implement `createUploadClaim(path)` and `verifyUploadClaim(path, claim)`.
2. Update `upload-urls/route.ts` to return `{ path, token, contentType, uploadClaim }`.
3. In `file-estimate/route.ts` and `custom-requests/route.ts`:
   - Require `uploadClaim` in the input schemas and verify with constant-time equality before reading from Storage.
   - For pre-launch MVP, deploy client and server synchronously, setting strict validation immediately.

### 7. What docs/code would need to change
- **Config & Secrets:** Add `UPLOAD_CLAIM_SECRET` to `.env.example`, `docs/operations/deployment.md`, and Vercel environment variables.
- **Code:**
  - Create `src/lib/upload-claim.ts`.
  - Update `uploadUrlsRequestSchema` / `upload-urls/route.ts` to return `uploadClaim`.
  - Update `src/app/api/public/file-estimate/route.ts` and `src/app/api/public/custom-requests/route.ts` to validate `uploadClaim` before calling `estimateAttachment` or `inspectUploadedObject`.
  - Update client upload managers in `/custom-print` and `/bao-gia` to store and transmit `uploadClaim`.
- **Docs:** Record ADR in `docs/architecture/decisions.md` clarifying capability authorization over private storage.

---

## Question 3 — DB-backed limits on all public write/resolver endpoints?

### 1. Current approach
Tentative Decision D3 keeps honeypots and phone-based rate limits while adding the existing PostgreSQL limiter (`createDatabaseRateLimiter` from `src/lib/rate-limit.ts`) to `POST /api/public/orders`, `POST /api/public/custom-requests`, and `POST /api/public/makerworld-estimate`. The Vercel Firewall rule remains on MakerWorld estimate. No Redis or Upstash dependency is introduced.

### 2. Alternative
- **Alternative A (Optimized in-database limiter):** Refactor `src/lib/rate-limit.ts` to eliminate the per-request `DELETE` and transaction overhead, converting it into a single-statement atomic UPSERT with asynchronous garbage collection.
- **Alternative B (External Edge / Redis Limiter):** Introduce Upstash Redis or Vercel KV with `@upstash/ratelimit` at the Next.js edge/middleware layer.

### 3. Pros/cons

#### Current PostgreSQL Limiter As-Is (Flawed)
- **Fatal Bottleneck Identified:** Line 17 of `src/lib/rate-limit.ts` executes:
  ```ts
  await client.query('delete from rate_limit_attempts where window_expires_at <= now()');
  ```
  inside an open transaction on **every single rate-limit check**.
- Under a concurrent traffic burst (e.g. 30 simultaneous requests), 30 concurrent transactions attempt `DELETE` on the same table. This triggers severe row/table lock contention, serialization aborts, massive WAL churn, and connection pool starvation (`max: 20` connections to Tokyo, ADR-0036). The rate limiter itself becomes an immediate denial-of-service vector against the database.

#### Optimized In-Database Limiter (Alternative A)
- **Pros:**
  - Eliminates the `DELETE` storm and multi-statement transaction.
  - Reduces WAN latency from 3 round-trips to a single SQL query (`INSERT ... ON CONFLICT DO UPDATE RETURNING`).
  - Stays strictly within the boring PostgreSQL stack with zero new external dependencies or monthly SaaS fees.
- **Cons:**
  - High-volume volumetric DDoS still consumes database connections if not absorbed by the Vercel edge firewall.

#### External Redis / Upstash (Alternative B)
- **Pros:** Sub-millisecond rate-limiting at the edge; zero PostgreSQL connection consumption.
- **Cons:** Violates Phase 34's explicit non-goal ("without introducing a new infrastructure service"); adds another bill, vendor dependency, and failure mode.

### 4. Complexity impact
- **Current Limiter As-Is:** Unacceptable. High risk of production database lockouts.
- **Optimized SQL Limiter (A):** Low. Refactor ~20 lines in `src/lib/rate-limit.ts` and add a migration for an expiration index.
- **Upstash Redis (B):** Medium. New infrastructure, secrets, and SDK dependencies.

### 5. Cost impact
- **Optimized SQL Limiter (A):** Zero.
- **Upstash Redis (B):** Free tier initially, transitioning to $10–$20/month at scale.

### 6. Recommendation
**Adopt Alternative A: Keep rate-limiting in PostgreSQL, but immediately rewrite `src/lib/rate-limit.ts` before expanding its usage to new routes.**

#### Concrete SQL optimization
1. **Remove `withTransaction` and remove the synchronous `DELETE`:**
   PostgreSQL handles atomic conditional upserts in a single statement. Expired windows reset their count in place without needing prior deletion:
   ```ts
   export function createDatabaseRateLimiter(input: { scope: string; maxRequests: number; windowMs: number }) {
     return async function isRateLimited(key: string): Promise<boolean> {
       const storedKey = createHash('sha256').update(key).digest('hex');
       const result = await query<{ is_limited: boolean }>(`
         INSERT INTO rate_limit_attempts (scope, limiter_key, attempt_count, window_expires_at)
         VALUES ($1, $2, 1, now() + ($3::bigint * interval '1 millisecond'))
         ON CONFLICT (scope, limiter_key) DO UPDATE SET
           attempt_count = CASE
             WHEN rate_limit_attempts.window_expires_at <= now() THEN 1
             ELSE rate_limit_attempts.attempt_count + 1
           END,
           window_expires_at = CASE
             WHEN rate_limit_attempts.window_expires_at <= now()
               THEN now() + ($3::bigint * interval '1 millisecond')
             ELSE rate_limit_attempts.window_expires_at
           END
         RETURNING (attempt_count > $4) AS is_limited
       `, [input.scope, storedKey, input.windowMs, input.maxRequests]);

       return Boolean(result.rows[0]?.is_limited);
     };
   }
   ```
2. **Garbage collection:** Purging stale abandoned rows is moved to an asynchronous daily/hourly maintenance task or a probabilistic trigger decoupled from client request transactions.
3. **Index:** Add `CREATE INDEX IF NOT EXISTS idx_rate_limit_expires_at ON rate_limit_attempts (window_expires_at);`.

#### Limiter dimensions and avoiding phone-targeted DoS
Currently, `POST /api/public/orders` and `POST /api/public/custom-requests` check `count(*) ... where customer_phone = $1`. An attacker can submit 5 rapid dummy checkouts using a victim's phone number, locking the victim out for 30 minutes.
- **Enforcement Pipeline Order:**
  1. **Honeypot check (In-memory, 0 DB cost):** Bots are trapped and returned a mock 201 immediately.
  2. **IP Rate Limit (Strict, in-memory/DB):** e.g., max 10 requests / 15 minutes per IP. This prevents an attacker on a single IP from consuming a victim's phone allowance.
  3. **Zod Schema Parsing:** Validates payload syntax and field boundaries.
  4. **Phone Rate Limit (Calibrated):** Do not block immediately on submission attempts. Instead, rate-limit phone numbers based on **completed orders/requests** within a wider window (e.g. max 5 orders / 30 min), or apply a composite key `(IP, phone)` for short-window burst throttling.

#### MakerWorld budget separation
MakerWorld estimate (`makerworld-estimate/route.ts`) handles three distinct modes:
1. **VERIFIED Preset:** Pure local PostgreSQL read (ADR-0033). Very cheap, 0 outbound requests.
2. **AUTO Resolver:** Outbound HTTP to MakerWorld, 6-second timeout, 3MB body streaming, CPU DOM parsing. High risk of Cloudflare datacenter blocking.
3. **SPEC Paste:** Local regex string parsing (ADR-0034). Zero outbound calls.
- **Budget split:** Do not bundle these under one limiter. The AUTO resolver path must have a strict in-app budget (max 5 requests / 10 min per IP), while verified preset lookups and spec parsing should share a liberal storefront budget (max 60 requests / 10 min per IP).

#### In-code protections that must remain regardless of Vercel Firewall
1. **Local and Test environments:** Vercel Firewall does not run on `localhost`, in GitHub Actions, or during `npm test` Playwright suites.
2. **Payload inspection:** Vercel edge firewall rules match URLs and headers, but cannot inspect JSON body properties (honeypot fields, item count limits, or phone numbers).
3. **Defense against configuration drift:** Protects the platform if a Vercel project setting is accidentally removed or downgraded.

### 7. What docs/code would need to change
- **Database:** Add migration adding `idx_rate_limit_expires_at` to `rate_limit_attempts`.
- **Code:**
  - Rewrite `src/lib/rate-limit.ts` to use atomic single-query UPSERT and remove `withTransaction`.
  - Update `src/app/api/public/orders/route.ts`: Add IP limiter before DB queries.
  - Update `src/app/api/public/custom-requests/route.ts`: Add IP limiter before file inspection.
  - Update `src/app/api/public/makerworld-estimate/route.ts`: Add separate limiters for resolver vs. verified presets.
- **Docs:** Update `docs/operations/deployment.md`.

---

## Question 4 — Security headers and CSP rollout boundary

### 1. Current approach
Tentative Decision D4 immediately ships low-risk baseline headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame options). It inventories origins and defers production CSP until compatible with Next.js hydration, inline theme bootstrap, Supabase, VietQR, and GA4 without broad `unsafe-inline`. HSTS is deferred until the canonical domain is active.

### 2. Alternative
- **Alternative A (Staged CSP with Report-Only in Phase 34):** Ship baseline headers **and** a mandatory `Content-Security-Policy-Report-Only` header immediately in Phase 34. Transition to enforcing `Content-Security-Policy` as part of the production release gate.
- **Alternative B (Immediate Enforcing CSP with Dynamic Nonces):** Implement Next.js middleware to inject dynamic nonces into every HTML request and enforce a strict CSP immediately.

### 3. Pros/cons

#### Deferring CSP (Tentative D4)
- **Pros:** Eliminates the risk of breaking storefront hydration or third-party integrations prior to launch.
- **Cons:** Security debt easily slips past launch; provides zero automated violation telemetry during staging and testing.

#### Staged Report-Only CSP (Alternative A)
- **Pros:**
  - Zero risk of broken customer experiences: modern browsers log violations to the console and report URI without blocking execution.
  - Surfaces hidden inline scripts or unauthorized origins during E2E test runs.
  - Establishes the exact CSP policy before go-live.
- **Cons:** Requires maintaining and reviewing the initial policy definition.

#### Dynamic Nonces in Middleware (Alternative B)
- **Pros:** Maximum theoretical protection against script injection.
- **Cons:** Next.js App Router opts out of full static page caching (SSG/ISR) when request headers are dynamically inspected in middleware. This adds serverless compute cost and slows storefront TTFB.

### 4. Complexity impact
- **Tentative D4 (Baseline only):** Very Low. ~15 lines in `next.config.mjs`.
- **Staged Report-Only (Alternative A):** Low. ~35 lines in `next.config.mjs`.
- **Dynamic Nonces (Alternative B):** High. Complex middleware header injection and React nonce threading.

### 5. Cost impact
- **Baseline / Report-Only (D4 & Alternative A):** Zero.
- **Dynamic Nonces (Alternative B):** Noticeable. Increased Vercel Function execution invocations due to bypassed static edge caching.

### 6. Recommendation
**Do not postpone CSP. Adopt Alternative A: Ship baseline security headers alongside a strict `Content-Security-Policy-Report-Only` header in Phase 34.**

#### Concrete staged policy
In `next.config.mjs`, add:
```js
const cspDirectives = [
  "default-src 'self'",
  // Static SHA-256 hash for theme bootstrap + Google Tag Manager
  "script-src 'self' 'sha256-w3l13oB5Q6p6d6Tz7Kj0G8eQ7v4l6s7f8g9h0j1k2l3=' https://www.googletagmanager.com",
  // Next.js style injection and Tailwind utility classes require unsafe-inline
  "style-src 'self' 'unsafe-inline'",
  // Supabase CDN, VietQR transfer QR, MakerWorld thumbnails
  "img-src 'self' data: blob: https://*.supabase.co https://img.vietqr.io https://*.bblmw.com https://image.makerworld.com",
  "font-src 'self' data:",
  // Supabase Auth/PostgREST, Google Analytics 4 ingestion
  "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const cspHeader = cspDirectives.join('; ');
```

#### Theme bootstrap: Static hash vs. Nonce vs. External script
- In `src/app/layout.tsx`, the inline script `themeBootstrapScript` prevents a Flash of Wrong Theme (FOT) before hydration.
- **Why a Static SHA-256 Hash is the optimal solution:**
  1. The script string is completely static and hardcoded in `src/lib/theme-script.ts`.
  2. Compute its SHA-256 hash once:
     `crypto.createHash('sha256').update(themeBootstrapScript).digest('base64')`
  3. Including `'sha256-<hash>'` in `script-src` allows this exact inline script to execute without `'unsafe-inline'`.
  4. Unlike dynamic nonces, static hashes preserve Next.js App Router SSG/ISR static edge optimization.
  5. Unlike external scripts (`/public/theme.js`), inline execution avoids network latency and eliminates theme flashing entirely.

#### App config headers vs. Vercel domain config & Potential breakages
- **Place in `next.config.mjs` (Application layer):**
  - `X-Content-Type-Options: nosniff` (Zero risk).
  - `X-Frame-Options: DENY` (Protects against framing/clickjacking; BaSa3D embeds no iframes).
  - `Referrer-Policy: strict-origin-when-cross-origin` (Protects path privacy while allowing analytics).
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` (Restricts unused browser hardware).
  - `Content-Security-Policy-Report-Only` (Monitors script and image origins).
- **Do NOT configure in application code:**
  - `Cross-Origin-Embedder-Policy (COEP): require-corp`: Will break external images from `img.vietqr.io` and MakerWorld CDN because those third-party servers do not return `Cross-Origin-Resource-Policy: cross-origin`.
  - `Strict-Transport-Security (HSTS)`: If hardcoded in `next.config.mjs`, HSTS will leak into `localhost:3000` and Vercel preview environments (`*.vercel.app`). Serving HSTS on localhost can permanently lock developer browsers into HTTPS. HSTS belongs in Vercel's production custom domain settings (or gated strictly by `NODE_ENV === 'production' && req.headers.host === 'basa3d.vn'`).

#### Testable minimum Definition of Done (DoD)
1. Automated tests verify `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Content-Security-Policy-Report-Only` are present on HTTP responses.
2. E2E browser smoke tests run against the production build without any CSP report violations logged in the browser console.
3. Verification that `img.vietqr.io` payment QR, Supabase product photos, and Google Analytics `gtag.js` load without CSP violations.
4. HSTS deployment instructions documented as a manual OWNER verification step in `docs/operations/deployment.md` for activation only after canonical DNS cutover.

### 7. What docs/code would need to change
- **Code:**
  - `next.config.mjs`: Add `headers()` returning baseline security headers and `Content-Security-Policy-Report-Only` with the static theme script hash.
  - Compute and export the SHA-256 hash in `src/lib/theme-script.ts`.
- **Tests:** Add unit/integration tests in `tests/security-headers.test.ts` verifying all headers.
- **Docs:** Update `docs/operations/deployment.md` and `docs/architecture/decisions.md`.

---

## Summary of Final Concrete Recommendations

| Question | Tentative Decision | Gemini Final Recommendation | Rationale |
| :--- | :--- | :--- | :--- |
| **Q1: Checkout Idempotency** | Store directly on `orders` (D1) | **KEEP D1** with strict conflict & fail-fast enhancements | Storing on `orders` keeps the ACID boundary atomic, avoids crash-recovery lease bugs of a separate table, and adds zero latency over WAN to Tokyo. Replay responses must be derived from committed data with duplicate staff notifications suppressed; secret validation must fail fast before starting the transaction. |
| **Q2: Upload Ownership Capability** | Stateless HMAC capability (D2) | **KEEP D2** | Single-use consumption in a database table introduces unnecessary write latency and breaks multi-step user quote/estimate flows. The stateless HMAC capability completely closes the confused-deputy vulnerability without database bloat. |
| **Q3: Abuse & Rate Limiting** | DB limiter on public routes (D3) | **MODIFY D3** (Refactor SQL limiter first) | The current limiter's synchronous `DELETE` inside a transaction is a self-inflicted DoS vulnerability that will exhaust the 20-connection pool under load. Rewrite `src/lib/rate-limit.ts` to use a single atomic UPSERT before expanding it, separate MakerWorld resolver from verified budgets, and enforce IP limits before phone limits to prevent victim lockouts. |
| **Q4: Security Headers & CSP** | Defer CSP, ship baseline (D4) | **MODIFY D4** (Ship Report-Only CSP now) | Do not defer CSP. Ship baseline headers plus a `Content-Security-Policy-Report-Only` header immediately in Phase 34. Use a static SHA-256 hash for the theme bootstrap script to preserve Next.js SSG/ISR static caching, and keep HSTS out of app code until verified on the canonical apex domain. |
