# Prompt gửi Gemini — Phase 33 kickoff (`/bao-gia`: ranh giới tin cậy client, bảng món + N Quote, VAT có phiên bản, công thức thời gian in)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-33-bao-gia-instant-quote.md`
in full (it has the complete context: goal, non-goals, Owner decisions D1–D5, tentative technical
decisions T1–T14, draft schema §4, pricing formula §5, API contracts §6 — all tentative, none
implemented yet), plus `docs/research/instant-quote-research.md` §1, §6, §9 and
`docs/architecture/decisions.md` ADR-0007, ADR-0022, ADR-0023, ADR-0032, ADR-0034. Useful code to
read: `src/services/quote.service.ts` (`createQuote`, `acceptQuote`),
`src/services/instant-estimate.service.ts`, `src/services/file-estimate.service.ts`,
`src/lib/parsers/mesh-volume.ts`, `src/lib/pricing/mesh-estimator.ts`,
`src/app/api/public/custom-requests/route.ts`, and the initial schema migration
`supabase/migrations/20260830000000_initial_domain_schema.sql` (`quotes`, `prevent_ledger_mutation`).
Do not write code. Follow the "Required output for architectural alternatives" format from
`GEMINI.md` (Current approach / Alternative / Pros-cons / Complexity impact / Cost impact /
Recommendation / What docs/code would need to change) for each question below, then give a final
concrete recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)

BaSa3D is a small Vietnamese 3D-printing shop platform (Next.js 15 on Vercel, Supabase Postgres +
Storage). Customers already get instant estimates at `/custom-print` (ADR-0034): a sliced `.3mf` is
priced exactly from `slice_info`; an `.stl/.obj` gets a price *range* from mesh volume — but the file
is uploaded *through* a Vercel function first, which fails above Vercel's hard 4.5MB body limit.
Phase 33 adds a new page `/bao-gia`, modelled on the flow of a local competitor
(in3dtudonghoa.com): multi-file drag & drop, files analysed **in the browser** (no upload until
submit), 3D preview, scale/material/infill/quantity per file, a single estimated price per file,
printable estimate, then contact form. Files are then uploaded straight to Supabase Storage via
signed upload URLs. Owner decisions: one item (file + config + quantity) becomes **one immutable
Quote** (N quotes per request); **no deposit/payment** in this flow; **VAT is off now but must be
switchable** (and its rate changeable) without a deploy. The competitor prices by grams only (no
machine time); BaSa3D keeps its cost-plus engine (`computePricingBreakdown`: material, electricity,
machine depreciation, labor, failure buffer, margin) and therefore needs an estimated print time
from geometry.

None of Phase 33's design has been challenged by anyone but Claude so far. No code has been
written; the plan is a draft, so every decision below is still cheap to change.

## Question 1 — Trust boundary: browser-computed metrics + bounded server re-verification

Tentative (T1, T2, T8, §6.1, §6.3): the browser parses the mesh in a Web Worker and sends only
geometric metrics (`volumeMm3`, `surfaceMm2`, `sizeMm`, `triangles`) plus scale/material/infill to
`POST /api/public/quote-estimate`, which prices them server-side (pricing config and margin never
leave the server). The submit payload never contains a price. At submit, the server checks each
uploaded object (exists, real size, magic bytes), then re-computes metrics from the stored file with
the **same shared pure module** as the browser, but only within a budget (`VERIFY_BUDGET_BYTES`,
default 20MB total per submit). Results are tagged `VERIFIED`, `MISMATCH` (>2% volume diff → server
numbers win) or `CLIENT_REPORTED` (over budget → client numbers kept, flagged for staff). Rationale:
the binding price is only ever the staff-created Quote (ADR-0022), so a faked estimate cannot cause
a wrong charge; and re-parsing 5 × 50MB files in a Vercel function risks timeouts/OOM.

Challenge this:
- Is `CLIENT_REPORTED` an acceptable hole, given staff may anchor on the stored estimate when
  creating the Quote? Would you instead re-verify asynchronously (Next 15 `after()`, a Supabase
  Edge Function, or a queue/cron) so *every* file ends up `VERIFIED` — what does that cost in
  complexity and failure modes?
