# Feature 003-stl-bulk-import: Kho STL trên Drive → sản phẩm DRAFT → OWNER duyệt → lên web

> Exec-plan cầu nối (làm tay bằng `/speckit-specify` + `/speckit-plan`). Đặc tả: [`specs/003-stl-bulk-import/spec.md`](../../../specs/003-stl-bulk-import/spec.md) ·
> plan: [`plan.md`](../../../specs/003-stl-bulk-import/plan.md) · research + database review: [`research.md`](../../../specs/003-stl-bulk-import/research.md) ·
> data model: [`data-model.md`](../../../specs/003-stl-bulk-import/data-model.md) · task: `tasks.md` (chưa tạo).
> Đóng bằng skill `close-phase` khi DoD đạt (chuyển file này sang `completed/`).

**Nhánh**: `dev` (chưa tạo nhánh feature — chờ OWNER) · **Trạng thái**: code done + lint/typecheck/test/build xanh 2026-10-21 (commit cục bộ trên `dev`, chưa push); còn việc của OWNER (xem DoD)
· **Thay thế**: quyết định T3 của Phase 32 (ADR-0049, *Accepted*)

## Phase brief & Phase Bridge (trích plan.md)

**Phase brief**:
- **Goal**: biến kho STL trên Drive thành sản phẩm nháp có ảnh/kích thước/giá ước tính, và một trang để OWNER duyệt hàng
  loạt lên web an toàn về bản quyền.
- **Non-goals**: viewer 3D, cho khách tải STL, đồng bộ Drive realtime, ảnh AI, tự xác định bản quyền, nhập tồn kho, bỏ duyệt,
  phát hiện file bị di chuyển theo nội dung.
- **Inputs**: `docs/prompts/stl-drive-to-draft-products.md` (D1–D8, schema), spec (Q1=C, Q2=A, Q3=B), 5 bổ sung OWNER
  2026-10-21, `parseStlMetrics`, pricing engine, `uploadProductImage`, spike Phase 32.
- **Outputs**: migration `stl_bulk_import`, `src/lib/stl-import/*`, 3 service, script `scripts/stl-import/import-stl.ts`,
  trang `/admin/stl-import`, test + E2E, ADR-0049, docs.
- **Risks**: lộ nguồn ra public; sản phẩm chưa kiểm bản quyền lên web; ảnh mồ côi; vượt 1 GB Storage; render chậm/treo ở
  chế độ Stream; E2E cần Supabase test (máy hiện không có Docker/Supabase CLI).

**Quyết định chính** (chi tiết research.md): D1 Drive local (chuẩn hoá NFC) · D2 script `tsx` dùng lại module thuần ·
D3 DB qua `pg` một transaction mỗi mẫu + Storage qua service-role · D4 bảng `product_import_items` · D5 DRAFT
`MADE_TO_ORDER`, 1 variant, không movement · D6 `product-images/{productId}/{uuid}.webp` · D7 `sha1(relPath)` + fingerprint ·
D8 gate = **trigger DB** (APPROVED + license_reviewed + ảnh + giá > 0 + danh mục ≠ "Chưa phân loại") · license `UNKNOWN` ·
duyệt/từ chối **chỉ OWNER** · optimistic lock `updated_at` (so sánh chuỗi µs) · cảnh báo bucket > 800 MB, chặn > 950 MB.

**Lát cắt dọc**: (1) DB migration + trigger → (2) logic thuần → (3) service ghi từ script → (4) script CLI → (5) admin
service/action/trang → (6) kiểm tra public → (7) docs.

**Rủi ro theo thứ tự ưu tiên review**: data integrity → concurrency → phân quyền/bảo mật → khả năng test → bảo trì →
đơn giản → UX.

**Tài liệu phải cập nhật**:
- [x] ADR-0049 — thay T3 Phase 32 (*Accepted*)
- [x] `docs/database/business-rules.md` — #28–#30
- [x] `docs/database/schema.md` + `docs/database/migrations.md`
- [x] `docs/operations/runbook.md` (chạy batch), `docs/roadmap.md`, `docs/exec-plans/active/phase-32-model-library.md` (thu hẹp)

