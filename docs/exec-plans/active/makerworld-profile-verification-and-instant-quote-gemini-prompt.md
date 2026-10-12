# Prompt gửi Gemini — MakerWorld Profile Verification & Instant Quote (snapshot versioning, 2-tier quotes, stale-price guard, Storefront viability)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/makerworld-profile-verification-and-instant-quote.md`
in full (it has the complete context: goals, non-goals, Claude's 6 blockers, and the decisions in §3–§6 —
all currently tentative, none implemented yet), plus `docs/exec-plans/completed/phase-13.md` (the original
MakerWorld resolver / public quote design this phase extends) and ADR-0010 / ADR-0022 in
`docs/architecture/decisions.md`. For the code these decisions touch, read:
`src/lib/parsers/makerworld-resolver.ts`, `src/components/admin/makerworld-quote-panel.tsx`,
`src/services/quote.service.ts`, `src/domain/schemas.ts` (`quoteModelSnapshotSchema`, `quoteInputSchema`),
`src/app/admin/(protected)/custom-requests/actions.ts` (`createQuoteAction`) and
`src/app/[locale]/(storefront)/quotes/[quoteNumber]/page.tsx`.

**Do not write code, do not create migrations, do not edit any file.** Review only. Follow the
"Required output for architectural alternatives" format from `GEMINI.md` (Current approach / Alternative /
Pros-cons / Complexity impact / Cost impact / Recommendation / What docs/code would need to change) for each
question below, then give a final concrete recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D is a small 3D-printing business platform (Next.js + TypeScript + PostgreSQL/Supabase + Zod). Phase 13
shipped a server-side MakerWorld URL resolver (hostname allowlist, `redirect: 'manual'` re-validated per hop,
AbortController timeout), an admin panel that auto-fills a cost-plus quote from a MakerWorld link, and a public
quote page `/quotes/[quoteNumber]` (HMAC token or phone-suffix gate, public pricing DTO that hides
margin/cost fields). Quotes store an immutable `model_snapshot` JSONB validated by a `.strict()` Zod schema.
This phase extends it: a MakerWorld model has several print profiles (e.g. model 3246150: a No-AMS P1S/P2S
profile at 170g / 7.5h / 6 plates vs. another at 285g), so staff must pick and visually verify the exact
profile, and the business wants two price tiers (pre-assembled vs. self-assembly kit) plus a later
customer-facing instant estimate on `/custom-print`.

The design has only been reviewed by Claude so far. No code for this phase exists yet — everything in the
plan is still cheap to change. Note that Claude flagged two issues (B2: unrestricted `coverImageUrl`; B3:
stale applied price after inputs change) as already present in the Phase 13 code.

## Question 1 — Versioning `QuoteModelSnapshot` as a v1|v2 Zod union with a hard `profileVerified` gate
Tentative decision (§5 Q2, Q3): instead of adding optional fields to the existing `.strict()` schema, define
`quoteModelSnapshotV2Schema = v1.extend({ schemaVersion: z.literal(2), dataSource, profileId, profileTitle,
profileCoverImageUrl, printerTarget, netWeightGrams, amsRequired, tier, profileVerified: z.literal(true) })`
and export `z.union([v2, v1])`. Reads go through a tolerant `readQuoteModelSnapshot()` (`safeParse` → `null`).
`profileVerified` is a client-sent boolean; Claude argues its value is forcing a deliberate staff action, with
accountability coming from the existing audit log (`actorId`), not from the flag itself. No migration (JSONB).

Challenge this:
- Is a Zod union with `schemaVersion` over-engineering for a 1-owner shop vs. "all new fields `.optional()`"?
  What concretely breaks with the simpler option, and what breaks with the union (error messages, `z.infer`
  narrowing burden in every UI that reads the snapshot)?
- Is `z.literal(true)` on a client-supplied flag real protection or ceremony? Would a server-side rule
  (e.g. reject v2 snapshots whose `profileId` is not among the profiles the resolver returned) be better —
  and is that even possible given the resolver result is not persisted?
- Is returning `null` on a malformed stored snapshot (silent degrade) the right call, or should it surface
  as an error somewhere staff will see?

