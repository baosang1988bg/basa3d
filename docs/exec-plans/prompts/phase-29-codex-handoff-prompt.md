Context: You are the verification owner for Phase 29 of BaSa3D (copyright/IP
compliance controls). Unlike a normal Codex handoff, the implementation is
already done (by Claude, this session) — your job is to run what could not be
run in that environment (no `DATABASE_URL`, no browser) and fix anything that
turns out broken, not to design or implement from scratch.

Read first, in this order:
1. AGENTS.md — canonical engineering rules.
2. docs/exec-plans/active/phase-29-copyright-compliance.md — full brief, the
   locked decisions ("Quyết định đã chốt (sau Gemini challenge)"), and the
   "Nhật ký cập nhật" entries dated 2026-09-08, which describe exactly what
   was implemented, what was already verified (typecheck/lint/unit tests/
   production build all green), and what was NOT run (DB integration tests,
   Playwright E2E) because this environment has no `DATABASE_URL`/browser.
3. tests/helpers/test-environment.ts — the safety guard that refuses to run
   against the real app database or a remote Supabase project. Your
   `DATABASE_URL` must point at a disposable local/test Postgres only.
4. supabase/migrations/20260908000000_copyright_compliance.sql — the new
   migration this phase adds (6 columns across `custom_requests`/`products`,
   no new tables).

Task: verify Phase 29 — copyright/IP compliance controls — end-to-end on a
real database and browser, and fix anything broken. Do NOT redesign scope,
add new fields, or touch the state machine in `custom-request.service.ts`
(`CUSTOM_REQUEST_STATUS_TRANSITIONS`) — that was an explicit non-goal, kept
even after Gemini's challenge (see decision #3 in phase-29.md).

Scope:
- Apply the migration to a disposable test database (`supabase db reset` or
  equivalent against a local/test instance only — never the app database).
- Run `DATABASE_URL=<disposable test db> npm run test` and get every test in
  `tests/phase-29-copyright-compliance.test.ts` green, plus confirm no
  regression in `tests/phase-4-public-custom-request.test.ts`,
  `tests/domain-schemas.test.ts`, `tests/migration-contract.test.ts`, and
  `tests/phase-3-route-auth.test.ts` (RBAC baseline).
- Run the Playwright suite (`npx playwright test`) against a local/test
  Supabase instance, specifically:
  - `e2e/storefront.spec.ts` — the `/custom-print` form now requires the
    `#copyrightConfirmed` checkbox (submit button stays disabled until it is
    checked); confirm the full flow still reaches "Đã gửi yêu cầu thành
    công!".
  - `e2e/{car-nameplate,dual-text,hinge-box,jigsaw,keychain-blocks,keychain,
    lamp-shade,organizer}.spec.ts` — each was patched to add
    `page.locator('#copyrightConfirmed').check()` before the existing submit
    click; confirm all still pass.
  - Manually add (or ask a follow-up) one new E2E case if none exists yet:
    admin creates a custom request with a description containing an
    IP-risk keyword (e.g. "Pokemon", "BMW" — see
    `src/lib/copyright/ip-risk-keywords.ts`), confirms the "⚠️ Rủi ro SHTT"
    badge appears on both the list and detail page, confirms the quote form
    shows the `ipRiskAcknowledged` checkbox and createQuoteAction fails with
    `IP_RISK_ACKNOWLEDGEMENT_REQUIRED` when submitted unchecked, and succeeds
    once checked.
- If any test fails because of an actual bug in the Phase 29 code (not an
  environment/setup issue), fix it with the smallest change that makes the
  test pass, matching the existing code's style (see
  `src/lib/copyright/ip-risk-keywords.ts` and `quote.service.ts`'s soft-gate
  block for the pattern already in place). Do not silently loosen an
  assertion to make it pass.
- If a Playwright spec fails for a reason unrelated to Phase 29 (pre-existing
  flake, unrelated Phase 28 work also uncommitted in this working tree), do
  not fix it — report it separately as out of scope.

Before reporting done:
- `npm run typecheck` and `npm run lint` both clean (already green as of the
  last commit in this working tree — confirm they still are after any fix).
- `npm run test` fully green with `DATABASE_URL` set (not skipped).
- `npx playwright test` green for the 9 specs listed above.
- `npm run build` (production) still succeeds.
- No change to `CUSTOM_REQUEST_STATUS_TRANSITIONS` or to the advisory-only
  nature of `ip_risk_flag` (it must stay a soft gate on quote creation only,
  never a hard block anywhere else).

Known accepted limitation — do not try to fix, just confirm it's still true
and leave it alone: `detectIpRiskKeywords` (ip-risk-keywords.ts) is a level-1
keyword filter (documented in its own file header and in phase-29.md Scope C)
— abbreviations/misspellings can slip through by design; staff review is the
real backstop. Expanding the keyword list or adding fuzzy matching is out of
scope for this handoff.

Commit style: small commits, Conventional Commits (see AGENTS.md examples),
one logical group per commit, e.g.:
- `test: run phase-29 copyright-compliance suite against a real test database`
- `fix(quote): <describe the actual bug found, if any>`
- `test(e2e): confirm ip_risk_flag badge + quote soft-gate end-to-end`

Do not move phase-29-copyright-compliance.md to
docs/exec-plans/completed/ — it is an explicitly standing/non-closing phase
(see its own header), not a phase that gets archived when its checklist is
done. Only add a dated entry to its "Nhật ký cập nhật" section summarizing
what you verified/fixed.

Report back in exactly this format (per AGENTS.md):
1. Files changed
2. Behavior
3. Tests/checks run
4. Known risks
5. Follow-up work, if any