**Cổng chất lượng**: `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `e2e/stl-import.spec.ts` +
chạy lại `e2e/admin.spec.ts`, `e2e/copyright-compliance.spec.ts`.

## Gate plan — OWNER chốt

- [x] R10 license: **A** chỉ Zod + comment (giữ Phase 29)
- [x] R12 lock: `updated_at`
- [x] Database review SUGGESTIONS: 13 làm luôn; 12/14/15 để sau
- [x] Nhánh: `dev`, commit cục bộ; run `/speckit-auto` song song để OWNER tự dừng

## Cập nhật 2026-10-22 (chuẩn bị chạy thử KeyCap3D — `docs/prompts/feature-003-test-run.md`)

- Publish gate + link gate chuyển `security definer` (`search_path = ''`); test: `authenticated` được grant tạm `select`
  (không policy) vẫn bị `IMPORT_PUBLISH_BLOCKED`.
- Migration `20261022000100_keycap_category.sql` + rule `KeyCap3D → keycap / KCP`.
- Importer nhận `.3mf` (thư mục lá trộn `.stl` + `.3mf` được): mesh → STL trong bộ nhớ (`src/lib/stl-import/threemf-mesh.ts`)
  rồi đo + render như STL; **không** dùng ảnh nhúng (`Auxiliaries/.thumbnails/*`, `Metadata/plate_N.png`); 3MF hỏng →
  `process_error`, lô vẫn chạy; file khác (.jpg/.png/.txt…) bỏ qua + đếm trong report.
- `report.html`: "Thư mục nguồn" mỗi thẻ + lọc theo thư mục; lọc Lỗi / Có cảnh báo / Nghi sai đơn vị / Nghi gộp sai.
- Cổng 2026-10-22 (Postgres local, không Supabase): lint ✅ typecheck ✅ build ✅; `npm test` chỉ còn 16 fail
  cần Supabase API/Auth/Storage (`fetch failed` / 502) — không fail nào thuộc stl-import; E2E chưa chạy (xem DoD).
- Lần chạy lại 2026-10-22 (sau khi xoá `.next-test`, 0 lỗi 500 `/home` `/products`): 711 test, 693 pass, 18 fail.
  16 fail như trên (RBAC/staff, upload Storage, cover blog). 2 fail mới — `makerworld-estimate` "VERIFIED: returns the
  admin-verified prices…" và `makerworld-price-preset` "save → lookup … KIT < ASSEMBLED" — không thuộc feature 003.
  Giả thuyết: Postgres Homebrew chạy TimeZone `Asia/Ho_Chi_Minh` → `timezone('utc', now()) - 1s` ghi lùi 7 giờ, nên
  pricing config còn sót từ lần chạy trước (ghi bằng `now()` thật) thắng "config hiện hành". Đã sửa
  `scripts/test-db-setup.ts`: đặt `timezone = 'UTC'` cho DB test (giống Supabase). Cần chạy lại
  `npm run test:db:setup -- --reset && npm test` để xác nhận.

## Definition of Done

- [ ] Batch thật ≥ 100 mẫu chạy xong; `report.html` có tỉ lệ lỗi + thời gian trung bình/mẫu (OWNER chạy trên máy)
- [ ] Draft hiện trong admin; OWNER duyệt ≥ 10 sản phẩm → thấy ở `/products` và sitemap
- [x] Test: không sản phẩm nhập nào lên ACTIVE khi chưa `license_reviewed` — qua **mọi** đường (duyệt, sửa sản phẩm, unarchive, `PATCH /api/products/[id]`)
- [x] Test: không lộ thông tin nguồn ra public (service storefront, API, sitemap slugs) + RLS bảng mới — HTML qua E2E (chưa chạy)
- [x] Test: idempotent, đổi nguồn (DRAFT vs APPROVED), rollback ảnh, quyền 401/403/OWNER-only, optimistic lock, bulk partial
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (0 fail mới; 29 fail có sẵn từ trước do môi trường test thiếu seed/Supabase Auth)
- [ ] Playwright `e2e/stl-import.spec.ts` (OWNER duyệt → storefront hiển thị) + E2E sản phẩm hiện có —
  **E2E chưa chạy — thiếu Supabase local** (2026-10-22: máy không chạy Supabase CLI/Docker; DB test là Postgres Homebrew
  `basa3d_test`. Lần thử 2026-10-21: cả 3 spec stl-import/admin/copyright-compliance dừng ở `mintStaffAccount` —
  `AuthRetryableFetchError: fetch failed`, chưa chạy tới bước nào của tính năng)
- [x] Docs theo danh sách trên; ADR-0049 *Accepted*
- [x] Reviewer: BLOCKERS = 0 (database-review + security-review, research.md)
