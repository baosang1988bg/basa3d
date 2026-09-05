# Phase 19 — Roadmap nhân rộng bộ "3D Tools" (Flex Playground clone, phần còn lại)

> **Mục đích**: Phase 17 đã lấy 1 tool duy nhất từ "Flex Playground" (text/keychain khắc tên) vì đó
> là nhóm rủi ro kỹ thuật thấp nhất + giá trị thương mại cao nhất, và **cố ý** để 13 tool còn lại
> cho các phase sau (xem phase-17.md, mục mở đầu). Phase 19 **không implement code** — đây là tài
> liệu roadmap: rà soát 8 tool khả dụng còn lại trên trang gốc, đánh giá độ phức tạp/rủi ro/khả năng
> tái dùng engine hiện có, và xếp thứ tự ưu tiên để mỗi tool trở thành 1 phase riêng (20, 21, ...)
> theo đúng AGENTS.md #10 (small vertical slices).

Nguồn: `https://landing.vunguyenhoanglong06031992.workers.dev/#tools` (khảo sát 2026-09-04). Trang
liệt kê 14 tool: 9 đang chạy + 5 "coming soon". Đã trừ **Flex Tag** (name → nameplate/keychain,
STL/3MF) vì trùng phạm vi với tool đã có (`src/lib/keychain/keychain-engine.ts`,
`/tools/keychain-generator`). 5 tool "coming soon" (Letter Studio, Flexi Buddy, Flex Bowl, Flexi
Cutter, 3MF Color Splitter) chưa có trên trang gốc để khảo sát chi tiết — không đưa vào roadmap này,
chỉ ghi nhận để theo dõi sau.

**Phát hiện quan trọng (khảo sát lại 2026-09-04, sau khi user yêu cầu clone đúng UX gốc)**: mỗi tool
card trên trang landing **không** phải route nội bộ — nó điều hướng sang **1 subdomain Cloudflare
Workers riêng biệt** (`https://flex-sculpt.vunguyenhoanglong...`, `https://flex-organizer.vunguyen...`,
v.v., mỗi tool 1 domain riêng). Nói cách khác trang gốc là 1 "landing/hub" thuần tuý, còn 9 tool là 9
ứng dụng web độc lập, triển khai tách biệt hoàn toàn. User muốn bản clone giữ đúng trải nghiệm này
("các function đều mở ra 1 web") — đây là điểm khác biệt lớn so với giả định ban đầu của Phase 19
draft (route `/tools/<slug>` trong cùng Next.js app, theo pattern `/tools/keychain-generator` hiện
có). Xem Quyết định cần chốt #1 bên dưới — đây là câu hỏi kiến trúc quan trọng nhất, cần Gemini
challenge trước khi chốt cho toàn bộ roadmap.

---

## 1. Rà soát hiện trạng engine đã có

`keychain-engine.ts` (Phase 17) là nền tảng dùng lại được:

- **Ba dependency đã cài**: `three` (extrude/CSG-adjacent geometry), `opentype.js` (font → path,
  hỗ trợ dấu tiếng Việt), `three/addons` (`STLExporter`, `BufferGeometryUtils`).
- **Kỹ thuật đã chứng minh**: `THREE.Shape` + `ExtrudeGeometry` cho biên dạng 2D → khối 3D,
  `mergeGeometries` để gộp nhiều mesh, xuất STL binary qua Blob.
- **Chưa có**: bất kỳ phép **boolean CSG** nào (union/intersect/subtract giữa 2 mesh) — three.js
  không có CSG built-in, Phase 17 chỉ cần merge (không cần trừ/giao khối). Đây là gap kỹ thuật lớn
  nhất cho các tool bên dưới cần boolean.
- **Chưa có**: xuất **3MF đa màu** (Phase 17 chỉ xuất STL đơn sắc). Cần thư viện mới hoặc tự viết
  writer 3MF (zip + XML theo spec).
- **Chưa có**: UI sculpting/brush (vẽ biến dạng mesh tự do) — hoàn toàn khác nhóm kỹ thuật parametric
  hiện tại.

## 2. Đánh giá 8 tool còn lại

