# Review Claude — hiệu năng và UX admin (đối chiếu độc lập) — 2026-09-07

## Verdict: NEEDS DECISIONS

Không BLOCKED — không có rủi ro data integrity/authorization nào bị phát hiện, và một
tập con các sửa đổi (tách query badge, chạy song song 2 khối dashboard, thêm
pagination, error boundary, pending-state form, xác nhận hủy expense, sửa 2 bug hiển
thị nhỏ) đủ rõ ràng để triển khai ngay mà không cần đo thêm.

Không READY FOR HANDOFF vì còn 3 loại quyết định Owner/implementer phải chốt trước
khi viết prompt Codex:
1. Chưa có phiên đăng nhập/môi trường để đo thời gian thực trên production build —
   báo cáo của Codex và báo cáo này đều chỉ là bằng chứng cấu trúc trong code, chưa
   phải số đo. Cần chạy protocol đo (mục "Kế hoạch đo" bên dưới) trước khi chốt ngân
   sách latency.
2. Một số nghi vấn SQL (per-variant correlated subquery, `created_at::date`,
   `date_trunc`) cần `EXPLAIN ANALYZE` trên dataset thật trước khi quyết định có viết
   lại hay thêm index hay không — viết lại mù quáng có rủi ro đổi hành vi date-boundary
   (múi giờ) nếu không cẩn thận.
3. Danh sách CRUD còn thiếu (sửa/xóa danh mục, sửa nhân viên, sửa custom request, xóa
   blog) là có thật nhưng cố tình **không** đưa vào phase hiệu năng đầu tiên; Owner cần
   xác nhận thứ tự ưu tiên cho một phase riêng.

## Bảng kiểm chứng các phát hiện của Codex

