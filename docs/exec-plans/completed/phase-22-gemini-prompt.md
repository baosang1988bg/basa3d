# Prompt gửi Gemini — Phase 22 review (Flex Dual Text: CSG boolean lần đầu, hướng đọc mặt bên chưa verify)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-22.md` in full (goal,
non-goals, and mục 4 "Quyết định kỹ thuật"). This phase is **already implemented and merged into
the working tree** (`src/lib/3d-tools/dual-text/`, route `/tools/dual-text`) — unlike the usual
pre-Codex-handoff use of this prompt template, there was no independent review before implementation
(Owner asked to move fast through the remaining roadmap; Claude self-reviewed only). All automated
checks pass (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, Playwright E2E) — this
is a **post-implementation architecture review**, not a pre-code gate. Changes are still cheap since
nothing has shipped to real customers yet. Do not write code. Follow the "Required output for
architectural alternatives" format from `GEMINI.md` (Current approach / Alternative / Pros-cons /
Complexity impact / Cost impact / Recommendation / What docs/code would need to change) for each
question below, then give a final concrete recommendation for each.

## Project context (short version, full detail is in the docs above)
BaSa3D is a small 3D-printing business platform. Phase 21 shipped Flex Keychain (block-style,
`three-bvh-csg` not yet needed there). Phase 22 is the first phase to actually use `three-bvh-csg`
for a real CSG boolean: it builds an "ambigram cube" effect — one word extruded along the world Z
axis (front face), a second word extruded along X (side face, after a 90° rotation), intersected
per character block into 1 mesh, mounted on a shared base plate. Read
`src/lib/3d-tools/dual-text/dual-text-engine.ts` for the actual implementation.

## Question 1 — Shipping an analytically-derived, unverified mirror direction for the side word
`dual-text-constants.ts` has `SIDE_GLYPH_MIRRORED = false`, chosen by reasoning through the 90°
rotation math (documented in a code comment), not by rendering/printing and visually confirming
which way the second word actually reads from the +X viewing corner. If wrong, every "Flex Dual
Text" order shipped before this is caught would print with word #2 backwards.

Challenge this:
- Is a single flippable boolean constant with a code comment an adequate safeguard, or does shipping
  a customer-facing feature with an unverified 50/50 chance of a backwards word warrant a stronger
  gate (e.g., blocking the export buttons behind a "verified" flag until a human confirms once,
  logging the constant's value into every Custom Request description so staff can visually check the
  first few orders before trusting it)?
- Is there a cheap way to verify this analytically/programmatically without a physical print or a
  screenshot capability (e.g., a text-based test that samples the mesh at known coordinates for an
  asymmetric letter like "F" and checks which side the crossbar is nearest to)?

## Question 2 — No Web Worker, MAX_DUAL_TEXT_BLOCKS=12 CSG intersections on the main thread
Phase 19's roadmap only mandated a Web Worker for Jigsaw's arbitrary-mesh CSG (mục 4.2); Dual
Text's per-block CSG (up to 12 sequential `Evaluator.evaluate` calls, each on a small
font-glyph-sized brush) runs on the main thread with no worker, gated only by the 12-block cap.

Challenge this:
- Is 12 sequential small-brush CSG operations actually safe on the main thread across realistic
  customer devices (older phones, low-end laptops), or is there a concrete triangle/complexity
  threshold where this starts janking the UI that the current cap doesn't protect against?
- If risk exists, is a lower cap enough, or does correctness here actually require the same Web
  Worker investment Phase 19 reserved for Jigsaw?

## Question 3 — Missing-letter blocks default to "a full solid cube, no carving" for the shorter word
Phase 22 mục 3/mục 2.4-equivalent (see phase-22.md's Non-goals): when the two words differ in
length, the shorter word's missing positions are treated as a space, which `buildFaceBrush` turns
into a plain solid cube (no glyph carved) rather than shrinking the block count or centering the
words differently.

Challenge this:
- Is "leftover blocks are blank on the missing word's face" the least-surprising behavior for a
  customer typing e.g. "HI" and "WORK" (2 vs 4 letters), or would auto-centering the shorter word
  (with blank blocks at both ends rather than only the end) be clearly better UX for the same
  implementation cost?

End with one clear final recommendation per question. If you'd make the same call as the current
implementation, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer
here, not a non-answer.
