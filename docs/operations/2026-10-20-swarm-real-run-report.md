# Báo cáo smoke test `/speckit-auto` với Gemini API thật

**Ngày chạy**: 2026-10-20

**Nhánh sửa swarm**: `dev`

**Commit sửa swarm**: `75f5d0c`

**Feature branch được sinh**: `feature/002-them-nut-goi-hotline-tel-vao-trang-src-a`

## 1. Kết quả cuối

- Run ID thành công: `20261020-164446-98f2`
- Trạng thái: `completed`
- Chi phí ước tính của run thành công: `$0.593316`
- Tổng chi phí tracked gồm run lỗi, run thành công và ping: khoảng `$1.003`, dưới trần `$2`
- Feature commit: `03c372a`
- Lint, typecheck, test và build: đều xanh
- QA: `pass`, không có finding
- `extra_content.google.thought_signature`: đã được xác minh qua nhiều lượt function calling thật, bao gồm batch tool calls

Hai run trước khi hoàn tất:

- `20261020-161109-70d8`: bị dừng lúc tạo worktree, chưa gọi LLM và không phát sinh chi phí API.
- `20261020-161450-12c3`: thất bại do quota 20 request/ngày của `gemini-3.8-flash`; chi phí ước tính `$0.409374`.

## 2. Lỗi gặp phải và cách sửa

### Launcher lỗi biến Bash cạnh ký tự Unicode

**Lỗi**: `PY�: unbound variable` tại launcher trước khi venv được tạo.

**Nguyên nhân**: Bash diễn giải dấu ellipsis Unicode ngay sau `$PY` như một phần tên biến khi `set -u`.

**Sửa**: đổi thành `${PY}…` tại `tools/swarm/speckit-auto.sh:19` và thêm regression test.

### Git worktree treo ở trạng thái `locked initializing`

**Lỗi**: `git worktree add` gọi `git reset --hard` rồi mắc ở Unix socket của `fsmonitor--daemon`.

**Sửa**: mọi Git command nội bộ của swarm dùng `core.fsmonitor=false` tại `tools/swarm/workspace.py:20`. Thay đổi chỉ áp dụng cho subprocess của swarm, không sửa Git config của repo.

### Model Pro không có quota

`google/gemini-3.1-pro-preview` là ID hợp lệ nhưng trả HTTP 429 cho key hiện tại. Danh sách model được lấy trực tiếp từ endpoint `/v1beta/models`; không có lỗi 404 cho model này.

### Gemini 3.8 Flash hết quota ngày

Quota thực tế là `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, giới hạn 20 request/ngày cho từng model. Run đầu đã dùng nhiều lượt đọc tuần tự và hết quota trước khi viết code.

Các thay đổi:

- Xác minh qua OpenAI-compatible endpoint rằng `gemini-3.5-flash` và `gemini-3-flash-preview` hoạt động.
- Không dùng `gemini-2.5-flash` vì endpoint trả 404 “no longer available to new users”.
- Thêm fallback chéo giữa hai model Gemini tại `tools/swarm/agents.toml:60-114`.
- Dùng giá bảo thủ `$2/$12` trên một triệu input/output token cho hai model chưa có giá chính thức được xác minh.
- Nhúng `spec.md`, `plan.md`, `tasks.md` trực tiếp vào prompt coder tại `tools/swarm/pipeline.py:301-306`.
- Yêu cầu coder gộp các tool call độc lập và không chạy baseline check trước khi triển khai tại `tools/swarm/prompts.py:58-66`.

Kết quả: coder giảm từ 11 model calls mà chưa viết code xuống 6 calls để hoàn tất feature và các check.

### `--yes` có thể tự tăng ngân sách

**Rủi ro**: trước đây budget gate cũng được auto-approve, khiến `--budget 1.5` không phải hard cap.

**Sửa**: `--yes` chỉ duyệt spec/plan và tự dừng khi chạm budget gate tại `tools/swarm/pipeline.py:55-57`; help text được cập nhật tại `tools/swarm/cli.py:249-250`.

### Môi trường test thiếu `pytest`

`.venv-swarm` ban đầu chỉ có runtime dependencies. `pytest` được cài riêng vào venv gitignored để chạy test suite; không thêm dependency vào repo.

## 3. File sửa trong commit swarm

Commit `75f5d0c` chỉ chứa 10 file thuộc `tools/swarm/**`:

- `tools/swarm/agents.toml`
- `tools/swarm/cli.py`
- `tools/swarm/pipeline.py`
- `tools/swarm/prompts.py`
- `tools/swarm/speckit-auto.sh`
- `tools/swarm/workspace.py`
- `tools/swarm/tests/test_swarm_basa3d.py`
- `tools/swarm/tests/test_swarm_core.py`
- `tools/swarm/tests/test_swarm_pipeline.py`
- `tools/swarm/tests/test_swarm_sandbox.py`

Kết quả test cuối:

```text
86 passed, 1 warning in 19.82s
```

Warning duy nhất là Starlette deprecation warning từ dependency test client.

## 4. Feature worktree và commit

Worktree:

```text
/Users/sangpls/Documents/AI00/BaSa3D-swarm/002-them-nut-goi-hotline-tel-vao-trang-src-a
```

Kết quả `git -C <worktree> log -1 --stat`:

```text
03c372a feat(002-them-nut-goi-hotline-tel-vao-trang-src-a): Thêm nút Gọi hotline...
 ...feature-002-....md             | 48 +++++++++++
 docs/roadmap.md                  |  1 +
 messages/en.json                 |  6 ++
 messages/vi.json                 |  6 ++
 plan.md                          | 94 ++++++++++++++++++++++
 spec.md                          | 78 ++++++++++++++++++
 tasks.md                         | 18 +++++
 src/app/not-found.tsx            | 31 +++++--
 tests/not-found-hotline.test.ts  | 23 ++++++
 9 files changed, 300 insertions(+), 5 deletions(-)
```

Worktree sạch. `spec.md`, `plan.md`, `tasks.md` và exec-plan bridge đều hiện diện.

## 5. Phần chưa xác minh

- E2E và DB tests bị bỏ qua vì `.env.swarm` không có đủ `TEST_*` trỏ tới localhost.
- Giá thật của Gemini 3.5/3 Flash chưa được đối chiếu với bảng giá chính thức; cấu hình hiện dùng mức bảo thủ.
- Chi phí trong báo cáo là ước tính từ bảng giá cấu hình, không phải hóa đơn API cuối cùng.
- Test hotline do swarm sinh kiểm tra regex độc lập, chưa import logic production hoặc kiểm DOM/click `tel:`; cần review trước khi merge feature.
- Feature branch chưa được push, merge hoặc deploy.
- Không có file `.env`, `.env.local` hoặc secret nào được sửa hay commit.
