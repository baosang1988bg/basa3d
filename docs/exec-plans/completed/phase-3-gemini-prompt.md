# Prompt gửi Gemini — Phase 3 kickoff (RBAC + auth mechanism)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-3.md`
in full (it has the complete context: goal, non-goals, already-resolved
decisions #1–#3, and open questions #4–#5 below). Do not write code. Follow
the "Required output for architectural alternatives" format from `GEMINI.md`
for each of the two questions below, then give a final concrete
recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D is a small 3D-printing business platform (one owner, a couple of
staff at most). Stack: Next.js App Router + TypeScript, PostgreSQL/Supabase,
Zod at the boundary, Tailwind + shadcn/ui (not yet installed). Phase 1/2 are
done: full DB schema + a service/API layer that talks to Postgres directly
through a `pg.Pool` (`src/lib/db.ts`) using `DATABASE_URL` — **not** through
Supabase's PostgREST/anon-key/RLS layer. Authorization today is a
placeholder: `src/lib/auth/require-admin.ts` is a no-op in dev and throws in
production (fail-safe only, not real auth). `actorId` for audit logs is
currently a hardcoded `DEV_ACTOR_ID` constant.

`.env` already has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (provisioned in Phase 1, unused so far). No
`@supabase/supabase-js` / `@supabase/ssr` / any auth library is installed
yet. No public customer sign-up anywhere in this app — only two internal
roles will ever log into `/admin`: `OWNER` and `STAFF`.

Phase 3's job: replace the placeholder guard with real login + role
enforcement, then build the admin UI (dashboard, products, inventory,
orders, custom requests/quotes/print jobs) on top of it — full detail in
`docs/exec-plans/active/phase-3.md`.

## Question 4 — RBAC granularity: OWNER vs STAFF

The original research doc (`3d-printing-website-development-plan.md`, PHASE
3 §3.6) only says STAFF gets "products, inventory, orders, custom requests"
and OWNER gets "all access" — it never spells out what OWNER-only actually
means beyond that.

Claude's tentative proposal (not yet decided): STAFF gets identical
permissions to OWNER across every Phase 3 business action (products,
inventory, orders, custom requests, quotes, print jobs); the **only**
OWNER-only action is managing staff accounts (create/deactivate a STAFF
login). No other permission split, since Phase 3 has no "settings" screen
and AGENTS.md/the big-plan both say not to build a 20-role RBAC system for
a 2-person shop.

Challenge this. In particular:
- Is "STAFF = OWNER minus staff management" too permissive for anything in
  scope (e.g., should STAFF be able to see revenue/margin numbers on the
  dashboard, delete a product outright vs. only archive it, issue a
  discount/change an order total, adjust inventory without limit, view
  other staff's activity in `audit_logs`)?
- What failure modes/abuse scenarios would this permission model expose as
  the shop grows past "one owner + one trusted staff"?
- Give a concrete recommendation: either confirm the simple model above, or
  propose a specific (still small, MVP-appropriate) alternative permission
  boundary — name the exact actions that should differ, not a generic
  "consider adding more granularity" answer.

## Question 5 — Auth mechanism

Claude's tentative proposal (not yet decided): Supabase Auth (email +
password), using `@supabase/ssr` for session handling in Next.js App
Router middleware/route handlers, backed by a new `staff_profiles` table
(keyed by `auth.users.id`) queried through the existing `pg.Pool` — i.e.
Supabase Auth is used *only* for login/session/JWT verification, all
business data access stays on the existing raw-`pg` pattern (no PostgREST,
no RLS as the enforcement boundary). No self-service password reset needed
for MVP (use the Supabase dashboard to reset a STAFF password when needed).

Challenge this against alternatives given this exact setup (2 internal
roles, no public users, already-provisioned Supabase project, Next.js App
Router, direct-`pg` data access pattern) — e.g. NextAuth/Auth.js (with or
without a Supabase adapter), a hand-rolled session/JWT cookie scheme, or
anything else you'd consider current best practice for this shape of app in
2026. For each alternative actually worth naming, give the
current-approach/alternative/pros/cons/complexity/cost/recommendation
breakdown from `GEMINI.md`, covering at minimum:
- migration cost if we need to switch away from whatever we pick later
  (e.g., if the app later needs customer-facing accounts too, not just
  admin — Phase 5+ concern, don't over-build for it now, but flag if the
  choice would make that meaningfully harder);
- how session verification actually happens in a Next.js Route Handler
  given we're bypassing Supabase's own PostgREST/RLS request path;
- known footguns specific to whichever library/pattern you end up
  recommending (e.g., stale JWT/cookie edge cases, middleware refresh
  patterns, CSRF considerations for a cookie-based session).

End with one clear final recommendation per question. If you'd make the
same call as Claude's tentative proposal, say so explicitly and why —
"I'd choose the same thing" is a valid, useful answer here, not a
non-answer.
