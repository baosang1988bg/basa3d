Context: You are the implementation owner for Phase 21 of BaSa3D (see AI_WORKFLOW.md — Codex
implements, Claude/Gemini review). Phase 20 is closed — see `docs/exec-plans/completed/phase-20.md`
and its code: the shared `(tools)` route group/layout (`src/app/[locale]/(tools)/layout.tsx`), the
file convention `src/lib/3d-tools/<slug>/<slug>-engine.ts`, the epsilon-overlap merge technique, and
the generalized `POST /api/public/tool-price-estimate` route + `src/lib/pricing/tool-price-range.ts`
that every future tool (including this one) must reuse as-is. Phase 17 is **not yet formally closed**
(still in `docs/exec-plans/active/phase-17.md`, not moved to `completed/`) but its code has shipped
and is the direct pattern to mirror: `src/lib/keychain/keychain-engine.ts` (font-to-path via
`opentype.js` + `THREE.ExtrudeGeometry`, the 2D-Path-Hole keyring technique, STL export via
`three/addons/exporters/STLExporter.js`) and `src/lib/pricing/mesh-estimator.ts` (reuse unchanged,
no modifications).

Read first, in this order:
1. AGENTS.md — canonical engineering rules.
2. docs/exec-plans/active/phase-21.md — this phase's brief in full. All decisions are locked in
   ("Quyết định kỹ thuật đã chốt" — mục 4.1-4.6), including the 2026-09-05 Claude review corrections
   (font is `Comfortaa` only, no "hoặc" alternative; 3MF color assignment is per-object/per-component,
   not per-triangle; Lucide's license is ISC, not MIT; verification commands are `npm`, not `pnpm`).
   Do not re-derive or re-negotiate any named constant, file path, or naming decision below — they
   all come from that section.
3. docs/exec-plans/completed/phase-19.md, mục 4 — the roadmap-level architecture decisions this
   phase inherits unchanged: no CSG boolean library for this tool, and the hand-written
   `3mf-writer.ts` + `fflate` approach (mục 4.3) instead of a heavyweight 3MF dependency.
4. Existing code to extend/mirror, not duplicate:
   - `src/lib/keychain/keychain-engine.ts` — the font-to-path, `THREE.Shape`/`ExtrudeGeometry`, and
     2D-Path-Hole keyring-loop pattern (`shape.holes.push(new THREE.Path().absarc(...))`) to mirror
     for this phase's keyring tab.
   - `src/lib/pricing/mesh-estimator.ts` — reuse directly (`calculateMeshVolumeCm3`,
     `estimateMeshWeightGrams`, `estimatePrintMinutes`), summed across every block in a design.
   - `src/app/api/public/tool-price-estimate/route.ts` and `src/lib/pricing/tool-price-range.ts` —
     call as-is, no changes.
   - `src/app/[locale]/(tools)/layout.tsx` and `src/app/[locale]/(tools)/tools/organizer/` (page.tsx,
     organizer-workbench.tsx, organizer-canvas.tsx) — the route-group/workbench/canvas pattern to
     mirror for this tool's own route and files (see Scope below for this tool's exact paths/slugs).
   - `src/app/[locale]/(storefront)/custom-print/custom-request-form.tsx` — the form to prefill,
     same integration pattern as Phase 17/20 (upload attachment first, then prefill description).
   - `src/lib/analytics.ts` — existing `trackKeychainPreview`/`trackOrganizerPreview` and their
     `ExportDownload`/`ExportToRequest` siblings are the pattern to mirror for this phase's events.
   - `public/fonts/BeVietnamPro-Regular.ttf` (+ `OFL-BeVietnamPro.txt`) — the existing licensed font
     to keep using as the default; this phase adds one more font file (`Comfortaa`, SIL OFL) beside
     it, verifying its Vietnamese glyph coverage manually before shipping, same as Phase 17 did for
     `Be Vietnam Pro` (phase-21.md mục 2 references this verification step explicitly).

