# Prompt gửi Gemini — Phase 33 S0/S1/S2: kiểm thử độc lập (VAT, upload signed URL, bảng món)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-33-bao-gia-instant-quote.md`
§4A, §4B, §5, §6.2, §6.3, §8 (S0–S2) and §14. The implementation is the commit range
`dae7083..HEAD` on `main` (`git log --oneline dae7083..HEAD`, `git diff dae7083..HEAD`).

Your role: **independent tester / challenger**. Do NOT modify application code, migrations or
existing tests. You MAY write throw-away scripts or extra test files under a scratch folder
(e.g. `tmp/gemini-phase-33/`, do not commit) to probe behaviour. Never point anything at the
Development/Production Supabase: only the disposable local test services from `.env`
(`TEST_DATABASE_URL`, `TEST_SUPABASE_*`), which `tests/helpers/test-environment.ts` enforces.

## What was implemented (claims to verify, not to trust)

**S1 — versioned VAT**
- Migration `20261015000000_vat_versioned.sql`: `pricing_configs.vat_enabled/vat_rate_bps`
  (basis points, 800 = 8%), `quotes`/`orders` get `vat_rate_bps` + `vat_amount`; the old total
  checks (auto-named `quotes_check` / `orders_check`, NOT `*_total_check` as the plan assumed) are
  located by definition inside a `DO` block that raises unless exactly one matches; new
  `quotes_total_with_vat` / `orders_total_with_vat`.
- `src/lib/pricing/vat.ts`: `computeVat` (BigInt, half-up), `computeQuoteTotals`, `vatPercentToBps`.
- `createQuote` reads VAT from the CURRENT pricing config inside its transaction, rejects a client
  total ≠ server total with `QUOTE_TOTAL_MISMATCH` (400). `quoteInputSchema` now only rejects a
  total below the pre-VAT amount.
- Admin: VAT toggle + % input in `/admin/settings/pricing` (OWNER only); `QuoteTotalsFields` makes
  the quote form's total read-only and derived (panels dispatch `input` events after writing
  `#subtotal`). Public `/quotes/[quoteNumber]` shows a VAT line only when `vatAmount > 0`.

**S2 — direct upload + item table**
- Migration `20261015000001_custom_request_items.sql`: immutable `custom_request_items`
  (UPDATE always rejected, DELETE only with `set local basa3d.allow_item_purge = 'on'`), RLS on,
  `quotes.custom_request_item_id` + composite FK `quotes_item_same_request`, bucket limit 50MB +
  MIME allowlist (raises if the bucket row is missing).
- `POST /api/public/custom-requests/upload-urls` (Zod strict, 1–10 files, 20 calls/hour/IP) →
  `{ uploads: [{ path, token, contentType }] }`. The multipart route `.../attachments` is removed;
  `/custom-print` AND the 8 tool exporters now use `src/lib/uploads/upload-custom-request-file.ts`
  (`uploadToSignedUrl`, re-wrapping the file as a Blob of the server's contentType because
  storage-js sends Blobs as multipart and takes the part type from the Blob).
- `inspectUploadedObject` (exists via `storage.info()`, size ≤ 50MB, stored Content-Type must match
  the extension, magic bytes from a Range read of the first 512 bytes) is called on
  `POST /api/public/custom-requests` for `attachmentPath`.
- `estimateAttachment` returns `TOO_LARGE` for stored files > 20MB (size checked before download).
- `GET /api/cron/cleanup-orphan-uploads` (Bearer `CRON_SECRET`, fails closed) deletes up to 1000
  objects/run under `requests/` older than 24h that nothing references, found by SQL on
  `storage.objects`; daily cron in `vercel.json`.
- `tests/helpers/purge-custom-request.ts`; `scripts/cleanup-test-data.mjs` extended to purge items.

**S0 — calibration script** `scripts/fdm-model-calibration/` (offline; README has the command).

## Tasks

### A. Run the gates and report exact results
1. `npm run lint`, `npm run typecheck` (stale `.next-test/types` errors about the removed
   `attachments` route disappear after a build — say if anything else remains).
2. `npm run test:db:setup -- --reset`, then `npm test` (builds + starts the test server on :3411).
   List every failing test with its error. Compare against `git stash`-free baseline by checking
   out `dae7083` in a separate worktree (`git worktree add ../basa3d-baseline dae7083`) and running
   the same suite there, so we can tell regressions from pre-existing failures.
