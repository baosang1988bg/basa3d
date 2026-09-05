# Phase 21 — Flex Keychain (Block-style): Móc khoá dạng khối chữ rời, đa màu

> **Mục đích**: Tool #2 trong thứ tự ưu tiên đã chốt ở Phase 19 (`docs/exec-plans/completed/
> phase-19.md`, mục 3). Khác với Phase 17 (chữ nổi trên 1 tấm đế liền khối, xuất STL đơn sắc), Flex
> Keychain là **mỗi ký tự một khối riêng** (keycap block-style), mỗi khối tự chọn màu nền và màu chữ/icon,
> ghép lại thành 1 dải liền khối (`Compact`) có tai móc khoá — giá trị thương mại: thiết kế khối nổi
> cao cấp, tận dụng tối đa máy in AMS/multi-color phổ biến, và tái dùng engine dựng chữ (`opentype.js`)
> từ Phase 17. Đây là phase **đầu tiên** xuất file 3MF đa màu thực sự cho máy in multi-color.

Tài liệu này đã hoàn thành vòng phản biện **Gemini Challenge** (2026-09-05) và đã chốt toàn bộ các
quyết định kiến trúc cốt lõi, sẵn sàng để Claude review và bàn giao cho Codex thực hiện.

---

## 1. Khảo sát trực tiếp trang tham khảo (2026-09-05)

Trang gốc là SPA client-render (`react`/`vite`), khảo sát trực tiếp tại
`https://flex-keychain.vunguyenhoanglong06031992.workers.dev/` bằng Playwright (không tải/dùng bất kỳ
asset hay mã nguồn nào của trang):

- **NAME**: 1 input text, tự uppercase, tự update nhãn phụ theo số khối (`"4-slot base"` → `"10-slot base"`).
- **BASE TYPE**: 2 nút `Compact` / `Modular` (kèm 2 biến thể `Bubbly` / `Bubbly V2`). `Compact` = các khối
  gắn liền trên 1 đế chung có tai móc khoá. `Modular` = từng khối tách rời hoàn toàn.
- **TYPEFACE**: Dropdown font + nút `Upload font…`.
- **SWITCH**: 2 nút `Physical` (hốc cắm vừa chân switch bàn phím cơ thật) / `3D-printed` (đế tự đứng).
- **BASE COLOR**: 1 color picker áp cho toàn bộ khối nền.
- **SLOTS**: Cấu hình từng ký tự: nội dung (ký tự `A-Z`, `0-9`, dấu Latin mở rộng, hoặc ~20 icon glyph có sẵn),
  màu khối, màu chữ/icon nổi.
- **Export**: 2 nút — `Export Bambu 3MF (colors)` (xuất 3MF đa màu cho Bambu Lab AMS) và `Export STL zip`
  (mỗi khối 1 file STL riêng, nén zip).

Landing page (`https://landing.vunguyenhoanglong06031992.workers.dev/#tools`) xác nhận tool đã **Live**,
xếp vị trí ưu tiên #2 trong roadmap của BaSa3D.

---

## 2. Rà soát hiện trạng có thể tái dùng từ Phase 17 / 19 / 20

- **Font → path**: `opentype.js` (Phase 17) dựng glyph → `THREE.Shape` → `ExtrudeGeometry` — tái dùng
  nguyên vẹn cho từng khối chữ.
- **Lỗ móc khoá**: Kỹ thuật 2D Path Hole (`THREE.Shape.holes.push(new THREE.Path().absarc(...))`) từ
  `keychain-engine.ts` (Phase 17 mục 3.3) — tái dùng 100%, không cần CSG boolean.
- **Gộp mesh đế & khối**: `mergeGeometries` (`three/addons/utils/BufferGeometryUtils.js`) + kỹ thuật
  Epsilon-Overlap (Phase 20) giúp ghép các khối với đế thành 1 mesh manifold vững chắc.
- **Ước tính khối lượng & giá**: `estimateMeshWeightGrams`, `estimatePrintMinutes`
  (`src/lib/pricing/mesh-estimator.ts`) + API route `POST /api/public/tool-price-estimate` (Phase 20)
  — tái dùng trực tiếp, cộng dồn thể tích toàn bộ các khối.
