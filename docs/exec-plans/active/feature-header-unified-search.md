# Feature Plan: Header Unified Search (shop catalog first, 3D-library second)

> **Branch:** `feat/header-unified-search` (from `dev`) · **ADR:** ADR-0064 · **Owner decision:** 2026-11-25 ("okay đồng ý")
> **Agent:** Claude (Cowork) · Merge target: `dev` → `vercel` (ADR-0061), local only, no push.

## 1. Problem
- The storefront has two disconnected searches and neither is in the header:
  - `/products?q=` — shop catalog, `ILIKE` on the product name, **accent-sensitive** (`gia do` ≠ `Giá đỡ`).
  - `ModelSearchDialog` (external 3D libraries + image search) — only on `/custom-print` (banner) and `/bao-gia`.
- External results send customers away with no way back to a quote.

## 2. Principles
1. **Shop first.** Default tab = our catalog. External libraries are the fallback, never the default.
2. **Always a way back.** Every external/image path ends with "Dán link mẫu để báo giá" → our quote flows.
3. **No cost on every page.** The dialog is lazy-loaded (`next/dynamic`, `ssr:false`) only when opened.
4. **Reuse, don't fork.** Suggestions reuse `listStorefrontProducts`; the library/image UI reuses `ModelSearchDialog` internals.

## 3. Phases (each ends green: lint · typecheck · check:arch · targeted tests)

### Phase 1 — Accent-insensitive, multi-word catalog search (data layer)
- Migration `20261126000000_storefront_search_fold.sql`: immutable `public.basa3d_search_fold(text)` = `lower()` + `translate()` of Vietnamese diacritics and `đ→d` (no `unaccent` extension dependency; immutable so it can be indexed later).
- `src/lib/catalog/search-terms.ts` (pure): split the query into ≤ 6 folded tokens, escape `% _ \`, emit `AND` of `basa3d_search_fold(p.name) like $n` clauses.
- `listStorefrontProducts` uses it → `/products?q=` becomes accent-insensitive + all-words-must-match (Phase 56 literal `%`/`_` guarantee kept).
- Tests: pure token builder; DB — `gia do` finds `Giá đỡ…`, multi-word AND, `%`/`_` still literal, DRAFT never returned.

### Phase 2 — Suggest API
- `GET /api/public/products/suggest?q=` → `{ data: { query, items[≤6] } }` (id, name, slug, imageUrl, min/max/base price, inStock, productType) via `listStorefrontProducts({ search, limit: 6 })`.
- Validation: `sanitizeListingParams` (≤ 80 chars); `< 2` chars → empty list without a DB hit.
- `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (same freshness as the Phase 42 catalog TTL).
- **No DB rate limiter on purpose:** it would write a row per keystroke; cost equals one `/products?q=` page render (which is not rate-limited), the client debounces 250 ms + aborts stale requests, and the CDN absorbs repeats. Revisit if logs show abuse.
- Tests: route validation (short/long/array q), response shape on DB.

### Phase 3 — Header button + Unified Search dialog
- `ModelSearchDialog` split into `SearchModalShell` (role=dialog, aria-modal, focus, scroll-lock, Esc, backdrop) + `ModelSearchPanel` (controlled tab + optional controlled query). `ModelSearchDialog` keeps its public API (banner + `/bao-gia` unchanged).
- `UnifiedSearchDialog` tabs: **Sản phẩm BaSa3D** (default) · **Kho mẫu 3D** · **Tìm bằng ảnh**; one shared query across tabs.
  - Products tab: debounced suggestions, ↑/↓/Enter keyboard navigation, "Xem tất cả kết quả" → `/products?q=`, GA4 `search` event (existing `trackSearch`, PII-redacted).
  - Zero results → "Không có trong cửa hàng — tìm trên kho mẫu 3D" switches tab keeping the query, + "Gửi yêu cầu in".
- Header: search icon button (desktop + mobile) before Zalo; `Ctrl/⌘+K` opens; `window` event `basa3d:open-search` (`{ tab, query }`) lets other components open it.
- i18n: `headerSearch` namespace (vi/en, parity test).

### Phase 4 — Ways back to a quote
- `src/lib/search/quote-link.ts` (pure): MakerWorld / MakerWorld CN link → `/tools/makerworld-cn?url=`; any other http(s) link → `/custom-print?ref=`; anything else → null.
- `QuoteLinkBox` in the library + image tabs ("Đã tìm được mẫu? Dán link để báo giá").
- `/custom-print?ref=<https url>` pre-fills the request description with "Link mẫu tham khảo: …" (validated, ≤ 2000 chars; no other prefill side effects).
- `/products` empty state: "Tìm trên kho mẫu 3D" button opens the unified dialog on the library tab with the same query.

