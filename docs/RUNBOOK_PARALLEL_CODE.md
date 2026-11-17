# Hướng dẫn sử dụng Parallel Code cho BaSa3D

Tài liệu này hướng dẫn cách kết nối và khai thác tối đa ứng dụng [Parallel Code](https://github.com/johannesjo/parallel-code) để quản lý tác vụ (Kanban) và chạy song song nhiều AI coding agent (Claude Code, Codex CLI, Gemini CLI, Copilot CLI, v.v.) trong dự án BaSa3D.

---

## 1. Cài đặt Parallel Code (trên macOS)

1. Tải bản release mới nhất từ [johannesjo/parallel-code/releases](https://github.com/johannesjo/parallel-code/releases) (file `.dmg` cho Apple Silicon hoặc Intel Mac).
2. Mở ứng dụng và thêm dự án: Chọn thư mục `/path/to/BaSa3D`.
3. Parallel Code sẽ tự động nhận diện file `KANBAN.md` ở thư mục gốc và dựng bảng Kanban board.
4. Đảm bảo máy đã cài ít nhất một AI CLI (như `claude`, `codex`, `gemini`, hoặc `gh copilot`).

---

## 2. Cấu trúc Kanban Board (`KANBAN.md`)

Ứng dụng tự động đồng bộ 2 chiều với file `KANBAN.md`:

| Cột | Ý nghĩa |
|---|---|
| **Backlog** | Ý tưởng, tính năng và bugfix chờ xử lý |
| **In progress** | Tác vụ đang được agent hoặc developer xử lý |
| **Review** | Tác vụ đã hoàn thành code, đang chờ kiểm tra hoặc review PR |
| **Done** | Tác vụ đã merge và nghiệm thu |

### Cú pháp một thẻ task:
```markdown
- [ ] Tên tính năng hoặc mã lỗi
  Mô tả chi tiết yêu cầu, bối cảnh và ràng buộc kỹ thuật.
  branch: feat/ten-tinh-nang
  - [ ] Checklist 1
  - [ ] Checklist 2
```

---

## 3. Quy trình làm việc với Agent (Workflow chuẩn BaSa3D)

### Bước 1: Khởi động task
1. Trên giao diện Kanban của Parallel Code, nhấn nút **Start Task** (hoặc biểu tượng Agent) trên thẻ muốn làm.
2. Chọn agent bạn muốn chạy (Claude Code, Codex, hoặc Gemini).
3. Ứng dụng sẽ tự động:
   - Tạo Git branch riêng (dựa trên trường `branch:`).
   - Khởi tạo **Git Worktree** cô lập (không đè lên thư mục chính).
   - Tự động symlink `node_modules` và `.env*`.

### Bước 2: Chuẩn bị môi trường (Nếu cần)
Nếu agent báo lỗi thiếu thư viện hoặc thiếu biến môi trường trong worktree mới, bạn chỉ cần gõ trong terminal của agent:
```bash
npm run worktree:prepare
```

### Bước 3: Giám sát và tương tác
- **Working**: Agent đang phân tích hoặc viết code.
- **Needs You**: Agent dừng lại xin quyền chạy lệnh hoặc hỏi ý kiến. Bạn có thể gõ câu trả lời trực tiếp trong terminal hoặc duyệt trên app.
- **Remote check (Mobile)**: Bật tính năng Remote Companion trong Settings của Parallel Code, quét mã QR bằng điện thoại để theo dõi và duyệt lệnh từ xa.

### Bước 4: Review Diff & Quality Gates
1. Sử dụng tab **Diff Viewer** của Parallel Code để xem trực quan các file đã đổi.
2. Bạn có thể bôi đen dòng code và gõ góp ý để agent tự sửa lại.
3. **Bắt buộc**: Trước khi merge, yêu cầu agent chạy lệnh kiểm tra toàn diện của dự án:
   ```bash
   npm run check:agent
   ```
   *(Lệnh này tự động chạy: `lint` + `typecheck` + `test`)*.

### Bước 5: Merge & Đóng task
- Khi tất cả checks đã xanh, kéo thẻ sang cột **Review** hoặc **Done** (hoặc bấm nút Merge trong Parallel Code).
- Parallel Code sẽ tự động dọn dẹp worktree sau khi hoàn thành.

---

## 4. Các quy tắc cốt lõi cần nhớ

1. **Branch xuất phát**: Mọi nhánh tính năng mới **PHẢI** xuất phát từ branch `dev` (theo quy định tại `AGENTS.md`).
2. **Không commit trực tiếp vào `netlify`**: Chỉ merge vào `netlify` khi đã qua test và build hoàn chỉnh.
3. **Bảo mật `.env`**: Các file `.env.local` và `.env.swarm` chỉ dùng nội bộ trên máy, tuyệt đối không commit lên git.
