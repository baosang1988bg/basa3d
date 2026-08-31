# Phase 6 — Custom Printing / Quote / Production

Theo `docs/roadmap.md`: Phase 6 là "custom print + quote + production". Chi
tiết scope tham khảo `3d-printing-website-development-plan.md` PHASE 6
(mục 6.1–6.5).

## Rà soát trước khi lập kế hoạch — phần lớn backend/admin UI của Phase 6 đã có sẵn từ Phase 3

Đọc code trước khi viết plan (đúng "Before coding" trong `AGENTS.md`) phát
hiện: **Phase 3 đã xây phần lớn workflow mà roadmap gốc gán cho Phase 6**,
sớm hơn ranh giới phase chính thức:
- Request inbox: `src/app/admin/(protected)/custom-requests` — list + trang
  chi tiết, đổi status `NEW → REVIEWING → NEED_INFO → QUOTED → APPROVED/
  REJECTED/CONVERTED` (`updateCustomRequestStatusAction`).
- Quote: `quote.service.ts` (`createQuote`, `acceptQuote`) + UI tạo báo giá,
  chấp nhận báo giá ngay trong trang chi tiết custom-request.
- Convert quote → production: `acceptQuote` đã tự động tạo `print_jobs` row
  khi quote được chấp nhận (đúng ADR-0007 — quote `ACCEPTED` → tạo
  `print_jobs`, **không** tạo `orders`, khác dev plan gốc mục 6.4 nói "convert
  quote → order" — ADR-0007 đã ghi rõ quyết định này từ Phase 3).
- Production tracking: `print-job.service.ts` + trang
  `/admin/print-jobs` — list + đổi status
  `QUEUED → PRINTING → FAILED → REPRINT → QC → COMPLETED` (+ `CANCELLED`).
- Request form công khai: `/custom-print` (Phase 4) đã có, gọi
  `POST /api/public/custom-requests`.
- Test: `tests/phase-3-quote-print-job.test.ts` đã cover double-accept quote
  idempotency (không tạo 2 print_job cho 1 quote).

**Vì vậy Phase 6 không làm lại từ đầu** — chỉ còn 3 khoảng trống thật sự so
với mục tiêu gốc "nhận 1 file STL → báo giá → khách duyệt → tạo order → tạo
print job mà không cần Excel":

1. **File upload thật bị thiếu** (Non-goal có chủ đích của Phase 4) — MVP chỉ
   nhận link. Dev plan gốc muốn nhận file thật (`.stl/.step/.obj/.3mf`, ảnh).
2. **Bug phát hiện khi rà soát: tính năng dán/kéo ảnh ở form `/custom-print`
   đang hỏng** — xem quyết định #1.
3. **`print_jobs.material_id` luôn `null`, không có bước trừ kho nguyên liệu
   khi in** — đúng vấn đề "không biết bao nhiêu vật liệu đã tiêu hao" mà dev
   plan gốc (mục 2.1) nêu ra làm lý do xây `material_movements` riêng (Phase
   0, ADR-0008) — thiết kế đã có sẵn, chỉ chưa nối logic.

## Goal
Vá 3 khoảng trống trên: (1) nhận file thiết kế/ảnh thật qua Supabase Storage
thay vì hack base64 data-URI, (2) gán vật liệu + tự động trừ kho nguyên liệu
khi print job chuyển sang in, để OWNER biết chính xác đã tiêu hao bao nhiêu
nhựa cho mỗi custom order. Không xây lại luồng request→quote→print job đã
chạy từ Phase 3.

## Non-goals
- Xây lại request inbox / quote UI / print job status UI — **đã có, giữ
  nguyên**.
- Deadline/Budget field trong request form (dev plan gốc mục 6.1 có nhắc) —
  không có trong schema `custom_requests` hiện tại (Phase 0 đã lược bớt theo
  tinh thần ADR-0007 "đơn giản hoá field không cần thiết"); không thêm ở
  Phase 6 vì owner chưa yêu cầu, tránh field chết không ai dùng. Ghi nhận
  làm assumption — nếu owner cần, thêm sau bằng 1 migration nhỏ, không tốn
  công tái cấu trúc.
- Convert quote → order (dev plan gốc mục 6.4) — **đã cố ý không làm theo
  ADR-0007**, giữ nguyên: quote `ACCEPTED` → `print_jobs`, không tạo `orders`.
- Đối soát COGS/profit report chi tiết theo print job — Phase 8 (operations).
- Actual weight/print-time capture qua thiết bị IoT/máy in tự động — nhập
  tay qua admin UI, không tích hợp phần cứng.
- File upload cho khách **đã có tài khoản** (không có khái niệm tài khoản
  khách hàng ở dự án này, giữ nguyên guest-only như Phase 4/5).

## Quyết định đã chốt

1. **Xây upload file thật lên Supabase Storage cho custom-request, thay thế
   hoàn toàn hack base64 data-URI hiện tại** (chốt qua hỏi trực tiếp chủ dự
   án 2026-08-31 — phát hiện bug khi rà soát commit `88b7c96`):
   - **Bug hiện tại:** `custom-request-form.tsx` (thêm ngoài Phase 4, chưa
     qua review) dùng `FileReader.readAsDataURL()` encode ảnh dán/kéo-thả
     thành chuỗi `data:image/...;base64,...` rồi gán thẳng vào
     `attachmentUrl`. Trường này là `z.string().url().max(2000)` — ảnh thật
     (vài trăm KB trở lên) chắc chắn vượt 2000 ký tự sau khi base64-encode
     → validation reject → khách dán ảnh xong bấm gửi **rất có thể** nhận
     lỗi "Có lỗi xảy ra". Đây là bug ảnh hưởng khách hàng thật, ưu tiên fix
     ngay trong Phase 6, không phải feature mới.
   - **Bucket mới `custom-request-attachments`** (Supabase Storage, public
     read giống `product-images`) — migration mới tạo bucket + policy.
   - **Route mới `POST /api/public/custom-requests/attachments`** (namespace
     `api/public/*`, public, có auth-free vì khách chưa có `custom_request`
     nào để gắn attachment vào tại thời điểm upload — quy trình: khách chọn/
     dán file → upload ngay → nhận về `{ url }` → form gửi `attachmentUrl`
     thật (không phải base64) trong `POST /api/public/custom-requests` như
     cũ):
     - Giới hạn loại file: ảnh (`image/jpeg`, `image/png`, `image/webp`) +
       file thiết kế 3D phổ biến theo dev plan gốc (`.stl`, `.step`/`.stp`,
       `.obj`, `.3mf`) — allowlist theo *đuôi file* cho nhóm 3D (vì các định
       dạng này không có MIME type chuẩn hoá đáng tin cậy trong mọi trình
       duyệt) kết hợp giới hạn kích thước.
     - Giới hạn kích thước: 20MB/file (đủ cho STL model vừa, lớn hơn giới
       hạn ảnh 5MB hiện tại của `uploadProductImage` vì file 3D nặng hơn ảnh
       — 2 giới hạn khác nhau theo loại file, không dùng chung 1 hằng số).
     - Path lưu trữ **ngẫu nhiên** (`randomUUID()`, không dùng tên file gốc
       của người dùng) — tránh path traversal / đè file, giống
       `uploadProductImage` đã làm cho product images.
     - **Rate-limit theo IP** (khách chưa nhập SĐT ở bước upload, không có
       gì khác để rate-limit theo) — endpoint ghi dữ liệu công khai thứ 3
       của dự án (sau custom-requests, orders ở Phase 4/5), cùng rủi ro spam
       storage; giới hạn nhẹ (ví dụ 10 upload/IP/giờ, in-memory best-effort
       giống `GET /api/public/orders/[orderNumber]` ở Phase 5) — không kỳ
       vọng chống được attacker có quyết tâm, chỉ chặn spam ngẫu nhiên.
   - **Không** validate/scan nội dung file (antivirus, kiểm tra file 3D hợp
     lệ) — ngoài scope; STAFF tự mở file bằng tay khi review request, đúng
     tinh thần "không fetch/preview attachmentUrl phía server" đã quyết ở
     Phase 4 quyết định #3 (áp dụng tương tự cho file upload: server chỉ lưu
     và trả URL, không tự động mở/xử lý nội dung).
   - **Rủi ro thật hơn mức "spam storage" ban đầu tưởng (phát hiện qua
     challenge review 2026-08-31):** vì `.stl/.step/.obj/.3mf` không có MIME
     type đáng tin cậy để kiểm tra, allowlist chỉ dựa theo *đuôi file* — kết
     hợp bucket public-read, endpoint này về bản chất là **1 dịch vụ hosting
     file ẩn danh miễn phí** (tới 20MB × giới hạn rate-limit mỗi IP), không
     chỉ là rủi ro tốn dung lượng. Giảm nhẹ: **`Content-Type` lưu trên
     Storage phải do server tự gán cứng theo bảng ánh xạ đuôi file → MIME cố
     định** (ví dụ `.stl → model/stl`, không có định dạng chuẩn thì dùng
     `application/octet-stream`), **không** tin `file.type` client gửi lên
     (khác `uploadProductImage` hiện tại đang dùng `input.file.type` trực
     tiếp — cách đó chấp nhận được cho admin/`requireAdmin()` vì actor tin
     cậy, nhưng **không** chấp nhận được cho route public mới này). Đây vẫn
     chỉ là giảm nhẹ, không loại bỏ hoàn toàn rủi ro lạm dụng hosting — theo
     dõi dung lượng bucket sau khi launch như đã ghi ở Risks.
   - `publicCustomRequestInputSchema.attachmentUrl` **giữ nguyên** kiểu
     (`url().max(2000)`) — URL Supabase Storage thật luôn ngắn hơn nhiều so
     với base64, không cần đổi giới hạn.

