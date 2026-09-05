Context: You are the implementation owner for Phase 20 of BaSa3D (see AI_WORKFLOW.md — Codex
implements, Claude/Gemini review). Phase 19 is closed — see
`docs/exec-plans/completed/phase-19.md` (roadmap + locked architecture: shared `(tools)` route
group, lazy-loaded 3D canvas, `src/lib/3d-tools/<slug>/<slug>-engine.ts` file convention). Phase 17
is closed — see `docs/exec-plans/completed/phase-17.md` and its code:
`src/lib/keychain/keychain-engine.ts` (the extrude/merge/STL-export pattern to mirror),
`src/lib/pricing/mesh-estimator.ts` (reuse as-is, no changes), and
`src/app/api/public/keychain-price-estimate/route.ts` (being renamed/generalized by this phase).

Read first, in this order:
1. AGENTS.md — canonical engineering rules.
2. docs/exec-plans/active/phase-20.md — this phase's brief, all decisions already locked in
   ("Quyết định kỹ thuật (Đã chốt qua Gemini Challenge)" — mục 3.1-3.5), the Slice plan (mục 4), and
   Definition of Done (mục 6). Every numeric constant and naming decision below comes from that
   section — do not re-derive or re-negotiate them.
3. docs/exec-plans/completed/phase-19.md, mục 4.1 — the exact file/route conventions this phase
   must follow for every future tool phase (20-27) to build on cleanly.
