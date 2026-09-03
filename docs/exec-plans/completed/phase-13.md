# Phase 13 — 5-Minute Fast Quoting Flow (MakerWorld URL Resolver, Smart AMS Waste Estimator & Public Shareable Quote)

Bổ sung vào `docs/roadmap.md` sau Phase 12. Kế thừa toàn bộ nền tảng tính giá cost-plus của Phase 9 (`pricing.service.ts`, `pricing_configs`, `materials`) và giải quyết trọn vẹn bài toán: **Tự động hóa báo giá cho khách chỉ với 1 link MakerWorld trong vòng dưới 5 phút**.

---

## Rà soát trước khi lập kế hoạch

Đã đọc code thật trước khi viết plan (không suy đoán):
- `src/services/pricing.service.ts` (Phase 9) đã hoạt động tốt: nhận mảng vật liệu, giờ in, nhân công, và config để tính ra giá cost-plus kèm quy tắc làm tròn ADR-0010.
- `src/services/quote.service.ts`: `createQuote` đã hỗ trợ lưu `pricingBreakdown` và `pricingConfigId`.
- Giao diện `/admin/custom-requests/[id]` hiện tại đã có panel tính giá qua upload `.3mf` hoặc gõ tay, nhưng **chưa thể tự bóc tách từ link MakerWorld**.
- Khách hàng khi nhận báo giá hiện tại chỉ biết qua tin nhắn văn bản trao đổi thủ công, chưa có **Trang công khai xem chi tiết báo giá (Public Quote Page)** có hình ảnh, thông số kỹ thuật, breakdown minh bạch và mã QR thanh toán cọc tự động.

---

## Goal

Tối ưu hóa toàn diện quy trình báo giá cho xưởng BaSa3D đạt chuẩn **dưới 5 phút**:
1. **MakerWorld URL Resolver:** Staff chỉ cần dán link MakerWorld (ví dụ mẫu *Ace Snail Controller Stand*), hệ thống tự động bóc tách: Tên model, ảnh đại diện, số plate (8), tổng thời gian in (13.2h), danh sách các màu nhựa (7 màu, 256g).
2. **Smart Multi-Color AMS Waste Estimator:** Tự động ước tính và bù lượng nhựa xả tháp (Prime Tower) & xả màu (Purge Waste) cho in nhiều màu AMS theo tỉ lệ hoặc preset (`Thấp 15% / Chuẩn 30% / Cao 50% / Custom g`).
3. **Auto Material Mapping:** Tự động so khớp màu/loại nhựa từ MakerWorld với danh mục cuộn nhựa (`materials`) trong kho xưởng để lấy đơn giá.
4. **Public Shareable Quote Page & Zalo 1-Click:** Tự động tạo link xem báo giá trực tuyến `/quotes/[quoteNumber]` có ảnh preview, phân tích kỹ thuật, hạn hiệu lực, kèm nút "1-Click Copy tin nhắn Zalo" và mã VietQR cọc tự động.

---

## Non-goals

- **Tự động tải file nhị phân G-code/3MF về lưu trữ trên server:** Chỉ parse metadata (JSON/HTML/API) để lấy thông số, không tự động tải toàn bộ file 3D nặng hàng trăm MB về máy chủ.
- **Tự động gửi tin nhắn Zalo qua Zalo OA ZNS trả phí:** v1 tạo nút "1-Click Copy tin nhắn Zalo chuẩn mẫu" để Staff dán gửi qua Zalo cá nhân/Zalo xưởng cho khách (không phát sinh chi phí ZNS API).
- **Hỗ trợ các sàn 3D khác ngoài MakerWorld (v1):** v1 tập trung hoàn thiện 100% cho MakerWorld (hệ sinh thái Bambu Lab phổ biến nhất hiện nay). Printables/Thingiverse sẽ bổ sung ở phase sau nếu có nhu cầu.

---

## Quyết định đã chốt

