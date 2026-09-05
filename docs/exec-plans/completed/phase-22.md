# Phase 22 — Flex Dual Text: Chữ ảo ảnh 2 góc nhìn (CSG boolean)

> **Trạng thái**: PENDING / DEFERRED — Quyết định bởi Owner (không ưu tiên cho MVP launch; giữ code
> dạng experimental/internal).

> **Mục đích**: Tool #3 trong thứ tự ưu tiên đã chốt ở Phase 19 (`docs/exec-plans/completed/
> phase-19.md`, mục 3). Khách nhập 2 từ, hệ thống dựng 1 dải khối — mỗi khối là giao (intersection)
> của 2 chữ cái extrude theo 2 trục vuông góc — khi đứng ở góc 45° sẽ đọc được từ 1, đứng ở góc 45°
> đối diện đọc được từ 2. Đây là phase **đầu tiên** cần CSG boolean thật (không còn né được bằng
> `mergeGeometries`/2D-Path-Hole như Phase 17/20/21) — mở khoá năng lực mà Car (Phase 23) sẽ tái
> dùng ngay sau đó (theo đúng lý do xếp thứ tự ưu tiên của Phase 19 mục 3).

Owner đã yêu cầu làm nhanh toàn bộ roadmap còn lại, chấp nhận Claude tự review thay vì vòng Gemini
Challenge độc lập từng phase (khác quy trình Phase 17-21). Tài liệu này vẫn giữ đủ Goal/Non-goals/
Quyết định kỹ thuật để có thể tự phản biện trước khi code, chỉ bỏ bước gửi prompt ra ngoài.

---

## 1. Khảo sát trực tiếp trang tham khảo (2026-09-05)

`https://flex-dual-text.vunguyenhoanglong06031992.workers.dev/` (Playwright, SPA client-render,
không tải/dùng asset của trang):

- **Từ 1 / Từ 2**: 2 input text — số khối = `max(len(word1), len(word2))`, ký tự thiếu ở từ ngắn
  hơn coi như khoảng trắng (không extrude).
- **Phông chữ**: dropdown (`Anton · Latin`, `Be Vietnam Pro Bold · VI`, `Oswald Bold · Latin`).
- **Cỡ chữ**, **Khoảng cách khối**, **Lề đế**, **Cao đế**, **Bo góc đế (%)**: slider số.
- **Màu chữ / Màu đế**: 2 color picker.
- **Export**: `Tải STL` (đơn sắc) / `Tải 3MF (có màu)`.
- Ảnh chụp xác nhận đúng kỹ thuật "ambigram cube": mỗi khối là giao của 2 chữ (không phải 2 chữ
  đặt cạnh nhau) — đứng ở góc chéo giữa 2 mặt sẽ đọc được cả 2.

---

## 2. Rà soát hiện trạng có thể tái dùng

- **Font → path**: `opentype.js` + `THREE.Shape`/`ExtrudeGeometry` (Phase 17/21) — tái dùng cho
  cả 2 chữ cái của mỗi khối.
- **3MF/STL export**: `write3mf`/`exportBlocksStlZip`-style (Phase 21, `src/lib/3d-tools/common/`)
  — tổng quát hoá thành helper dùng chung, nhận `{geometry,colorHex,name}[]` bất kỽ nguồn tool nào.
- **Route group `(tools)`**: layout + quy ước file như Phase 20/21.
- **Quyết định roadmap đã chốt ở Phase 19 mục 4.2 (không mở lại)**: dùng `three-bvh-csg` (thuần
  JS/TS, tích hợp `BufferGeometry` trực tiếp, ~50KB, không cần WASM) cho CSG boolean của tool này
  và Car (Phase 23). Chưa cài — thêm dependency mới lần đầu ở phase này (đã duyệt trước, không
  phải quyết định mới).

**Chưa có, viết mới ở Phase 22**:
- Tích hợp `three-bvh-csg` (`Brush`, `Evaluator`, `INTERSECTION`) — chưa từng dùng CSG boolean thật
  trong repo.
