Context: You are the implementation owner for Phase 17 of BaSa3D (see AI_WORKFLOW.md — Codex
implements, Claude/Gemini review). Phase 16 is closed — see docs/exec-plans/completed/phase-16.md
and src/services/quote.service.ts. Phase 17's design has been through a full Gemini architecture
challenge plus a Claude security review that found and fixed one real issue (public pricing-config
leak) before this handoff — the current phase-17.md already reflects the fix.

Read first, in this order:
1. AGENTS.md — canonical engineering rules (Rule #1 DB source of truth, Rule #5 server-side
   authorization, Rule #7 automated tests for business-critical rules, Rule #8 no redundant
   dependencies, Rule #10 small vertical slices).
2. docs/exec-plans/active/phase-17.md — this phase's brief in full. Pay special attention to:
   - Section 3, decision #6 ("Khoảng giá ước tính... tính SERVER-SIDE") — this is the one point
     that changed after review. Do NOT follow the pattern in
     src/components/admin/pricing-calculator-panel.tsx (passing a raw `PricingConfigInput` object
     into a client component) for this phase. `pricing_configs` has no RLS — it is only protected
     by `requireOwner()`/`requireAdmin()` at the app layer — so any public, unauthenticated page
     must never receive the real config object or run `computePricingBreakdown` with it in the
     browser.
   - Non-goals #2 — the STL export must always be a single merged mesh (`BaseMesh` + `TextMesh`
     merged before export), never a color-split multi-file export. The `baseColor`/`textColor`
     picker only produces a text description in `requestedColor`, not an actual multi-material file.
   - Section 6 checklist — all "Trước khi giao Codex" items are already checked; nothing is open.
3. src/services/pricing.service.ts (`computePricingBreakdown`), src/lib/pricing/smart-waste-estimator.ts,
   and src/services/pricing-config.service.ts (`getCurrentPricingConfig`) — existing pure pricing
   calculation and config-fetch patterns to reuse server-side only.
4. src/services/custom-request.service.ts, src/domain/schemas.ts (`publicCustomRequestInputSchema`),
   and src/app/(storefront)/custom-print/custom-request-form.tsx — the existing attachment-upload
   and public request-creation flow this phase integrates with, unchanged.
5. src/app/api/public/custom-requests/route.ts and .../attachments/route.ts, plus any existing
   public route using `createDatabaseRateLimiter` — the rate-limiting pattern the new price-estimate
   route must follow.

Task: implement Phase 17 — Public 3D Text/Keychain Generator (Browser-side) → Custom Request —
ONLY. Do not implement any of the other 13 tools from the reference landing page (sculpt, organizer,
bowl, jigsaw, hinge box, 3MF color splitter, etc.) — out of scope per phase-17.md Non-goals. Do not
create real `quotes` rows, do not add a 3D CSG boolean library, do not export 3MF or any
color-split/multi-file output, and do not modify the `custom_requests` schema, its service layer, or
`custom-request-form.tsx`'s existing submit path.