1. **MakerWorld Resolver (Server-side API + Fallback Scraper):**
   - Tạo `src/lib/parsers/makerworld-resolver.ts`:
     - Phân tích URL MakerWorld để lấy `modelId` và `profileId` (ví dụ: `models/2851863...#profileId-3334843`).
     - Gọi trực tiếp endpoint metadata của MakerWorld (với header tiêu chuẩn và timeout 5s).
     - Bóc tách: `title`, `coverImageUrl`, `platesCount`, `totalPrintMinutes`, `filaments: [{ name, colorHex, materialType, netWeightGrams }]`.
     - Nếu MakerWorld trả lỗi hoặc timeout: Giao diện hiển thị cảnh báo nhẹ và cho phép Staff gõ tay (graceful degradation), không bao giờ làm treo UI.
   - **Bổ sung sau Claude review (2026-09-03):** đây là request ra ngoài đầu tiên trong toàn bộ
     codebase (không có `fetch()` tới domain thứ ba nào trước đó để tham chiếu pattern). URL do
     staff dán vào — phải validate hostname allowlist (chỉ `*.makerworld.com`) trước khi `fetch`,
     không follow redirect sang IP nội bộ/metadata endpoint (`169.254.169.254`), dùng
     `AbortController` timeout thật (không chỉ optimistic 5s trong comment). Resolver cũng cần phân
     biệt rõ 3 loại lỗi (timeout/Cloudflare-block vs 404 link sai vs profile không tồn tại) để UI
     hiển thị đúng thông báo thay vì luôn generic "gõ tay đi".
   - **Bổ sung sau Claude review vòng 2 (2026-09-03):** "không follow redirect sang IP nội bộ" ở
     trên mới là mục tiêu, chưa phải cơ chế — `fetch()` mặc định của Node tự follow redirect và
     không re-validate hostname ở mỗi hop, đây chính là kiểu SSRF-via-redirect kinh điển. Chốt cụ
     thể: dùng `redirect: 'manual'`; nếu response là redirect, tự validate `Location` header lại
     qua allowlist trước khi follow tiếp (hoặc dùng `redirect: 'error'` nếu xác nhận được endpoint
     metadata của MakerWorld không bao giờ redirect — cần kiểm tra giả định này trước khi code).
2. **Thuật toán Smart AMS Waste Estimator:**
   - Công thức bù hao phí cho in nhiều màu:
     `W_total_waste = W_net * waste_ratio`
   - Preset mặc định:
     - Đơn màu (1 màu): `waste_ratio = 5%` (bavia/brim/support nhẹ).
     - Đa màu (2–4 màu): `waste_ratio = 20%`.
     - Đa màu phức tạp (>= 5 màu, vd Ace Snail 7 màu): `waste_ratio = 35%`.
   - Cho phép Staff click đổi nhanh giữa `15% / 30% / 50%` hoặc gõ số gram cụ thể trước khi bấm tính giá.
