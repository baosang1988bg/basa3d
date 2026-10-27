# Phase 52 — Admin UX: Nhập kho nhanh & Đăng sản phẩm mới

**Status:** P0–P4 code done locally (2026-10-27) — đã qua review độc lập (subagent) và sửa toàn bộ BLOCKER/IMPORTANT; chờ OWNER chạy `npm test` đầy đủ + `npm run build` + Playwright trên macOS, review UI; **chưa commit**
**Owner:** Claude (implementation theo yêu cầu OWNER), OWNER (review, commit, chạy migration Production)
**Trigger:** phản ánh của staff xưởng (2026-10-27): form tạo sản phẩm và nhập kho khó hiểu, chậm, dễ nhập sai dấu.
Thiết kế ban đầu: OWNER + Gemini; review kiến trúc: Claude (cùng ngày) — 5 BLOCKER đã đưa vào quyết định dưới đây.

## Phase brief

- **Goal:** staff nhập kho READY_STOCK bằng 1 dialog ngay tại dòng sản phẩm (lý do thân thiện, không phải tự gõ dấu ±,
  không ghi trùng); sau đó đăng sản phẩm mới ở `/admin/products/new` gọn, có ảnh, có biến thể theo màu nhựa.
- **Non-goals:** đổi schema `inventory_movements` (ngoài 1 unique index; idempotency nằm ở bảng mới `admin_request_keys`), đổi luồng order/checkout, chuyển kho
  (TRANSFER_*), đổi trigger Feature 003, thư viện form/dropzone mới.
- **Inputs:** `inventory.service.ts`, `product.service.ts`, `domain/schemas.ts`, `business-rules.md` #1/#6/#9/#23/#28,
  `src/lib/stl-import/naming.ts` (slug/SKU), bảng `materials` (màu nhựa).
- **Outputs:** service `quick-restock.service.ts`, migration index idempotency, dialog Nhập kho nhanh, (P2–P4) trang
  tạo sản phẩm mới, upload ảnh trực tiếp lên Storage, nhập kho theo mẻ, sổ cái chỉ đọc.
- **Risks:** 409 mới (tồn đã đổi khi kiểm kê, trùng idempotency key) phải hiển thị tiếng Việt rõ ràng; E2E
  `e2e/admin.spec.ts` (dòng 75, 118) gãy khi gỡ form cũ (P3); upload Storage có thể để lại file mồ côi.
- **Definition of Done:** xem cuối file.

## Quyết định (đã chốt từ review)