- **Flow Custom Request & Tải file**: Upload qua `POST /api/public/custom-requests/attachments`, prefill
  vào `custom-request-form.tsx` (Phase 17/20).
- **Route group `(tools)`**: Layout `src/app/[locale]/(tools)/layout.tsx` (Phase 20), cấu trúc chuẩn:
  - Route & UI: `src/app/[locale]/(tools)/tools/keychain-blocks/page.tsx` và `keychain-blocks-workbench.tsx`.
  - Core 3D Engine: `src/lib/3d-tools/keychain-blocks/keychain-blocks-engine.ts`.
  - Constants & Types: `src/lib/3d-tools/keychain-blocks/keychain-blocks-constants.ts`.
- **Nền tảng Roadmap đã chốt ở Phase 19**:
  - Không dùng CSG boolean cho tool này.
  - Tự viết `3mf-writer.ts` nén bằng `fflate` (nhẹ ~8KB, không cài thư viện 3MF cồng kềnh).

---

## 3. Goal & Non-goals

### Goal
1. Khách nhập tên (hỗ trợ tiếng Việt có dấu), xem preview 3D dải móc khoá dạng khối keycap liền đế
   (`Compact` mode) kèm tai móc khoá trực quan trên trình duyệt.
2. Tuỳ biến chi tiết từng khối: đổi ký tự/icon, đổi màu khối (`blockColor`), đổi màu chữ/icon (`glyphColor`).
3. Chọn font chữ trong bộ font chuẩn hỗ trợ tiếng Việt hoặc chọn icon từ bộ 12–15 icon Lucide (MIT) có sẵn.
4. Xuất 2 định dạng file:
   - `Export STL zip`: Nén từng khối STL riêng lẻ thành 1 file `.zip` bằng `fflate`.
   - `Export Bambu 3MF (colors)`: Xuất 1 file 3MF chứa dữ liệu đa màu theo spec Material Color Group, mở
     trực tiếp và nhận diện đúng các cuộn màu trên Bambu Studio / OrcaSlicer.
5. Ước tính khoảng giá tham khảo qua `POST /api/public/tool-price-estimate` (tính server-side, không lộ
   pricing config).
6. Tích hợp nút "Tải file về máy" và "Gửi yêu cầu báo giá" (prefill form custom-request).
7. GA4 tracking đầy đủ: `tool_keychain_blocks_preview`, `tool_keychain_blocks_export_download`,
   `tool_keychain_blocks_export_to_request`.

### Non-goals
- **Bỏ hoàn toàn chế độ `Physical` switch socket ở v1**: Dung sai cơ học chân switch phím cơ MX
  (±0.1mm) không thể đảm bảo an toàn qua các dòng máy in FDM khác nhau của khách hàng; chỉ
  hỗ trợ chế độ `3D-printed` (đế tự đứng liền khối an toàn).
- **Bỏ chế độ `Modular` (Bubbly/Bubbly V2) ở v1**: Tập trung làm trọn vẹn và hoàn hảo chế độ `Compact`
  (đế liền + tai móc khoá chuẩn). `Modular` (khối rời) đưa vào Non-goal vì không có cơ chế khoen móc
  chuẩn mực mà không cần thêm phụ kiện cơ khí.
- **Không hỗ trợ upload font tự do ở v1**: Tránh rủi ro bảo mật từ việc parse file font binary tuỳ ý
  từ client ẩn danh; chỉ dùng bộ font OFL chuẩn đã được kiểm chứng tiếng Việt.
- **Không hỗ trợ upload icon/ảnh riêng**: Chỉ sử dụng bộ icon vector tích hợp sẵn.
- **Không làm 6 tool còn lại trong roadmap** (Dual Text, Car, Lamp, Hinge Box, Jigsaw, Sculpt).

---

## 4. Quyết định kỹ thuật đã chốt (Hậu Gemini Challenge)

