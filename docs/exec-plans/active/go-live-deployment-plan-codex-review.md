# Codex Review — Go-live Deployment Plan

**Review date:** 2026-09-17
**Reviewed plan:** `docs/exec-plans/active/go-live-deployment-plan.md`
**Scope:** review only; no implementation and no state-changing Vercel/Supabase commands.

## Executive summary

1. `ORDER_CONFIRMATION_SECRET` is a real Production blocker. The failure is more severe than the
   plan states: the order transaction commits first, token generation then throws, and the route
   returns HTTP 500. A customer retry can therefore create duplicate committed orders and stock
   reservations. The same secret is also used by public quote links and admin quote-link minting.
2. Supabase Pro alone does not provide the backup posture described in the plan. Pro includes one
   daily database backup with 7-day retention; PITR is a separate paid add-on and requires at least
   Small compute. Daily backups allow nearly 24 hours of data loss and exclude Storage objects.
3. Cloudflare DNS-only in front of Vercel is the right default. The exact apex and `www` records
   should come from Vercel's domain inspection after purchase. The repository's older deployment
   checklist still mandates orange-cloud proxying and must be reconciled with the new decision.

## Question 1 — Blocker and environment audit

### Verdict

The blocker is confirmed, with a larger blast radius than documented.

### Actual order failure path

The real request path is:

1. `POST /api/public/orders` validates input and calls `createOrder()`.
2. `createOrder()` inserts `orders`, `order_items`, and the audit record in `withTransaction()`.
3. `withTransaction()` commits before `createOrder()` returns.
4. Staff notification runs after commit and deliberately swallows its own failures.
5. The route calls `createOrderConfirmationToken(created.id)` only after all of the above.
6. `tokenSecret()` throws when `ORDER_CONFIRMATION_SECRET` is missing or shorter than 32
   characters.
7. The route catches the exception, but `apiError()` converts it to an `INTERNAL_ERROR` HTTP 500.

There is no graceful fallback. Because the insert is already committed, the browser sees a failed
checkout while the order remains in the database. The client does not clear the cart or navigate to
the confirmation page on a non-2xx response, so retrying can create another real order.

Relevant code:

- `src/app/api/public/orders/route.ts:42-52`
- `src/services/order.service.ts:24-69`
- `src/lib/order-confirmation-token.ts:6-25`
- `src/lib/api.ts:5-9`

The storefront currently redirects `/cart` and `/checkout` while
`NEXT_PUBLIC_CART_ENABLED !== "true"`, which reduces normal customer exposure. It does not remove
the blocker: the public POST endpoint itself has no cart-enabled guard and remains callable.

### Quote-flow impact

The token utility was generalized in Phase 13 and now signs both order and quote resource IDs:

- `mintQuoteAccessToken()` calls `createOrderConfirmationToken()`.
- The protected admin custom-request detail page mints a token while rendering every unexpired
  quote.
- The public quote page calls token verification before trying its phone-suffix fallback.

With the secret missing, admin quote rendering/link creation can throw, and a syntactically valid
token presented to the public quote page can throw before fallback. The plan should describe this as
an order-and-quote blocker, not only an order-confirmation problem.

### Full `process.env` scan

No second missing secret with the same severity was found. The database/Supabase variables that
throw when absent are already present in Development, Preview, and Production:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Additional findings:

- `NEXT_PUBLIC_SITE_URL` is a go-live requirement even though it does not throw. If absent,
  metadata, robots, sitemap, and staff-notification links use `localhost`; the blog has a separate
  example-domain fallback.
- `NEXT_PUBLIC_CONTACT_EMAIL` is read by `src/config/site.ts` but is absent from both
  `.env.example` and the plan's audit. It safely falls back to `basa3d.print@gmail.com`; this is an
  audit omission, not a runtime blocker.
- Zalo and hotline variables have hard-coded fallbacks. Their absence is safe only if the Owner
  confirms those fallback contact details are correct.
- Missing `RESEND_API_KEY`/`RESEND_FROM_EMAIL` is swallowed by design. It is not a transaction
  blocker, but it is an operational launch risk because staff can miss new orders or custom
  requests unless they actively poll the admin UI.
