# Prompt gửi Gemini — Phase 9 kickoff (pricing engine scope & data-source challenge)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-9.md`
in full (it has the complete context: goal, non-goals, and the "Quyết định đã
chốt" section #1–#8 — all currently tentative, none implemented yet), plus
`docs/product/catalog-spec.md` §4 and its Phase 9 addendum (the approved
cost-plus formula + the input-contract clarification just added). Do not
write code. Follow the "Required output for architectural alternatives"
format from `GEMINI.md` (Current approach / Alternative / Pros-cons /
Complexity impact / Cost impact / Recommendation / What docs/code would need
to change) for each question below, then give a final concrete
recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D is a small 3D-printing business platform (one owner, one staff).
Stack: Next.js App Router + TypeScript, PostgreSQL via `pg.Pool` (no
PostgREST/RLS as the enforcement boundary), Zod at the boundary. Phases 0–8
are shipped: catalog, inventory ledgers, orders, custom-request → quote →
print-job flow, storefront, blog/SEO. Quotes/products today are priced
**100% by hand** (`quote.service.createQuote` takes a staff-typed
`subtotal`/`total`; no formula, no config table exists anywhere in code).
Phase 9 adds a cost-plus pricing engine (formula already approved since
Phase 0 — ADR-0006/ADR-0010, not up for debate here) that:
- computes price from material/electricity/machine-depreciation/labor/
  packaging inputs, with rounding to nearest 1,000 VND;
- can be fed by parsing a Bambu Studio `.3mf` file's embedded
  `slice_info.xml` (multi-color/multi-plate real slicer output);
- plugs into a 1-click "generate Quote" button on
  `/admin/custom-requests/[id]` and a pricing panel on `/admin/products`.

None of Phase 9's design has been challenged by anyone but Claude so far.
No code exists yet — only `docs/exec-plans/active/phase-9.md` and the
`catalog-spec.md` addendum.

## Question 1 — Cutting MakerWorld URL auto-parse from v1: right call or overcaution?

Phase 9's Non-goals #1 defers automatic parsing of a MakerWorld model URL
(fetching plates/print-time/filament-list server-side from a pasted link) to
a hypothetical "Phase 9b", citing unconfirmed risk of Cloudflare/WAF/anti-bot
blocking and unclear ToS standing for scraping vs. an official API. v1 only
lets staff paste the URL as a plain-text reference note — no fetch, no
parse.

Challenge this:
- Is deferring the entire feature the right level of caution, or is there a
  lower-risk middle ground worth doing now (e.g., a best-effort server fetch
  with a strict timeout + try/catch that silently falls back to manual entry
  on any failure, shipped as "enrichment, not a dependency" from day one,
  rather than not building it at all)?
- Does MakerWorld (Bambu Lab's model marketplace) expose any documented
  public API/oEmbed/JSON endpoint that would make this safe and reliable
  server-to-server (not a scraping question at all), that changes the
  calculus here? If you know of one, name it; if you don't, say so rather
  than guessing.
- Given the worked example in the phase doc (Controller Stand Ace Snail, 8
  plates, 7 colors) came from a real MakerWorld listing, how much of the
  claimed staff value (saving manual data entry) is actually lost by
  deferring this vs. relying on `.3mf` upload alone?

## Question 2 — Snapshot-only breakdown vs. extending `print_jobs` for real multi-material tracking

Phase 9's Non-goals #2 keeps the multi-color/multi-material breakdown
confined to a `jsonb` snapshot on `quotes`/`products` (pricing data only),
and explicitly does NOT touch `print_jobs.material_id`, which today is a
single FK — a real print job with 7 filament colors still gets exactly one
`material_id` + one `estimated_weight_grams` for actual stock deduction
(`assignPrintJobMaterial`, `print-job.service.ts`). The reasoning: production
tracking's data-integrity concerns (raw material stock ledger correctness)
are a separate, larger schema change than "compute a price," and shouldn't
be bundled into a pricing-engine phase.

Challenge this:
- Is it defensible to ship a pricing engine that *knows* the true multi-color
  breakdown (it parsed 7 filaments from the `.3mf`) while the production
  side of the same system still only tracks one material per job — does
  this create a misleading gap (Quote says 7 colors, `print_jobs` implies 1)
  that staff will trip over, or is "pricing and production tracking are
  legitimately separate concerns with separate correctness requirements"
  (data integrity/inventory correctness are BaSa3D's top two review
  priorities per `CLAUDE.md`) enough justification to ship them
  independently?
- If you'd bundle a `print_job_materials` (or similar) schema change into
  Phase 9 instead, what's the smallest version of that change that wouldn't
  balloon this phase's scope — and would it need its own migration review
  pass (`.agents/skills/database-review/SKILL.md`) before Codex touches it?

## Question 3 — `pricing_configs` as an insert-only table vs. alternatives

Decision #3 in the phase doc: a new `pricing_configs` table, **insert-only**
(every edit to electricity price/labor rate/margin/etc. creates a new row;
"current" = the row with the latest `effective_from <= now()`), OWNER-only to
write. The stated reason is audit/history (a Quote must be traceable to the
exact config that priced it, per business-rules.md #3/#7 — never silently
lose historical pricing context), while avoiding building a full versioning/
conflict-resolution system for what is a 1-person-writes-rarely table.

Challenge this against alternatives given this exact shape (single shop,
values change maybe a few times a year, 1-2 admin users total):
- A single mutable row + a separate `pricing_config_history` audit-log table
  (write-through, only `pricing_configs` id=constant gets updated) — does
  this reduce query complexity ("get current config" = trivial `select *`
  vs. "latest effective_from") at acceptable cost?
- A JSON/config-file approach (env vars or a single JSON blob column) instead
  of a relational table — the phase doc rejected this in favor of a DB table
  specifically because staff need to edit without a deploy and because
  historical Quotes need to reference an immutable snapshot; is that
  reasoning sound, or does it overweight a scenario (frequent staff-driven
  price changes) that may not actually happen for a solo shop?
- Anything about the "latest `effective_from <= now()`" current-config
  lookup that's a known footgun (e.g., clock skew, an OWNER back-dating an
  `effective_from` value by mistake and silently becoming "current"
  immediately)?

## Question 4 — `.3mf` parsing: library choice and trust boundary

Decision #5: parse the uploaded `.3mf` (a ZIP containing `Metadata/
slice_info.xml`) entirely server-side in a new Route Handler, using `fflate`
(unzip) + `fast-xml-parser` (XML), rejected doing this client-side or via
Server Action. Reasoning given: numbers from this file feed directly into
COGS/pricing math (data integrity), so it must be validated at the server
boundary (AGENTS.md rule #6) rather than trusting whatever a browser reports
after parsing; and both libraries were picked for being small/dependency-light
(AGENTS.md rule #8) versus something like `jszip` (larger for the same unzip
job).

Challenge this:
- Given the actual internal threat model here (STAFF are trusted internal
  users uploading their own slicer output, not adversarial public input —
  unlike, say, the public custom-request attachment upload flow), is the
  "must validate server-side, never trust client-parsed numbers" framing
  overweighting a threat that doesn't really apply here, or does it still
  hold for a different reason (e.g., staff might paste in a manually-edited
  number by mistake, and re-deriving it from the raw file server-side is a
  correctness/consistency safeguard rather than a security one)?
- Is `fflate` + `fast-xml-parser` actually the leanest reliable combination
  for this specific job (unzip one small named entry from a `.3mf`, parse
  one XML file), or is there a smaller/simpler approach — e.g., is
  `slice_info.xml`'s content simple enough (attribute-only, no nested
  structure) that a small hand-rolled regex/attribute extractor without a
  full XML parser dependency would be more in line with "don't add
  dependencies without a concrete reason"? Weigh brittleness of hand-rolled
  parsing against the dependency-weight concern honestly — don't default to
  "always add the library."
- The phase doc flags "`.3mf` structure not yet verified against a real
  file" as a hard blocker before implementation starts. Anything else worth
  verifying up front (e.g., whether Bambu Studio's `.3mf` format has changed
  across recent versions, whether MakerWorld-downloaded `.3mf` files differ
  from locally-sliced ones) before Codex commits to a specific parser
  implementation?

End with one clear final recommendation per question. If you'd make the same
call as the tentative decision, say so explicitly and why — "I'd choose the
same thing" is a valid, useful answer here, not a non-answer.