3. `npx playwright test e2e/storefront.spec.ts e2e/copyright-compliance.spec.ts e2e/makerworld-quote.spec.ts e2e/jigsaw.spec.ts e2e/keychain.spec.ts`,
   then the full `npx playwright test`.
4. `npm run build`.
5. `npx tsx scripts/fdm-model-calibration/calibrate.ts <folder>` on any sliced single-plate `.3mf`
   you can produce or find in the repo/fixtures; also on a folder containing a multi-plate file.

### B. Try to break it (record the exact request/SQL and the observed result)
1. **VAT / data integrity**
   - Turn VAT on (8%) via the admin page, create a quote from the admin UI using each pricing tool
     (manual, calculator, MakerWorld panel) — does the submitted total always match the server?
   - Toggle VAT while a quote form is already open, then submit (expect `QUOTE_TOTAL_MISMATCH`).
   - Rounding edges: subtotal values that produce .5 VAT, discount > subtotal + shipping, very
     large values, VAT % input like `8,5`, `8.125`, `-1`, `101`, empty with VAT on.
   - Raw SQL against `quotes` / `orders`: wrong total, `vat_amount > 0` with `vat_rate_bps = 0`,
     `vat_rate_bps = 10001`; `pricing_configs` with `vat_enabled = true, vat_rate_bps = 0`.
   - Old quotes created before the migration: unchanged totals, public page has no VAT line.
   - Does anything else read `quotes.total` and assume `total = subtotal + shipping − discount`
     (Zalo copy text, deposit, dashboard, print jobs)?
2. **Upload abuse / trust boundary**
   - Call `upload-urls` with: 11 files, `ext: "html"`, `ext: "../stl"`, `sizeBytes` 0 / 50MB+1 /
     float, extra keys (`path`, `contentType`), non-JSON body, uppercase ext.
   - With a valid token: upload HTML as `.3mf`, upload a real STL but with
     `contentType: image/jpeg`, upload twice to the same token/path, upload 60MB, upload after
     modifying the path, then submit each path to `POST /api/public/custom-requests`
     (expect 400 `ATTACHMENT_*` for anything that does not match).
   - Submit a path that was never uploaded, a path from another bucket shape, the same path in two
     requests.
   - Rate limit: 21st `upload-urls` call within an hour from one `x-forwarded-for` → 429.
   - Windows-style STL MIME (`application/vnd.ms-pki.stl`) through the real browser flow on
     `/custom-print` and one tool page (e.g. `/tools/jigsaw`).
3. **Item table**
   - UPDATE / DELETE / TRUNCATE on `custom_request_items` with and without the session flag;
     confirm `set local` does not leak to the next transaction on the same connection.
   - Quote pointing at another request's item; quote with null item id.
   - `scripts/cleanup-test-data.mjs` dry run (default, ROLLBACK) on the test DB after creating a
     fixture-signature request (`customer_name = 'Test Customer'`, `created_at` before
     2026-09-05) that has an item and a quote. Delete the backup it writes under `.local-backups/`.
4. **Cron**
   - No header, wrong secret, `CRON_SECRET` unset, secret shorter than 16 chars → 401.
   - With the right secret on the local Supabase: create old orphan / old referenced / recent
     objects (backdate `storage.objects.created_at` only on the LOCAL test instance) and confirm
     only the old orphan is removed. Does the `postgres` role have SELECT on `storage.objects` in a
     real Supabase project? (Check docs/grants; this is a known open question.)
5. **`TOO_LARGE`**: upload a valid 25MB STL on `/custom-print` → UI shows the "staff will quote"
   message, no 400, request still submittable.
6. **UI regressions**: `/custom-print` looks and behaves as before apart from "Tối đa 50MB";
   admin quote form total is read-only and still clears when switching pricing tools.

### C. Scope check
Confirm nothing from S3–S8 slipped in (no `/bao-gia`, no `/api/public/quote-estimate`, no
`mesh-metrics.ts` / `fdm-estimate-model.ts` in `src/`, no `items` branch in the public route, no
deposit change), and list anything required by §8 S0–S2 or the Definition of Done that is missing.

## Output format
1. Gate results table (command → pass/fail, counts, and whether each failure is pre-existing per
   the baseline worktree).
2. Findings: **BLOCKERS → IMPORTANT → NICE TO HAVE**, each with steps to reproduce, observed vs
   expected, and file:line.
3. Scope check result.
4. Recommendation: ready for Claude review / needs Codex fixes (list).
Be concrete; do not claim anything is secure — report evidence and remaining risk.
