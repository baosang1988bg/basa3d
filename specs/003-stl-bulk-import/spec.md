# Feature Specification: Nhập hàng loạt kho STL thành sản phẩm nháp, duyệt rồi lên web

**Feature Branch**: `dev` (làm tay bằng `/speckit-specify`; một run `/speckit-auto` song song đang chạy cùng brief)

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: phần PROMPT của `docs/prompts/stl-drive-to-draft-products.md` — "Kho STL trên Google Drive →
Kho sản phẩm DRAFT trong admin → Duyệt → Lên web".

## Bối cảnh

Chủ shop có một kho mẫu STL lớn (theo Phase 32: cỡ vài nghìn file, khoảng 200 GB) trên Google Drive, đã đồng bộ về
máy tính. Hiện muốn đưa một mẫu lên web phải tự chụp/vẽ ảnh, đo kích thước, tính giá và nhập tay từng sản phẩm. Tính
năng này tự động hoá phần lặp lại (ảnh, kích thước, giá ước tính, bản nháp) và giữ lại cho chủ shop đúng phần cần người:
kiểm tra bản quyền, chỉnh tên/giá, quyết định lên web hay không.

Tính năng **thay đổi quyết định T3 của Phase 32** (thư viện mẫu tách khỏi sản phẩm): mẫu nhập từ kho giờ trở thành
**sản phẩm thật ở trạng thái nháp**. Cần một quyết định kiến trúc mới ghi lại lý do, và Phase 32 được thu hẹp hoặc
thay thế tương ứng.

## Clarifications

### Session 2026-10-21

- Q: Giấy phép phi thương mại (NC) có được bán không? → A: Không phân biệt loại giấy phép; chỉ cần admin tick "đã kiểm tra
  bản quyền" (admin chịu trách nhiệm). Loại giấy phép vẫn hiển thị nổi bật khi duyệt. (FR-021)
- Q: Quy mô mẫu lên web? → A: Dưới ~2.000 mẫu; giữ 4 ảnh/sản phẩm trên kho lưu trữ hiện tại. Có thể đổi sau.
- Q: Kho tổ chức theo kiểu nào? → A: Chủ yếu 1 thư mục = 1 sản phẩm nhiều phần → mặc định gom theo thư mục. Có thể đổi sau
  (chưa xác định chắc), nên chế độ gom phải cấu hình được. (FR-002)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Nhập một lô mẫu thành sản phẩm nháp (Priority: P1)

Chủ shop chạy công cụ nhập trên máy mình, chỉ vào thư mục kho (hoặc một thư mục con). Công cụ đọc từng mẫu, tạo ảnh sản
phẩm, đo kích thước và thể tích, ước giá, rồi tạo sản phẩm **nháp** (chưa hiện trên web) kèm ảnh. Mặc định công cụ chỉ
**chạy thử** và xuất báo cáo; chỉ khi chủ shop xác nhận ghi thật thì dữ liệu mới vào hệ thống.

**Why this priority**: Không có bước này thì không có gì để duyệt; đây là phần tiết kiệm công sức lớn nhất.

**Independent Test**: Chạy công cụ trên một thư mục mẫu nhỏ ở chế độ chạy thử → có báo cáo xem được (ảnh, kích thước,
lỗi, thống kê) và không có thay đổi nào trong hệ thống; chạy lại ở chế độ ghi thật → các sản phẩm nháp xuất hiện trong
admin, không hiện trên storefront.

**Acceptance Scenarios**:

1. **Given** kho có 20 mẫu hợp lệ (mỗi mẫu một thư mục), **When** chạy ở chế độ chạy thử, **Then** có báo cáo liệt kê 20 mẫu kèm ảnh,
   kích thước (mm), thể tích, giá ước tính, và hệ thống không có sản phẩm mới.
2. **Given** cùng thư mục, **When** chạy ở chế độ ghi thật, **Then** có 20 sản phẩm ở trạng thái nháp, mỗi sản phẩm có
   ảnh và giá ước tính, được đánh dấu "cần xem lại giá" và "chưa kiểm tra bản quyền".
