# Phase 26 — Jigsaw Studio: Cắt mô hình 3D thành mảnh ghép lồng khớp (bản rút gọn)

> **Mục đích**: Tool #7 trong thứ tự ưu tiên đã chốt ở Phase 19. Khách tải lên 1 mô hình 3D (STL/
> OBJ) → cắt thành lưới mảnh ghép kiểu jigsaw, mỗi cạnh cắt có khớp lồi/lõm để lồng khớp lại với
> nhau, in từng mảnh riêng.

Owner đã xác nhận (2026-09-05): **bỏ Flex Sculpt hoàn toàn** (đúng khuyến nghị gốc Phase 19 —
xác nhận trực tiếp trang tham khảo cho thấy đây là 1 phần mềm điêu khắc mesh đầy đủ, brush Move/
Inflate/Pinch/Smooth/Crease/Twist/mask/symmetry, không phải tool tham số, không đáng đầu tư cho quy
mô BaSa3D). Owner đồng ý làm Jigsaw nhưng **chấp nhận bản rút gọn đáng kể** so với trang tham khảo,
xem mục 2 — đây là tool khác hẳn về bản chất so với 7 tool trước (input là mesh tuỳ ý do khách tải
lên, không phải tham số có giới hạn).

---

## 1. Khảo sát trực tiếp trang tham khảo (2026-09-05)

`https://jigsaw-studio.vunguyenhoanglong06031992.workers.dev/` — "Xưởng Ghép Hình 3D": "Cắt mô hình
3D thành các mảnh ghép in được", nút "Nhập mô hình" (upload). Trang không có mẫu preset sẵn nào lộ
qua khảo sát — hoàn toàn dựa vào mô hình khách tự tải lên.

Phase 19 mục 4.2 đã chốt trước (kế thừa nguyên, không mở lại):
1. Giới hạn số tam giác client-side (< 50.000) hoặc ưu tiên preset có sẵn.
2. Thuật toán cắt chạy hoàn toàn trong Web Worker để tránh đơ UI/crash tab di động.

---

## 2. Rút gọn phạm vi so với trang tham khảo (đã Owner xác nhận)

### 2.1 Cắt lưới hình chữ nhật (grid) thay vì Voronoi tự do
Trang tham khảo nhiều khả năng dùng phân mảnh Voronoi (hình dạng mảnh ghép bất định, tự nhiên hơn).
V1 chỉ làm **lưới hàng × cột đều nhau** (giống tinh thần Organizer) — đơn giản hoá đáng kể thuật
toán tính toán hình học, đổi lại mảnh ghép có hình chữ nhật đều thay vì hình dạng ngẫu nhiên.

### 2.2 Khớp nối lồi/lõm dạng "gợn sóng" cố định, không ngẫu nhiên hoá từng cạnh
Mỗi đường cắt bên trong là 1 đường "gợn sóng" (chuỗi bán nguyệt lồi/lõm xen kẽ) thay vì đường thẳng
— khi dùng làm dụng cụ cắt CSG, 2 mảnh liền kề tự động lồng khớp vào nhau. **Không** làm ngẫu nhiên
hoá hình dạng khớp nối từng cặp mảnh (trang tham khảo thật có thể làm khớp mỗi cạnh 1 kiểu khác
nhau để tránh lắp nhầm vị trí) — v1 dùng cùng 1 kiểu gợn sóng cho mọi đường cắt, khách tự nhớ vị trí
lắp qua hình dạng tổng thể của ảnh/mô hình gốc.

### 2.3 Giới hạn thấp hơn Phase 19 mục 4.2 đề xuất, KHÔNG dùng Web Worker ở v1
Phase 19 đề xuất ngưỡng 50.000 tam giác + bắt buộc Web Worker. V1 **hạ ngưỡng xuống 20.000 tam
giác** và **giới hạn lưới tối đa 3×3 = 9 mảnh**, chạy trực tiếp trên main thread (không dựng pipeline
Web Worker — bản thân việc đó là 1 hạng mục kỹ thuật riêng: đóng gói worker script trong Next.js,
truyền mesh qua postMessage, xử lý huỷ/theo dõi tiến trình). Đây là đơn giản hoá **có ghi nhận rõ**,
không phải bỏ qua cảnh báo của Phase 19 — nếu thực tế khách tải mesh lớn/lưới dày gây đơ UI, đó là
điểm cần nâng cấp Web Worker ở phase sau (Non-goal v1, không phải bug).

