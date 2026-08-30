# Close Phase Skill

## Purpose
Đóng một phase theo `PHASE_START_PROTOCOL.md` Step 8, và tạo một git commit
tương ứng để lịch sử git phản ánh đúng ranh giới từng phase — thay vì dồn tất
cả thay đổi của nhiều phase vào một commit lớn không ai review nổi.

## Khi nào dùng
- User nói "đóng phase X", "commit phase X", "phase X xong rồi", "phase X
  hoàn tất".
- Ngay sau khi checklist trong `docs/exec-plans/active/phase-X.md` đạt
  Definition of Done.

## Quy trình

1. Đọc `docs/exec-plans/active/phase-X.md`. Kiểm tra toàn bộ checkbox trong
   mục Checklist đã là `[x]`. Nếu còn mục `[ ]` chưa xong, **dừng lại**, báo
   cho user biết chính xác mục nào còn thiếu — không tự ý đóng phase khi
   chưa đạt DoD.
2. Di chuyển file: `docs/exec-plans/active/phase-X.md` →
   `docs/exec-plans/completed/phase-X.md`.
3. `git add -A`. Trước khi commit, kiểm tra `git status`/`git diff --cached
   --name-only` không có file `.env`, `.env.local`, hay file chứa secret nào
   lọt vào staged changes (bình thường `.gitignore` đã chặn, nhưng luôn kiểm
   tra lại — nếu thấy, dừng lại và cảnh báo user ngay, không commit).
4. Viết commit message theo Conventional Commits (quy ước trong `AGENTS.md`):
   ```
   chore: close phase X — <tên phase ngắn gọn>

   - <tóm tắt 3-6 dòng: quyết định/outputs chính của phase, lấy từ mục Goal
     và Outputs trong phase-X.md>
   - Xem chi tiết: docs/exec-plans/completed/phase-X.md
   ```
5. `git commit`.
6. Báo lại cho user: commit hash, số file thay đổi, và gợi ý phase tiếp theo
   theo `docs/roadmap.md`.

## Không tự động làm

- Không commit nếu checklist trong phase-X.md chưa đủ `[x]`.
- Không commit nếu phát hiện `.env`/secret trong staged changes.
- Không tự ý sửa nội dung `phase-X.md` khi đóng — chỉ move file rồi commit,
  không chỉnh sửa nội dung song song với việc đóng phase.
- Nếu git chưa có identity (`user.name`/`user.email`) hoặc gặp lỗi (lock
  file, permission), báo cho user thay vì tự ý sửa cấu hình git global.
