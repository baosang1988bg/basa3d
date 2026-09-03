# BaSa3D Web

BaSa3D is a 3D-printing commerce and custom-order platform.

## Start here
1. Read `AGENTS.md`.
2. Read `docs/roadmap.md`.
3. Start at Phase 0.
4. Do not skip database/domain decisions.
5. See "Running the project" below once you're past Phase 1 (Supabase project exists).

## Running the project

**Requires Node.js >= 22.** `@supabase/supabase-js` needs the native `WebSocket`
constructor (stable from Node 22) just to construct a client — on Node 18/20 every
admin page/action crashes immediately. If your default Node is older:
```bash
nvm install 22 && nvm use 22
```

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (use the Supabase
   **Session Pooler** connection string — `aws-0-<region>.pooler.supabase.com:5432`,
   username `postgres.<project-ref>` — the direct `db.<ref>.supabase.co` host is
   IPv6-only and often unreachable), `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (from the Supabase
   dashboard). If the password contains `%`, percent-encode it as `%25` in the URL.
2. `npm install`
3. Apply migrations in order (`supabase/migrations/*.sql`, oldest timestamp first) —
   there's no migration runner script yet; run each file's SQL against `DATABASE_URL`
   (e.g. via `psql "$DATABASE_URL" -f supabase/migrations/<file>.sql`, or the Supabase
   SQL Editor). Then `supabase/seed.sql` for sample catalog data (optional, dev only).
4. Create the first `OWNER` admin account — there's no self-service sign-up.
   Use the Supabase dashboard (Authentication → Users → Add user, email confirmed)
   to create the login, then insert a matching row:
   ```sql
   insert into staff_profiles (id, full_name, role, is_active)
   values ('<the new user id>', 'Your Name', 'OWNER', true);
   ```
5. `npm run dev`, then open `http://localhost:3000/admin/login`.

### Checks
- `npm run typecheck` / `npm run lint` / `npm run build`
- `npm test` — unit + integration tests (`tests/*.test.ts`); the DB-touching ones
  skip automatically if `DATABASE_URL` isn't set, and one spins up a real
  `next start` on port 3411 to verify every admin route enforces its minimum
  role (`STAFF` vs `OWNER`, per `docs/architecture/decisions.md` ADR-0011/
  ADR-0026/ADR-0027) — not just "rejects unauthenticated requests." That
  route×role matrix (`tests/phase-3-route-auth.test.ts`) mints 2 real
  throwaway Supabase accounts (`tests/helpers/rbac-accounts.ts`, needs
  `SUPABASE_SERVICE_ROLE_KEY`; skips gracefully without it, falling back to
  the unauthenticated-only checks) and adds ~3s to mint/tear down (measured),
  negligible against the ~2-3 minute `next build` + `next start` + full test
  run — folded into `npm test` rather than a separate script (Phase 14
  measured this; see that phase's closing commit).
- `npx playwright test` — E2E (`e2e/*.spec.ts`); needs `SUPABASE_SERVICE_ROLE_KEY`
  to create/delete a throwaway test admin account. First run: `npx playwright
  install chromium`.

## AI workflow
- Codex: implementation
- Claude: architecture/review
- Gemini: alternatives/research/UX

One task should have one implementation owner. Other models review or challenge; they should not all edit the same feature independently.