| # | Phát hiện của Codex | Kết quả kiểm chứng | Ghi chú |
| - | --- | --- | --- |
| 1 | Layout gọi `getOperationalMetrics()` chỉ để lấy 3 badge, tốn ~12 SQL | **CONFIRMED** | `layout.tsx:13` gọi full metrics, chỉ dùng `pendingOrders/customRequestsOpen/printJobsActive` (`layout.tsx:18-22`). Đếm được đúng 12 câu SQL trong `getOperationalMetrics` (`dashboard.service.ts:162-198`, xem chi tiết bên dưới). `cache()` (`dashboard.service.ts:162`) chỉ dedupe trong 1 request (layout + dashboard page dùng chung 1 lần gọi khi cùng render), không dedupe qua các lần điều hướng — đúng như comment tại `layout.tsx:11-12` đã ghi. |
| 2 | Hai nơi gọi `getUser()` | **CONFIRMED, chưa đo chi phí** | `middleware.ts:30` và `require-admin.ts:24-28` (`requireAdmin`, bọc `cache()`) đều gọi `auth.getUser()` — 2 round-trip mạng riêng biệt tới Supabase Auth mỗi request. `cache()` chỉ dedupe các lần `requireAdmin()` gọi lại trong cùng request (layout + page), không dedupe với middleware. Chưa đo được request này tốn bao nhiêu ms vì thiếu môi trường có phiên đăng nhập. |
| 3 | Dashboard await operational rồi financial, không song song | **CONFIRMED** | `dashboard/page.tsx:19-21`: 3 await tuần tự — `requireAdmin()` → `getOperationalMetrics()` → (nếu OWNER) `getFinancialMetrics()`. Không `Promise.all`, không `Suspense`. `getFinancialMetrics()` không phụ thuộc output của `getOperationalMetrics()` — chỉ phụ thuộc `role` từ `requireAdmin()` — nên gộp song song được mà không đổi hành vi dữ liệu. |
| 4 | Filter dùng `<a>` thay vì `Link`, do lỗi soft-navigation production | **CONFIRMED, có ghi chú rõ ràng trong code** | `status-filter-tabs.tsx:10-18` có comment dài giải thích: xác nhận qua browser thật trên production build (Phase 11 closing review, 2026-09-03), lỗi chỉ tái hiện ở `next build && next start`, không tái hiện ở `next dev`, root cause là App Router soft-navigation, đã thử tắt prefetch. Đây là workaround có chủ đích, có bằng chứng ghi lại — **không đổi sang `Link` trong phase này** theo đúng ràng buộc của Owner; muốn đổi phải tái hiện lỗi gốc và có bằng chứng đã hết trước. |
| 5 | Orders/print-jobs/products giới hạn 100 dòng, không pagination | **CONFIRMED, và rộng hơn Codex đã nêu** | `limit: 100` tại `orders/page.tsx:20`, `print-jobs/page.tsx:21`, `products/page.tsx:16`, `custom-requests/page.tsx:24`, `blog/page.tsx:14`, `audit-logs/page.tsx:10`. Không page nào đọc `searchParams.page`. **Materials** yêu cầu `limit: 200` (`materials/page.tsx:46`) nhưng bị `pagination()` helper dùng chung (`product.service.ts:13` `MAX_PAGE_SIZE = 100`) kẹp về 100 — cùng giới hạn. Danh mục sản phẩm dùng trong dropdown tạo sản phẩm cũng qua `listCategories({ limit: 100 })` (`products/page.tsx`) — rủi ro tương tự nếu số danh mục vượt 100 (hiện tại rất khó xảy ra). Dropdown `materialId`/`warehouseId` trên trang kho nhựa **không** bị giới hạn (không gọi `limit`). |
| — | (Phát hiện mới, Codex chưa nêu) | **CONFIRMED — bug lọc client-side sau khi đã cắt 100 dòng** | `materials/page.tsx:48`: `warningTier` được lọc **sau khi** SQL đã giới hạn 100 dòng (`allSpools.filter(...)`). Một cuộn khớp `warningTier` đang chọn nhưng nằm ngoài 100 dòng đầu sẽ biến mất khỏi kết quả lọc mà không có dấu hiệu nào — nặng hơn "chưa có pagination", vì filter tưởng như hoạt động đúng nhưng âm thầm bỏ sót dữ liệu. |
| 6 | Filter/pagination cho query ngày/tháng, stock aggregate, pool, payload | **CONFIRMED cấu trúc, chưa đo** | `created_at::date` tại `dashboard.service.ts:65,78,167,203`; `date_trunc('month', created_at)` tại `dashboard.service.ts:204`. Stock ở dashboard là 2 subquery tương quan (correlated) theo từng `product_variant` đang active (`dashboard.service.ts:173-179`, quote SQL ở dưới) — cấu trúc N-lần-subquery-per-row, không phải 1 join tổng hợp. Chưa chạy `EXPLAIN`; không kết luận full scan hay cần index. |
| 7 | Loading hiện có có che layout chậm không? | **CONFIRMED — không che được** | `admin/(protected)/loading.tsx` tồn tại (skeleton chung), nhưng nó là `loading.tsx` của segment `(protected)` — bọc Suspense quanh `children`/page, **không** bọc chính `layout.tsx` của cùng segment. Layout phải resolve xong (2 lần `getUser()` + 12 SQL) trước khi React chạm tới boundary hiển thị `loading.tsx`. Vậy nguyên nhân "cảm giác treo" khi điều hướng nằm ở layout, không phải thiếu loading UI. |
| — | Nguyên nhân khác khiến bấm/lưu "không phản hồi" | **CONFIRMED — 2 nguyên nhân cụ thể, không suy đoán** | (a) Không có `error.tsx` ở bất kỳ đâu trong `src/app` (kể cả admin) — xác nhận bằng `find`, 0 kết quả. (b) Ngoại trừ 2 form trong `materials/actions.ts` (dùng `safeParse` + try/catch + trả `{ error }`, tiêu thụ qua `useActionState` ở `spool-edit-form.tsx`/`confirmed-action-form.tsx`), **mọi** action khác (`orders`, `custom-requests`, `products`, `expenses`, `print-jobs`, `staff`, `blog`) gọi `schema.parse()` trực tiếp không try/catch, và nút submit tương ứng (`orders/[id]/page.tsx:125,159`, v.v.) không có `disabled`/spinner khi pending. Kết quả: một lỗi validation/nghiệp vụ bình thường (vd sai định dạng, chuyển trạng thái không hợp lệ) sẽ ném lỗi lên tới trang lỗi mặc định của Next.js thay vì hiển thị tại chỗ — cảm giác "treo" hoặc "vỡ trang", không phải do bị chậm. |
| 8 | Badge và danh sách có cập nhật đúng sau mutation không | **REFUTED (không phải bug) — nhưng khác cơ chế Codex nghĩ** | Các action đều gọi `revalidatePath` đúng path (`orders/actions.ts:17-18`, `custom-requests/actions.ts:41-42,81`, `print-jobs/actions.ts:20,27,37`). Badge trong layout **không dùng cache theo request** (không `unstable_cache`/`revalidateTag`) — nó tính lại từ đầu ở mọi lần điều hướng (đúng như comment `layout.tsx:11-12`), nên tự động luôn mới mà không cần cơ chế invalidation riêng. Không tìm thấy trường hợp badge/list lệch nhau trong code hiện tại. |
| 9 | Giá 0 hiển thị "—" | **CONFIRMED** | `products/page.tsx:123`: `{product.basePrice ? ... : '—'}` — truthy-check, không phải `!= null`. Giá hợp lệ bằng 0 hiển thị "—" giống chưa có giá. Chỉ ảnh hưởng trang danh sách; trang chi tiết dùng `defaultValue`, không bị lỗi này. |
| — | (Phát hiện mới) Badge/trạng thái hiện raw enum dù đã có label tiếng Việt | **CONFIRMED — bug cụ thể, sửa rẻ** | `orders/[id]/page.tsx:15-20` định nghĩa `ORDER_STATUSES` với `label` tiếng Việt ("Mới", "Đã xác nhận", ...) nhưng dòng 40 (`<Badge>{order.status}</Badge>`) và dòng 121 (`<option value={candidate}>{candidate}</option>`) đều in thẳng giá trị enum thô (`NEW`, `PRODUCING`...) thay vì tra `label`. Mapping tiếng Việt đã tồn tại sẵn trong cùng file, chỉ chưa được dùng ở 2 chỗ hiển thị — không cần thiết kế mapping mới. |
| 10 | Danh sách trước form tạo | **CONFIRMED — form trước, đúng như Codex nêu** | `products/page.tsx`: form tạo sản phẩm + `PricingCalculatorPanel` (dòng 29-81) → form tạo danh mục (91-101) → bảng danh sách (108+). Người tìm/sửa sản phẩm phải cuộn qua 2 form dài trước khi thấy danh sách. |
| 11 | Sidebar không responsive | **CONFIRMED** | `admin-nav.tsx:46`: `className="flex w-56 shrink-0 ..."`, không có class `md:`/`lg:`/`hidden`, không state đóng/mở, không có nav mobile thay thế nào. |
| 12 | Việc in hiển thị UUID dài | **CONFIRMED** | `print-jobs/page.tsx:47`: `<Link href=... >{job.id}</Link>` — in thẳng UUID đầy đủ làm text link, không có mã ngắn/rút gọn. |
| 13 | Pagination cần ID làm tie-breaker | **CONFIRMED là rủi ro có thật khi thêm pagination** | Mọi query danh sách hiện dùng `order by created_at desc limit ... offset ...` không có tie-breaker (`order.service.ts:173`, `print-job.service.ts:23`, `product.service.ts:52`). Nếu 2 dòng cùng `created_at` (có thể xảy ra, cột không unique), phân trang offset có thể bỏ sót hoặc lặp dòng ở ranh giới trang — phải thêm `, id` vào `ORDER BY` khi làm pagination thật, không phải chỉ thêm `LIMIT/OFFSET`. |

