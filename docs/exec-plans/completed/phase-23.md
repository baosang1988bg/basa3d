# Phase 23 — Flex Car: Bảng tên xe ảo ảnh (xe + chữ, CSG)

> **Mục đích**: Tool #4 trong thứ tự ưu tiên đã chốt ở Phase 19 (`docs/exec-plans/completed/
> phase-19.md`, mục 3) — làm ngay sau Dual Text (Phase 22) để tái dùng đúng engine CSG vừa xây
> (`three-bvh-csg`, kỹ thuật giao 2 mặt vuông góc), đúng lý do xếp thứ tự của Phase 19. Khách chọn
> 1 mẫu xe (silhouette) + nhập tên → 1 khối duy nhất: nhìn thẳng thấy hình xe, xoay 90° thấy tên —
> cùng họ kỹ thuật "ambigram cube" của Dual Text nhưng 1 mặt là hình xe thay vì từ thứ 2.

Owner yêu cầu làm nhanh toàn bộ roadmap còn lại — Claude tự review, không có vòng Gemini Challenge
riêng (giống Phase 22).

---

## 1. Khảo sát trực tiếp trang tham khảo (2026-09-05)

`https://flex-car.vunguyenhoanglong06031992.workers.dev/` (Playwright, tương tác thật để xem cả
bước "Tạo"):

- **Chọn xe**: hiện chỉ có 1 preset hiển thị ("Sedan", icon xe thể thao) + nút **"Tải ảnh xe của
  bạn"** (upload ảnh xe tuỳ ý — suy luận: trích silhouette từ ảnh bằng xử lý ảnh, không rõ thuật
  toán cụ thể vì không lộ qua DOM).
- **Tên**: input text.
- **Kích thước**: 4 preset (`Móc khoá 40mm`, `Nhỏ 65mm`, `Vừa 90mm`, `Lớn 130mm`) + checkbox "Tuỳ
  chỉnh kích thước".
- **Độ nối chữ** (0.15, slider): tham số không rõ cơ chế chính xác qua DOM tĩnh — suy luận hợp lý
  nhất là độ "nối" các nét chữ rời (vd chữ I, L) để chữ không bị rã thành nhiều mảnh rời sau khi
  giao (intersect) với hình xe.
- **Thêm móc khoá**: checkbox.
- Bấm "Tạo" → hiện khối 3D thật: xác nhận đúng kỹ thuật giao 2 mặt vuông góc (hình xe theo 1 trục,
  chữ theo trục kia), không phải chữ nổi phẳng trên nền xe.
- Sau khi "Tạo", xuất hiện thêm mục **"Xuất file in 3D"**: checkbox "Thêm đế phẳng" + slider "Độ
  dày đế (mm)" (mặc định 3) + nút "Xuất file" — đế phẳng là tuỳ chọn, không bắt buộc.

---

## 2. Rà soát hiện trạng có thể tái dùng

- **CSG intersect 2 mặt vuông góc**: `buildFaceBrush`-style (Phase 22, `dual-text-engine.ts`) —
  tái dùng nguyên kỹ thuật extrude + `three-bvh-csg` `Evaluator().evaluate(..., INTERSECTION)`.
  Khác Dual Text: Car không chia theo từng khối ký tự riêng — toàn bộ tên là **1 shape liền** giao
  với **1 shape silhouette xe** (không lặp per-character).
- **Font → path**: `opentype.js` (Phase 17/21/22).
- **3MF/STL export**: `write3mf`/`exportBlocksStlZip` (Phase 21, `src/lib/3d-tools/common/`).
- **Route group `(tools)`**: layout + quy ước file (Phase 20-22).

**Chưa có, viết mới ở Phase 23**:
- Silhouette xe: **tự vẽ 1 mẫu "Sedan"** bằng `THREE.Shape` (đường cong nguyên thuỷ: thân xe +
  2 bánh xe hình tròn khoét lỗ + đường kính chắn gió) — **không** dùng ảnh/asset ngoài, tránh hoàn
  toàn câu hỏi bản quyền silhouette xe thật (khác biệt so với trang tham khảo, nhưng an toàn pháp
  lý hơn và đủ dùng cho v1: 1 mẫu, dễ thêm mẫu khác sau này chỉ bằng cách viết thêm 1 hàm shape).
