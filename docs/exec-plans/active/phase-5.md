# Phase 5 — Cart / Checkout / Order

Theo `docs/roadmap.md`: Phase 5 là "cart + checkout + orders". Chi tiết scope
tham khảo `3d-printing-website-development-plan.md` PHASE 5 (dòng 1330+).
Custom print vẫn đi qua `custom_requests` → `quotes` → `print_jobs` (Phase 6),
không đụng tới ở phase này.

## Goal
Khách vãng lai (không cần tài khoản) có thể: xem giỏ hàng → điền thông tin
giao hàng → đặt đơn thật (ghi vào `orders`/`order_items`, trừ tồn kho đúng
luật) → nhận trang xác nhận có mã đơn. Admin thấy đơn mới ngay trong
`/admin/orders` hiện có, không cần thao tác tay trong database.

## Non-goals
- Payment gateway thật (Momo/VNPay/Stripe...) — chỉ COD + chuyển khoản thủ
  công (khách tự chuyển, admin tự đối soát và cập nhật `payment_status`).
- Tài khoản khách hàng / đăng nhập / lịch sử đơn hàng nhiều thiết bị — MVP
  guest checkout thuần theo đúng dev plan gốc (mục 5.2).
- Cart đồng bộ đa thiết bị — xem quyết định #1 (client-side cart).
- Kênh báo đơn hàng mới ra ngoài admin UI (email/Telegram/SMS) — dev plan
  gốc (mục 5.5) coi đây là optional, để dành Phase 8 nếu thực tế cần.
- Custom print checkout (đặt in theo yêu cầu vẫn qua luồng quote riêng,
  không đi qua cart/order) — Phase 6.
