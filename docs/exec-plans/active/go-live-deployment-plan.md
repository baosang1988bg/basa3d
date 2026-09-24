# BaSa3D — Go-live Deployment Plan

**Status:** draft, not yet executed. Written by Claude on 2026-09-17 after auditing the live Vercel project state; revised the same day after an independent Codex review (see `go-live-deployment-plan-codex-review.md`) whose key claims Claude re-verified directly against the codebase and Supabase docs. Owner has not yet purchased the Cloudflare domain.

**Goal:** take BaSa3D from "deployed but not really launched" to a safe real-customer launch — correct env vars in Production, a domain, and a backup story for real order data.

**Non-goals:** rebuilding CI/CD from scratch, changing hosting provider, adding a staging environment beyond Vercel's existing Development/Preview/Production split.

## Current state (verified via `vercel` CLI, 2026-09-17)

- Vercel project `basa3d` (team `ba-sa`) is linked and has been deployed to Production repeatedly (`basa3d.vercel.app`).
- Vercel has 3 separate environments (Development / Preview / Production) already, each with its own `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Owner confirmed: Development and Production point to **two separate Supabase projects** (not shared) — good, no cross-contamination risk.
- Owner confirmed: Supabase is on the **Free tier** — no Point-in-Time Recovery, no built-in daily backups.
- **0 domains** attached to the Vercel project yet. Owner is buying one on Cloudflare next.

## Blockers found

### 1. `ORDER_CONFIRMATION_SECRET` missing — blocks orders *and* quotes, with a duplicate-order failure mode

`ORDER_CONFIRMATION_SECRET` is required by [src/lib/order-confirmation-token.ts:9](../../../src/lib/order-confirmation-token.ts#L9) — it throws if unset or under 32 characters. It is **not present** in `vercel env ls` output for any environment. Traced end to end (verified directly, not just cited):

1. `POST /api/public/orders` ([route.ts:42-50](../../../src/app/api/public/orders/route.ts)) calls `createOrder()`, which commits the order/order_items insert inside `withTransaction()` and only *then* sends the staff notification ([order.service.ts:59-66](../../../src/services/order.service.ts)) — notification failures are swallowed by design, never roll back the order.
2. Only after all of that does the route call `createOrderConfirmationToken(created.id)` — if the secret is missing, this throws, is caught, and `apiError()` turns it into HTTP 500.
3. The order is already committed at this point. The client doesn't clear the cart or navigate away on a non-2xx response, so a customer retry can create a second real order.

The same token function backs quote access links (`mintQuoteAccessToken`) used by the admin custom-request detail page and the public quote page's token-verification path (with a phone-suffix fallback) — so this is an **order-and-quote blocker**, not order-only.

The cart-hide change (`NEXT_PUBLIC_CART_ENABLED`) reduces normal customer exposure by redirecting `/cart`/`/checkout`, but does **not** close this: `POST /api/public/orders` has no cart-enabled guard and stays directly callable.

**Fix:** set a unique, stable, ≥32-character `ORDER_CONFIRMATION_SECRET` per environment in Vercel, redeploy, then smoke-test both order creation/confirmation and the admin/public quote-link flows. Rotating this secret later invalidates outstanding signed links — treat it as a durable secret, not something rotated casually.

### 2. Public rate limiters trust a spoofable header under the DNS-only architecture — **fixed in this pass**

Four public routes rate-limit by IP but preferred `cf-connecting-ip` over `x-forwarded-for`. That preference was correct under the *original* deployment doc's assumption (Cloudflare orange-cloud proxy in front) but became a real gap once this plan chose DNS-only (see Decision 2 below, now resolved): with no Cloudflare proxy in the request path, `cf-connecting-ip` is just an attacker-supplied header, trivially rotated per request to bypass the limiter (`createDatabaseRateLimiter` only hashes whatever key it's given — [rate-limit.ts](../../../src/lib/rate-limit.ts) — it doesn't validate the source). Highest-impact case: `GET /api/public/orders/[orderNumber]` rate-limits the 4-digit phone-suffix verification guard at 30 req/min; an attacker with a known order number could rotate the fake header to brute-force it.

Fixed 2026-09-17: added `getClientIp()` in `src/lib/rate-limit.ts` (trusts only `x-forwarded-for`, which Vercel sanitizes/overwrites for direct traffic per <https://vercel.com/docs/headers/request-headers>) and switched all 4 call sites to use it:
- `src/app/api/public/orders/[orderNumber]/route.ts`
- `src/app/[locale]/(storefront)/quotes/[quoteNumber]/page.tsx`
- `src/app/api/public/custom-requests/attachments/route.ts`
- `src/app/api/public/tool-price-estimate/route.ts`

`tsc --noEmit` and `eslint` both pass clean on the changed files. Not yet run against a live DB (these routes need one).

## Missing Production env vars (vs. `.env.example` / current code)

Present: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Missing, needs a decision or a value from Owner:
- `ORDER_CONFIRMATION_SECRET` — blocker, see above. Can be generated (`openssl rand -hex 32`), no external dependency.
- `NEXT_PUBLIC_SITE_URL` — currently would default to `http://localhost:3000` (or an example-domain fallback on the blog) in code if unset; must be the real Production origin.
- `NEXT_PUBLIC_ZALO_PHONE`, `NEXT_PUBLIC_ZALO_URL`, `NEXT_PUBLIC_HOTLINE` — just added locally (2026-09-17, cart-hide phase), not yet pushed to Vercel.
- `NEXT_PUBLIC_CART_ENABLED` — must be `false` (or unset) in Production to match the just-shipped cart-hide decision.
- `NEXT_PUBLIC_MESSENGER_URL` — intentionally empty (no Fanpage yet).
- `NEXT_PUBLIC_CONTACT_EMAIL` — read by `src/config/site.ts`; absent from `.env.example` and missed in the first pass of this audit. Safe (falls back to `basa3d.print@gmail.com`), but worth setting explicitly rather than relying on the fallback being correct.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — optional; without them, staff email notifications (Phase 15) silently don't send. Owner decision whether needed before launch.
- `NEXT_PUBLIC_GA_ID` — optional; without it, no GA4 tracking (Phase 10).
- `NEXT_PUBLIC_BANK_ID`, `NEXT_PUBLIC_BANK_ACCOUNT_NUMBER`, `NEXT_PUBLIC_BANK_ACCOUNT_NAME` — optional; without them, the bank-transfer VietQR on order confirmation is simply not rendered (by design, see `src/config/site.ts` comment).