### Phase 5 — Admin "Mẫu đang nóng" card
- `getHotTrendItems(limit 5)` in `trend-hunter.service.ts`: WATCHING/PRINT_TESTING items with snapshots, ranked by downloads/day then likes/day then downloads.
- Dashboard → *Vận hành* tab card (STAFF + OWNER; no money). Degrades to a hint if the trend migrations are not applied yet.

### Phase 6 — Verify & ship
- Full suite in the Linux sandbox (Postgres 17, TZ Asia/Ho_Chi_Minh), `next build`, UI screenshots (header, products tab with results + empty, library tab with quote box, `/products` empty state, admin card).
- Docs: ADR-0064, this plan, PROGRESS, CHANGELOG, owner guide link. Merge `dev` → `vercel` locally.

## 4. Risks
| Risk | Mitigation |
|---|---|
| Seq scan on `basa3d_search_fold(name)` | Catalog is hundreds of rows; function is IMMUTABLE so an expression/trigram index can be added later without code change. |
| Suggest endpoint abuse | Length cap, min 2 chars, limit 6, CDN cache; documented trade-off above. |
| Header bundle growth | Dialog behind `next/dynamic` — header only gains an icon + keyboard listener. |
| Breaking `ModelSearchDialog` users | Public props unchanged; existing UI tests/screenshots re-run. |

## 5. Progress
- [x] Phase 1 · [x] Phase 2 · [x] Phase 3 · [x] Phase 4 · [x] Phase 5 · [x] Phase 6

### Verification (2026-11-25)
- lint ✅ · typecheck ✅ · check:arch ✅ · `next build` ✅ (`/api/public/products/suggest` listed).
- New tests: `tests/header-unified-search.test.ts` (8, no DB) + `tests/header-unified-search-db.test.ts` (4, DB: fold function, accent-insensitive AND search with DRAFT hidden and `%`/`_` literal, suggest shape/limit, hot-trend ranking). Phase 56 search test still green.
- Full suite (145 files, Postgres TZ Asia/Ho_Chi_Minh): 1027 tests, 16 fail — the same Supabase-only set as before (owner guide §5). No regressions.
- UI rendered + screenshotted (real components, compiled Tailwind): header desktop (1280) + mobile, products tab with suggestions, zero-result state, library tab with QuoteLinkBox, admin hot-trend card.
  - Bug found and fixed: overlay clipped to the header (backdrop-filter containing block) → `SearchModalShell` portals to `<body>`.
  - Bug found and fixed: "Tìm sản phẩm…" label wrapped at 1024–1279 px → label/shortcut only from `xl`, icon-only below.

### Follow-ups (not done)
- Expression/trigram index on `basa3d_search_fold(name)` when the catalog grows past a few thousand products.
- Search inside product descriptions / categories (today: name only, same as before).
- Playwright E2E for Ctrl/⌘+K and keyboard navigation on a real browser (owner, needs local Supabase).

## 6. Owner feedback round 1 (2026-11-25 — branch `fix/search-ux-feedback`)
- [x] Paste link → `/bao-gia` (MakerWorld: link tab auto-quote; other links: file tab + download guide + Zalo). Fallback to old targets only when `/bao-gia` is disabled. `/bao-gia` link tab no longer errors on non-MakerWorld links.
- [x] Clearer wording: "Có sẵn tại BaSa3D" · "Tìm mẫu 3D trên mạng" · "Tìm mẫu bằng ảnh", 3-step strip, "what is a 3D model" intro, header label "Tìm sản phẩm, mẫu 3D…".
- [x] Zalo help box on every tab of the header search and in ModelSearchDialog.
- Verification: lint ✅ typecheck ✅ check:arch ✅ build ✅; full suite 1028 tests, 16 fail (same Supabase-only set); UI screenshots of the dialog (idle, online tab) and `/bao-gia?tab=file&ref=…`.

## 7. End-to-end smoke (2026-11-25 — branch `fix/search-smoke`)
- New `tests/header-search-smoke.test.ts` runs against the real `next start` server of `npm test`: header button rendered, `/products?q=` accent-insensitive + zero-result CTA + `%` literal, suggest API, `/bao-gia?tab=file&ref=` guidance, `javascript:` ref ignored, `/bao-gia?tab=link&url=` 200, `/custom-print?ref=` fallback. All green; 0 server error lines.
- Fix: `/custom-print?ref=` only pre-filled the description field, which appears at the contact step — the link is now also shown up-front ("Mẫu tham khảo: …").
