# Prompt gửi Gemini — Phase 16 kickoff (payment reconciliation: ledger contradiction & auto-match threshold)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-16.md` in full (rà soát
hiện trạng, goal/non-goals, và quyết định kỹ thuật đề xuất — tất cả đang tentative, chưa có dòng code
nào), plus `docs/database/business-rules.md` (#1 ledger, #7 never delete financial history, #8
deposit policy), `docs/architecture/decisions.md` ADR-0008/ADR-0009/ADR-0013 addendum, và
`src/services/order.service.ts` (transition map dòng 84-85, hàm `acceptQuote` trong
`quote.service.ts` cho ví dụ transition function có sẵn). Do not write code. Follow the "Required
output for architectural alternatives" format from `GEMINI.md` (Current approach / Alternative /
Pros-cons / Complexity impact / Cost impact / Recommendation / What docs/code would need to change)
for each question below, then give a final concrete recommendation for each — not just a list of
options.

## Project context (short version, full detail is in the docs above)
BaSa3D hiện xác nhận tiền cọc/thanh toán 100% thủ công: staff tự nhìn sao kê ngân hàng, đối chiếu nội
dung chuyển khoản (đã có sẵn mã đơn/quote nhờ VietQR `addInfo`), rồi tự bấm đổi `payment_status`
trên admin UI. Phase 16 thêm webhook nhận thông báo biến động số dư từ 1 dịch vụ đối soát (Casso/
SePay — chưa chọn cụ thể), tự động match giao dịch với đơn/quote theo nội dung CK + số tiền, và chỉ
tự động đổi `payment_status` khi khớp chính xác cả hai; mọi trường hợp mơ hồ đẩy cho staff xác nhận
tay. Đây là phase rủi ro cao nhất trong nhóm 3 phase 14-16 vì là lần đầu tiên một hệ thống bên ngoài
được phép tự đổi trạng thái tài chính.

None of Phase 16's design has been challenged by anyone but Claude so far. No code exists yet — chỉ
có `docs/exec-plans/active/phase-16.md`. Claude tự phát hiện 1 mâu thuẫn ngay trong lúc viết bản
nháp (Question 1 dưới đây) — chưa tự giải quyết, cần ý kiến độc lập.

## Question 1 — Mâu thuẫn tự phát hiện: `bank_transactions` khai là "ledger immutable" nhưng Slice 3 lại cần UPDATE `match_status`/`matched_entity_id`
Mục 3.3 khai `bank_transactions` là ledger bất biến (trigger kiểu `prevent_ledger_mutation`, giống
`inventory_movements`/`material_movements` — theo đúng business-rules.md #1/#7). Nhưng Slice 3 (Admin
UI đối soát thủ công) lại yêu cầu staff "gán tay" một giao dịch `UNMATCHED` vào đúng đơn/quote — tức
là **update** `match_status` và `matched_entity_id` sau khi dòng đã được insert. Đây là mâu thuẫn
trực tiếp với chính nguyên tắc ledger bất biến mà chưa được Claude giải quyết trong bản nháp.

Challenge this:
- Phương án nào đúng tinh thần codebase hơn: (a) giữ `bank_transactions` bất biến tuyệt đối (raw
  payload không bao giờ sửa), và tách riêng 1 bảng/cột khác (vd `bank_transaction_matches`, insert
  dòng mới mỗi lần match/re-match thay vì update) để lưu lịch sử matching như 1 ledger phụ; hay (b)
  chấp nhận `bank_transactions` có 2 nhóm cột — phần "raw, bất biến" (payload, amount, content) và
  phần "trạng thái xử lý, có thể update" (match_status, matched_entity_id) — tương tự cách
  `filament_spools.used_weight_grams` là cached counter được phép update trong cùng transaction với
  ledger `material_movements`?
- Nếu chọn phương án (b), cơ chế nào đảm bảo lịch sử "ai gán tay giao dịch này vào đơn nào, lúc nào"
  không bị mất khi `matched_entity_id` bị ghi đè (vd staff gán nhầm rồi sửa lại) — có cần ghi
  `audit_logs` cho mọi lần update thủ công này, tương tự yêu cầu đã có cho auto-match?