- GA4, Messenger, bank details, and the cart flag degrade safely as documented.
- `ORDER_CONFIRMATION_SECRET` must be stable within an environment. Rotating it invalidates
  outstanding signed order/quote links.

### Live Vercel name/scope audit

A read-only `vercel env ls` confirmed that Vercel contains only the four Supabase/database
variables listed above. No unexplained leftover variable name appeared.

- Production and Preview store `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Secret.
- Production also marks the public Supabase URL and anon key as Secret. This is unnecessary but not
  harmful; both values are intentionally shipped to the browser.
- Development displays sensitive credentials as Config. This is expected because Vercel does not
  support Sensitive variables in the Development environment. Regular variables are still
  encrypted at rest but can be read by project collaborators, so project access should remain
  narrow.

No plaintext values were printed or included in this review. The audit verified names and scopes,
not the Owner-confirmed assertion that Development and Production point to different projects.

### Recommendation for Question 1

Choose the same blocker decision as the original plan, but strengthen it:

1. Set a unique, stable, at-least-32-character `ORDER_CONFIRMATION_SECRET` in Production.
2. Set the canonical Production `NEXT_PUBLIC_SITE_URL`.
3. Redeploy; environment changes do not affect earlier Vercel deployments automatically.
4. Smoke-test both successful order creation/confirmation and admin/public quote-link flows.
5. Update the plan with the post-commit HTTP-500/duplicate-order risk, quote blast radius, and
   `NEXT_PUBLIC_CONTACT_EMAIL` omission.

## Question 2 — Backup strategy

### Correct current Supabase behavior

The plan conflates Pro daily backups and PITR:

- Pro automatically receives daily database backups retained for 7 days.
- Team retains 14 days; Enterprise up to 30 days.
- PITR is a separate add-on for paid plans, not included in Pro.
- PITR requires at least a Small compute add-on.
- Seven-day PITR is currently approximately USD 100/month in addition to the applicable plan and
  compute charges.
- During an in-place restore the project is inaccessible, and Supabase documents restore duration
  as database-size-dependent rather than giving a fixed RTO.

Sources:

- <https://supabase.com/docs/guides/platform/backups>
- <https://supabase.com/features/database-backups>

### RPO/RTO assessment

Seven-day retention answers how far back recovery points are kept; it does not mean seven-day or
near-zero data loss. A once-daily backup has a worst-case RPO approaching 24 hours. Losing almost a
day of orders, reservations, payment state, and inventory movements is not a reasonable default for
a system treated as the source of truth.

PITR gives much finer recovery points, but RTO still needs a tested operational runbook. A backup
feature without a restore drill does not establish that BaSa3D can recover within an acceptable
time.

### Provider and Storage gaps

Pro/PITR is not a complete independent disaster-recovery strategy:

- Deleting a Supabase project permanently deletes its associated managed backups.
- Database backups contain Storage metadata, not the underlying Storage objects.
- Supabase Storage does not provide object versioning; deleted objects cannot be restored from the
  Storage service itself.

BaSa3D therefore also needs protection for:

- `product-images`
- `blog-images`
- private `custom-request-attachments`

Sources:

- <https://supabase.com/docs/guides/platform/backups>
- <https://supabase.com/docs/guides/storage/s3/compatibility>
- <https://supabase.com/docs/guides/storage/management/download-objects>

### Middle-ground option

Use Pro as the managed primary backup and add a small off-provider export, rather than choosing
between “Free + own everything” and “Pro only”. Supabase publishes an official GitHub Actions
pattern using `supabase db dump` for roles, schema, and data:

<https://supabase.com/docs/guides/deployment/ci/backups>

For BaSa3D, adapt it as follows:

- Run on a schedule and on demand.
- Store encrypted dumps in a private external object store such as Cloudflare R2, not in Git.
- Apply retention and stale-backup/failure alerts.
- Periodically restore into an isolated test project.
- Copy Storage objects separately through Supabase's S3-compatible endpoint using `rclone copy` or
  equivalent. Avoid a destructive mirror that propagates source deletions without destination
  versioning/retention.

The default Supabase CLI dump excludes managed schemas such as `auth` and `storage`. Managed
physical backups should remain the primary full-database recovery layer; the offsite logical dump
and object copy provide independent protection and portability.

### Recovery scope

The backup story must cover more than `orders`, `order_items`, and `product_variants`. A consistent
restore includes:

- orders, items, payment/shipping/status state, and pricing snapshots;
- immutable inventory and material movement ledgers;
- materials, warehouses, filament spools, spool usage, and expenses;
- custom requests, quotes, print jobs, and private attachments;
- products, variants, categories, images, and blog content;
- staff profiles, Auth users, audit logs, rate-limit state where useful;
- schemas, functions, triggers, constraints, indexes, RLS/policies, roles, and migration history;
- Vercel/Supabase configuration and durable secrets stored separately in a password manager.

Phase 12 is not merely future scope: filament-spool and expense migrations, services, and tests are
already present. Restoring only order tables would leave ledgers and production/financial state
internally inconsistent.

### Recommendation for Question 2

Choose the same direction as the original plan—upgrade Production to Pro—but correct and augment
it:

1. Treat Pro's 7-day daily backup as the baseline, not as PITR.
2. Add encrypted scheduled offsite database exports and a separate Storage-object copy.
3. Perform and document a restore drill and accepted RPO/RTO.
4. Before enabling real in-app checkout/payment, enable 7-day PITR unless the Owner explicitly
   accepts the possibility of losing up to one day of order/inventory changes.

For the current contact-first launch with the cart hidden, Pro plus offsite export can be staged
first; the PITR decision must be closed before the application becomes the live order-entry source
of truth.

## Question 3 — Domain and Vercel DNS

### DNS-only is the correct default

Vercel explicitly advises against stacking Cloudflare's reverse proxy in front of Vercel because
it reduces the client signals available to Vercel Firewall/BotID, adds another network hop, and
creates overlapping caching and reliability behavior:

- <https://vercel.com/kb/guide/cloudflare-with-vercel>
- <https://vercel.com/kb/guide/vercel-waf-vs-cloudflare-waf>

BotID is a reason against the second proxy rather than a reason for it. The repository currently
has no BotID, Turnstile, or Cloudflare WAF integration that requires orange-cloud mode. Vercel also
documents that it overwrites `x-forwarded-for` for direct traffic to prevent spoofing, so the
application's fallback IP-rate-limit path works without Cloudflare:

<https://vercel.com/docs/headers/request-headers>

Cloudflare proxying should only be reconsidered for a concrete non-negotiable requirement such as
numeric bot scores, particular OWASP tuning, leaked-credential detection, or account-level policy
across many zones.

### Exact DNS records

After purchasing the domain and attaching both hostnames to the Vercel project, configure these
records in Cloudflare with **Proxy status: DNS only**:

| Host | Type | Value |
|---|---|---|
| `@` | `A` | project-specific apex IPv4 shown by Vercel |
| `www` | `CNAME` | project-specific CNAME target shown by Vercel |

Vercel's current general-purpose values are:

- Apex A: `76.76.21.21`
- `www` CNAME: `cname.vercel-dns-0.com`

These are fallbacks, not values to copy blindly. After adding each domain, inspect the Vercel
domain configuration and use the exact project-specific records it returns:

<https://vercel.com/docs/domains/set-up-custom-domain>

Also:

- add both the apex and `www` domains to the Vercel project;
- remove conflicting A/AAAA/CNAME records for those hostnames;
- add an ownership-verification TXT record if Vercel requests one;
- no Cloudflare ALIAS record is needed;
- configure the non-canonical hostname as a permanent redirect at Vercel—the DNS records do not
  perform HTTP redirects;
- set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin without a trailing slash and redeploy.

### Canonical-domain assumption and documentation conflict

There is no `vercel.json`. `next.config.mjs` has no hostname redirect, and runtime code only uses
`NEXT_PUBLIC_SITE_URL` to build canonical/metadata/sitemap URLs.

`docs/operations/deployment.md` currently makes two assumptions that conflict with the new plan:

1. It tells the Owner to enable Cloudflare orange-cloud proxying.
2. It explicitly says `www` should redirect to the canonical apex.

The first instruction should be changed. The second is a valid explicit domain-shape decision even
though Vercel generally recommends `www` as canonical for DNS flexibility. For this project, keeping
the already-documented apex canonical is the least-surprising choice:

- canonical: `https://example.com`
- redirect: `https://www.example.com` → `https://example.com`

