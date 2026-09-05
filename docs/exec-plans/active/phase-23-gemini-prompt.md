# Prompt gửi Gemini — Phase 23 review (Flex Car: silhouette tự vẽ, co giãn phi tuyến tính 2 mặt)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-23.md` in full (goal,
non-goals, mục 4 "Quyết định kỹ thuật"), plus `docs/exec-plans/active/phase-22.md`'s mục 4.1-4.2
(the CSG "ambigram" technique Phase 23 reuses). This phase is **already implemented and merged**
(`src/lib/3d-tools/car-nameplate/`, route `/tools/car-nameplate`) without an independent review
before implementation — Owner asked to move fast, Claude self-reviewed only. All automated checks
pass. This is a **post-implementation architecture review**; changes are still cheap. Do not write
code. Follow the "Required output for architectural alternatives" format from `GEMINI.md` for each
question below, then give one final concrete recommendation per question.

## Project context (short version, full detail is in the docs above)
Phase 22 shipped the first real CSG boolean tool (Dual Text: 2 words intersected per character
block). Phase 23 reuses the same intersect-2-perpendicular-brushes technique for a different pairing:
1 vehicle silhouette (extruded along Z, the "front view") intersected with 1 continuous name string
(extruded along X after rotation, the "side view") as a single combined solid — not per-character
blocks like Dual Text. Read `src/lib/3d-tools/car-nameplate/car-nameplate-engine.ts`.

## Question 1 — A hand-authored "Sedan" silhouette instead of a licensed real car outline
Phase 23 mục 2 explicitly chose to hand-draw a simplified sedan side-profile (`buildSedanShape()`,
primitive curves) rather than sourcing/licensing a real vehicle silhouette vector, specifically to
avoid any copyright question about depicting a specific real car's shape. The reference site (whose
UI this tool mirrors) shows a "Sedan" preset that looks more detailed/recognizable.

Challenge this:
- Is a generic, hand-drawn silhouette (not modeled on any specific real car) actually a *sufficient*
  product for a "Flex Car" nameplate tool, or does it risk feeling like an obviously worse knockoff
  next to the reference, undermining the whole feature's value even though it dodges the licensing
  question cleanly?
- If more/better silhouettes are wanted later, is hand-authoring more (in the same primitive-curve
  style) the right long-term approach, or should Phase 23 have instead scoped in sourcing 1-2
  properly-licensed generic vehicle silhouette assets (not tied to any specific real car brand/model)
  from the start?

## Question 2 — Non-uniform independent stretch-scaling of both the car silhouette and the name text
`buildFittedGeometry()` (mục 4.1) scales the car silhouette's natural aspect ratio (wide/short) and
the name text's natural aspect ratio (also wide/short, but differently) independently in X and Y to
each exactly fill the same `width x height` box, rather than uniformly scaling each by its own single
factor (which is what Phase 22's Dual Text does per-character). This guarantees full overlap for the
CSG intersection but visibly distorts both the car's proportions and the letters' proportions.

Challenge this:
- Is non-uniform stretch an acceptable trade for guaranteed intersection coverage, or does the
  resulting distortion (a squashed/stretched car, squashed/stretched letters) make the printed
  result look noticeably worse than Dual Text's per-character uniform scaling — is there a
  concrete alternative (e.g., padding + partial-overlap tolerance instead of forcing exact
  full-box coverage) that would look better without much more complexity?

## Question 3 — Keyring tab wired to "add flat base" only, not available on the bare nameplate
Phase 23 mục 4.4 (post-review correction) ties the keyring hole to the optional flat base — if the
customer disables "Thêm đế phẳng", the keyring checkbox becomes unavailable, reasoning that punching
a hole through the fragile, unpredictable-thickness intersected nameplate shape directly is riskier
than punching it through a flat, uniform-thickness base plate.

Challenge this:
- Is this the right trade-off, or is losing "keyring without a base" a bigger usability gap than the
  geometric risk it avoids — e.g., could the tool instead just refuse per-design (validate at
  runtime whether the requested keyring-hole location on the bare nameplate has enough local
  thickness) rather than blanket-disabling the option whenever there's no base?

End with one clear final recommendation per question. If you'd make the same call as the current
implementation, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer
here, not a non-answer.
