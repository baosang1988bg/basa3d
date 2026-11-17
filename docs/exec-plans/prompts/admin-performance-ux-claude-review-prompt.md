# Prompt Claude — Review admin trước handoff

Copy phần bên dưới vào Claude có quyền đọc repository.

---

Bạn là architect/reviewer của BaSa3D. Owner phản ánh admin vẫn quá lag và khó dùng.
Codex đã lập báo cáo sơ bộ tại `docs/operations/admin-performance-ux-review.md`.
Hãy kiểm chứng độc lập báo cáo này, tìm các thiếu sót quan trọng và đề xuất phạm vi
triển khai cụ thể trước khi handoff cho Codex. **Chưa viết code ứng dụng, chưa tạo
migration, chưa commit và chưa chạy skill codex-handoff.**

## Đọc trước

1. `AGENTS.md`, `PHASE_START_PROTOCOL.md`, `docs/roadmap.md`.
2. `docs/operations/admin-performance-ux-review.md` và
   `docs/operations/admin-actions-review.md`.
3. `docs/architecture/architecture.md`, các ADR liên quan trong
   `docs/architecture/decisions.md`; phần admin trong product requirements.
4. `docs/database/business-rules.md`, `docs/database/schema.md` khi kiểm tra
   quyền, trạng thái, tồn kho hoặc query; chỉ đọc phần liên quan trong
   `3d-printing-website-development-plan.md` nếu cần thêm chi tiết.
5. `docs/operations/test-data-cleanup.md`, `tests/helpers/test-environment.ts`
   và cấu hình test trước khi đề xuất/chạy kiểm tra có DB.

Kiểm tra git status/diff trước khi review: workspace có nhiều thay đổi chưa commit,
bao gồm kho nhựa và tách môi trường test. Không ghi đè, revert hoặc coi chúng là
code đã release. Dùng code hiện tại làm bằng chứng; tài liệu cũ không tự chứng minh
một bug vẫn tồn tại. Áp dụng canonical review skills khi thực hiện loại review tương ứng.

## Câu hỏi phải trả lời

### 1. Vì sao admin chậm?

Theo dõi đường đi middleware → auth → layout → page → service/SQL cho dashboard,
orders, products, materials và print-jobs. Kiểm chứng:

- Layout tải full operational metrics để lấy 3 badge: số query thực tế, dữ liệu
  tải thừa, cache cùng request và hành vi reuse layout qua navigation.
- Hai nơi gọi getUser: chi phí có thể phát sinh và cách đo; không đề xuất bỏ
  xác thực server hoặc tin cookie/session chưa được xác minh để tăng tốc.
- Dashboard await operational rồi financial; cơ hội chạy song song/streaming.
- Filter dùng anchor reload toàn trang: đọc lý do workaround, kiểm tra test/lịch
  sử liên quan; không đổi sang Link trước khi tái hiện lỗi production được ghi nhận.
- Query ngày/tháng, stock aggregate, pagination, pool và payload: phân biệt
  vấn đề có bằng chứng với rủi ro cần EXPLAIN/profile. Không mặc định thêm index/cache.
- Loading hiện có có che được thời gian chờ layout không? Có nguyên nhân nào khác
  trong code khiến click/lưu cho cảm giác không phản hồi?

Nếu có môi trường phù hợp, đo read-only trên production build với dataset rõ ràng:
direct load, soft navigation, filter, cold/warm; tách auth/SQL/TTFB/render khi có thể.
Nếu thiếu phiên đăng nhập hoặc môi trường, ghi rõ chưa đo và cung cấp protocol đo
cụ thể cho implementer. Không bịa thời gian hoặc phần trăm cải thiện.

### 2. Bug nào thực sự cần sửa trước?

- Kiểm chứng các danh sách bị giới hạn 100 hàng mà không có pagination/search;
  kiểm tra cả dropdown có thể bỏ sót lựa chọn khi dữ liệu tăng.
- Lỗi validation/nghiệp vụ, pending, double-submit, giữ dữ liệu form, retry và
  error boundary. Phân biệt nguy cơ bấm lặp với bug ghi trùng đã chứng minh.
