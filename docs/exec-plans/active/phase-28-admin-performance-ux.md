# Phase 28 — Admin performance & findability

**Status: IMPLEMENTED — VERIFICATION PENDING (2026-09-08).** Slice 1–5 đã có code;
integration/E2E/RBAC thực và production build còn chờ môi trường test local.
Chưa đóng phase hoặc đánh dấu toàn bộ acceptance đạt. Chi tiết:
`docs/operations/phase-28-implementation-review.md`.

Owner đã chốt 2026-09-07: chưa có môi trường đo baseline
thật (hoãn EXPLAIN/rewrite SQL/index sang phase đo riêng sau); sidebar responsive tách
phase UX riêng, không gộp vào phase này. Xem
`docs/operations/admin-performance-ux-claude-review.md` cho bằng chứng đầy đủ.

## Brief

Owner phản ánh khu admin chậm và khó tìm bản ghi khi dữ liệu tăng. Review độc lập
(Claude, đối chiếu báo cáo Codex) xác nhận: layout admin chạy 12 câu SQL của
`getOperationalMetrics()` chỉ để lấy 3 badge, chạy lại ở mọi lần điều hướng; dashboard
chờ tuần tự 2 khối dữ liệu độc lập; orders/print-jobs/products/custom-requests/materials
giới hạn cứng 100 dòng không có trang tiếp theo; không có `error.tsx` và (trừ kho nhựa)
không có pending-state form, khiến lỗi nghiệp vụ bình thường trông giống "treo máy".
Phase này chỉ xử lý hiệu năng cấu trúc + khả năng tìm bản ghi + polish UX tối thiểu đi
kèm; không mở lại CRUD còn thiếu (category/staff/custom-request edit, blog delete) —
việc đó chờ quyết định Owner về một phase riêng.

- **Goal**: giảm truy vấn thừa trên mọi trang admin, làm được hàng thứ 101 trở đi truy
  cập được, và loại bỏ cảm giác "không phản hồi" khi submit form do thiếu error
  boundary/pending state.
- **Non-goals**: đổi state machine/tiền/snapshot/ledger; đổi `status-filter-tabs.tsx`
  sang `Link` (constraint Owner, xem review); thêm index/rewrite SQL dashboard mà chưa
  có `EXPLAIN`; CRUD còn thiếu trong `admin-actions-review.md` (trừ nối lại
  `ConfirmedActionForm` cho hủy expense, vì component đã có sẵn và rẻ); redesign UI
  toàn bộ hoặc thêm dependency ngoài shadcn/lucide đã dùng.
- **Inputs**: `docs/operations/admin-performance-ux-review.md`,
  `docs/operations/admin-performance-ux-claude-review.md`, code hiện tại (kể cả thay đổi
  chưa commit ở kho nhựa).
- **Outputs**: badge tách khỏi full metrics; dashboard 2 khối song song; pagination có
  tie-breaker cho 5 danh sách; 1 `error.tsx` chung; pending-state form nhân rộng cho
  orders/custom-requests/print-jobs; sửa bug lọc `warningTier` sau cắt trang; nối
  `ConfirmedActionForm` cho hủy expense; sửa 2 bug hiển thị (`basePrice`, order status
  label).
- **Risks**: sai `ORDER BY` tie-breaker gây lặp/bỏ sót dòng ở ranh giới trang nếu quên
  thêm `id`; đổi service pagination có thể ảnh hưởng nơi khác đang gọi cùng hàm (kiểm
  tra mọi call site trước khi đổi signature); tách badge query có thể lệch số nếu không
  copy đúng điều kiện WHERE từ bản gốc.
- **Definition of Done**: mọi acceptance criteria bên dưới có test xanh; typecheck/lint/
  unit pass; E2E mới cho pagination + cancel-confirm chạy trên Supabase local test riêng
  (không phải DB app); không có authorization regression (Phase 14 route-auth test vẫn
  pass nguyên trạng).

## Scope — slices theo ưu tiên

### Slice 1 — Tách badge khỏi full dashboard metrics
- File dự kiến: `src/services/dashboard.service.ts` (thêm `getAdminNavBadges()`),
  `src/app/admin/(protected)/layout.tsx` (gọi hàm mới thay vì `getOperationalMetrics()`).