### 2.4 Không có thư viện mẫu 3D preset sẵn
Chỉ nhận upload — không tự làm 1 bộ preset ("thư viện mẫu 3D có sẵn") như Phase 19 mục 4.2 gợi ý
làm phương án thay thế. Lý do: cần tự thiết kế/xin phép nhiều mẫu 3D chất lượng, tốn thời gian
không cân xứng với giá trị tăng thêm ở v1.

---

## 3. Rà soát hiện trạng có thể tái dùng & Quyết định kỹ thuật

- **CSG boolean**: `three-bvh-csg` (đã cài từ Phase 22) — `SUBTRACTION`/`INTERSECTION` để cắt mesh
  gốc theo từng ô lưới.
- **Load mesh tải lên**: `STLLoader`/`OBJLoader` từ `three/addons/loaders/` (đã có sẵn trong
  `three`, không phải dependency mới) — parse `ArrayBuffer` phía client, không upload lên server để
  xử lý (giữ nguyên triết lý "toàn bộ tính toán trên trình duyệt" của các tool trước).
- **3MF/STL export**: `write3mf`/`exportBlocksStlZip` (Phase 21) — mỗi mảnh ghép là 1 object/file
  riêng (khách in từng mảnh).
- **Route group `(tools)`**: layout/quy ước file (Phase 20-25).

### 3.1 Kiến trúc cắt: "dụng cụ cắt" hình gợn sóng, không cắt mặt phẳng thẳng
Mỗi đường cắt trong lưới (dọc hoặc ngang) được thay bằng 1 `THREE.Shape` dạng dải gợn sóng (chuỗi
`absarc` bán nguyệt lồi/lõm xen kẽ dọc theo đường cắt), extrude xuyên suốt chiều cao bounding box mô
hình gốc (+biên an toàn) → dùng làm ranh giới chia ô. Mỗi ô lưới = 1 `THREE.Shape` khép kín ghép từ
các đoạn gợn sóng biên (trái/phải/trên/dưới), extrude xuyên suốt, intersect với mesh gốc bằng
`Evaluator().evaluate(meshBrush, cellBrush, INTERSECTION)` → 1 mảnh ghép.

### 3.2 Giới hạn
`MAX_TRIANGLES = 20000`, `MAX_GRID = 3` (tối đa 3×3), `MAX_UPLOAD_SIZE_MB = 15`.

---

## 4. Goal & Non-goals

### Goal
1. Khách tải lên file STL/OBJ (≤ 20.000 tam giác, ≤ 15MB), chọn lưới hàng×cột (tối đa 3×3), xem
   preview 3D các mảnh ghép đã cắt rời (có khoảng hở giữa các mảnh để nhìn rõ) ngay trên trình
   duyệt.
2. Xuất 3MF (mỗi mảnh 1 object riêng) hoặc STL zip (mỗi mảnh 1 file).
3. Custom Request flow (upload file gộp đại diện) + GA4 (`tool_jigsaw_preview`,
   `tool_jigsaw_export_download`, `tool_jigsaw_export_to_request`).

### Non-goals
- **Không cắt Voronoi/hình dạng tự do** (mục 2.1).
- **Không ngẫu nhiên hoá từng khớp nối** (mục 2.2).
- **Không dùng Web Worker** — giới hạn thấp hơn để chạy an toàn trên main thread (mục 2.3).
- **Không có thư viện preset** — chỉ nhận upload (mục 2.4).
- **Không validate mesh có watertight/manifold hay không trước khi cắt** — nếu mesh tải lên bị lỗi
  (không kín), kết quả CSG có thể sai/lỗi hình học; chỉ bắt lỗi runtime (try/catch báo lỗi rõ ràng),
  không tự động sửa mesh lỗi (nằm ngoài phạm vi hợp lý của phase này).

---

## 5. Rủi ro

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| **Mesh tải lên phức tạp/lỗi khiến CSG treo hoặc lỗi** | Trung bình-Cao, chấp nhận | Giới hạn tam giác + lưới thấp (mục 2.3); try/catch báo lỗi rõ; không có Web Worker ở v1 — rủi ro đã ghi nhận, không phải bỏ sót. |
| **Khớp nối không đủ chặt khi in thật (dung sai FDM)** | Trung bình, chưa verify | Tương tự Phase 25 — chưa in thử trong môi trường này, chấp nhận rủi ro tồn đọng. |
| **Định dạng OBJ/STL lạ (material, multi-mesh) không parse đúng** | Thấp-Trung bình | Chỉ hỗ trợ single-mesh phổ biến; báo lỗi rõ nếu file phức tạp hơn dự kiến. |

