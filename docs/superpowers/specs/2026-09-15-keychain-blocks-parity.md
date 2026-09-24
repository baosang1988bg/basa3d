# Keychain Blocks UX/UI Parity — Spec

## Background

`localhost:3000/tools/keychain-blocks` (BaSa3D's "Flex Keychain" tool) and the reference
`https://flex-keychain.vunguyenhoanglong06031992.workers.dev/` build the same kind of product (a
per-letter 3D-printable keychain with individually colored blocks), but the reference has a more
polished, purpose-built UI. This spec captures what was learned by rendering both tools with
Playwright (screenshots + DOM text dump + control interaction) and defines the target state for
BaSa3D's implementation.

Reference research artifacts (for context, not shipped):
- `ref-flex-keychain.png`, `ref-modular.png`, `ref-3dprinted-switch.png` — screenshots of the
  reference tool in its Compact/Physical, Modular, and 3D-printed states.
- Reference's full visible control text (via `page.locator('body').innerText()`):
  `NAME`, `BASE TYPE` (`Compact`/`Modular`, plus `Bubbly`/`Bubbly V2` sub-variants that appear
  only under Modular), `TYPEFACE` (`Default (built-in)`, `Poppins`, `Bungee`, `Titan One`,
  `Bangers`, `Be Vietnam Pro`, `Upload font…`), `SWITCH` (`Physical`/`3D-printed` + a preview-eye
  toggle), `BASE COLOR`, `SLOTS` (one row per character with a combined dropdown listing
  `(auto)`, `(blank)`, digits, A–Z, accented Latin letters, symbols `? ! & @ $`, and an icon list).

## Decisions locked with the user

- **Keep `MAX_BLOCKS = 16`.** BaSa3D's 16-character capability is a deliberate product advantage
  over the reference's fixed 4-slot demo. Only the UI/UX (layout, visual theme, controls,
  interaction patterns) is brought to parity — not the block-count ceiling. The static "Tối đa 16
  khối" caption becomes dynamic (reacts to base type and current block count) instead of a fixed
  "4-slot" string.
- **Existing BaSa3D-only business features are out of scope for removal.** STL Zip / Bambu 3MF
  export, the advisory price estimate, and "Gửi báo giá" (send custom request) have no equivalent
  in the reference (which is a stateless demo) and must keep working exactly as they do today.

## In-scope changes

1. **Viewport theme** — dark scene background with a radial glow and a `THREE.GridHelper` floor,
   matching the reference's dark, gridded canvas (currently flat `#eef2f6`).
2. **Slot list layout** — replace the current one-`<fieldset>`-per-block vertical stack (character
   input + icon dropdown + 2 color inputs, each on its own line) with one compact row per slot:
   bold letter label, a single combined dropdown (auto / blank / digit / letter / accented letter
   / symbol / icon), and the two color swatches inline.
3. **Base Type control** — segmented control with `Compact` (current single continuous base) and
   `Modular` (new: each block gets its own base pad, base outline pinches between blocks, still
   one printable piece with one keyring loop at the end).
4. **Typeface control** — dropdown listing the built-in fonts plus an "Upload font…" action that
   lets the user supply their own `.ttf`/`.otf` (parsed client-side with `opentype.js`, exactly
   like the built-in fonts are already parsed).
5. **Switch control** — segmented control `Physical` / `3D-printed`. No external geometry
   difference was observed between the two states in the reference at any camera angle tested, so
   this ships as a **metadata-only** field: it flows into the STL/3MF export part name and the
   "Gửi báo giá" description, the same way `baseType`, `fontName`, and colors already do. Modeling
   an internal switch-socket cavity is out of scope for this spec (flagged below).
6. **Slot content: blank + symbols** — a slot can be explicitly blank (renders a bare cap, no
   glyph) or one of `? ! & @ $` (current validation only accepts Latin letters/digits).
7. **Default per-slot color palette** — new blocks default to a rotating palette (red/orange/
   yellow/green/blue/purple, cycling) instead of every block defaulting to the same amber.
8. **Icon set parity (partial)** — reference's icon list has 21 entries. `lucide-react@1.37.0`
   (already a dependency) has vector data for 17 of them. Ship those 17 (10 renamed from the
   current 12, 7 newly added — see plan Task 1) and drop `car`/`smile`, which aren't in the
   reference's list. `basketball`, `duck`, `rugby`, `soccer` aren't in the pinned Lucide version;
   documented as a follow-up, not attempted here (see Explicitly out of scope).

## Explicitly out of scope (follow-ups, not tasks in the plan)

- **`Bubbly` / `Bubbly V2` base sub-variants** (only appear once `Modular` is selected in the
  reference). Their exact geometry wasn't reverse-engineerable from static screenshots; guessing
  the shape would risk shipping something that looks like a "match" but isn't. Compact/Modular
  parity is in scope; the two Modular sub-styles are not.
- **Internal switch-socket geometry** for `Physical` vs `3D-printed` (see point 5 above).
- **4 missing icons** (`basketball`, `duck`, `rugby`, `soccer`) — no vetted vector source in this
  codebase yet.

## Acceptance criteria

- `/tools/keychain-blocks` viewport renders on a dark, gridded floor with the existing OrbitControls
  behavior unchanged.
- The right-hand panel shows, top to bottom: Name + dynamic caption, Base Type segmented control,
  Typeface dropdown + Upload font button, Switch segmented control, Base Color swatch, a compact
  Slots list (one row per current block).
- Choosing `Modular` changes the rendered base geometry (visibly separated pads instead of one bar)
  and the caption; choosing `Compact` reverts it. Both still export as a single STL/3MF (Modular
  is one printed piece, not physically detachable parts).
- A slot can be set to blank (renders no glyph) or a symbol (`? ! & @ $`) without validation errors.
- New blocks default to a rotating (non-uniform) color palette.
- STL Zip / 3MF export and "Gửi báo giá" continue to work, and their description/metadata reflect
  `baseType` and `switchType`.
- `npm run test` passes, including new `tests/keychain-blocks-engine.test.ts` coverage for every
  item above that lives in the engine layer.
