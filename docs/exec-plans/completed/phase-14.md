# Phase 14 — RBAC & Route-Auth Coverage Hardening

> **Mục đích**: Không phải tính năng mới — đóng lại một khoảng trống kiểm thử đã tự phát hiện trong
> quá trình review Phase 12/13: 5 ranh giới OWNER/STAFF (ADR-0011 + ADR-0026) hiện chỉ được bảo vệ
> bởi đúng **1 lớp** (code gọi `requireOwner()`/`requireAdmin()`), không có lớp thứ hai (test) canh
> giữ nếu một refactor sau này vô tình xoá mất dòng gọi đó.

---

## 1. Rà soát hiện trạng (đã đọc code thật, không suy đoán)

- `tests/phase-3-route-auth.test.ts` là bài test auth duy nhất chạy qua HTTP thật (`next start`
  cổng 3411). Dòng 52 chấp nhận **cả 401 lẫn 403** là pass — nghĩa là bài test này chỉ xác nhận
  "request không có cookie bị chặn", **không hề phân biệt** được một STAFF đã đăng nhập hợp lệ
  nhưng thiếu quyền OWNER khi cố truy cập route OWNER-only.
- Ngay cả phạm vi hẹp đó cũng đã sót: `src/app/api/admin/pricing/parse-3mf/route.ts` (route thật,
  admin-only, ra đời từ Phase 9) **không có mặt** trong mảng `PROTECTED_ROUTES` (dòng 18-42) — không
  có test nào xác nhận route này chặn request trái phép.
- 5 ranh giới OWNER/STAFF thật theo ADR-0011/ADR-0026:
  1. Staff Management (`/api/staff`) — OWNER only.
  2. Financial Dashboard & Profit Reports (`dashboard.service.ts` `getFinancialMetrics()`) — OWNER
     only, STAFF chỉ thấy `getOperationalMetrics()`.
  3. Hard Deletion sản phẩm/variant — OWNER only, STAFF chỉ đổi status `ARCHIVED`.
  4. Audit Log Viewer (`/api/audit-logs`) — OWNER only.
  5. Expenses & Financial Analytics (`/admin/expenses`, `expense.service.ts`, Phase 12) — 100%
     OWNER-only.
- Toàn bộ 5 ranh giới này chỉ có **unit test** cho `resolveStaffSession` (`tests/phase-3-auth.test.ts`)
  — không phải test HTTP thật gửi request với session STAFF thật rồi kiểm tra 403.
- `expense.service.ts`, `pricing-config.service.ts`, `filament.service.ts` là Server Actions, không
  đi qua `route.ts` — không nằm trong phạm vi `PROTECTED_ROUTES` hiện có và khó test theo cùng cách
  (Next.js Server Action endpoint được encode, không phải URL path cố định).
- Phase 13 (đang review song song) sẽ thêm route mới `/api/admin/pricing/resolve-makerworld` — nên
  hoàn thiện coverage trước hoặc song song để route mới không lặp lại lỗi thiếu.

---

## 2. Goal & Non-goals

### Goal
1. Mọi route trong `src/app/api/**/route.ts` có đúng 1 dòng test khẳng định **role tối thiểu**
   (không đăng nhập / STAFF / OWNER), không chỉ "có đăng nhập hay không".
2. Bổ sung route bị thiếu (`parse-3mf`) và mọi route Admin API mới phát sinh từ Phase 9-12 vào bảng
   kiểm tra (Phase 13 chưa implement tại thời điểm viết phase này — xem Non-goals).
3. Test fail rõ ràng, chỉ đúng tên route, nếu một lần refactor sau này vô tình gỡ mất
   `requireOwner()`/`requireAdmin()` khỏi 1 route.

### Non-goals
- **Không viết middleware mới, không đổi ADR-0011** — đây là phase kiểm thử, không phải phase kiến
  trúc.
- **Không cover Server Actions** (expenses, pricing-config, filament-spools) — ghi nhận đây là giới
  hạn phạm vi có chủ đích (chi phí xây cơ chế test Server Action qua session thật không tương xứng
  lợi ích so với việc audit thủ công 1 lần các Server Action này đều gọi đúng `requireOwner()`).
  Audit thủ công 1 lần vẫn nằm trong Slice 1 bên dưới.
- **Không refactor route handler** trừ khi audit Slice 1 phát hiện lỗi thật (route thiếu hẳn check
  quyền) — khi đó sửa route là bắt buộc, không phải tuỳ chọn.
- **Không thêm route Phase 13** vào phạm vi Phase 14 — Phase 13 tự thêm route của mình vào bảng kiểm
  tra khi nó được implement (theo đúng thứ tự phase, tránh phụ thuộc chéo).

---

## 3. Quyết định kỹ thuật đề xuất (đã qua AI challenge — xem mục 6)

1. **Tái dùng harness hiện có, không viết framework mới.** `e2e/admin.spec.ts` (Playwright) đã có
   cơ chế tạo/xoá tài khoản throwaway qua `SUPABASE_SERVICE_ROLE_KEY`. Slice 1 tạo thêm 1 hàm dùng
   chung (`tests/helpers/`) để mint 2 tài khoản thật — 1 `OWNER`, 1 `STAFF` — lấy cookie session
   thật (không giả lập JWT tay), rồi gọi qua `next start` cổng 3411 sẵn có trong `npm test`
   (`tests/phase-3-route-auth.test.ts` đã dựng sẵn server này).