3. **Given** đã nhập xong lô trên, **When** chạy lại y hệt, **Then** không có sản phẩm trùng nào được tạo.
4. **Given** lô có 1 mẫu hỏng trong 20 mẫu, **When** chạy, **Then** 19 mẫu vẫn được xử lý; mẫu hỏng được ghi lỗi rõ
   ràng trong báo cáo và không làm dừng cả lô.

---

### User Story 2 — Duyệt hàng loạt để lên web (Priority: P1)

Chủ shop mở trang admin "Kho nhập STL", xem lưới các bản nháp (ảnh, tên, danh mục, kích thước, giá ước tính, các cờ cảnh
báo), sửa nhanh tên/danh mục/giá/thông tin bản quyền, tick "đã kiểm tra bản quyền", rồi chọn nhiều mẫu để **duyệt** (lên
web) hoặc **từ chối** (lưu trữ, không lên web). Làm được trên điện thoại.

**Why this priority**: Đây là cửa kiểm soát duy nhất trước khi mẫu ra công chúng; thiếu nó thì bước 1 không mang lại doanh
thu và có rủi ro bản quyền.

**Independent Test**: Với một tập bản nháp có sẵn (tạo bằng dữ liệu test), chọn 5 mẫu trong đó 2 mẫu chưa tick bản quyền →
bấm Duyệt → 3 mẫu lên web, 2 mẫu bị chặn kèm lý do; mẫu đã duyệt xuất hiện ở trang sản phẩm công khai.

**Acceptance Scenarios**:

1. **Given** một bản nháp đã tick "đã kiểm tra bản quyền", có ít nhất 1 ảnh và giá > 0, **When** admin duyệt, **Then**
   sản phẩm hiện ở trang sản phẩm công khai và sitemap.
2. **Given** bản nháp chưa tick bản quyền, **When** admin duyệt, **Then** sản phẩm vẫn là nháp và màn hình báo rõ lý do.
3. **Given** admin chọn 10 mẫu trong đó 3 mẫu không đạt điều kiện, **When** bấm Duyệt, **Then** 7 mẫu lên web, 3 mẫu được
   liệt kê kèm lý do bị chặn.
4. **Given** một bản nháp, **When** admin từ chối, **Then** sản phẩm chuyển sang lưu trữ, không hiện trên web, và lần nhập
   sau không tạo lại nó.
5. **Given** STAFF (không phải OWNER) gọi duyệt/từ chối, hoặc khách chưa đăng nhập gọi bất kỳ thao tác nào, **Then** bị
   từ chối (403/401) và không có gì thay đổi. STAFF vẫn sửa nhanh được.
7. **Given** hai người cùng sửa một thẻ trên hai thiết bị, **When** người thứ hai lưu, **Then** bị báo "dữ liệu đã thay đổi"
   và không ghi đè thay đổi của người thứ nhất.
6. **Given** mọi thao tác duyệt/từ chối/sửa, **Then** đều được ghi vào nhật ký kiểm tra (ai, lúc nào, thay đổi gì).

---

### User Story 3 — Lọc, tìm và xử lý mẫu có vấn đề (Priority: P2)

Với hàng nghìn bản nháp, chủ shop cần lọc theo trạng thái (chờ duyệt / đã duyệt / đã từ chối / lỗi), danh mục, thư mục
nguồn; tìm theo tên; phân trang; xem đường dẫn file gốc để mở kiểm tra; đánh dấu "làm lại ảnh" để lần nhập sau xử lý lại.

**Why this priority**: Cần cho vận hành ở quy mô thật, nhưng một lô nhỏ vẫn dùng được nếu chưa có.

**Independent Test**: Với 50 bản nháp đủ trạng thái, lọc "Lỗi" chỉ ra đúng các mẫu lỗi; đánh dấu "làm lại ảnh" một mẫu →
lần nhập sau mẫu đó được xử lý lại, các mẫu khác giữ nguyên.

**Acceptance Scenarios**:

1. **Given** có bản nháp ở nhiều trạng thái, **When** lọc theo trạng thái hoặc danh mục hoặc thư mục nguồn, **Then** chỉ
   các mẫu khớp được hiển thị, có phân trang.