### 4.1 Kiến trúc dữ liệu: 1 Thiết kế = Dải N Khối (`KeychainBlock[]`)
Mỗi khối là một data object thuần túy:
```ts
export interface KeychainBlockConfig {
  id: string;
  char: string;          // Ký tự chữ, số hoặc mã định danh icon (vd: "icon:heart")
  blockColor: string;    // Mã màu hex của khối keycap
  glyphColor: string;    // Mã màu hex của chữ/icon nổi
}
```
Module `keychain-blocks-engine.ts` thiết kế dạng pure function:
- `buildSingleBlockGeometry(...)`: Dựng 1 khối keycap (vát mép + bo góc trên đỉnh) kèm chữ/icon nổi trên mặt.
- `buildCompactBaseGeometry(...)`: Dựng dải đế nền liền mạch liên kết các chân khối và tạo tai móc khoá bên trái (2D Path Hole).
- `generateKeychainBlocksScene(...)`: Kết hợp các khối và đế thành Three.js Group phục vụ preview và export.

### 4.2 Kiểu đế: Chốt `Compact`-only cho v1
- Toàn bộ dải móc khoá gắn liền trên một đế mỏng (~2–3mm), phía cực trái mở rộng một tai tròn bán kính R = 4.5mm với lỗ xỏ khoen đường kính d = 4.0mm cắt bằng kỹ thuật `THREE.Shape.holes`.
- Khoảng cách giữa các khối: 0.8mm để tạo rãnh tách biệt thị giác rõ ràng kiểu bàn phím cơ nhưng vẫn liền khối cơ học vững chắc.

### 4.3 Loại bỏ chế độ `Physical` — Chỉ hỗ trợ `3D-printed` Base
- Đơn giản hoá hình học đáy khối: Đáy phẳng, tiếp xúc hoàn toàn với đế `Compact`, đảm bảo bám dính bàn in (bed adhesion) tốt nhất khi in FDM.

### 4.4 Xuất 3MF Đa Màu & STL Zip — Quy trình Nghiệm thu Kép
1. **Module `3mf-writer.ts`**:
   - Tự viết module độc lập sử dụng `fflate` nén XML theo cấu trúc Open Packaging Conventions: `[Content_Types].xml`, `_rels/.rels`, và `3D/3dmodel.model`.
   - Sử dụng namespace 3MF Material: `xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"`. Định nghĩa bảng màu `<m:colorgroup id="1">` chứa danh sách `<m:color color="#RRGGBB" />`.
   - Mỗi khối keycap là 1 `<object>` riêng biệt (không gộp mesh các khối làm một trước khi export
     3MF, khác với STL). Gán màu ở cấp **object** (`pid="1" pindex="{colorIndex}"` trên thẻ
     `<object>`/`<component>`), **không** gán per-triangle — mỗi khối vốn chỉ có 1 màu đồng nhất
     nên không cần độ chi tiết per-triangle, và gán ở cấp object giảm hẳn bề mặt lỗi khi tự viết
     writer lần đầu (đúng rủi ro Gemini Challenge Q3 đã cảnh báo).
2. **Kế hoạch Dự phòng & Thứ tự nghiệm thu (Definition of Done)**:
   - *Slice xuất file*: Hoàn thành `Export STL zip` trước làm chốt chặn an toàn (fallback).
   - *Automated test*: Vitest giải nén file 3MF xuất ra từ dữ liệu giả lập, parse XML và kiểm tra tính hợp lệ của schema/thẻ màu.
   - *Manual slicer test (Bắt buộc)*: Xuất file thực tế (từ test "BASA" 4 chữ 4 màu), mở trực tiếp trong **Bambu Studio (v1.9+)** hoặc **OrcaSlicer (v2.0+)**, xác nhận 4 khối nhận diện đúng 4 filament slot màu riêng biệt trên đĩa in.