- Đế phẳng tuỳ chọn (checkbox + độ dày) — tương tự đế `Compact` (Phase 20/21/22) nhưng là tuỳ chọn
  bật/tắt, không bắt buộc.
- Tai móc khoá tuỳ chọn (checkbox) — tái dùng kỹ thuật 2D-Path-Hole (Phase 17).

---

## 3. Goal & Non-goals

### Goal
1. Khách chọn 1 mẫu xe có sẵn (v1: "Sedan"), nhập tên, chọn kích thước tổng thể (4 preset mm hoặc
   tuỳ chỉnh trong giới hạn constants), xem preview 3D khối giao xe+chữ ngay trên trình duyệt.
2. Tuỳ chọn thêm đế phẳng (bật mặc định, độ dày điều chỉnh được) và tai móc khoá.
3. Xuất STL hoặc 3MF (2 màu: màu khối chính + màu đế nếu có).
4. Giá ước tính + Custom Request flow + GA4 (`tool_car_preview`, `tool_car_export_download`,
   `tool_car_export_to_request`) — mirror các phase trước.

### Non-goals
- **Không hỗ trợ tải ảnh xe tuỳ ý** — trích silhouette từ ảnh bất kỳ (edge detection/contour
  tracing) là bài toán xử lý ảnh phức tạp, độ chính xác không đảm bảo, rủi ro pháp lý (khách tải
  ảnh xe có bản quyền/logo hãng xe) và không phải giá trị cốt lõi — để dành phase riêng nếu có nhu
  cầu thực tế rõ ràng.
- **v1 chỉ 1 mẫu xe** (Sedan tự vẽ) — không cố gắng làm nhiều mẫu xe thật đa dạng ngay từ đầu; kiến
  trúc constants cho phép thêm mẫu sau mà không đổi engine.
- **"Độ nối chữ" đơn giản hoá thành độ ăn sâu (overlap) của chữ vào đế phẳng**, không phải thuật
  toán nối liền nét chữ rời (offset/buffer polygon) — xem mục 4.3. Nếu tắt đế phẳng, chấp nhận rủi
  ro 1 số tổ hợp chữ/xe có thể rã mảnh (ghi rõ trong Risks, không im lặng bỏ qua).

---

## 4. Quyết định kỹ thuật

### 4.1 Kiến trúc: 1 shape xe ∩ 1 shape tên (không chia khối)
```ts
export interface CarNameplateConfig { vehicle: 'sedan'; name: string; totalWidthMm: number }
```
- `buildVehicleBrush(vehicle, size)`: dựng silhouette xe (1 `THREE.Shape`, tự vẽ) → extrude theo Z,
  scale để vừa khung `size × size*0.4` (tỉ lệ ngang/dọc xe thực tế, không vuông như khối ký tự).
- `buildNameBrush(name, font, size)`: dựng toàn bộ chuỗi tên (không tách khối) thành 1
  `THREE.Shape[]` gộp, extrude theo trục vuông góc (X, xoay 90° quanh Y giống Dual Text).
- Giao 2 brush bằng `Evaluator().evaluate(vehicle, name, INTERSECTION)` → 1 mesh duy nhất.

### 4.2 Kích thước tổng thể — Chốt 4 preset + tuỳ chỉnh
`NAMEPLATE_SIZE_PRESETS_MM = { keychain: 40, small: 65, medium: 90, large: 130 }`, cho phép tuỳ
chỉnh trong khoảng `[30, 200]` (hằng số `MIN/MAX_NAMEPLATE_WIDTH_MM`).

### 4.3 "Độ nối chữ" → đổi thành độ ăn sâu vào đế (Overlap-into-base), ghi rõ đơn giản hoá
Không tự implement thuật toán offset/buffer polygon cho nét chữ rời (ngoài phạm vi effort hợp lý
của phase này). Thay vào đó, tham số này điều khiển khoảng ăn sâu (mm) của khối giao xuống đế phẳng
— mirror kỹ thuật Epsilon-Overlap đã dùng (Phase 20/21/22), nhưng để khách tự chỉnh trong khoảng
nhỏ `[0.1, 1.0]mm` thay vì hằng số cố định. Đế phẳng mặc định **bật** để giảm rủi ro rã mảnh.

