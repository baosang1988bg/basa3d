# Phase 20 Follow-up — items blocking close

> Trạng thái: **Code DONE (implemented + tested), phase CHƯA đóng được** — chỉ còn mục dưới đây,
> không phải việc code. Xem `phase-20.md` cho toàn bộ chi tiết implementation, và
> `phase-20-verification.md` cho kết quả verify kỹ thuật đã chạy (181 test pass, typecheck/lint/
> build pass, E2E pass).

## Mục đích
Tách riêng việc còn treo của Phase 20 ra khỏi `phase-20.md` để không quên khi quay lại, trong lúc
owner đang tập trung việc khác. Không phải bug code — mục dưới đây là hành động vật lý bên ngoài
codebase, không có cách nào tự động hoá hay CI verify thay được.

## Còn treo

### 1. Owner action: in thử vật lý xác nhận vách/đáy không tách rời
`phase-20.md` mục 3.2 chốt dùng kỹ thuật Epsilon-Overlap (`WALL_OVERLAP_EPSILON_MM = 0.2`) +
`mergeGeometries` thay vì CSG boolean thật — dựa trên lý luận là slicer FDM (Bambu Studio,
PrusaSlicer, OrcaSlicer, Cura) sẽ tự gộp các khối hình học giao nhau thành 1 solid liền khối khi
slicing. `phase-20-verification.md` đã note rõ đây vẫn là suy luận hình học chưa verify bằng in
thật: *"The prescribed merge retains overlapping box shells... Inspect the exported STL in the
target slicer and print 1–2 samples to verify wall/floor bonding before closing the phase."*

- [ ] Xuất 1 file STL mẫu từ `/tools/organizer` (vd. lưới 3×4, kích thước mặc định 180×120×35mm).
- [ ] Mở file trong slicer thật của xưởng (Bambu Studio/OrcaSlicer) — kiểm tra không báo lỗi
  non-manifold ở đường nối vách/đáy, xem preview lát cắt (layer view) để xác nhận vách và đáy hiển
  thị là 1 khối liền, không có khe hở.
- [ ] In thử 1-2 mẫu thật (khuyến nghị: 1 mẫu lưới đều + 1 mẫu custom sizes) — kiểm tra bằng tay sau
  khi in xong: vách ngăn không tách rời khỏi đáy khi bẻ nhẹ/thử lực thông thường.
- [ ] Ghi kết quả lại (đạt/không đạt, ảnh nếu có) vào chính mục này hoặc `phase-20-verification.md`.
- [ ] Nếu in hỏng (vách tách rời): quay lại `phase-20.md` mục 3.2, cân nhắc tăng
  `WALL_OVERLAP_EPSILON_MM` hoặc đổi sang CSG boolean thật (`three-bvh-csg`, đã duyệt sẵn cho Dual
  Text/Car ở Phase 19) — không tự ý quyết định lại ở đây, quay lại brainstorm/gemini-challenge nếu
  phải đổi hướng.

## Quyết định của Owner (2026-09-05) — Chấp nhận rủi ro, bỏ qua in thử vật lý
Owner xác nhận **chưa in thử thật**, và **chủ động chọn bỏ qua** bước xác nhận vật lý này để đóng
Phase 20 ngay — không phải Claude tự ý bỏ qua. Rủi ro còn tồn đọng (chưa verify): kỹ thuật
Epsilon-Overlap (`WALL_OVERLAP_EPSILON_MM = 0.2mm`, mục 3.2 `phase-20.md`) có thể không tạo ra
liên kết vách/đáy đủ bền khi in thật trên máy FDM cụ thể của xưởng — đây vẫn chỉ là suy luận hình
học + tiền lệ CAD chung, chưa có bằng chứng in thật của BaSa3D.

- [x] Owner chấp nhận rủi ro, không in thử trước khi đóng phase — quyết định có ý thức, ghi nhận
  2026-09-05.

**Còn treo lại** (chưa đóng mục này, chỉ đóng được phase): nếu sau này in thử thật và phát hiện
vách/đáy tách rời, quay lại `phase-20.md` mục 3.2 — tăng `WALL_OVERLAP_EPSILON_MM` hoặc đổi sang
CSG boolean thật (`three-bvh-csg`) — không tự quyết định lại hướng kỹ thuật mà không brainstorm/
gemini-challenge lại.
