# Phase 16 — Deposit/Payment Reconciliation (Bank Transfer Webhook Matching)

> **Mục đích**: Giảm thao tác thủ công "staff tự nhìn sao kê ngân hàng, đối chiếu nội dung chuyển
> khoản, rồi tự bấm đổi `payment_status`" — vốn sẽ nhân đôi khối lượng công việc khi Phase 13 thêm
> luồng cọc cho custom quote bên cạnh luồng order sẵn có.

**Phụ thuộc:** nên làm sau Phase 14 (RBAC hardening — siết lại ai được sửa `payment_status`) và sau
khi Phase 13 (tích hợp bên thứ ba đầu tiên: MakerWorld resolver) đã chạy ổn định trong thực tế —
đây là phase đầu tiên cho phép **một hệ thống bên ngoài** tự đổi trạng thái tài chính, rủi ro data
integrity cao nhất trong nhóm 3 phase 14-16.

---

## 1. Rà soát hiện trạng

- `orders.payment_status` transitions (`order.service.ts` dòng 84-85): `UNPAID → DEPOSIT_PAID,
  PAID`; `DEPOSIT_PAID → PAID, REFUNDED`. Hiện 100% do staff tự bấm tay trên admin UI.
- `business-rules.md` #8 (deposit >= 300,000 VND) và ADR-0009 đã định nghĩa policy, nhưng không có
  cơ chế nào tự động biết "tiền đã vào" — chỉ có con người đọc sao kê.
- VietQR (`buildVietQrUrl`, Phase 5 order-confirmation + Phase 13 quote) đã nhúng sẵn `addInfo =
  orderNumber`/`quoteNumber` vào nội dung chuyển khoản — đây chính là "khoá" để một hệ thống đối
  soát tự động có thể match giao dịch với đơn/quote.
- Chưa có bảng nào lưu lịch sử giao dịch ngân hàng, chưa có webhook nào trong `src/app/api/`.
- Tiền lệ ledger bất biến đã có (`inventory_movements`, `material_movements`) — cùng triết lý nên
  áp dụng cho bảng giao dịch ngân hàng mới.
- Tiền lệ signed-secret cho endpoint không qua session (`ORDER_CONFIRMATION_SECRET`,
  `src/lib/order-confirmation-token.ts`) — mô hình tương tự áp dụng được cho verify webhook.

---

## 2. Goal & Non-goals

### Goal
1. Khách chuyển khoản đúng nội dung (`orderNumber`/`quoteNumber`) và đúng số tiền → hệ thống tự
   động cập nhật `payment_status` (`DEPOSIT_PAID` hoặc `PAID` tuỳ số tiền) trong vài phút, có audit
   log.
2. Mọi trường hợp không khớp rõ ràng (sai số tiền, thiếu mã, trùng số tiền giữa 2 đơn) hiện ra màn
   hình "Cần xác nhận thủ công" — **không bao giờ** tự động đoán.

### Non-goals
- **Không xây payment gateway** (không nhận thẻ, không custom checkout online) — giữ nguyên Non-goal
  đã chốt từ Phase 5 (dev-plan §5.3).
- **Không hoàn tiền tự động** — `REFUNDED` vẫn là thao tác tay của staff.
- **Không hỗ trợ nhiều tài khoản ngân hàng cùng lúc** — v1 chỉ 1 STK xưởng, khớp với
  `SITE_CONFIG.bankAccountNumber` hiện tại (1 giá trị, không phải mảng).
- **Không thay thế hoàn toàn thao tác tay** — auto-match chỉ là gợi ý nhanh cho case rõ ràng 100%,
  không phải để bỏ qua hẳn vai trò xác nhận của con người với case mơ hồ.

---

## 3. Quyết định kỹ thuật đề xuất (tentative — chưa qua AI challenge, nhiều điểm CẦN Gemini/Owner
chốt trước khi giao Codex — xem phần Risks)

1. **Nhà cung cấp webhook**: dịch vụ dạng Casso/SePay (đối soát biến động số dư qua Internet
   Banking/SMS Banking, không phải payment gateway thật) — cần Owner chọn cụ thể 1 dịch vụ và đăng
   ký trước khi code (ngoài phạm vi Claude/Codex).
2. **Route mới** `/api/webhooks/bank-transfer` — verify bằng secret riêng của webhook provider (theo
   spec HMAC/signature của chính provider đó, đọc doc lúc chọn provider), **không dùng
   `requireAdmin()`** vì đây không phải người dùng đăng nhập qua Supabase Auth.
3. **Bảng mới `bank_transactions`** — ledger immutable (trigger `prevent_ledger_mutation` giống
   `inventory_movements`/`material_movements`), lưu nguyên payload webhook (`raw_payload jsonb`),
   `amount bigint`, `transfer_content text`, `matched_entity_type varchar` (`'ORDER' | 'QUOTE' |
   null`), `matched_entity_id uuid null`, `match_status varchar` (`'MATCHED' | 'UNMATCHED' |
   'AMOUNT_MISMATCH'`), `created_at`.
4. **Điều kiện tự động set `DEPOSIT_PAID`/`PAID`**: chỉ khi khớp **chính xác** cả mã đơn/quote
   (extract từ `transfer_content`) lẫn số tiền (bằng đúng tổng hoặc đúng tiền cọc kỳ vọng). Mọi sai
   lệch (thiếu mã, số tiền không khớp bất kỳ mốc nào, mã khớp nhưng đơn đã ở trạng thái không hợp lệ
   để chuyển tiếp theo `order.service.ts` transition map) → `match_status = 'AMOUNT_MISMATCH'` hoặc
   `'UNMATCHED'`, không đổi `payment_status`.
