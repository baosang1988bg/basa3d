# Gemini Challenge Skill

## Purpose
Sinh ra prompt hoàn chỉnh để nhờ Gemini challenge các quyết định kiến trúc
tentative trong `docs/exec-plans/active/phase-X.md`, theo đúng format và mức
độ chi tiết đã dùng cho Phase 3/Phase 4 (`phase-3-gemini-prompt.md`,
`phase-4-gemini-prompt.md`) — không phải đoán lại format mỗi lần.

Khác `codex-handoff` (sinh khi mọi quyết định đã chốt, sẵn sàng giao code):
skill này sinh **trước** đó — ngay sau khi vừa viết xong bản nháp
`phase-X.md` với các quyết định còn tentative, để có ý kiến độc lập trước khi
tự tin giao Codex.

## Khi nào dùng
- User nói "soạn prompt cho gemini", "review phase X với gemini", "gemini
  challenge phase X", "nhờ gemini xem phase X", "chuẩn bị đưa gemini".
- Ngay sau khi Claude vừa viết/cập nhật xong `docs/exec-plans/active/phase-X.md`
  (hoặc mục "Quyết định đã chốt"/"Quyết định cần chốt" của nó) và trước khi
  tick mục "Ask AI for challenge" trong checklist "Trước khi giao Codex".

## Điều kiện trước khi sinh prompt

Đọc `docs/exec-plans/active/phase-X.md` trước. Cần có tối thiểu:
- Goal/Non-goals đã viết (không phải khung rỗng).
- Ít nhất 1 mục "Quyết định đã chốt"/"Quyết định cần chốt" có nội dung thật
  (không phải placeholder) — đây chính là thứ Gemini sẽ challenge.

Nếu `phase-X.md` chưa có phần này (còn đang ở dạng khung/rà soát chưa xong),
**dừng lại** và báo cho user biết cần viết xong bản nháp quyết định trước —
không tự bịa quyết định để có cái mà challenge.

Đây KHÔNG phải điều kiện "mọi checkbox phải xong" như `codex-handoff` — ngược
lại, dùng skill này chính là lúc quyết định còn tentative, chưa chốt cứng.

## Cách chọn câu hỏi để challenge

Không hỏi Gemini về mọi câu trong `phase-X.md` — chỉ chọn ra **2–4 quyết
định rủi ro cao nhất** để tránh loãng, ưu tiên theo thứ tự:
1. Quyết định cắt/hoãn scope (Non-goals) có thể gây tranh cãi — liệu có đang
   né việc thay vì giải quyết đúng mức.
2. Quyết định đánh đổi data integrity/inventory correctness (ưu tiên #1–#2
   của `CLAUDE.md`) — sai ở đây tốn kém sửa nhất.
3. Quyết định thêm dependency/kiến trúc mới (bảng mới, service boundary mới,
   thư viện mới) — có phương án đơn giản hơn không.
4. Quyết định về nguồn dữ liệu bên ngoài (API bên thứ 3, parse file lạ) —
   rủi ro kỹ thuật/pháp lý chưa kiểm chứng.

Mỗi câu hỏi được chọn viết thành 1 "Question N" theo cấu trúc:
- Tóm tắt quyết định tentative hiện tại + lý do Claude đã chọn (ngắn, khách
  quan, không tự bào chữa).
- 2–4 gạch đầu dòng challenge cụ thể — hỏi thẳng vào điểm yếu, yêu cầu
  phương án thay thế **cụ thể có tên**, không chấp nhận câu trả lời chung
  chung ("cân nhắc thêm...").
- Không hỏi câu đã tự rõ ràng/không tranh cãi (VD công thức tính giá đã
  duyệt từ Phase 0 — không challenge lại cái đã chốt ở phase trước, trừ khi
  phase này thay đổi nó).

## Template

```
# Prompt gửi Gemini — Phase <N> kickoff (<1 dòng chủ đề chính đang challenge>)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-<N>.md`
in full (it has the complete context: goal, non-goals, and the "Quyết định đã
chốt" section — all currently tentative, none implemented yet)<, plus any
other doc phase-X.md's decisions directly reference, e.g. an updated spec
file>. Do not write code. Follow the "Required output for architectural
alternatives" format from `GEMINI.md` (Current approach / Alternative /
Pros-cons / Complexity impact / Cost impact / Recommendation / What
docs/code would need to change) for each question below, then give a final
concrete recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)
<3-6 câu: BaSa3D là gì, phase liên quan trước đó đã xong gì (tên file/service
cụ thể), phase này thêm/đổi gì — lấy thẳng từ đầu phase-X.md, không bịa
thêm.>

None of Phase <N>'s design has been challenged by anyone but Claude so far.
<Nói rõ tình trạng code: chưa có dòng code nào / đã có 1 phần, chỉ để Gemini
biết mức độ "còn sửa được dễ".>

## Question 1 — <tên ngắn của quyết định #1 được chọn>
<đoạn tóm tắt quyết định tentative + lý do>

Challenge this:
- <câu hỏi cụ thể 1>
- <câu hỏi cụ thể 2>
- <câu hỏi cụ thể 3, nếu cần>

## Question 2 — ...
<lặp lại cho mỗi quyết định được chọn, tối đa 4 câu>

End with one clear final recommendation per question. If you'd make the
same call as the tentative decision, say so explicitly and why — "I'd
choose the same thing" is a valid, useful answer here, not a non-answer.
```

## Lưu prompt

Lưu file mới `docs/exec-plans/active/phase-<N>-gemini-prompt.md` (đúng
convention đã có từ Phase 3/4), đồng thời dán prompt trong 1 code block ở
chat để user copy nguyên khối ngay, không cần mở file.

## Sau khi Gemini trả lời

Không tự động làm gì thêm — đây là việc của user (đưa câu trả lời Gemini lại
cho Claude). Khi user quay lại với câu trả lời của Gemini, Claude:
1. Đọc câu trả lời, đối chiếu với quyết định tentative ban đầu.
2. Cập nhật mục "Quyết định đã chốt" trong `phase-X.md` (giữ hoặc sửa theo
   kết quả challenge, ghi rõ lý do giữ/đổi — không im lặng giữ nguyên nếu
   Gemini chỉ ra vấn đề hợp lý).
3. Tick checkbox "Ask AI for challenge" trong checklist, ghi 1 dòng tóm tắt
   ngày + kết quả (đúng pattern đã thấy ở `phase-7.md`/`phase-8-*.md`: "Gemini
   review <ngày>: ... Claude review lại: chấp nhận/điều chỉnh ...").

## Không tự động làm
- Không tự bịa thêm quyết định/scope không có trong `phase-X.md` để có cái
  hỏi — nếu phase-X.md chưa đủ chi tiết, hoàn thiện nó trước.
- Không hỏi quá 4 câu — chọn đúng những quyết định rủi ro cao nhất, không
  liệt kê hết mọi thứ trong phase để Gemini tự lọc.
- Không tự quyết thay Gemini rồi bỏ qua bước gửi thật — chỉ soạn prompt,
  user là người đưa cho Gemini.
