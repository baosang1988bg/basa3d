# Prompt gửi Gemini — Phase 12 kickoff (filament spool ledger integrity & lock protocol)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-12.md`
in full (it has the complete context: nguồn dữ liệu thực tế, goal, non-goals, và
kế hoạch triển khai theo Vertical Slices 1–5 — tất cả đang tentative, chưa có
dòng code nào), plus `docs/database/schema.md` (mục `material_movements` /
ADR-0008) và `docs/architecture/decisions.md` ADR-0008/ADR-0011/ADR-0018 (ledger
tách riêng cho raw material, ranh giới OWNER/STAFF, và protocol lock nguyên
liệu hiện có). Do not write code. Follow the "Required output for
architectural alternatives" format from `GEMINI.md` (Current approach /
Alternative / Pros-cons / Complexity impact / Cost impact / Recommendation /
What docs/code would need to change) for each question below, then give a
final concrete recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D là nền tảng thương mại điện tử & gia công 3D-printing quy mô nhỏ tại
Việt Nam (1 owner, 1 staff). Các phase trước đã hoàn thiện: ledger bất biến
cho tồn kho thành phẩm (`inventory_movements`) và nguyên liệu thô
(`material_movements`, ADR-0008), lock hàng theo `SELECT ... FOR UPDATE` chống
oversell (ADR-0018), phân quyền OWNER/STAFF qua `staff_profiles` (ADR-0011/
0012), tiền lưu integer minor units (VND = 1 unit). Phase 12 thêm 2 phân hệ
mới: (1) `filament_spools` — theo dõi 27 cuộn nhựa vật lý thật (mã cuộn, gram
ban đầu/đã dùng/còn lại, cảnh báo sắp hết), liên kết `materials` và
`material_movements`; (2) `expenses` — sổ chi tiêu xưởng (8 khoản chi thực tế
đã seed sẵn, ~27.184.500đ) và trang Thống kê Tài chính chỉ dành cho OWNER.

None of Phase 12's design has been challenged by anyone but Claude so far. No
code exists yet — only `docs/exec-plans/active/phase-12.md`. Claude đã review
sơ bộ và nêu 3 rủi ro data-integrity/concurrency ở mức nghiêm trọng (BLOCKER)
trong các câu hỏi dưới đây — cần Gemini cho ý kiến độc lập trước khi chốt và
giao Codex.

## Question 1 — `filament_spools` ↔ `material_movements`: cột `spool_id` hay tái dùng `reference_id`?

Phase 12 (Slice 2, `recordSpoolUsage`) dự định: khi một cuộn nhựa bị tiêu hao,
tăng `filament_spools.used_weight_grams` và đồng thời chèn 1 dòng
`PRODUCTION_OUT` vào `material_movements` với `reference_type = 'PRINT_JOB'`,
`reference_id = <print_job.id>`. Nhưng `material_movements` hiện tại
(ADR-0008) chỉ có `material_id` + `reference_type`/`reference_id` — không có
cột nào định danh **cuộn nhựa cụ thể** nào đã bị trừ. Vì một `material_id` có
thể có nhiều `filament_spools`, `used_weight_grams` trên từng cuộn sẽ trở
thành một bộ đếm độc lập, không thể đối chiếu ngược lại tổng `SUM(quantity)`
trong ledger theo từng cuộn.

Challenge this:
- Có nên thêm cột `material_movements.spool_id uuid references filament_spools(id)`
  (nullable, chỉ bắt buộc khi `movement_type = 'PRODUCTION_OUT'` và material đó
  có tracking theo cuộn) để ledger tự chứng minh được, thay vì để
  `filament_spools.used_weight_grams` là nguồn sự thật thứ hai không kiểm
  chứng được?
- Hay có cách tiếp cận đơn giản hơn — ví dụ đảo ngược mô hình: coi
  `filament_spools` chỉ là **view/derived state** tính từ
  `SUM(material_movements.quantity) WHERE spool_id = X` thay vì một cột
  `used_weight_grams` được UPDATE trực tiếp — có đáng đánh đổi độ phức tạp
  query để đổi lấy việc không bao giờ bị lệch dữ liệu?
