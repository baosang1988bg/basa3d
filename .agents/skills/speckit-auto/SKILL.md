---
name: "speckit-auto"
description: "Chạy trọn quy trình Spec Kit cho BaSa3D bằng đội đa tác tử nhiều provider (Gemini viết spec/phản biện, Claude lập plan + review cuối, OpenAI vai Codex viết code, Ollama sửa lint) kèm Live Dashboard, 2 điểm duyệt (sau spec, sau plan) và exec-plan cầu nối với PHASE_START_PROTOCOL."
argument-hint: "Mô tả tính năng (tiếng Việt) hoặc --from-file docs/exec-plans/active/phase-X.md"
user-invocable: true
disable-model-invocation: true
---

## User Input

```text
$ARGUMENTS
```

## Việc cần làm

1. Nếu `$ARGUMENTS` rỗng: hỏi người dùng mô tả tính năng (hoặc đường dẫn phase-X.md đã soạn), rồi dừng.
2. Từ thư mục gốc repo, chạy lệnh sau **ở chế độ nền** (server chạy lâu, không chờ nó kết thúc):
   - Có mô tả: `tools/swarm/speckit-auto.sh "$ARGUMENTS"`
   - Đầu vào là exec-plan có sẵn: `tools/swarm/speckit-auto.sh --from-file <đường/dẫn/phase-X.md>`
3. Đọc output đầu tiên, lấy dòng `Dashboard: http://127.0.0.1:…/#token=…` và đưa nguyên link cho người dùng.
   Nếu có cảnh báo thiếu key hoặc "Bỏ qua E2E", báo lại.
4. Nói rõ cho người dùng:
   - Quy trình DỪNG chờ họ bấm **Duyệt / Yêu cầu sửa / Dừng** trên dashboard sau `spec.md` và sau `plan.md` + `tasks.md`.
   - Ngân sách mặc định $2/run; sắp vượt thì dashboard hỏi tăng thêm hay dừng.
   - Kết quả: commit trên nhánh `feature/NNN-…` trong worktree `../BaSa3D-swarm/NNN-…`, gồm `specs/NNN-…/`
     và exec-plan cầu nối `docs/exec-plans/active/feature-NNN-….md`. **Không tự push, không deploy.**
   - Sau đó vẫn theo PHASE_START_PROTOCOL: review diff (BLOCKERS/IMPORTANT/NICE TO HAVE), chạy E2E nếu bị bỏ qua,
     đóng bằng skill `close-phase`.
5. KHÔNG tự duyệt gate thay người dùng, KHÔNG push, KHÔNG deploy, KHÔNG chạy migration lên DB hosted.

Chạy thử không tốn tiền: `tools/swarm/speckit-auto.sh --demo`. Hướng dẫn đầy đủ: `docs/RUNBOOK_SWARM.md`.