2. **Thay cấu trúc bảng kiểm tra**: từ `{method, path}[]` sang `{method, path, minRole: 'STAFF' |
   'OWNER'}[]`, audit lại toàn bộ 23 route hiện có trong `src/app/api/**` (đối chiếu đúng 5 ranh
   giới ở mục 1), bổ sung `parse-3mf`.
3. Với mỗi route, chạy 2-3 lần gọi tuỳ `minRole`: không cookie (kỳ vọng 401/403), cookie STAFF nếu
   `minRole = 'OWNER'` (kỳ vọng đúng 403, không phải 401 — phân biệt rõ 2 mã lỗi thay vì gộp chung
   như test cũ), cookie đúng role tối thiểu (kỳ vọng không phải 401/403).
4. Server Actions: Slice 2 làm 1 lượt audit thủ công (đọc code, không viết test tự động) xác nhận
   từng Server Action gọi đúng `requireOwner()`/`requireAdmin()` ở đầu hàm, ghi kết quả vào
   `docs/architecture/decisions.md` như 1 ADR nhỏ tham chiếu ADR-0011, để lần audit tiếp theo có mốc
   so sánh thay vì phải đọc lại từ đầu.

---

## 4. Kế hoạch triển khai theo Slices

### Slice 1: Test harness mở rộng + bảng route×role
- [ ] Viết helper tạo/xoá 2 tài khoản test (`OWNER`, `STAFF`) dùng chung giữa Playwright và
  `tests/phase-3-route-auth.test.ts`.
- [ ] Audit toàn bộ `src/app/api/**/route.ts`, gắn `minRole` đúng theo 5 ranh giới ADR-0011/ADR-0026.
- [ ] Bổ sung `parse-3mf` và mọi route thiếu khác phát hiện trong lúc audit.
- [ ] Viết lại `tests/phase-3-route-auth.test.ts` (hoặc file mới `tests/rbac-boundaries.test.ts`)
  chạy 3 kịch bản/route như mục 3.3 ở trên.

### Slice 2: Audit thủ công Server Actions
- [ ] Đọc và ghi lại (không sửa trừ khi phát hiện lỗi) từng Server Action trong
  `expense.service.ts`, `pricing-config.service.ts`, `filament.service.ts` gọi đúng
  `requireOwner()`/`requireAdmin()` từ caller.
- [ ] Ghi kết quả audit vào ADR mới trong `docs/architecture/decisions.md`.

### Slice 3: Tách script chạy riêng (không làm chậm vòng lặp code hàng ngày)
- [ ] Thêm `npm run test:rbac` (hoặc gộp có điều kiện vào `npm test` nếu đo được thời gian chạy
  không đáng kể — quyết định cụ thể sau khi đo Slice 1 chạy bao lâu).
- [ ] Cập nhật `README.md` mục Checks.

### Slice 4: Docs
- [ ] Cập nhật `docs/roadmap.md`.
- [ ] Ghi ADR tham chiếu ADR-0011/ADR-0026 cho kết quả audit Slice 2.

---

## 5. Risks & Mitigations
- **Thời gian chạy test tăng** (tạo/xoá 2 tài khoản Supabase thật mỗi lần) — mitigation: Slice 3
  tách script riêng nếu vượt ngưỡng chấp nhận được (đo cụ thể, không đoán).
- **False sense of security nếu chỉ audit Server Actions thủ công 1 lần rồi quên** — mitigation: ghi
  rõ kết quả audit thành ADR có ngày tháng, để lần sau dễ nhận ra đã lâu chưa re-audit.

---

## 6. Checklist

### Trước khi giao Codex
- [x] Rà soát kiến trúc và chốt phạm vi (đã viết ở trên).
- [x] Ask AI for challenge trước khi implement (Step 3 `PHASE_START_PROTOCOL.md`) — **Claude review
  2026-09-03**: đã verify code thật (`e2e/admin.spec.ts` dùng `supabase.auth.admin.createUser` +
  `deleteUser` thật trong `beforeAll`/`afterAll`, `require-admin.ts` xác nhận đúng 401 khi chưa
  đăng nhập vs 403 khi sai role — kế hoạch 401/403 phân biệt trong mục 3.3 khả thi với code hiện
  tại). Đếm lại route thật: `find src/app/api -name route.ts` ra 24, không phải 23 như mục 1 ghi —
  không phải lỗi nghiêm trọng vì Slice 1 tự audit lại danh sách đầy đủ, chỉ là con số ước lượng
  trong tài liệu, không dùng để hardcode. 1 blocker tìm thấy: Goal #2 (mục 2) ghi "route Admin API
  mới phát sinh từ Phase 9-13" nhưng Non-goals lại loại trừ route Phase 13 — mâu thuẫn trực tiếp
  gây nhầm phạm vi cho Codex, nhất là khi Phase 13 chưa implement tại thời điểm viết phase này. Đã
  sửa Goal #2 thành "Phase 9-12" cho khớp Non-goals.

### Tests
- [ ] `tests/rbac-boundaries.test.ts` (hoặc file thay thế `phase-3-route-auth.test.ts`) pass với cả
  23+ route, phân biệt đúng 401 (chưa đăng nhập) vs 403 (đăng nhập nhưng thiếu quyền).
- [ ] Chạy lại toàn bộ `npm test` — không regression Phase 0-13.

### Definition of Done
1. Mọi route API hiện có được gắn `minRole` tường minh và có test khẳng định đúng role.
2. Audit Server Actions ghi thành ADR, không còn là "tin tưởng suông".
3. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