## Decisions

1. **Backup strategy for Production data**, given Supabase Free tier has no built-in backup. **Corrected from the original draft** — independently confirmed against <https://supabase.com/docs/guides/platform/backups>: Pro gives **daily backups with 7-day retention only**; PITR is a **separate paid add-on** requiring at least a Small compute add-on (~$100/mo extra for 7-day PITR at time of writing). Pro alone means up to ~24h of potential data loss (RPO), and neither daily backups nor PITR cover Supabase Storage objects (product/blog images, private custom-request attachments) — deleting a Supabase project deletes its managed backups too.
   - **Decision: upgrade Production to Pro** as the managed baseline, **plus**:
     - a scheduled offsite logical backup (Supabase's documented `supabase db dump` GitHub Actions pattern — <https://supabase.com/docs/guides/deployment/ci/backups> — dumps roles/schema/data, excludes managed `auth`/`storage` schemas by default) stored encrypted in a separate object store (e.g. Cloudflare R2), with retention and failure alerting;
     - a separate, non-destructive copy of Storage objects via Supabase's S3-compatible endpoint (e.g. `rclone copy`, not a mirror that propagates deletions);
     - a documented restore drill (restore into an isolated test project) to establish an actual, tested RTO — a backup nobody has restored from isn't a verified recovery plan.
   - **Open sub-decision, Owner must close before enabling real in-app checkout/payment:** accept up to ~24h RPO on Pro's daily backups, or pay for the PITR add-on for near-zero RPO. For the current contact-first launch (cart hidden, no online payment yet), Pro + offsite export can ship first; PITR should be revisited before the app becomes the live order-entry system of record.
   - Recovery scope is broader than orders alone: Phase 12 (filament spool inventory + expense accounting) already has migrations/services in the codebase, so a restore must keep inventory/material-movement ledgers, filament/expense data, custom requests/quotes/attachments, and catalog/blog content consistent with orders — not just the `orders`/`order_items`/`product_variants` tables.

2. **Domain → Vercel DNS strategy**, once the Cloudflare domain is purchased. **Decision: DNS-only** (Cloudflare stays registrar + authoritative DNS, no orange-cloud proxy). Confirmed against Vercel's own guidance (<https://vercel.com/kb/guide/cloudflare-with-vercel>, <https://vercel.com/kb/guide/vercel-waf-vs-cloudflare-waf>): stacking Cloudflare's proxy in front reduces the client signals available to Vercel's own Firewall/BotID, adds a hop, and creates overlapping caching/reliability behavior — and this project has no BotID/Turnstile/Cloudflare-WAF dependency that would justify the extra layer. This decision is what made rate-limiter blocker #2 above real, and that blocker is now fixed to match.
   - Attach both apex and `www` to the Vercel project; after adding each, use Vercel's own domain-inspection output for the exact record values (fallbacks at time of writing: apex `A` → `76.76.21.21`, `www` `CNAME` → `cname.vercel-dns-0.com`) — do not hardcode these blindly.
   - Set both records' Cloudflare proxy status to **DNS only**.
   - Keep apex canonical (`https://basa3d.vn`-style, no `www`), redirect `www` → apex at the Vercel level (DNS records don't do HTTP redirects).
   - Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin (no trailing slash), redeploy.
   - `docs/operations/deployment.md` still described the old orange-cloud checklist and told the app to trust `cf-connecting-ip` — updated 2026-09-17 to match this decision (see that file).

3. **Email/GA4 before launch or after** — still open. `RESEND_API_KEY`/`RESEND_FROM_EMAIL` and `NEXT_PUBLIC_GA_ID` degrade safely if unset (no notifications / no tracking, no crash), so this is a launch-quality call for the Owner, not a blocker.

## Known non-blocking risk to track as a fast-follow

Fixing the missing secret removes the *configuration-triggered* 500, but the underlying design still commits the order before all post-commit work finishes, and the client has no idempotency key for retries. Recommend adding a server-enforced idempotency/duplicate-submission guard (e.g. a client-generated request ID stored with a uniqueness constraint) as a fast-follow — do not treat this as fully solved just because the secret is configured.

## Planned steps

1. ~~Fix rate-limiter IP-trust blocker (4 files + shared helper).~~ Done 2026-09-17.
2. Set `ORDER_CONFIRMATION_SECRET` (generate fresh, ≥32 chars) in Production; set the same missing env vars listed above across Production (and Preview where it makes sense) via `vercel env add`.
3. Redeploy, then smoke-test: place a real test order end-to-end (confirmation page loads), and open an admin quote link + a public quote link.
4. Apply the backup decision: upgrade Production Supabase to Pro, stand up the offsite dump + Storage-copy job, run one restore drill, record the result.
5. After the domain is purchased: `vercel domains add <domain>`, add the Vercel-provided DNS records to Cloudflare as DNS-only, set `NEXT_PUBLIC_SITE_URL` to the real domain, redeploy.
6. Close the PITR RPO decision (Decision 1's open sub-decision) before enabling real in-app checkout/payment.
7. Run the project's `release-check` skill (lint, typecheck, tests, E2E, build, migration review, env var check, smoke plan) before treating the domain as live to real customers.