2. **Given** một mẫu bị đánh dấu "làm lại ảnh", **When** chạy lần nhập tiếp theo, **Then** ảnh và số đo của mẫu đó được tạo
   lại; thông tin admin đã sửa (tên, danh mục, giá, bản quyền) giữ nguyên.

---

### User Story 4 — File gốc thay đổi sau khi đã nhập (Priority: P2)

Chủ shop sửa hoặc thay file mẫu trên Drive. Lần nhập sau phát hiện thay đổi và cập nhật ảnh/số đo của bản nháp mà không
xoá công sức chỉnh sửa của admin; với sản phẩm **đã lên web** thì không tự đổi gì công khai, chỉ gắn cờ cần xem lại.

**Why this priority**: Kho là tài liệu sống; nếu không xử lý, chạy lại sẽ ghi đè hoặc tạo trùng.

**Independent Test**: Nhập 1 mẫu, sửa tên trong admin, thay nội dung file gốc, chạy lại → ảnh/số đo mới, tên admin đã sửa
giữ nguyên; lặp lại với mẫu đã lên web → trang công khai không đổi, mẫu được gắn cờ cần xem lại.

**Acceptance Scenarios**:

1. **Given** bản nháp đã được admin sửa tên, **When** file gốc thay đổi và chạy nhập lại, **Then** ảnh và số đo được cập
   nhật, tên admin đã sửa giữ nguyên.
2. **Given** sản phẩm đã lên web, **When** file gốc thay đổi và chạy nhập lại, **Then** giá và ảnh công khai không đổi,
   sản phẩm được gắn cờ "nguồn đã thay đổi — cần xem lại".

### Edge Cases

- **Tên**: tên file có dấu tiếng Việt, rất dài, chỉ gồm số, có hậu tố kiểu `_v2` / `final` / số thứ tự → tên hiển thị gọn,
  đường dẫn web (slug) không dấu, không trùng (thêm hậu tố `-2`, `-3`), mã SKU đúng quy tắc catalog và không quá 40 ký tự.
- **File**: STL dạng văn bản và dạng nhị phân; file rỗng; file hỏng; mẫu rất nặng (> 1 triệu tam giác); file vượt giới hạn
  dung lượng (bị bỏ qua và ghi rõ trong báo cáo).
- **Đơn vị sai**: kích thước quá nhỏ hoặc quá lớn so với thực tế (nghi đơn vị inch) → cảnh báo trong báo cáo và admin, vẫn
  tạo bản nháp để admin quyết định.
- **Cấu trúc thư mục**: mẫu nhiều phần nằm chung một thư mục lá (gộp thành một sản phẩm — mặc định); thư mục lá chứa
  nhiều mẫu khác nhau (sẽ bị gộp sai — cần cảnh báo khi số phần hoặc kích thước bất thường để admin chạy lại theo chế độ
  mỗi file một sản phẩm); file nằm ngay thư mục gốc, không có thư mục cha để suy ra danh mục.