- Việc tái dùng `reference_type`/`reference_id` hiện có (đổi ý nghĩa để
  `reference_id` trỏ vào `filament_spools.id` thay vì `print_jobs.id` khi
  material được track theo cuộn) có phải là lựa chọn tệ hơn thêm cột mới,
  xét theo tinh thần "không thêm cột nếu tái dùng được" (AGENTS.md rule #8)?

## Question 2 — Concurrency: lock theo `materials` (ADR-0018 hiện có) có đủ bảo vệ từng cuộn riêng lẻ?

ADR-0018 hiện lock dòng `materials` (`SELECT id FROM materials WHERE id = $1
FOR UPDATE`) trước khi tính tồn kho & ghi `material_movements`, áp dụng cho
tổng nguyên liệu theo loại. Phase 12 track thêm 1 tầng vật lý mới: từng cuộn
riêng lẻ có giới hạn cứng riêng (`used_weight_grams` không được vượt
`initial_weight_grams` của chính cuộn đó). Slice 5 chỉ ghi "Test ghi nhận
tiêu hao cuộn nhựa tích hợp ledger `material_movements` dưới row-lock" mà
chưa nói rõ lock ở cấp nào.

Challenge this:
- Nếu 2 print job đồng thời tiêu hao từ **cùng một cuộn cụ thể**, lock chỉ ở
  cấp `materials` (dùng chung cho mọi cuộn của loại nhựa đó) có đủ ngăn
  `used_weight_grams` của riêng cuộn đó vượt `initial_weight_grams` không —
  hay bắt buộc phải thêm `SELECT id FROM filament_spools WHERE id = $1 FOR
  UPDATE` (lock theo proxy trên chính dòng cuộn, giống pattern đã dùng cho
  `product_variants`/`materials`) trước khi tăng `used_weight_grams`?
- Có nên giữ 2 lock lồng nhau (lock `materials` cho tổng, rồi lock
  `filament_spools` cho từng cuộn) trong cùng transaction, hay việc thêm
  `spool_id` vào `material_movements` (Question 1) làm cho lock cấp
  `materials` trở nên thừa và chỉ cần lock `filament_spools`?
- Có rủi ro deadlock nào nếu 2 giao dịch lock 2 cuộn khác nhau theo thứ tự
  ngược nhau không, và có cần sắp thứ tự lock (ví dụ theo `id` tăng dần,
  giống `order.service.ts` đang làm với nhiều `product_variants`) không?

## Question 3 — Seed 27 cuộn nhựa đã có `used_weight_grams` từ Google Sheet: có cần ledger backfill không?

Slice 1 dự định seed thẳng 27 cuộn từ sheet "QUẢN LÝ KHO NHỰA" — nhiều cuộn
trong đó đã có gram tiêu hao thực tế (không phải cuộn mới 100%). Nếu migration
chỉ set `used_weight_grams` trực tiếp mà không chèn dòng `material_movements`
tương ứng, thì ngay từ ngày đầu tiên, tổng `SUM(material_movements.quantity)`
theo từng material sẽ không bao giờ khớp với tổng gram đã dùng thực tế của
các cuộn — vi phạm nguyên tắc "tồn kho suy ra từ movement, không sửa trực
tiếp" (`docs/database/business-rules.md` #1).

Challenge this:
- Cách nào hợp lý để backfill: (a) 1 dòng `PURCHASE` cho `initial_weight_grams`
  + 1 dòng `ADJUSTMENT_OUT`/`PRODUCTION_OUT` riêng cho phần đã dùng
  (`reference_type = 'MIGRATION'`), hay (b) chỉ 1 dòng `PURCHASE` cho đúng
  phần **còn lại** (remaining weight, coi lịch sử trước đó là "không track")
  — cách nào giữ đúng tinh thần ADJUSTMENT cần `created_by` + `note` bắt buộc
  (constraint hiện có trên `material_movements`) mà không làm sai lệch báo
  cáo tổng nhập/tổng xuất về sau?
- Sheet 3 "LỊCH SỬ SỬ DỤNG" có ghi nhận từng lần tiêu hao theo ngày/mã
  cuộn/sản phẩm — có đáng migrate nguyên lịch sử đó thành nhiều dòng
  `material_movements` (mỗi lần in 1 dòng, với `created_at` lùi ngày thật) để
  báo cáo COGS theo thời gian chính xác hơn, hay chỉ 1 dòng backfill gộp là
  đủ cho MVP và phần lịch sử coi như dữ liệu tham khảo (lưu nguyên trong
  `note`/seed source, không cần ledger hoá từng dòng)?
- Migration seed này có cần idempotent (`ON CONFLICT (spool_code) DO NOTHING`)
  để chạy lại an toàn không, và nếu chạy lại sau khi đã có `material_movements`
  thật (không còn là DB trống), có rủi ro insert trùng backfill không?

## Question 4 — Ranh giới OWNER-only nên áp cho `expenses` thôi, hay cả `filament_spools.purchase_cost`?

Phase 12 Non-goals #3 chốt: "Không cấp quyền xem chi phí xưởng cho tài khoản
STAFF (chỉ OWNER mới có quyền xem)" — áp dụng cho bảng `expenses`. Nhưng
`filament_spools` (Slice 1) cũng có cột `purchase_cost bigint` (giá vốn từng
cuộn, VND minor unit), và theo Slice 3, trang `/admin/materials` xem như công
việc vận hành hàng ngày dùng chung cho cả OWNER và STAFF (nhập cuộn mới, điều
chỉnh kiểm kê) — không có ghi chú nào giới hạn STAFF không được thấy
`purchase_cost`. ADR-0011 (ranh giới #2) hiện chỉ nói rõ STAFF bị chặn ở
"Financial Dashboard & Profit Reports", không nói rõ về giá vốn từng dòng dữ
liệu tác nghiệp như `filament_spools.purchase_cost`.

Challenge this:
- Có nên coi `purchase_cost` trên `filament_spools` là dữ liệu tài chính cùng
  cấp với `expenses` (ẩn khỏi STAFF trong response của `listFilamentSpools`),
  hay đây là chi phí vận hành (giống `cost_price` trên `product_variants` —
  vốn đã ẩn khỏi API public nhưng STAFF admin vẫn thấy được trong nội bộ) nên
  không cần thêm ranh giới mới?
- Nếu chọn ẩn `purchase_cost` khỏi STAFF, nên ẩn ở tầng service (không SELECT
  cột đó cho role STAFF) hay tầng UI (component ẩn field nhưng API vẫn trả
  về)? AGENTS.md rule #5 nói rõ "UI hiding is not security" — cách nào đúng
  tinh thần đó nhất trong context cụ thể của `filament_spools`?
- Việc chưa định nghĩa rõ ranh giới này trong Non-goals có phải là một lỗ
  hổng cần chốt lại trước khi giao Codex (rủi ro lộ giá vốn cho STAFF), hay
  đủ nhỏ để xử lý sau như một follow-up riêng không ảnh hưởng Definition of
  Done của Phase 12?

End with one clear final recommendation per question. If you'd make the same
call as the tentative decision, say so explicitly and why — "I'd choose the
same thing" is a valid, useful answer here, not a non-answer.