Task: implement Phase 21 — Flex Keychain (Block-style) — ONLY. Do not touch the other 6 remaining
tools from the Phase 19 roadmap (Dual Text, Car, Lamp, Hinge Box, Jigsaw, Sculpt), do not build the
`Modular`/`Bubbly` base-shape variant or the `Physical` switch-socket mode (both are explicit
Non-goals — phase-21.md mục 3 — cut after Gemini Challenge due to unresolved keyring-attachment
mechanism and unverifiable FDM print tolerance, respectively), and do not add custom font/icon
upload (also explicit Non-goals — security/licensing surface not justified for v1).

Scope:
- `src/lib/3d-tools/keychain-blocks/keychain-blocks-constants.ts`: `MAX_BLOCKS = 16`,
  `BLOCK_WIDTH_MM = 12.0`, `BLOCK_DEPTH_MM = 12.0`, `BLOCK_HEIGHT_MM = 8.0`, `BASE_THICKNESS_MM =
  2.0`, `GLYPH_EMBOSS_HEIGHT_MM = 1.2`, the block-to-block gap (`0.8mm`, phase-21.md mục 4.2), the
  keyring tab radius (`R = 4.5mm`) and hole diameter (`d = 4.0mm`, mục 4.2), and the 12-15 curated
  Lucide icon IDs listed in mục 4.5 (`heart`, `star`, `paw-print`, `music`, `cloud`, `flame`,
  `smile`, `coffee`, `car`, `plane`, `apple`, `zap`) with their SVG path data vendored in as 2D
  coordinate sets, plus the ISC/MIT license text preserved alongside (per mục 4.5's correction).
- `src/lib/3d-tools/keychain-blocks/keychain-blocks-engine.ts` (pure TypeScript, no React state),
  per phase-21.md mục 4.1/4.2:
  - `KeychainBlockConfig` type: `{ id: string; char: string; blockColor: string; glyphColor: string
    }` — `char` holds either a literal character/digit/accented-Latin glyph, or an `"icon:<id>"`
    sentinel referencing one of the constants file's Lucide icons.
  - `buildKeycapBaseShape()` / `buildGlyphShape()` (text via `opentype.js`, icon via vendored SVG
    path → `THREE.Shape`) / `buildSingleBlockMesh()` per phase-21.md mục 4.1/4.6 dimensions.
  - `buildCompactBaseMesh()`: one continuous base strip merging every block's footprint plus a
    keyring tab (2D-Path-Hole technique, mirroring `keychain-engine.ts`) — `Compact` mode only, per
    Non-goals.
  - `generateKeychainBlocksScene()`: combine base + all blocks into a `THREE.Group` for preview;
    reject/clamp any input exceeding `MAX_BLOCKS` inside the engine itself, not just in the UI.
  - Enforce every `keychain-blocks-constants.ts` limit inside the engine.
- `src/lib/3d-tools/common/3mf-writer.ts`: hand-written 3MF writer using `fflate` for zip
  compression (Open Packaging Conventions structure: `[Content_Types].xml`, `_rels/.rels`,
  `3D/3dmodel.model`), 3MF Material namespace
  `xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"`, one `<m:colorgroup>`
  with one `<m:color>` per distinct block color. Per phase-21.md mục 4.4's corrected approach: each
  block is its own `<object>`, color assigned at the **object/component level** (`pid`/`pindex`),
  **not** per-triangle — do not implement per-triangle color assignment. Input shape:
  `{ geometry: THREE.BufferGeometry; colorHex: string; name: string }[]` → `Uint8Array`/`Blob`
  output.
- `exportBlocksStlZip(...)` in the same area: export each block as its own STL (mirroring
  `exportKeychainStl` from `keychain-engine.ts`), zip the set with `fflate`.
- `src/app/[locale]/(tools)/tools/keychain-blocks/page.tsx` +
  `src/app/[locale]/(tools)/tools/keychain-blocks/keychain-blocks-workbench.tsx`: name input
  (auto-splits into per-block slots, capped at `MAX_BLOCKS`), font picker (`Be Vietnam Pro` /
  `Comfortaa` only), global base color picker, per-block slot list (character/icon override,
  block color, glyph color), 3D preview canvas (`next/dynamic(..., { ssr: false })`, orbit/zoom),
  live price estimate via `POST /api/public/tool-price-estimate` (summed weight across all blocks),
  and 3 export actions: "Tải STL Zip", "Tải Bambu 3MF (Màu)", "Gửi yêu cầu báo giá" (uploads via
  `POST /api/public/custom-requests/attachments`, prefills `custom-request-form.tsx`).
- GA4 tracking in `src/lib/analytics.ts`: `trackKeychainBlocksPreview`,
  `trackKeychainBlocksExportDownload`, `trackKeychainBlocksExportToRequest`, firing
  `tool_keychain_blocks_preview`, `tool_keychain_blocks_export_download`,
  `tool_keychain_blocks_export_to_request` — same shape as existing `trackOrganizer*`/`trackKeychain*`
  functions.

Before reporting done:
- Unit tests for `keychain-blocks-engine.ts`: geometry validity (bounding box, non-zero volume) for
  both character and icon blocks, `MAX_BLOCKS` enforcement (reject input exceeding it), and every
  other `keychain-blocks-constants.ts` limit actually enforced inside the engine.
- Unit tests for `3mf-writer.ts`: unzip the exported file, parse the XML, assert the color-group
  structure and object-level `pid`/`pindex` assignments are present and correct for a multi-block
  fixture (per phase-21.md mục 4.4's "Automated test" step).
- **Manual slicer verification (required, not optional)**: export a real 4-character/4-color test
  design (e.g. "BASA"), open the resulting 3MF in Bambu Studio (v1.9+) or OrcaSlicer (v2.0+), and
  confirm all 4 blocks show up as 4 distinct filament/color slots on the plate. Record the result
  (slicer name/version, screenshot or written confirmation) in the phase's follow-up notes — this is
  the phase's core technical risk (phase-21.md mục 5) and must not be marked done from XML-spec
  compliance alone.
- Playwright E2E (see `.agents/skills/e2e-testing/SKILL.md`, mirroring Phase 17/20's flow): enter a
  name + customize a couple of blocks → preview renders → "Gửi yêu cầu báo giá" flow completes →
  request appears in Admin.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass, with zero regressions
  in the existing Phase 0-20 test suite.
- Run `.agents/skills/security-review/SKILL.md`'s checklist against the new custom-request
  integration path specifically: confirm the attachment upload still goes through the existing
  rate-limited, extension-allowlisted endpoint unchanged, and that no pricing config is ever sent to
  the browser (this route is being reused as-is, not modified — confirm that remains true).

If the hand-written `3mf-writer.ts` fails the manual slicer verification step and cannot be fixed
within this phase's scope, phase-21.md mục 4.4 pre-commits to a fallback: ship `Export STL zip` only
for v1, cut `Export Bambu 3MF (colors)` from this phase's Definition of Done, and leave a clear
follow-up note (do not silently drop the feature without recording why).

Commit style: small commits, Conventional Commits (see AGENTS.md examples), one logical group per
commit, e.g.:
- `feat(tools): add keychain-blocks 3D engine and constants`
- `feat(tools): add hand-written 3MF multi-color writer and STL zip export`
- `feat(tools): add keychain-blocks workbench and route`
- `feat(tools): wire keychain-blocks into custom request flow and GA4 tracking`
- `test(tools): add keychain-blocks engine, 3mf-writer, and E2E coverage`

Do not move phase-21.md to docs/exec-plans/completed/ yourself — that happens after human/Claude
review.

Report back in exactly this format (per AGENTS.md):
1. Files changed
2. Behavior
3. Tests/checks run
4. Known risks
5. Follow-up work, if any