### Recommendation for Question 3

Choose the same DNS-only decision as the original plan:

1. Keep Cloudflare as registrar and authoritative DNS.
2. Attach both apex and `www` to Vercel.
3. Create the Vercel-provided apex A and `www` CNAME records as DNS-only.
4. Keep apex canonical and configure `www` → apex at Vercel.
5. Update `docs/operations/deployment.md` before the Owner follows it, removing the outdated
   orange-cloud/cache-bypass instructions.

## Consolidated final calls

1. **Blocker:** same call as the plan, but stronger—set the token secret before launch and treat it
   as an order-and-quote blocker with a post-commit duplicate-order failure mode.
2. **Backups:** same direction, different scope—upgrade to Pro, but add offsite database/Storage
   copies; PITR is separate and should be enabled before in-app checkout unless a 24-hour RPO is
   explicitly accepted.
3. **DNS:** same call as the plan—Cloudflare DNS-only, both apex and `www`, apex canonical; reconcile
   the older deployment checklist that still mandates orange-cloud proxying.

## Requested Claude follow-up

Claude should review this document against the current repository and its original go-live plan,
then report:

1. Any factual or code-trace error in the findings above.
2. Any recommendation it disagrees with and why.
3. Exact edits it would make to `go-live-deployment-plan.md` and
   `docs/operations/deployment.md`—recommendations only, no file edits in this review pass.
