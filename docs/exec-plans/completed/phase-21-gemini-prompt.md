# Prompt gửi Gemini — Phase 21 kickoff (Flex Keychain block-style: chế độ Physical switch, Compact/Modular, 3MF đa màu, và nguồn icon/font)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-21.md` in full (it has
the complete context: khảo sát trực tiếp trang tham khảo, goal, non-goals, and mục 4 "Các điểm cần
chốt trước khi soạn Codex handoff" — all currently tentative, none implemented yet), plus
`docs/exec-plans/completed/phase-19.md`'s mục 2 và mục 4 (đánh giá độ phức tạp tool #2 trong roadmap,
và các quyết định kiến trúc cấp roadmap: route group `(tools)`, thư viện CSG, và quyết định tự viết
`3mf-writer.ts` bằng `fflate` — Phase 21 kế thừa nguyên, không mở lại) and
`docs/exec-plans/active/phase-17.md`'s mục 3 (engine dựng chữ `opentype.js` + `THREE.ExtrudeGeometry`,
kỹ thuật lỗ móc khoá bằng 2D Path Hole — tiền lệ trực tiếp liên quan đến Question 2 bên dưới). Do not
write code. Follow the "Required output for architectural alternatives" format from `GEMINI.md`
(Current approach / Alternative / Pros-cons / Complexity impact / Cost impact / Recommendation /
What docs/code would need to change) for each question below, then give a final concrete
recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D is a small 3D-printing business platform (Next.js App Router, Supabase/Postgres). Phase 17
shipped the first browser-based 3D generator tool (`/tools/keychain-generator`: `three.js` +
`opentype.js`, extrude text/base into a merged single-mesh STL, advisory server-side price estimate
that never leaks real pricing config to the browser). Phase 20 shipped Flex Organizer and, along with
it, a shared `(tools)` route group/layout and a generalized `POST /api/public/tool-price-estimate`
route reused by every future tool. Phase 19 is a closed roadmap doc that surveyed 8 more tools to
build (inspired by a third-party site) and ranked Flex Keychain block-style as tool #2 priority.
Phase 21 (this phase) is a fresh brainstorm draft for that tool: unlike Phase 17's single flat
extruded text plate, this is **one separate 3D block per character** (keycap-style), each block
individually colorable, assembled into a strip — inspiring reference site (khảo sát trực tiếp bằng
Playwright vì trang là SPA client-render, `WebFetch` không đọc được nội dung) exposes: 2 base-shape
modes (`Compact` = fused base with keyring loop, `Modular` → `Bubbly`/`Bubbly V2` = fully separate
blocks), 2 "switch" modes (`Physical` = socket sized for a real mechanical-keyboard switch,
`3D-printed` = self-standing base), a fixed built-in font list + custom font upload, a fixed ~20-icon
glyph set alongside letters/digits, and 2 export formats (`Bambu 3MF (colors)` multi-color, or a
zipped bundle of separate per-block STL files).

None of Phase 21's design has been challenged by anyone but Claude so far. No code has been written
yet for this phase — this is still a draft brainstorm document, so anything here is cheap to change.

## Question 1 — Should the `Physical` switch-socket mode ship in v1 at all?
Phase 21 (mục 4.3) flags that `Physical` mode (a socket geometry sized to snap onto a real
mechanical-keyboard switch, e.g. Cherry MX-style stem) needs tight tolerance (~±0.1-0.2mm) that
typical customer-owned FDM printers can't reliably guarantee, and that a bad fit is a worse experience
than not offering the feature. The draft proposes two options: (a) drop `Physical` entirely for v1,
ship only `3D-printed` self-standing base, or (b) keep `Physical` but ship it with an explicit
"reference tolerance only, verify with a real switch before printing in bulk" disclaimer.

Challenge this:
- Given BaSa3D's actual customer base (small-business/hobbyist buyers ordering novelty
  keychains/nameplates, not necessarily mechanical-keyboard enthusiasts with switches on hand to
  test-fit), is `Physical` mode even a meaningful use case for v1, or is it scope inherited from the
  reference site without a clear matching demand here?
- If keeping it (option b), is a text disclaimer sufficient risk mitigation, or does AGENTS.md's
  general caution around unverified physical/print claims argue for actually gating it behind a
  clearly separate "advanced/experimental" UI affordance so it can't be mistaken for a verified
  feature?
- Is there a concrete tolerance number (backed by common FDM nozzle/layer defaults, similar to how
  Phase 20 locked `WALL_OVERLAP_EPSILON_MM = 0.2`) that would make `Physical` mode safe to ship with
  a documented caveat, or is the tolerance problem fundamentally not solvable with a single constant
  across unknown printer/filament combinations?