| # | Tool (tên gốc) | Input → Output | Kỹ thuật cần | Tái dùng engine hiện có | Độ phức tạp |
|---|---|---|---|---|---|
| 1 | **Flex Organizer** — chia ngăn khay | Kích thước khay + số ngăn → STL | Parametric box/grid, không cần font, không cần CSG (ngăn là các khối extrude rời, không giao nhau) | Cao (chỉ cần `ExtrudeGeometry` + `mergeGeometries`, bỏ phần font) | **Thấp** |
| 2 | **Flex Keychain** (block-style) | Text → khối block theo từng chữ, chọn màu mỗi block | Font → path (đã có), nhưng xuất **3MF đa màu** thay vì STL đơn sắc | Trung bình-cao (dùng lại toàn bộ phần dựng chữ, thêm writer 3MF) | **Trung bình** |
| 3 | **Flex Dual Text** | 2 từ → model đọc khác nhau theo góc nhìn | Extrude 2 chữ theo 2 trục vuông góc rồi **boolean intersect** — bắt buộc cần thư viện CSG (vd. `three-bvh-csg`), gap chưa có ở mục 1 | Trung bình (tái dùng font-to-path, nhưng cần dependency mới + thuật toán mới) | **Trung bình-cao** |
| 4 | **Flex Car** | Biển số xe/text → model đọc khác nhau nhiều góc (nội thất xe) | Cùng họ kỹ thuật với Dual Text (multi-angle CSG intersect), có thể build sau khi Dual Text xong để tái dùng | Trung bình (phụ thuộc tool #3 làm trước) | **Trung bình-cao** |
| 5 | **Flex Lamp** | Thiết kế/model người dùng → chao đèn (STL, lắp LED) | Biên dạng revolve (lathe geometry) + hoạ tiết đục lỗ (pattern), khác hẳn extrude thẳng hiện có | Thấp (kỹ thuật mới: `THREE.LatheGeometry` hoặc tương đương, cần UI vẽ profile) | **Trung bình-cao** |
| 6 | **Hinge Box Studio** | Thông số hộp → hộp 1 khối có bản lề in liền (living hinge), không cần lắp ráp | Parametric box + hình học bản lề mỏng phải in đúng dung sai máy in (rủi ro: in hỏng nếu sai kích thước) | Trung bình (hình học không khó dựng, nhưng đúng "print-in-place" cần test in thật, rủi ro ngoài code) | **Cao** (rủi ro vật lý, không chỉ code) |
| 7 | **Jigsaw Studio** | 1 model 3D có sẵn → các mảnh ghép cài khớp (STL) | Cắt mesh theo lưới voronoi/tuỳ ý + tạo khớp nối interlock — cần CSG subtract nhiều lần trên mesh tuỳ ý người dùng upload | Thấp (khác hẳn: input là mesh bất kỳ do user upload, không phải parametric tự dựng) | **Cao** |
| 8 | **Flex Sculpt** | Thao tác điêu khắc tự do (brush) → mesh in được | Sculpt/voxel/mesh-deformation engine, brush dynamics, undo stack — bản chất là 1 mini ZBrush trên web | Thấp (khác hoàn toàn nhóm parametric — gần như 1 sản phẩm riêng) | **Rất cao** |

## 3. Thứ tự ưu tiên đề xuất

1. **Flex Organizer** — thấp nhất về rủi ro kỹ thuật, không phụ thuộc gap CSG/3MF, có giá trị
   thương mại rõ (khay đựng dụng cụ/đồ nghề là sản phẩm in phổ biến). Làm trước để có thêm 1 "quick
   win" giống tinh thần Phase 17.
2. **Flex Keychain (block-style)** — tái dùng tối đa engine chữ đã có, chi phí phát sinh chính là
   writer 3MF đa màu (đầu tư 1 lần, tool #2 sau cũng có thể cần lại nếu mở rộng đa màu).
3. **Flex Dual Text** — mở khoá năng lực CSG boolean (thư viện mới), giá trị "hiệu ứng gây chú ý"
   cao, thường viral trên mạng xã hội → giá trị marketing tốt cho use-case Việt Nam.
4. **Flex Car** — làm ngay sau Dual Text để tái dùng CSG engine vừa xây, tránh trùng công.
5. **Flex Lamp** — kỹ thuật lathe/revolve mới, độ phức tạp UI (vẽ profile) cao hơn nhóm text.
6. **Hinge Box Studio** — hình học không khó nhưng cần validate bằng in thử thật (rủi ro ngoài code,
   nên xếp sau khi đã có vài tool ổn định để so sánh quy trình QA).
7. **Jigsaw Studio** — input là mesh tuỳ ý (không phải parametric), rủi ro kỹ thuật cao nhất trong
   nhóm CSG, nên làm sau khi CSG engine đã "chín" qua tool #3/#4.
8. **Flex Sculpt** — về bản chất là 1 sản phẩm riêng (sculpting engine), không nên làm chung nhịp
   với các tool parametric — cân nhắc lại phạm vi (có thể không đáng đầu tư cho quy mô BaSa3D) khi
   đến lượt.

## 4. Quyết định cần chốt

### 4.1 Kiến trúc "mỗi tool 1 web riêng" — Chốt: Hybrid Route Group `(tools)` trong cùng Next.js App
- **Bản chất yêu cầu**: "Mỗi tool mở ra 1 web" là yêu cầu về **trải nghiệm người dùng (UX)** — không gian làm việc CAD canvas toàn màn hình, tập trung, không bị vướng bởi header/footer cồng kềnh của storefront — chứ **không phải** yêu cầu kỹ thuật phải chia tách 9 deployment/subdomain độc lập (gây lãng phí chi phí vận hành và vi phạm triết lý "boring & maintainable" của `AGENTS.md`).
- **Quyết định chốt**: Giữ trong cùng 1 Next.js app, đưa toàn bộ tool vào route group riêng `(tools)` với Layout tối giản (full viewport canvas + topbar tinh gọn có nút "Về cửa hàng" và "Gửi báo giá").
- **Cô lập hiệu năng & bundle**: Toàn bộ 3D canvas component được lazy-load bằng `next/dynamic(..., { ssr: false })` để chia chunk độc lập 100%, không làm tăng dù chỉ 1KB dung lượng tải trang của storefront.
- **Quy ước cấu trúc file áp dụng cho toàn bộ Phase 20-27**:
  - Route & UI: `src/app/[locale]/(tools)/tools/[slug]/page.tsx` (dùng `src/app/[locale]/(tools)/layout.tsx`).
  - Client Workbench: `src/app/[locale]/(tools)/tools/[slug]/[slug]-workbench.tsx`.
  - Core 3D Engine: `src/lib/3d-tools/[slug]/[slug]-engine.ts` (pure TypeScript, không phụ thuộc React state).

### 4.2 Thư viện CSG cho tool #3/#4/#7 — Chốt: `three-bvh-csg` (parametric) & Rào chắn Web Worker cho Jigsaw
- **Tool #3 (Dual Text) & #4 (Car)**: Chốt chuẩn sử dụng `three-bvh-csg` (thuần JS/TS, tích hợp trực tiếp `BufferGeometry`, dung lượng nhẹ ~50KB, không cần WASM loader).
- **Tool #7 (Jigsaw Studio — mesh tùy ý)**: Không xử lý trực tiếp trên main thread. Bắt buộc:
  1. Kiểm tra giới hạn số lượng tam giác client-side (< 50.000 triangles) hoặc ưu tiên cung cấp thư viện mẫu 3D có sẵn (preset).
  2. Đưa thuật toán cắt mesh chạy hoàn toàn trong **Web Worker** để tránh đóng băng UI hoặc crash tab trình duyệt di động.

### 4.3 Format xuất 3MF đa màu cho tool #2 (Flex Keychain block-style) — Chốt: Lightweight Writer (`fflate`)
- Không cài các thư viện 3MF cồng kềnh bên ngoài.
- Chốt giải pháp: Tự viết module `3mf-writer.ts` (~120 dòng code) tạo cấu trúc file XML chuẩn của 3MF Core + Material Color Group Specification, sau đó nén nhị phân bằng thư viện siêu nhẹ `fflate` (~8KB gzipped).

### 4.4 5 tool "coming soon" trên trang gốc
Không có trong roadmap này — sẽ khảo sát lại khi chúng thực sự xuất hiện trên trang nguồn.

## 5. Non-goals

- Phase 19 không viết code, không tạo route, không đụng schema/DB.
- Không cam kết mốc thời gian cho tool #6/#7/#8 — độ phức tạp/rủi ro của 3 tool này có thể khiến
  scope bị cắt hoặc bỏ hẳn sau khi phase riêng của chúng được brainstorm kỹ hơn.

## Definition of Done (cho Phase 19 — tài liệu roadmap)

- [x] Khảo sát trang nguồn, liệt kê đủ 8 tool còn lại (trừ Flex Tag đã trùng).
- [x] Đánh giá độ phức tạp/gap kỹ thuật/tái dùng engine cho từng tool.
- [x] Thứ tự ưu tiên có lý do rõ ràng, không chỉ liệt kê.
- [x] Gemini challenge hoàn tất và chốt các quyết định kiến trúc cốt lõi (Q1, Q2, Q3).
- [x] User xác nhận thứ tự ưu tiên (hoặc điều chỉnh) trước khi phase-20 (Flex Organizer) được
      brainstorm chi tiết. (Xác nhận 2026-09-05: giữ nguyên thứ tự ưu tiên #1 = Flex Organizer.)