4. Whether the three consolidated final calls are safe enough to present to the Owner for a final
   decision.

---

## Claude follow-up review

**Review completed:** 2026-09-17
**Mode:** read-only Claude Code session; `Read`, `Grep`, and `Glob` only. No file edits and no
Vercel/Supabase commands.

### Claude's overall verdict

Claude re-traced the findings against the current repository and found no substantive factual or
code-trace error in the Codex review.

Confirmed points include:

- The order transaction commits before confirmation-token generation throws, so the request returns
  HTTP 500 after persisting the order.
- The browser does not clear the cart or navigate after a non-2xx response, making a duplicate order
  on retry plausible.
- The secret affects both order and quote paths.
- `NEXT_PUBLIC_SITE_URL` has inconsistent unsafe Production fallbacks.
- `NEXT_PUBLIC_CONTACT_EMAIL` is a real env-audit omission with a safe hard-coded fallback.
- There is no `vercel.json`, no canonical-host redirect in `next.config.mjs`, and the existing
  operations document still contradicts the DNS-only decision.

Minor precision note: the admin custom-request detail page only calls `mintQuoteAccessToken()` for
still-valid quotes. Expired quotes pass `token={null}`, so a page with no active quote does not fail
on this specific path.

Claude could not independently browse the live Supabase documentation because WebSearch was denied
in its restricted review session. It therefore classified the current Supabase retention/pricing
details as Codex-sourced rather than independently re-verified by Claude. Those details were sourced
from the official Supabase documentation linked earlier in this file.

### Additional blocker found by Claude: spoofable rate-limit identity

Claude found a separate go-live issue not identified in the original plan or the initial Codex
review. Four public request paths currently prefer the `cf-connecting-ip` header over Vercel's
sanitized `x-forwarded-for` header:

- `src/app/api/public/orders/[orderNumber]/route.ts:12-14`
- `src/app/[locale]/(storefront)/quotes/[quoteNumber]/page.tsx:54-57`
- `src/app/api/public/custom-requests/attachments/route.ts:17-19`
- `src/app/api/public/tool-price-estimate/route.ts:24-26`

`createDatabaseRateLimiter()` hashes the supplied string but does not establish whether its source
is trustworthy. With Cloudflare configured as DNS-only, Cloudflare is not in the HTTP request path
and does not stamp `cf-connecting-ip`. A client can therefore send and rotate that custom header to
obtain a fresh limiter key per request. Vercel documents that it overwrites `x-forwarded-for` for
direct traffic to prevent spoofing; it does not make the application-provided preference for
`cf-connecting-ip` safe.