- Không đổi `getOperationalMetrics()`/`dashboard/page.tsx`.

### Slice 2 — Song song 2 khối dashboard
- File dự kiến: `src/app/admin/(protected)/dashboard/page.tsx` — đổi 2 `await` tuần tự
  (`getOperationalMetrics`, `getFinancialMetrics`) thành `Promise.all` sau khi có `role`.

### Slice 3 — Pagination + tie-breaker cho orders/print-jobs/products/custom-requests/materials
- File dự kiến: `src/services/{order,print-job,product,filament}.service.ts` (thêm
  `, id` vào `ORDER BY`, giữ `limit/offset` hiện có, giảm default page size xuống
  20–25), các `page.tsx` tương ứng (đọc `searchParams.page`, giữ `filter` khi đổi
  trang, UI Trước/Sau bằng `Link` + query string).
- Sửa kèm: `materials/page.tsx` — chuyển lọc `warningTier` vào SQL (hoặc trước khi cắt
  `LIMIT`) thay vì lọc JS sau khi đã cắt 100 dòng.

### Slice 4 — Error boundary + pending-state form (orders, custom-requests, print-jobs)
- File dự kiến: `src/app/admin/(protected)/error.tsx` (mới).
- `src/app/admin/(protected)/{orders,custom-requests,print-jobs}/actions.ts` — áp dụng
  lại pattern đã chứng minh ở `materials/actions.ts` (`safeParse` + try/catch + trả
  `{ error }`).
- Các form tương ứng — đổi sang client component nhỏ dùng `useActionState`, disable nút
  submit khi pending, giữ input sau lỗi (theo mẫu `spool-edit-form.tsx`).

### Slice 5 — Polish rẻ
- `expenses/page.tsx` — bọc nút "Hủy" bằng `ConfirmedActionForm` có sẵn.
- `products/page.tsx:123` — `basePrice != null` thay vì truthy-check.
- `orders/[id]/page.tsx:40,121` — dùng `label` có sẵn trong `ORDER_STATUSES` thay vì in
  raw enum; kiểm tra `print-jobs`/`custom-requests` có cùng pattern khi implement.

### Không nằm trong phase này (phase sau, hoặc chờ Owner quyết)
- Suspense/streaming từng khối dashboard riêng (invasive hơn Promise.all, không cần để
  đạt lợi ích chính).
- Sidebar responsive (mobile drawer) — UX polish độc lập, có thể làm cùng phase này nếu
  còn ngân sách nhưng không phải blocker cho DoD hiệu năng; liệt kê là optional slice 6
  nếu Owner muốn gộp.
- EXPLAIN-driven rewrite của dashboard SQL (correlated subquery, `date_trunc`) — chờ đo.
- Đổi `status-filter-tabs.tsx` sang `Link` — chờ owner + tái hiện lỗi gốc riêng.
- CRUD còn thiếu (category/staff/custom-request edit, blog delete) — phase riêng, chờ
  Owner xác nhận thứ tự roadmap.

## Acceptance criteria

- [ ] Vào bất kỳ trang admin nào (không phải dashboard) chỉ chạy 3 câu count cho badge,
      không chạy 12 câu của `getOperationalMetrics()` — kiểm bằng query log/test đếm số
      lệnh SQL trong 1 request.
- [ ] STAFF vẫn không thấy financial metrics; OWNER thấy đủ cả hai khối dashboard —
      kiểm bằng test RBAC hiện có (Phase 14 test suite) không đỏ, cộng 1 test mới xác
      nhận dashboard trả về đúng dữ liệu cho từng role sau khi đổi sang `Promise.all`.
- [ ] Truy cập được bản ghi thứ 101 trở lên ở mỗi danh sách (orders, print-jobs,
      products, custom-requests, materials) qua điều khiển trang trên production build —
      test tạo > 100 bản ghi trên DB test riêng, xác nhận `page=2`/`page=3` trả đúng
      dòng, không lặp/không bỏ sót ở ranh giới trang.
- [ ] Filter + trang + back/forward/refresh hoạt động đúng trên production build: đổi
      filter, sang trang 2, back trình duyệt, refresh — filter và trang được giữ qua URL.