---

## 6. Checklist

- [x] Khảo sát trực tiếp trang tham khảo (mục 1).
- [x] Owner xác nhận bỏ Sculpt, làm Jigsaw bản rút gọn (mục 2).
- [x] Claude self-review.
- [x] Implement: `src/lib/3d-tools/jigsaw/{jigsaw-constants,jigsaw-engine}.ts` (upload STL/OBJ qua
      `STLLoader`/`OBJLoader` có sẵn trong `three`, cắt lưới bằng `three-bvh-csg` INTERSECTION mỗi
      ô, cạnh khớp nối dựng bằng lấy mẫu điểm tường minh trên nửa đường tròn thay vì `absarc` để
      tránh nhầm lẫn chiều thuận/nghịch kim đồng hồ), workbench/canvas/page tại
      `src/app/[locale]/(tools)/tools/jigsaw/`, GA4 (`trackJigsaw*`).
- [x] Tests: `tests/jigsaw-engine.test.ts` (4 test, gồm 1 test xác nhận trực tiếp 2 mảnh kề nhau
      thật sự lồi/lõm khớp nhau — không chỉ kiểm tra hình học hợp lệ chung chung),
      `tests/jigsaw-analytics.test.ts`, `e2e/jigsaw.spec.ts` (tự sinh 1 file STL cube mẫu để test
      upload thật).
- [x] `npm test` (219 passed sau khi thêm test hồi quy), `npm run typecheck`, `npm run lint`,
      `npm run build` đều pass, route `/tools/jigsaw` lên đúng cả 2 locale.
- [x] **E2E phát hiện 1 lỗi thật** (unit test dùng `THREE.BoxGeometry` không lộ ra được): file
      STL/OBJ tải lên thật không có thuộc tính `uv`, trong khi `three-bvh-csg`'s `Evaluator` mặc
      định kỳ vọng `uv` trên mọi brush và ném lỗi "Cannot read properties of undefined (reading
      'array')" khi thiếu — sửa bằng `evaluator.attributes = ['position', 'normal']` (bỏ `uv`,
      không cần cho export STL/3MF). Đã thêm `tests/jigsaw-engine.test.ts` 1 test hồi quy dùng mesh
      không có `uv` để bắt lại lỗi này tự động, không cần chờ E2E lần sau.
- [x] Playwright E2E `e2e/jigsaw.spec.ts` pass sau khi sửa (tự sinh + upload 1 file STL cube thật
      qua input file, xác nhận toàn bộ flow tải mô hình → cắt → xuất file → gửi yêu cầu → Admin
      thấy request).
- [x] **Gemini Architecture Review hoàn tất (2026-09-05)**:
      - Q1 (Web Worker): Chấp nhận bỏ Web Worker ở v1 để giữ code tinh gọn; ghi nhận pending nâng cấp nếu mở rộng lưới/tam giác.
      - Q2 (Lưới chữ nhật + mộng sóng cố định): Giữ nguyên hiện trạng (đủ tốt và nhận diện qua bề mặt nổi 3D).
      - Q3 (Không validate manifold): Giữ nguyên hiện trạng (try/catch bắt lỗi runtime).
      - Q4 (Bỏ `uv` khỏi CSG evaluator): Giữ nguyên hiện trạng (tối ưu cho in 3D STL/3MF).

---

## 7. Các hạng mục Pending / Tồn đọng (Deferred to Future Phases)

1. **Web Worker Pipeline**: Tạm hoãn (pending). Khi nào nhu cầu thực tế cần cắt lưới dày ($>3\times 3$) hoặc mesh phức tạp ($>20.000$ tam giác) gây đơ giao diện mới xem xét đưa thuật toán sang worker.
2. **Cắt Voronoi / Mộng ngẫu nhiên**: Tạm hoãn (pending). Bản lưới chữ nhật với mộng sóng cố định đáp ứng trọn vẹn nhu cầu tạo mảnh ghép 3D có liên kết cơ học.
3. **Kiểm tra/Vá lỗi Manifold tự động**: Tạm hoãn (pending). Giữ cơ chế try/catch an toàn.
4. **Kiểm chứng in thực tế (Physical Print Validation)**: Tồn đọng theo dõi chung cùng Phase 20, 25 (xưởng sẽ in thử trước khi sản xuất hàng loạt).

