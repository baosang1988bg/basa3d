# Prompt gửi Claude Review — Phase 12 Plan v2 (sau khi tự chốt 2 blocker)

Read `AGENTS.md` and `CLAUDE.md` first, then `docs/exec-plans/active/phase-12.md` in full.
Phase 12 đã qua 1 vòng review (2026-09-01) với verdict **chưa sẵn sàng giao Codex** — 2 blocker
kiến trúc và vài gap tài liệu. Toàn bộ đã được chốt trực tiếp vào `phase-12.md` (không phải
Codex tự quyết khi code). Vòng review này xác nhận các quyết định mới có nhất quán và đủ chi
tiết để giao Codex hay chưa.

---

## 1. Project & Phase Context

- BaSa3D là nền tảng thương mại & dịch vụ in 3D, PostgreSQL, modular monolith.
- Phase 12 thêm `filament_spools` (theo dõi từng cuộn nhựa vật lý) và `expenses` (chi tiêu xưởng,
  OWNER-only), dựa trên 2 Google Sheet thật của xưởng.

## 2. Những gì đã đổi so với bản review lần 1 (tất cả nằm trong mục 2 "Quyết định kiến trúc" của
   phase-12.md, đánh dấu "bổ sung/làm rõ sau review 2026-09-01")

1. **Q1 mở rộng — tích hợp bắt buộc với `print-job.service.ts`**: `updatePrintJobStatus` (nhánh
   `PRINTING`) hiện ghi `PRODUCTION_OUT` qua `lockMaterialForInventoryWrite` (ADR-0018), không có
   `spool_id`. Phase 12 giờ bắt buộc sửa hàm này để dùng `recordSpoolUsage` khi job có `spool_id`,
   thêm cột `print_jobs.spool_id` (nullable), và giữ đường cũ cho job không gắn cuộn. Đây là thay
   đổi vào code Phase 6 đã có, không chỉ thêm bảng mới.
2. **Q2 thu hẹp — bỏ multi-spool/AMS khỏi phạm vi**: mỗi print job dùng đúng 1 cuộn
   (`print_jobs.spool_id` đơn). Lock protocol đơn giản còn lại: `SELECT ... FOR UPDATE` trên 1
   hàng `filament_spools`, không cần sắp thứ tự nhiều spool_id. AMS/multi-spool ghi rõ vào
   Non-Goals, để phase riêng sau nếu xưởng thật sự cần.
3. **Q3 làm rõ — seed CTE dùng `RETURNING` nối insert, không phải 2 statement độc lập** —
   để `ON CONFLICT DO NOTHING` trên `filament_spools` tự động chặn luôn dòng `material_movements`
   PURCHASE trùng khi migration chạy lại (ledger có trigger immutable, không sửa được nếu lỡ
   insert trùng).
4. **Q4 sửa — dùng `requireOwner()`/`requireAdmin()` có sẵn** (`src/lib/auth/require-admin.ts`),
   bỏ `assertOwnerRole` tự viết trong service — đúng convention `pricing-config.service.ts` đang
   dùng. Thêm helper `maskIfNotOwner<T>` dùng chung cho việc mask `purchase_cost`.
5. **Q5 mới — làm rõ cột `filament_spools.status`**: chỉ còn `ACTIVE`/`ARCHIVED` (2 giá trị, set
   thủ công). 4 tầng cảnh báo hiển thị (Còn nhiều/Cần theo dõi/Sắp hết/Đã hết) tính runtime từ %,
   không lưu cột riêng — tránh lệch dữ liệu.
6. **Slice 6 mới — Documentation**: thêm ADR cho Q1/Q2 và boundary quyền thứ 5 (Expenses), cập
   nhật `schema.md`/`business-rules.md`/`roadmap.md`.
7. **`deleteExpense` đổi thành soft-cancel** (`status = 'CANCELLED'`), không `DELETE` — theo Rule
   #7 AGENTS.md (không xoá lịch sử tài chính).

---

## 3. Required Output from Claude

1. Xác nhận 2 blocker gốc (tích hợp print-job, phạm vi AMS) đã được giải quyết triệt để trong văn
   bản `phase-12.md`, không còn mơ hồ cho Codex tự suy diễn.
2. Kiểm tra tính nhất quán nội bộ: Slice 1 (migration), Slice 2 (service), Slice 3 (UI), Slice 5
   (test) có khớp với 5 quyết định Q1–Q5 mới không — đặc biệt đoạn sửa `print-job.service.ts` có
   đủ chi tiết cho Codex biết chính xác cần đổi gì trong file đã tồn tại.
2. Rà lại business-rules.md draft mới (lock theo cuộn, `expenses` soft-cancel) có mâu thuẫn gì với
   14 rule hiện có trong `docs/database/business-rules.md` không.
3. Confirm kế hoạch đã sẵn sàng handoff cho Codex, hay còn điểm nào cần chốt thêm.