- [ ] `warningTier` filter ở kho nhựa không bỏ sót spool nằm ngoài 100 dòng đầu sau khi
      sửa (test: tạo > 100 spool, 1 spool khớp tier nằm ở vị trí > 100, xác nhận vẫn
      xuất hiện trong kết quả lọc).
- [ ] Form orders/custom-requests/print-jobs: lỗi validation/nghiệp vụ hiển thị tại chỗ
      (không văng ra trang lỗi mặc định), input được giữ nguyên sau lỗi, nút submit
      disable khi pending — test Playwright submit input không hợp lệ, xác nhận thông
      báo lỗi tại form và giá trị input còn nguyên.
- [ ] Hủy khoản chi yêu cầu xác nhận trước khi thực hiện (không hủy ngay khi bấm 1 lần).
- [ ] Giá sản phẩm bằng 0 hiển thị "0đ", không hiển thị "—".
- [ ] Badge/trạng thái đơn hiển thị nhãn tiếng Việt nhất quán, không còn giá trị enum
      thô ở Badge/option đã có sẵn `label`.
- [ ] Không authorization regression: toàn bộ `tests/phase-3-route-auth.test.ts` (Phase
      14 baseline) vẫn pass nguyên trạng sau mọi thay đổi của phase này.
Sidebar responsive không nằm trong phase 28 (Owner đã chốt tách phase riêng) — không có
acceptance criterion viewport nhỏ trong phase này.

## Test matrix

| Loại | Phạm vi | Môi trường |
| --- | --- | --- |
| Unit | `getAdminNavBadges()` trả đúng 3 số, không gọi các hàm pipeline/trend | local, không cần DB |
| Integration | Pagination + tie-breaker (>100 bản ghi mỗi bảng), RBAC dashboard sau `Promise.all`, `warningTier` filter sau sửa | Supabase/Postgres test riêng, disposable (`tests/helpers/test-environment.ts`) |
| E2E | Submit lỗi hiển thị tại chỗ + giữ input; hủy expense có xác nhận; chuyển trang giữ filter qua back/refresh trên production build | Supabase local test riêng, `next build && next start` |
| Regression | `tests/phase-3-route-auth.test.ts` (RBAC), `e2e/admin.spec.ts` hiện có (product create/update, inventory movement) | như hiện có |

## Kế hoạch đo hiệu năng (đi kèm, không phải acceptance cứng)

Trước khi chốt số liệu tuyệt đối: chạy protocol đo ở
`admin-performance-ux-claude-review.md` (mục "Kế hoạch đo") trên production build với
dataset production-like, tách TTFB/auth/SQL/render theo khả năng công cụ đo cho phép.
Chỉ sau khi có baseline mới đặt ngân sách p50/p95 — không hứa số trước.

## Trước khi giao Codex

- [x] Owner xác nhận (2026-09-07): chưa cấp được phiên đăng nhập/production build để đo
      baseline — phase này chỉ làm các sửa cấu trúc chắc-đúng-hướng (Slice 1-5); EXPLAIN/
      rewrite SQL/index hoãn sang phase đo riêng sau, không nằm trong scope phase 28.
- [x] Owner xác nhận (2026-09-07): sidebar responsive tách phase UX riêng, không gộp —
      Slice 6 (tùy chọn) trong bản nháp trước đó bị loại khỏi scope phase 28.
- [x] Bug lọc `warningTier` xử lý trong Slice 3 (đã nằm sẵn trong scope, không tách gấp
      riêng vì cùng file/cùng đợt sửa pagination).
Ghi chú không chặn handoff (không phải quyết định cần chốt trước khi giao việc, chỉ để
implementer/người lập phase sau biết):
- Thứ tự phase CRUD còn thiếu (category/staff/custom-request/blog) chưa chốt — việc đó
  thuộc phạm vi phase kế tiếp, không ảnh hưởng scope/DoD của phase 28.
- Nếu implementer phát hiện tài liệu/ADR khác mô tả lý do khác cho `limit: 100`/thiếu
  pagination mà review chưa thấy, dừng và báo lại trước khi đổi service, đừng tự suy diễn.