## Question 2 — Ngưỡng "khớp chính xác cả mã lẫn số tiền" có quá cứng so với thực tế tiền cọc linh hoạt?
`business-rules.md` #8 nói rõ: "Deposits... optional, required for orders >= 300,000 VND... **hoặc
theo thoả thuận với khách hàng**" — nghĩa là số tiền cọc thực tế không phải lúc nào cũng là 1 con số
cố định tính sẵn được. Phase 16 lại yêu cầu tự động hoá chỉ khi số tiền khớp "chính xác... bằng đúng
tổng hoặc đúng tiền cọc kỳ vọng".

Challenge this:
- Nếu quote/order không có 1 con số "tiền cọc kỳ vọng" rõ ràng lưu sẵn trong DB (chỉ là thoả thuận
  miệng/nhắn Zalo giữa staff và khách), hệ thống tự động lấy đâu ra con số để so khớp — có cần Phase
  16 bắt buộc thêm 1 cột `expected_deposit_amount` vào `quotes`/`orders` được set tường minh lúc tạo,
  thay vì suy đoán ngầm, để auto-match có cái để so sánh?
- Khách chuyển sai 1 chút (thiếu phí chuyển khoản ngân hàng trừ vào, dư ra vài nghìn đồng làm tròn)
  có nên vẫn được coi là "khớp" trong 1 khoảng dung sai nhỏ (vd ±5,000đ) hay bắt buộc chính xác tuyệt
  đối như thiết kế hiện tại — rủi ro của việc nới dung sai là gì so với rủi ro giữ nguyên tuyệt đối
  (tạo ra nhiều case `AMOUNT_MISMATCH` rơi vào hàng đợi thủ công, làm giảm ROI của cả phase)?

## Question 3 — Tái dùng transition function (`order.service.ts`/`quote.service.ts`) từ 1 webhook không có `actorId` thật
Quyết định #7 nói "khi MATCHED, gọi lại đúng transition function đã có... không tự viết UPDATE trực
tiếp". Nhưng các transition function hiện có (vd `acceptQuote(id, actorId)`) đều nhận `actorId` như
tham số bắt buộc, dùng để ghi `audit_logs.actor_id` — trong khi 1 webhook tự động không có actor con
người thật.

Challenge this:
- `audit_logs.actor_id` đã nullable (theo ADR-0013 addendum, tiền lệ cho request công khai) — nhưng
  các transition function hiện tại có được thiết kế để nhận `actorId = null` một cách an toàn không,
  hay cần sửa signature của chúng (rủi ro side-effect cho các caller hiện có khác), hay nên viết 1
  transition function riêng cho luồng webhook thay vì cố tái dùng nguyên bản?
- Việc "tái dùng transition function có sẵn" có thực sự an toàn nếu function đó có side-effect khác
  ngoài đổi `payment_status` (vd `acceptQuote` còn tạo `print_jobs` — không liên quan gì tới việc
  xác nhận đã nhận tiền) — hay nhóm hành vi "đổi payment_status" cần 1 hàm riêng biệt, hẹp hơn, thay
  vì mượn nguyên hàm business-logic rộng hơn?

## Question 4 — Lựa chọn nhà cung cấp webhook (Casso/SePay) — khoá cứng vào 1 provider có rủi ro gì?
Phase 16 để ngỏ việc chọn provider cụ thể cho Owner quyết định, nhưng thiết kế route/service đã giả
định 1 hình dạng payload/signature nhất định.

Challenge this:
- Có nên thiết kế 1 lớp adapter mỏng (chuẩn hoá payload của bất kỳ provider nào về 1 shape nội bộ
  thống nhất trước khi vào `bank-reconciliation.service.ts`) ngay từ đầu, để đổi provider sau này
  (nếu Casso/SePay đổi giá, ngừng dịch vụ) không phải viết lại toàn bộ service, hay đây là
  over-engineering cho 1 quyết định chưa chắc sẽ đổi?
- Có rủi ro pháp lý/hợp đồng nào (dữ liệu giao dịch ngân hàng đi qua bên thứ ba) cần Owner cân nhắc
  trước khi chọn, mà Claude/Codex không đủ thẩm quyền tự quyết?

End with one clear final recommendation per question. If you'd make the same call as the tentative
decision, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer here,
not a non-answer.
