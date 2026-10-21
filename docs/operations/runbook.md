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

## Nhập kho STL thành sản phẩm nháp (Feature 003)
Chi tiết cờ: `scripts/stl-import/README.md`. Chạy trên máy OWNER, không chạy trên Vercel.
1. Một lần: apply migration `20261022000000_stl_bulk_import.sql` lên Supabase (sau khi review), sửa
   `scripts/stl-import/category-map.json` cho khớp thư mục Drive.
2. Chạy thử: `npx tsx --env-file=.env.local scripts/stl-import/import-stl.ts --in "<thư mục Drive>" --limit 100` → mở
   `.stl-import/report.html`: tỉ lệ lỗi, thời gian/mẫu, ảnh, cảnh báo "nghi sai đơn vị"/"gộp sai".
3. Ghi thật: thêm `--apply`. Mã thoát `3` = bucket ảnh ước tính > 950 MB → dùng `--views 2` hoặc dọn ảnh.
4. Duyệt ở `/admin/stl-import`: tick "đã kiểm tra bản quyền", sửa tên/danh mục/giá, chọn nhiều → **Duyệt** (chỉ OWNER).
   Mẫu bị chặn hiện lý do. Từ chối = lưu trữ, lần nhập sau không tạo lại.
5. Gỡ một mẫu đã lên web: "Ẩn" ở trang sản phẩm (ARCHIVED); muốn lên lại vẫn phải qua điều kiện duyệt.
6. Lỗi giữa chừng: chạy lại lệnh y hệt (an toàn); `--retry-errors` để thử lại mẫu lỗi.