3. **Khớp vật liệu tự động (Auto Material Mapping):**
   - Helper function so khớp `materialType` (vd: `PLA`) và `colorHex`/`name` gần nhất trong bảng `materials` đang active của xưởng. Nếu không tìm thấy, fallback về vật liệu PLA mặc định.
   - **Bổ sung sau Claude review (2026-09-03):** `materials.color` trong DB là `varchar` tự do do
     staff gõ tay (vd "Đỏ", "Xanh dương"), **không có cột `colorHex`** — "so khớp `colorHex` gần
     nhất" như viết ở trên chưa có thuật toán cụ thể (chưa định nghĩa khoảng cách màu hay string
     similarity). Chọn nhầm vật liệu → sai đơn giá → sai giá bán mà staff không biết là rủi ro data
     integrity thật (ưu tiên #1 CLAUDE.md), không phải chi tiết vụn. Quyết định: kết quả auto-match
     luôn hiển thị cho Staff xác nhận/sửa trước khi tính giá — **không bao giờ tự động chốt Quote**
     từ một match chưa được người xác nhận.
   - **Bổ sung sau Claude review vòng 2 (2026-09-03):** yêu cầu xác nhận thủ công ở trên giải quyết
     rủi ro *data integrity*, nhưng chưa giải quyết rủi ro *product*: nếu thuật toán match quá yếu
     (tên filament tiếng Anh từ MakerWorld vs `materials.color` tiếng Việt tự do), tỉ lệ auto-match
     đúng có thể rất thấp → Staff phải tự chọn lại tay hầu hết thời gian, phá vỡ mục tiêu "<2 giây
     tự điền form" / "<5 phút" của cả Phase. Chốt v1 đơn giản, không cần string-distance màu sắc:
     auto-match theo `material_type` (PLA/PETG/...) trước, sau đó chỉ lọc dropdown màu theo vật liệu
     active của loại đó cho Staff chọn tay — không cố suy đoán màu chữ.
4. **Public Quote View & Dynamic VietQR (`/quotes/[quoteNumber]`):**
   - Tạo trang công khai hiển thị báo giá đẹp mắt, chuyên nghiệp:
     - Thông tin mô hình (ảnh, tên file/mẫu, thời gian in, số plate, danh sách màu nhựa).
     - Bảng giá minh bạch: Chi phí in, hoàn thiện, đóng gói, phí ship, tổng tiền, số tiền cọc (50% hoặc theo chính sách).
     - **Mã VietQR động:** Tạo URL ảnh VietQR chuẩn Napas247 (chứa sẵn STK xưởng, ngân hàng, số tiền cọc, và nội dung chuyển khoản `[quoteNumber]`).
     - Trạng thái hiệu lực (`valid_until`): Đếm ngược thời gian hết hạn báo giá.
   - **Bổ sung sau Claude review (2026-09-03) — thay thế phần "an toàn" mơ hồ ở Risks bên dưới bằng
     quyết định cụ thể:**
     - **Tái dùng nguyên bản** `src/lib/order-confirmation-token.ts` (HMAC-SHA256 signed, TTL,
       `timingSafeEqual`, đã có sẵn từ Phase 5 cho `/order-confirmation`) thay vì nghĩ lại cơ chế
       access token từ đầu. Khi staff bấm "Tạo Quote", mint 1 token ký HMAC còn hạn tới
       `quotes.valid_until`; link dán vào Zalo là `/quotes/[quoteNumber]?token=...`. Có token hợp lệ
       → xem đầy đủ (không cần xác minh SĐT, đúng UX "khách mở link là thấy ngay"). Không có/hết
       hạn token → rơi về chế độ rút gọn, PII bị mask, giống `getPublicOrderByNumber`.
     - **Tái dùng `buildVietQrUrl()`** (đã có trong trang order-confirmation) thay vì viết lại logic
       sinh URL `img.vietqr.io`.
     - Service mới cho public quote phải là **field allowlist tường minh** (giống
       `getPublicOrderByNumber`/ADR-0015), không `select *`/join thẳng `custom_requests` — loại hẳn
       `customer_email`, `internal_note`. Áp dụng `createDatabaseRateLimiter` (scope
       `public-quote-lookup`, tái dùng nguyên bản như `/api/public/orders/[orderNumber]`).
     - `pricing_breakdown` (JSONB nội bộ, có `machineDepreciationVnd`/`electricityCostVnd`/
       `failureBufferVnd`/`laborCostVnd` — đủ để suy ngược margin thật) **không được serialize thẳng
       ra trang public**. Cần 1 DTO public riêng (chỉ vật liệu theo màu, chi phí in tổng, hoàn
       thiện, đóng gói, ship, tổng, cọc), tách khỏi `PricingBreakdown` type của `pricing.service.ts`.
     - **Bổ sung sau Claude review vòng 2 (2026-09-03) — 2 blocker mới, cùng dạng lỗi đã sửa ở trên
       nhưng ở chỗ khác:**
       1. **Chế độ fallback khi hết token chưa đủ chặt.** Câu trên viết "PII bị mask, giống
          `getPublicOrderByNumber`" nhưng đọc code thật thì `getPublicOrderByNumber(orderNumber,
          phoneSuffix)` bắt buộc tham số `phoneSuffix` — che PII không phải là toàn bộ cơ chế, xác
          minh 2 lớp mới là cơ chế. `business-rules.md` #14 cũng chỉ quy định cho "public order
          tracking", chưa có luật tương đương cho quote. `quoteNumber` (`Q-`+12 hex) là bearer link
          dán vào Zalo, có thể bị forward/scrape link-preview. Chốt: **chế độ rút gọn (không có
          token hoặc token hết hạn) cũng bắt buộc query param `phoneSuffix` giống hệt
          `getPublicOrderByNumber`**, không chỉ mask hiển thị. Ghi bổ sung 1 rule mới tương đương
          #14 vào `docs/database/business-rules.md` cho public quote trước khi giao Codex.
       2. **Allowlist phía `custom_requests` mới loại `customer_email`, chưa loại `customer_phone`
          và chưa quyết định có mask `customer_name` hay không.** Nếu trang hiển thị tên khách để cá
          nhân hoá lời chào, phải mask giống `maskCustomerName` đang dùng ở `order.service.ts` khi
          đang ở chế độ rút gọn (không token); `customer_phone` không có lý do gì cần lộ ra trang
          public dù ở chế độ nào — loại hẳn khỏi DTO, không chỉ `customer_email`/`internal_note`.
     - **Bổ sung khác (không blocker, cần quyết định trước khi code):**
       - Token TTL bị "đóng băng" tại thời điểm mint (`createOrderConfirmationToken` nhúng
         `expiresAt` vào token, không đọc lại `quotes.valid_until` mỗi lần verify). Nếu Staff gia
         hạn `valid_until` sau khi đã gửi link Zalo, token cũ vẫn hết hạn theo lịch ban đầu → phải
         mint token mới + gửi lại link mỗi khi sửa `valid_until`, cần ghi rõ quy trình này cho Staff.
       - Hàm dùng chung tham số tên `orderId` (regex UUID). Tái dùng cho quote sẽ truyền `quote.id`
         vào, chạy được vì cũng là uuid, nhưng tên biến `orderId` sẽ gây nhầm lẫn ngữ nghĩa khi đọc
         lại code ở quote flow sau này. Cân nhắc đổi tên tham số thành `resourceId` trong
         `order-confirmation-token.ts` (dùng chung cho cả 2 flow) thay vì giữ nguyên tên cũ.
5. **Nút "1-Click Copy Zalo Quote" trong Admin:**
   - Soạn sẵn đoạn tin nhắn đẹp mắt, lịch sự:
     ```text
     Dạ BaSa3D xin gửi bạn Báo giá chi tiết cho mẫu [Tên model]:
     - Thời gian in: [X] giờ ([Y] plates, [Z] màu)
     - Tổng chi phí: [Tổng tiền]đ (Cọc trước 50%: [Tiền cọc]đ)
     - Xem chi tiết & thông số in tại: https://basa3d.vn/quotes/[quoteNumber]
     BaSa3D sẽ tiến hành lên máy ngay sau khi nhận được xác nhận từ bạn ạ!
     ```

---

## Inputs

- `src/services/pricing.service.ts` (Cost-plus engine từ Phase 9).
- `src/services/quote.service.ts` (`createQuote`, `listQuotesByCustomRequest`).
- `src/services/inventory.service.ts` (`listMaterials`).
- `src/app/admin/(protected)/custom-requests/[id]/page.tsx` (Màn hình chi tiết Custom Request).
- Thư viện sinh mã VietQR (dùng format chuẩn URL image `https://img.vietqr.io/image/...` — không cần cài thêm npm dependency thừa).

