# Phase 21 implementation and verification

Status: implementation complete, manual slicer acceptance **passed** (2026-09-05).
Phase 21 stays in `active/` pending Owner's final close-phase step.

## Implementation notes

- Route: `/tools/keychain-blocks`, using the existing `(tools)` layout.
- Engine and constants: `src/lib/3d-tools/keychain-blocks/`. Compact base only;
  1–16 Latin/digit/icon blocks, Vietnamese NFC normalization, fixed millimeter
  dimensions, a 4 mm keyring hole, 0.8 mm gaps, and 0.2 mm shell overlaps.
- Each cap has its own colored mesh/object. Because a glyph can have a different
  color, its solid is a second colored object. The base is another object. A
  component assembly keeps all objects registered. Color properties live on
  mesh objects (`pid`/`pindex`), never triangles. This resolves the two-color
  block requirement without introducing per-triangle properties.
- STL ZIP includes the continuous base and one STL per cap plus glyph pair, all
  in assembly coordinates. Import these together without independently arranging
  parts to retain the Compact design.
- Quote submission uses one assembled STL through the unchanged attachment
  endpoint. ZIP is not in that endpoint's allowlist. The existing form is reused
  unchanged, and its description snapshots font, base color, characters/icons,
  cap colors, and glyph colors. This flow does not depend on slicer color support.
- Geometry merge preserves overlapping closed shells; it is not a Boolean union.
  Slicer union behavior and real FDM tolerances remain outside automated geometry
  validity checks. Advisory volume sums all parts and slightly overcounts overlap.
- No new dependencies, migrations, pricing changes, or other roadmap tools.

## Licensed assets and font verification (2026-09-05)

- Comfortaa downloaded from Google Fonts `ofl/comfortaa/Comfortaa[wght].ttf` via
  GitHub API and stored as `public/fonts/Comfortaa.ttf`; adjacent `OFL-Comfortaa.txt`
  preserves the source OFL license. Be Vietnam Pro remains the default.
- Both fonts passed all Vietnamese vowel/tone combinations, uppercase/lowercase,
  plus Đ/đ through `opentype.js` glyph lookup. Comfortaa was also rendered in
  Chromium and visually inspected: breve, circumflex, horn, tone marks, and
  below-base dots are present. Screenshot: `/tmp/phase-21-fixtures/comfortaa-vietnamese.png`.
- All 12 icons are sampled 2D centerlines from the installed `lucide-react`
  1.37.0 SVG definitions (24-unit viewbox), converted to solid stroke outlines.
  The `smile` alias resolves to `face-slightly-smiling` in this version.
  `LICENSE-Lucide.txt` preserves the complete ISC and inherited Feather MIT text.

## Automated checks

- Engine/writer tests: finite geometry, positive volume, cap dimensions, glyph
  emboss height, overlap, bounds, keyring opening, slot spacing, 220 mm envelope,
  all curated icons, both fonts' Vietnamese coverage, invalid inputs and MAX_BLOCKS.
- 3MF tests unzip and parse all OPC XML, check color deduplication, namespace,
  object-level properties, uncolored triangle attributes, assembly and relationship.
  STL ZIP tests inspect binary triangle counts for the base and each block.
- Analytics test checks the three exact event names and excludes personalized
  design data from event payloads.
- Playwright: Comfortaa, BASA with a heart override, changed cap/glyph colors,
  WebGL canvas, both downloads, real attachment upload, submitted custom request,
  database attachment path, authenticated Admin visibility. Initial selector error
  fixed by using accessible combobox roles. First successful run: 11.5 seconds.
- Full-suite first attempt was invalidated by an existing server on port 3411
  (`EADDRINUSE`); its disappearance caused HTTP failures. Rerun uses a distinct
  `.next-phase21-test` build with port 3411 free.
- Final command results are recorded below after verification finishes.

## Security review

Applied `.agents/skills/security-review/SKILL.md` to the new request path:

- Authentication/RBAC/Admin protection: existing custom-request form and Admin
  routes reused; no privileged browser client or new authorization bypass.
  E2E signs in as a seeded OWNER to verify the submitted request.
- RLS/database access: no schema, policy, service, or direct browser table changes.
- Boundary validation: engine rejects invalid count, duplicate/invalid IDs,
  unsupported characters/icons, and non-six-digit hex colors. Custom-request
  submission still uses the existing server validation.
- Upload: unchanged `/api/public/custom-requests/attachments` route enforces its
  PostgreSQL-backed limit of 10 uploads/IP/hour. Existing service enforces nonempty
  files, 20 MiB maximum, extension allowlist, server-selected MIME type, UUID storage
  path, and private attachment access. ZIP is not submitted. Existing validation
  is extension-based; this phase adds no claim of binary content inspection.
