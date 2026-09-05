# Phase 20 verification

## Security review — shared public pricing route

Applied `.agents/skills/security-review/SKILL.md`.

- Authentication/authorization: intentionally public advisory endpoint. Pricing configuration and material costs are read server-side through existing services. No admin permissions or RLS policies changed.
- Input validation: strict Zod object, finite positive weight ≤ 2,000g and print duration ≤ 10,080 minutes; additional properties rejected.
- Abuse prevention: unchanged Postgres-backed limiter, 60 requests per hour per IP, now under `tool-price-estimate`. IP selection still prefers `cf-connecting-ip`, then the first `x-forwarded-for`, then `unknown`. This retains the existing deployment requirement that ingress supplies trustworthy IP headers. Renaming the limiter scope starts a new allowance at deployment.
- Data exposure: successful response contains only `minPriceVnd` and `maxPriceVnd`. Configuration, material unit costs, and margins stay on the server. Existing error mapping and logging are unchanged.
- Upload validation: Organizer uses the existing attachment endpoint and custom-request form. No new upload, storage, or service/schema path; the existing 10/hour upload limiter and service validation apply.
- SSRF/open redirects: no caller-supplied URLs and no new redirect handling. Admin protection is unchanged.
- Secrets: no new environment variables or credentials. No pricing configuration is imported into the workbench.

## Geometry and lifecycle notes

Auto-fit keeps earlier cell dimensions and adjusts the last cell. Invalid designs disable export; request preparation disables editing so attachment and description describe the same design. Request forms remount for each new attachment. Price requests are debounced and cancelled when designs change. Canvas observers, controls, materials, renderers, animation frames, and replaced geometry are disposed.

The prescribed merge retains overlapping box shells. The unchanged volume estimator includes overlapping volume. Inspect the exported STL in the target slicer and print 1–2 samples to verify wall/floor bonding before closing the phase.

## Routing

The new route inherits `[locale]/layout.tsx`. Public URLs still pass through next-intl middleware; only `/admin` uses the Supabase middleware. No middleware edits. Both translated tools indexes link to Organizer. The canvas module is loaded dynamically with SSR disabled.

## Executed checks (2026-09-05)

- `npm test`: 181 passed, 0 failed, 0 skipped, including database integration and the actual 61st-request rate-limit check.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; both locale Organizer pages generated. Existing Next ESLint-plugin warning remains.
- `npx playwright test e2e/organizer.spec.ts`: 1 passed, covering changed dimensions/grid, rendered WebGL canvas, generated STL upload, form prefill, submission, and authenticated Admin visibility.
- Focused engine and route unit checks passed, including custom grids, tolerance boundaries, limits, overlap, binary STL, strict response allowlist, and mocked IP rate limiting.
- Repository search found no old pricing endpoint/function references in `src`, `tests`, or `e2e`. Historical phase documents retain their original names.

The first sandbox build could not resolve the Supabase host; rerunning with approved network access succeeded. No phase closure performed. Human/Claude review and owner physical-print validation remain pending.
