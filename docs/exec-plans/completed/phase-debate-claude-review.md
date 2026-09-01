# Debate Phase — Review implementation Phase 3–8 do Claude thực hiện

> Trạng thái: **ACCEPTED & READY FOR HANDOFF (Hardening / Remediation Phase)**  
> Reviewer: Codex, 2026-09-01 | Challenger & Research: Gemini | Phê duyệt: OWNER  
> Phạm vi: Khắc phục các mục D-01 đến D-11 nhằm đảm bảo tính toàn vẹn dữ liệu, bảo mật và nghiệp vụ chuẩn.

## Mục đích

Tài liệu này chỉ ghi các điểm có bằng chứng code cho thấy implementation sai,
thiếu ràng buộc kỹ thuật, hoặc quyết định MVP hiện tại cần OWNER + Claude xác
nhận lại. Không lặp lại các phần đã làm đúng. Sau debate, các mục được chấp
nhận mới được chuyển thành một execution plan/handoff riêng.

## Kết quả quality gate hiện tại

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm test`: **56/56 pass** trên Node `v22.23.2` (chạy ngoài filesystem
  sandbox vì `tsx` cần mở IPC socket).
- `npm run build`: pass khi có network tới Supabase; lần chạy trong sandbox
  fail ở prerender `/sitemap.xml` do DNS bị chặn, không phải lỗi code.
- Chưa chạy Playwright trong lượt review này. Repo có đủ 5 flow mà canonical
  `e2e-testing` yêu cầu, nhưng test admin hiện tạo sản phẩm chứ chưa thực sự
  **update** một sản phẩm có sẵn như tên flow yêu cầu.

Các test xanh không phủ các tình huống concurrency giữa **hai print job khác
nhau**, workflow transition đầy đủ, hay tính riêng tư của bucket file thiết kế.

## BLOCKERS — đề nghị không coi hệ thống sẵn sàng launch trước khi chốt

### D-01 — File thiết kế khách hàng đang public toàn Internet, trái chính sách bảo mật

**Bằng chứng**

- Migration `supabase/migrations/20260831000001_custom_request_attachments_bucket.sql:1-6`
  tạo bucket `custom-request-attachments` với `public = true`.
- `src/services/custom-request.service.ts:30-37` upload bằng service-role rồi
  trả `getPublicUrl()`; bất kỳ ai có URL đều đọc được, không qua admin auth.
- Trong khi đó trang
  `src/app/(storefront)/file-confidentiality-policy/page.tsx:24-28` cam kết
  “chỉ đội ngũ kỹ thuật xử lý đơn hàng ... được truy cập”.
- URL này còn được lưu trực tiếp ở `custom_requests.attachment_url`; không có
  signed URL hết hạn hoặc download route gọi `requireAdmin()`.

**Tác động**

Đây là mâu thuẫn trực tiếp giữa hành vi kỹ thuật và cam kết với khách, đặc biệt
nghiêm trọng với STL/STEP/CAD có sở hữu trí tuệ. UUID ngẫu nhiên chỉ làm URL
khó đoán, không biến object public thành access-controlled.

**Đề xuất để debate**

- Chuyển bucket thành private.
- DB lưu `storage_path`, không lưu public URL.
- Admin mở file qua signed URL thời hạn ngắn được tạo server-side sau
  `requireAdmin()`; không phát service-role key ra client.
- Có migration an toàn cho các row/URL cũ và test anonymous fetch bị từ chối.

**Acceptance tối thiểu**

Anonymous request không đọc được object; STAFF/OWNER vẫn tải được file từ trang
chi tiết request; nội dung trang policy đúng với hành vi thật.

### D-02 — `MADE_TO_ORDER` được quảng bá nhưng không thể đặt nếu chưa có thành phẩm trong kho

**Bằng chứng**

- Storefront cho lọc `MADE_TO_ORDER` tại
  `src/app/(storefront)/products/page.tsx:60-64`.
- Nhưng `src/services/storefront-catalog.service.ts:31-53,114-120` tính
  `inStock` cho mọi loại sản phẩm chỉ từ tồn kho thành phẩm.
- `src/app/(storefront)/products/[slug]/add-to-cart-form.tsx:19-23,55-80`
  disable variant không có tồn và hiện “Tạm hết hàng”.
- Kể cả bypass UI, `src/services/order.service.ts:22-32` gọi
  `assertAvailableStock()` cho mọi variant, không phân nhánh theo
  `products.product_type`.

**Tác động**

Một sản phẩm đúng nghĩa “đặt làm theo yêu cầu” thường chưa có thành phẩm tồn
kho, nên luồng bán hàng của loại này bị khóa hoàn toàn. Filter và nhãn hiện tại
hứa một khả năng backend không cung cấp.

**Cần OWNER chốt business rule**

1. `MADE_TO_ORDER` có đi qua cart/order như hàng thường nhưng không reserve
   thành phẩm, sau đó tạo production job; hay
2. nút CTA phải chuyển sang `/custom-print` và không cho checkout trực tiếp; hay
3. thực ra loại này vẫn yêu cầu tồn kho, khi đó nên đổi tên/diễn giải để không
   gây hiểu nhầm.

Không nên chỉ bỏ check tồn kho mà chưa thiết kế production/inventory lifecycle,
vì như vậy sẽ chữa UI nhưng tạo đơn không có cách fulfil rõ ràng.

### D-03 — Hai print job khác nhau có thể đồng thời làm tồn nguyên liệu âm

**Bằng chứng**

- `src/services/print-job.service.ts:81-95` chỉ `FOR UPDATE` row của chính
  `print_jobs.id`, sau đó đọc tổng material ledger qua
  `resolveWarehouseForMaterial()`.
- `src/services/inventory.service.ts:87-106` không khóa row ổn định nào đại
  diện cho `(material_id, warehouse_id)` trước khi đọc tổng và ghi movement.
- Vì hai transaction cho hai print job khác nhau khóa hai row khác nhau, cả hai
  có thể cùng thấy 100g, mỗi job tiêu 80g, rồi cùng commit thành -60g.
- Test concurrency hiện tại (`tests/phase-6-print-job-material.test.ts`) chỉ
  gọi đồng thời trên **cùng một print job**, nên row lock của print job làm test
  pass nhưng không chứng minh chống oversell nguyên liệu toàn cục.
- `recordMaterialMovement()` cũng không serialize với đường tiêu hao tự động,
  khác với product inventory đã có `lockVariantForInventoryWrite()`.

**Đề xuất để debate**

Áp dụng một lock protocol thống nhất cho mọi material movement (ví dụ khóa row
`materials` theo thứ tự ổn định, hoặc ledger balance row riêng có constraint),
rồi resolve warehouse + insert movement trong cùng transaction. Bổ sung test:
hai job khác nhau cùng tranh phần nguyên liệu cuối, chính xác một job thành công.

### D-04 — Hủy order sau `PRODUCING` làm mất tồn kho mà không có nghiệp vụ bù

**Bằng chứng**

- `src/services/order.service.ts:65-69` cho phép `PRODUCING → CANCELLED` và
  `READY_TO_SHIP → CANCELLED`.
- Khi vào `PRODUCING`, `src/services/order.service.ts:88-98` đã ghi
  `SALE_OUT` cho toàn bộ item.
- Nhánh chuyển sang `CANCELLED` không ghi `RETURN_IN`, `DAMAGE_OUT`, hay bất kỳ
  quyết định disposition nào. Tồn thành phẩm vì vậy vẫn bị giảm dù đơn bị hủy.

**Cần OWNER chốt business rule**

- Hủy trước khi giao có tự động hoàn kho toàn bộ hay cần STAFF chọn số lượng
  hoàn kho/hỏng?
- Với `READY_STOCK` và `MADE_TO_ORDER` có cùng cách xử lý không?
- Nếu `READY_TO_SHIP` bị hủy, phí/đóng gói và audit cần ghi thế nào?

Implementation sau debate phải giữ ledger append-only: ghi movement bù, tuyệt
đối không sửa/xóa `SALE_OUT` cũ.

## IMPORTANT — thiếu kỹ thuật hoặc cần siết trước vận hành thật

### D-05 — Workflow state machine chỉ được enforce một phần

**Bằng chứng**

- `updateCustomRequestStatus()` tại
  `src/services/custom-request.service.ts:52-58` nhận bất kỳ enum status nào và
  update trực tiếp, không kiểm tra trạng thái trước.
- `updatePrintJobStatus()` tại `src/services/print-job.service.ts:67-104` chỉ
  validate khi đích là `PRINTING`; mọi đích khác được phép. Ví dụ
  `QUEUED → COMPLETED`, `COMPLETED → FAILED`, `CANCELLED → QC` đều qua service.
- UI `src/app/admin/(protected)/print-jobs/page.tsx:9,49` đưa toàn bộ enum vào
  select ở mọi trạng thái, nên đây không chỉ là khả năng lý thuyết qua API.
- `updateOrderPaymentAndShipping()` tại
  `src/services/order.service.ts:169-185` cũng cho đổi tùy ý, kể cả
  `REFUNDED → UNPAID` hay `DELIVERED → PENDING`; chưa có rule hoặc audit action
  riêng cho refund/return.

**Đề xuất**

Chốt transition map cho custom request, print job, payment và shipping; enforce
ở service layer dưới row lock; UI chỉ hiển thị transition hợp lệ; test cả happy
path, backward/terminal transition và concurrent update. Nếu OWNER chủ ý cho
override, cần action OWNER-only có reason/audit rõ ràng thay vì update tự do.

### D-06 — Public order lookup trả PII và dùng mã đơn 48-bit như bearer secret

**Bằng chứng**

- `src/services/order.service.ts:142-166` coi `orderNumber` là access token và
  trả `customerName`, `customerPhone`, `shippingAddress`, `customerNote`, item
  và số tiền.
- `src/app/api/public/orders/[orderNumber]/route.ts:5-18` chỉ có in-memory rate
  limit, reset khi deploy và không chia sẻ giữa instance.
- `src/app/(storefront)/order-confirmation/[orderNumber]/page.tsx:62-66` render
  trực tiếp tên, số điện thoại, địa chỉ cho bất kỳ ai có URL.
- `ORD-` chỉ dùng 12 hex characters (`src/services/order.service.ts:40`), tức
  48 bit entropy. Khó brute-force ngẫu nhiên không đồng nghĩa an toàn khi URL có
  thể lọt qua history, screenshot, analytics, referrer hoặc chat forwarding.

**Đề xuất để debate**

- Tách mã đơn hiển thị khỏi secret tra cứu entropy cao; hoặc yêu cầu thêm phone
  suffix/OTP.
- Public response mặc định chỉ trả trạng thái + item tối thiểu, mask PII; trang
  xác nhận ngay sau checkout có thể dùng one-time/session-bound proof nếu cần
  hiện địa chỉ đầy đủ.
- Rate limit dùng shared store khi deploy nhiều instance.

### D-07 — “Sản phẩm tiêu biểu” thực tế là 8 sản phẩm mới nhất

**Bằng chứng**

- Home gọi `listStorefrontProducts({ limit: 8 })` tại
  `src/app/(storefront)/page.tsx:86-87`.
- Query mặc định sort `p.created_at desc` và không filter `p.is_featured` tại
  `src/services/storefront-catalog.service.ts:57-78`.
- Admin đã có field `is_featured`, nhưng storefront không dùng nó cho section
  mang nhãn “Sản phẩm tiêu biểu”.

**Đề xuất**

Thêm filter rõ ràng (`featuredOnly`) ở storefront service và test DRAFT không
lọt, chỉ ACTIVE + featured xuất hiện. Chốt fallback khi chưa có featured: ẩn
section hay dùng sản phẩm mới nhất nhưng đổi nhãn.

### D-08 — Upload blog cover có thể để file mồ côi và không dọn ảnh cũ

**Bằng chứng**

- `src/app/admin/(protected)/blog/actions.ts:26-65` upload cover trước khi parse
  toàn bộ form/tạo hoặc update DB. Validation/DB failure sau upload để lại object.
- Khi đổi cover, service update `cover_image_path` nhưng không xóa object cũ.
- `uploadBlogCoverImage()` không có DB record/ownership để cleanup định kỳ.

**Đề xuất**

Parse trước upload; nếu DB write fail thì remove object mới; khi thay ảnh, chỉ
xóa ảnh cũ sau khi DB update thành công (hoặc enqueue cleanup). Có test rollback
tương tự logic product image.

## SUGGESTIONS — không nên chặn debate phase nếu scope cần nhỏ

### D-09 — E2E admin chưa đúng tên flow canonical

`e2e/admin.spec.ts:73-84` test **create** product, trong khi checklist canonical
yêu cầu “Admin updates product”. Nên thêm/chuyển thành update một product seeded
và assert persistence; create có thể giữ thành flow bổ sung.

### D-10 — Rate limiter in-memory tăng không giới hạn theo số key

Các `Map` rate-limit ở public routes chỉ dọn timestamp của key được truy cập,
không xóa key cũ. Process lâu dài có thể tăng memory theo số IP/SĐT khác nhau.
Đây là trade-off MVP đã được ghi nhận, nhưng khi sửa shared limiter cho D-06 nên
gom luôn và tránh duy trì nhiều implementation riêng.

### D-11 — `staff_profiles` vẫn cascade khi xóa Auth user

Phase 3 đã tự ghi nhận nhưng chưa sửa: migration dùng `ON DELETE CASCADE`, làm
mất profile nhân viên nếu OWNER xóa user trực tiếp ở Supabase dashboard. Nên
chốt `RESTRICT` hoặc cơ chế lưu snapshot/deactivation để audit history rõ hơn.

## Những điểm đã xem nhưng không đưa vào lỗi

- Public checkout không tin giá/tổng từ localStorage; server đọc lại giá DB và
  khóa variant trước khi reserve — đúng.
- Order snapshot tên/SKU/attributes/giá được lưu tại lúc đặt — đúng.
- Product inventory ledger immutable và đường checkout concurrent đã có lock
  protocol + test — đúng trong phạm vi các writer hiện tại.
- Auth admin dùng `getUser()` và kiểm tra `staff_profiles.is_active`; API
  mutations có regression test unauthenticated — có bằng chứng phù hợp.
- Markdown blog không bật raw HTML, nên không thấy đường stored-XSS trực tiếp.
- Phase 8 category filter giữ query params và giới hạn category 100; active nav,
  breadcrumb và FAQ đúng với plan hiện tại.

## Trạng thái và Quyết định đã chốt (2026-09-01)

> Trạng thái: **ACCEPTED & READY FOR HANDOFF (Hardening / Remediation Phase)**  
> Reviewer: Codex | Challenger & Research: Gemini | Phê duyệt: OWNER  
> Phạm vi: Khắc phục triệt để các mục D-01 đến D-11 nhằm đảm bảo tính toàn vẹn dữ liệu, bảo mật và nghiệp vụ chuẩn trước khi launch.

### Kết quả chốt 5 câu hỏi cốt lõi từ OWNER & Gemini:

1. **`MADE_TO_ORDER` (D-02):** Đi qua giỏ hàng và checkout bình thường (ADR-0017). Backend bỏ qua check tồn thành phẩm (`assertAvailableStock`) đối với các variant `MADE_TO_ORDER`. Khi chuyển sang `PRODUCING`, hệ thống lập Print Job tiêu hao nguyên liệu nhựa/resin.
2. **Hủy Order sau khi trừ kho (D-04):** Tự động ghi movement bù `RETURN_IN` hoàn toàn bộ số lượng vào `inventory_movements` (ADR-0019) để bảo toàn ledger immutable. Không xóa/sửa row `SALE_OUT` cũ.
3. **Bảo mật File thiết kế 3D (D-01):** Bucket `custom-request-attachments` chuyển thành `private` (ADR-0016). DB chỉ lưu `storage_path`. Admin xem/tải qua Signed URL có hạn ngắn (15-30 phút) được tạo server-side sau `requireAdmin()`.
4. **Bảo mật tra cứu đơn hàng công khai (D-06):** Yêu cầu xác thực `Mã đơn hàng + 4 số cuối SĐT` (ADR-0021). API public bắt buộc Mask PII (Tên, SĐT, che số nhà). Trang `order-confirmation` ngay sau checkout hiển thị thông tin phiên mua hàng một lần.
5. **Enforce Workflow Transition (D-05):** `STAFF` chỉ được chuyển trạng thái xuôi theo Transition Map hợp lệ (ADR-0020). Chỉ `OWNER` mới có quyền override trạng thái đặc biệt và bắt buộc ghi nhận lý do vào Audit Log.

---

## Chi tiết kế hoạch thực hiện (Scope & Checklist)

### 1. Security & Data Integrity (D-01, D-03, D-04)
- [x] **D-01 (Private Attachments):**
  - Viết migration chuyển bucket `custom-request-attachments` sang `public = false`.
  - Cập nhật `custom-request.service.ts`: lưu `storage_path` vào DB `custom_requests.attachment_url` (hoặc đổi thành `attachment_path`).
  - Thêm helper tạo signed URL server-side cho admin detail page.
  - Regression test: anonymous fetch URL trực tiếp từ Storage bị từ chối (403/400).
- [x] **D-03 (Material Concurrency Lock):**
  - Sửa `print-job.service.ts` và `inventory.service.ts`: Khóa row `materials` (`SELECT id FROM materials WHERE id = $1 FOR UPDATE`) trước khi gọi `resolveWarehouseForMaterial()` và `insert into material_movements`.
  - Thêm concurrency test: 2 print job khác nhau cùng tranh chấp phần nguyên liệu cuối cùng, chính xác 1 job thành công và 1 job báo `INSUFFICIENT_MATERIAL_STOCK`.
- [x] **D-04 (Order Cancellation Restock):**
  - Cập nhật `updateOrderStatus` trong `order.service.ts`: Khi chuyển từ `PRODUCING` hoặc `READY_TO_SHIP` sang `CANCELLED`, tự động ghi `RETURN_IN` cho tất cả variant trong đơn hàng.
  - Ghi audit log `ORDER_CANCELLED_RESTOCKED`.
  - Unit/integration test kiểm tra số dư tồn kho phục hồi chính xác sau khi hủy đơn.

### 2. Business Flow & State Machine (D-02, D-05)
- [x] **D-02 (MADE_TO_ORDER Flow):**
  - Sửa `storefront-catalog.service.ts`: Với `product_type === 'MADE_TO_ORDER'`, luôn đánh dấu `inStock = true`.
  - Sửa `add-to-cart-form.tsx`: Không disable nút thêm vào giỏ đối với `MADE_TO_ORDER`.
  - Sửa `createOrder` trong `order.service.ts`: Chỉ gọi `assertAvailableStock` cho các variant thuộc sản phẩm `READY_STOCK`.
  - Unit/E2E test đặt hàng thành công sản phẩm `MADE_TO_ORDER` khi tồn kho thành phẩm bằng 0.
- [x] **D-05 (Workflow State Machine Enforce):**
  - Định nghĩa transition map cho `custom_requests` (`NEW` → `QUOTED` → `ACCEPTED`/`REJECTED` → `ORDER_CREATED` → `COMPLETED`/`CANCELLED`).
  - Định nghĩa transition map cho `print_jobs` (`QUEUED` → `PRINTING` → `COMPLETED`/`FAILED` → `REPRINT`/`CANCELLED`).
  - Định nghĩa transition map cho `payment_status` (`UNPAID` → `DEPOSIT_PAID` → `PAID` / `REFUNDED`) và `shipping_status` (`PENDING` → `SHIPPED` → `DELIVERED` / `RETURNED`).
  - Enforce trong service layer dưới row lock; UI Admin chỉ hiện các status hợp lệ tiếp theo.

### 3. Privacy, Content & Cleanups (D-06, D-07, D-08, D-09, D-10, D-11)
- [x] **D-06 (Public Order Privacy):** Cập nhật `GET /api/public/orders/[orderNumber]` yêu cầu query/header xác nhận SĐT (`phoneSuffix` hoặc `phone`), mask PII trong response payload.
- [x] **D-07 (Featured Products):** Sửa query `listStorefrontProducts` tại `storefront-catalog.service.ts` để filter đúng `is_featured = true and status = 'ACTIVE'`.
- [x] **D-08 (Blog Cover Cleanup):** Sửa `actions.ts` của Blog: validate Zod schema trước khi upload file; nếu ghi DB thất bại thì xóa file vừa upload; xóa cover cũ khi update thành công.
- [x] **D-09 (E2E Test Alignment):** Thêm test case `Admin updates product` vào `e2e/admin.spec.ts`.
- [x] **D-10 (Rate Limiter In-Memory Cleanup):** Thêm cleanup timer định kỳ cho memory Map rate limiter.
- [x] **D-11 (Staff Profiles FK Constraint):** Migration đổi FK `staff_profiles.user_id` từ `ON DELETE CASCADE` thành `ON DELETE RESTRICT`.

---

## Definition of Done
1. Toàn bộ checklist D-01 đến D-11 chuyển thành `[x]`.
2. `npm run lint`, `npm run typecheck`, `npm test` đều pass 100% với các unit/integration test mới cho concurrency và status transitions.
3. Test E2E Playwright phủ đủ 5 flows canonical bao gồm cập nhật sản phẩm.
4. Tài liệu `docs/architecture/decisions.md` và `docs/database/business-rules.md` được đồng bộ.
