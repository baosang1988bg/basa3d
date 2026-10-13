Context: You are the implementation owner for Phase 33 of BaSa3D, slices S0, S1 and S2 only (see
AI_WORKFLOW.md — Codex implements, Claude/Gemini review). Phase 31 is closed — see
docs/roadmap.md; ADR-0034 (quote-first instant estimates, `/custom-print`) is the most recent shipped
behaviour this phase builds on. Phase 33 has passed a Gemini challenge and a Claude final review
(2026-10-13); S3–S8 are NOT part of this handoff (they wait on Owner answers O3–O6).

Read first, in this order:
1. AGENTS.md — canonical engineering rules.
2. docs/exec-plans/active/phase-33-bao-gia-instant-quote.md — full brief, Owner decisions D1–D5,
   technical decisions T1–T14, schema §4 (4A = S1, 4B = S2), API contract §6.2–§6.3, slices §8
   (S0, S1, S2), Definition of Done §9, and §14 "Nhật ký cập nhật" (why the plan changed after review —
   in particular: upload tokens live 2 hours, not 15 minutes; `orders` total check must change with
   its VAT columns; the item-table trigger allows DELETE only behind a session flag).
3. docs/architecture/decisions.md — ADR-0007, ADR-0010, ADR-0022, ADR-0023, ADR-0032, ADR-0034.
4. docs/database/schema.md, docs/database/business-rules.md, docs/database/migrations.md.
5. docs/research/instant-quote-research.md §1 (Vercel 4.5MB / Supabase limits) and §9 (competitor
   formula — the S0 script calibrates our own version of it).
6. Existing code to extend, not duplicate:
   - supabase/migrations/20260830000000_initial_domain_schema.sql (`quotes`, `orders` total checks,
     `prevent_ledger_mutation`), supabase/migrations/20260902000000_pricing_configs_and_snapshots.sql
   - src/services/pricing-config.service.ts, src/domain/schemas.ts (`pricingConfigInputSchema`,
     `publicCustomRequestInputSchema`), src/app/admin/(protected)/settings/pricing/{page.tsx,actions.ts}
   - src/services/quote.service.ts (`createQuote`, quote DTO, `depositVnd`), src/app/api/quotes/route.ts,
     src/app/admin/(protected)/custom-requests/actions.ts, src/app/[locale]/(storefront)/quotes/[quoteNumber]/page.tsx
   - src/services/order.service.ts (`reconcileOrderTotal`, `createOrder`)
   - src/services/custom-request.service.ts (`CONTENT_TYPE_BY_EXTENSION`, `ATTACHMENT_PATH_RE`,
     `uploadCustomRequestAttachment`, `downloadCustomRequestAttachment`), src/services/file-estimate.service.ts
   - src/app/api/public/custom-requests/{route.ts,attachments/route.ts}, src/app/api/public/file-estimate/route.ts
   - src/app/[locale]/(storefront)/custom-print/custom-request-form.tsx
   - src/lib/rate-limit (`createDatabaseRateLimiter`, `getClientIp`)
   - src/lib/parsers/{threemf-slice-info.ts,mesh-volume.ts} (read-only use in S0)
   - tests/migration-contract.test.ts, tests/helpers/test-environment.ts, scripts/cleanup-test-data.mjs

Task: implement Phase 33 slices S0 (calibration script), S1 (versioned VAT) and S2 (direct-to-Storage
upload + `custom_request_items` schema) — ONLY. Do NOT build the `/bao-gia` page, the
`/api/public/quote-estimate` endpoint, `mesh-metrics.ts`/`fdm-estimate-model.ts` production modules,
the `items` branch of the public custom-request route, admin item screens, re-verify action, or any
deposit/payment change — those are S3–S8. Do not change the `/custom-print` UI.

Scope:

S0 — calibration script (offline, no production code changes)
- Create `scripts/fdm-model-calibration/` (Node/TS, run locally by the Owner against a folder of the
  shop's own sliced `.3mf` files). Reuse `parseThreeMfSliceInfo` for ground-truth grams and minutes;
  compute volume, surface area and Z height of the printed geometry (applying build-item transforms)
  inside the script. Read `layer_height`, `sparse_infill_density` and wall/top/bottom settings from
  the file's `Metadata/project_settings.config` so each sample is fitted with its real infill.
- Use single-plate files only (skip and report multi-plate files).
- Implement the §5.1/§5.2 model with the placeholder constants, fit `SHELL_THICKNESS_MM`, `Q_WALL`,
  `Q_INFILL`, `Q_SUPPORT`, `MIN_LAYER_SECONDS`, `LAYER_OVERHEAD_SECONDS`, `T_SETUP`, `K_CALIB`
  (simple grid/coordinate search is fine — no new dependency), and print a report: per-file actual
  vs predicted grams/minutes, median and P90 absolute % error, fitted constants. Acceptance threshold
  (§8 S0): median grams ±15%, minutes ±25% — the script reports pass/fail; the Owner decides.
- README in the folder with the exact run command. Include a tiny synthetic fixture test so the
  script runs in CI without the Owner's files.

S1 — versioned VAT (migration 4A + service/UI)
- Migration `supabase/migrations/<timestamp>_vat_versioned.sql` exactly as §4A: `pricing_configs.vat_enabled`
  (default false) + `vat_rate_bps` integer basis points (800 = 8%) with
  `pricing_configs_vat_rate_when_enabled`; `quotes` and `orders` get `vat_rate_bps` + `vat_amount`;
  drop `quotes_total_check` / `orders_total_check` inside a `DO` block that raises if the constraint
  is not found; add `quotes_total_with_vat` (`total = subtotal + shipping_fee - discount + vat_amount`
  and `vat_rate_bps > 0 or vat_amount = 0`) and `orders_total_with_vat`
  (`total = subtotal + shipping_fee + cod_fee - discount + vat_amount`, same rate rule). Do NOT encode
  the VAT formula in the DB.
- `src/lib/pricing/vat.ts`: `computeVat(baseVnd: number, rateBps: number): number` — integer VND,
  `Math.round(baseVnd * rateBps / 10000)`, rejects non-integer/negative input; base for a quote is
  `subtotal + shippingFee - discount` (pending accountant confirmation O2 — keep the base in this one
  function so it can change without a migration).
- `pricing-config.service` + `pricingConfigInputSchema`: `vatEnabled` (boolean), `vatRateBps`
  (integer 0–10000, must be > 0 when enabled). Read paths return real numbers (ADR-0023: integer
  columns are fine, but keep coercion consistent). Admin `settings/pricing` (OWNER-only, unchanged
  auth): a VAT toggle and a rate input in percent, converted to bps server-side; saving creates a new
  config row as today.
- `createQuote`: VAT is computed server-side from the CURRENT pricing config (not from the client,
  not from `pricing_config_id`, which may be null for manual quotes); persist `vat_rate_bps` and
  `vat_amount`; the client-submitted `total` must equal the server total or throw
  `DomainError('QUOTE_TOTAL_MISMATCH', …, 400)`. Update the admin quote form so it shows the VAT line
  (read-only) and submits a matching total. Quote DTOs expose `vatRateBps` and `vatAmount`; the public
  quote page and admin quote views show a VAT line only when `vatAmount > 0`. `depositVnd` stays
  `ceil(total / 2)` — no deposit/QR behaviour change.
- `orders`: no code writes VAT in this phase; make sure `createOrder` still inserts with the new
  columns defaulting to 0 and the new check satisfied.

S2 — direct upload + item table schema (migration 4B + upload path)
- Migration `supabase/migrations/<timestamp>_custom_request_items.sql` exactly as §4B: table
  `custom_request_items` with all checks/uniques (including `unique (id, custom_request_id)`), index,
  NEW trigger function `prevent_custom_request_item_mutation()` (UPDATE always rejected; DELETE allowed
  only when `current_setting('basa3d.allow_item_purge', true) = 'on'`), `quotes.custom_request_item_id`
  + composite FK `quotes_item_same_request` + index, and the `storage.buckets` limits for
  `custom-request-attachments` (52428800 bytes, MIME list per §4B). No application code reads/writes
  `custom_request_items` yet except tests.
- `POST /api/public/custom-requests/upload-urls` per §6.2: body `{ files: [{ ext, sizeBytes }] }` (1–10,
  Zod strict); allowed extensions = keys of `CONTENT_TYPE_BY_EXTENSION`; `sizeBytes <= MAX_UPLOAD_BYTES`
  (single constant in one config file, default 50MB); server-generated paths `requests/<uuid>.<ext>`;
  `createSignedUploadUrl(path)` (no upsert; tokens live 2 hours — fixed by Supabase, do not try to
  shorten); response `{ uploads: [{ path, token, contentType }] }`; DB rate limit 20 calls/hour/IP
  (`createDatabaseRateLimiter`). The client MUST call `uploadToSignedUrl(path, token, file,
  { contentType })` with the returned `contentType`.
- `inspectUploadedObject(path)` in `custom-request.service.ts`: confirms the object exists, real size
  ≤ `MAX_UPLOAD_BYTES`, and magic bytes match the extension (`PK\x03\x04` for .3mf; binary-STL length
  formula or leading `solid` for .stl; OBJ/STEP text; JPEG/PNG/WebP signatures). Read only the first
  bytes you need (range/partial read if the supabase-js version supports it; otherwise document the
  limitation). Verify which metadata API (`info()` vs `list()`) exists in the installed supabase-js
  before using it. Call it in `POST /api/public/custom-requests` for the existing single
  `attachmentPath` branch (400 on failure).
- Switch `/custom-print/custom-request-form.tsx` to: call `upload-urls`, then `uploadToSignedUrl`, then
  continue the existing flow with the returned `path` (UI unchanged). Remove
  `src/app/api/public/custom-requests/attachments/route.ts` and `uploadCustomRequestAttachment`;
  update or replace `tests/phase-6-attachment-route.test.ts` and `tests/phase-6-attachment-upload.test.ts`.
- `estimateAttachment` / `/api/public/file-estimate`: a stored file larger than the 20MB parse cap now
  returns a new status `TOO_LARGE` (not a thrown 400); `/custom-print` shows the existing
  "staff will quote" message for it.
- Orphan cleanup: `GET /api/cron/cleanup-orphan-uploads` requiring `Authorization: Bearer ${CRON_SECRET}`
  (401 otherwise); deletes objects under `requests/` older than 24h that no
  `custom_requests.attachment_path` or `custom_request_items.attachment_path` references (batch,
  bounded per run, logs counts); add the daily Vercel Cron entry in `vercel.json`. Document
  `CRON_SECRET` in `.env.example`.
- Test helper `purgeCustomRequest(client, id)` (transaction + `set local basa3d.allow_item_purge = 'on'`,
  deletes quotes → items → request) and update `scripts/cleanup-test-data.mjs` to use the same
  approach so existing cleanup keeps working once items exist.

Before reporting done:
- Migrations apply cleanly on a disposable local/test database only (tests/helpers/test-environment.ts
  guard) and `tests/migration-contract.test.ts` asserts the new columns/constraints/trigger/FK.
- Unit: `computeVat` (0 bps, 800 bps, 1000 bps, .5 rounding, large values, rejects floats/negatives);
  upload-urls Zod (11 files, bad ext, oversize) and returned `contentType`; magic-byte checks per type;
  cron auth (missing/wrong secret → 401).
- Integration (real DB): VAT off → a quote created through `createQuote` has identical totals to
  before and `vat_amount = 0`; VAT on at 800 bps → `vat_amount` and `total` correct; mismatched client
  total → `QUOTE_TOTAL_MISMATCH`; raw SQL insert with wrong total, or `vat_amount > 0` with
  `vat_rate_bps = 0`, is rejected for both `quotes` and `orders`; existing order creation still works;
  `pricing_configs` rejects `vat_enabled = true` with `vat_rate_bps = 0`.
- Integration (real DB): UPDATE on `custom_request_items` rejected; DELETE without the flag rejected,
  with the flag allowed; a quote whose `custom_request_item_id` belongs to a different request is
  rejected by `quotes_item_same_request`; a quote with null item id still inserts.
- Integration: `POST /api/public/custom-requests` with a missing object or wrong magic bytes → 400.
- E2E: existing `e2e/storefront.spec.ts` `/custom-print` upload flow passes with the new transport;
  add one case uploading a file > 4.5MB (generated binary STL) that reaches the estimate step.
- Run `.agents/skills/database-review/SKILL.md` on both migrations (constraint names, defaults on
  existing rows, lock impact of the `alter table` on `quotes`/`orders`) and
  `.agents/skills/security-review/SKILL.md` on `upload-urls`, `inspectUploadedObject` and the cron route
  (anonymous file hosting, path control, secret handling).
- Full gate: lint, typecheck, unit + integration tests, E2E for affected flows, production build.

Accepted limitations — do NOT fix in this handoff, leave a pointer in your report instead:
- Signed upload tokens live 2 hours (Supabase-fixed); mitigated by rate limit, bucket limits, magic
  bytes and the orphan cron (plan §11).
- VAT base/rounding pending accountant confirmation (O2); VAT stays disabled by default.
- The deposit QR on `/quotes/[quoteNumber]` is unchanged (O1).

Commit style: small commits, Conventional Commits (see AGENTS.md examples), one logical group per
commit — e.g. `chore: add fdm model calibration script`, `feat: add versioned VAT to pricing configs and quotes`,
`feat: upload custom request files directly to storage via signed urls`,
`feat: add custom_request_items table and item-linked quotes`, `chore: add orphan upload cleanup cron`.
Do not move phase-33-bao-gia-instant-quote.md to docs/exec-plans/completed/ yourself — that happens
after human/Claude review. Tick the S0/S1/S2 checkboxes in §8 that you actually completed.

Report back in exactly this format (per AGENTS.md):
1. Files changed
2. Behavior
3. Tests/checks run
4. Known risks
5. Follow-up work, if any