- Pricing: unchanged route limits 60 requests/IP/hour, validates strict finite
  weight/time bounds, and returns only `minPriceVnd`/`maxPriceVnd`. No pricing
  configuration or material costs are imported into the workbench.
- SSRF/redirects: no arbitrary URL fetch or redirect added. Fonts use two fixed
  local asset URLs and icons are bundled coordinates.
- Secrets/logging: no secrets added; GA events carry only count and export format.

## Required manual slicer gate — PASSED (2026-09-05)

Neither Bambu Studio nor OrcaSlicer was present on the implementation machine at
first pass. Owner approved installing **Bambu Studio** via
`brew install --cask bambu-studio` (v02.08.02.61) specifically to close this gate.

Fixtures were generated with:

```sh
node --import tsx scripts/phase-21-fixtures.ts /tmp/phase-21-fixtures
```

`BASA-four-colors.3mf` (red/green/blue/yellow caps, matching glyph colors, red
base — 4 distinct palette entries) was opened directly in Bambu Studio
(`open -a BambuStudio /tmp/phase-21-fixtures/BASA-four-colors.3mf`). Claude could
not capture a screenshot in this execution environment (no Screen
Recording/Accessibility permission granted to the tool process), so the Owner
visually inspected the app on the physical display and confirmed: **all 4 blocks
appear as 4 distinct colors, and the assembly retains its lay-out/relative
placement** (blocks not merged into one color, not scattered/misplaced). This
satisfies the phase-21.md mục 4.4 acceptance criterion — the 3MF export
(`Export Bambu 3MF (colors)`) stays in v1 scope; the STL-ZIP-only fallback was
**not** needed.

Known gap: this confirms Bambu Studio recognizes the per-object color/assembly
structure, not a completed physical FDM print — that remains an accepted,
non-blocking limitation per phase-21.md mục 5 (no real print test performed).

## Final results (2026-09-05)

- `NEXT_DIST_DIR=.next-phase21-test npm test`: **188 passed, 0 failed, 0 skipped**.
  The analytics test was added after this run discovered its test files; it was
  run separately with `node --import tsx --test tests/keychain-blocks-analytics.test.ts`
  and **1 passed**.
- `npm run typecheck`: passed.
- `npm run lint`: passed after removing the temporary isolated build directories.
  Those custom directory names are not in the repository ESLint ignore list;
  linting their generated bundles initially produced irrelevant generated-code
  errors. No source-rule suppression or shared config change was made.
- `NEXT_DIST_DIR=.next-phase21-e2e npm run build`: passed for the final UI.
- Final Playwright run against that production build: **1 passed (12.6 seconds)**,
  including both downloads, upload/submission, and Admin verification. A temporary
  Playwright config reused the completed production build rather than building
  again; test source is `e2e/keychain-blocks.spec.ts` and standard config remains
  unchanged. Preview screenshot was visually inspected after fixing the desktop
  workbench: the whole design is visible, and the controls scroll separately.
- Temporary build directories were removed; no phase was closed or moved.

## Claude review and continuation (2026-09-05)

Codex hit a usage limit mid-implementation with only the manual slicer gate left
open; Claude reviewed the handed-off state and continued:

- Found and reverted unrelated drift in tracked `tsconfig.json`/`next-env.d.ts`
  (both pointed at a stray `.next-test/types` path left over from an earlier
  local run, not the `.next-phase21-test`/`.next-phase21-e2e` directories this
  phase's own notes describe) — restored to the committed `.next/types` state.
- Re-ran the full suite for real (not just trusted the notes above):
  `npm test` → **189 passed, 0 failed** (includes the analytics test already
  merged into the main run), `npm run typecheck` → passed, `npm run lint` → passed,
  `npm run build` → passed, with the regular `.next` directory (no custom
  `NEXT_DIST_DIR` needed once the temporary directories were gone).
- Read `keychain-blocks-engine.ts`, `3mf-writer.ts`, the workbench/canvas/page,
  and all four test files end to end — implementation matches every locked
  decision in phase-21.md mục 4 (per-object 3MF color assignment, Compact-only
  base, `Comfortaa` as the second font, curated 12-icon Lucide set, `MAX_BLOCKS
  = 16`, keyring tab/hole dimensions).
- Closed the manual slicer gate above (installed Bambu Studio with Owner
  approval, generated fixtures, Owner visually confirmed 4-color/4-object
  recognition on the physical display — Claude could not screenshot directly in
  this execution environment).

**Remaining acceptance work**: none blocking. The only still-open, explicitly
accepted limitation is the real FDM print test (phase-21.md mục 5) — not
performed, tracked as a known non-blocking risk, same status as Phase 20's
equivalent print-verification gap.