### 4.4 Đế phẳng & tai móc khoá tuỳ chọn — Chốt: móc khoá gắn vào đế, không gắn trực tiếp vào khối giao
- `buildFlatBaseMesh(width, depth, thickness)`: hình chữ nhật đơn giản (không bo góc phức tạp,
  khác Dual Text — đúng UI tham khảo chỉ có "Thêm đế phẳng" không có tham số bo góc).
  Nếu bật: mesh tên+xe ăn sâu `overlapMm` vào đế trước khi merge.
- Tai móc khoá: tái dùng 2D-Path-Hole (Phase 17), đặt ở góc trái đế. **Đơn giản hoá so với trang
  tham khảo**: trang gốc có 2 checkbox độc lập ("Thêm móc khoá" trước khi Tạo, "Thêm đế phẳng" ở
  bước xuất file) — v1 gộp 2 tuỳ chọn này lại, tai móc khoá **chỉ khả dụng khi đã bật đế phẳng**
  (khoét lỗ trực tiếp vào khối giao xe/chữ rủi ro hơn nhiều vì độ dày cục bộ ở rìa khối sau CSG
  không đoán trước được, trong khi đế phẳng luôn có độ dày đều/an toàn). UI vô hiệu hoá checkbox
  móc khoá khi đế phẳng tắt, kèm ghi chú ngắn giải thích.

### 4.5 Giới hạn
`MAX_NAME_LENGTH = 12` ký tự (CSG cho 1 chuỗi dài tốn CPU tương tự Dual Text — xem Phase 22 mục
4.4, lý do tương tự).

---

## 5. Risks & Mitigations

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| **Chữ rã mảnh khi tắt đế phẳng** (vd tên có nhiều chữ "I" hẹp giao với vùng mỏng của xe) | Trung bình, chấp nhận | Đế phẳng mặc định bật; nếu khách tắt, hiển thị cảnh báo rõ trên UI "có thể rã mảnh với 1 số tổ hợp". |
| **Silhouette xe tự vẽ không đẹp/không giống xe thật** | Thấp (thẩm mỹ) | v1 chỉ 1 mẫu đơn giản hoá, chấp nhận không photorealistic; có thể thay bằng silhouette vector chất lượng cao hơn (nguồn mở, có giấy phép rõ) ở phase sau nếu cần. |
| **CSG hiệu năng với tên dài** | Trung bình | `MAX_NAME_LENGTH=12`, tương tự Dual Text. |

---

## 6. Checklist

- [x] Khảo sát trực tiếp trang tham khảo bằng Playwright, bao gồm cả bước "Tạo" để xem preview
      thật (mục 1).
- [x] Claude self-review & hoàn thành implement v1 (`car-nameplate-engine.ts`, workbench, tests, analytics).
- [x] **Gemini Post-implementation Review (2026-09-05)**: Owner quyết định làm nhanh, chốt giữ nguyên v1:
      1. *Q1 (Silhouette)*: Giữ Sedan vẽ tay cho v1; ghi nhận việc chuyển sang SVG generic paths khi bổ sung thêm dòng xe (future backlog).
      2. *Q2 (Scaling)*: Giữ non-uniform stretch ở v1 để đảm bảo 100% diện bao phủ không cụt đầu/đuôi xe sau CSG.
      3. *Q3 (Keyring)*: Giữ nguyên ràng buộc móc khóa chỉ gắn trên đế phẳng nhằm đảm bảo cơ tính và chống gãy khi in FDM.
- [x] Implement: `src/lib/3d-tools/car-nameplate/{car-nameplate-constants,car-nameplate-engine}.ts`
      (silhouette "Sedan" tự vẽ, tái dùng `three-bvh-csg` từ Phase 22), workbench/canvas/page tại
      `src/app/[locale]/(tools)/tools/car-nameplate/`, GA4 (`trackCar*`).
- [x] Tests: `tests/car-nameplate-engine.test.ts` (5 test), `tests/car-nameplate-analytics.test.ts`,
      `e2e/car-nameplate.spec.ts` (Playwright).
- [x] `npm test` (202 passed), `npm run typecheck`, `npm run lint`, `npm run build` đều pass, không
      regression Phase 0-22.
- [x] Chưa verify trực quan/in thật hướng đọc mặt bên (giống Phase 22, known limitation) — Owner chấp
      nhận rủi ro, không chặn đóng phase.

