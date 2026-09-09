# Operations Runbook

## Incident order mismatch
1. Stop further manual stock edits.
2. Inspect inventory movements.
3. Inspect order event/status history.
4. Identify the actor and timestamp.
5. Correct with a new auditable adjustment, not by rewriting history.

## Deployment failure
1. Check build logs.
2. Check migration status.
3. Roll back application version if safe.
4. Do not blindly roll back DB schema after destructive migrations.

## Khiếu nại bản quyền (Phase 29)
1. Tiếp nhận khiếu nại qua hotline/Zalo/email công khai của BaSa3D (xem
   `SITE_CONFIG`/footer trang chủ) — không có form khiếu nại riêng.
2. Xác minh căn cứ tối thiểu: bên khiếu nại chứng minh được quyền sở hữu (link
   gốc, đăng ký bản quyền/nhãn hiệu, v.v.) và chỉ ra đúng sản phẩm/đơn hàng vi
   phạm.
3. Nếu có căn cứ hợp lý: gỡ listing khỏi catalogue (`ARCHIVED` qua
   `archiveProductAction`) hoặc tạm dừng in đơn custom request liên quan
   (chuyển trạng thái `REJECTED` với `overrideReason` ghi rõ lý do) trong vòng
   **24–48h** kể từ khi nhận khiếu nại.
4. Ghi lại vụ việc vào mục "Nhật ký cập nhật" của
   `docs/exec-plans/active/phase-29-copyright-compliance.md` — ngày, sản
   phẩm/đơn liên quan, kết luận.
5. Nếu khiếu nại không có căn cứ rõ ràng hoặc có tranh chấp, không tự ý gỡ —
   báo Owner quyết định, tham vấn pháp lý nếu cần.