2. **Print job: gán `material_id` + tự động trừ kho nguyên liệu khi chuyển
   sang `PRINTING`** (chốt qua hỏi trực tiếp chủ dự án 2026-08-31; cơ chế
   concurrency dưới đây viết lại hoàn toàn sau challenge review 2026-08-31 —
   bản đầu có 3 lỗi cụ thể mà agent review phát hiện, đã sửa trực tiếp ở
   đây, không chỉ ghi chú):
   - Trang chi tiết print job mới (`/admin/print-jobs/[id]`, hiện chỉ có
     trang list) — thêm form: chọn `material_id` (dropdown từ `materials`),
     nhập `estimatedWeightGrams`. Cả 2 cột đã có sẵn trong schema
     `print_jobs`, chỉ thiếu UI.
   - **Lỗi #1 đã sửa — dấu số lượng:** `material_movements` có check
     constraint bắt buộc `PRODUCTION_OUT` phải có `quantity < 0`
     (`20260830000000_initial_domain_schema.sql`), giống hệt cách
     `recordSaleOut` gọi `-input.quantity` cho `SALE_OUT`
     (`inventory.service.ts`). Lời gọi `recordMaterialMovement` cho print
     job **phải** truyền `quantity: -estimatedWeightGrams`, không phải
     `+estimatedWeightGrams` như bản nháp đầu — nếu không Postgres reject
     ngay ở check constraint, không phải domain error đẹp.
   - **Lỗi #2 đã sửa — không có "warehouse mặc định":** `resolveWarehouseForSale`
     (dùng cho `product_variants`) không có khái niệm "kho mặc định", nó tự
     chọn kho đang giữ đủ tồn kho cho **variant** cụ thể — không có hàm
     tương đương cho `materials`. Cần viết **`resolveWarehouseForMaterial`**
     mới trong `inventory.service.ts` (mirror `resolveWarehouseForSale`:
     `select warehouse_id from material_movements where material_id = $1
     group by warehouse_id having sum(quantity) >= $2 order by sum(quantity)
     desc limit 1`), throw `DomainError` rõ ràng ("Không kho nào còn đủ
     nguyên liệu") nếu không kho nào đủ — đúng tinh thần "material
     consumption ledger" phải phản ánh thật, không giả định kho vô hạn.
   - **Lỗi #3 đã sửa — bỏ hẳn cách "check đã có movement chưa", dùng FSM
     guard trên `from`-status thay thế (thiết kế lại, không chỉ vá thứ tự
     lock):** Bản nháp đầu dùng điều kiện "job chưa từng có
     `material_movements`" để chặn double-consumption — nhưng đọc lại
     `docs/database/schema.md`/code xác nhận **REPRINT dùng lại đúng
     `print_jobs.id` cũ** (không có code path nào tạo `print_jobs` row mới
     cho 1 lượt in lại — enum `print_job_status` chỉ đổi status trên cùng 1
     row). Vậy "REPRINT trừ kho thêm 1 lần nữa" (quyết định sản phẩm, xem
     dưới) và "chưa từng có movement nào" **mâu thuẫn nhau về mặt thiết kế**:
     sau lượt in đầu, job luôn "đã từng có movement", nên check đó sẽ chặn
     nhầm luôn cả lượt REPRINT hợp lệ. Thay bằng: **guard theo trạng thái
     `from` hiện tại**, giống hệt kiểu `canTransitionOrderStatus`/
     `ORDER_STATUS_TRANSITIONS` đã có cho `orders`:
     - Trong `updatePrintJobStatus`, thêm `select status from print_jobs
       where id = $1 for update` **trước tiên** trong transaction (hàm hiện
       tại chưa lock gì cả — khác `updateOrderStatus`/`acceptQuote` đã lock).
     - Chỉ coi transition sang `PRINTING` là **hợp lệ để trừ kho** khi trạng
       thái hiện tại (đọc được sau khi lock) là `QUEUED` hoặc `REPRINT` —
       đúng 2 điểm trong vòng đời mà "bắt đầu in" là thật (lần đầu, hoặc sau
       khi quyết định in lại). Chuyển từ `PRINTING` sang chính nó không phải
       1 transition hợp lệ trong danh sách này, nên request thứ 2 của "2
       admin bấm đồng thời" — sau khi đợi lock, đọc thấy status đã là
       `PRINTING` do request 1 vừa commit — bị từ chối ngay ở bước kiểm tra
       `from`-status, **không** chạm tới bước trừ kho lần 2. Race được chặn
       bằng chính tính hợp lệ của transition, không cần thêm điều kiện
       "check tồn tại movement" dễ sai như bản nháp đầu.
     - Việc lock trước — kiểm tra/ghi sau, cùng transaction là điều bắt buộc
       để cơ chế trên đúng (y hệt lý do `createOrder`/`recordSaleOut` phải
       lock `product_variants` trước, xem comment "lock-by-proxy" đã thêm ở
       `order.service.ts` từ Phase 5) — nếu implement đọc status **trước**
       khi lock thì cơ chế vỡ, quay lại đúng race đã nêu.
     - **Không** thêm partial unique index kiểu
       `20260830000004_print_jobs_quote_unique.sql` cho trường hợp này —
       khác việc "1 quote chỉ được tạo đúng 1 print_job vĩnh viễn", ở đây
       **nhiều `material_movements` row hợp lệ cho cùng 1 `print_job.id`
       theo thời gian là đúng** (mỗi lượt REPRINT là 1 lần tiêu hao thật) —
       một unique index theo `reference_id` sẽ chặn nhầm lượt REPRINT hợp
       lệ thứ 2. Race đã được chặn bằng FSM guard + row lock ở trên, không
       cần (và không nên) thêm ràng buộc DB kiểu này.
   - Nếu print job chuyển sang `PRINTING` mà **chưa gán `material_id`** →
     chặn transition, báo lỗi rõ ràng ("Cần gán vật liệu trước khi bắt đầu
     in") — không cho phép in mà không có ghi nhận tiêu hao, đúng tinh thần
     "material consumption ledger" là mục tiêu cốt lõi của Phase 6.
   - `FAILED`/`REPRINT`: **không** tự động hoàn trả nguyên liệu (in hỏng vẫn
     tiêu hao nhựa thật) — REPRINT → `PRINTING` là 1 transition hợp lệ khác
     (xem FSM guard ở trên) nên tự nhiên trừ kho thêm 1 lần đúng theo thiết
     kế, không phải trường hợp đặc biệt cần xử lý riêng.
   - **Phát hiện thêm qua challenge review:** `updatePrintJobStatus` hiện
     tại **không có bất kỳ validation chuyển trạng thái nào** (nhận mọi
     string). FSM guard trên (`from ∈ {QUEUED, REPRINT}` mới được coi là hợp
     lệ để trừ kho khi chuyển sang `PRINTING`) là **guard chuyển trạng thái
     đầu tiên** được thêm vào hàm này — lớn hơn một chút so với "chỉ nối
     thêm 1 bước trừ kho", ghi nhận rõ đây là thay đổi hành vi mới, không
     phải mở rộng logic có sẵn. Guard này **chỉ** áp dụng cho transition
     hướng tới `PRINTING` (mục đích duy nhất: quyết định có trừ kho hay
     không) — **không** mở rộng thành 1 FSM đầy đủ chặn mọi transition khác
     của `print_jobs` (ví dụ COMPLETED → QUEUED vẫn được chấp nhận như cũ) —
     đó là thay đổi lớn hơn nhiều, ngoài scope của Phase 6, để dành nếu thực
     tế vận hành cho thấy cần.
    - **Hiển thị lệch tiêu hao (Estimated vs Actual Variance) trên Admin UI:** Khi trang `/admin/print-jobs/[id]` hoàn thành đơn (`COMPLETED`), STAFF nhập số gram thực tế `actual_weight_grams`. Giao diện hiển thị tỉ lệ chênh lệch (ví dụ `Chênh lệch: +12g (+8%)`). Nếu chênh lệch quá lớn, STAFF có thể chủ động điều chỉnh tồn kho nguyên liệu thủ công bằng tính năng `ADJUSTMENT_OUT` ở trang Quản lý Tồn kho Vật liệu.
    - Không đổi API `updatePrintJobStatus(id, status, actorId)` — actorId vẫn
      bắt buộc là STAFF/OWNER thật (route này luôn qua `requireAdmin()`,
      không có luồng public nào chạm print_jobs).

## Inputs
- `docs/roadmap.md`, `3d-printing-website-development-plan.md` PHASE 6.
- `src/services/quote.service.ts`, `print-job.service.ts`,
  `custom-request.service.ts` — logic đã có từ Phase 3, chỉ mở rộng, không
  viết lại.
- `docs/architecture/decisions.md` ADR-0007 (quote → print_jobs, không phải
  order), ADR-0008 (material ledger riêng).
- `src/services/product.service.ts` `uploadProductImage` — pattern upload
  Supabase Storage đã có, tái dùng cấu trúc (không tái dùng hàm vì bucket/
  giới hạn khác nhau).
- `src/app/api/public/custom-requests/route.ts`,
  `src/app/api/public/orders/[orderNumber]/route.ts` — pattern rate-limit
  public route đã có (Phase 4/5).
- Commit `88b7c96` (`src/app/(storefront)/custom-print/custom-request-form.tsx`)
  — nguồn của bug base64 data-URI cần vá.

## Outputs
- Migration mới: bucket Storage `custom-request-attachments` + policy public
  read; **không** cần cột DB mới (`custom_requests.attachment_url` đã có từ
  Phase 4, chỉ đổi nguồn giá trị từ base64 sang URL Storage thật).
- `uploadCustomRequestAttachment` (service mới, `custom-request.service.ts`
  hoặc file riêng) — validate loại/kích thước file, upload, trả `{ url }`.
- `POST /api/public/custom-requests/attachments` (route mới, public,
  rate-limit theo IP).
- Sửa `custom-request-form.tsx`: bỏ `FileReader.readAsDataURL`, gọi route
  upload thật khi khách dán/kéo-thả/chọn file, hiển thị trạng thái đang tải
  lên, disable nút gửi cho tới khi upload xong.
- `print_jobs` service: `assignPrintJobMaterial` (gán `material_id` +
  `estimated_weight_grams`) và cập nhật `updatePrintJobStatus` để tự trừ kho
  khi chuyển `PRINTING` (theo quyết định #2).
- Trang mới `/admin/print-jobs/[id]`: chi tiết print job, form gán vật liệu/
  khối lượng ước tính, form nhập actual weight/print time khi hoàn thành,
  lịch sử `material_movements` liên quan tới job này.

## Risks
- **`POST /api/public/custom-requests/attachments` là endpoint ghi công khai
  thứ 3, và rủi ro thật hơn "spam storage" đơn thuần (xem quyết định #1
  sau challenge review):** vì không kiểm tra được nội dung/MIME thật của
  file `.stl/.step/.obj/.3mf`, endpoint này có thể bị lợi dụng làm nơi lưu
  trữ file ẩn danh công khai (tới 20MB × giới hạn rate-limit mỗi IP), không
  chỉ là chi phí lưu trữ mà còn là rủi ro uy tín nếu bị dùng để host nội
  dung xấu. Giảm nhẹ bằng `Content-Type` gán cứng phía server (không tin
  client) + rate-limit theo IP — chấp nhận đây vẫn chỉ là MVP, cần theo dõi
  dung lượng/nội dung bucket sau khi launch, sẵn sàng hạ giới hạn hoặc thêm
  xác thực nếu bị lạm dụng thật.
- **File upload xong nhưng khách không submit form** (bỏ giữa chừng) → file
  mồ côi trong Storage, không gắn với `custom_requests` row nào. Chấp nhận ở
  MVP (giống rủi ro NEW order không xử lý đã ghi nhận ở Phase 5) — không xây
  cleanup job ở Phase 6, để dành nếu dung lượng thực tế thành vấn đề.
  Nếu upload xong nhưng revalidate/publicCustomRequestInputSchema từ chối
  input phía sau (ví dụ rate-limit custom-request bị chặn) → cùng tình
  trạng mồ côi, chấp nhận tương tự.
- **Chặn transition `PRINTING` khi chưa gán material** (quyết định #2) có
  thể làm STAFF bị vướng nếu quên gán trước — cần thông báo lỗi đủ rõ ràng
  trên UI (không chỉ lỗi API) để không gây khó chịu vận hành thật.
- **Trừ kho tự động dựa trên `estimated_weight_grams`, không phải actual**
  — nếu STAFF nhập ước tính sai lệch nhiều so với thực tế in, `material_movements`
  sẽ không khớp tiêu hao thật. Chấp nhận ở Phase 6 (MVP); actual weight vẫn
  được nhập khi job COMPLETED để STAFF thấy chênh lệch, nhưng **không** tự
  động ghi thêm 1 movement điều chỉnh — đó là việc đối soát tay hoặc Phase 8.

## Checklist

### Trước khi giao Codex
- [x] Rà soát code hiện có trước khi lập kế hoạch — xác nhận phần lớn
      request/quote/print-job workflow đã có từ Phase 3, không làm lại
- [x] Chốt xây upload file thật (Supabase Storage), vá bug base64 data-URI ở
      form `/custom-print`
- [x] Chốt phạm vi material tracking: gán `material_id` + tự động trừ kho khi
      chuyển `PRINTING`, chặn transition nếu chưa gán material
- [x] Ask AI for challenge trước khi implement (agent review 2026-08-31) —
      phát hiện 3 lỗi/thiết kế cụ thể trong bản nháp đầu, đã sửa trực tiếp
      vào quyết định #2 ở trên (không chỉ ghi chú riêng):
      (1) dấu `quantity` sai cho `PRODUCTION_OUT` (phải âm, check constraint
      DB sẽ reject nếu không sửa),
      (2) không có "warehouse mặc định" cho material — cần viết
      `resolveWarehouseForMaterial` mới,
      (3) cơ chế chống double-consumption ban đầu ("chưa từng có
      `material_movements`") mâu thuẫn với chính quyết định "REPRINT trừ
      kho thêm lần nữa" — thay bằng FSM guard theo `from`-status
      (`QUEUED`/`REPRINT` → `PRINTING` mới hợp lệ để trừ kho) + row lock
      trước, đúng pattern `createOrder`/`updateOrderStatus` đã dùng.
      Rủi ro upload công khai cũng được đánh giá lại nghiêm túc hơn (xem
      Risks) thay vì chỉ coi là "tốn dung lượng".

### Tests
- [ ] Test `POST /api/public/custom-requests/attachments`: file hợp lệ (ảnh
      nhỏ, `.stl` nhỏ) → 201 + URL thật resolve được; file sai loại/quá
      kích thước → lỗi rõ ràng, không upload; vượt rate-limit IP → 429.
- [ ] Test full flow: upload attachment → submit
      `POST /api/public/custom-requests` với `attachmentUrl` trả về ở bước
      trước → `attachment_url` lưu đúng, không còn là base64.
- [ ] Test gán material cho print job thiếu material → transition sang
      `PRINTING` bị chặn, lỗi rõ ràng.
- [ ] Test transition sang `PRINTING` với material đã gán → đúng 1
      `material_movements` row `PRODUCTION_OUT`, số lượng đúng
      `estimated_weight_grams`, `reference_type/reference_id` đúng.
- [ ] Test 2 request đồng thời cùng chuyển 1 print job từ `QUEUED` sang
      `PRINTING` (race double-click) → chỉ đúng 1 request thành công + 1
      `material_movements` row, request kia nhận lỗi rõ ràng (transition
      không hợp lệ vì status đã đổi), không trừ kho 2 lần.
- [ ] Test lượt in lại hợp lệ: `QUEUED → PRINTING` (trừ kho lần 1) →
      `FAILED → REPRINT → PRINTING` (trừ kho lần 2) → đúng **2**
      `material_movements` row `PRODUCTION_OUT` cho cùng 1 `print_job.id`,
      không bị chặn nhầm như 1 double-consumption giả.
- [ ] Chạy lại toàn bộ test/E2E hiện có của Phase 3/4/5 sau khi sửa
      `updatePrintJobStatus` — xác nhận không regression (đặc biệt
      `tests/phase-3-quote-print-job.test.ts`).

### Pre-delivery (từ skill `ui-ux-pro-max`, áp dụng cho UI admin mới)
- [ ] `cursor-pointer` cho mọi phần tử có thể click
- [ ] Hover state có transition mượt (150–300ms)
- [ ] Focus state hiển thị rõ khi điều hướng bằng bàn phím
- [ ] Trạng thái đang tải lên (uploading) hiển thị rõ cho khách trên form
      `/custom-print`, tránh double-submit khi upload chưa xong

## Definition of Done
Khách vào `/custom-print`, dán/kéo-thả một ảnh hoặc chọn file `.stl` thật →
upload thành công, không lỗi validation → gửi yêu cầu → STAFF thấy request
trong `/admin/custom-requests`, mở file đính kèm bằng link thật (không phải
base64). STAFF tạo báo giá → khách (giả lập qua admin) chấp nhận → print job
tự tạo (hành vi cũ, không đổi) → STAFF gán vật liệu cho print job → chuyển
status sang PRINTING → tồn kho nguyên liệu tự động giảm đúng số gram ước
tính, có movement row tra được. `npm test` + E2E pass toàn bộ, không
regression Phase 3/4/5.