Scope:
- Dependencies: install `three`, `@types/three`, `opentype.js` (check first whether it ships its
  own `.d.ts` — only add `@types/opentype.js` if it genuinely lacks types, per AGENTS.md #8). Add
  one self-hosted OFL Vietnamese-coverage font (e.g. Be Vietnam Pro or Noto Sans) under
  `public/fonts/`; manually verify it covers `ư`, `ơ`, `đ`, and combined tone marks before locking it
  in (test string: "Nguyễn Văn Ơn, Vũ Thị Mỹ Duyên, Đặng Quốc Trưởng").
- Slice 1 (3D engine & preview, client-only): convert user text to 2D glyph paths via `opentype.js`,
  extrude via `THREE.ExtrudeGeometry` into two separate meshes — `BaseMesh` (rounded-corner base
  with keyring tab) and `TextMesh` (raised text). Model the keyring hole as a `THREE.Path` hole
  pushed into the base `THREE.Shape` (`shape.holes.push(...)`) so Three.js's Earcut triangulation
  produces a watertight/manifold result — no CSG boolean library. Build an interactive WebGL canvas
  (orbit/zoom, `baseColor` and `textColor` pickers, keyring-hole toggle). Export: merge `BaseMesh` +
  `TextMesh` into one mesh, then export exactly one `.stl` file via `THREE.STLExporter`.
- Slice 2 (volume/weight/time estimation + server-side price range):
  - `src/lib/pricing/mesh-estimator.ts` — pure, client-safe functions only:
    - `calculateMeshVolumeCm3(geometry: THREE.BufferGeometry): number` (signed tetrahedron volume
      sum over triangles).
    - `estimateMeshWeightGrams(volumeCm3: number, densityGramsPerCm3 = 1.24): number`.
    - `estimatePrintMinutes(weightGrams: number): number` — `12 + weightGrams * 1.8`.
    This file must not import `computePricingBreakdown` or any `PricingConfigInput` — it only knows
    about geometry and grams/minutes.
  - New route `POST /api/public/keychain-price-estimate`: accepts `{ weightGrams, printMinutes }`
    (Zod-validated, reasonable bounds — reject negative/absurdly large values), calls
    `getCurrentPricingConfig()` + `computePricingBreakdown()` server-side, returns only
    `{ minPriceVnd, maxPriceVnd }`. Rate-limit by IP using the existing
    `createDatabaseRateLimiter` pattern from the other public routes. The real config must never
    appear in the response body or in any client-side import.
  - UI shows the returned range (e.g. "25.000đ – 45.000đ / chiếc") with a visible disclaimer: "Giá
    thực tế phụ thuộc vào màu sắc, phụ kiện khoen móc và số lượng. Xưởng BaSa3D sẽ gửi báo giá chính
    xác qua SĐT/Zalo." Print minutes and exact weight are shown only if/when there's an
    admin-facing view — never displayed on the public UI (public UI shows the price range only).
- Slice 3 (custom-request integration): new page `/custom-print/tao-mau-khac-ten` (or a section
  under `/custom-print` — your call on exact routing, keep it under that existing segment). "Tải STL
  về máy" downloads the merged STL directly, no server call. "Gửi yêu cầu báo giá" uploads the STL
  Blob via the existing `POST /api/public/custom-requests/attachments` (unchanged), takes the
  returned `attachmentPath`, then pre-fills `custom-request-form.tsx` with `attachmentPath`,
  `requestedMaterial: "PLA"`, `requestedColor` (e.g. `"Đế đen (#000000) - Chữ vàng (#FFD700)"`,
  built from the picked hex colors), and `description: "Móc khoá khắc tên: {text}"` — customer then
  only fills name/phone/quantity and submits through the existing, unmodified
  `POST /api/public/custom-requests`.
- Slice 4 (GA4): fire `tool_keychain_preview`, `tool_keychain_export_download`, and
  `tool_keychain_export_to_request`, reusing Phase 10's analytics infra/event-naming conventions.
- Slice 5 (tests): unit tests for all three `mesh-estimator.ts` functions and for the new
  `keychain-price-estimate` route (valid input → correct range; invalid input rejected; response
  body never contains raw config fields like margin/labor rate/electricity rate). Integration test
  covering tool-generated STL → attachment upload → custom request creation, asserting
  `attachmentPath` matches the existing `^requests\/[uuid]\.(ext)$` pattern. Playwright E2E: type
  text → see 3D preview render → export/submit → new custom request visible in admin.
- Slice 6 (docs): update docs/roadmap.md's Phase 17 entry if wording needs adjusting, and write an
  ADR recording the mesh-volume formula, the fixed print-time heuristic (12 + grams*1.8), and the
  2D-path-hole-instead-of-CSG decision, referencing this phase.

Before reporting done:
- Run `npm test` — including new `mesh-estimator.test.ts` and the price-estimate route test.
- Run the Playwright E2E covering the flow above.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` with 0 errors.
- Verify no regressions across Phase 0-16 features.
- Confirm by inspection (not just tests) that no client-side bundle or component imports
  `computePricingBreakdown` or a `PricingConfigInput`-shaped object anywhere under the new public
  page's code path — this was the one security finding from pre-handoff review and is the most
  important thing to get right in this phase.

Out of scope, do not attempt to fix: the phase's Slice 5 also calls for printing 5 real physical
test samples on Bambu Studio and comparing actual weight against `estimateMeshWeightGrams` (target
≤15% error). This is a manual, physical verification step the Owner does after receiving your code
— do not claim to have done this in your report, and do not treat it as a blocker for your own
Definition of Done.

Commit style: small commits, Conventional Commits (see AGENTS.md examples), one logical group per
commit:
- `feat(tool): add parametric 3d text keychain engine with three.js and opentype`
- `feat(pricing): add mesh volume/weight/time estimator and server-side price-estimate route`
- `feat(storefront): integrate 3d keychain generator with custom request flow`
- `test(tool): cover mesh estimator, price-estimate route, and e2e custom request submission`

Do not move phase-17.md to docs/exec-plans/completed/ yourself — that happens after human/Claude
review.

Report back in exactly this format (per AGENTS.md):
1. Files changed
2. Behavior
3. Tests/checks run
4. Known risks
5. Follow-up work, if any