## Question 2 — Two price tiers: "1 Quote = 1 tier" plus auto-rejecting sibling quotes on accept
Tentative decision (§5 Q4): the two tiers (assembled ~45–60 min labor vs. kit ~20 min) are only shown at the
estimate step; each `quotes` row carries exactly one price and `snapshot.tier`. If the customer has not
chosen, staff creates two quotes for the same custom request, and `acceptQuote` — in the same transaction —
sets every other `DRAFT`/`SENT` quote of that custom request to `REJECTED`, so only one `print_job` is ever
created. Storing `options[]` in one quote was rejected because the public page derives the 50% deposit and
VietQR from `quotes.total`, and ADR-0022 treats quote totals as immutable.

Challenge this:
- The auto-reject rule applies to every custom request with multiple quotes, not only MakerWorld ones. Is
  there a legitimate case (multiple distinct items in one request, a revised re-quote) that this would
  silently break? Should it be scoped (e.g. only quotes sharing a non-null `tier` / a `quote_group_id`)?
- Two separate quote numbers and two Zalo links for one decision — is that acceptable customer UX, or is a
  small schema change (e.g. `quote_group_id` + choose-on-accept) worth the migration cost?
- Assembly labor minutes live in a code constant (`ASSEMBLY_TIERS`) rather than `pricing_configs`. Should
  they be a DB-configurable value instead, given `pricing_configs` already versions every other cost input?

## Question 3 — Preventing "price of profile A saved with snapshot of profile B"
Tentative decision (§3 B3, §5 Q2): purely client-side. Per-profile state lives in a child component keyed by
`selectedProfileId` (remount on change); any input change after "Dùng giá này" calls `clearApplied()`, which
removes the hidden `pricingBreakdown`/`modelSnapshot` inputs and blanks the parent form's price inputs via
`document.getElementById`. Breakdown and snapshot are built together in one function from one profile object.
Server-side, `quoteInputSchema` only checks `total = subtotal + shipping − discount`; staff may legitimately
hand-edit the price after applying.

Challenge this:
- Is a client-only guard enough for a data-integrity issue Claude ranks as a blocker? Propose a concrete
  server-side consistency check that does not forbid legitimate manual price edits (e.g. snapshot gram/print
  minutes vs. breakdown material grams, or flagging `subtotal ≠ breakdown.finalPriceVnd` in the audit log).
- The panel writes into a sibling form through `document.getElementById` — is that coupling itself the root
  cause? Would lifting state to the form (or a single serialized "applied quote draft" field) be simpler and
  safer, and what is the migration cost from the current Phase 13 panel?

## Question 4 — Is the Storefront instant estimate (Phase B) viable as designed?
Tentative decision (§5 Q1, §5 Q3, §6): a public endpoint that calls the same resolver, protected by a per-IP
limiter (10 req / 10 min) plus a global limiter (200 req/h) using the existing DB-backed
`createDatabaseRateLimiter`, a 24h cache table keyed by `modelId` (needs a migration), a server-computed DTO
rounded to 5,000đ using the median per-gram cost of active materials of the same type, no manual numeric
input for customers (to stop margin reverse-engineering via a linear system), no customer-supplied image URLs,
and every MakerWorld-originated custom request auto-flagged `ip_risk_flag = true` (Phase 29 gate) because many
MakerWorld licenses are non-commercial. Images stay hotlinked from MakerWorld's CDN with an exact-host
allowlist (`unoptimized`, `referrerPolicy="no-referrer"`). Claude also expects server-side fetches from a
datacenter IP (Vercel) to be blocked by Cloudflare much of the time, so Phase B is gated on 2 weeks of
measured resolver success rate.

Challenge this:
- If Cloudflare blocks most datacenter requests, is a server-side resolver the wrong foundation for a
  customer-facing feature? Name a concrete alternative (e.g. customer-side paste of the spec text, a
  staff-only flow with fast human turnaround, an official/partner data source) and compare it honestly.
- Is a DB-backed rate limiter (one transaction + DELETE per request) appropriate for a public, scrape-prone
  endpoint, or does it turn abuse into database load? What is the simplest better option without adding a
  heavy dependency?
- Is hotlinking third-party CDN images on a page the customer pays from acceptable (link rot before
  `valid_until`, privacy), or should copying the image into Supabase at quote time move into this phase?
- Is auto-flagging every MakerWorld request as IP-risk proportionate, or will it train staff to click
  through the acknowledgement? What would a more targeted license policy look like?

End with one clear final recommendation per question. If you'd make the same call as the tentative decision,
say so explicitly and why — "I'd choose the same thing" is a valid, useful answer here, not a non-answer.
Also list any blocker you believe Claude missed entirely, ranked by the CLAUDE.md review priorities
(data integrity → inventory/concurrency → authorization/security → testability → maintainability →
simplicity → UX).
