# Prompt gửi Gemini — Phase 20 kickoff (Flex Organizer: hình học lưới ngăn, rủi ro watertight, và tổng quát hoá route giá)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-20.md` in full (it has
the complete context: goal, non-goals, and the "Quyết định kỹ thuật" section — all currently
tentative, none implemented yet), plus `docs/exec-plans/completed/phase-19.md`'s mục 4 (kiến trúc
route group `(tools)` và các quyết định CSG/3MF đã chốt ở cấp roadmap — Phase 20 kế thừa nguyên,
không mở lại) and `docs/exec-plans/completed/phase-17.md`'s mục 3 (quyết định "2D Path Hole thay vì
3D CSG" — tiền lệ trực tiếp liên quan đến Question 1 bên dưới). Do not write code. Follow the
"Required output for architectural alternatives" format from `GEMINI.md` (Current approach /
Alternative / Pros-cons / Complexity impact / Cost impact / Recommendation / What docs/code would
need to change) for each question below, then give a final concrete recommendation for each — not
just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D is a small 3D-printing business platform (Next.js App Router, Supabase/Postgres). Phase 17
shipped the first browser-based 3D generator tool (`/tools/keychain-generator`: `three.js` +
`opentype.js`, extrude text/base into a merged single-mesh STL, with a server-side
`keychain-price-estimate` route that computes an advisory price range without exposing real pricing
config to the browser). Phase 19 is a closed roadmap document that surveyed 8 more tools to clone
from a third-party inspiration site and locked in shared architecture: all future tools live under
one Next.js app in a new `(tools)` route group with a shared minimal layout, lazy-loaded 3D canvas
via `next/dynamic(ssr:false)`, and a file convention (`src/lib/3d-tools/<slug>/<slug>-engine.ts`).
Phase 20 is the first tool built on that shared architecture: Flex Organizer — a tray/compartment
divider generator (tray dimensions + grid spec → merged STL), rated lowest technical risk in the
roadmap because it needs no font and no CSG boolean (compartments are separate boxes placed
edge-to-edge, not intersected).

None of Phase 20's design has been challenged by anyone but Gemini/Claude so far. No code has been
written yet for this phase — this is still a draft, so anything here is cheap to change.

## Question 1 — Is "no CSG needed" actually safe, given the walls only get `mergeGeometries`, not a real boolean union?
Phase 20's tentative plan (mục 3.2) builds the tray floor and each divider wall as separate
`THREE.BoxGeometry` instances placed edge-to-edge, then calls `mergeGeometries` (same utility Phase
17 used to combine its base and text meshes) to produce one exported STL — explicitly avoiding any
CSG boolean library, on the reasoning that the boxes don't overlap/intersect so a true boolean union
isn't geometrically necessary. Phase 17 separately chose "2D Shape Holes, not 3D CSG" for its keyring
hole, but for a different reason (holes cut into a single 2D profile before extrusion, not multiple
already-3D solids merged after the fact).

Challenge this:
- Is `mergeGeometries` on abutting (touching-but-not-overlapping) boxes actually guaranteed to
  produce a watertight/manifold mesh once exported to STL, or does floating-point coincidence at the
  touching faces risk leaving gaps, duplicate coplanar faces, or non-manifold edges that a slicer
  (Bambu Studio) would flag or silently mis-slice?
- Is there a cheap, purely-geometric fix if there IS a risk (e.g. deliberately overlapping each wall
  into the floor/adjacent walls by a small epsilon, e.g. 0.01-0.1mm, before merging — a "generous
  overlap" trick common in parametric CAD-for-3D-printing) that avoids pulling in a full CSG library,
  or does this risk actually justify adding `three-bvh-csg` (already approved for Phase 19's Dual
  Text/Car tools) here too for a guaranteed-correct boolean union?
- If the epsilon-overlap approach is recommended, what's a concrete safe default value given typical
  FDM nozzle/layer tolerances, so Phase 20 can lock a number instead of leaving it as a guess?

## Question 2 — Grid parameter scope: are "equal grid" + "custom column/row sizes" sufecient for v1?
Phase 20 (mục 3.1) tentatively limits input to two modes: an equal N-rows × M-columns grid, or a
custom mode where the customer supplies an explicit list of column widths and row heights (must sum
to the tray's usable interior). Freeform/arbitrary-shaped compartments are explicitly out of scope
(Non-goals), deferred to a future phase only if real demand shows up.

Challenge this:
- For the realistic customer base (Vietnamese small-business/hobbyist 3D-printing customers ordering
  custom trays for tools, screws, cosmetics, etc.), do these two modes cover the large majority of
  real requests, or is there a common third pattern (e.g. a grid with occasional merged/larger
  compartments, like a spreadsheet with merged cells) that's cheap enough to support in v1 that
  deferring it would just cause a wave of "almost worked, had to ask staff to modify" requests?
- Is validating "custom column widths + row heights must sum to interior dimensions" sufficient, or
  should Phase 20 also decide on a rounding/tolerance rule (e.g. what happens with floating-point sums
  that are off by 0.001mm) now, so Codex doesn't have to invent one?

## Question 3 — Generalizing the price-estimate route now vs keeping it keychain-named
Phase 17 added `POST /api/public/keychain-price-estimate` (server-side, receives
`{ weightGrams, printMinutes }`, calls `getCurrentPricingConfig()` + `computePricingBreakdown()`,
returns only `{ minPriceVnd, maxPriceVnd }` — deliberately never sending the real pricing config to
the browser). Its logic has nothing keychain-specific in it. Phase 20's tentative plan (mục 3.4) is
to rename/generalize it to `POST /api/public/tool-price-estimate` now, reasoning that otherwise every
future tool phase (21-27) would face the same question repeatedly, or end up with near-duplicate
routes differing only by name.

Challenge this:
- Is renaming/generalizing this route now the right call, or is duplicating a thin route per tool
  actually simpler/safer (e.g. avoids a rename touching whatever GA4/analytics events or client code
  already reference the old path, for a route that's cheap to duplicate)?
- If generalizing: should the old `keychain-price-estimate` path be deleted outright (breaking any
  stale client reference) or kept as a redirect/alias — which is more consistent with how this repo
  handles route renames elsewhere (check for precedent), and does AGENTS.md's rules on public API
  surface changes say anything relevant here?

## Question 4 — Locking concrete size/compartment-count limits now
Phase 20 (mục 3.3) tentatively caps tray dimensions (e.g. 300×300×100mm) and grid density (e.g. 20×20
= 400 compartments) to keep client-side WebGL/export performant, but the actual numbers are marked as
"chưa xác nhận" (not yet confirmed against BaSa3D's real printer bed size).

Challenge this:
- Given this is ultimately a business/hardware fact (the shop's actual printer bed dimensions) rather
  than a pure architecture question, should Phase 20 block on the owner supplying the real number
  before implementation, or is there a safe generic default (e.g. common FDM bed sizes like 256mm/
  220mm) Codex can implement now with a single named constant that's trivial to adjust later without
  code review risk?

End with one clear final recommendation per question. If you'd make the same call as the tentative
decision, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer here,
not a non-answer.
