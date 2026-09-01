# Hardening Follow-up — Codex verification findings on D-01–D-11

> Trạng thái: **IMPLEMENTED — F-05 READY FOR CLAUDE REVIEW**
> Nguồn: Codex verification pass trên
> `docs/exec-plans/completed/phase-debate-claude-review.md` (phase đã đóng ở
> commit `c007e22`). Các mục dưới đây là gap Codex phát hiện khi đối chiếu
> code thật với 5 quyết định đã chốt (ADR-0016/0017/0019/0020/0021), đã được
> Claude re-verify độc lập bằng cách đọc trực tiếp file:line liên quan trước
> khi ghi vào đây — không lặp lại các mục D-01 đến D-11 đã pass.

## Quyết định đã chốt (OWNER, 2026-09-01)

1. **F-01 — Cơ chế phiên order-confirmation:** Signed short-lived token gắn
   vào URL redirect lúc checkout thành công (ví dụ HMAC theo `order_id` +
   thời hạn hết hạn, ~30–60 phút), không dùng cookie. Trang confirmation xác
   thực token này để trả **đầy đủ** thông tin đơn (không mask); token hết
   hạn/không hợp lệ thì rơi về đúng luồng public lookup (mask PII + xác thực
   4 số cuối SĐT) như người lạ.