## Đối chiếu backlog `admin-actions-review.md`

| Mục | Trạng thái hiện tại | Bằng chứng |
| --- | --- | --- |
| Kho nhựa: sửa mã/lõi/ghi chú, lưu trữ/khôi phục | **ĐÃ LÀM XONG** (thay đổi chưa commit) | `spool-edit-form.tsx` (safeParse + `useActionState`, wired qua `materials/[id]/page.tsx:52`); archive/restore qua `ConfirmedActionForm` + `setFilamentSpoolStatusAction` (`materials/[id]/page.tsx:58`, `materials/page.tsx:188`); có error handling thật (`materials/actions.ts:42-62`). |
| Sửa/xóa danh mục sản phẩm | **CÒN THIẾU** | `products/actions.ts` chỉ có `createCategoryAction` (52-61); UI danh mục chỉ hiện `<Badge>` tĩnh (`products/page.tsx:89`), không có nút sửa/xóa. |
| Sửa thông tin nhân viên | **CÒN THIẾU** | `staff/actions.ts` chỉ có `createStaffAction`, `setStaffActiveAction` (bật/tắt); không có action đổi tên/role/email. Không tìm thấy link "Sửa" trong `staff/page.tsx`. |
| Sửa thông tin yêu cầu in nhập nhầm | **CÒN THIẾU** | `custom-requests/actions.ts` chỉ có create/status/quote; `custom-requests/[id]/page.tsx:74-92` hiện tên/SĐT/email/mô tả dạng `<p>` chỉ đọc, không có form sửa. |
| Xác nhận trước khi hủy khoản chi | **CÒN THIẾU — dù component đã có sẵn** | `ConfirmedActionForm` đã tồn tại và đang dùng cho kho nhựa, nhưng nút "Hủy" ở `expenses/page.tsx:160-161` vẫn là `<form>` trần, không bọc `ConfirmedActionForm`, không `window.confirm` — bấm là hủy ngay. Đây là việc nối lại component có sẵn, không phải thiết kế mới. |
| Xóa bài blog; sửa/xóa danh mục blog | **CÒN THIẾU** | `blog/actions.ts` có create/update post nhưng không có action xóa post, không có update/delete category. |
| Nút hủy đơn/việc in rõ ràng hơn | **CÒN THIẾU** | `CANCELLED` chỉ là 1 option trong cùng `<select>` chuyển trạng thái (`orders/[id]/page.tsx:118-125`), không có nút riêng, không xác nhận, không phân biệt hình ảnh. |

