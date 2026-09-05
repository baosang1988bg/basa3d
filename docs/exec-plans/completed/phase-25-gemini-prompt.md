# Prompt gửi Gemini — Phase 25 review (Hinge Box Studio: bản lề chưa in thử, không tongue-and-groove)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-25.md` in full (goal,
non-goals, mục 2 "Quyết định kiến trúc", mục 4 "Rủi ro"). This phase is **already implemented and
merged** (`src/lib/3d-tools/hinge-box/`, route `/tools/hinge-box`) without an independent review
before implementation — Owner asked to move fast, Claude self-reviewed only. All automated checks
pass. This is a **post-implementation architecture review**; changes are still cheap — but this is
also the highest *physical* risk tool shipped so far (a living hinge that must actually flex without
breaking). Do not write code. Follow the "Required output for architectural alternatives" format
from `GEMINI.md` for each question below, then give one final concrete recommendation per question.

## Project context (short version, full detail is in the docs above)
Phase 25 generates a two-part hinged box (base tray + lid tray, both open rectangular shells) printed
flat side-by-side, connected by several short "living hinge" tabs at the very bottom (thin in the Z
fold-height dimension) that let the two halves fold together after printing. Optional equal-grid
dividers reuse Organizer's (Phase 20) epsilon-overlap technique. Read
`src/lib/3d-tools/hinge-box/hinge-box-engine.ts` and `hinge-box-constants.ts` for the actual
implementation.

## Question 1 — Living-hinge dimensions picked from "common FDM practice", never printed
`HINGE_THICKNESS_MM = 0.8`, `HINGE_SEGMENT_LENGTH_MM = 8`, `HINGE_SEGMENT_GAP_MM = 4` are documented
in `hinge-box-constants.ts` as coming from general community FDM/PLA living-hinge practice, not from
the reference site (not exposed via static DOM) and explicitly not verified with a real print in
this implementation environment (no 3D printer available).

Challenge this:
- Given this is the single highest physical-failure-risk feature shipped in the whole Phase 20-26
  run (a hinge that snaps on the customer's first fold is a much worse failure mode than, say, a
  cosmetic seam line), is "ship with a UI warning, wait for Owner to print-test later" (the current
  approach, mirroring Phase 20/21's accepted-risk pattern for unverified glue bonds) still the right
  call here, or does a hinge specifically warrant a harder gate — e.g. keeping the tool in a
  clearly-marked "beta/chưa kiểm chứng" state, or not exposing "Gửi yêu cầu báo giá" until Owner
  confirms at least one successful physical print+fold cycle?
- Is 0.8mm actually a safe default across the range of nozzle/layer-height combinations a small
  Vietnamese print shop's customers might use, or is there a more conservative starting value
  (thicker but more forgiving, at some flex-quality cost) worth defaulting to until real print data
  exists?

## Question 2 — No overlap/tongue-and-groove between base and lid; they meet at the same rim height
Phase 25 mục 2.2/simplification (implicit in `generateHingeBoxScene`): the base and lid rims are
designed to meet edge-to-edge when folded closed, with no lip/rabbet joint — only a small friction
latch bump (mục 2.3, explicitly not a real snap-fit) holds it shut.

Challenge this:
- For a box whose whole purpose is usually to contain small parts, does an edge-to-edge closure
  (no overlap) undermine the product's basic value proposition (things falling out through the gap,
  the lid popping open in a bag) enough that Phase 25 should have prioritized a simple tongue-and-
  groove lip over polish elsewhere, or is "friction latch + accepted limitation" a reasonable v1
  scope cut given the added geometric complexity a lip would require?

## Question 3 — Divider grid reuses Organizer's *algorithm* but not its code (deliberate duplication)
Phase 25 mục 2.1 explicitly reimplements Organizer's epsilon-overlap grid-wall technique in a new,
self-contained function rather than importing `organizer-engine.ts`, citing Phase 19's "each tool
owns its own engine file" convention.

Challenge this:
- Is duplicating a proven, tested algorithm (rather than extracting it into a shared helper both
  tools import) the right call now that it's been copy-adapted twice (Organizer, then Hinge Box), or
  has the "1 file per tool" convention from Phase 19 already reached the point where a shared
  `src/lib/3d-tools/common/grid-dividers.ts` helper would reduce real duplication-drift risk (e.g. a
  future bug fix landing in one copy but not the other) without meaningfully coupling the tools?

End with one clear final recommendation per question. If you'd make the same call as the current
implementation, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer
here, not a non-answer.
