# Fix plan — QA audit 2026-11-24

- **Nguồn:** `docs/qa/2026-11-24-user-test-performance-audit.md` (QA-001 … QA-027)
- **Branch:** `fix/qa-audit-2026-11-24` (từ `dev`) · **Agent:** Claude (Cowork) · **WIP:** 1
- **Mục tiêu:** sửa các lỗi có thể sửa an toàn trong code ngay (P0/P1). Lỗi cần Owner quyết định nghiệp vụ hoặc cần thao tác trên DB/hạ tầng thì ghi rõ "Owner action" / "Deferred" kèm lý do.

## Đính chính sau khi đọc code

| ID | Báo cáo QA | Thực tế trong code | Hệ quả cho plan |
|---|---|---|---|
| QA-001 | Search 500 | Migration `20261126000000_storefront_search_fold.sql` đã có, nhưng **DB UAT chưa chạy** (PROGRESS → Next Steps #0) | Owner chạy migration. Code: thêm fallback để search không sập khi DB chưa migrate. |
| QA-004 | Không rate-limit | **Đã có** budget 10 lần sai / 24h cho mỗi mã (`verifyPhoneSuffixWithBudget`, business-rules #14/#18). Khi hết lượt, UI vẫn báo "không khớp" nên QA không phân biệt được. | Giảm mức: hiện thông báo "đã thử sai quá nhiều lần" và hướng dẫn liên hệ. Analytics đã strip `phoneSuffix`. |
| QA-005 | Không có giỏ hàng | Có flag `NEXT_PUBLIC_CART_ENABLED` (đang tắt ở env) | Owner quyết định bật/tắt; không sửa code. |
| QA-002 | Tạo SP 500 | Action rethrow mọi lỗi không phải Domain/Zod. Sandbox không vào được DB UAT. Nghi DB thiếu migration (giống QA-001; PROGRESS còn 3 migration chưa chạy). | Lỗi lệch schema → thông báo rõ ràng + script kiểm tra migration. Owner chạy migration rồi verify lại. |

## P0 — làm ngay

- [x] **QA-001 Search fallback.** `buildSearchSql(…, { fold })`. `listStorefrontProducts` bắt lỗi `42883` (undefined_function) → log cảnh báo → chạy lại bằng `lower() like lower()`. File: `src/lib/catalog/search-terms.ts`, `src/services/storefront-catalog.service.ts`. Test: unit cho SQL fallback.
- [x] **QA-002 Lệch schema → lỗi rõ ràng.** `src/lib/db-errors.ts` có `isSchemaDriftError` (42883/42703/42P01). `apiError` và `toFailure` của products/new trả `SCHEMA_OUT_OF_DATE` (503) kèm thông điệp tiếng Việt "CSDL chưa cập nhật migration mới — báo kỹ thuật". Thêm `scripts/check-migrations.mjs` + `npm run db:check-migrations` để liệt kê migration chưa chạy. Test: unit `isSchemaDriftError`.
- [x] **QA-003 Validate SĐT VN** cho 3 schema public (`publicCustomRequestInputSchema`, `publicCheckoutOrderInputSchema`, `publicBaoGiaRequestSchema`). Không áp cho schema staff/admin (có thể nhập Zalo ID). Bỏ khoảng trắng, dấu chấm, gạch ngang, ngoặc; chấp nhận `(+84|84|0)` + 9–10 chữ số. Thêm `pattern` + `title` cho các input SĐT ở storefront. `apiError(ZodError)` trả `message` tiếng Việt từ issue custom đầu tiên (form đang đọc `body.message`). Test: unit schema.
- [x] **QA-004 Thông báo khoá thử.** `verifyPhoneSuffixDetailed` → `'OK' | 'WRONG' | 'LOCKED'`, giữ nguyên wrapper cũ. Trang `/quotes/[code]` hiện thông báo riêng khi `LOCKED`. Test: unit kiểu trả về (pure part).

## P1 — làm trong branch này

- [x] **QA-010** Strip HTML trong `summary` MakerWorld (dùng lại `stripHtml`). Khi `ref` là link ngoài MakerWorld thì ghi rõ tên miền và nhãn "link bên ngoài", thêm `nofollow`. Giữ quyết định ADR-0064 (nhận link Printables/Thingiverse…).
- [x] **QA-011** Doanh thu ở trang Chi tiêu chỉ tính đơn `PAID` và không `CANCELLED`; đổi nhãn thành "Doanh thu đã thu". Ghi giả định vào `docs/architecture/decisions.md`.
- [x] **QA-012** Số tiền chi phí phải `> 0` (schema + `min=1` ở form).
- [x] **QA-013** Báo giá: giảm giá > tạm tính + phí ship → lỗi `QUOTE_DISCOUNT_TOO_LARGE` với thông điệp rõ ràng.
- [x] **QA-014** Địa chỉ giao hàng hiển thị dạng chữ (`formatShippingAddress`).
- [x] **QA-016** Không nạp GA ở `/basaadmin` và ở `NODE_ENV=development`.
- [x] **QA-017** Metadata mặc định tiếng Việt (root). Thêm title/description cho home, products, custom-print, tools và 7 công cụ thiếu description. PDP tự sinh description khi không có SEO/short description.
- [x] **QA-021** Hiện lý do khi nút gửi `/bao-gia` bị khoá ("Tích ô cam kết…").
- [x] **QA-022** Ô tìm kiếm sản phẩm `autoFocus` khi mở modal.

## Deferred / Owner action (không làm trong branch này)

| ID | Lý do | Đề xuất |
|---|---|---|
| QA-001/002 (DB) | Sandbox không truy cập được DB UAT | Owner: `npm run db:check-migrations` → chạy migration thiếu → thử lại search + tạo sản phẩm |
| QA-005 | Quyết định kinh doanh (flag giỏ hàng) | Owner bật `NEXT_PUBLIC_CART_ENABLED` khi sẵn sàng, hoặc prefill tin nhắn Zalo (feature riêng) |
| QA-006 | i18n EN là feature lớn | Feature riêng (Spec Kit) |
| QA-007 | Cần điều tra truy vấn tồn kho trên DB thật | Plan riêng: hợp nhất định nghĩa "hàng có sẵn" |
| QA-008 | Quy tắc nghiệp vụ: huỷ lệnh in thì hoàn bao nhiêu nhựa? | Owner quyết định → ADR → implement movement điều chỉnh |
| QA-009 | Đồng bộ trạng thái Request/Quote/PrintJob đụng state machine | Plan riêng + test concurrency |
| QA-015 | Rate-limit nằm ở Supabase Auth (cấu hình dashboard) | Owner kiểm tra Auth rate limits / bật captcha |
| QA-018 | Phải đo trên prod build trước (AGENTS: "optimize after measuring") | Đo Lighthouse trên `next build && next start` |
| QA-019/020/024/025/026/027 | Polish UX, không chặn | Gom vào backlog UX |

## Quyết định của Owner (2026-11-24, sau vòng 1) → vòng 2

Owner: *"web chỉ tập trung làm nơi báo giá, không định hướng thương mại điện tử"* (ADR-0066).

| ID | Quyết định Owner | Đã làm ở vòng 2 |
|---|---|---|
| QA-005 Giỏ hàng | Ẩn | [x] Đã ẩn sẵn (`NEXT_PUBLIC_CART_ENABLED=false`). Menu admin "Đơn hàng" và 2 ô KPI đơn hàng cũng ẩn theo cùng cờ. |
| QA-006 Tiếng Anh | Ẩn ở giai đoạn này | [x] Đã ẩn sẵn (`NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED`: `/en/*` → 308 về VI, không switcher/hreflang). Không cần code. |
| QA-007 Hàng có sẵn | Không cần — giờ là đặt in | [x] Cờ `NEXT_PUBLIC_READY_STOCK_ENABLED` (mặc định tắt): mọi thẻ/PDP hiện "Đặt in", bỏ bộ lọc "Sẵn hàng", ẩn ô "Hàng có sẵn sắp hết", ẩn menu "Lịch sử kho", trang Kho & giá mở tab "In theo yêu cầu". Dữ liệu giữ nguyên. |
| QA-008 Lệnh in | Không cần nữa | [x] Cờ `NEXT_PUBLIC_PRINT_JOBS_ENABLED` (mặc định tắt): ẩn menu "Việc in" và ô KPI. Accept báo giá vẫn ghi `print_jobs` (không đổi backend). QA-008 đóng. |
| QA-009 Đồng bộ trạng thái | Làm nếu tốn ít resource | [x] `syncedCustomRequestStatus`: tạo báo giá → QUOTED, chấp nhận → APPROVED, chỉ tiến, cùng transaction, ghi audit `CUSTOM_REQUEST_STATUS_SYNCED`. |
| QA-015 Rate-limit login | Không cần (chỉ Owner dùng admin) | Đóng. |
| QA-018 Hiệu suất | Duyệt | [x] Đợt 1 (rủi ro thấp): bỏ 3 namespace chỉ dùng phía server khỏi payload client (~18 KB/trang); gallery PDP chỉ tải ảnh đang xem (trước: tải hết, ví dụ 15 ảnh) + `sizes`. Đã kiểm tra: three.js của công cụ 3D và MeshViewer `/bao-gia` đều đã lazy-load; ảnh hero đã `priority`. Đợt 2 cần đo Lighthouse trên prod build (xem dưới). |

### Hiệu suất — đợt 2 (cần số đo prod trước khi làm)

- [ ] Owner: `npm run build && npm start`, chạy Lighthouse mobile cho `/home`, `/products/[slug]`, `/bao-gia`, 1 công cụ 3D, `/basaadmin/dashboard`.
- [ ] `ANALYZE=true` / `@next/bundle-analyzer` cho `/bao-gia` (5.6 MB JS ở dev) — tìm chunk lớn nhất rồi mới tách.
- [ ] Nếu `/basaadmin/product-inventory` vẫn > 1 s TTFB trên prod: gộp `listStockTrackedVariants` vào truy vấn tồn kho (đang query 2 lần `inventory_movements`).

## Definition of Done

- [x] `npm run lint` · `npm run typecheck` · `npm run check:arch` xanh
- [x] Unit test mới chạy xanh (các test cần DB/Supabase sẽ skip/fail trong sandbox như baseline trong PROGRESS)
- [x] `PROGRESS.md` cập nhật; commit atomic trên branch, **không push / không merge**
- [ ] Owner: chạy migration UAT, `npm run build`, smoke `/products?q=`, tạo sản phẩm, `/bao-gia`

## Evidence log

**Vòng 2 (2026-11-24):** tsc (src/tests/e2e/scripts) 0 lỗi · eslint file đổi 0 lỗi · check:arch ✅ · `tests/qa-audit-perf.test.ts` 6/6 + `qa-audit-2026-11-24` 17/17 + `phase-42` pass · full `tests/*.test.ts`: 1042 test, 249 fail đều do môi trường như vòng 1 (Postgres, binary macOS, `mock.module`; `phase-41-dashboard-tabs`/`phase-28-dashboard-role` lỗi import `requireOwner` từ commit trước đó, không do branch này).


2026-11-24 — sandbox Linux arm64 (node_modules cài trên macOS nên dùng esbuild linux tạm qua `ESBUILD_BINARY_PATH`; không build được Next, không có Postgres/Supabase):

- **Lint:** `eslint` trên 43 file đổi/thêm → 0 lỗi.
- **Typecheck:** `tsc --noEmit` trên `src/ tests/ e2e/ scripts/stl-import/ netlify/` → 0 lỗi. 114 lỗi còn lại đều nằm trong `.next-test/types/` (artefact build cũ, gitignored, đã có từ trước).
- **check:arch:** ✅ 6 rules passed.
- **Unit tests:** `tests/qa-audit-2026-11-24.test.ts` 17/17 pass. `phase-42-storefront-cache` cập nhật kỳ vọng `analytics={false}` → pass. Toàn bộ `tests/*.test.ts` (1036 test): 249 fail, tất cả do môi trường (Postgres `127.0.0.1:5432` không có, esbuild/@parcel/watcher bản macOS, `mock.module` khi chạy song song). Không có lỗi assertion nào liên quan tới thay đổi của branch này.
- **Chưa làm (Owner trên macOS):** `npm run check:agent` đầy đủ với DB test, `npm run build`, Playwright E2E, `npm run db:check-migrations` trên UAT.
- **Đính chính QA-004:** budget chống dò đã có sẵn; branch này chỉ thêm thông báo khi bị khoá.