## Đường đi hiệu năng — tóm tắt nguyên nhân có bằng chứng

1. Mọi trang admin (không chỉ dashboard) hiện phải chờ layout chạy xong đúng 12 câu SQL
   của `getOperationalMetrics()` (dashboard trend 14 ngày, production/custom-request
   pipeline, material health, actionable items...) chỉ để lấy 3 số badge — chạy lại từ
   đầu ở **mọi lần điều hướng** vì `cache()` không sống qua request khác.
2. Layout thực thi trước khi bất kỳ `loading.tsx` nào có thể hiển thị, nên toàn bộ chi
   phí trên (cộng thêm `getUser()` riêng trong `requireAdmin()`, ngoài `getUser()` của
   middleware) là khoảng "trắng màn hình" thật sự, không được che.
3. Dashboard page cộng thêm hai lần `await` tuần tự (operational rồi financial) dù hai
   khối dữ liệu độc lập.
4. Ở tầng UX, không có `error.tsx` và (trừ kho nhựa) không có pending-state trên form —
   nên một lỗi nghiệp vụ bình thường (không phải chậm) cũng tạo cảm giác "bấm không ăn"
   giống hệt triệu chứng chậm mà Owner mô tả. Đây là nguyên nhân **UX** riêng, không
   phải hiệu năng, nhưng cùng tạo cảm giác lag khi dùng hàng ngày.

Chưa đo được: chi phí thực (ms) của 2 lệnh `getUser()`, chi phí thực của 12 câu SQL trên
dataset thật, và effect thực của per-variant correlated subquery khi số variant lớn.
Không có phiên đăng nhập/production build server để tôi chạy đo trong đợt review này.

## Thiết kế tối thiểu đề xuất (Phase đầu — không tăng phạm vi ngoài hiệu năng + tìm-sửa)

- **Tách badge khỏi full metrics**: thêm hàm nhỏ (vd `getAdminNavBadges()`) trong
  `dashboard.service.ts` chỉ chạy 3 câu count hiện có (`pendingOrders`,
  `customRequestsOpen`, `printJobsActive`), gọi từ `layout.tsx` thay cho
  `getOperationalMetrics()`. Dashboard page vẫn gọi `getOperationalMetrics()` đầy đủ
  như cũ (không đổi hành vi dashboard). Trade-off: 3 câu count bị định nghĩa ở 2 nơi
  (badge + phần đầu của full metrics) — chấp nhận trùng lặp nhỏ để đổi giảm ~9 câu SQL
  không cần thiết trên mọi trang không phải dashboard; chi phí migration thấp, khoanh
  vùng trong 1 file + 1 layout.
- **Song song hai khối dashboard**: đổi 2 `await` tuần tự (`getOperationalMetrics()`,
  `getFinancialMetrics()`) thành `Promise.all` sau khi đã biết `role`. Không đổi dữ
  liệu trả về, không đổi authorization (financial vẫn chỉ gọi khi `role === 'OWNER'`).
  Streaming/Suspense theo từng khối dashboard (tách thành async child component riêng)
  để lại cho phase sau — invasive hơn, cần tách UI, không cần thiết để đạt lợi ích
  chính của việc gộp song song.