---

## Outputs

- `src/lib/parsers/makerworld-resolver.ts`: Bộ phân tích URL MakerWorld bóc tách thông số profile.
- `src/app/api/admin/pricing/resolve-makerworld/route.ts`: API Route nhận MakerWorld URL -> trả về JSON profile đầy đủ.
- `src/app/(storefront)/quotes/[quoteNumber]/page.tsx`: Trang xem báo giá công khai cho khách hàng (responsive, chuyên nghiệp, mã QR cọc).
- `src/components/admin/makerworld-quote-panel.tsx`: Component UI tích hợp vào Custom Request: Dán link MakerWorld -> Tự động fetch -> Gợi ý nhựa thải -> Tự map vật liệu -> Bấm 1 click tạo Quote.
- Nút "Copy tin nhắn Zalo" với clipboard API.
- Unit test cho `makerworld-resolver` và `smart-waste-estimator`.

---

## Risks & Mitigations

- **MakerWorld Cloudflare/Anti-bot:** Đặt timeout 5s, kèm headers chuẩn trình duyệt. Nếu bị chặn, UI tự chuyển sang chế độ Quick-Fill để Staff chỉ cần gõ nhanh 3 con số mà không bị đơ giao diện.
- **Bảo mật trang Public Quote:** xem chi tiết cơ chế cụ thể (token HMAC TTL, field allowlist, rate-limit, tách DTO pricing) ở phần bổ sung của Quyết định #4 phía trên — không còn là "read-only chung chung" mà đã có thiết kế cụ thể theo tiền lệ ADR-0015/0021.

