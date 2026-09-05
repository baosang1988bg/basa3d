# Prompt gửi Gemini — Phase 15 kickoff (staff notifications: silent-failure risk & provider choice)

Read `AGENTS.md` and `GEMINI.md` first, then `docs/exec-plans/active/phase-15.md` in full (rà soát
hiện trạng, goal/non-goals, và quyết định kỹ thuật đề xuất — tất cả đang tentative, chưa có dòng code
nào), plus `.env.example` (mục `RESEND_API_KEY`) và `src/components/admin/admin-nav.tsx` (badge đếm
hiện có, Phase 11). Do not write code. Follow the "Required output for architectural alternatives"
format from `GEMINI.md` (Current approach / Alternative / Pros-cons / Complexity impact / Cost
impact / Recommendation / What docs/code would need to change) for each question below, then give a
final concrete recommendation for each — not just a list of options.

## Project context (short version, full detail is in the docs above)
BaSa3D hiện không có cách nào chủ động báo cho staff (1 owner, vài staff) khi có `custom_request`
hoặc `order` mới — kênh duy nhất là badge đếm trong admin nav, chỉ hiện khi staff đã tự mở `/admin`.
Phase 15 thêm email qua Resend cho 2 sự kiện này, gọi sau khi transaction tạo đơn/request commit
thành công (không phải bên trong), fire-and-forget với try/catch nuốt lỗi để không bao giờ làm fail
luồng tạo đơn chính. Không dùng queue/background job (chưa cần ở quy mô hiện tại), không notify
khách hàng (đã có kênh Zalo riêng), không làm digest ở v1.

None of Phase 15's design has been challenged by anyone but Claude so far. No code exists yet — chỉ
có `docs/exec-plans/active/phase-15.md`.

## Question 1 — Fire-and-forget nuốt lỗi hoàn toàn: có rủi ro "im lặng chết" không ai biết?
Thiết kế hiện tại: lỗi gửi email bị `try/catch` nuốt, chỉ ghi log, không có cơ chế nào báo ngược lại
cho ai biết notification đang thất bại liên tục (vd domain hết hạn verify trên Resend, sai API key
sau khi đổi env). Nếu điều này xảy ra, staff sẽ không nhận được email trong âm thầm nhiều ngày mà
không ai phát hiện — chính là quay lại đúng vấn đề gốc mà Phase 15 định giải quyết.

Challenge this:
- Có cần một cơ chế health-check tối thiểu (vd đếm số lần gửi thất bại liên tiếp, hiển thị cảnh báo
  nhỏ ở dashboard admin nếu vượt ngưỡng) ngay từ v1, hay đây là over-engineering cho quy mô hiện tại
  và nên chấp nhận rủi ro này, dựa vào con người phát hiện qua kênh khác (vd Owner tự nhận ra "lâu
  rồi không thấy email")?
- Ghi log lỗi vào đâu — dự án hiện chưa có dependency logging/monitoring nào (không thấy Sentry/
  Datadog trong `package.json`) — log ra đâu để có ý nghĩa thực tế (console log trên Vercel/hosting
  hiện dùng có ai xem không), hay cần built-in 1 bảng `notification_failures` tối giản trong chính
  Postgres để ít nhất staff có nơi tra cứu?

## Question 2 — Resend vs phương án khác cho use-case cực nhỏ (1 owner, vài staff, vài email/ngày)
Phase 15 chọn Resend vì biến env đã được dự trù sẵn tên từ trước, nhưng chưa từng dùng thật.

Challenge this:
- Với volume cực thấp (nhiều khả năng dưới 50 email/ngày ở giai đoạn này), Resend có phải lựa chọn
  tương xứng, hay 1 phương án đơn giản hơn (SMTP qua chính Gmail/Google Workspace mà Owner đã có,
  dùng `nodemailer` — không cần thêm tài khoản dịch vụ mới, không cần verify domain riêng) phù hợp
  hơn cho giai đoạn "chưa biết volume thật" này?
- Yêu cầu verify domain trên Resend trước khi email không vào spam — đây là công đoạn ngoài code cần
  Owner tự làm; nếu Owner chưa có domain email riêng verify được, phương án nào là fallback hợp lý
  (gửi từ địa chỉ email cá nhân qua SMTP tạm thời) mà không chặn toàn bộ Phase 15 lại chỉ vì thiếu 1
  bước hạ tầng ngoài code?

## Question 3 — Không làm digest ở v1: có nên đặt ngưỡng an toàn ngay từ đầu thay vì "quyết định sau"?
Non-goals ghi "không gộp digest ở v1", để lại như một quyết định sẽ tính sau nếu đo được volume vượt
ngưỡng khó chịu.

Challenge this:
- Rủi ro cụ thể nếu không làm gì: nếu 1 ngày có 20 custom_request (peak mùa), staff nhận 20 email
  rời rạc, dễ tạo filter/rule tự động chuyển sang thư mục khác trong Gmail để "dọn hộp thư" — hành vi
  đó vô hiệu hoá hoàn toàn mục tiêu của Phase 15 mà không ai chủ động tắt tính năng. Ngưỡng nào (vd
  quá 3 email trong 10 phút thì gộp lại thành 1 email tổng hợp) đáng để làm ngay từ v1 thay vì để
  "quyết định sau" — chi phí thêm ngưỡng đơn giản này ngay từ đầu có nhỏ hơn chi phí sửa lại sau khi
  đã có nhiều dev quen với luồng cũ không?

End with one clear final recommendation per question. If you'd make the same call as the tentative
decision, say so explicitly and why — "I'd choose the same thing" is a valid, useful answer here,
not a non-answer.
