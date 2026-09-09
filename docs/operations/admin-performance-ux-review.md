# Review admin: hiệu năng, bug và UX — 2026-09-07

## Phạm vi và độ chắc chắn

Review code hiện tại, bao gồm thay đổi chưa commit trong workspace; đối chiếu roadmap,
các phase 22–26 và admin-actions-review.md. Chưa đo trên browser có phiên đăng nhập,
chưa profile SQL/production nên các nguyên nhân chậm dưới đây là ứng viên có bằng chứng
trong code, chưa phải kết luận định lượng. Không sửa ứng dụng hoặc dữ liệu trong đợt này.

## Ưu tiên xử lý

| Mức | Phát hiện / bằng chứng | Tác động và hướng xử lý |
| --- | --- | --- |
| P1 | `src/app/admin/(protected)/layout.tsx` gọi `getOperationalMetrics()` chỉ để lấy 3 badge. `src/services/dashboard.service.ts` triển khai khoảng 12 SQL cho toàn bộ operational metrics. | Khi layout được render, trang phụ cũng phụ thuộc truy vấn trend, stock, pipeline, material health. Tách query badge nhỏ, giữ full metrics ở dashboard. React cache hiện có đã chống gọi trùng trong cùng render request, không phải cache qua các request. |
| P1 | `src/components/admin/status-filter-tabs.tsx` dùng thẻ `a` để chủ động reload toàn trang. | Mỗi lần lọc chạy lại document/auth/layout. Đây là workaround có ghi nhận lỗi soft navigation ở production; phải tái hiện và sửa nguyên nhân, kiểm thử production trước khi đổi về Link. |
| P1 | Orders, print-jobs và products pages cố định `limit: 100`, không có điều khiển trang; orders/print-jobs chỉ đọc filter. | Bản ghi thứ 101 trở đi không truy cập được từ danh sách tương ứng; số lượng hiển thị chỉ là số hàng đã tải. Thêm pagination, tìm kiếm và thứ tự ổn định với ID làm tie-breaker; giảm page size còn 20–25. |
| P1 | `orders/actions.ts`, `custom-requests/actions.ts` gọi schema.parse/service trực tiếp; nhiều form chỉ có submit button. Không có error.tsx trong src/app tại thời điểm review. | Lỗi nghiệp vụ/validation không được trình bày tại form; thiếu pending và kết quả lưu dễ khiến người dùng tưởng bị treo hoặc bấm lại. Trả lỗi có cấu trúc, giữ input, disable khi pending; error boundary cho lỗi bất ngờ. Không kết luận đã xảy ra ghi dữ liệu trùng. |
| P2 | `src/lib/supabase/middleware.ts` và `src/lib/auth/require-admin.ts` đều gọi auth.getUser(). | Hai tầng xác thực là ứng viên tăng latency; React cache của requireAdmin không gộp middleware. Đo riêng từng tầng trước khi thay đổi; giữ authorization server-side. |
| P2 | `dashboard/page.tsx` await operational rồi mới lấy financial cho OWNER. | Hai nhóm độc lập đang nối tiếp. Chạy song song sau xác thực; chia các vùng dashboard để loading không phải chờ toàn bộ thống kê. |
| P2 | Dashboard SQL dùng created_at::date, date_trunc trên cột và stock subquery theo từng variant. | Có nguy cơ tăng chi phí khi dữ liệu lớn. Đo EXPLAIN trên môi trường thích hợp; xét range thời gian, aggregate và index theo kế hoạch thực tế. Chưa khẳng định full scan hoặc cần thêm index. |
| P2 | Layout/nav cố định sidebar w-56, main p-6; form sản phẩm grid-cols-2; danh sách việc in hiển thị UUID dài. | Không có bố cục sidebar mobile; ít không gian thao tác trên màn hình hẹp. Thêm menu thu gọn, main min-w-0, spacing responsive, mã nghiệp vụ dễ đọc và liên kết tới bản ghi liên quan. |
| P2 | Products page đặt form tạo, calculator và danh mục trước danh sách; tải material/config ngay khi mở trang. | Công việc tìm/sửa sản phẩm phải cuộn qua form dài. Đưa danh sách lên đầu, chuyển tạo mới sang trang/drawer riêng và tải dữ liệu cần thiết khi mở. |
| P2 | Trạng thái hiện trực tiếp NEW, CONFIRMED, QUEUED...; sidebar trộn tiếng Việt với Dashboard/Custom request. | Thêm mapping nhãn tiếng Việt nhất quán; nút diễn đạt hành động như “Bắt đầu in”, “Hoàn tất kiểm tra”, kèm hướng dẫn bước kế tiếp. |
| P3 | Products page dùng product.basePrice làm điều kiện hiển thị. | Giá hợp lệ bằng 0 hiển thị “—”. Kiểm tra null thay vì truthiness. |