- The metrics endpoint is a pricing oracle (same trade-off as ADR-0034's SPEC path). Are the planned
  consistency checks (V ≤ bbox volume, isoperimetric lower bound on surface area, caps) plus a
  120/hour/IP limit enough, or is there a concretely better mitigation that doesn't break < 1s UX?
- Signed upload URLs don't constrain size/content per token. Is "bucket `file_size_limit` +
  `allowed_mime_types` + magic-byte check at submit + 24h orphan cleanup cron" sufficient against
  the bucket being used as anonymous file hosting? Anything missing (e.g. per-IP byte quota, binding
  tokens to a short-lived DB intent row)?

## Question 2 — New table `custom_request_items` + composite FK from `quotes` (1 item = 1 Quote)

Tentative (T4–T6, §4.3–4.4, §6.4): a new insert-only table `custom_request_items` (one row per file,
config, quantity, `verification`, and an `estimate_snapshot` JSONB), immutable via the existing
`prevent_ledger_mutation()` trigger. `quotes` gets a nullable `custom_request_item_id` with a
**composite FK** `(custom_request_item_id, custom_request_id) → custom_request_items(id,
custom_request_id)` so a Quote can never point at another request's item.
`custom_requests.attachment_path` keeps item #1's path and `quantity` the sum, for legacy screens.
`acceptQuote`'s sibling auto-reject key (today `model_snapshot->>'sourceUrl'`, ADR-0032) becomes
`coalesce(custom_request_item_id::text, sourceUrl)` so ASSEMBLED/KIT alternatives of the same item
reject each other but never touch other items. Rationale: with N quotes, a Quote must reference its
item with DB-enforced integrity; JSONB paths or a `text[]` column can't be FK targets.

Challenge this:
- Is a new table justified versus keeping items inside `custom_requests.quote_estimate_snapshot`
  (JSONB, no migration) plus a `quotes.item_index smallint`? Quantify what integrity is actually
  lost and what the migration cost of switching later would be.
- Fully immutable items: what breaks operationally (customer asks to change infill/quantity after
  submitting; staff wants to correct a wrong material)? Is "create a new request" acceptable, or
  should staff edits be modelled differently (e.g. adjustments live only on the Quote)?
- Mirroring item #1 into `attachment_path` and summing `quantity` is denormalisation — will it drift
  or confuse existing list/dashboard/print-job code? Would you rather leave them null for `/bao-gia`
  requests and update the readers?
- Is the generalised sibling key in `acceptQuote` safe under the existing lock order
  (custom_requests row → quote row)? Any edge case where an item quote and a MakerWorld quote on the
  same request interfere?

## Question 3 — VAT as a versioned `pricing_configs` setting, snapshotted on each Quote with a DB check

Tentative (T9–T11, §4.1–4.2, §5.3): add `vat_enabled boolean default false` and `vat_rate_bps
integer` (basis points, 800 = 8%) to the versioned `pricing_configs` table; toggling VAT = inserting
a new config row (already audited). `quotes` gets `vat_rate_bps` and `vat_amount bigint`, and the
existing `total = subtotal + shipping_fee - discount` check is replaced by one that also enforces
`vat_amount = round((subtotal + shipping_fee - discount) * vat_rate_bps / 10000)` and
`total = … + vat_amount`. VAT is computed server-side in `createQuote` from the *current* config
(client never sends it) and per Quote; the storefront estimate computes VAT per item then sums, so
the estimate total equals the sum of the N quotes exactly. Existing quotes become 0/0 and stay valid.
`orders` (cart currently hidden; custom prints never become orders, ADR-0007) are out of scope.

Challenge this:
- Is `pricing_configs` the right home for a tax setting (it is a cost/margin config), versus a small
  `tax_settings`/`shop_settings` table or an env flag? Consider that `quotes.pricing_config_id` is
  nullable for manual quotes, so VAT must come from "current config" rather than the referenced row.
- Encoding the rounding rule in a DB `CHECK` (Postgres `round(numeric)` vs JS `Math.round`): good
  defence-in-depth or a trap if the legal rounding/base (e.g. VAT excluding shipping, or per-line
  rounding) changes later? What's the cheaper way to keep the DB honest?
- Tax-exclusive pricing (VAT added on top) is assumed. For a Vietnamese household business vs a
  company, are there concrete modelling differences (e.g. revenue-based tax with no VAT line) that
  would make this schema wrong rather than just unused? Flag what the Owner must confirm with an
  accountant before S1 ships.
- Leaving `orders` without VAT: does that create an inconsistency that will bite when the cart is
  re-enabled? Should the same columns be added to `orders` now while the migration is open?

## Question 4 — Print-time model from geometry (no server slicer) and deferring the slicer

Tentative (T3, §5.1–5.2, S0): grams = ρ × (min(V, A·t) + rest × infill + support), with t ≈ 0.9mm
(this reproduces the competitor's four measured weights exactly); minutes = setup + max(flow time
over shell/infill/support at different volumetric rates, layers × min-layer-time) + layers × per-layer
overhead, × a calibration factor. Constants live in code (`fdm-v1`), fitted in a 1-day spike (S0)
on 15–20 of the shop's own sliced `.3mf` files (their `slice_info` is ground truth), with acceptance
thresholds of ±15% grams / ±25% minutes (median). A real server-side slicer (OrcaSlicer CLI on Cloud
Run, research §6.3) stays out of scope. The output is a single price per file instead of today's
range.

Challenge this:
- Is a single number (rather than a range or "from X") honest enough given ±25% time error, when
  machine time is a large share of the price for tall/thin parts? Would you show a range, a
  confidence label, or a floor price instead — and how does that interact with staff anchoring?
- Is the max(flow, layer-time) structure a sound first model, or is there a simpler/more robust
  formulation (e.g. regression on volume, surface area, height and layer count) that calibrates
  better from ~20 samples? Is 20 samples enough to avoid overfitting 6–7 constants?
- Is deferring the server slicer the right call for launch, or should a sliced-time path be
  prioritised because the shop's main differentiator vs the competitor is "we price machine time"?
- A fixed support factor ignores geometry. Is overhang-area estimation from face normals cheap and
  reliable enough to include in v1, or correctly left for later?

End with one clear final recommendation per question. If you'd make the same call as the tentative
decision, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer here,
not a non-answer.
