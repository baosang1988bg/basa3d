# Prompt gửi Gemini — Phase 34 kickoff (pre-launch security hardening)

Read `AGENTS.md` and `GEMINI.md` first, then
`docs/exec-plans/active/phase-34-security-hardening.md` in full. Also read
`docs/architecture/decisions.md`, `docs/database/business-rules.md`, and
`docs/operations/deployment.md` where Phase 34 references existing order, private-upload,
and DNS-only deployment decisions. Do not write code. Follow the "Required output for
architectural alternatives" format from `GEMINI.md` (Current approach / Alternative /
Pros-cons / Complexity impact / Cost impact / Recommendation / What docs/code would need
to change) for each question, then give one concrete recommendation per question.

## Project context

BaSa3D is a Next.js + PostgreSQL/Supabase modular monolith for a small 3D-printing
business. Public guest checkout creates orders transactionally and returns an HMAC access
token; custom 3D files are uploaded directly to a private Supabase bucket through signed
upload tokens. Server routes use direct PostgreSQL and service-role Storage access, while
all public-schema tables have deny-all RLS/API grants. The deployment target is Vercel,
with Cloudflare retained as registrar and DNS-only authoritative DNS. A 2026-10-14 audit
found concrete gaps in dependency versions, abuse limits, checkout retry behavior,
attachment path authorization, and HTTP headers.

No Phase 34 production code or migration has been written yet. The two new markdown files
only freeze a tentative scope so these decisions are still cheap to change.

## Question 1 — Store checkout idempotency directly on `orders`?

The tentative design adds nullable `checkout_request_id uuid` and a canonical payload hash
to `orders`, with a unique partial index. Matching retries return the existing order;
reusing the ID with different input returns 409. Staff-created orders remain null. This
avoids a new table, but public order creation already performs inventory reservation checks,
audit writes, and post-commit notification.

Challenge this:

- Compare this concretely with a dedicated `idempotency_keys`/`checkout_attempts` table. Which
  design handles concurrent same-key requests, failed transactions, response replay, and
  retention most safely with the least machinery?
- Specify the transaction/unique-conflict algorithm that guarantees exactly one order and no
  duplicate notification attempt under simultaneous requests.
- Is hashing the validated canonical request sufficient, or should the server persist/replay
  an explicit response snapshot? Name the mismatch/failure cases.
- Should confirmation-secret validation happen before the transaction, or should token minting
  be redesigned so no post-commit configuration failure can produce a retryable 500?

## Question 2 — Stateless HMAC upload capability or persisted upload intent?

The tentative design returns an expiring HMAC `uploadClaim` bound to each random Storage path,
then requires it for public estimate and submission before any service-role read. A dedicated
`UPLOAD_CLAIM_SECRET` provides domain separation and avoids a new table/cleanup job.

Challenge this:

- Does this actually close the confused-deputy/privacy issue, including replay, claim sharing,
  attaching one file to multiple requests, and a leaked full client response?
- Compare it with an `upload_intents` table that records path, expiry, and consumed state. Is
  single-use consumption worth the migration, race handling, and cleanup complexity here?
- Define the minimum signed fields and expiry semantics. Must file extension/content type,
  intended operation, or a batch/request nonce be included in addition to path and expiry?
- Explain how to roll this out without breaking already uploaded but not yet submitted files.

## Question 3 — DB-backed limits on all public write/resolver endpoints?

The tentative design keeps phone/honeypot controls and the Vercel Firewall, while adding the
existing PostgreSQL-backed per-IP limiter to public order creation, custom-request creation,
and MakerWorld estimate. It deliberately avoids Redis/Upstash for this small MVP.

Challenge this:

- Could the current limiter's transaction plus global expired-row delete become its own DoS
  bottleneck? Give a concrete SQL/index or cleanup alternative if so.
- Recommend exact limiter dimensions/order for IP plus phone without enabling easy targeted
  denial of service against a victim's phone number.
- Should MakerWorld's verified DB-only path share a limit with the external resolver path, or
  should their budgets be separated?
- Identify which protections must remain in code even if a Vercel Firewall rule exists.

## Question 4 — Security headers and CSP rollout boundary

The tentative design ships low-risk headers immediately, inventories all script/image/connect
origins, and only adds a production CSP if it can support Next.js, the inline theme bootstrap,
Supabase, VietQR, and GA4 without broadening `unsafe-inline`. HSTS is deferred until the real
canonical HTTPS domain is verified.

Challenge this:

- Is postponing CSP within the same security phase acceptable, or should a report-only policy
  be mandatory now? Provide a concrete staged policy.
- For this Next.js App Router deployment, compare a static hash for the fixed theme bootstrap
  with request nonces and externalizing the script.
- Which headers belong in app config versus Vercel/domain configuration, and which could break
  legitimate image, analytics, auth, or admin behavior?
- Define a testable minimum DoD that improves protection without claiming an unverified CSP/HSTS
  deployment state.

End with one clear final recommendation per question. If you would keep a tentative decision,
say so explicitly and explain why.
