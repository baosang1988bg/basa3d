# Prompt gửi Gemini — Phase 18 kickoff (storefront i18n VI/EN: middleware merge, scope-cut UX, và lựa chọn next-intl)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-18.md` in full (it has
the complete context: goal, non-goals, and the "Quyết định kỹ thuật" section — all currently
tentative, none implemented yet), plus `middleware.ts` and `src/lib/supabase/middleware.ts` at the
repo root (the existing admin-auth middleware that Phase 18 has to coexist with). Do not write
code. Follow the "Required output for architectural alternatives" format from `GEMINI.md` (Current
approach / Alternative / Pros-cons / Complexity impact / Cost impact / Recommendation / What
docs/code would need to change) for each question below, then give a final concrete
recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D is a small 3D-printing business platform (Next.js App Router, Supabase/Postgres). Phase 18
adds VI/EN internationalization to the **public storefront only** (`src/app/(storefront)/**`) —
Vietnamese stays the unprefixed default, English lives under `/en/...`. Admin (`/admin/**`) and all
`/api/**` routes are explicitly out of scope and must keep their current behavior unchanged. The
plan is to move storefront routes under a new `src/app/[locale]/(storefront)/**` segment and use
`next-intl` for locale routing, message catalogs, and a language switcher. Content translation
itself is scoped to a first slice only (nav/footer/home/products list/product detail); the rest of
the storefront (cart, checkout, custom-print, blog, 4 policy pages) is deferred to a later phase
but will still be reachable under `/en/...` with untranslated (Vietnamese) content in the
meantime.

None of Phase 18's design has been challenged by anyone but Claude so far. No code has been
written yet — this is still a draft spec, so anything here is cheap to change.

## Question 1 — Merging next-intl middleware into the existing admin-auth middleware
The repo already has a root `middleware.ts` with `matcher: ['/admin/:path*']` that calls
`updateSession()` (`src/lib/supabase/middleware.ts`) to refresh the Supabase session cookie and
redirect unauthenticated visitors away from `/admin/*`. Next.js only runs a single middleware file
per project, so Phase 18 cannot add a separate `src/middleware.ts` for next-intl's
`createMiddleware()` as originally drafted — it has to be merged into the same file. The tentative
approach: widen the `matcher` to cover the whole site, and inside one `middleware()` function
branch by `pathname` — `/admin/*` runs `updateSession()` as before, everything else runs the
next-intl middleware, `/api/*` runs neither.

Challenge this:
- Is branching inside a single `middleware()` function the right shape, or is there a cleaner
  composition pattern (e.g. next-intl's middleware wrapping/calling into the Supabase one, or vice
  versa) that's less likely to silently break the admin auth redirect if someone edits the
  next-intl side later?
- `AGENTS.md` rule 5 says "Authorization is enforced server-side; UI hiding is not security" and
  the existing code comment notes middleware is "not the security boundary" (every admin API route
  already calls `requireAdmin()`/`requireOwner()` itself). Given that, does merging the matcher
  actually introduce any real authorization risk, or is the risk purely "regression in UX redirect
  behavior" — and if it's UX-only, what's the minimal test to pin that down?
- Is there a next-intl API/pattern for this exact "coexist with another middleware" case that we
  should use instead of hand-rolling the pathname branch?

## Question 2 — Leaving unscoped storefront pages reachable but untranslated under /en
Phase 18's content-translation slice is nav/footer/home/products list/product detail only. The
Non-goals section explicitly says cart, checkout, custom-print, blog, order-confirmation, the
quote page, and the 4 policy pages will still render under `/en/...` via the new `[locale]`
routing, but their content stays Vietnamese-only for now — accepted as a known limitation rather
than blocked.

Challenge this:
- Is silently mixing an English chrome (nav/footer, switcher showing "EN") with Vietnamese page
  content an acceptable v1 UX trade-off, or does it read as broken/untrustworthy to an
  English-reading visitor in a way that hurts conversion on exactly the checkout/custom-print pages
  where trust matters most?
- Concrete alternative: should `/en/checkout`, `/en/cart`, `/en/custom-print`, `/en/blog/*`, and the
  4 policy pages redirect (or fall back) to their VI equivalents until they're actually translated,
  rather than rendering half-translated? What's the simplest way to do that with next-intl's routing
  without contradicting the "VI/EN both reachable" goal for the pages that *are* translated?
- Does deferring blog and the 4 static policy pages specifically make sense, or are those actually
  the cheapest content to translate first (pure static text, no dynamic DB data) and should they be
  pulled into this phase's slice instead of cart/checkout complexity?

## Question 3 — next-intl vs a narrower hand-rolled approach, now that middleware has to be merged anyway
The original decision was next-intl over hand-rolling i18n routing, reasoning that next-intl's
middleware, `[locale]` segment conventions, and `useTranslations`/`getTranslations` hooks avoid
reimplementing locale-aware routing edge cases. That reasoning assumed a clean, separate
middleware. Now that the middleware has to be merged with the existing Supabase auth middleware
(Question 1), part of next-intl's routing convenience is already compromised by custom branching
logic.

Challenge this:
- Does the middleware-merge complexity change the cost/benefit of next-intl, or is next-intl still
  clearly worth it even with a hand-branched middleware (i.e., the value is mostly in
  `useTranslations`/message catalogs/`[locale]` static params, not just the middleware)?
- Is there a simpler alternative for this specific project's small scope (2 locales, storefront
  only, no plural/ICU-heavy content) — e.g., a minimal custom solution using Next.js's own
  `generateStaticParams` on a `[locale]` segment plus a plain JSON message lookup, skipping
  next-intl's middleware entirely and doing locale detection via a simple cookie/redirect check
  inside the merged `middleware()` — that would reduce the new dependency's footprint given
  AGENTS.md rule 8 ("do not add dependencies without a concrete reason")?

End with one clear final recommendation per question. If you'd make the same call as the tentative
decision, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer here,
not a non-answer.