- **Giấy phép phi thương mại**: vẫn hiển thị loại giấy phép (NC) nổi bật trong lưới duyệt để admin thấy trước khi tick.
- **Danh mục**: thư mục không khớp danh mục nào → vào danh mục "Chưa phân loại", danh mục này không hiện ở storefront.
- **Kho đồng bộ kiểu "stream"**: đọc file làm máy tải file về → cần giới hạn số mẫu mỗi lần chạy.
- **Lỗi giữa chừng**: ảnh đã tải lên nhưng ghi dữ liệu thất bại → không để lại ảnh mồ côi; chạy lại xử lý tiếp được.
- **Duyệt đồng thời**: hai admin duyệt/sửa cùng một mẫu cùng lúc → kết quả nhất quán, không mất thay đổi âm thầm.
- **Đổi tên/di chuyển file trên Drive**: được coi là mẫu mới (giới hạn đã biết, ghi trong Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

**Nhập (công cụ chạy trên máy chủ shop)**

- **FR-001**: Công cụ MUST quét đệ quy một thư mục do chủ shop chỉ định và nhận các file mẫu STL (3MF là tuỳ chọn).
- **FR-002**: Công cụ MUST hỗ trợ hai cách gom: mọi file trong cùng một thư mục lá là một sản phẩm nhiều phần (**mặc
  định**), hoặc mỗi file là một sản phẩm. Chế độ chọn được mỗi lần chạy, và mặc định đổi được bằng cấu hình mà không sửa
  code.
- **FR-003**: Với mỗi sản phẩm, công cụ MUST tính kích thước bao (mm), thể tích (cm³) và độ phức tạp (số tam giác); mẫu
  hỏng/không đọc được MUST được ghi lỗi và không làm dừng cả lô.
- **FR-004**: Công cụ MUST tạo ảnh sản phẩm từ mẫu (mặc định 4 góc: chéo 3/4 làm ảnh đại diện, chính diện, cạnh bên, từ
  trên xuống) với nền sáng trung tính và màu vật liệu chọn được; ảnh đủ nét cho trang sản phẩm (cạnh dài ≥ 1200 px).
- **FR-005**: Công cụ MUST ước giá bằng quy tắc giá hiện hành của shop theo thể tích và vật liệu mặc định, và lưu kèm
  bảng tách giá để admin xem lại.
- **FR-006**: Công cụ MUST sinh tên hiển thị, đường dẫn web (slug) và SKU theo các quy tắc ở mục Edge Cases và
  `docs/product/catalog-spec.md` §3; slug và SKU MUST là duy nhất.
- **FR-007**: Công cụ MUST suy danh mục từ thư mục cha theo một bảng ánh xạ do chủ shop sửa được; không khớp → danh mục
  "Chưa phân loại" không hiển thị ở storefront.
- **FR-008**: Mặc định công cụ MUST chỉ chạy thử (không ghi gì vào hệ thống) và xuất báo cáo xem được trong trình duyệt
  (lưới ảnh, lỗi, cảnh báo, thống kê: số mẫu, tỉ lệ lỗi, thời gian trung bình mỗi mẫu); chỉ ghi thật khi chủ shop yêu cầu
  rõ ràng.
- **FR-009**: Khi ghi thật, mỗi sản phẩm MUST được tạo ở trạng thái **nháp**, loại "in theo đơn", có đúng 1 biến thể mặc
  định, và MUST NOT tạo bất kỳ biến động tồn kho nào.
- **FR-010**: Chạy lại trên cùng nguồn MUST NOT tạo sản phẩm trùng; file nguồn thay đổi MUST chỉ cập nhật ảnh và số đo,
  MUST NOT ghi đè các trường admin đã sửa (tên, danh mục, giá, thông tin bản quyền, mô tả).
- **FR-011**: Với sản phẩm đã lên web, thay đổi nguồn MUST NOT thay đổi giá hay ảnh công khai; hệ thống MUST gắn cờ "cần
  xem lại".
- **FR-012**: Công cụ MUST NOT tải file mẫu gốc lên bất kỳ nơi lưu trữ trực tuyến nào; chỉ ảnh render được tải lên.
- **FR-013**: Nếu ghi dữ liệu một sản phẩm thất bại sau khi đã tải ảnh, công cụ MUST dọn ảnh vừa tải để không còn ảnh mồ
  côi.
- **FR-014**: Mọi sản phẩm tạo/cập nhật bởi công cụ MUST được ghi nhật ký kiểm tra với người thực hiện là "system import".
- **FR-015**: Công cụ MUST chạy được trên macOS và Windows, có tuỳ chọn giới hạn số mẫu mỗi lần, lọc theo mẫu đường dẫn,
  giới hạn dung lượng file, thời gian tối đa mỗi mẫu, và chạy lại riêng các mẫu lỗi.

**Duyệt (trang admin "Kho nhập STL")**

- **FR-016**: Chỉ nhân viên admin (OWNER, STAFF) MUST được xem trang và sửa nhanh; **duyệt và từ chối chỉ OWNER**. Kiểm
  tra quyền ở phía server cho mọi thao tác (người không đủ quyền nhận 403). *(Cập nhật 2026-10-21 theo yêu cầu plan của
  OWNER.)*
- **FR-017**: Trang MUST hiển thị lưới bản nháp với ảnh đại diện, tên, danh mục, kích thước, giá ước tính và các cờ: lỗi xử
  lý, cần xem lại giá, chưa kiểm tra bản quyền, nguồn đã thay đổi, nghi sai đơn vị.
- **FR-018**: Trang MUST cho lọc theo trạng thái (chờ duyệt / đã duyệt / đã từ chối / lỗi), danh mục, thư mục nguồn; tìm
  theo tên; và phân trang.
- **FR-019**: Admin MUST sửa nhanh được tên, danh mục, giá, loại giấy phép, đường dẫn nguồn giấy phép, và tick "đã kiểm tra
  bản quyền".
- **FR-020**: OWNER MUST chọn nhiều mẫu để duyệt hoặc từ chối một lần; kết quả MUST trả về danh sách mẫu bị chặn kèm lý
  do, các mẫu hợp lệ vẫn được xử lý.
- **FR-021**: Một sản phẩm nhập từ kho MUST chỉ lên web khi đồng thời: đã được OWNER duyệt, đã được tick "đã kiểm tra bản
  quyền", có ít nhất 1 ảnh, giá > 0, và thuộc một danh mục khác "Chưa phân loại"; khi bị chặn, hệ thống MUST trả về lý do. Hệ thống không phân biệt loại giấy phép (kể cả phi thương mại — NC): tick "đã kiểm tra bản quyền" là
  admin xác nhận và chịu trách nhiệm (quyết định OWNER 2026-10-21). Quy tắc này MUST được giữ ở mọi đường có thể đưa sản
  phẩm lên web, không chỉ trang này.
- **FR-022**: Từ chối MUST chuyển sản phẩm sang lưu trữ (không hiện trên web) và lần nhập sau MUST NOT tạo lại nó.
- **FR-023**: Trang MUST hiển thị đường dẫn file gốc (chỉ cho admin) và cho đánh dấu "làm lại ảnh" để lần nhập sau xử lý
  lại mẫu đó.
- **FR-024**: Mọi thay đổi từ trang (sửa, duyệt, từ chối, đánh dấu làm lại) MUST được ghi nhật ký kiểm tra.
- **FR-025**: Trang MUST dùng được trên điện thoại (lưới co về 1–2 cột, nút thao tác bấm được bằng ngón tay).

**Công khai**

- **FR-026**: Sản phẩm đã duyệt MUST hiện ở trang sản phẩm công khai và sitemap hiện có, không cần trang mới.
- **FR-027**: Trang và dữ liệu công khai MUST NOT lộ bất kỳ thông tin nguồn nhập nào (đường dẫn file, tên thư mục, trạng
  thái duyệt, cờ nội bộ).

### Key Entities *(include if feature involves data)*

- **Mẫu nhập (import item)**: một nguồn trong kho (1 file, hoặc 1 thư mục nhiều phần) gắn 1–1 với một sản phẩm. Giữ:
  khoá nhận diện nguồn ổn định, đường dẫn tương đối (chỉ admin thấy), danh sách file thành phần (dung lượng, thời điểm sửa),
  số đo (kích thước bao, thể tích, số tam giác), trạng thái xử lý ảnh (chờ / xong / lỗi) và thông báo lỗi, các cờ (cần xem
  giá, đã kiểm tra bản quyền, nguồn đã đổi, cần làm lại ảnh), trạng thái duyệt (chờ / đã duyệt / đã từ chối), người và
  thời điểm duyệt.
- **Sản phẩm (đã có)**: bản nháp do công cụ tạo; dùng lại trạng thái nháp/đang bán/lưu trữ, loại "in theo đơn", danh mục,
  giá kèm bảng tách giá, thông tin giấy phép hiện có.
- **Biến thể (đã có)**: đúng 1 biến thể mặc định mỗi sản phẩm nhập (SKU theo quy tắc catalog).
- **Ảnh sản phẩm (đã có)**: ảnh render, ảnh đầu là ảnh đại diện.
- **Danh mục (đã có)**: thêm danh mục "Chưa phân loại" ẩn khỏi storefront; bảng ánh xạ thư mục → danh mục do chủ shop sửa.
- **Nhật ký kiểm tra (đã có)**: ghi các thao tác của công cụ ("system import") và của admin.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Một lô thật ≥ 100 mẫu chạy xong trong một lần; báo cáo cho thấy tỉ lệ lỗi và thời gian xử lý trung bình mỗi
  mẫu; tỉ lệ mẫu hợp lệ xử lý thành công ≥ 95%.
- **SC-002**: Thời gian để đưa một mẫu từ kho lên web giảm từ thao tác thủ công (chụp ảnh, đo, nhập tay) xuống chỉ còn
  thao tác duyệt; admin duyệt được ≥ 10 mẫu trong ≤ 5 phút trên điện thoại.
- **SC-003**: 0 sản phẩm nhập từ kho lên web khi chưa được tick "đã kiểm tra bản quyền" (kiểm chứng bằng test tự động).
- **SC-004**: 0 thông tin nguồn nhập xuất hiện trong trang hoặc dữ liệu công khai (kiểm chứng bằng test tự động).
- **SC-005**: Chạy lại cùng một lô tạo 0 sản phẩm trùng; 0 trường admin đã sửa bị ghi đè.
- **SC-006**: 0 ảnh mồ côi trong kho lưu trữ sau khi một lần ghi thất bại giữa chừng.
- **SC-007**: Sau khi duyệt, sản phẩm hiện trên trang sản phẩm công khai và sitemap trong lần tải trang kế tiếp (theo cơ
  chế làm mới hiện có của storefront).

## Assumptions

- Kho đã được đồng bộ về máy bằng ứng dụng Google Drive cho máy tính; tính năng đọc qua thư mục đó, không kết nối trực
  tiếp tới Google Drive.
- Quy mô: dưới ~2.000 mẫu lên web → giữ 4 ảnh mỗi sản phẩm trên kho lưu trữ ảnh hiện tại (gói 1 GB, ~0,4 MB/sản phẩm).
  Số ảnh mỗi sản phẩm là tham số, giảm được về 2 nếu quy mô tăng (OWNER: có thể đổi sau).
- Cách tổ chức kho: chủ yếu "1 thư mục = 1 sản phẩm nhiều phần" → mặc định gom theo thư mục lá (OWNER: chưa chắc chắn,
  có thể đổi sau; vì vậy chế độ gom phải đổi được mà không sửa code — FR-002).
- Vật liệu và màu mặc định để render và tính giá: PLA xám; mỗi sản phẩm nhập 1 biến thể mặc định (không tạo sẵn biến thể
  màu — admin thêm sau bằng chức năng sản phẩm hiện có).
- Giá: dùng cấu hình giá đang hoạt động của shop (cost-plus, `catalog-spec.md` §4), luôn gắn cờ "cần xem lại giá"; không
  có hệ số riêng cho hàng catalog trong bản đầu.
- Mô tả sản phẩm: tự sinh một câu ngắn từ tên + kích thước (ví dụ "Mẫu in 3D, kích thước 120 × 80 × 40 mm"), admin sửa được;
  lần nhập sau không ghi đè mô tả đã sửa.
- Loại giấy phép mặc định của sản phẩm nhập là "chưa xác định" (không dùng mặc định "thiết kế của shop" hiện có), để quy
  tắc lên web luôn buộc admin kiểm tra.
- Đổi tên hoặc di chuyển file trên Drive được coi là mẫu mới (mẫu cũ còn lại để admin từ chối); phát hiện di chuyển theo
  nội dung để sau.
- Không nằm trong phạm vi: xem 3D trên trang sản phẩm, cho khách tải file mẫu, đồng bộ Drive theo thời gian thực, ảnh tạo
  bằng AI, tự xác định bản quyền, nhập tồn kho.
- OWNER và STAFF xem/sửa nhanh trang "Kho nhập STL"; chỉ OWNER duyệt/từ chối (FR-016); quy ước role theo hệ thống phân quyền hiện có.