5. **Audit**: mọi lần tự động đổi `payment_status` ghi `audit_logs` với `action =
   'PAYMENT_AUTO_MATCHED'`, `actor_id = null` (theo đúng pattern đã dùng cho
   `CUSTOM_REQUEST_CREATED_PUBLIC`, ADR-0013 addendum).
6. **UI mới**: `/admin/bank-transactions` (hoặc tích hợp vào trang Orders/Quotes hiện có) hiển thị
   danh sách giao dịch `UNMATCHED`/`AMOUNT_MISMATCH` để staff tự gán tay vào đúng đơn/quote.
7. **Bảo mật webhook công khai**: áp lại đúng bài học SSRF/timeout đã nêu ở Phase 13 review —
   validate payload (schema cụ thể của provider, không trust field lạ), timeout khi gọi ngược lại
   provider nếu cần xác minh, rate-limit endpoint này để tránh bị spam giả webhook.

---

## 4. Kế hoạch triển khai theo Slices

### Slice 1: Database
- [ ] Migration tạo bảng `bank_transactions` (ledger immutable, xem mục 3.3).
- [ ] Index theo `transfer_content`/`matched_entity_id`/`created_at`.

### Slice 2: Webhook ingest + matching service
- [ ] `src/app/api/webhooks/bank-transfer/route.ts` — verify signature provider, parse payload, gọi
  `bank-reconciliation.service.ts`.
- [ ] `bank-reconciliation.service.ts`: `matchTransaction(payload)` — extract mã đơn/quote từ nội
  dung CK, tìm `orders`/`quotes` đang chờ tiền, so khớp số tiền, quyết định `match_status`.
- [ ] Khi `MATCHED`: gọi lại đúng transition function đã có (`order.service.ts`/`quote.service.ts`)
  thay vì tự viết `UPDATE` trực tiếp — tái dùng validation/transition map hiện có, không bypass.

### Slice 3: Admin UI đối soát thủ công
- [ ] Danh sách giao dịch `UNMATCHED`/`AMOUNT_MISMATCH`, thao tác gán tay vào đúng đơn/quote.

### Slice 4: Tests
- [ ] Test match chính xác (mã + số tiền khớp) → `payment_status` đổi đúng, `audit_logs` có dòng
  mới.
- [ ] Test case mơ hồ (2 đơn cùng số tiền, thiếu mã, số tiền sai) → không đổi `payment_status`, rơi
  đúng `match_status`.
- [ ] Test webhook route từ chối payload không có signature hợp lệ.
- [ ] Test webhook route có rate-limit (tái dùng `createDatabaseRateLimiter`).

### Slice 5: Docs
- [ ] ADR mới cho `bank_transactions` + quy tắc auto-match.
- [ ] Cập nhật `docs/database/business-rules.md`.
- [ ] Cập nhật `docs/roadmap.md`.

---

## 5. Risks & Mitigations
- **Rủi ro lớn nhất: tự động hoá sai** — nếu ngưỡng "khớp chính xác" bị nới lỏng (vd chỉ cần khớp số
  tiền, bỏ qua mã đơn) thì 2 khách chuyển trùng số tiền cùng lúc có thể bị gán nhầm đơn. Mitigation:
  giữ nguyên tắc mục 3.4 — chỉ tự động khi khớp **cả hai** điều kiện, không nới lỏng vì bất kỳ lý do
  tiện lợi nào.
- **Phụ thuộc vào 1 nhà cung cấp bên thứ ba cho một luồng tài chính** — cần hỏi rõ SLA/uptime của
  Casso/SePay trước khi chốt, và đảm bảo hệ thống vẫn hoạt động bình thường (thủ công) nếu webhook
  provider down — đây vốn dĩ đã là hành vi mặc định (Non-goal #4: không thay thế hoàn toàn thao tác
  tay).
- **Chọn nhầm mức độ tự động là rủi ro cao nhất trong 3 phase 14-16** — đây là lý do chính khiến
  Phase 16 nên làm cuối cùng, sau khi đã có RBAC hardening (Phase 14) và kinh nghiệm tích hợp ngoài
  ổn định (Phase 13/15).

---

## 6. Checklist

### Trước khi giao Codex
- [ ] Owner chọn và đăng ký 1 nhà cung cấp webhook cụ thể (Casso/SePay/khác).
- [ ] Rà soát kiến trúc và chốt phạm vi (đã viết ở trên).
- [ ] Ask AI for challenge trước khi implement (Step 3 `PHASE_START_PROTOCOL.md`) — **đặc biệt cần ý
  kiến độc lập cho mục 3.4 (ngưỡng tự động hoá) trước khi giao Codex**, đây là quyết định rủi ro cao
  nhất trong toàn bộ 3 phase.

### Tests
- [ ] Toàn bộ Slice 4 pass.
- [ ] Chạy lại toàn bộ `npm test` — không regression Phase 0-15.

### Definition of Done
1. Chuyển khoản đúng nội dung + đúng số tiền → `payment_status` tự cập nhật trong vài phút, có audit
   log.
2. Case không khớp rõ ràng hiện ở màn hình xác nhận thủ công, không tự động đổi trạng thái tài
   chính.
3. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
