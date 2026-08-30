# BaSa3D Engineering Instructions

## Mission
BaSa3D is a small 3D-printing business platform: product catalog, e-commerce, custom print requests, quoting, production tracking, and inventory.

## Owner profile
The owner is a mobile developer transitioning into web/full-stack development. Prefer boring, explicit, maintainable solutions over framework cleverness.

## Source of truth
Before implementing a feature, read the smallest relevant set of:
- `docs/product/vision.md`
- `docs/product/requirements.md`
- `docs/architecture/architecture.md`
- `docs/database/schema.md`
- `docs/database/business-rules.md`
- `docs/roadmap.md`

The `docs/` tree above is intentionally lean. `3d-printing-website-development-plan.md`
at the repo root is the original, much more detailed research doc (full SQL schema,
ERD, sitemap, wireframes, security checklist, testing strategy, cost scenarios,
KPIs). Read the relevant section there when a `docs/` summary isn't enough —
don't re-derive decisions that are already made there.

If a business rule is unclear, do not silently invent one. Record the assumption in `docs/architecture/decisions.md` or the relevant domain doc.

## Review/quality-gate skills
`.agents/skills/{database-review,security-review,e2e-testing,release-check}/SKILL.md`
hold the canonical checklists for those four review types, shared across
Codex/Gemini/Claude. `.claude/skills/` has a thin mirror of each one (proper
SKILL.md frontmatter) so Claude Code / Cowork auto-triggers them — those mirrors
just point back to the canonical file, so edit the checklist in `.agents/skills/`
only, not in both places.

## Closing a phase
`.agents/skills/close-phase/SKILL.md` (mirrored at `.claude/skills/close-phase/`)
is the canonical procedure for Step 8 of `PHASE_START_PROTOCOL.md`: verify the
phase's checklist is fully `[x]`, move `docs/exec-plans/active/phase-X.md` to
`completed/`, then commit with a Conventional Commit message summarizing the
phase. Use it every time a phase closes instead of ad hoc commits.

## Stack
- Next.js + TypeScript
- PostgreSQL / Supabase
- Tailwind CSS + shadcn/ui
- Zod for boundary validation
- Playwright for critical E2E flows

## Engineering rules
1. Database is the source of truth.
2. Money is stored as integer minor units (VND = 1 unit), never floating point.
3. Inventory changes are recorded as immutable movements; do not silently overwrite stock.
4. Orders snapshot customer-facing product/variant data at purchase time.
5. Authorization is enforced server-side; UI hiding is not security.
6. Validate external input at the boundary.
7. Every business-critical rule gets automated tests.
8. Do not add dependencies without a concrete reason.
9. Do not rewrite unrelated files.
10. Prefer small vertical slices that can be tested end-to-end.

## Before coding
- Read relevant docs.
- State the exact task and files likely to change.
- Check for an existing implementation before adding a new abstraction.

## After coding
Run the narrowest useful checks, then the full project check when appropriate:
- lint
- typecheck
- unit/integration tests
- E2E for affected critical flows
- production build

Report:
1. files changed
2. behavior changed
3. tests/checks run
4. known risks
5. follow-up work, if any

## Git
Prefer small commits using Conventional Commits, e.g.:
- `chore: initialize project`
- `feat: add product catalog schema`
- `feat: add inventory movements`
- `fix: prevent inventory oversell`
- `test: cover checkout totals`

## Do not
- bypass migrations with manual DB changes in production;
- store secrets in git;
- couple UI directly to Supabase tables when a domain/service boundary is needed;
- add premature microservices;
- implement payment until order/inventory behavior is tested;
- optimize before measuring.
