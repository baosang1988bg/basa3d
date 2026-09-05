# Prompt gửi Gemini — Phase 24 review (Flex Lamp: bẻ cong tấm phẳng thay CSG, đường kính socket chưa xác nhận)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-24.md` in full (goal,
non-goals, mục 2 "Rà soát hiện trạng có thể tái dùng & Quyết định kiến trúc"). This phase is
**already implemented and merged** (`src/lib/3d-tools/lamp-shade/`, route `/tools/lamp-shade`)
without an independent review before implementation — Owner asked to move fast, Claude self-
reviewed only. All automated checks pass. This is a **post-implementation architecture review**;
changes are still cheap. Do not write code. Follow the "Required output for architectural
alternatives" format from `GEMINI.md` for each question below, then give one final concrete
recommendation per question.

## Project context (short version, full detail is in the docs above)
Phase 24 builds a perforated cylindrical lamp shade (5 hole patterns: circle/hexagon/vertical-
slit/diamond/wave, arranged in a rows x columns grid around the circumference). Instead of punching
each hole with a CSG boolean subtraction (Phase 19's Jigsaw/Dual Text lineage), Phase 24 mục 2.1
deliberately avoids CSG entirely: it builds a **flat rectangular perforated panel** (2D holes via
`THREE.Shape.holes`, the same technique Phase 17/20 use for a single hole, just repeated in a grid),
extrudes it to wall thickness, then bends it into a cylinder by remapping every vertex
`(x,y,z) -> ((R+z)cos(x/R), y, (R+z)sin(x/R))`. Read
`src/lib/3d-tools/lamp-shade/lamp-shade-engine.ts`.

## Question 1 — Vertex-remap "bend into a cylinder" instead of CSG or a true lathe/revolve
Challenge this:
- Is the vertex-remap-after-extrude technique geometrically sound for FDM printing at scale (up to
  `MAX_TOTAL_HOLES = 1000` holes), or does bending a flat, holed panel risk subtle self-
  intersection/non-manifold artifacts near hole boundaries that a true lathe-then-CSG-subtract
  approach wouldn't have — is there a concrete way to tell without a real slicer/print test?
- The seam where the panel's two edges (x=0 and x=circumference) meet is not welded (mục 2.1
  explicitly accepts this as a "small aesthetic gap"). Is that actually just cosmetic, or could an
  unwelded seam on a load-bearing cylindrical shell (however thin) cause a real structural weak
  line when printed, given the panel's edges may not land on the same print layer boundary?

## Question 2 — `SOCKET_MIN_INNER_DIAMETER_MM = 60` is a guessed default, not a confirmed spec
Phase 24 mục 2.3 could not find the real "MH001" kit's socket diameter through static-DOM
inspection of the reference site, so it hardcoded 60mm as a "common candle/light holder diameter"
lower-bound warning threshold — advisory only, doesn't block export.

Challenge this:
- Given the tool explicitly markets itself as fitting a named kit ("MH001") in its own UI copy, is
  shipping with an unverified guessed constant (rather than blocking export, or removing the
  MH001-specific framing until the real number is confirmed) an acceptable risk to put in front of
  paying customers, or does this cross into making a compatibility claim BaSa3D can't back up yet?

## Question 3 — "Sóng" (wave) pattern approximated as an elongated ellipse
Phase 24 mục 2.1/Non-goals explicitly ships a simplified ellipse hole for the "wave" pattern instead
of a true sine-modulated wavy-edged hole, to bound implementation effort.

Challenge this:
- Is this simplification low-risk enough to ship silently under the same "Sóng" label the reference
  site uses (implying visual parity that doesn't actually exist), or should the UI use a different,
  more honest label (e.g. "Oval") until a real wave-shaped hole is implemented?

End with one clear final recommendation per question. If you'd make the same call as the current
implementation, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer
here, not a non-answer.
