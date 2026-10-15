# Phase 35 — Go-live hardening (post-Phase-34 audit)

**Status:** code S1–S5 implemented locally (2026-10-15) — awaiting OWNER `npm run build` + DB-backed test run + review; not committed
**Owner:** Claude (implementation), OWNER (dashboard/infra steps)
**Trigger:** 2026-10-15 security + deployment audit before buying the Cloudflare domain and pointing it at Vercel

## Phase brief

- **Goal:** close the remaining code-level gaps found in the 2026-10-15 audit so the production domain can be connected without a known data-exposure or abuse path.
- **Non-goals:** payment, customer accounts, Cloudflare orange-cloud proxy, replacing Supabase Auth, enforcing CSP (stays Report-Only — see Deferred), dedicated least-privilege DB role (needs infra — see Deferred).
- **Risks:** filtering orders to ACTIVE products can reject carts that contain a product archived after it was added (intended: returns `VARIANT_NOT_FOUND`); `.3mf` caps can reject unusually large but legitimate customer files (caps chosen well above observed Bambu/MakerWorld files).
- **Definition of Done:** S1–S5 merged, focused tests added, `npm run lint`, `npm run typecheck`, unit tests and `npm run build` pass; OWNER checklist below completed before DNS cut-over.

## Audit evidence → slice mapping

| Finding | Severity | Slice |
|---|---|---|
| 6 admin pages (`orders`, `print-jobs`, `inventory`, `products`, `blog`, `blog/[id]`) rely only on the layout for auth; RSC segment requests skip the layout, middleware only checks "has Supabase login" | BLOCKER | S1 |
| JSON-LD `JSON.stringify` inside `<script>` — `</script>` in a product/blog field breaks out (stored XSS by STAFF, same origin as `/admin`) | IMPORTANT | S2 |
| GA `page_view` (and gtag auto `page_location` on every event) carries `?token=` / `?phoneSuffix=` from order-confirmation and quote pages | IMPORTANT | S2 |
| `parseThreeMfSliceInfo` unzips without an uncompressed-size cap; XML parser processes entities | IMPORTANT | S3 |
| `parseThreeMfMeshVolume` allows 200 MB unzipped and uses lazy `[\s\S]*?` regexes over it; unbounded vertex array | IMPORTANT | S3 |
| Public checkout accepts DRAFT/ARCHIVED products and inactive variants; API ignores `NEXT_PUBLIC_CART_ENABLED`; `items[]` unbounded | IMPORTANT | S4 |
| Public `GET /api/products/variants` and `GET /api/products/[id]/images` expose non-ACTIVE catalog data | IMPORTANT | S4 |
| OWNER can deactivate self / the last active OWNER | IMPORTANT | S4 |
| `product-images` bucket not created by any migration | IMPORTANT | S5 |
| TRUNCATE bypasses ledger immutability triggers; functions keep default `EXECUTE` to PUBLIC; trigger functions have mutable `search_path` | IMPORTANT | S5 |

## Decisions

- **D1 — Page-level `requireAdmin()` on every protected admin page.** The layout check stays (it renders the FORBIDDEN screen), but pages no longer depend on it. `requireAdmin` is `cache()`-memoized, so no extra network round-trip.
- **D2 — One `serializeJsonLd()` helper** (`src/lib/json-ld.ts`) escaping `<`, `>`, `&`, U+2028, U+2029. All 4 JSON-LD call sites use it.
- **D3 — Analytics URL sanitizer applied centrally in `sendGAEvent`.** Every event gets an explicit sanitized `page_location` (and `page_referrer`), which overrides gtag's auto-collected `document.location`. Sensitive params: `token`, `phoneSuffix`, `uploadClaim`, `claim`.
- **D4 — `.3mf` hard caps:** slice-info entry ≤ 2 MB uncompressed, XML parser `processEntities: false`; mesh `.model` total ≤ 100 MB uncompressed (was 200 MB), vertex count ≤ `MESH_MAX_TRIANGLES`; regex extraction replaced by `indexOf`-bounded scanning so a missing closing tag is O(n), not O(n²).
- **D5 — Public order guard lives in `createOrder` when `actorId === null`:** variant must be `is_active` and product `status = 'ACTIVE'`. Staff-created orders keep current behavior. Route returns 404 when `SITE_CONFIG.cartEnabled` is false. `items` capped at 50 lines (matches BAO_GIA cap).
- **D6 — Last-OWNER guard** in `setStaffActive`: refuse self-deactivation and refuse deactivating the last active OWNER (`FOR UPDATE` over active OWNER rows inside the transaction).
- **D7 — Migration `20261017000000_phase_35_db_hardening.sql`:** idempotent `product-images` bucket (public, 5 MB, jpeg/png/webp — matches `product.service.ts`), statement-level `BEFORE TRUNCATE` guard on the three ledgers, `REVOKE EXECUTE` on public-schema functions from `public, anon, authenticated` + default privileges, `search_path` pinned on trigger functions.