| # | Quyết định | Lý do |
|---|---|---|
| D1 | 4 "ý định" của staff map cố định sang movement type, **dấu do server quyết**: `PRINTED → PRODUCTION_IN (+)`, `PURCHASED → PURCHASE (+)`, `COUNTED → ADJUSTMENT_IN/OUT (±, server tính)`, `DAMAGED → DAMAGE_OUT (−)`. Staff luôn gõ số dương (riêng COUNTED gõ số đếm thực tế ≥ 0). | Hết lỗi nhầm dấu; Rule #6 (lý do = movement type, actor = session). |
| D2 | **Kiểm kê**: staff nhập *số đếm thực tế của kho đó*; server tính `delta = counted − onHand(warehouse)` **sau khi khoá variant**, đối chiếu `expectedOnHand` dialog đã hiển thị → lệch thì `409 STOCK_CHANGED`. `delta = 0` → không ghi, trả `noChange`. Ghi chú **bắt buộc** (CHECK của DB cho ADJUSTMENT_*). | Tránh ghi sai khi tồn đổi giữa lúc đếm; đúng CHECK `quantity <> 0`. |
| D3 | **Idempotency**: mỗi lần mở dialog/form client sinh UUID. Bảng mới `admin_request_keys (request_key PK, scope, payload_hash, result_id)` ghi **trong cùng transaction** với SHA-256 của request chuẩn hoá (mọi dòng, số đếm, `expectedOnHand`, giá nhập, ghi chú; với sản phẩm: toàn bộ form). Cùng key + payload y hệt → replay; khác bất kỳ gì → `409 IDEMPOTENCY_CONFLICT` kèm mô tả lần trước **đã ghi gì**. Ledger rows mang `reference_type = 'quick_restock'`, `reference_id = key`; unique partial index `(reference_type, reference_id, product_variant_id)` là lớp chặn thứ hai. | Ledger bất biến — ghi trùng chỉ sửa được bằng bút toán bù. Review độc lập chỉ ra so khớp theo dòng ledger bỏ sót mẻ thêm dòng / đổi số đếm → chuyển sang hash toàn request (giống Rule #21). |
| D4 | Nhãn "Hàng hỏng / Lỗi in" đổi thành **"Hàng trong kho bị hỏng"**. Lỗi khi đang in là hao hụt vật liệu (print job `FAILED`), **không** phải DAMAGE_OUT thành phẩm. | Không trừ oan tồn hàng tốt. |
| D5 | Nhập kho nhanh **chỉ cho READY_STOCK** (server từ chối MADE_TO_ORDER: `422 NOT_STOCK_TRACKED`). | Rule #9. |
| D6 | Kho: nếu chỉ có 1 kho active → tự chọn, ẩn select; nhiều kho → bắt chọn. Dialog hiện *Tồn thực tế*, *Đang giữ cho đơn*, *Khả dụng* + công thức "Tồn cũ ± SL = Tồn mới". | Rule #23 dựa trên Khả dụng. |
| D7 | PURCHASE có ô "Giá nhập / món" (VND integer, tuỳ chọn) → `unit_cost`. | COGS. |
| D8 | (P2) Nguồn mẫu/bản quyền **bắt buộc chọn** ở Khối 2 (Tự thiết kế / Có license thương mại / Chưa rõ). `UNKNOWN` → chỉ lưu DRAFT. Không còn mặc định ngầm `OWN_DESIGN` ở form mới. | Phase 29; trigger Feature 003 chỉ phủ sản phẩm import. |
| D9 | (P2) Tồn đầu READY_STOCK nhập **theo từng biến thể**, ghi `ADJUSTMENT_IN` note "Tồn đầu khi tạo sản phẩm" trong cùng transaction tạo sản phẩm. | Tồn gắn với variant; có audit log; không làm méo sản lượng in. |
| D10 | (P2) Slug/SKU dùng lại `slugify`/`uniqueSlug`/`buildSku` (chuyển sang `src/lib/catalog/naming.ts`, stl-import re-export); bắt `23505` → thử hậu tố. Màu lấy từ `materials` active (`attributes: { color, material }`). | Không nhân đôi logic. |
| D11 | (P3) Ảnh upload **thẳng lên Storage bằng signed upload URL**, nén client → webp ≤ 1600px; ảnh bìa = `sort_order = 0`; dọn file mồ côi trong `product-images`. | Server Action mặc định giới hạn body 1 MB. |
| D12 | UI dùng shadcn **Base UI** (`style: base-nova`), không cài `@radix-ui/*`; không thêm dependency (dropzone = input file + drag events, thông báo inline). | AGENTS.md rule 8. |

## Slices

### P0 — Domain service + migration (không UI)
- [x] Migration `20261027000000_quick_restock_idempotency.sql`: unique partial index (D3)
- [x] `quickRestockInputSchema` (Zod) trong `src/domain/schemas.ts`
- [x] `src/services/quick-restock.service.ts`: `planStockEvent` (thuần, test được không cần DB) + `recordStockEvent` (khoá variant, kiểm READY_STOCK, idempotency, delta kiểm kê, Rule #23 qua `recordInventoryMovement`-equivalent trong cùng transaction) + `getQuickRestockContext` (tồn theo kho + reserved)
- [x] Test `tests/phase-52-quick-restock.test.ts`: map dấu, delta, noChange, replay, conflict, STOCK_CHANGED, MTO bị từ chối, DAMAGED vượt khả dụng bị từ chối, note bắt buộc khi COUNTED

### P1 — Dialog Nhập kho nhanh
- [x] Server actions `getQuickRestockContextAction`, `quickRestockAction` (`requireAdmin`, Zod ở biên, trả object lỗi tiếng Việt)
- [x] `src/components/admin/quick-restock-dialog.tsx` (Base UI Dialog, 4 thẻ lý do, công thức, chống phản hồi cũ khi đổi biến thể)
- [x] Nút `[+ Nhập kho]` cho biến thể READY_STOCK ở `/admin/product-inventory` và `/admin/products`
- [x] E2E `e2e/admin.spec.ts`: nhập 5, bấm Lưu 2 lần → đúng 1 dòng ledger (OWNER chạy Playwright)

### P2 — `/admin/products/new`
- [x] Naming → `src/lib/catalog/naming.ts` (+ `skuCodeForCategory`), `stl-import/naming` re-export
- [x] `createProductWithVariants` (1 transaction: product DRAFT + biến thể theo màu + tồn đầu `ADJUSTMENT_IN` theo biến thể, slug/SKU tự sinh, retry savepoint khi trùng unique, idempotent qua `admin_request_keys`)
- [x] Trang mới 3 khối (ảnh → thông tin + nguồn mẫu bắt buộc → hình thức bán + giá + màu từ bảng `materials` + màu tự thêm + trợ lý tính giá) + mục Nâng cao (mô tả dài, SEO, nổi bật)
- [x] Slug danh mục và SKU biến thể thêm sau trên trang chi tiết: để trống = tự tạo

### P3 — Ảnh
- [x] `createProductImageUploadTargets` (signed upload URL, path `onboarding/<productId>/<uuid>.<ext>`) + `registerProductImages` (kiểm `storage.objects`: tồn tại, ≤ 5 MB, đúng MIME; idempotent; ảnh bìa = sort_order 0) + `setProductCoverImage`
- [x] Dropzone nhiều ảnh, nén client ≤ 1600px WEBP/JPEG, chọn ảnh bìa; trang chi tiết dùng cùng uploader + nút "Đặt làm bìa"
- [x] `publishProductIfReady`: chỉ đăng khi license ≠ UNKNOWN, ≥ 1 ảnh, giá > 0, danh mục thật
- [x] Cron dọn ảnh mồ côi chỉ trong prefix `onboarding/` (> 24h, không có `product_images`)
- [x] Gỡ form tạo cũ ở `/admin/products` (nút "Đăng sản phẩm mới"); sửa `e2e/admin.spec.ts`

### P4 — Nhập theo mẻ + sổ cái
- [x] `recordStockEventBatch`: 1 transaction, khoá biến thể theo id tăng dần; lỗi ở 1 dòng → báo tên dòng, cả mẻ không ghi
- [x] `BatchRestockButton` (tìm theo tên/màu/SKU không dấu) ở `/admin/product-inventory` và `/admin/inventory`
- [x] `/admin/inventory` = sổ cái chỉ đọc: lọc sản phẩm/SKU, loại (nhãn tiếng Việt), người ghi, khoảng ngày Asia/Ho_Chi_Minh, phân trang
- [x] Form ghi biến động thô → mục "Nâng cao" chỉ OWNER; `recordMovementAction` **và** `POST /api/inventory/movements` chuyển sang `requireOwner` (route-auth test cập nhật)

## Definition of Done
- [x] P0–P4 checkboxes `[x]`
- [ ] `npm run lint`, `npm run typecheck` xanh (sandbox ✓); `npm test` đầy đủ + `npm run build` trên macOS (OWNER)
- [x] `business-rules.md` (#31, #32), `roadmap.md`, `docs/database/migrations.md` cập nhật

## Ghi chú xác minh (2026-10-27, sandbox Linux arm64)
- PostgreSQL 17 cục bộ, `scripts/test-db-setup.ts --reset` áp toàn bộ 32 migration (kể cả migration mới) từ DB trắng.
- `tests/phase-52-quick-restock.test.ts` + `tests/phase-52-product-onboarding.test.ts`: **30/30 pass, 0 skip** (gồm: bấm 2 lần đồng thời, 3 mẻ chồng nhau ngược thứ tự không deadlock, mẻ lỗi 1 dòng không ghi gì, retry thêm dòng / đổi số đếm / đổi giá sản phẩm → conflict, cùng key gửi đồng thời cho 2 biến thể → chỉ 1 ghi, dọn ảnh mồ côi không chạm ảnh đang dùng/ảnh cũ).
- Chạy cả 120 file test bằng `node --test` (không có Next server/Supabase): mọi test không cần mạng đều xanh. Các lỗi còn lại là môi trường: `fetch failed` (cần server do `npm test` tự dựng), esbuild darwin trong tiến trình con (stl-import CLI), và 1 test có sẵn không liên quan `makerworld-estimate.test.ts` ("makerworld.com/en/models/1" không bị từ chối) — OWNER kiểm lại trên macOS.
- `tsc --noEmit` và `eslint .` sạch. `next build` không chạy được trong sandbox (Google Fonts bị chặn mạng; compile > giới hạn 3 phút/lệnh) — **OWNER chạy `npm run build`**. Chưa xem UI trên trình duyệt.

## Review độc lập (subagent, 2026-10-27) → đã xử lý
| Phát hiện | Mức | Xử lý |
|---|---|---|
| Replay mẻ chỉ so các dòng đã có ledger → thêm dòng / đổi số đếm bị nuốt im lặng | BLOCKER | Bảng `admin_request_keys` + hash toàn request (D3) + test |
| `POST /api/inventory/movements` vẫn `requireAdmin` → STAFF lách form OWNER-only | BLOCKER | `requireOwner` + `phase-3-route-auth` minRole OWNER |
| COUNTED replay bỏ qua số đếm | IMPORTANT | Số đếm + `expectedOnHand` nằm trong hash |
| Conflict sinh key mới im lặng → có thể nhập 2 lần | IMPORTANT | Lỗi nói rõ lần trước đã ghi gì; dialog tải lại số tồn |
| Phản hồi `loadContext` cũ ghi đè khi đổi biến thể | IMPORTANT | Bộ đếm request + chặn Lưu khi `context.variantId ≠ variantId` |
| Form mẻ không hồi phục sau `STOCK_CHANGED`; kiểm kê khớp hết không bắt ghi chú | IMPORTANT | `router.refresh()`; ghi chú luôn bắt buộc khi kiểm kê |
| Idempotency sản phẩm dò `audit_logs` (không index, chỉ so tên) | IMPORTANT | Chuyển sang `admin_request_keys` (hash toàn form) |
| Ngày/actor sai định dạng → 500; uuid hoa/thường | NICE | Kiểm ngày lịch thật, `uuidSchema`; id hạ chữ thường trước khi sort/khoá |

## Gaps chấp nhận / follow-up
- Trợ lý tính giá trên form mới dùng lại `PricingCalculatorPanel` (tính ở client, như trang cũ); giá bán vẫn là do staff khai, breakdown chỉ là snapshot tham khảo. Tính lại ở server: phase sau nếu cần.
- `publishProductIfReady` kiểm ở tầng app (không có trigger cho sản phẩm tạo tay) — cùng mức chấp nhận như Rule #28 cho shop 1 chủ.
- `generateVariantSku` chọn SKU ngoài transaction insert → 2 người thêm cùng tên biến thể cùng lúc có thể nhận lỗi trùng SKU chung chung (hiếm).
- Collapsible dùng `<details>` gốc thay vì cài thêm shadcn `collapsible` (không thêm dependency).

## UX follow-up (2026-10-27, OWNER feedback "UI siêu loạn")
- `/admin/product-inventory` → "Kho & giá sản phẩm": 2 tab theo hình thức bán (MADE_TO_ORDER không còn bị đếm "Hết hàng"), 1 dòng/biến thể sắp theo độ gấp, chip trạng thái thay 4 thẻ KPI + pill + nút lọc trùng lặp, sửa giá inline, `[Nhập kho]` mỗi dòng.
- `/admin/products` → danh mục đăng bán: tab Nháp/Đang bán/Đã lưu trữ có đếm, ảnh bìa, nhãn tiếng Việt, "Còn thiếu: ảnh, bản quyền…" cho bản nháp, nút "Đăng bán" khi đủ điều kiện (`publishProductFromListAction`), danh mục thu gọn cuối trang; bỏ banner/nhập kho/giá trùng với trang Kho.