- **Pagination/search cho orders, print-jobs, products, custom-requests, materials**:
  thêm `page` (và giữ `filter`) trong `searchParams`, giảm page size mặc định xuống
  20–25, thêm `ORDER BY ..., id` để tie-breaker ổn định, giữ filter khi chuyển trang
  (query string), nút Trước/Sau hoặc số trang đơn giản (không cần thư viện mới — dùng
  `Link` với query string, không phải `<a>` như filter tabs vì đây không phải cùng
  route đang gặp lỗi soft-nav đã ghi nhận). Sửa kèm bug lọc `warningTier` sau khi cắt
  100 dòng ở materials (chuyển lọc vào SQL trước `LIMIT`, hoặc tăng limit hợp lý rồi
  lọc — chọn cách nào cần EXPLAIN nhẹ để không kéo toàn bảng).
- **Error boundary + pending-state form theo domain**: thêm 1 `error.tsx` ở
  `admin/(protected)/` làm lưới an toàn chung. Nhân rộng pattern đã có sẵn và đã chứng
  minh hoạt động (`safeParse` + try/catch + trả `{ error }`, tiêu thụ qua
  `useActionState`, đang dùng cho kho nhựa) sang orders/custom-requests/print-jobs
  trước (các domain có nhiều thao tác chuyển trạng thái nhất); products/expenses/staff/
  blog có thể theo sau nếu còn ngân sách phase. Cân nhắc rút pattern này thành 1 helper
  dùng chung sau khi áp dụng lần thứ 2 (không làm trừu tượng trước khi có 2 nơi dùng
  thật, theo AGENTS.md rule #8).
- **Nối lại `ConfirmedActionForm` cho hủy khoản chi**: đổi `<form>` trần ở
  `expenses/page.tsx:160-161` sang bọc `ConfirmedActionForm` — tái dùng component có
  sẵn, không viết mới.
- **2 bug hiển thị rẻ**: `basePrice` đổi truthy-check sang `!= null`
  (`products/page.tsx:123`); order status Badge/option dùng `label` tiếng Việt đã có
  sẵn trong `ORDER_STATUSES` thay vì in raw enum (`orders/[id]/page.tsx:40,121`) — áp
  dụng tương tự cho `print-jobs`/`custom-requests` nếu cùng pattern (cần kiểm tra khi
  implement, chưa xác nhận các file đó có cùng bug).
- **Không đổi** trong phase đầu: `status-filter-tabs.tsx` giữ nguyên `<a>` (constraint
  Owner); không thêm index/rewrite SQL dashboard cho tới khi có `EXPLAIN` trên dataset
  thật; không đổi middleware/`requireAdmin()` auth flow.

## UX đề xuất cho các tác vụ hàng ngày (mô tả before/after, tận dụng shadcn hiện có)

**Tìm đơn → xử lý đơn** — Before: vào `/admin/orders`, tối đa 100 dòng mới nhất, không
tìm theo mã/tên khách, chuyển trạng thái qua 1 `<select>` chung lẫn với "hủy". After:
thêm ô tìm theo `order_number`/tên khách (search param riêng, SQL `ILIKE`, không cần
full-text search engine); giữ `filter` hiện có khi chuyển trang; nút "Hủy đơn" tách
riêng màu cảnh báo (`variant="destructive"`) bọc `ConfirmedActionForm`, tách khỏi
`<select>` chuyển trạng thái tiến.

**Nhận yêu cầu → báo giá → việc in** — Before: `custom-requests/[id]` chỉ đọc thông tin
khách, không sửa được khi nhập nhầm; việc in hiện UUID dài. After (nằm ngoài phase hiệu
năng, ghi nhận cho phase CRUD riêng): thêm form sửa thông tin liên hệ có audit; việc in
hiện `job.id.slice(0, 8)` kèm tooltip/link để vẫn truy được ID đầy đủ khi cần.

**Tra cứu kho nhựa** — Đã có sửa metadata + archive/restore (uncommitted). Việc còn lại
thuộc phase hiệu năng: sửa bug lọc `warningTier` sau cắt trang, thêm pagination cho khi
số cuộn vượt 100.

**Tìm/sửa sản phẩm** — Before: form tạo + pricing calculator + form danh mục đứng trước
bảng danh sách, phải cuộn qua ~80 dòng form mới tới danh sách. After: đưa bảng danh sách
lên đầu trang (kèm tìm theo tên/SKU), chuyển form tạo sản phẩm sang route/drawer riêng
(`/admin/products/new`) — tái dùng `PricingCalculatorPanel` y nguyên, chỉ đổi vị trí
render, không đổi logic tính giá.

**Sidebar responsive** — Before: `w-56` cố định, không có nav mobile. After: thêm
`hidden md:flex` cho sidebar hiện tại + 1 nút hamburger (icon có sẵn từ `lucide-react`)
mở `Sheet`/`Drawer` từ shadcn (đã có trong stack) chứa cùng `NAV_ITEMS` — không thêm
dependency mới, không redesign token/màu.

## Kế hoạch đo (khi có môi trường/phiên đăng nhập)

1. Build production thật (`next build && next start`), dataset rõ ràng (ghi số lượng
   orders/products/print-jobs/spools dùng để đo).
2. Với mỗi trang (dashboard, orders, products, materials, print-jobs): đo (a) direct
   load (gõ URL mới), (b) soft navigation từ trang khác, (c) đổi filter, (d) cold run
   (server vừa start) và warm run (đã chạy vài request) — ghi riêng TTFB, để tách được
   phần do middleware/auth khỏi phần do SQL/render nếu công cụ đo cho phép (vd
   `server-timing` header tạm thời chỉ trong môi trường đo, không commit vào production).
3. Đo riêng 2 lệnh `getUser()` (middleware vs `requireAdmin()`) bằng log thời gian tạm
   thời hoặc APM có sẵn, không đoán.
4. Chạy `EXPLAIN ANALYZE` cho câu stock correlated subquery (`dashboard.service.ts:173-179`)
   và 2 câu trend (`created_at::date`/`date_trunc`) trên dataset production-like.
5. Chốt ngân sách p50/p95 sau khi có số đo bước 1-2; không đặt số trước.

## Những kiểm tra đã chạy trong đợt review này

- Đọc trực tiếp toàn bộ code liên quan (không chỉ theo báo cáo cũ): `middleware.ts`,
  `require-admin.ts`, `layout.tsx`, `dashboard.service.ts`, `dashboard/page.tsx`,
  `status-filter-tabs.tsx`, actions/pages của orders/print-jobs/products/custom-requests/
  expenses/materials/staff/blog, `admin-nav.tsx`, `e2e/admin.spec.ts`.
- `grep`/`find` xác nhận: không có `error.tsx` nào trong `src/app`; các file `limit: 100`;
  các `ORDER BY` không có tie-breaker; `try {` chỉ xuất hiện trong `materials/actions.ts`.
- Không chạy lint/typecheck/test mới trong đợt này (không sửa code); kết quả
  `npm run typecheck` trong `admin-performance-ux-review.md` là lịch sử của lần review
  trước, không phải kết quả của đợt này.
- **Không** chạy: đo browser thật, `EXPLAIN`, integration/E2E trên DB test riêng, bất kỳ
  mutation nào vào dữ liệu.

## Hạn chế bằng chứng

- Không có phiên đăng nhập admin hoặc production server để đo runtime thật — mọi kết
  luận về "chậm" ở trên là bằng chứng cấu trúc (số câu SQL, số lần await tuần tự, thiếu
  Suspense), chưa phải số đo.
- Không biết index thực tế trên `orders.created_at`, `product_variants.id`,
  `inventory_movements.product_variant_id` — không đưa ra khuyến nghị thêm/bỏ index.
- Không xác nhận double-submit đã từng gây ghi trùng dữ liệu thật; chỉ xác nhận thiếu
  pending-state khiến double-click về mặt lý thuyết có thể xảy ra ở phần lớn form.

## Câu hỏi Owner cần trả lời

1. Owner có thể cấp một phiên đăng nhập admin + production build (hoặc staging tương tự)
   để đo runtime thật trước khi implementer viết code tối ưu SQL không? Nếu không, phase
   đầu chỉ nên làm các sửa cấu trúc "chắc chắn đúng hướng" (mục Thiết kế tối thiểu) và
   hoãn phần SQL/index sang phase sau có đo.
2. Việc CRUD còn thiếu (sửa/xóa danh mục, sửa nhân viên, sửa custom request, xóa blog)
   có nên tách thành 1 phase riêng ngay sau phase hiệu năng, hay xếp sau các phase khác
   trong roadmap? Prompt review không cho phép tôi tự quyết định thứ tự này.
3. Bug lọc `warningTier` sau khi cắt 100 dòng ở kho nhựa — có cần Owner xác nhận đây là
   nghiêm trọng để ưu tiên sửa cùng đợt pagination, hay xử lý riêng gấp hơn vì đang âm
   thầm giấu dữ liệu ngay cả trước khi làm pagination?

Xem thêm execution plan dự thảo: `docs/exec-plans/active/phase-28-admin-performance-ux.md`.