## Question 2 — Build order and keyring attachment for `Compact` vs `Modular`
Phase 21 (mục 4.2) tentatively proposes building `Compact` first (fused base + keyring loop, reusing
Phase 17's 2D-Path-Hole technique for the loop) and deferring `Modular`/`Bubbly` to a later slice,
because static DOM inspection of the reference site couldn't reveal how (or whether) a keyring
attaches to fully-separate `Modular` blocks.

Challenge this:
- Is `Compact`-first actually the lower-risk build order, or does `Modular` (each block fully
  separate, no shared base) turn out to be geometrically simpler to ship first precisely because it
  has no keyring-loop/merge problem to solve at all — i.e. is Phase 21 deferring the wrong thing?
- What's a concrete, named mechanism for attaching a keyring to a `Modular` block strip that doesn't
  require Owner reverse-engineering the reference site further (e.g. a small hole through the first
  and last block only, a separate printed connector piece, or a strung cord requiring holes through
  every block) — pick one and say why it's the simplest to implement with the existing
  `THREE.Shape`/hole technique, not a CSG-dependent one?
- Should Phase 21 even commit to shipping both modes in v1, or is `Compact`-only (with `Modular`
  explicitly pushed to a Non-goal/later phase) a more honest scope cut given Phase 19's "small
  vertical slices" principle (AGENTS.md #10)?

## Question 3 — Validating the 3MF multi-color writer against a real slicer before calling it done
Phase 19 (mục 4.3, inherited unchanged) already locked the approach: a hand-written `3mf-writer.ts`
(~120 lines, 3MF Core + Material Color Group Specification XML, zipped via `fflate`) instead of a
heavyweight 3MF library. Phase 21 (mục 4.4) is the first phase that actually needs this writer to
produce a correct multi-color file (one color per keycap block), and flags that the definition of
"done" must include actually opening the exported file in a real slicer (Bambu Studio/OrcaSlicer), not
just confirming the XML matches the spec on paper.

Challenge this:
- Is hand-writing 3MF's Material Color Group XML actually low-risk enough to skip a battle-tested
  library entirely, given this is the first phase to depend on it working correctly on the first try
  (unlike Phase 20, which never needed multi-color export) — or does the "no new dependency without a
  concrete reason" rule (AGENTS.md #8) not apply cleanly here because correctness of a binary/XML file
  format spec is exactly the kind of thing a library exists to get right?
- What's the minimal concrete verification step Phase 21 should require before marking the 3MF export
  slice "done" — e.g. a specific slicer + version, opening the file and visually confirming per-block
  colors, or something automatable in CI (validating the zip/XML structure without a real slicer)?
- If the hand-written writer turns out fragile in practice, is there a fallback plan (e.g. shipping
  only `Export STL zip` and cutting `Bambu 3MF (colors)` from v1) that Phase 21 should pre-commit to
  now, rather than discovering the writer doesn't work after Codex has already built the rest of the
  UI around it?

## Question 4 — Sourcing the icon set and extra fonts without copying the reference site's assets
Phase 21 (mục 3 Non-goals, mục 5 Risks) commits to not reusing any font/icon asset directly from the
reference site (`flex-keychain...workers.dev`), proposing instead to source or draw a small fixed
icon set (~20 icons matching categories like airplane/apple/heart/star) and a small set of built-in
fonts with clear licensing (mirroring Phase 17's SIL OFL `Be Vietnam Pro` choice).

Challenge this:
- Is a ~20-icon fixed set actually necessary for v1 launch value, or is it a nice-to-have that could
  be cut entirely (letters/digits/accented Latin only) to remove the licensing/sourcing risk
  altogether, shipping icons only if there's a demonstrated demand later?
- If icons ship in v1, name a concrete, safely-licensed source (e.g. a specific open-license icon set
  already commonly used in web projects) rather than leaving "find icons with clear licensing" as an
  open task for whoever implements this — vague licensing instructions in a handoff prompt tend to
  get skipped under time pressure.
- For the extra built-in fonts (beyond the one Vietnamese font Phase 17 already vetted), is verifying
  each font's license and Vietnamese glyph coverage (mục 2 of Phase 17 notes this was manually
  checked) a one-time cost worth doing for several fonts up front, or should Phase 21 ship with just
  1-2 fonts in v1 and treat "more font choices" as a Non-goal deferred to a follow-up phase?

End with one clear final recommendation per question. If you'd make the same call as the tentative
decision, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer here,
not a non-answer.
