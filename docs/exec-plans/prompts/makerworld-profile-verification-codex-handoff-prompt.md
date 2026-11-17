# Prompt Codex Handoff — MakerWorld Print Profile Verification (Phase A)

Sao chép toàn bộ khối bên dưới giao cho Codex (hoặc implementer agent) để thực hiện:

---

Context: You are the implementation owner for Phase A of MakerWorld Print Profile Verification & Quoting in BaSa3D (see AI_WORKFLOW.md — Codex implements, Claude/Gemini review). Phase 13 is closed and its foundation lives in `src/lib/parsers/makerworld-resolver.ts`, `src/components/admin/makerworld-quote-panel.tsx`, and `src/services/quote.service.ts`.

Read first, in this order:
1. `AGENTS.md` — canonical engineering rules (Rule #1 DB is source of truth, Rule #2 integer VND, Rule #5 server-side authorization, Rule #6 boundary validation with Zod, Rule #9 do not rewrite unrelated files).
2. `docs/exec-plans/active/makerworld-profile-verification-and-instant-quote.md` — the complete phase specification, locked-in architectural decisions (§3 & §4), and Definition of Done. Pay special attention to Blockers B1–B11.
3. `docs/architecture/decisions.md` (ADR-0010 for price rounding, ADR-0022 for quote snapshot immutability) and `docs/exec-plans/completed/phase-13.md`.
4. Existing files to modify:
   - `src/lib/parsers/makerworld-resolver.ts`
   - `src/components/admin/makerworld-quote-panel.tsx`
   - `src/services/quote.service.ts`
   - `src/domain/schemas.ts`
   - `src/app/admin/(protected)/custom-requests/[id]/page.tsx`
   - `src/app/[locale]/(storefront)/quotes/[quoteNumber]/page.tsx`
   - `tests/phase-13-makerworld-resolver.test.ts`

Task: implement Phase A — MakerWorld Print Profile Verification & Quoting (Admin Only, Zero DB Migrations) — ONLY. Non-goals: do not implement customer-facing Storefront instant estimation yet (Phase B); do not bypass Cloudflare via residential proxies; do not download 3MF/G-code binary files; do not store multi-tier options in a single quote.

Scope:
1. **Image Sanitizer (`src/lib/parsers/makerworld-image.ts`)**:
   - Create `sanitizeMakerWorldImageUrl(raw: unknown): string | null`.
   - Validate HTTPS only, no credentials/ports, length <= 2000, and exact-match hostname allowlist: `makerworld.com`, `*.makerworld.com`, `image.makerworld.com`, `*.aliyuncs.com`, `*.bambulab.com` (B2, B11).

2. **Resolver Multi-Profile Extraction (`src/lib/parsers/makerworld-resolver.ts`)**:
   - Parse all `instances` from `designDetail.instances`. Extract: `id`, `profileTitle` (from `name`/`title`), `profileCoverImageUrl` (sanitized), `printerTarget`, `platesCount`, `printTimeMinutes`, `netWeightGrams`, `filaments`, `amsRequired`.
   - Return `{ modelId, modelTitle, profiles: MakerWorldProfileItem[], activeProfileId: string | null }`.
   - If URL lacks `#profileId-...` and has > 1 profile, return `activeProfileId: null` (force staff to select). If exactly 1 profile, select it.
   - Enforce 3 MB response stream limit and a single 6s deadline for the entire redirect chain.

3. **Fallback Spec-Text Parser (`src/lib/parsers/makerworld-spec-text.ts`)**:
   - Pure client-side regex parser for pasted text from MakerWorld profile page: extract `hours/minutes`, `plates`, `grams`, `title`, and "No AMS" vs "AMS".

4. **Assembly Tiers Constant (`src/lib/pricing/assembly-tiers.ts`)**:
   - Export `ASSEMBLY_TIERS = { ASSEMBLED: { label: 'Bản hoàn thiện (ráp sẵn)', laborMinutes: 50, consumableLine: true }, KIT: { label: 'Bản kit (tự ráp)', laborMinutes: 20, consumableLine: false } } as const`.

5. **Schema & Snapshot Update (`src/domain/schemas.ts` & `src/services/quote.service.ts`)**:
   - Update `quoteModelSnapshotSchema` to support v2 (`schemaVersion: 2`, `dataSource`, `profileId`, `profileTitle`, `profileCoverImageUrl`, `printerTarget`, `netWeightGrams`, `amsRequired`, `tier`, `profileVerified: z.literal(true)`). Keep compatibility with legacy v1 snapshots.
   - Refine `coverImageUrl` and `sourceUrl` with security sanitizers.
   - In `quote.service.ts`: update `QuoteModelSnapshot` type; add `readQuoteModelSnapshot(raw: unknown)` with `safeParse` + error logging on corruption.
   - In `acceptQuote`: scope the auto-reject SQL so it ONLY rejects sibling quotes sharing the exact same `(model_snapshot->>'sourceUrl')` (B8).

6. **Admin Quoting Panel & Form Isolation (`src/components/admin/makerworld-quote-panel.tsx` & `custom-requests/[id]/page.tsx`)**:
   - In `makerworld-quote-panel.tsx`: isolate profile pricing state into a subcomponent keyed by `key={selectedProfileId}`.
   - Display the visual green-bordered Profile Card (NO AMS image, title, printer, hours, plates, grams).
   - Require checkbox `[x] Đã xác nhận đúng profile khách yêu cầu` before enabling "Dùng giá này".
   - When inputs change after applying, call `clearApplied()` to clear parent form price inputs (`''`) and remove hidden inputs (B3).
   - In `custom-requests/[id]/page.tsx`: wrap `MakerWorldQuotePanel` and `PricingCalculatorPanel` in an exclusive toggle (Tabs/Radio) to prevent duplicate hidden inputs inside `<ActionForm>` (B7).

7. **Public Quote View (`src/app/[locale]/(storefront)/quotes/[quoteNumber]/page.tsx`)**:
   - Render the verified profile card for v2 snapshots (profile title, thumbnail with `referrerPolicy="no-referrer"`, printer badge, specs). Show "Thông số do BaSa3D nhập" if `dataSource === 'MANUAL'`.

Before reporting done:
- Run narrow unit tests: `npm test -- tests/phase-13-makerworld-resolver.test.ts`.
- Add test coverage for: multi-profile extraction, URL with no hash, profileVerified validation, scoped sibling auto-reject in `acceptQuote`, spec-text parser.
- Run project quality gate: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

Commit style: small Conventional Commits:
- `feat(pricing): add makerworld multi-profile extraction and image sanitizer`
- `feat(quotes): add model snapshot v2 schema and scoped sibling quote auto-reject`
- `feat(admin): add visual profile verification card and fallback quick-form`
- `test(pricing): cover makerworld multi-profile resolution and snapshot v2`

Report back in exactly this format (per AGENTS.md):
1. Files changed
2. Behavior
3. Tests/checks run
4. Known risks
5. Follow-up work, if any
