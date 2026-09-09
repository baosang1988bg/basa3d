# Prompt gửi Gemini — Phase 29 kickoff (kiểm soát rủi ro bản quyền/SHTT)

Read `AGENTS.md` and `GEMINI.md` first, then
`docs/exec-plans/active/phase-29-copyright-compliance.md` in full (it has the complete
context: goal, non-goals, and the "Quyết định đã chốt" section — all currently
tentative, none implemented yet). Do not write code. Follow the "Required output for
architectural alternatives" format from `GEMINI.md` (Current approach / Alternative /
Pros-cons / Complexity impact / Cost impact / Recommendation / What docs/code would
need to change) for each question below, then give a final concrete recommendation for
each — not just a list of options.

## Project context (short version, full detail is in the docs above)

BaSa3D là dịch vụ bán sản phẩm in 3D thương mại tại Việt Nam (catalogue tự thiết kế +
custom request khách tự gửi file/mô tả). Owner vừa yêu cầu nghiên cứu rủi ro bản
quyền/SHTT (license nền tảng MakerWorld/Thingiverse/Printables khi bán print, luật SHTT
Việt Nam về quyền tác giả/kiểu dáng công nghiệp/nhãn hiệu). Phase 29 là phase "standing"
(không đóng theo quy trình thường), dùng để track mọi vấn đề bản quyền phát sinh sau
này. Bản nháp hiện tại chia thành 5 slice: (1) checkbox xác nhận bản quyền khi submit
custom request, (2) 3 cột license mới trên bảng `products` cho catalogue tự bán, (3)
flag advisory khi mô tả custom request chứa từ khóa rủi ro IP bên thứ 3, (4) quy trình
khiếu nại vận hành (không phải code), (5) đăng ký kiểu dáng công nghiệp (quyết định
Owner, không phải code).

None of Phase 29's design has been challenged by anyone but Claude so far. Chưa có dòng
code nào được viết — mọi quyết định dưới đây đều sửa được dễ dàng ở giai đoạn này.

## Question 1 — Không lưu snapshot nội dung ToS tại thời điểm khách xác nhận

Bản nháp chỉ định lưu 1 cột `copyright_confirmed boolean` trên `custom_requests` (giống
`attachment_path` hiện có), không tạo bảng `tos_versions` hay lưu lại nội dung điều
khoản chính xác mà khách đã đọc lúc submit. Lý do đưa ra: giữ đơn giản, tránh thêm bảng
mới cho một tính năng chưa rõ tần suất tranh chấp thực tế; coi `created_at` của request
+ lịch sử git của trang ToS là đủ truy vết nếu cần đối chiếu sau này.

Challenge this:
- Nếu có tranh chấp pháp lý thật (khách kiện ngược, hoặc BaSa3D cần chứng minh khách đã
  cam kết), `created_at` + git history của trang ToS có đủ làm bằng chứng không, hay
  cần lưu ít nhất version/hash của nội dung ToS tại thời điểm đó?
- Có phương án trung gian rẻ hơn "bảng riêng" nhưng chắc hơn "chỉ 1 boolean" không (ví
  dụ 1 cột text lưu version string thay vì bảng)?
- Chi phí thêm 1 cột version có đáng so với rủi ro không truy vết được không?

## Question 2 — Thêm cột license thẳng vào bảng `products` thay vì bảng riêng

Bản nháp thêm 3 cột nullable (`licenseSourceUrl`, `licenseType` enum, `licenseProofPath`)
trực tiếp vào bảng `products` hiện có, giả định quan hệ 1 sản phẩm – 1 nguồn model.
Không tạo bảng `product_license_sources` riêng, để tránh JOIN thêm ở mọi query list sản
phẩm.

Challenge this:
- Giả định 1 product – 1 license source có thực sự đúng lâu dài không, hay BaSa3D có
  thể cần 1 sản phẩm ghép nhiều model/nhiều nguồn (ví dụ combo nhiều part) trong tương
  lai gần?
- Nếu giả định sai, chi phí migrate từ "3 cột trên `products`" sang "bảng riêng" sau này
  tốn kém thế nào so với làm bảng riêng ngay từ đầu?
- `licenseType` nên là enum cứng trong code hay để dạng text tự do — enum có làm phase
  sau khó mở rộng loại license mới (ví dụ Cults3D có license riêng) không?

## Question 3 — `ip_risk_flag` chỉ advisory, không chặn state machine

Bản nháp: khi mô tả custom request khớp từ khóa rủi ro IP bên thứ 3 (tên nhân vật/
thương hiệu), hệ thống chỉ set `ip_risk_flag = true` và hiển thị badge cảnh báo trong
admin UI — KHÔNG chặn transition `NEW → REVIEWING → QUOTED` trong
`CUSTOM_REQUEST_STATUS_TRANSITIONS` (`src/services/custom-request.service.ts`). Lý do:
tránh sửa state machine hiện có (ưu tiên #1/#2 AGENTS.md là data integrity/inventory
correctness, không phải feature này), giảm rủi ro regression.

Challenge this:
- Nếu mục tiêu thật là "giảm rủi ro bị xử phạt", một cảnh báo advisory mà staff có thể
  bỏ qua có đạt được mục tiêu đó không, hay đây là "làm cho có" (checkbox theater)?
- Có phương án chặn nhẹ hơn "sửa toàn bộ state machine" nhưng vẫn có hiệu lực thật
  không (ví dụ: yêu cầu 1 field `ip_risk_reviewed_by` bắt buộc khi chuyển từ
  REVIEWING → QUOTED nếu `ip_risk_flag = true`, thay vì chặn hẳn transition)?
- Đánh đổi giữa "advisory-only" và "hard gate" nên dựa trên tiêu chí gì để Owner quyết
  định, thay vì Claude tự chọn advisory vì ngại đụng state machine?

## Question 4 — Danh sách từ khóa rủi ro IP hardcode trong code, không có bảng DB + UI quản lý

Bản nháp: `src/lib/copyright/ip-risk-keywords.ts` là 1 constant array trong code (tên
hãng xe, tên nhân vật phim/game phổ biến), match bằng substring không phân biệt hoa/
thường. Không có bảng DB hay UI cho Owner tự thêm/bớt từ khóa — muốn sửa phải deploy
code mới.

Challenge this:
- Với một danh sách chắc chắn sẽ cần cập nhật thường xuyên (trend nhân vật/thương hiệu
  thay đổi liên tục), hardcode-trong-code có phải lựa chọn đúng, hay chi phí "phải nhờ
  dev sửa mỗi lần" lớn hơn chi phí làm 1 bảng DB đơn giản (không cần UI đầy đủ, chỉ cần
  update qua SQL/admin script) ngay từ đầu?
- Substring match không dấu có tỷ lệ false negative (bỏ sót do viết tắt/biến thể tên)
  cao đến mức nào, và có đáng đầu tư thêm (fuzzy match, danh sách đồng nghĩa) ngay ở
  phase này không, hay chấp nhận rủi ro đó là "known limitation" ghi vào RISKS.md?

End with one clear final recommendation per question. If you'd make the same call as
the tentative decision, say so explicitly and why — "I'd choose the same thing" is a
valid, useful answer here, not a non-answer.