- Kỹ thuật "ambigram cube": extrude chữ 1 dọc theo trục Z (nhìn thẳng mặt trước), extrude chữ 2
  dọc theo trục X (nhìn thẳng mặt bên, glyph xoay 90° quanh trục Y trước khi extrude) — bounding
  box của 2 khối extrude phải trùng nhau (cùng kích thước ô vuông) trước khi intersect.
- Đế dải với bo góc theo %, tương tự `buildCompactBaseMesh` (Phase 21) nhưng bo góc là tham số
  (không cố định).

---

## 3. Goal & Non-goals

### Goal
1. Khách nhập 2 từ (tiếng Việt có dấu), chọn font, cỡ chữ, khoảng cách khối, kích thước đế — xem
   preview 3D dải khối "ambigram" ngay trên trình duyệt, xoay được để thấy rõ cả 2 góc đọc.
2. Xuất STL (đơn sắc, 1 mesh gộp) hoặc 3MF (đa màu: chữ 1 màu, đế 1 màu khác — không cần đa màu
   theo từng khối như Phase 21, chỉ 2 màu tổng thể theo đúng UI tham khảo).
3. Ước tính giá qua `tool-price-estimate` (dùng lại nguyên).
4. Flow Custom Request + GA4 tracking (`tool_dual_text_preview`, `..._export_download`,
   `..._export_to_request`) — mirror Phase 17/20/21.

### Non-goals
- **Không hỗ trợ > 2 từ / > 2 góc nhìn** — v1 chỉ 2 từ, 2 góc 45° đối xứng, đúng phạm vi Phase 19.
- **Không hỗ trợ upload font tự do** — chỉ 3 font có sẵn (đủ Latin + 1 font tiếng Việt), lý do bảo
  mật giống Phase 21 mục 3.
- **Không tự động rút gọn/căn giữa khi 2 từ lệch độ dài nhiều** — khối thiếu ký tự chỉ là khối
  trống (không có chữ nổi ở mặt tương ứng), không cố "kéo dãn" chữ để lấp đầy — giữ đúng hành vi
  trang tham khảo, tránh phức tạp hoá bố cục.
- **Không làm Car (Phase 23) trong phase này** — dù dùng chung engine CSG, Car có input khác (chọn
  mẫu xe có sẵn) nên tách phase riêng theo đúng "small vertical slices".

---

## 4. Quyết định kỹ thuật

### 4.1 Thêm dependency `three-bvh-csg`
Đã duyệt ở cấp roadmap (Phase 19 mục 4.2) — thêm vào `package.json`, dùng `Brush` (bọc
`BufferGeometry` + material) và `Evaluator().evaluate(brushA, brushB, INTERSECTION)`.

### 4.2 Kiến trúc 1 khối = giao 2 chữ
```ts
export interface DualTextBlockConfig { char1: string; char2: string }
```
- Dựng `shapeToExtrudedBrush(char, font, size, axis: 'z'|'x')`: extrude glyph theo Z (mặt trước,
  đọc `char1`) hoặc theo X (mặt bên, đọc `char2`, glyph xoay 90° quanh Y trước khi extrude).
  Cả 2 brush phải có cùng bounding box vuông (kích thước = `fontSize + padding`) để phép giao ra
  hình đọc được từ cả 2 mặt, không bị cắt cụt.
- `evaluator.evaluate(brushFront, brushSide, INTERSECTION)` → 1 mesh/khối. Khối trống (ký tự thiếu
  ở 1 trong 2 từ) thì bỏ qua bước extrude/giao cho mặt đó, chỉ giữ nguyên khối kia (không giao)
  — tránh giao với hình rỗng gây lỗi CSG.
- Xử lý lỗi CSG (mesh non-manifold hiếm gặp với 1 số font/ký tự đặc biệt): bọc `try/catch` quanh
  từng khối, nếu 1 khối lỗi thì báo lỗi rõ ràng kèm số thứ tự khối, không crash toàn bộ preview.

### 4.3 Đế dải với bo góc %
`buildDualTextBaseMesh(blockCount, blockSize, gap, margin, height, cornerRadiusPercent)` — hình
chữ nhật bo góc (`THREE.Shape` với `quadraticCurveTo` ở 4 góc, bán kính = `cornerRadiusPercent% *
min(width,height)/2`), extrude theo `height`. Epsilon-overlap 0.2mm khi merge với các khối (kỹ
thuật đã dùng ở Phase 20/21) để đảm bảo watertight.

