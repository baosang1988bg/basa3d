# Phase 15 Follow-up — items blocking close

> Trạng thái: **Code DONE (implemented + tested), phase CHƯA đóng được** — chỉ còn các mục dưới
> đây, tất cả đều không phải việc code. Xem `phase-15.md` cho toàn bộ chi tiết implementation.

## Mục đích
Tách riêng các việc còn treo của Phase 15 ra khỏi `phase-15.md` để không quên khi quay lại, trong
lúc Owner đang tập trung làm feature khác. Không phải bug code — 3 mục dưới đây đều là xác nhận/
hành động bên ngoài codebase.

## Còn treo

### 1. Gemini architecture challenge chưa chạy
`phase-15-gemini-prompt.md` đã soạn sẵn nhưng **chưa từng gửi cho Gemini / chưa có câu trả lời nào
được ghi lại**. Phase 15 được code trực tiếp bỏ qua bước này (lệch quy trình `AI_WORKFLOW.md`, đã
note rõ lúc implement).
- [ ] Chạy prompt trong `phase-15-gemini-prompt.md` qua Gemini.
- [ ] Fold kết quả (đồng ý hoặc đổi quyết định) trở lại `phase-15.md` §3 và tick ô "Ask AI for
  challenge" trong §6.

### 2. Owner action: verify domain gửi + ước lượng volume
`phase-15.md` §6 "Trước khi giao Codex" cần Owner verify domain gửi trên Resend dashboard (ngoài
code) và ước lượng số custom_request + order/ngày.
- [ ] Verify sending domain trên Resend.
- [ ] Điền `RESEND_FROM_EMAIL` thật vào env production (hiện `.env.example` chỉ có placeholder
  rỗng).
- [ ] Ước lượng volume/ngày — dùng để xác nhận free tier Resend đủ dùng (Risk đã note ở
  `phase-15.md` §5).

### 3. DoD #1 chưa verify với inbox thật
Test hiện tại mock toàn bộ Resend (đúng theo yêu cầu — không gọi network thật trong test). Sau khi
mục 2 xong, cần 1 lần thử thật:
- [ ] Tạo 1 `custom_request` hoặc `order` thật (staging/production) sau khi domain đã verify, xác
  nhận toàn bộ staff active nhận được email trong vài giây, không rơi vào spam.

## Khi xong cả 3 mục
Tick nốt các ô còn lại trong `phase-15.md` §6, xoá file này, rồi chạy `close-phase` skill như bình
thường.