---

## Checklist

### Trước khi giao Codex
- [x] Rà soát kiến trúc và chốt phạm vi Phase 13 (không thêm dependency nặng, tái sử dụng `pricing.service.ts`).
- [x] Ask AI for challenge trước khi implement (Step 3 `PHASE_START_PROTOCOL.md`) — **Claude review
  2026-09-03: 4 blocker** (SSRF trên MakerWorld resolver do đây là request ra ngoài đầu tiên của
  codebase; public quote page bỏ qua tiền lệ bảo mật đã có ở ADR-0015/0021/business-rules.md #14;
  `pricing_breakdown` JSONB lộ cấu trúc COGS/margin nếu serialize thẳng; Auto Material Mapping
  "khớp colorHex" không có thuật toán cụ thể vì `materials.color` là text tự do, không phải hex) —
  đã sửa trực tiếp vào các mục "Quyết định đã chốt" #1/#3/#4 ở trên, gồm cả phát hiện tái dùng được
  `order-confirmation-token.ts` (HMAC signed token, TTL) + `buildVietQrUrl()` sẵn có từ Phase 5 thay
  vì thiết kế lại từ đầu. Đã gửi thêm `phase-13-gemini-prompt.md` xin ý kiến độc lập trước khi giao
  Codex (chưa nhận kết quả).
- [x] **Claude review vòng 2 (2026-09-03)** — verify lại các fix vòng 1 bằng cách đọc code thật
  (`order-confirmation-token.ts`, `order.service.ts`, migration schema), không chỉ đọc lại văn bản
  plan: phát hiện 2 blocker mới — (a) chế độ fallback không-token của public quote thiếu xác minh 2
  lớp (`phoneSuffix`) mà `getPublicOrderByNumber` thực ra bắt buộc, quote chưa có; (b) allowlist
  phía `custom_requests` mới loại `customer_email`, chưa loại `customer_phone`/chưa quyết định mask
  `customer_name`. Cùng 3 note quan trọng: cơ chế chặn SSRF-via-redirect chưa cụ thể (`redirect:
  'manual'` + re-validate mỗi hop), thuật toán auto-match màu nhựa chưa có (chốt v1 chỉ match theo
  `material_type`, để Staff chọn tay màu), token TTL đóng băng tại thời điểm mint nên gia hạn
  `valid_until` phải mint lại token. Đã sửa trực tiếp vào Quyết định #1/#3/#4 ở trên — đã thêm rule
  #18 vào `docs/database/business-rules.md` cho dual-verification của public quote.

### Tests
- [x] Test `resolveMakerWorldUrl`: Parse đúng URL mẫu Ace Snail (hoặc mock HTML/JSON) ra 8 plates, 13.2h, 7 filaments.
- [x] Test `smartWasteEstimator`: Tính đúng tỉ lệ bù hao phí cho đơn màu vs đa màu.
- [x] Test Public Quote Route `/quotes/[quoteNumber]`: Hiển thị đúng dữ liệu, render đúng mã VietQR, báo hết hạn nếu `valid_until < now()`.
- [x] Chạy lại toàn bộ `npm test` — không regression Phase 0–12 (157/157 pass, typecheck/lint/build clean).

### Pre-delivery (UI mới)
- [ ] Dán link MakerWorld trên admin tự động điền form trong < 2 giây.
- [ ] Nút "Copy Zalo" hoạt động mượt mà trên cả máy tính và điện thoại.
- [ ] Trang `/quotes/[quoteNumber]` hiển thị đẹp mắt, rõ ràng trên mobile.

---

## Definition of Done

- Staff có thể dán 1 link MakerWorld bất kỳ -> Hệ thống tự tính giá -> Bấm tạo báo giá -> Copy tin nhắn Zalo gửi khách trong vòng **dưới 1 phút**.
- Khách mở link nhận được trang báo giá minh bạch, chuyên nghiệp và có mã QR cọc chuyển khoản ngay.
- `npm test`, `npm run typecheck`, `npm run lint` và `npm run build` pass 100%.
