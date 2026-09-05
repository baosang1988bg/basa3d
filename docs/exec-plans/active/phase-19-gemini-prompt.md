# Prompt gửi Gemini — Phase 19 kickoff (roadmap clone 8 tool 3D, kiến trúc "mỗi tool 1 web" và các gap kỹ thuật mới)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-19.md` in full (it has
the complete context: goal, non-goals, and the "Quyết định cần chốt" section — all currently
tentative, none implemented yet), plus `docs/exec-plans/completed/phase-17.md`'s opening section and
`src/lib/keychain/keychain-engine.ts` (the existing tool this roadmap builds on top of). Do not write
code. Follow the "Required output for architectural alternatives" format from `GEMINI.md` (Current
approach / Alternative / Pros-cons / Complexity impact / Cost impact / Recommendation / What
docs/code would need to change) for each question below, then give a final concrete recommendation
for each — not just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D is a small 3D-printing business platform (Next.js App Router, Supabase/Postgres). Phase 17
already shipped 1 browser-based 3D generator tool (`/tools/keychain-generator`, using `three.js` +
`opentype.js` to build extruded text/keychain geometry and export STL) — deliberately scoped to just
that one tool, out of 14 tools found on a third-party inspiration site ("Flex Playground"). Phase 19
is a roadmap-only document (no code) that surveys the remaining 8 active tools on that source site
(Flex Sculpt, Flex Lamp, Flex Dual Text, Flex Keychain block-style, Flex Organizer, Flex Car, Jigsaw
Studio, Hinge Box Studio — a 9th, Flex Tag, was excluded as already covered by the existing
keychain-generator), rates each tool's technical complexity and reuse potential against the existing
engine, and proposes a priority order for turning each into its own future phase.

None of Phase 19's design has been challenged by anyone but Claude so far. No code has been written
yet for any of the 8 remaining tools — this is still a draft roadmap, so anything here is cheap to
change.

## Question 1 — Cloning "each tool opens its own web" as an in-app route vs a separate standalone app per tool
Re-surveying the source site's HTML showed each tool card does **not** link to an internal path —
it navigates to a **fully separate subdomain** (e.g. `flex-organizer.<worker-domain>`,
`flex-sculpt.<worker-domain>`, each its own Cloudflare Workers deployment, presumably its own
codebase/build). So the source is a thin landing "hub" plus 9 independently-deployed apps. The user
explicitly asked to clone that same experience ("các function đều mở ra 1 web" — each tool opens
into its own web). Phase 19's tentative decision is to interpret this as a **UX** requirement only
(each tool gets its own full-page route with its own URL, e.g. `/tools/flex-organizer`, feeling like
a dedicated app) inside the **existing single Next.js app** — not to literally replicate the source's
multi-app/multi-deploy infrastructure, reasoning: (a) an in-app route reuses the storefront's shared
header/footer/i18n/analytics/session instead of duplicating that plumbing 9 times, (b) one
codebase/one CI/one domain is easier to operate at this team's current scale, (c) there's no existing
precedent in this repo for multi-deploy-per-product.

Challenge this:
- Is "in-app route, not separate deploy" actually the right reading of what the user asked for, or
  are there concrete reasons a business like this (small 3D-printing shop, browser-based CAD tools)
  would benefit from the source's actual multi-app-per-tool architecture (e.g. independent scaling/
  deploy cadence per tool, isolating a crash-prone sculpting engine from the main storefront, letting
  each tool use a wildly different JS bundle/tech stack without bloating the main app's bundle)?
- Given 3 of the 8 tools (Dual Text, Car, Jigsaw) will need a new CSG dependency and at least one
  (Flex Sculpt) is described as "a mini ZBrush" — is there a bundle-size/performance argument for
  isolating the heaviest tools (e.g. as a separate route group with its own code-splitting boundary,
  or genuinely a separate micro-frontend) even while staying on one Next.js app, rather than treating
  all 8 tools uniformly as `(storefront)` routes like the existing keychain-generator?
- If the answer stays "one Next.js app, one route per tool," is there a naming/structure convention
  Phase 19 should lock in now (e.g. `src/app/[locale]/(storefront)/tools/<slug>/page.tsx` +
  `src/lib/<slug>/<slug>-engine.ts` mirroring the keychain pattern exactly) so all 8 future phases
  don't each reinvent the file layout?

## Question 2 — Introducing a CSG boolean library for 3 of the 8 tools
Three of the 8 tools (Dual Text, Car, Jigsaw Studio) fundamentally require mesh boolean operations
(intersect for the multi-angle-text tools, subtract for jigsaw piece-cutting) that `three.js` does
not provide natively. Phase 19's tentative decision is to plan on `three-bvh-csg` as the CSG library
for all 3, deferring the actual add-dependency decision to whichever of those tools' phase comes
first — without having evaluated its bundle size, browser (especially mobile) performance for
user-supplied meshes (Jigsaw Studio takes an arbitrary uploaded model, not a small parametric shape),
or whether it's still actively maintained.

Challenge this:
- Is `three-bvh-csg` still the right default recommendation today, or is there a better-maintained/
  smaller alternative for this exact use case (parametric intersect for 2 tools, arbitrary-mesh
  subtract for 1 tool with unknown input complexity)?
- AGENTS.md rule 8 says no new dependency without a concrete reason — given 3 of 8 tools share this
  need, does it make sense to resolve the CSG library choice once, now, as part of Phase 19's
  roadmap (a real technical decision, not deferred to each sub-phase), rather than re-deciding 3
  times?
- Jigsaw Studio's input is an arbitrary user-uploaded mesh (unlike the other parametric tools) —
  does that change the risk profile enough (e.g. pathological/huge/non-manifold meshes crashing the
  CSG operation client-side) that it deserves a different technical approach entirely (e.g.
  server-side processing) rather than being lumped into "same CSG library, do it last" as Phase 19
  currently proposes?

## Question 3 — Excluding "Flex Tag" as already covered, and deferring the 3MF multi-color writer decision
Phase 19 excludes a 9th active source tool, "Flex Tag" (name → nameplate/keychain, STL/3MF output),
reasoning it's redundant with the already-shipped `/tools/keychain-generator`. Separately, Phase 19
defers the concrete design of a multi-color 3MF export writer (needed for tool #2, block-style
keychain with per-letter color) to that tool's own future phase, without having checked whether any
existing JS library already implements 3MF Core+Materials writing.

Challenge this:
- Is excluding Flex Tag safe, or could re-checking the actual source tool (not just its one-line
  landing description) reveal a materially different scope (e.g. batch nameplates, different export
  options) that the existing keychain-generator doesn't cover — is a quick before/after feature
  comparison worth doing before Phase 19 locks this exclusion in as final?
- For the 3MF multi-color writer: given this is genuinely new capability (Phase 17's STL export
  doesn't need it), should Phase 19 name a concrete library candidate now (if one exists) instead of
  leaving "write it ourselves vs. use a library" fully open, the same way Question 2 asks for CSG?

End with one clear final recommendation per question. If you'd make the same call as the tentative
decision, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer here,
not a non-answer.