- Badge và danh sách/chi tiết có được cập nhật đúng sau mutation liên quan không?
- Giá bằng 0, empty state, trạng thái terminal và thông báo hành động không hợp lệ.
- Đối chiếu backlog admin-actions-review: mục nào đã được thay đổi chưa commit
  giải quyết, mục nào còn thiếu, mục nào cần quyết định nghiệp vụ riêng?

Mỗi finding cần ID, mức độ, file:line, trigger/repro, expected/actual, tác động,
độ chắc chắn và hướng sửa tối thiểu. Ghi rõ finding bị bác bỏ hoặc cần hạ ưu tiên.

### 3. UI nên nâng thế nào để dùng hằng ngày tốt hơn?

Đề xuất dựa trên các tác vụ: tìm đơn → xử lý đơn; nhận yêu cầu → báo giá → việc in;
tra cứu kho nhựa; tìm/sửa sản phẩm. Ưu tiên:

- Danh sách trước form tạo, tìm kiếm/phân trang và giữ filter khi quay lại.
- Nhãn tiếng Việt, mã dễ đọc, action rõ nghĩa theo transition hợp lệ.
- Pending/success/error tại chỗ, xác nhận hủy, giữ input sau lỗi.
- Sidebar responsive, bố cục màn hình nhỏ, keyboard/focus và empty state.

Cho wireframe dạng text hoặc mô tả before/after ngắn cho màn hình đại diện.
Tận dụng stack/component hiện có; tránh redesign toàn bộ hoặc thêm dependency
khi chưa có lý do cụ thể. Không gộp toàn bộ CRUD còn thiếu vào một phase hiệu năng.

## Ràng buộc

- Giữ authorization OWNER/STAFF ở server, không cache chéo người dùng/quyền.
- Không đổi state machine, tiền integer, order snapshot, ledger immutable/audit
  chỉ để đơn giản hóa UI. Quy tắc chưa rõ phải ghi thành quyết định cần chốt.
- Không tạo fixture, cleanup hoặc chạy mutation vào DB app/production.
- Không mở lại Phase 27 đã hủy hoặc các tool 3D đã hoãn chỉ vì có trong backlog.
- Không tự coi mọi ô deployment chưa đánh dấu là hệ thống đang cấu hình sai.
- Chỉ báo test đã thực sự chạy; kết quả typecheck trong báo cáo cũ là lịch sử.

## Đầu ra cần tạo

1. `docs/operations/admin-performance-ux-claude-review.md`:
   - Verdict: READY FOR HANDOFF / NEEDS DECISIONS / BLOCKED, kèm lý do.
   - BLOCKERS, IMPORTANT, SUGGESTIONS; bảng kiểm chứng findings của Codex.
   - Thiết kế tối thiểu đề xuất, trade-off, UX đề xuất và kế hoạch đo.
   - Những kiểm tra đã chạy, hạn chế bằng chứng và câu hỏi Owner thật sự cần trả lời.
2. Một **execution plan dự thảo** trong `docs/exec-plans/active/` theo
   PHASE_START_PROTOCOL. Kiểm tra roadmap để chọn tên/số phù hợp; không dùng lại
   Phase 27 đã hủy. Ghi rõ DRAFT nếu còn quyết định hoặc benchmark chưa hoàn tất.
   Bao gồm brief 5–10 dòng, scope/non-goals, slices theo ưu tiên, file dự kiến,
   acceptance criteria, test matrix, DoD và checklist “Trước khi giao Codex”.

Acceptance phải kiểm chứng được: query badge không tải dashboard không cần thiết;
phân quyền giữ nguyên; truy cập được hàng thứ 101; filter/page/back hoạt động trên
production build; form có phản hồi lỗi/pending; thay đổi dữ liệu phản ánh đúng ở
các màn hình liên quan; kiểm tra viewport nhỏ. Chốt chỉ tiêu latency sau baseline,
không tự hứa con số tuyệt đối khi chưa biết hạ tầng/dataset.

Chia rõ: việc bắt buộc trong phase đầu, việc phase sau và việc đã được Owner hoãn.
Nếu còn blocker, để checklist tương ứng mở và không đánh dấu ready. Chưa sinh
implementer prompt; handoff sẽ thực hiện khi các điều kiện trước handoff được giải quyết.

Trả lời Owner bằng tiếng Việt, mở đầu bằng kết luận và 3–5 ưu tiên quan trọng nhất,
kèm link hai tài liệu đã tạo.
