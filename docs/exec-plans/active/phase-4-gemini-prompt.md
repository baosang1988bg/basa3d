# Prompt gửi Gemini — Phase 4 kickoff (design system: style + retrofit scope)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-4.md`
in full (it has the complete context: goal, non-goals, the design-system
decision already tentatively made, and the open Pending items). Do not write
code. Follow the "Required output for architectural alternatives" format
from `GEMINI.md` (Current approach / Alternative / Pros-cons / Complexity
impact / Cost impact / Recommendation / What docs-code would need to change)
for each question below, then give a final concrete recommendation for
each — not just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D is a small 3D-printing business platform (one owner, one staff).
Stack: Next.js App Router + TypeScript, Tailwind v3.4 + shadcn/ui
(`style: base-nova`, `baseColor: neutral`). Phase 3 (admin dashboard) is
done and working: login, dashboard, products, inventory, orders, custom
requests/quotes, print jobs, staff, audit logs — all using shadcn's default
neutral theme and a placeholder `font-family: Arial` (`src/app/globals.css:5`).
Phase 4 is the public storefront (product listing/detail, homepage,
`/custom-print` landing) — it does not exist yet (`src/app/page.tsx` is
still a stub).

Before writing any storefront code, Claude ran the newly-installed
`ui-ux-pro-max` skill (a searchable UI/UX design-knowledge tool) and did a
brainstorming pass with the human (including a visual mockup comparison) to
pick a design direction. The tentative decision, recorded in
`docs/exec-plans/active/phase-4.md` decision #1:

- One shared base color palette: primary teal `#0F766E`, accent/CTA
  terracotta-orange `#D97706` (both need full light+dark variants still).
- **Storefront** (customer-facing) leans **Claymorphism**: large border
  radius (20–26px), thick 3–4px borders, double box-shadow (chunky,
  toy-like). Rationale: the product being sold is a physical 3D-printed
  object, so a "toy-like, has volume" visual style was judged to suit it,
  and the target audience was chosen as "general maker/hobbyist" (not
  premium/luxury, not B2B).
- **Admin** (Phase 3, OWNER + STAFF only, 2 users total) gets a **full
  visual retrofit** to a flat, high-density, low-saturation style using the
  *same* base tokens — color reserved for status meaning only (order/print
  job status chips), not decoration. This is a full redesign of every
  existing Phase 3 admin page, not just a token/font swap.
- The `ui-ux-pro-max` skill itself flagged Claymorphism as
  `accessibility risk: conditional` (needs explicit contrast/focus/
  reduced-motion verification) and noted it has a higher CSS/implementation
  cost (multiple shadow layers, thick borders) than a flatter style.

None of this has been challenged by anyone but Claude and the human so far.
Codex has not started implementation — no code changes exist yet, only the
plan doc.

## Question 1 — Is Claymorphism the right call for the storefront?

Claymorphism was chosen mainly because "toy-like, chunky" felt thematically
right for physical 3D-printed objects, for a maker/hobbyist (not premium)
audience. But the skill's own data flags it as higher accessibility risk and
higher implementation/maintenance cost, and it's not a style commonly seen
on established e-commerce sites.

Challenge this specifically:
- Does the accessibility risk (contrast, focus states, reduced-motion) and
  implementation cost (multi-layer shadows, thick borders, custom CSS not
  well covered by shadcn's default primitives) outweigh the branding
  benefit here, for a solo/small shop that can't afford a slow storefront
  or expensive rework?
- Is there a lower-risk style (e.g. a toned-down "friendly modern
  e-commerce" look, warm neutral + rounded cards without full clay shadows)
  that still reads as "maker/hobbyist, showcases a physical product" without
  the accessibility/cost tradeoffs? Name a specific concrete alternative,
  not just "consider something simpler."
- Conversion/UX angle: for an e-commerce flow (browse → product detail →
  add to cart), does a heavy decorative style like Claymorphism help or hurt
  scannability and perceived trustworthiness at checkout-adjacent screens?

## Question 2 — Sequencing: should the admin UI retrofit happen inside Phase 4 at all?

The human chose "redo the entire admin UI" (not just swap color tokens) as
part of Phase 4, on top of building the entirely-new storefront in the same
phase. Phase 3's admin UI is done, tested, and currently shipped with
shadcn's default neutral theme — it works, just isn't visually distinctive.

Challenge this:
- Is bundling a full visual redesign of a working, tested admin UI into the
  same phase as building a brand-new storefront from scratch a scope risk
  (regression risk against Phase 3's existing tests/E2E flows, review
  fatigue, delayed Phase 4 ship date)?
- Would it be safer/faster to do a **token-only** admin update now (new
  colors/fonts via CSS variables, no layout/component changes) and defer a
  full admin visual redesign to a later phase (e.g. Phase 8
  operations/optimization), versus doing the full redesign now while the
  brand direction is fresh?
- If you'd keep the full redesign in Phase 4 anyway, what's the minimum
  regression-safety net needed (e.g. re-run Phase 3's existing
  `tests/phase-3-*.test.ts` and `e2e/admin.spec.ts` after retrofit, visual
  diff review) before calling it done?

## Question 3 — Color palette fit and unresolved dark-mode values

The palette (teal `#0F766E` primary, terracotta `#D97706` accent) was picked
manually as a "shared base" without running the skill's typography/dark-mode
generation yet.

- Sanity-check this pair for a 3D-printing maker/hobbyist storefront in
  particular (not e-commerce in general) — any concerns (e.g. contrast
  against printed-material photography, warmth mismatch with `PLA`/plastic
  product photos, differentiation from more common green/orange "eco" or
  blue/orange "trust" e-commerce palettes)?
- For the dark-mode variants (not yet generated): any known pitfalls when
  deriving a dark palette from a teal/terracotta light pair (e.g. terracotta
  losing contrast on dark backgrounds, teal becoming muddy) that the human
  should watch for once `design-system/MASTER.md` is generated?

End with one clear final recommendation per question. If you'd make the same
call as the tentative decision, say so explicitly and why — "I'd choose the
same thing" is a valid, useful answer here, not a non-answer.