- Cart cleanup/abandoned-cart job — không áp dụng vì Phase 5 không dùng bảng
  `carts`/`cart_items` (xem quyết định #1).

## Quyết định đã chốt

1. **Cart lưu client-side (localStorage), không dùng bảng `carts`/`cart_items`
   có sẵn từ Phase 0** (chốt qua hỏi trực tiếp chủ dự án 2026-08-31):
   - Bảng `carts`/`cart_items` được thiết kế sẵn từ Phase 0 nhưng chưa có
     service/API nào dùng tới — giữ nguyên schema, không xoá, không migrate,
     chỉ đơn giản là **không dùng ở Phase 5**. Nếu sau này cần cart đồng bộ
     đa thiết bị (ví dụ có tài khoản khách hàng), quay lại dùng 2 bảng này.
     Ghi lại thành ADR để không ai hiểu nhầm là bị bỏ quên.
   - Cart state (variantId, quantity, một số field hiển thị: tên sản phẩm,
     ảnh, giá **chỉ để hiển thị tạm**) sống ở `localStorage` qua React
     Context (`CartProvider`), không cần thêm dependency mới (không Zustand/
     Redux — dự án chưa có state lib nào, đúng nguyên tắc "không thêm
     dependency vô cớ" ở AGENTS.md).
   - **Xử lý SSR Hydration Safety:** Tránh lỗi Hydration Mismatch (`Text content does not match server-rendered HTML`) của Next.js 15 bằng cách khởi tạo state ban đầu rỗng trên SSR, và đọc `localStorage` trong `useEffect` hoặc qua flag `isMounted`/`useSyncExternalStore`.
   - **Xoá giỏ hàng sau khi đặt thành công:** Ngay khi `POST /api/public/orders` trả về `201`, `CartProvider` gọi `clearCart()` để dọn sạch `localStorage`, tránh việc hàng cũ vẫn nằm trong giỏ.
   - **Giá hiển thị trên cart luôn chỉ mang tính tham khảo.** Giá thật luôn
     được server tính lại tại thời điểm checkout từ `product_variants.price`
     hiện tại trong DB (xem quyết định #2) — nếu giá trong khoảng thời gian
     khách giữ hàng trong giỏ đã đổi, khách sẽ thấy tổng tiền cập nhật ở màn
     hình checkout trước khi xác nhận, không có chuyện giá "đóng băng" sai.

2. **Endpoint checkout công khai tái dùng gần như nguyên vẹn logic
   `createOrder`/`checkoutOrderInputSchema` đã có sẵn từ Phase 2** (phát
   hiện khi đọc `order.service.ts` + `src/domain/schemas.ts` trước khi lập
   kế hoạch — không phải xây lại từ đầu):
   - `checkoutOrderInputSchema` hiện tại **chỉ nhận `variantId` + `quantity`
     mỗi item**, không nhận `unitPrice`/`subtotal`/`total` từ client —
     `createOrder` tự tính giá từ `product_variants.price` trong transaction
     (có `for update` lock theo đúng thứ tự variant id để tránh deadlock,
     xem `order.service.ts`). Tức là đường tính tiền **đã an toàn sẵn** với
     input không tin cậy, không cần sửa gì ở phần này.
   - Route mới **`POST /api/public/orders`** (namespace `api/public/*`,
     đúng quy ước Phase 4 — mọi route không cần đăng nhập nằm ở đây để dễ
     `grep -r "api/public"` audit sau này):
     - **BLOCKER đã fix trong kế hoạch (phát hiện qua challenge review
       2026-08-31):** `checkoutOrderInputSchema` hiện tại **cho phép client
       tự set `shippingFee`/`discount`/`codFee`** (đều là số nguyên không âm
       không giới hạn trên) — nếu bọc nguyên schema này cho route public,
       khách có thể gửi `discount` cực lớn để `total` bị kéo về gần 0 trong
       khi tồn kho vẫn bị trừ thật. **Không được tái dùng nguyên
       `checkoutOrderInputSchema` cho public.** `publicCheckoutOrderInputSchema`
       phải là allowlist riêng, **không có `shippingFee`/`discount`/`codFee`**
       — 3 giá trị này bị route ép cứng `0` phía server khi gọi `createOrder`
       cho luồng public (đúng chính sách "không cổng thanh toán thật, không
       phí ship động ở MVP" — quyết định #4). Route admin
       (`POST /api/orders`, `requireAdmin()`) vẫn dùng nguyên
       `checkoutOrderInputSchema` như cũ vì STAFF là actor tin cậy có thể
       nhập giảm giá/phí ship tay.
     - Schema mới `publicCheckoutOrderInputSchema` = `{ customerName,
       customerPhone, customerEmail?, shippingAddress, customerNote?, items,
       honeypot }` — copy field-by-field từ `checkoutOrderInputSchema`, **trừ**
       `shippingFee`/`discount`/`codFee`, cộng thêm `honeypot` (giống pattern
       `publicCustomRequestInputSchema` ở Phase 4).
     - Honeypot có giá trị → trả `201` giả (id/orderNumber ngẫu nhiên),
       không insert, không lộ cho bot.
     - Rate-limit theo `customer_phone`: tối đa 5 đơn / 30 phút (nới hơn
       ngưỡng custom-request 3/10 phút ở Phase 4, vì một khách thật có thể
       hợp lý đặt vài đơn liên tiếp khi sửa lại giỏ hàng) — cùng kỹ thuật
       đếm qua `pg.Pool`, không thêm hạ tầng Redis/KV.
     - Route **không** qua `requireAdmin()`, gọi
       `createOrder(input, null)` — cần nới kiểu `createOrder(input,
       actorId: string | null)` giống hệt cách `createCustomRequest` đã làm
       ở Phase 4 (`audit_logs.actor_id` đã nullable sẵn từ addendum Phase 4,
       không cần migration mới).
     - Audit log action mới **`ORDER_CREATED_PUBLIC`** (khác
       `ORDER_CREATED` của luồng admin nhập tay), theo đúng tinh thần phân
       biệt nguồn gốc dữ liệu đã dùng cho custom-request.
   - Route admin `POST /api/orders` (đã có, qua `requireAdmin()`) **giữ
     nguyên không đổi** — vẫn dùng cho STAFF tự nhập đơn (điện thoại/Zalo).

3. **Trang xác nhận đơn hàng dùng `orderNumber` làm khoá tra cứu, không xây
   tài khoản/OTP** (chốt qua review khi lập kế hoạch):
   - `orderNumber` hiện sinh bằng `ORD-` + 12 ký tự hex ngẫu nhiên từ
     `randomUUID()` (48 bit entropy) — đủ khó đoán để dùng như một "vé nhận
     hàng" (receipt token), tương tự cách nhiều site e-commerce cho khách
     tra đơn bằng mã đơn mà không cần đăng nhập. Không cần thêm cơ chế bảo
     mật khác (OTP theo SĐT, v.v.) ở MVP.
   - `POST /api/public/orders` trả thẳng `{ id, orderNumber, total }` —
     trang xác nhận `/order-confirmation/[orderNumber]` ưu tiên nhận state
     ngay từ response (client điều hướng kèm state), tránh phải gọi thêm
     API.
   - Thêm **`GET /api/public/orders/[orderNumber]`** làm fallback khi khách
     reload trang xác nhận hoặc bấm lại link cũ — trả về tập field tối
     thiểu cho khách tự xem đơn của mình (số đơn, danh sách item, tổng
     tiền, trạng thái, ngày tạo, `shipping_address` của chính đơn đó vì đây
     là dữ liệu khách tự nhập cần hiển thị lại). **Không** trả
     `customer_email` hay bất kỳ dữ liệu của đơn khác — chỉ tra theo đúng 1
     `orderNumber` khớp chính xác (không list, không tìm kiếm theo SĐT/tên
     để tránh dò danh sách khách hàng). Route này cũng nên có rate-limit nhẹ
     theo IP (defense-in-depth — entropy `orderNumber` đã đủ khó đoán nên
     không cần chặt như POST, xem Risks).

4. **Thanh toán MVP: COD + chuyển khoản thủ công, không có cổng thanh toán
   thật** (đúng dev plan gốc mục 5.3, xác nhận lại vì đây là quyết định sản
   phẩm rõ ràng đã có sẵn, không cần hỏi lại):
   - Checkout form có chọn phương thức: `COD` hoặc `BANK_TRANSFER` — lưu vào
     `orders.customer_note`/`admin_note` dạng ghi chú (không thêm cột DB mới
     vì `orders.payment_status` đã đủ để track trạng thái tiền, phương thức
     chỉ là thông tin tham khảo cho admin đối soát tay).
   - Đơn ≥ 300.000 VNĐ nhắc khách cần đặt cọc theo đúng
     `docs/database/business-rules.md` #8 / ADR-0009 — hiển thị thông tin
     chuyển khoản cọc trên trang xác nhận, admin tự cập nhật
     `payment_status = DEPOSIT_PAID`/`PAID` bằng tay sau khi nhận tiền (đúng
     luồng admin đã có từ Phase 3, không xây tự động đối soát ngân hàng).
   - **Tích hợp VietQR tĩnh trên trang Xác nhận:** Tự động tạo ảnh Mã QR chuyển khoản theo cú pháp VietQR (`https://img.vietqr.io/image/[BANK]-[ACCOUNT]-compact2.png?amount=[AMOUNT]&addInfo=[ORDER_NUMBER]`) với số tiền (đầy đủ hoặc tiền cọc 30-50%) và nội dung là mã đơn `orderNumber`. Giúp khách quét mã chuyển khoản tức thì bằng ứng dụng ngân hàng di động mà không cần gõ thủ công.

5. **Không xây kênh báo đơn hàng mới ra ngoài admin UI ở Phase 5** (chốt qua
   hỏi trực tiếp chủ dự án 2026-08-31) — `/admin/orders` hiện có đã đủ để
   STAFF/OWNER thấy đơn mới; polling/refresh thủ công là chấp nhận được ở
   quy mô hiện tại. Zalo floating button (thêm ngoài phạm vi Phase 4, xem
   mục "Việc tồn đọng" bên dưới) chỉ là kênh liên hệ chủ động của khách, không
   phải kênh báo đơn hàng cho admin — không tính vào scope này.

## Inputs
- `docs/roadmap.md`, `3d-printing-website-development-plan.md` PHASE 5 (dòng
  1330+).
- `docs/exec-plans/completed/phase-4.md` — storefront hiện có, đặc biệt nút
  "Thêm vào giỏ / Đặt in ngay" đang là dialog placeholder
  (`src/app/(storefront)/products/[slug]/confirm-intent-dialog.tsx`) cần
  thay bằng luồng cart thật.
- `src/services/order.service.ts`, `src/domain/schemas.ts`
  (`checkoutOrderInputSchema`, `orderInputSchema`) — logic tạo đơn/tính tiền
  đã có sẵn từ Phase 2, chỉ cần route công khai mới bọc quanh nó.
- `src/app/api/public/custom-requests/route.ts` — pattern mẫu cho route
  public (honeypot + rate-limit theo SĐT + audit log action riêng) áp dụng
  lại cho `POST /api/public/orders`.
- `docs/database/business-rules.md`, ADR-0004/0005/0009 — luật trạng thái
  đơn, ledger tồn kho, chính sách đặt cọc.

## Outputs
- `src/domain/schemas.ts`: thêm `publicCheckoutOrderInputSchema`
  (`checkoutOrderInputSchema` + `honeypot`).
- `src/services/order.service.ts`: nới kiểu `createOrder(input, actorId:
  string | null)`, audit action `ORDER_CREATED_PUBLIC` khi `actorId === null`.
- `POST /api/public/orders` (route mới, honeypot + rate-limit theo SĐT).
- `GET /api/public/orders/[orderNumber]` (route mới, tra cứu 1 đơn theo mã,
  field tối thiểu, không list/không tìm theo SĐT).
- Cart client-side: `CartProvider` (React Context + localStorage), hook
  `useCart()` — add/update/remove item, tính subtotal hiển thị tạm.
- UI storefront mới:
  - Cart drawer/page (`/cart`) — sửa số lượng, xoá item, xem tạm tính, nút
    "Tiến hành đặt hàng".
  - `/checkout` — form thông tin khách (tên, SĐT, email optional, địa chỉ,
    ghi chú, phương thức thanh toán COD/chuyển khoản), gọi `POST
    /api/public/orders`, hiển thị lỗi hết hàng/giá đổi rõ ràng nếu server
    từ chối.
  - `/order-confirmation/[orderNumber]` — mã đơn, danh sách item, tổng
    tiền, hướng dẫn thanh toán (COD hoặc thông tin chuyển khoản nếu chọn
    `BANK_TRANSFER`/cần đặt cọc).
  - Thay `confirm-intent-dialog.tsx` (placeholder Phase 4) bằng hành động
    "Thêm vào giỏ" thật trên trang chi tiết sản phẩm; icon giỏ hàng trên
    header (đã có placeholder từ Phase 4) hiển thị số lượng item thật + link
    `/cart`.
- Cập nhật `docs/architecture/decisions.md` với ADR mới cho quyết định #1
  (cart client-side, bảng `carts`/`cart_items` cố tình không dùng ở Phase 5).

## Risks
- **Oversell khi nhiều khách checkout cùng lúc cho cùng 1 variant sắp hết
  hàng** — đã có `for update` lock + `assertAvailableStock` trong
  `createOrder`, nhưng cần test concurrency thật (2 request đồng thời cùng
  variant, tổng quantity > tồn kho) trước khi coi là xong, không chỉ tin
  vào đọc code. **Cơ chế thật (xác nhận qua challenge review khi lập kế
  hoạch, đọc trực tiếp code):** `product_variants` bị lock `for update` theo
  thứ tự id trước, sau đó mới đọc `reserved` (tổng hợp từ `order_items`/
  `orders` — bảng này **không** bị lock trực tiếp). Việc chống oversell dựa
  vào "lock-by-proxy": mọi writer (kể cả `recordInventoryMovement` phía
  admin) đều phải lock `product_variants` trước khi ghi, nên transaction thứ
  2 bị chặn ở bước lock cho tới khi transaction thứ 1 commit xong, từ đó mới
  đọc được `reserved` mới nhất. Đây là kỹ thuật hợp lệ nhưng dễ vỡ nếu sau
  này có đường ghi `order_items`/`orders` mới mà quên lock `product_variants`
  trước — Codex cần biết rõ cơ chế này (không chỉ copy pattern) khi viết
  route public mới, và nên thêm 1 dòng comment giải thích ngay tại chỗ lock
  trong `order.service.ts` nếu chưa có.
- **`POST /api/public/orders` là endpoint ghi dữ liệu công khai thứ 2** (sau
  `POST /api/public/custom-requests` ở Phase 4) — rủi ro spam/đặt đơn ảo
  tương tự, honeypot + rate-limit theo SĐT là biện pháp MVP, có thể không đủ
  nếu bị lạm dụng thật; theo dõi log sau khi launch.
- **Giá cart hiển thị (localStorage) có thể lệch giá thật tại thời điểm
  checkout** nếu admin đổi giá trong lúc khách giữ hàng trong giỏ — đã có
  chủ trương ở quyết định #1 (server luôn tính lại), nhưng UI cần thông báo
  rõ ràng cho khách khi tổng tiền ở bước checkout khác với tổng tiền hiển
  thị ở cart, tránh cảm giác bị "đổi giá sau lưng".
- **`orderNumber` làm khoá tra cứu công khai** (quyết định #3) — chấp nhận
  được vì entropy đủ lớn để chống đoán mò, nhưng `GET
  /api/public/orders/[orderNumber]` phải test kỹ để không vô tình lộ field
  nhạy cảm (đặc biệt không được trả toàn bộ `customer_email`/`shipping_address`
  nếu không cần thiết cho UI xác nhận) — lặp lại đúng bài học rò rỉ
  `cost_price`/tồn kho chính xác đã fix ở Phase 3 addendum.
- **`createOrder` hiện tại giữ chỗ tồn kho vô thời hạn ở trạng thái
  NEW/CONFIRMED** (TODO đã ghi sẵn trong code từ Phase 2: "NEW orders
  reserve stock indefinitely until a later expiry/cleanup job exists") — với
  checkout công khai, nguy cơ này tăng lên (khách bỏ giữa chừng, đơn NEW
  không ai xử lý). Phase 5 **không bắt buộc** xây cleanup job (ngoài scope,
  để Phase 8), nhưng phải note rõ trong Definition of Done là rủi ro đã biết,
  không phải bug mới.

## Việc tồn đọng (ngoài phạm vi Phase 4 gốc, phát hiện khi rà soát trước Phase 5)
- Commit `88b7c96` ("enhance admin UI/UX performance, custom order image
  upload, and Zalo integration") đã merge vào `main` **sau khi** Phase 4 đóng
  (`5bdb48e`) nhưng **không có exec-plan riêng**. **Đã review qua challenge
  agent (2026-08-31):** thay đổi ở `src/lib/auth/require-admin.ts` chỉ là
  bọc `requireAdmin` bằng React `cache()` (memo theo request/render, không
  tồn tại xuyên request/user) — **không phải regression bảo mật**, logic
  `resolveStaffSession`/RBAC không đổi. Coi như đã review, không cần chặn
  Phase 5. Phần upload ảnh custom order trong cùng commit vẫn nên được
  `database-review`/`security-review` một lượt cho gọn sổ sách (không phải
  vì nghi có lỗi, mà vì đây là thay đổi duy nhất trong dự án chưa từng qua
  review chính thức) — không phải blocker, làm khi rảnh.
- `tsconfig.tsbuildinfo` đang bị modify không commit (`git status` đầu
  phiên) — file build cache, không phải nguồn, nên `git checkout` lại hoặc
  thêm vào `.gitignore` nếu chưa có, tránh nhiễu diff khi review Phase 5.
- **Môi trường dev cục bộ đang chạy Node.js 18** (`node --version` →
  `v18.20.8`), trong khi `@supabase/supabase-js`/`realtime-js` mới nhất yêu
  cầu native `WebSocket` (Node 22+) — gây `not ok` cho 2 test không liên
  quan gì đến code (`tests/phase-3-auth.test.ts`: "resolveStaffSession
  enforces is_active..." và "every admin/mutating route rejects an
  unauthenticated request"), phát hiện khi chạy `npm test` để rà soát trước
  Phase 5. Đây là vấn đề môi trường, không phải bug — nên nâng Node lên
  22 LTS trước khi bắt đầu code Phase 5 để tránh nhiễu tín hiệu pass/fail
  thật khi test route `/api/public/orders` mới.
- 4 test khác fail vì "Server did not become ready" (`tests/phase-4-public-
  custom-request.test.ts`) — cần server dev chạy sẵn với `DATABASE_URL`/env
  đúng để test suite tự spawn được; chưa xác nhận đây là do thiếu env cục bộ
  hay do lỗi thật, cần chạy lại sau khi có env đầy đủ trước khi bắt đầu
  Phase 5 để có baseline "xanh" sạch.

## Checklist

### Trước khi giao Codex
- [x] Chốt cart lưu client-side, không dùng bảng `carts`/`cart_items` có sẵn
- [x] Chốt checkout công khai tái dùng `createOrder`/`checkoutOrderInputSchema`
      hiện có, chỉ bọc route public mới (honeypot + rate-limit + actorId null)
- [x] Chốt trang xác nhận dùng `orderNumber` làm khoá tra cứu, không OTP/tài khoản
- [x] Chốt thanh toán MVP: COD + chuyển khoản thủ công, không cổng thanh toán thật
- [x] Chốt không xây kênh báo đơn hàng mới ngoài admin UI ở Phase 5
- [x] Review commit `88b7c96` (ngoài phạm vi Phase 4) — `require-admin.ts`
      xác nhận benign (chỉ thêm React `cache()`), không cần chặn Phase 5;
      xem mục "Việc tồn đọng"
- [x] Ask AI for challenge trước khi implement (agent review 2026-08-31) —
      phát hiện 1 BLOCKER thật (public schema cho phép client tự set
      `shippingFee`/`discount`/`codFee`, có thể kéo `total` gần về 0) đã sửa
      trực tiếp vào quyết định #2 ở trên; cơ chế chống oversell đã xác nhận
      đúng qua đọc code (xem Risks)
- [ ] Nâng Node.js dev env lên 22 LTS (đang 18, gây 2 test fail không liên
      quan code) và xác nhận `npm test` chạy sạch (kể cả nhóm test cần server
      tự spawn) trước khi Codex bắt đầu — có baseline pass/fail thật, tránh
      lẫn lỗi môi trường với lỗi code mới ở Phase 5

### Tests
- [ ] Concurrency test cho oversell: 2 request `POST /api/public/orders`
      đồng thời cùng variant sắp hết hàng, tổng quantity > tồn kho hiện có
      → chỉ 1 đơn thành công, đơn kia nhận lỗi rõ ràng, không âm tồn kho.
- [ ] Test giá server luôn thắng giá client: gửi `unitPrice` giả trong body
      (nếu schema strict chặn được thì test schema reject; nếu không, test
      giá lưu vào `order_items` khớp `product_variants.price` tại thời điểm
      submit, không khớp giá trong payload).
- [ ] Test honeypot + rate-limit cho `POST /api/public/orders` (giống pattern
      test đã có cho `POST /api/public/custom-requests` ở Phase 4).
- [ ] Test `GET /api/public/orders/[orderNumber]`: đơn tồn tại → đúng field
      tối thiểu, không lộ field nhạy cảm; `orderNumber` không tồn tại → 404
      rõ ràng, không leak thông tin đơn khác.
- [ ] Test audit log: đơn qua `/api/public/orders` ghi `ORDER_CREATED_PUBLIC`
      + `actor_id = null`; đơn qua `/api/orders` (admin) vẫn ghi
      `ORDER_CREATED` + `actor_id` thật, không regress.
- [ ] E2E smoke test luồng critical gốc "browse → cart → checkout → order"
      (đúng 1 trong 5 luồng critical của skill `e2e-testing`): khách vào
      `/products`, thêm sản phẩm vào cart, vào `/checkout`, điền thông tin,
      submit thành công, thấy trang xác nhận đúng mã đơn, admin thấy đơn
      trong `/admin/orders`.
- [ ] Chạy lại toàn bộ test/E2E hiện có của Phase 3 + Phase 4 sau khi nới
      kiểu `createOrder`/`require-admin.ts` — xác nhận không regression.

### Pre-delivery (từ skill `ui-ux-pro-max`, bắt buộc cho storefront)
- [ ] Không dùng emoji làm icon (dùng SVG: Lucide)
- [ ] `cursor-pointer` cho mọi phần tử có thể click
- [ ] Hover state có transition mượt (150–300ms)
- [ ] Light & Dark mode: text contrast tối thiểu 4.5:1
- [ ] Focus state hiển thị rõ khi điều hướng bằng bàn phím
- [ ] Tôn trọng `prefers-reduced-motion`
- [ ] Responsive: 375px, 768px, 1024px, 1440px

## Definition of Done
Từ thiết bị khách (không cần tài khoản): `Product → Cart → Checkout → Order
created → Admin sees order` chạy thật, không thao tác thủ công trong
database. Oversell được chặn dưới tải đồng thời (có test chứng minh). Không
route/hàm public nào trả giá/tồn kho không tin cậy từ client hoặc lộ dữ liệu
đơn hàng của khách khác. `npm test` + E2E pass toàn bộ, không regression
Phase 3/4. Tất cả mục "Trước khi giao Codex" đạt `[x]`.