## Deferred (tracked, not in this phase)

- Least-privilege app DB role instead of `postgres` in `DATABASE_URL` (moderate migration + env change).
- Cloudflare Turnstile on `upload-urls` / custom-request submit + global storage byte budget.
- Enforcing CSP (needs the GA inline init script hashed or moved, plus a Report-Only observation window on the real domain).
- STAFF hard-deleting product images (business decision: OWNER-only vs soft delete).
- Zod validation of server-action scalar args (`setStaffActiveAction`, etc.), `import 'server-only'` on server modules (needs the `server-only` package — dependency decision).
- Separate HMAC domain prefix for order vs quote tokens; rate limit on order-confirmation `phoneSuffix` path.

## OWNER checklist before DNS cut-over (not code)

- [ ] Supabase Auth → disable public sign-ups; set Site URL + Redirect URLs to the new domain.
- [ ] Review Supabase API logs for anon/authenticated `/rest/v1/*` access before 2026-10-12 (RLS was off); confirm `staff_profiles` contains only known people; rotate anon key if anything looks wrong.
- [ ] Apply migrations to Production (incl. Phase 34 + 35); run Supabase Security Advisor.
- [ ] Vercel Production env: `NEXT_PUBLIC_SITE_URL=https://<domain>`, `ORDER_CONFIRMATION_SECRET`, `UPLOAD_CLAIM_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`; flags `NEXT_PUBLIC_BAO_GIA_ENABLED=false`, `MAKERWORLD_PUBLIC_RESOLVER_ENABLED` per plan; redeploy after changing any `NEXT_PUBLIC_*`.
- [ ] Cloudflare DNS records for Vercel set to **DNS only** (grey cloud) — `src/lib/rate-limit.ts` assumes no proxy.
- [ ] Resend: verify the domain (SPF, DKIM, DMARC records in Cloudflare).
- [ ] Decide on Supabase Pro (backups, no inactivity pause) before taking real orders.

## Verification

- Focused tests: `tests/phase-35-golive-hardening.test.ts` (JSON-LD escaping, analytics sanitizer, `.3mf` caps, admin pages call `requireAdmin`).
- `npm run lint`, `npm run typecheck`, `npm run build`. DB-backed tests (order ACTIVE filter, last-OWNER guard, migration) need the disposable local Supabase (`TEST_DATABASE_URL`) — run by OWNER if not available in the sandbox.

## Verification log (2026-10-15, Claude, Linux sandbox)

- `tsc --noEmit`: pass. `eslint src tests`: pass.
- Full test suite without a DB (DB tests skip): 308 pass / 142 skipped / 1 fail. The single failure (`security-headers.test.ts`, `@parcel/watcher` native binary missing on linux-arm64) fails identically on unmodified `HEAD` — sandbox-only, not a regression. 11 new Phase 35 tests pass; 2 DB-gated ones skipped.
- NOT run here (macOS-only `@next/swc-darwin-arm64` binaries): `npm run build`, DB-backed integration tests, E2E. OWNER must run `npm run test:db:setup && npm test` and `npm run build` locally.