### 4.5 Danh mục Font & Icon Glyph Hợp pháp
- **Font chữ (2 font SIL Open Font License, 100% tiếng Việt)**:
  1. `Be Vietnam Pro` (Default — Sans-serif hiện đại, rõ nét).
  2. `Comfortaa` (Chốt — bo tròn, phong cách keycap dễ thương, có SIL OFL, kiểm tra tập glyph tiếng
     Việt trước khi thêm; nếu thiếu dấu tiếng Việt thì đổi sang font OFL bo tròn khác có glyph đầy
     đủ, không dùng `Plus Jakarta Sans` vì chưa kiểm tra glyph tiếng Việt).
  - File `.ttf` đặt tại `public/fonts/`.
- **Icon Glyph (12–15 icon chuẩn từ Lucide Icons — ISC License, kế thừa 1 phần MIT từ Feather
  Icons gốc; cả 2 đều permissive, cần giữ nguyên văn bản giấy phép khi vendor SVG path vào repo)**:
  - Danh mục: `heart`, `star`, `paw-print`, `music`, `cloud`, `flame`, `smile`, `coffee`, `car`, `plane`, `apple`, `zap`.
  - SVG path data được trích xuất sẵn thành tập toạ độ 2D vector trong `keychain-blocks-constants.ts`, chuyển thành `THREE.Shape` và đùn khối `ExtrudeGeometry` tương tự ký tự chữ.

### 4.6 Hằng số Giới hạn & Kích thước Hình học
- `MAX_BLOCKS = 16`: Giới hạn tối đa 16 ký tự (chiều dài dải ~200mm, đảm bảo in vừa hầu hết khổ giường in FDM 220x220mm và 256x256mm).
- `BLOCK_WIDTH = 12.0mm`, `BLOCK_DEPTH = 12.0mm`, `BLOCK_HEIGHT = 8.0mm`.
- `BASE_THICKNESS = 2.0mm`.
- `GLYPH_EMBOSS_HEIGHT = 1.2mm`.

---

## 5. Risks & Mitigations

| Rủi ro | Mức độ | Biện pháp giảm thiểu |
|---|---|---|
| **3MF không nhận diện màu trên Bambu Studio/OrcaSlicer** | Đã xác nhận an toàn (2026-09-05) | Tuân thủ đúng spec Material Color Group XML; nghiệm thu bằng Bambu Studio thật — Owner xác nhận 4 khối/4 màu, giữ đúng vị trí lắp ráp (xem `phase-21-verification.md`). `Export STL zip` fallback không cần dùng đến. |
| **Bản quyền Font & Icon** | Thấp | 100% tài nguyên dùng giấy phép mở chuẩn: SIL OFL cho Font, MIT cho Lucide Icons. Không sao chép asset từ web tham khảo. |
| **Lỗi dấu tiếng Việt vỡ hình học** | Trung bình | Dùng font `Be Vietnam Pro` đã verify tập glyph tiếng Việt đầy đủ từ Phase 17; dùng Earcut triangulation chuẩn của Three.js. |
| **Mesh quá nặng khi tên dài** | Thấp | Khoá cứng `MAX_BLOCKS = 16`; mesh của từng ký tự được tối ưu số segment bo góc (curveSegments = 3–4). |

---

## 6. Kế hoạch Triển khai theo Slices

### Slice 1: Constants, Lucide SVG Paths & Core 3D Geometry Engine (Pure TS + Tests)
- [x] Định nghĩa `keychain-blocks-constants.ts` (kích thước khối, danh mục 12–15 icon Lucide SVG paths, bảng màu mặc định, `MAX_BLOCKS = 16`).
- [x] Bổ sung file font `Comfortaa.ttf` vào `public/fonts/` (bên cạnh `BeVietnamPro-Regular.ttf` đã có), kèm verify tập glyph tiếng Việt đầy đủ (giống bước thủ công Phase 17 mục 2).
- [x] Viết `src/lib/3d-tools/keychain-blocks/keychain-blocks-engine.ts`:
  - `buildKeycapBaseShape()`: Tạo shape 2D khối keycap vát cạnh.
  - `buildGlyphShape()`: Chuyển text (qua `opentype.js`) hoặc Lucide icon ID thành `THREE.Shape`.
  - `buildSingleBlockMesh()`: Tạo mesh khối chữ/icon.
  - `buildCompactBaseMesh()`: Tạo dải đế liền kèm tai móc khoá 2D path hole.
