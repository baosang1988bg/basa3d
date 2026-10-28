# Prompt gửi Gemini — Phase 53 phần còn lại (ảnh lỗi in, preset slicer, lỗi mới, SEO trang con, đo lường)

Read `AGENTS.md` and `GEMINI.md` first, then in full:
- `docs/exec-plans/active/phase-53-handbook-interactive.md` (scope, decisions B1–B4 / I1–I6, slice status)
- `docs/architecture/decisions.md` ADR-0055 (and ADR-0045 for static locale handling)
- `docs/exec-plans/active/phase-50-handbook.md` (the original handbook design)

Code to read before changing anything:
- `src/data/handbook/types.ts`, `troubleshooting.ts`, `sections.ts`, `tool-links.ts`
- `src/components/storefront/handbook/handbook-blocks.tsx`, `troubleshooting-table.tsx`, `defect-photo-toggle.tsx`
- `src/app/[locale]/(storefront)/cam-nang/page.tsx`, `src/app/sitemap.ts`, `src/lib/analytics.ts`
- `tests/phase-50-handbook.test.ts`, `tests/phase-53-handbook-interactive.test.ts`

Work on branch `feat/phase-53-handbook-interactive`. Small Conventional Commits, one per task. Do not push,
do not deploy. Run `npm run typecheck`, `npm run lint`, `npm test` after each task. Report in the
AGENTS.md format (files changed / behavior changed / checks run / known risks / follow-up).

## Hard constraints (do not relax)
1. `/cam-nang` stays SSG: no DB, no `cookies()`/`headers()`, no `dynamic`. Both page and `generateMetadata`
   call `applyRequestLocale(params)`.
2. No new npm dependency (rule #8).
3. Client islands never import values from `src/data/handbook` (guarded by tests). Prefer server
   components; any new island must be added to `EXPECTED_CLIENT_ISLANDS` in the phase-53 test with a reason.
4. Never show a BaSa3D price on `/cam-nang` (ADR-0055).
5. Never rename an existing defect id or chapter anchor id.
6. No `FAQPage` or `HowTo` JSON-LD (the phase-50 test forbids it on the page).

## Task 1 — Photo shot list + data wiring (no real photos: you cannot create them)
You cannot produce the photos. Produce instead:
- `docs/content/handbook-defect-shotlist.md`: for each of the 6 existing defects (+ `z-banding`,
  `pillowing` from Task 3) a shot spec the workshop can follow: test model to print (prefer a
  public-domain / self-made calibration model, name it), material, the deliberate setting that causes
  the defect, the corrected setting, camera angle, background, lighting, framing (same tripod position
  for the pair), target export (WebP, 1600×1200, 4:3, ≤ 180 KB), file names
  `/images/handbook/defects/<defect-id>-failed.webp` / `-fixed.webp`.
- Draft Vietnamese `alt` text for each photo (≥ 15 chars, describes the print, never starts with "ảnh").
- Do NOT add `photos` entries to `troubleshooting.ts` until the files exist — the test fails on missing files.

## Task 2 — Slicer preset download infrastructure (S5)
- Typed manifest `src/data/handbook/presets.ts`: `{ id, slicer: 'bambu-studio' | 'orcaslicer' | 'prusaslicer',
  kind: 'filament' | 'process', material, printer, nozzleMm, slicerVersion, file, updatedAt }`.
- New block type `presets` rendered by a **server component** with `<a href download>` links, placed in
  chapter 04 (`slicer`). Explain how to import in each slicer (1–2 lines each).
- Files go in `public/downloads/presets/` with versioned, never-overwritten names
  (`basa3d_<material>_<slicer>_<printer>_<nozzle>_v<YYYY-MM>.json`).
- Tests: every manifest file exists; JSON parses; **reject** any key containing `gcode` (machine
  start/end/change-filament G-code — B3), any absolute path, `/Users/`, `C:\\`, or e-mail address;
  filenames match the pattern; `kind` is never `machine`.
- Do not invent preset values. If the workshop has not supplied files yet, ship the infrastructure with
  an empty manifest and the block hidden when the manifest is empty.

## Task 3 — Two new defects (B4)
- Add `z-banding` and `pillowing` to `HANDBOOK_DEFECTS` (Vietnamese, own wording, ≥ 3 fixes ordered
  cheapest first, consistent with chapter 08's rule "vệ sinh/sấy → cơ khí → slicer").
- Update `tests/phase-50-handbook.test.ts` count (6 → 8) and the chapter-08 summary copy ("Sáu lỗi…").
- Bump `HANDBOOK_UPDATED_AT`.

## Task 4 — Per-defect pages (I6) — ONLY if the owner has written "I6: GO" in the exec plan
- `src/app/[locale]/(storefront)/cam-nang/loi-in/[slug]/page.tsx`, SSG via `generateStaticParams` from
  `HANDBOOK_DEFECTS` (respect the `[locale]` layout params pattern used by the existing page).
- Unique title/description per defect, `TechArticle` (+ `image` when photos exist) + `BreadcrumbList`,
  canonical + `localeAlternates`. Add to sitemap. Unknown slug → `notFound()`.
- Chapter 08 keeps the summary list and links each defect to its page; old `#xu-ly-loi` anchor still works.
- Tests mirroring the phase-50 static/JSON-LD guards for the new route.
If the owner has not decided, write the challenge instead: thin-content risk vs long-tail gain, with
your recommendation (GEMINI.md "Required output for architectural alternatives" format).

## Task 5 — Measurement (S8)
- Add to `src/lib/analytics.ts`: `trackHandbookToolUsed(tool: 'fit' | 'cost')` (fire once per page view
  per tool, on the first valid result — not on every keystroke) and `trackHandbookPresetDownload(id)`.
- Calling them from the islands is the only allowed new client code; keep the guard tests green.

## Out of scope
Email capture / lead gating, Supabase Storage for presets, EN translation, any change to `/bao-gia`.
