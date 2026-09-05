# Prompt gửi Gemini — Phase 17 kickoff (browser 3D text/keychain generator → custom request)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-17.md` in full (it has
the complete context: goal, non-goals, and the "Quyết định kỹ thuật đề xuất" section — all
currently tentative, none implemented yet). Do not write code. Follow the "Required output for
architectural alternatives" format from `GEMINI.md` (Current approach / Alternative / Pros-cons /
Complexity impact / Cost impact / Recommendation / What docs/code would need to change) for each
question below, then give a final concrete recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)

BaSa3D is a small 3D-printing business platform (Next.js/Supabase, product catalog, custom print
requests, quoting, production tracking, inventory). Phase 4 built the public custom-request flow
(`custom_requests` table, file attachment upload to Supabase Storage, `POST
/api/public/custom-requests` + `POST /api/public/custom-requests/attachments`). Phase 13 built a
pure pricing engine (`src/services/pricing.service.ts::computePricingBreakdown`,
`src/lib/pricing/smart-waste-estimator.ts`) that turns a known net weight (grams) + print/labor
minutes into a price — but quote creation itself (`quote.service.ts::createQuote`) is staff-only,
there is no public/customer-facing entrypoint that creates a real `quote`. Phase 17 adds a new
public, unauthenticated page where a customer types a name/text, previews a 3D keychain/name-tag
shape in-browser (three.js + opentype.js, text extrusion), exports an STL, and either downloads it
or sends it straight into the existing custom-request flow (reusing the attachment-upload +
request-creation endpoints unchanged) — with an advisory (non-binding) price estimate shown along
the way, computed from a brand-new mesh-volume-to-grams estimator that does not exist in the
codebase yet.

None of Phase 17's design has been challenged by anyone but Claude so far. Zero lines of code have
been written for this phase — everything below is still easy to change.

## Question 1 — Advisory-only price estimate, no auto-created formal quote

Phase 17 shows the customer a rough price estimate computed client-side (mesh volume → estimated
grams → `computePricingBreakdown`), but explicitly does **not** create a real `quote` row — that
stays 100% staff-only, matching the current architecture boundary. The stated reason is that
`createQuote` requires an `actorId` today and changing that boundary is out of scope for this
phase. The estimate is meant purely to set expectations before staff manually quotes.

Challenge this:
- Is showing an unofficial estimate worth the UX/trust risk if it diverges meaningfully from the
  staff's real quote, versus simply not showing any price at all until staff responds (Phase 15's
  existing "staff gets notified fast" flow already promises fast turnaround)?
- Is there a middle ground — e.g. a wide range instead of a point estimate, or gating the estimate
  behind an explicit "ước tính rất thô" disclosure step — that meaningfully reduces the
  expectation-mismatch risk without adding real quote-creation complexity?
- Does skipping real `quote` creation here actually save meaningful engineering effort, or is the
  public-quote-creation boundary artificial given the pricing math is already pure/reusable?

## Question 2 — Mesh weight & print-time estimate reliability (customer-facing numbers)

To feed `computePricingBreakdown`, Phase 17 needs `netWeightGrams` and `printMinutes`, neither of
which exist yet for a freshly-generated mesh. The tentative plan: (a) compute mesh volume from the
three.js geometry, multiply by a fixed material density (PLA ≈ 1.24 g/cm³) and a fixed assumed
infill (100%, "small/thin object" justification) to get grams; (b) derive minutes from a fixed
heuristic coefficient (minutes per gram), calibrated informally from the shop's experience, with no
real slicing involved. Both numbers are shown to the customer, labeled "estimate," before any
staff review.

Challenge this:
- Is a fixed-infill/fixed-density volumetric estimate accurate enough for small text/keychain
  geometry specifically (thin extruded letters, varying wall thickness) to be worth showing at all,
  or is the error margin large enough that it should be treated as internal-only (staff sees it,
  customer doesn't) until validated against real prints?
- Is there a lower-risk way to get a materially better estimate without adding real slicing
  infrastructure (e.g. a bounding-box + surface-area heuristic tuned specifically for thin extruded
  text, vs. full mesh volume)?
- What validation gate (e.g. N real test prints compared against the estimate) should exist before
  this ships to real customers, given Phase 16's already-established principle of "never silently
  auto-decide financial/business-critical numbers"?

## Question 3 — Keyring hole: skip CSG boolean vs. add a new dependency

For v1, the plan avoids a real boolean subtract for the keyring hole (which would need a new CSG
library like `three-bvh-csg`, adding a dependency and non-manifold-mesh risk) and instead proposes
modeling a closed loop directly in the 2D path before extrusion — no boolean operation at all.

Challenge this:
- Is the "closed loop in the 2D path" approach actually achievable for arbitrary user text/shapes
  without boolean ops, or does it only work for specific simple cases (and silently produce a
  broken/no-hole result for others)?
- Given `three-bvh-csg` (or an equivalent) is a well-established, maintained library, is avoiding
  it here actually reducing risk, or just trading a well-understood dependency risk for a
  worse/less-tested geometry hack?
- If the no-boolean approach turns out fragile in practice, what's the concrete fallback plan (v1.1
  adds the CSG dependency, or the hole feature gets cut entirely for v1)?

## Question 4 — STL-only export, no 3MF / no multi-color in v1

Phase 17 scopes out 3MF export and multi-color/AMS support for v1, reasoning that three.js has no
built-in 3MF writer (would need a custom writer or a new library) and multi-color adds real
complexity. The reference landing page's equivalent tools (Flex Tag, Flex Keychain) support 3MF
color options as a core feature.

Challenge this:
- Does STL-only meaningfully reduce Phase 17's commercial value (e.g. single-color keychains/name
  tags are still a common, sellable product), or is 3MF/multi-color actually necessary for this
  feature to be worth building at all?
- Is there a lightweight, low-risk way to get 3MF export later (e.g. a minimal 3MF writer for the
  single-mesh-plus-color-id case, vs. a full-featured library) that wouldn't require redoing the
  export pipeline built for STL?

End with one clear final recommendation per question. If you'd make the same call as the tentative
decision, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer here,
not a non-answer.
