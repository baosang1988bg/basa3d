# BaSa3D Project Constitution

> Hiến pháp cho mọi agent (Claude Code, Codex, Gemini, swarm `/speckit-auto`) khi làm tính năng
> mới bằng GitHub Spec Kit. Nguồn quy tắc gốc là `AGENTS.md`; file này chỉ cô đọng lại thành
> các cổng kiểm tra cho `plan.md` (Constitution Check). Khi hai file mâu thuẫn, `AGENTS.md` thắng
> và phải sửa file này cho khớp.

## Core Principles

### I. Database là nguồn sự thật (NON-NEGOTIABLE)
- Mọi thay đổi schema đi qua migration mới trong `supabase/migrations/` (không sửa migration cũ,
  không đổi DB bằng tay ở production). Cập nhật `docs/database/schema.md` + `migrations.md`.
- Ràng buộc toàn vẹn (CHECK, FK, unique, guard chuyển trạng thái) đặt ở DB khi có thể, không chỉ ở UI.
- Tiền lưu dạng số nguyên đơn vị nhỏ nhất (VND = 1), không dùng float.

### II. Tồn kho & đơn hàng đúng tuyệt đối
- Thay đổi tồn kho ghi thành movement bất biến; không ghi đè số tồn.
- Đơn hàng snapshot dữ liệu sản phẩm/biến thể tại thời điểm mua.
- Mọi luồng có thể chạy song song (đặt hàng, trừ kho, chuyển trạng thái) phải nêu rõ chiến lược
  concurrency (transaction, khoá dòng, điều kiện trạng thái) và có test.

### III. Bảo mật phía server
- Phân quyền kiểm tra ở server (route handler / server action / RLS); ẩn UI không phải bảo mật.
- Validate mọi input ngoài ở biên bằng Zod.
- Không lưu/in secret; test chỉ dùng DB/Supabase local dùng-một-lần (`TEST_*`), không bao giờ dùng app credentials.

### IV. Kiểm thử là một phần của tính năng
- Mỗi quy tắc nghiệp vụ quan trọng có test tự động (`tests/*.test.ts`, `node --test` qua tsx).
- Luồng quan trọng (checkout, báo giá, admin đơn hàng, tồn kho) có E2E Playwright trong `e2e/`.
- Definition of Done: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` đều xanh;
  E2E cho luồng bị ảnh hưởng.

### V. Đơn giản & lát cắt dọc
- Ưu tiên giải pháp nhàm chán, tường minh (chủ dự án là mobile dev chuyển sang web).
- Mỗi lát cắt: DB/migration → service/API → UI/admin → test → docs.
- Không thêm dependency khi chưa có lý do cụ thể ghi trong `plan.md`. Không microservice sớm.
  Không tối ưu trước khi đo. Không sửa file không liên quan.
- UI dùng component shadcn/ui có sẵn; không gắn UI trực tiếp vào bảng Supabase khi cần tầng service/domain.

### VI. Truy vết quyết định (cầu nối với PHASE_START_PROTOCOL)
- Quyết định kiến trúc mới → ADR trong `docs/architecture/decisions.md`.
- Quy tắc nghiệp vụ mới/đổi → `docs/database/business-rules.md`.
- Mỗi feature Spec Kit có một exec-plan cầu nối `docs/exec-plans/active/feature-NNN-slug.md`
  (checklist + DoD); đóng bằng skill `close-phase` khi DoD đạt.
- Không tự bịa quy tắc nghiệp vụ: chỗ mơ hồ ghi `[NEEDS CLARIFICATION]` hoặc ghi giả định vào ADR.

## Governance

- Agent tự động không deploy (Vercel), không push, không chạy migration lên DB hosted.
- Sửa hiến pháp: cập nhật version + ngày, và đối chiếu lại `AGENTS.md`.

**Version**: 1.0.0 | **Ratified**: 2026-10-20 | **Last Amended**: 2026-10-20