### 4.4 Giới hạn
`MAX_DUAL_TEXT_BLOCKS = 12` (2 từ dài tối đa 12 ký tự) — CSG boolean tốn CPU hơn hẳn `mergeGeometries`,
giới hạn thấp hơn Phase 21's `MAX_BLOCKS=16` để tránh đơ trình duyệt khi tính nhiều phép giao liên
tiếp trên main thread (chưa cần Web Worker ở quy mô này — khác Jigsaw, xem Phase 19 mục 4.2).

### 4.5 Xuất file
Tái dùng `write3mf`/`exportBlocksStlZip` (Phase 21, đã tổng quát hoá theo `{geometry,colorHex,name}[]`)
— không viết writer mới. STL: gộp toàn bộ (đế + tất cả khối) thành 1 mesh qua `mergeGeometries`
(không cần index riêng theo khối như Phase 21, vì tool này chỉ 2 màu tổng thể).

---

## 5. Risks & Mitigations

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| **CSG boolean lỗi/non-manifold với vài font+ký tự** | Trung bình | Try/catch từng khối, báo lỗi rõ theo số thứ tự; giới hạn 3 font đã kiểm tra trước (mục 4.1 kế thừa Phase 17/21 fonts nếu phù hợp, bổ sung `Anton`/`Oswald` nếu cần kiểm tra glyph riêng). |
| **Hiệu năng CSG trên máy yếu** | Trung bình | `MAX_DUAL_TEXT_BLOCKS=12`; tính CSG trong `useMemo`, debounce input. |
| **Bo góc đế % tính sai khi width≠height** | Thấp | Dùng `min(width,height)` làm cơ sở bán kính, test biên 0%/100%. |
| **Hướng đọc chữ 2 (mặt bên) có thể bị ngược (mirror)** | Trung bình, **chưa verify** | Suy luận toán học (rotateY 90°) chứ chưa render/in thật để xác nhận trực quan — môi trường triển khai không chụp được màn hình (không có quyền Screen Recording). Đã tách thành 1 hằng số `SIDE_GLYPH_MIRRORED` (mặc định `false`) — nếu Owner thấy từ 2 đọc ngược khi xem preview/in thử, chỉ cần đổi hằng số này thành `true`, không cần sửa logic. Known limitation, không chặn merge. |

---

## 6. Checklist

- [x] Khảo sát trực tiếp trang tham khảo bằng Playwright (mục 1).
- [x] Claude self-review (không có vòng Gemini Challenge riêng theo yêu cầu Owner — làm nhanh cả
      roadmap).
- [x] Implement: `src/lib/3d-tools/dual-text/{dual-text-constants,dual-text-engine}.ts` (CSG qua
      `three-bvh-csg`, thêm dependency mới), `src/app/[locale]/(tools)/tools/dual-text/{page,
      dual-text-workbench,dual-text-canvas}.tsx`, GA4 (`trackDualText*` trong `analytics.ts`), 3
      font mới (`Anton`, `Oswald`, `BeVietnamPro-Bold`, cả 3 đã verify phủ đủ glyph tiếng Việt —
      tốt hơn nhãn "Latin-only" của trang tham khảo).
- [x] Tests: `tests/dual-text-engine.test.ts` (6 test: glyph tiếng Việt, khối mặt trống = mặt kia
      giữ nguyên, giao 2 mặt hợp lệ, dựng scene 1 và MAX khối, từ chối input sai), 
      `tests/dual-text-analytics.test.ts`, `e2e/dual-text.spec.ts` (Playwright, pass 12.2s).
- [x] `npm test` (196 passed), `npm run typecheck`, `npm run lint`, `npm run build` đều pass, không
      regression Phase 0-21.
- [x] **Chưa verify trực quan/in thật hướng đọc mặt bên** (xem Risks) — không còn theo dõi tiếp:
      Owner đã chuyển toàn bộ phase sang PENDING/DEFERRED (xem nhãn trạng thái đầu tài liệu), không
      còn ưu tiên cho MVP launch nên không cần verify in vật lý hay Web Worker follow-up nữa.