The highest-impact case is public order lookup: the 30-requests/minute limiter is meant to protect a
four-digit phone-suffix verification space. A caller who has or discovers a valid order number can
rotate a fake `cf-connecting-ip` value and bypass that throttle. The quote lookup has the same
secondary-factor pattern. Attachment upload and tool-price estimation receive abuse/cost exposure.

This does not make Cloudflare proxying the preferred solution. The infrastructure decision remains
DNS-only; the application should stop trusting `cf-connecting-ip` unless a verified Cloudflare proxy
is deliberately placed in the request path. Under the chosen architecture, Vercel-sanitized
`x-forwarded-for` should be the trusted source. Claude classifies this small code fix as blocking for
the real-domain go-live release.

### Residual duplicate-order risk after setting the secret

Setting `ORDER_CONFIRMATION_SECRET` eliminates the verified configuration-triggered failure, but
does not provide general checkout idempotency. The design still commits the order before the route
finishes all post-commit response work, while the client has no idempotency key and can resubmit
after an ambiguous failure.

Claude recommends recording this as a known non-blocking fast-follow risk: add a server-enforced
idempotency mechanism or equivalent duplicate-submission protection. It should not be represented as
fully solved merely because the missing secret is configured.

### Claude's requested edits to the original plan

For `docs/exec-plans/active/go-live-deployment-plan.md`:

1. Replace the order-only blocker paragraph with the complete commit → notification swallow → token
   throw → HTTP-500 path, including the duplicate-order consequence.
2. Reclassify it as an order-and-quote blocker and mention both admin token minting and public quote
   verification.
3. Add `NEXT_PUBLIC_CONTACT_EMAIL` as a safe-fallback audit omission.
4. Add checkout idempotency as a known non-blocking fast-follow risk.
5. Add the spoofable `cf-connecting-ip` rate-limit issue for the four public paths and make its code
   fix part of the go-live release.
6. Correct Option A: Pro includes daily backups with 7-day retention; PITR is separate.
7. Add the middle-ground offsite database export plus Storage-object copy and broaden recovery scope
   to all inventory/filament/expense/production data.
8. Add a restore drill with explicit RPO/RTO and require a PITR decision before re-enabling checkout.

For `docs/operations/deployment.md`:

1. Replace the orange-cloud instruction with Cloudflare DNS-only.
2. Remove or clearly mark the Cloudflare cache-bypass and `cf-connecting-ip` instructions as
   conditional guidance that applies only if the proxy architecture is deliberately adopted later.
3. Keep the existing `www` → canonical apex decision.
4. Add a check that IP-header trust and public-route rate limiting have been verified before DNS goes
   live.

Claude did not make these edits because this remained a review-only pass.

### Claude's safety assessment of the three final calls

1. **Token blocker:** safe to present with the stronger framing. Blocking. Disclose generic checkout
   idempotency as a residual non-blocking risk.
2. **Backups:** safe only after correcting Pro versus PITR, adding offsite database/Storage backup,
   and requiring a restore drill. The original “Pro includes PITR” wording is not safe for Owner
   sign-off.
3. **DNS:** DNS-only with apex canonical is safe as an infrastructure decision. It is not a complete
   go-live closure until the spoofable `cf-connecting-ip` preference is fixed in the four public
   request paths. The DNS decision can be approved now; the application fix should ship before or
   with the real-domain release.

### Updated consolidated go-live calls after Claude review

1. **Blocking configuration:** set the durable Production order/quote token secret and canonical
   site URL, redeploy, and smoke-test both flows.
2. **Blocking application fix:** under DNS-only, stop trusting caller-controlled
   `cf-connecting-ip` in the four public rate-limited paths; rely on Vercel's sanitized client-IP
   header.
3. **Backup decision:** upgrade Production to Pro, add encrypted offsite database and Storage
   copies, run a restore drill, and close the separate PITR decision before enabling real in-app
   checkout/payment.
4. **Domain decision:** keep Cloudflare as registrar/DNS with gray-cloud records pointing directly
   to Vercel; attach apex and `www`, keep apex canonical, and redirect `www` at Vercel.
5. **Documented fast-follow:** add checkout idempotency/duplicate-submission protection even after
   the missing-secret configuration is corrected.
