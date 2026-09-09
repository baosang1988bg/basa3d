# Rà soát thao tác admin — 2026-09-05

| Mục | Hiện có | Thiếu / cần cải thiện |
| --- | --- | --- |
| Sản phẩm | Thêm, sửa, lưu trữ/khôi phục; Owner xóa trong chi tiết | Nút sửa/xóa ở danh sách cần rõ hơn; xóa bị chặn nếu có biến thể/tham chiếu |
| Danh mục sản phẩm | Thêm | Sửa, xóa khi không được dùng |
| Kho nhựa | Thêm, kiểm kê; vừa bổ sung sửa mã/lõi/ghi chú, lưu trữ/khôi phục, lọc trạng thái | Sửa sai vật liệu, giá mua, khối lượng gốc cần quy trình nghiệp vụ riêng |
| Chi tiêu | Thêm, sửa, hủy khoản chi từ danh sách | Xác nhận trước hủy và trình bày dữ liệu đã hủy dễ nhận biết hơn |
| Đơn hàng | Sửa trạng thái, thanh toán/giao hàng, ghi chú; hủy qua trạng thái | Nút hủy rõ ràng; sửa thông tin khách theo trạng thái; không xóa lịch sử mua hàng |
| Yêu cầu in | Thêm, đổi trạng thái, tạo/duyệt báo giá | Sửa thông tin nhập nhầm; thao tác từ chối rõ hơn |
| Việc in | Đổi trạng thái, gán vật liệu/cuộn, sửa số liệu thực tế | Nút hủy rõ hơn; không xóa lịch sử tiêu hao |
| Blog | Thêm/sửa, đưa về nháp | Xóa bài và sửa/xóa danh mục |
| Nhân viên | Thêm, vô hiệu hóa/kích hoạt | Sửa thông tin nhân viên |
| Tồn kho | Ghi movement điều chỉnh | Hướng dẫn sửa sai bằng movement bù; không sửa/xóa ledger |
| Cấu hình giá | Tạo phiên bản mới | Hướng dẫn thay cấu hình sai bằng phiên bản mới |
| Nhật ký | Xem | Chỉ đọc để giữ dấu vết thao tác |

Đợt này triển khai phần Kho nhựa; không có migration và không sửa dữ liệu thật.
Các mục còn thiếu trong bảng chưa được triển khai. Chi tiết quy tắc ở
`docs/architecture/decisions.md`, mục Admin correction UX.

## Kiểm tra database/security

BLOCKERS: không phát hiện trong phạm vi metadata + trạng thái cuộn. Không có hard delete
hoặc sửa ledger; service khóa hàng và ghi audit trong transaction; server actions gọi
requireAdmin, validate trường được phép; DTO form không chứa giá mua Owner-only.

IMPORTANT: archive không bù movement nhập nhầm và không tự hủy việc in đã gán cuộn.
Chưa kiểm tra E2E/integration trên Supabase test riêng; không dùng DB app để tạo fixture.

SUGGESTIONS: mở rộng theo ưu tiên nghiệp vụ trong bảng; không dùng một nút DELETE chung
cho các bảng có tài chính, snapshot đơn hàng hoặc sổ kho.