- [x] Unit tests cho Engine (kiểm tra tính hợp lệ của geometry sinh ra, bounding box, thể tích mesh).

### Slice 2: 3MF Multi-Color Writer & STL Zip Exporter (Pure TS + Tests)
- [x] Viết `src/lib/3d-tools/common/3mf-writer.ts`:
  - Xây dựng module xuất 3MF đa màu chuẩn XML + nén `fflate`.
  - Nhận input `{ geometry: THREE.BufferGeometry, colorHex: string, name: string }[]` -> sinh ra `Uint8Array` / `Blob`.
- [x] Viết hàm `exportBlocksStlZip(...)`: Xuất từng block thành STL riêng và nén thành 1 file zip qua `fflate`.
- [x] Unit tests cho `3mf-writer.ts` (test giải nén zip, parse XML kiểm tra cấu trúc thẻ màu).
- [x] **Nghiệm thu thực tế**: Xuất file mẫu và mở thành công trên Bambu Studio / OrcaSlicer.

### Slice 3: 3D Workbench UI, Preview Canvas & Custom Request Integration
- [x] Tạo route `src/app/[locale]/(tools)/tools/keychain-blocks/page.tsx` và `keychain-blocks-workbench.tsx`.
- [x] UI điều khiển:
  - Input tên (tự động chia slot ký tự, giới hạn `MAX_BLOCKS = 16`).
  - Font picker (`Be Vietnam Pro`, `Comfortaa`).
  - Global base color picker & Slot list từng khối (đổi ký tự/icon, đổi màu khối, đổi màu chữ).
  - WebGL Canvas xoay/zoom 3D preview mượt mà.
- [x] Tích hợp `POST /api/public/tool-price-estimate` hiển thị khoảng giá ước tính realtime.
- [x] Nút Export: `Tải STL Zip`, `Tải Bambu 3MF (Màu)`, và `Gửi yêu cầu báo giá` (prefill `custom-request-form.tsx`).
- [x] Bắn GA4 tracking: `tool_keychain_blocks_preview`, `tool_keychain_blocks_export_download`, `tool_keychain_blocks_export_to_request`.

### Slice 4: Verification
- [x] Playwright E2E (theo `.agents/skills/e2e-testing/SKILL.md`, mirror flow Phase 17/20): nhập
      tên + tuỳ biến khối → preview render → gửi yêu cầu báo giá → request xuất hiện trong Admin.
- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%, không regression
      Phase 0-20.

---

## 7. Checklist

### Chuẩn bị & Phê duyệt
- [x] Khảo sát trực tiếp trang tham khảo bằng Playwright (mục 1).
- [x] Gemini challenge hoàn tất và chốt 4 câu hỏi kiến trúc cốt lõi (mục 4).
- [x] Claude review kế hoạch lần cuối (2026-09-05): phát hiện & sửa 6 điểm (font `Comfortaa` chưa
      chốt dứt khoát, lệnh `pnpm` sai package manager thực tế của repo, tên file font sai
      `BeVietnamPro-Bold` → `-Regular`, cách gán màu 3MF per-triangle nên đổi sang per-object cho
      đơn giản/an toàn hơn, nhãn giấy phép Lucide sửa MIT → ISC, và bổ sung Slice 4 Playwright E2E
      còn thiếu so với chuẩn Phase 17/20). Owner đã xác nhận tiếp tục giao Codex.
- [x] Soạn `docs/exec-plans/active/phase-21-codex-handoff-prompt.md`.

### Tiêu chí Hoàn thành (Definition of Done)
- [x] Toàn bộ unit test cho Engine và 3MF Writer chạy pass (`npm test`).
- [x] File 3MF xuất ra mở hiển thị đúng màu trên Bambu Studio / OrcaSlicer (nghiệm thu thủ công).
- [x] Flow Custom Request đính kèm file 3MF/STL hoạt động trơn tru, có Playwright E2E xác nhận
      (Slice 4).
- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