2. **F-01 — Rate limiter shared store:** Chuyển sang một bảng Postgres/
   Supabase (ví dụ `rate_limit_attempts`), không thêm dependency/dịch vụ mới
   (đúng AGENTS.md rule #8). Gộp chung cho cả `orders` lookup và
   `custom-requests/attachments` upload.
3. **F-02 — Quy trình MTO thủ công:** Giữ nguyên logic hiện tại (order vào
   `PRODUCING` chỉ tự động tạo `print_jobs` rỗng; staff chủ động gán vật
   liệu/khối lượng qua `assignPrintJobMaterial()` rồi mới chuyển print job
   sang `PRINTING` để thực sự trừ kho). Không cần đổi code — chỉ sửa lại câu
   chữ ADR-0017 cho đúng thực tế 2 bước (tự động tạo job / thủ công trừ
   nguyên liệu).

## Mục đích

Đây không phải một phase mới độc lập — là phần còn thiếu của phase hardening
đã đóng, tách riêng để không tự ý sửa `phase-debate-claude-review.md` (đã
đóng) hay mở lại toàn bộ D-01–D-11. Chỉ 4 mục dưới đây cần xử lý.

## BLOCKER

### F-01 — D-06 chưa có xác thực phiên one-time cho trang xác nhận đơn; rate limiter vẫn in-memory

**Bằng chứng**

- `phase-debate-claude-review.md:267` (quyết định đã chốt) yêu cầu: *"Trang
  `order-confirmation` ngay sau checkout hiển thị thông tin phiên mua hàng
  một lần"* — tức khác với public lookup thông thường.
- Thực tế, `src/app/(storefront)/order-confirmation/[orderNumber]/page.tsx:23-28`
  gọi thẳng `getPublicOrderByNumber(orderNumber, phoneSuffix)` — **cùng một
  hàm** mà `src/app/api/public/orders/[orderNumber]/route.ts:25` dùng cho bất
  kỳ ai. `order.service.ts:223-253` luôn mask PII
  (`maskCustomerName`/`maskPhone`/`maskShippingAddress`, dòng 238-240) không
  phân biệt caller.
- Khác biệt duy nhất: `checkout/page.tsx:57` tự động gắn `phoneSuffix` vào
  query string khi redirect. Đây chỉ là tiện lợi điền sẵn tham số, không phải
  bằng chứng phiên (không cookie, không signed token, không server session
  check). Bất kỳ ai có được URL này (lịch sử trình duyệt, screenshot,
  referrer) đều thấy đúng view mask-PII giống người lạ tra cứu công khai.
- Rate limiter (`src/lib/rate-limit.ts:1-26`, dùng bởi
  `route.ts` và `custom-requests/attachments/route.ts`) vẫn là
  `Map<string, number[]>` trong process, tự nhận trong comment
  (`route.ts:6-9`) là "reset khi deploy, không share giữa instance". D-10 chỉ
  thêm cleanup timer cho Map này, không đổi sang shared store.

**Tác động**

Khách hàng vừa checkout xong cũng chỉ thấy thông tin đã mask (tên/SĐT/địa chỉ
bị che) — không đúng kỳ vọng UX "xem lại đơn vừa đặt", đồng thời không có cơ
chế phiên nào mạnh hơn D-06 gốc; rate limit vẫn chỉ bảo vệ một instance khi
deploy multi-instance thật.

**Đề xuất để debate**

- Thêm session/token-bound proof cho trang confirmation ngay sau checkout
  (ví dụ: ký một short-lived token khi tạo order, lưu ở cookie hoặc query
  token riêng — không phải `phoneSuffix` gõ tay — cho phép xem đầy đủ thông
  tin đơn **chỉ trong phiên đó**), tách hẳn khỏi endpoint public lookup.
- Chuyển rate limiter public sang shared store (DB table hoặc Redis/Upstash
  nếu đã có sẵn trong stack) trước khi deploy multi-instance thật; gộp chung
  cho cả `orders` và `custom-requests/attachments`.

**Acceptance tối thiểu**

- Trang order-confirmation hiển thị đầy đủ thông tin đơn (không mask) chỉ khi
  có token phiên hợp lệ vừa tạo lúc checkout; hết hạn/không hợp lệ thì rơi về
  đúng luồng public lookup (mask + xác thực SĐT) như người lạ.
- Rate limit hoạt động đúng khi chạy nhiều instance (test giả lập 2 "instance"
  dùng chung store).

## IMPORTANT

### F-02 — Làm rõ và enforce đúng thời điểm tiêu hao nguyên liệu MTO theo ADR-0017

**Bằng chứng**

- ADR-0017 (`docs/architecture/decisions.md:167`) viết: *"Material
  consumption occurs when the order enters `PRODUCING` by creating/linking a
  `print_jobs` row, deducting raw materials..."* — đọc như thể vào
  `PRODUCING` vừa tạo print job vừa trừ nguyên liệu ngay.
- Thực tế `order.service.ts:108-127` (trong `updateOrderStatus`, nhánh
  `nextStatus === 'PRODUCING'`) chỉ:
  ```
  insert into print_jobs (order_id, status) values ($1, 'QUEUED')
  ```
  Không có `material_id`, không `estimated_weight_grams`, không insert
  `material_movements` nào ở bước này.
- Trừ nguyên liệu thật sự nằm ở `print-job.service.ts:87-116`
  (`updatePrintJobStatus`), chỉ chạy khi chuyển print job sang `PRINTING`, và
  bắt buộc đã có `material_id`/`estimated_weight_grams` gán từ trước qua
  `assignPrintJobMaterial()` (`print-job.service.ts:41-53`) — một hàm chỉ do
  **staff gọi thủ công**, không có caller nào trong `order.service.ts`.
- Vậy chuỗi thật là: order → PRODUCING (tự động, cùng transaction) tạo
  print job rỗng `QUEUED` → staff thủ công gán vật liệu + khối lượng → staff
  thủ công chuyển print job `QUEUED → PRINTING` → lúc đó mới ghi
  `PRODUCTION_OUT`. Hai bước sau hoàn toàn tách rời khỏi order status
  transition.

**Tác động**

Không phải lỗi code (chuỗi này hợp lý về nghiệp vụ — cần staff chọn vật liệu
trước khi tiêu hao), nhưng ADR-0017 diễn đạt sai khiến người đọc sau này (kể
cả reviewer) hiểu nhầm đây là một bước tự động duy nhất. Rủi ro: một order
vào `PRODUCING` nhưng print job bị bỏ quên ở `QUEUED` vô thời hạn (chưa gán
vật liệu) không có cảnh báo nào.

**Đề xuất**

- Sửa lại câu chữ ADR-0017 tách rõ 2 bước: (1) tự động tạo `print_jobs` row
  rỗng khi order vào `PRODUCING`; (2) tiêu hao nguyên liệu thật chỉ xảy ra
  thủ công khi staff gán vật liệu và chuyển print job sang `PRINTING`.
- Cân nhắc thêm cảnh báo/dashboard cho `print_jobs.status = 'QUEUED'` quá X
  giờ chưa gán vật liệu (không bắt buộc phase này, ghi nhận làm follow-up
  riêng nếu OWNER muốn).

**Acceptance tối thiểu**

`docs/architecture/decisions.md` ADR-0017 mô tả đúng 2 bước tách rời; không
cần đổi code nếu OWNER xác nhận nghiệp vụ thủ công hiện tại là đúng ý.

### F-03 — D-08 chưa có test cho rollback upload và dọn cover cũ

**Bằng chứng**

- Code đã đúng theo thiết kế D-08: rollback khi DB fail
  (`src/app/admin/(protected)/blog/actions.ts:46-52`, xóa
  `coverImagePath` vừa upload nếu `createBlogPost` throw) và xóa cover cũ khi
  thay thành công (`actions.ts:70-81`, chỉ xóa `previous.coverImagePath` sau
  khi `updateBlogPost` đã commit).
- Nhưng `grep -rln "cover" tests/` chỉ ra đúng 1 file liên quan
  (`tests/phase-7-blog.test.ts`), và 3 test trong đó
  (`phase-7-blog.test.ts:13-49`) chỉ kiểm DRAFT visibility và
  `published_at` — không test nào gọi `createBlogPostAction`/
  `updateBlogPostAction`, không upload `File`/`Blob`, không assert
  `uploadBlogCoverImage`/`deleteBlogCoverImage` được gọi đúng lúc.
- Không có E2E nào cho blog cover (`grep "blog"` trên `e2e/*.spec.ts` không
  có kết quả).

**Tác động**

Logic rollback/cleanup đúng thiết kế nhưng hoàn toàn không được test bảo vệ
— một regression tương lai (ví dụ đổi thứ tự upload/validate) sẽ không bị
bắt.

**Đề xuất**

Thêm 2 test tích hợp cho `tests/phase-7-blog.test.ts` (hoặc file mới cùng
convention):
1. DB write fail sau khi upload cover → object vừa upload bị xóa khỏi
   Storage (mock/spy `deleteBlogCoverImage` hoặc kiểm tra Storage thật nếu
   test đã dùng Supabase thật như các test khác).
2. Update post với cover mới → cover cũ bị xóa sau khi DB update thành công;
   nếu update DB fail, cover cũ **không** bị xóa và cover mới bị dọn.

**Acceptance tối thiểu**

Cả 2 kịch bản trên có test pass, theo đúng pattern rollback test đã có sẵn
cho product image (theo ghi chú gốc trong D-08).

## SUGGESTION

### F-04 — Ổn định shared live-server trong `npm test`; thêm test hành vi thật cho D-11

**Bằng chứng**

- 4 file test độc lập tự spawn `next start` trên **cùng port 3411**, không
  điều phối chéo:
  `tests/phase-3-route-auth.test.ts:8-9`,
  `tests/phase-4-public-custom-request.test.ts:10-11`,
  `tests/phase-5-public-orders.test.ts:10-11`,
  `tests/phase-6-attachment-route.test.ts:10-11`.
- Mỗi file `before()` (ví dụ `phase-5-public-orders.test.ts:28-35`) probe
  "đã có server trả lời chưa", nếu chưa thì tự spawn; `after()` chỉ gửi
  `SIGTERM` mà không đợi port thực sự giải phóng trước khi file tiếp theo
  chạy `before()`. `package.json` chạy suite với
  `--test-concurrency=1` (tuần tự) nhưng race vẫn xảy ra vì shutdown/startup
  không đồng bộ.
- Đây chính là flakiness đã tự ghi nhận ở
  `docs/exec-plans/active/phase-8-ux-feedback-round1.md:154-156`: *"3 test
  trong `phase-5-public-orders.test.ts` flaky khi chạy full-suite... pass
  100% khi chạy riêng file."*
- D-11 hiện chỉ có test dạng static-assert nội dung migration SQL
  (`tests/migration-contract.test.ts:38-45`, regex match
  `foreign key (id) ... on delete restrict` trên text file migration) —
  **không** có test nào thực sự gọi xóa Auth user khi còn `staff_profiles`
  liên kết và assert bị FK reject. `tests/phase-3-auth.test.ts:45-46` có xóa
  `staff_profiles` rồi mới xóa Auth user trong teardown — đúng thứ tự an
  toàn, nên không hề kích hoạt được nhánh RESTRICT.

**Tác động**

Không phải lỗi nghiệp vụ, nhưng làm giảm độ tin cậy của `npm test` khi chạy
full-suite (đã biết trước, không mới), và D-11 chưa có bằng chứng runtime
thật rằng RESTRICT hoạt động — chỉ biết migration SQL có đúng cú pháp.

**Đề xuất**

- Gom 4 file test hiện dùng port 3411 riêng lẻ vào một global setup/teardown
  dùng chung 1 server instance (ví dụ qua `tests/helpers/live-server.ts` mới,
  start 1 lần trước toàn bộ suite, dùng ref-count hoặc chạy trước bằng
  `--test-reporter`/global hook), thay vì mỗi file tự quản lý lifecycle.
- Thêm 1 test live cho D-11: dựng 1 staff user thật, cố xóa qua
  `supabase.auth.admin.deleteUser(userId)` **trong khi** `staff_profiles` row
  còn tồn tại, assert Postgres trả lỗi FK violation (không phải xóa thành
  công).

**Acceptance tối thiểu**

`npm test` full-suite pass ổn định nhiều lần liên tiếp không cần chạy riêng
file; có ít nhất 1 test D-11 gọi xóa Auth user thật và assert bị chặn.

## BLOCKER (phát hiện lúc review)

### F-05 — Token đã hết hạn (`ttlSeconds: -1`) đôi khi vẫn được `verifyOrderConfirmationToken` chấp nhận

**Bằng chứng**

- Claude chạy `npm test` (Node 22.23.2) 6 lần liên tiếp để verify DoD #2: 3
  lần fail (1 lần `SIGKILL` file `phase-5-public-orders.test.ts` — nghi ngờ
  không liên quan; **2 lần liên tiếp** fail đúng 1 assertion giống hệt nhau
  trong `tests/hardening-followup.test.ts:20`:
  ```
  assert.equal(verifyOrderConfirmationToken(createOrderConfirmationToken(orderId, -1)), null);
  ```
  Cả 2 lần fail, `verifyOrderConfirmationToken` trả về object hợp lệ
  `{ orderId, expiresAt }` thay vì `null` — nghĩa là token đã hết hạn (tạo
  với TTL âm) vẫn được coi là còn hiệu lực.
- Đọc `src/lib/order-confirmation-token.ts`: dưới đồng hồ hệ thống đơn điệu
  (monotonic), điều này về lý thuyết không thể xảy ra — `expiresAt =
  floor(createTime/1000) - 1` và điều kiện reject là
  `expiresAt <= floor(verifyTime/1000)`, mà `verifyTime > createTime` luôn
  đúng vì verify chạy ngay sau create. Việc fail lặp lại 2 lần liên tiếp gợi
  ý đây không phải nhiễu ngẫu nhiên một lần, mà là edge case thật (có thể do
  `Date.now()` không hoàn toàn đơn điệu dưới tải cao — GC pause/event-loop
  lag — điều có thể xảy ra cả ở production, không chỉ trong sandbox).

**Tác động**

Đây là một token bảo mật cho phép xem thông tin đơn hàng không mask (tên,
SĐT, địa chỉ) — một expiry check có thể flaky-pass dưới tải, dù xác suất
thấp, vẫn là rủi ro bảo mật thật, và vi phạm rõ DoD #2 (stable qua ≥3 lần
chạy liên tiếp — 2 lần gần nhất của Claude đều fail liên tiếp).

**Đề xuất**

- Điều tra nguyên nhân gốc: có phải do `Date.now()` không đơn điệu dưới tải,
  hay còn logic nào khác. Không giả định ngay là "chỉ do sandbox".
- Bất kể nguyên nhân, cần thêm safety margin cho expiry check (ví dụ reject
  nếu `expiresAt <= Math.floor(Date.now() / 1000) + BUFFER_SECONDS` với
  buffer nhỏ vài giây) để chống đúng loại jitter này, thay vì so sánh biên
  chính xác từng giây.
- Sửa lại test dùng TTL âm sâu hơn (`-10` thay vì `-1`) để test không còn
  phụ thuộc vào ranh giới đúng 1 giây — nhưng đây là fix cho test, không
  thay thế cho việc sửa buffer ở logic thật.

**Acceptance tối thiểu**

`npm test` full-suite pass ổn định qua **5 lần chạy liên tiếp** trên Node
≥22 (siết chặt hơn mức 3 lần ban đầu, vì lần này chính assertion an ninh bị
ảnh hưởng).

## Checklist

### Trước khi giao Codex
- [x] F-01 quyết định cơ chế token + rate limiter store (OWNER, xem "Quyết
      định đã chốt")
- [x] F-02 xác nhận quy trình thủ công hiện tại đúng ý OWNER (xem "Quyết
      định đã chốt")
- [x] F-03, F-04 không có câu hỏi mở — thuần kỹ thuật

### Việc cần làm
- [x] **F-01 (BLOCKER):** Signed short-lived token cho order-confirmation
      (thay `phoneSuffix` query param); bảng `rate_limit_attempts` trong
      Postgres thay cho in-memory Map, dùng chung cho `orders` lookup và
      `custom-requests/attachments`.
- [x] **F-02 (IMPORTANT):** Sửa câu chữ ADR-0017 tách rõ 2 bước tạo print
      job (tự động) và tiêu hao nguyên liệu (thủ công qua staff) — không đổi
      code.
- [x] **F-03 (IMPORTANT):** Thêm test rollback upload + dọn cover cũ cho D-08.
- [x] **F-04 (SUGGESTION):** Gom shared live-server cho test suite; thêm
      test hành vi thật cho D-11 FK RESTRICT.
- [x] **F-05 (BLOCKER):** Điều tra + sửa expiry check flaky trong
      `order-confirmation-token.ts`; siết test TTL âm; `npm test` ổn định
      qua 5 lần chạy liên tiếp.

## Definition of Done

1. F-01 và F-02 được OWNER chốt hướng xử lý (F-02 có thể chỉ cần sửa doc,
   không cần đổi code, tùy quyết định OWNER).
2. F-01, F-03 có test mới pass; F-04 (nếu làm) chứng minh `npm test`
   full-suite ổn định qua ít nhất 3 lần chạy liên tiếp và có test D-11 thật.
3. `npm run lint`, `npm run typecheck`, `npm test` pass 100% trên Node ≥22.
4. Nếu sửa ADR-0017, đồng bộ lại `docs/database/business-rules.md` nếu có
   mô tả liên quan.