Lưu ý badge: comment trong layout cho rằng layout luôn chạy lại khi navigation cần
được kiểm chứng. Không nên dựa vào comment này để bảo đảm badge luôn mới; kiểm tra
navigation và invalidation sau mutation trên production build.

## Tồn đọng ngoài hiệu năng

- `docs/operations/admin-actions-review.md`: sửa/xóa danh mục, sửa nhân viên,
  sửa thông tin yêu cầu in, UX hủy đơn/việc in, xác nhận hủy chi tiêu, xóa blog
  vẫn được ghi nhận thiếu. Quy tắc xóa/sửa phải tôn trọng audit, snapshot và ledger.
- Kho nhựa đang có thay đổi chưa commit, gồm sửa metadata và lưu trữ; không coi
  đây là tính năng thiếu. Review trước ghi nhận chưa chạy integration/E2E trên DB test riêng.
- Phase 16 còn chờ chọn nhà cung cấp webhook cho đối soát thanh toán.
- Phase 18 còn phần i18n cart/checkout/custom-print/blog/quotes hoãn lại.
- Phase 22 được Owner hoãn, có rủi ro hướng chữ mặt bên chưa kiểm chứng.
- Phase 25/26 còn kiểm chứng in thật; Phase 26 hoãn Worker/Voronoi/manifold repair.
  Không có bằng chứng việc hoãn Worker của tool Jigsaw gây lag admin.
- Checklist deployment còn ô chưa đánh dấu; cần xác nhận thực tế vận hành, không
  suy luận các dịch vụ chưa cấu hình chỉ từ trạng thái checklist.

## Lộ trình đề xuất

1. Đo production build: mở trực tiếp, chuyển trang, đổi filter và lưu trên dashboard,
   orders, products, materials; tách TTFB/auth/SQL/render, ghi dataset và cold/warm run.
   Đặt ngân sách p50/p95 sau baseline. Không dùng cảm giác của next dev làm số đo production.
2. Sửa tải thừa của layout và dashboard, sau đó đo lại cùng điều kiện. Kiểm tra
   badge/invalidation và OWNER/STAFF; không cache dữ liệu quyền giữa người dùng.
3. Sửa khả năng tìm bản ghi: pagination/search, test dữ liệu vượt 100 hàng,
   filter kết hợp page, back/forward và refresh trên production build.
4. Nâng UX các tác vụ thường xuyên: trạng thái tiếng Việt, pending/error/success,
   xác nhận hành động có hậu quả, danh sách trước form tạo, responsive navigation.
5. Bổ sung các thao tác sửa thiếu theo từng domain, chốt quy tắc trong ADR trước
   khi triển khai. Theo Phase Start Protocol cho đợt triển khai tiếp theo.

## Kiểm tra

- Static review các file nêu trên và tài liệu tồn đọng.
- Chạy `npm run typecheck` trong workspace hiện tại; kết quả báo ở phản hồi review.
- Không chạy DB integration/E2E hoặc mutation vào dữ liệu app trong đợt review.
- Chưa chứng nhận hết bug toàn dự án; cần runtime review với môi trường và dữ liệu test riêng.
