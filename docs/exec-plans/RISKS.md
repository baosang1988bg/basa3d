# Rủi ro tồn đọng chờ Owner xác nhận

File tổng hợp các "known limitation" đã được chấp nhận khi đóng phase (không chặn merge),
nhưng cần Owner tự tay xác nhận/in thử trước khi cam kết với khách hàng thật. Khi 1 mục được
xác nhận xong, tick `[x]`, thêm ngày + kết quả, **không xoá dòng** (giữ lịch sử).

---

- [ ] **Hinge Box (Phase 25) — bản lề 0.8mm chưa in thật.**
  Hằng số `HINGE_THICKNESS_MM = 0.8mm` suy ra từ thực hành in 3D phổ biến (cộng đồng PLA
  0.6-1.0mm), chưa in thử trong môi trường triển khai (không có máy in). Rủi ro: bản lề gãy
  hoặc không gập được khi in thật.
  Cần: in 1 mẫu, gập thử 10-20 lần, xác nhận không nứt/gãy. Nếu cần chỉnh, sửa hằng số trong
  `src/lib/3d-tools/hinge-box/hinge-box-constants.ts`.
  Chi tiết: `docs/exec-plans/completed/phase-25.md` mục 4/5.

- [ ] **Lamp Shade (Phase 24) — kích thước đế socket kit "MH001" chưa xác nhận.**
  Hằng số `SOCKET_MIN_INNER_DIAMETER_MM = 60mm` là ước lượng, không tra được thông số kỹ thuật
  thật của kit "MH001" qua khảo sát DOM. Hiện chỉ cảnh báo UI nếu bán kính tính ra nhỏ hơn mức
  này, không chặn xuất file.
  Cần: đo đường kính ngoài thật của đế kit, cập nhật hằng số trong
  `src/lib/3d-tools/lamp-shade/lamp-shade-constants.ts` nếu sai lệch.
  Chi tiết: `docs/exec-plans/completed/phase-24.md` mục 2.3/4.

- [ ] **Dual Text (Phase 22, experimental/internal) — hướng đọc chữ mặt bên chưa verify.**
  Chữ thứ 2 (mặt bên, dựng bằng `rotateY(90°)`) có thể bị đọc ngược (mirror) khi nhìn/in thật —
  chỉ suy luận toán học, chưa render/in để xác nhận trực quan. Hằng số
  `SIDE_GLYPH_MIRRORED = false` trong `src/lib/3d-tools/dual-text/dual-text-constants.ts` có
  thể đổi thành `true` nếu cần, không phải sửa logic.
  Cần: preview thật hoặc in thử 1 mẫu 2 chữ, xác nhận cả 2 mặt đọc đúng chiều.
  Chi tiết: `docs/exec-plans/completed/phase-22.md` mục 5 (Risks).

---

## Không nằm trong danh sách này

- **Phase 16** (Deposit/Payment Reconciliation): không phải known-limitation của code đã
  merge — đây là ý tưởng **chưa có code**, đang chờ Owner chọn nhà cung cấp webhook. Xem
  `docs/exec-plans/pending/phase-16.md`.
- Copy marketing nháp cho 3 tool mới trên trang `/tools` (`keychain-blocks`, `car-nameplate`,
  `lamp-shade` trong `messages/vi.json` / `messages/en.json`) — cần Owner duyệt giọng văn,
  không phải rủi ro kỹ thuật, không track ở đây.
