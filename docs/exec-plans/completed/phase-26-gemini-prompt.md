# Prompt gửi Gemini — Phase 26 review (Jigsaw Studio rút gọn: bỏ Web Worker, cắt lưới thay Voronoi)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-26.md` in full (goal,
non-goals, mục 2 "Rút gọn phạm vi so với trang tham khảo — đã Owner xác nhận", mục 5 "Rủi ro"), plus
`docs/exec-plans/completed/phase-19.md` mục 4.2 (the roadmap-level decision this phase deliberately
narrows: Web Worker was mandated specifically for Jigsaw's arbitrary-mesh CSG). This phase is
**already implemented and merged** (`src/lib/3d-tools/jigsaw/`, route `/tools/jigsaw`) without an
independent review before implementation — Owner explicitly approved the scope cuts in mục 2 after
Claude flagged them, but no outside architectural review has happened. All automated checks pass,
including a real Playwright E2E that uploads an actual STL file end-to-end. This is a **post-
implementation architecture review**; changes are still cheap. Do not write code. Follow the
"Required output for architectural alternatives" format from `GEMINI.md` for each question below,
then give one final concrete recommendation per question.

## Project context (short version, full detail is in the docs above)
Jigsaw Studio is the only tool in the whole Phase 20-26 run whose input is an **arbitrary user-
uploaded 3D model** (STL/OBJ), not a bounded set of parameters — Phase 19 flagged this as the
highest-risk remaining tool and mandated (mục 4.2) a hard triangle-count check plus running the
cutting algorithm in a Web Worker specifically because of this unbounded-input risk. Phase 26 narrows
scope significantly: rectangular grid cutting (not Voronoi), a single fixed puzzle-tab wave shape per
edge (not randomized per edge), a lower 20,000-triangle cap and 3x3 max grid, and **no Web Worker** —
cutting runs on the main thread, gated only by the lower caps. Read
`src/lib/3d-tools/jigsaw/jigsaw-engine.ts`.

## Question 1 — Dropping the Web Worker that Phase 19 explicitly mandated for this exact tool
Phase 26 mục 2.3 reasons that a lower triangle cap (20,000 vs Phase 19's suggested 50,000) and a
small max grid (3x3 = 9 CSG intersections, each against the full uploaded mesh) make main-thread
execution safe enough for v1, deferring the Web Worker investment to a future phase if real usage
shows jank.

Challenge this:
- Is a 20,000-triangle mesh intersected 9 times (once per grid cell) on the main thread actually
  safe across realistic customer hardware (older phones especially, since this is a public storefront
  tool with no device requirement), or does skipping the Web Worker specifically here — on the one
  tool Phase 19 called out by name for this exact risk — undo the safety margin the lower caps are
  supposed to buy?
- If the caps are insufficient, is the fix "add the Web Worker now" or "lower the caps further
  still" — which is the more defensible v1 boundary given `three-bvh-csg`'s per-intersection cost
  scales with total triangle count on both sides of the operation?

## Question 2 — Rectangular grid + one fixed wave-tab shape instead of Voronoi + per-edge randomization
Phase 26 mục 2.1-2.2 replace the reference site's presumed Voronoi-style irregular piece shapes and
(likely) per-edge-randomized tab shapes with a plain rows x cols grid where every internal edge uses
the identical semicircular bump pattern (only the bump's in/out direction alternates checkerboard-
style, verified by `tests/jigsaw-engine.test.ts`'s interlock test).

Challenge this:
- Is a same-shaped-tab rectangular grid still a recognizable, sellable "jigsaw puzzle" product, or
  does the uniform tab shape (every piece's edge looks identical except for orientation) risk pieces
  being ambiguously interchangeable/hard to solve as an actual puzzle — undermining the core appeal
  of a jigsaw cut versus, say, Organizer's plain grid dividers?
- Is there a cheap improvement within the same architecture (e.g., varying the bump radius or count
  per edge based on a seeded hash of (row,col), still no Voronoi) that would meaningfully improve
  piece-distinctiveness without approaching the original scope's complexity?

## Question 3 — No manifold/watertightness validation of the uploaded mesh before cutting
Phase 26 Non-goals explicitly skip validating whether an uploaded STL/OBJ is watertight/manifold
before running CSG on it — errors surface only as a generic try/catch failure at cut time.

Challenge this:
- For a public tool accepting arbitrary customer uploads (many hobbyist STL exports are *not*
  perfectly watertight), is "let CSG fail and show a generic error" an acceptable UX floor, or is a
  cheap pre-check (e.g., using `three-mesh-bvh`'s tooling, already a transitive dependency of
  `three-bvh-csg`, to flag obviously non-manifold input) worth adding now rather than after the
  first wave of confused support requests?

## Question 4 — Fix for the real bug found in E2E: dropping `uv` from the CSG evaluator's attribute list
A real bug was caught by the Playwright E2E (not by unit tests using `THREE.BoxGeometry`, which
always has UVs): `three-bvh-csg`'s `Evaluator` defaults to expecting `position`/`uv`/`normal` on
every brush and throws reading `.array` off an undefined attribute when the uploaded mesh (STL/OBJ,
which carry no UV data) lacks one. Fixed by setting `evaluator.attributes = ['position', 'normal']`
globally for this tool.

Challenge this:
- Is dropping `uv` entirely (rather than synthesizing a dummy UV attribute on brushes that lack one)
  the right fix given pieces are only ever exported as STL/3MF for printing, or could this silently
  produce a different/worse issue for some future feature (a textured preview, say) that Phase 26
  isn't anticipating?

End with one clear final recommendation per question. If you'd make the same call as the current
implementation, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer
here, not a non-answer.