4. Existing code to extend/mirror, not duplicate:
   - `src/lib/keychain/keychain-engine.ts` — pattern for building `THREE.BufferGeometry` via
     `THREE.Shape`/`ExtrudeGeometry`, merging with `mergeGeometries` (from
     `three/addons/utils/BufferGeometryUtils.js`), and exporting STL via
     `three/addons/exporters/STLExporter.js`.
   - `src/lib/pricing/mesh-estimator.ts` — reuse directly for weight/print-minute estimation, no
     changes needed.
   - `src/app/api/public/keychain-price-estimate/route.ts` and
     `src/lib/pricing/keychain-price-range.ts` (the `calculateKeychainPriceRange` function it
     calls) — both are being renamed/generalized (see Scope below).
   - `src/components/storefront/keychain-generator.tsx` — the only client caller of the price
     route; must be updated to the new endpoint.
   - `src/app/[locale]/(storefront)/custom-print/custom-request-form.tsx` — the form to prefill,
     same integration pattern as Phase 17.
   - `src/lib/analytics.ts` — existing `trackKeychainPreview` / `trackKeychainExportDownload` /
     `trackKeychainExportToRequest` functions (using `sendGAEvent`) are the pattern to mirror for
     the new Organizer events.
   - `src/app/[locale]/(storefront)/tools/keychain-generator/page.tsx` and
     `src/app/[locale]/(storefront)/tools/page.tsx` — existing tools index/page pattern (for
     reference only; Organizer's route group is `(tools)`, a new sibling to `(storefront)`, per
     Phase 19's locked decision — do not put Organizer under `(storefront)/tools/`).
   - `tests/phase-17-keychain-price-estimate.test.ts` and
     `tests/phase-17-keychain-request-integration.test.ts` — both reference the route/function
     being renamed and must be updated, not left broken.

Task: implement Phase 20 — Flex Organizer (tray/compartment divider generator) — ONLY. Do not
touch the other 7 tools from the Phase 19 roadmap (Keychain block-style, Dual Text, Car, Lamp,
Hinge Box, Jigsaw, Sculpt), do not build out freeform/arbitrary-shaped compartments (only the two
grid modes below), and do not over-build the shared `(tools)` layout beyond what Organizer needs —
later phases will extend it.

Scope:
- New shared layout `src/app/[locale]/(tools)/layout.tsx`: full-viewport 3D canvas area, minimal
  topbar with a "Về cửa hàng" link and a "Gửi báo giá" action — this is the FIRST tool under this
  route group, so verify it composes correctly with the existing `[locale]` routing/middleware
  (no changes to `middleware.ts` or `src/lib/supabase/middleware.ts` should be needed — confirm
  this rather than assuming it).
- `src/lib/3d-tools/organizer/organizer-constants.ts` with exactly these named constants (values
  from phase-20.md mục 3.3): `MAX_TRAY_WIDTH_MM = 250`, `MAX_TRAY_DEPTH_MM = 250`,
  `MAX_TRAY_HEIGHT_MM = 120`, `MIN_TRAY_DIMENSION_MM = 30`, `MAX_GRID_ROWS = 12`,
  `MAX_GRID_COLS = 12`, `MIN_WALL_THICKNESS_MM = 1.0`, `MAX_WALL_THICKNESS_MM = 4.0` (default
  1.6), `MIN_BOTTOM_THICKNESS_MM = 1.2`, `MAX_BOTTOM_THICKNESS_MM = 5.0` (default 2.0), and
  `WALL_OVERLAP_EPSILON_MM = 0.2`.
- `src/lib/3d-tools/organizer/organizer-engine.ts`: build the tray floor (`BoxGeometry`) and grid
  dividers (`BoxGeometry` per wall), each wall sunk `WALL_OVERLAP_EPSILON_MM` into the floor and
  into the outer wall before calling `mergeGeometries` into one solid — no CSG boolean library (per
  mục 3.2's locked decision). Support exactly two input modes:
  - Equal grid: `rows` × `cols`, dividing the tray's interior evenly minus wall thickness.
  - Custom sizes: explicit column-width and row-height lists (mm); allow a total mismatch of up to
    `±0.5mm` against the interior dimension, and auto-fit the **last** cell to absorb the
    remaining dimension (`lastCell = remainingDimension`) instead of hard-rejecting small rounding
    errors. Also implement the "Auto-fit" helper the UI button calls (distributes remaining space
    evenly, or into the last cell — match whichever phase-20.md's UI description implies: a button
    that fills in the remaining space automatically).
  - Enforce all `organizer-constants.ts` limits (reject/clamp inputs exceeding them) inside the
    engine, not just in the UI.
- `src/app/[locale]/(tools)/tools/organizer/page.tsx` +
  `src/app/[locale]/(tools)/tools/organizer/organizer-workbench.tsx`: client workbench with tray
  dimension inputs, grid-mode toggle, wall/bottom thickness inputs, 3D preview canvas
  (`next/dynamic(..., { ssr: false })`, orbit/zoom), and STL export (`THREE.STLExporter`, single
  merged mesh, mirroring the keychain-engine export pattern).
- Rename/generalize the price-estimate route per mục 3.4: create
  `src/app/api/public/tool-price-estimate/route.ts` with the exact same request/response contract,
  rate-limiting (`createDatabaseRateLimiter`, same `maxRequests`/`windowMs`), and
  never-leak-real-pricing-config behavior as the current `keychain-price-estimate/route.ts` — copy
  its logic, do not weaken the rate limit or change what fields the response exposes. Since mục 3.4
  says this route is meant to be shared "vĩnh viễn cho tất cả 3D tools", also rename the underlying
  pure function it calls, `calculateKeychainPriceRange` in `src/lib/pricing/keychain-price-range.ts`,
  to a tool-agnostic name (e.g. `calculateToolPriceRange` in a same-shaped renamed file) so the new
  route doesn't call a keychain-named function — delete the old route file and old function/file
  once all 3 known references (`keychain-generator.tsx`,
  `tests/phase-17-keychain-price-estimate.test.ts`,
  `tests/phase-17-keychain-request-integration.test.ts`) are updated to the new path/name. Grep the
  repo before deleting to confirm no other caller was missed.
- Update `src/components/storefront/keychain-generator.tsx` to call the new
  `/api/public/tool-price-estimate` endpoint.
- Wire Organizer's workbench to the same endpoint for its own price estimate, reusing
  `mesh-estimator.ts` unchanged.
- Custom Request integration: "Tải STL" button (direct download) and "Gửi yêu cầu báo giá" button
  that uploads via `POST /api/public/custom-requests/attachments`, then prefills
  `custom-request-form.tsx` with `description: "Khay chia ngăn: {rows}x{cols}, {W}x{D}x{H}mm"` —
  mirror Phase 17's integration exactly, no changes to the custom-request service/schema layer.
- GA4 tracking in `src/lib/analytics.ts`: add `trackOrganizerPreview`, `trackOrganizerExportDownload`,
  `trackOrganizerExportToRequest`, firing `tool_organizer_preview`, `tool_organizer_export_download`,
  `tool_organizer_export_to_request` — same shape as the existing `trackKeychain*` functions.

Before reporting done:
- Unit tests for `organizer-engine.ts`: both grid modes, boundary cases (1×1 grid, custom sizes at
  exactly the `±0.5mm` tolerance edge and just past it, auto-fit filling the last cell correctly),
  and that every `organizer-constants.ts` limit is actually enforced (reject a tray/grid that
  exceeds each constant).
- Unit test for the new `tool-price-estimate` route (same test scenarios
  `phase-17-keychain-price-estimate.test.ts` already covers: valid input returns a price range,
  invalid input rejected, rate limit triggers after the configured max, real pricing config never
  appears in the response body) — update or replace that test file so it targets the new route/
  function names; also fix `tests/phase-17-keychain-request-integration.test.ts` if it references
  the old route path.
- Playwright E2E (see `.agents/skills/e2e-testing/SKILL.md`): enter tray dimensions + grid config →
  preview renders → send-quote-request flow completes → request appears in Admin, mirroring
  Phase 17's existing E2E flow for keychain-generator.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass, with zero regressions
  in the existing Phase 0-19 test suite — pay particular attention to any other test that imports
  `keychain-price-range.ts` or hits `/api/public/keychain-price-estimate` that a repo-wide grep
  might have missed.
- Run `.agents/skills/security-review/SKILL.md`'s checklist against the new
  `tool-price-estimate` route specifically: confirm it still rate-limits by IP the same way the old
  route did, and still never sends `PricingConfigInput`/real margin data to the client — this is a
  rename of a route that Phase 17 deliberately designed to avoid exposing internal cost data to a
  public page; don't let that guarantee silently regress during the rename.

Commit style: small commits, Conventional Commits (see AGENTS.md examples), one logical group per
commit, e.g.:
- `feat(tools): add shared (tools) route group and layout`
- `feat(tools): add Flex Organizer 3D engine and workbench`
- `refactor(pricing): generalize keychain-price-estimate into tool-price-estimate`
- `feat(tools): wire Organizer into custom request flow and GA4 tracking`
- `test(tools): add Organizer engine, route, and E2E coverage`

Do not move phase-20.md to docs/exec-plans/completed/ yourself — that happens after human/Claude
review.

Report back in exactly this format (per AGENTS.md):
1. Files changed
2. Behavior
3. Tests/checks run
4. Known risks
5. Follow-up work, if any
