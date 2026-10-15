# Phase 36 — Post-audit data integrity & deferred hardening

**Status:** code done locally (2026-10-15) — awaiting OWNER review + `npm run build` + DB-backed test run on macOS; **not committed**
**Owner:** Claude (implementation, at OWNER's request), OWNER (review, commit, production migration)
**Trigger:** 2026-10-15 four-way audit (orders/inventory, auth/RBAC, public surface, migrations/RLS) after Phase 35

## Phase brief

- **Goal:** close the integrity gaps the audit found and the Phase 35 "Deferred" code items, without new features.
- **Non-goals:** payment (Phase 16), Turnstile, enforcing CSP, least-privilege DB role, Supabase Pro/infra, STAFF cost-price masking (business decision).
- **Risks:** stricter guards can surface as new 409s in admin flows (UI now hides the moves the server refuses); legacy order-confirmation links minted < 45 min before deploy stop working (fallback: phone-suffix page); manual-quote sibling rule (see ADR-0040 assumption).
- **Definition of Done:** slices below merged with tests; `lint`, `typecheck`, full test suite and `build` pass; OWNER confirms the ADR-0040 assumption and runs the pre-deploy query below.

## Audit evidence → slice mapping

| Finding | Severity | Slice | Status |
|---|---|---|---|
| Checkout retry for the last unit → `INSUFFICIENT_STOCK` though the order exists | IMPORTANT | S1 | [x] |
| Manual stock-out not checked against available / warehouse on-hand | IMPORTANT | S1 | [x] |
| Cancelling an order leaves its print jobs active | IMPORTANT | S1 | [x] |
| CANCELLED order can be marked PAID / SHIPPED | IMPORTANT | S1 | [x] |
| Owner override into PRINTING books material twice (or never, from CANCELLED) | IMPORTANT | S1 | [x] |
| Deleting a custom request erases accepted quotes / started print jobs; audit keeps only the request row; Storage removed before commit | IMPORTANT | S1 + S2 | [x] |
| `updateCustomRequest` sets `status` bypassing the state machine | IMPORTANT | S1 | [x] |
| Quote accepted on a REJECTED request; two item-less manual quotes both accepted | IMPORTANT | S1 | [x] |
| Material/spool can change after printing started; spool silently wiped | NICE | S1 | [x] |
| Phase 35 `alter default privileges in schema public revoke … from public` is a no-op — new functions executable by `anon` (reproduced) | IMPORTANT | S2 | [x] |
| `pricing_configs` "insert-only" not enforced; FKs `SET NULL` | IMPORTANT | S2 | [x] |
| `timezone('utc', now())` defaults store −7 h in non-UTC sessions → phone rate limits never trigger locally (reproduced by 3 existing tests) | IMPORTANT | S2 + S3 | [x] |
| Dashboard "today/this month" and expense months use the UTC calendar | IMPORTANT | S3 | [x] |
| `blog-images` bucket public with no size/MIME limit | IMPORTANT | S2 | [x] |
| `order_items` snapshot mutable; product type read live at PRODUCING | NICE | S2 | [x] |
| Missing FK indexes; duplicate rate-limit index | NICE | S2 | [x] |
| Phone-suffix (4 digits) brute-forceable; order-confirmation page had no rate limit | IMPORTANT | S4 | [x] |
| IPv6 clients get a fresh rate-limit bucket per address | IMPORTANT | S4 | [x] |
| Order and quote tokens share one format (deferred a) | NICE | S4 | [x] |
| Non-canonical base64url signatures accepted (flaky test, malleability) | NICE | S4 | [x] |
| `setStaffActiveAction(id, "false")` bypasses the last-OWNER guard; server-action scalar args unvalidated (deferred) | IMPORTANT | S5 | [x] |
| `server-only` boundary by convention only (deferred) | NICE | S5 | [x] (static import-graph test, no new dependency) |
| MakerWorld page not checked against the requested model id (cache poisoning) | NICE | S5 | [x] |
| REJECTED/EXPIRED quote still shows a deposit QR | NICE | S5 | [x] |
| `withTransaction` returns a broken client to the pool after a failed ROLLBACK; `apiError` logs pg `detail` (PII) | NICE | S5 | [x] |
| Phase 34/35 DB tests never passed (lowercase SKU, `delete from audit_logs` in cleanup) | test bug | S6 | [x] |

## Decisions

See `docs/architecture/decisions.md` ADR-0040 (integrity guards), ADR-0041 (timestamps & business time zone), ADR-0042 (tokens, phone-suffix budget, rate-limit keys, action args, client/server boundary) and `docs/database/business-rules.md` #22–#25.

## Slices

- [x] **S1 services** — `order.service.ts` (replay-before-stock, cancel cascade, cancelled payment/shipping guard, `product_type_snapshot`), `inventory.service.ts` (outbound checks), `print-job.service.ts` (one booking per attempt, override rules, material lock), `custom-request.service.ts` (delete guard + full audit + Storage after commit, forward-only edit), `quote.service.ts` (REJECTED request, null-sibling rule).
- [x] **S2 migration `20261019000000_phase_36_data_integrity.sql`** — global function default privilege, `now()` defaults + `set_updated_at`, `pricing_configs` immutability + RESTRICT FKs, history-delete triggers (per-table functions), `blog-images` limits, `order_items.product_type_snapshot` + immutability, FK indexes, duplicate index drop. Re-applying it is a no-op (verified).
- [x] **S3 business time** — `src/lib/business-time.ts`; dashboard + expense reports bucket by Asia/Ho_Chi_Minh.
- [x] **S4 public surface** — purpose-bound tokens (`o1`/`q1`, legacy quote links until 2027-01-31), per-resource phone-suffix failure budget (10 / 24 h, refund on success), order-confirmation page IP limit, /64 IPv6 keys, canonical signatures.
- [x] **S5 admin/boundaries** — `src/lib/action-args.ts` in every `actions.ts` (enforced by a static test), boolean guards in services, client→server import-graph test, MakerWorld id check, closed-quote QR, `withTransaction`/`apiError` hygiene; UI shows only allowed status moves and locks material forms once printing.
- [x] **S6 tests** — `tests/phase-36-data-integrity.test.ts` (24 tests: pure + DB-backed), fixes in `phase-34-security`, `phase-35-golive-hardening`, `phase-28-admin-actions`, `hardening-followup`, `phase-13-public-quote`, `helpers/purge-custom-request.ts`.

## Verification log (2026-10-15, Claude, Linux sandbox)

The sandbox now runs a real PostgreSQL 17 (embedded binaries), applies all migrations + `supabase/seed.sql`, runs `next build` (Google Fonts mocked via `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`) and the real test runner against `next start`. Session TimeZone is `Asia/Saigon`, like a Homebrew DB on the OWNER's Mac.

| | Baseline (HEAD) | After Phase 36 |
|---|---|---|
| Tests | 472 | 497 |
| Pass | 450 | **481** |
| Fail | 22 | 16 |

- All 16 remaining failures need a local **Supabase Auth/Storage** (RBAC account minting, signed uploads, image buckets) — identical on HEAD; not available in the sandbox.
- Fixed by this phase: `phase-34` concurrent checkout, `phase-35` anonymous checkout guard (both: test bugs), `phase-4`/`phase-5` phone rate limits and `pricing-config-service` effective_from (timezone bug), `phase-34` upload-claim flake.
- `tsc --noEmit` and `eslint .`: clean. `next build`: passes.

## OWNER checklist

- [ ] Review the diff (no commit was made). Suggested commits: `fix: guard order, inventory and print-job state transitions`, `fix: phase 36 data-integrity migration`, `fix: report in Vietnam business time`, `feat: purpose-bound access tokens and phone-suffix budget`, `fix: parse server action arguments`, `test: phase 36 data integrity`.
- [ ] Confirm the ADR-0040 assumption (item-less manual quotes are revisions). Before deploying, check for affected open requests:
      `select custom_request_id, count(*) from quotes where custom_request_item_id is null and model_snapshot->>'sourceUrl' is null and status in ('DRAFT','SENT','ACCEPTED') group by 1 having count(*) > 1;`
- [ ] Run locally on macOS: `npm install` (node_modules has next 15.5.24, package.json pins 15.5.27), `npm run test:db:setup && npm test`, `npm run build`.
- [ ] Apply `20261019000000` to Production with the Phase 34/35 migrations; re-run Supabase Security Advisor.
- [ ] Deploy outside business hours: order-confirmation links issued in the 45 min before deploy fall back to the phone-suffix page.
- [ ] After 2027-01-31: delete the legacy quote-token branch in `src/lib/order-confirmation-token.ts`.

## Still deferred (unchanged from Phase 35)

- Least-privilege app DB role; Cloudflare Turnstile + global storage byte budget; enforcing CSP; STAFF hard-deleting product images; STAFF visibility of `cost_price` (business decision, ADR-0011 boundary #2).
- `statement_timeout` / `idle_in_transaction_session_timeout` on the pool — check Supavisor support for startup parameters first (or `alter role … set statement_timeout` on the app role once it exists).
