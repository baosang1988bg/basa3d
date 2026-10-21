# Phase 45 — Organizer parity: nâng `/tools/organizer` lên ngang bản gốc Flex Organizer

> Yêu cầu OWNER (2026-10-21): tham khảo **giống 100%** tool gốc
> `https://flex-organizer.vunguyenhoanglong06031992.workers.dev/` (title "Trình tạo khay & hộp chia" /
> "Bin & Sorting Tray Generator"). OWNER xác nhận bên gốc dùng mã nguồn mở và **chấp nhận phần bản quyền
> khi sao chép**. Đây là bước 1 trong lộ trình "bắt kịp bản gốc" (Organizer → Hinge Box → Car → Lamp).
> Người viết plan: Claude. ADR dự kiến: ADR-0047.

## 0. Nguồn & giấy phép (ghi lại để truy vết)

- Khảo sát trực tiếp trang gốc ngày 2026-10-21: UI, i18n VI/EN, preset, dải slider, và **toàn bộ mã dựng
  hình** (chạy trong Web Worker `assets/bin.worker-*.js`, bundle không minify phần app).
- Thư viện bên gốc dùng: **`manifold-3d`** (Apache-2.0, boolean CSG + `CrossSection` 2D, chạy WASM),
  `opentype.js` (MIT), `three` (MIT), font nhãn **Inter** (OFL), IndexedDB để nhớ font tự tải lên.
- Trang hub `landing.…workers.dev` nay đã chuyển thành app desktop thương mại "Flex Hub" (Pro 250.000đ/tháng).
  Bản web của Organizer vẫn đang chạy. OWNER đã nhận trách nhiệm về giấy phép. Khi triển khai, giữ các file
  license của thư viện/font (`public/fonts/OFL-Inter.txt`, notice Apache-2.0 của manifold) theo đúng
  quy ước hiện có trong `public/fonts/`.

## 1. Đặc tả bản gốc (nguồn chân lý cho parity)

### 1.1 Tham số, mặc định, dải

| Khoá | Nhãn VI | Mặc định | Min–Max (step) |
|---|---|---|---|
| `width` | Rộng | 120 | 20–300 (1) mm |
| `depth` | Sâu | 80 | 20–300 (1) mm |
| `height` | Cao | 40 | 5–150 (1) mm |
| `cols` / `rows` | Cột / Hàng | 3 / 2 | 1–12 (1) |
| `wall` | Độ dày thành | 2 | 0.4–6 (0.1) mm |
| `floor` | Độ dày đáy | 2 | 0.4–8 (0.1) mm |
| `divider` | Độ dày vách | 1.6 | 0.4–6 (0.1) mm |
| `radius` | Bo góc | 3 | 0–15 (0.5) mm |
| `wallTexture` | Vân tường | `none` | none / fluted (Rãnh lõm) / reeded (Gân lồi) / ribbed (Sọc vuông) / wavy (Lượn sóng) / faceted (Cạnh chéo) |
| `textureDepth` | Độ sâu vân | 1 | 0.2–3 (0.1) mm |
| `textureCount` | Mật độ vân | 40 | 4–120 (1) |
| `color` | Màu | `#3b82f6` | color picker |
| `stackingLip` / `labelTab` / `fingerScoops` / `floorHoles` | Vành xếp chồng / Nhãn dán / Rãnh lấy đồ / Lỗ thoát đáy | false | toggle |

Nhãn gắn (snap-on label), tắt mặc định: `text` "LABEL" (≤ 24 ký tự), `fontSize` 8 (3–40),
`embossDepth` 0.6 (0.2–3), `plateHeight` 14 (6–40), `plateColor` `#e2b23a`, `textColor` `#5c3a10`,
font mặc định Inter + upload `.ttf/.otf` (lưu IndexedDB, nút "Dùng mặc định").

### 1.2 Preset ("Mẫu nhanh") — các khoá không nêu lấy theo mặc định

| Preset | W×D×H | Cột×Hàng | wall / floor / divider / radius |
|---|---|---|---|
| Khay nhỏ | 90×60×25 | 2×1 | 1.6 / 1.6 / 1.2 / 2 |
| Kệ để bàn | 180×100×60 | 4×2 | 2 / 2 / 1.6 / 4 |
| Hộp linh kiện | 120×80×50 | 3×3 | 2 / 2 / 1.6 / 3 |
| Ngăn kéo | 220×160×40 | 5×4 | 1.6 / 1.6 / 1.2 / 2 |
| Giá đựng dụng cụ | 150×60×80 | 6×1 | 2.4 / 3 / 2 / 3 |
| Phân loại ốc vít | 100×100×30 | 4×4 | 1.2 / 1.2 / 1 / 2 |

Máy in (kiểm tra vừa bàn in, mặc định `bambu256`): A1 mini 180×180; A1/P1/X1 256×256; Prusa MK4/MK3 250×210;
Ender 3 220×220; Large 300×300. Điều kiện vừa: `width + g ≤ bed[0]` và `depth + g ≤ bed[1]`, trong đó
`g = 2·textureDepth` nếu vân "mọc ra ngoài" (reeded/ribbed/wavy/faceted), ngược lại 0. Không xoay 90°.

### 1.3 Chuẩn hoá tham số + cảnh báo (chạy trước khi dựng, trả `warnings[]`)

- `wall, floor, divider ≥ 0.4`; `width, depth, height ≥ 1`.
- `height ≤ floor + 1` → `height = floor + 1` (`warn.heightRaised`).
- `cols, rows` làm tròn, ≥ 1, > 12 → 12 (`warn.colsReduced` / `warn.rowsReduced`).
- Số cột tối đa vừa: `floor((width − 2·wall + divider) / (1 + divider))` (ngăn tối thiểu 1 mm). Nếu < 1 →
  `width = 2·wall + 1`, `cols = 1` (`warn.widthRaised`); nếu `cols` vượt → giảm. Tương tự cho `depth/rows`.
- `radius` kẹp vào `[0, min(width, depth)/2 − wall]` (`warn.radiusClamped`).
- `stackingLip` bật mà `min(1.2, wall − 0.6) < 0.4` → `warn.lipWallThin` (vành bị bỏ qua).
- Vân lõm (`fluted`, `wavy`, `faceted` — `reachesInward`): `textureDepth ≤ wall − 0.4`, thêm `≤ 0.8·radius`
  nếu `radius > 0.5`. Vân chỉ lồi: `textureDepth ≤ 3`. `textureCount ≤ min(150, floor(chuVi / (2·max(depth, 0.2))))`.
  Mọi lần kẹp vân → `warn.textureClamped`.
- Nhãn snap: tường không đủ dày cho rãnh → `warn.labelWallThin` (vẫn in được, chỉ không khoá).

### 1.4 Thuật toán dựng hình (manifold-3d, trục Z hướng lên, gốc toạ độ ở tâm đáy)

1. **Vỏ ngoài**: `CrossSection` hình chữ nhật bo góc `square([w−2r, d−2r]).offset(r, Round, 64 đoạn)`,
   hoặc biên dạng có vân (mục 6) → `extrude(height)`.
2. **Lòng ngăn**: `cellW = (w − 2·wall − (cols−1)·divider) / cols` (tương tự `cellD`), `cavH = height − floor`,
   bo trong `innerR = min(radius, cellW/2 − 0.01, cellD/2 − 0.01, 2)`. Mỗi ngăn = rect bo `innerR` extrude
   `cavH`, đặt ở `z = floor`. Trừ hợp (union) tất cả lòng ngăn khỏi vỏ.
3. **Lỗ thoát đáy**: mỗi ngăn 1 trụ bán kính `0.22·min(cellW, cellD)`, cao `floor + 2`, 48 cạnh, ở tâm ngăn.
4. **Rãnh lấy đồ (finger scoop)**: `v = 0.45·min(cellD, cavH)`; khối `cellW×v×v` ở góc đáy phía −Y của
   ngăn, trừ đi trụ ngang bán kính `v` → miếng lượn lõm; union các miếng này **vào** vỏ sau khi khoét.
5. **Vành xếp chồng**: `h = min(1.2, wall − 0.6)`, bỏ qua nếu `h < 0.4`. `lipH = min(4, max(1, height − 1))`.
   Thêm vành `offset(−0.25) − offset(−0.25 − h)` cao `lipH` trên đỉnh (`z = height`); khoét đáy
   `outline − offset(−h − 0.5)` cao `lipH` (khe 0.25 mm mỗi bên để hộp trên lồng vào hộp dưới).
6. **Vân tường**: lấy mẫu chu vi rect bo góc thành `N = clamp(textureCount·ppg, 120, 2400)` điểm (ppg: fluted/
   reeded/wavy 14, ribbed 12, faceted 10), dời mỗi điểm theo pháp tuyến một đoạn `offset(u, depth)` với
   `u = (textureCount·s/P) mod 1`:
   fluted `−depth·(0.5 − 0.5cos2πu)`; reeded `+depth·(0.5 − 0.5cos2πu)`; ribbed `+depth·rd(u)` (sóng vuông
   bo cạnh, nửa chu kỳ, ramp 0.12); wavy `depth·sin2πu`; faceted `depth·tri(u)` (sóng tam giác).
7. **Label tab (nhãn dán nghiêng)**: profile 2D `[(−max(2, 12−8), 0), (0,0), (8,12), (8−1.6, 12)]`, bo
   `offset(+0.4).offset(−0.4)`, extrude theo bề rộng `max(4, w − 2·max(r, 2))`, xoay `[0,−90,0]`, đặt ở
   mép −Y trên đỉnh hộp (`z = height`).
8. **Nhãn snap-on** (khi bật): trên mặt −Y của hộp thêm *boss* `Wf × 3 × Hf` và khoét *pocket*
   (`pocketD 2.2`, gờ khoá `lipLayer 0.5`, `lipOver 0.7`); tấm nhãn rời `(Wp − 0.5) × (2.2 − 0.5 − 0.1) ×
   (Hp − 0.5)` (khe `clr 0.25`, `plateGap 0.1`) + chữ nổi `embossDepth` (opentype → polygon, Bézier 8 đoạn,
   fill `EvenOdd`, tự co chữ cho vừa với lề 2.5 mm, viền 2.5 mm). Chiều cao tấm `≤ height − 4 − 5`.
9. Thông tin mô hình: bbox, số ngăn, kích thước ngăn, thể tích `volume/1000` cm³, khối lượng PLA `×1.24`,
   số tam giác. **Giá trị vàng mặc định** (dùng cho test parity): 120×80×40 mm, 6 ngăn, 37.6×37.2 mm,
   **65.6 cm³, 81.3 g, 1.900 tam giác**.

### 1.5 UI & hành vi

- Panel phải gồm các mục thu gọn được: Mẫu nhanh · Kích thước (mm) + Máy in · Lưới ngăn · Thành & đáy ·
  Kiểu dáng (bo góc, vân + độ sâu/mật độ, màu, 4 toggle) · Nhãn gắn (snap) · Thông tin mô hình · nút tải.
- Mỗi tham số có **slider + ô số** đồng bộ. Đổi tham số → dựng lại trong worker, debounce **150 ms**,
  request cũ bị bỏ qua theo `id`.
- Danh sách cảnh báo (mục 1.3) hiện ngay dưới panel. Chỉ báo "Vừa bàn in" / "Vượt bàn in".
- Tải: `bin_<W>x<D>x<H>.stl` (đã chuẩn hoá); nhãn: `label_<text>_2color.3mf` (2 màu: tấm + chữ).
- **Chia sẻ qua URL**: query `w,d,h,co,ro,wa,fl,dv,rd,td,tc` (số), `lip,tab,sco,hol` (`1/0`), `wt`, `col`
  (hex không `#`). Mở trang có query → nạp đúng cấu hình.
- Song ngữ VI/EN.

## 2. Khoảng cách so với bản BaSa3D hiện tại (Phase 20)

| Hạng mục | Hiện tại | Cần làm |
|---|---|---|
| Engine | `BoxGeometry` + `mergeGeometries`, vách giao nhau, không boolean (mesh **không manifold**) | Boolean thật bằng manifold-3d trong worker → STL kín nước |
| Bo góc, vân tường, vành xếp chồng, label tab, rãnh lấy đồ, lỗ đáy | Không có | Có đủ (mục 1.4) |
| Độ dày thành ≠ độ dày vách | Dùng chung 1 giá trị | Tách `wall` và `divider` |
| Preset, máy in, thông tin mô hình, cảnh báo, chia sẻ URL, màu | Không có | Có đủ |
| Nhãn snap 2 màu (3MF) | Không có | Có |
| Dải giá trị | W/D 30–250, H 30–120, vách 1–4 | Theo bản gốc (mục 1.1) |
| Chế độ "kích thước tuỳ chỉnh" + Auto-fit | **Có** (bản gốc không có) | Giữ — xem D4 |
| Báo giá, Custom Request, GA4 | Có | Giữ nguyên, mở rộng tham số |

## 3. Brief

- **Goal:** `/tools/organizer` cho ra **cùng hình học** (sai số thể tích ≤ 1%, cùng số ngăn/kích thước ngăn)
  và **cùng bộ tính năng/UX** như bản gốc với mọi cấu hình hợp lệ; vẫn giữ luồng báo giá + Custom Request.
- **Non-goals:** sửa 6 tool khác; đổi API báo giá; lưu cấu hình vào DB; hỗ trợ xoay 90° khi kiểm tra bàn in
  (bản gốc không làm); Gridfinity.
- **Inputs:** mục 1, engine/workbench hiện tại, `src/lib/3d-tools/common/3mf-writer.ts`,
  `src/lib/pricing/mesh-estimator.ts`, `/api/public/tool-price-estimate`, `custom-request-form.tsx`.
- **Outputs:** engine mới chạy trong worker, workbench mới, test unit + parity + E2E cập nhật, ADR-0047.

## 4. Quyết định (đề xuất — chờ Gemini challenge rồi chốt)

**D1. Dùng `manifold-3d` + Web Worker (thêm dependency).** Lý do cụ thể (AGENTS #8): (a) parity hình học
chỉ đạt được khi dùng cùng nhân CSG và cùng phép `offset` 2D bo tròn mà `three-bvh-csg` không có;
(b) đảm bảo STL manifold — bản hiện tại xuất các khối chồng nhau, phụ thuộc slicer tự hợp nhất;
(c) dùng lại được cho Lamp chế độ "Mô hình" và Jigsaw sau này. Chi phí: WASM ~0,5–1 MB, chỉ tải khi mở tool
(lazy trong worker, không ảnh hưởng storefront). Phương án thay thế: tự viết offset + `three-bvh-csg`
— rẻ dependency nhưng khó đạt sai số ≤ 1% và vẫn có nguy cơ mesh hở. **Đề xuất: D1.**

**D2. Vị trí file.** `src/lib/3d-tools/organizer/`: `organizer-params.ts` (kiểu, mặc định, preset, máy in,
chuẩn hoá — thuần TS), `organizer-geometry.ts` (dựng bằng manifold, nhận module manifold qua tham số để
test được trong Node), `organizer-label.ts`, `organizer-texture.ts`, `organizer-share-url.ts`,
`organizer.worker.ts`, `organizer-worker-client.ts` (Promise + id + huỷ). Đúng quy ước Phase 19 §4.1.

**D3. Nạp WASM trong Next 15.** Copy `manifold.wasm` vào `public/vendor/manifold/<version>/` bằng script
`postinstall`/`prebuild` (hoặc import `?url` nếu webpack cho phép), worker gọi `Module({ locateFile })`.
Cần spike ở lát A trước khi làm tiếp. CSP hiện tại (Phase 34) phải cho `worker-src 'self' blob:` và
`'wasm-unsafe-eval'` cho route tools — kiểm tra lại.

**D4. Giữ chế độ "Kích thước tuỳ chỉnh" làm tính năng thêm.** Mặc định UI giống hệt bản gốc (lưới đều);
chế độ tuỳ chỉnh nằm trong "Lưới ngăn → Nâng cao". Engine nhận mảng `columnWidths[]`/`rowDepths[]`
(lưới đều chỉ là trường hợp riêng), nên scoop/lỗ đáy vẫn hoạt động. Nếu OWNER muốn giống 100% tuyệt đối
thì ẩn hẳn — chi phí gỡ bằng 0.

**D5. Màu chỉ dùng cho preview và đưa vào mô tả Custom Request**; STL vẫn 1 khối. Nhãn snap xuất 3MF
2 màu bằng `3mf-writer.ts` hiện có (mở rộng nếu cần cho 2 object + basematerials).

**D6. Custom Request đính kèm STL hộp.** Nếu bật nhãn: đính kèm file thứ hai (3MF nhãn) nếu luồng upload
cho phép nhiều file; nếu không, đóng gói zip (`fflate`) `bin.stl + label.3mf`. Lát F kiểm tra
`uploadCustomRequestFile` và giới hạn loại file trước khi chọn.

**D7. Font nhãn.** Mặc định Inter (OFL, hỗ trợ tiếng Việt) để khớp bản gốc; upload font lưu IndexedDB
(chỉ máy người xem). Bọc mọi truy cập IndexedDB bằng try/catch.

**D8. Dải giá trị theo bản gốc**, kể cả vách 0,4 mm. Thêm cảnh báo riêng của BaSa3D (không chặn) khi
`wall` hoặc `divider < 0.8` mm: "vách quá mỏng, có thể in hỏng với vòi 0.4". Báo giá vẫn chạy bình thường.

**D9. i18n.** Chuỗi đưa vào `messages/vi.json`, `messages/en.json` (namespace `organizer`), giữ nguyên văn
bản gốc. Đổi tiêu đề thành "Trình tạo khay & hộp chia" theo bản gốc.

## 4b. Trạng thái triển khai (2026-10-21, Claude)

OWNER duyệt D1/D4/D-mặc định và yêu cầu triển khai luôn. Điều chỉnh so với đề xuất:
- **D3**: không cần copy WASM — `manifold.js` dùng `new URL('manifold.wasm', import.meta.url)`, webpack 5
  tự xuất WASM thành asset. CSP (report-only) thêm `'wasm-unsafe-eval'` + `worker-src 'self' blob:`.
- **D6**: Custom Request gửi **1 file**: STL khi không có nhãn, 3MF (hộp + tấm nhãn + chữ, có màu) khi bật nhãn.
- **D7** (cập nhật 2026-10-21 lần 2): mặc định **Inter Regular v3.019** — `public/fonts/Inter-Regular.ttf` là
  đúng file `assets/label-font-*.ttf` của bản gốc (giống từng byte), license `public/fonts/OFL-Inter.txt` lấy từ
  tag `v3.19` của `rsms/inter`. Font upload lưu IndexedDB (`organizer-font-store.ts`, cùng tên DB/store/key với
  bản gốc: `bin-generator-fonts`/`fonts`/`custom`), mọi lỗi storage rơi về font mặc định.
- **D9**: chuỗi VI/EN đặt trong `organizer-i18n.ts` (nút VI/EN trong tool, giống bản gốc), không đưa vào `messages/*.json`.
- Cảnh báo `warn.labelWallThin` của bản gốc không thấy được kích hoạt trong mã worker → không port.

## 4c. Đối chiếu mã gốc (2026-10-21, Claude — đọc `index-DD9u1MQL.js` + `bin.worker-BUMfLQQy.js`, app v0.1.0)

- `manifold.wasm` của bản gốc **giống từng byte** với `manifold-3d@3.5.4` → cùng nhân CSG.
- Mã dựng hình (`cd`, `ad`, `id`, `ud`, `hd`, `dd`, `gd`, `md`, `pd`) và chuẩn hoá (`yd`) khớp từng dòng với
  `organizer-geometry.ts` / `organizer-params.ts` / `organizer-label-text.ts`. Brief §1.4 bước 5 ghi khoét đáy
  `offset(−h − 0.5)`: mã gốc là `−h − 2·0.25` — cùng giá trị.
- **Brief khác mã gốc, đã theo mã gốc:**
  - Dải slider nhãn trên UI gốc là cỡ chữ 3–**20**, độ nổi 0.2–**2**, chiều cao thẻ **8–30**; worker vẫn kẹp
    3–40 / 0.2–3 / 6–40 (brief §1.1 ghi dải của worker). → `LABEL_SLIDER_RANGES` (UI) + `LABEL_RANGES` (kẹp).
  - Cảnh báo hiện **ngay dưới nhóm điều khiển liên quan** (không phải một danh sách chung, brief §1.5).
    → `SECTION_WARNINGS`.
  - Chỉ báo máy in: gốc **chỉ hiện "Vượt khổ máy in đã chọn"** khi vượt; không hiện gì khi vừa (chuỗi
    `printer.fitOk` có nhưng không dùng). Nhãn đúng là "khổ in", không phải "bàn in".
  - Preset thay **toàn bộ** tham số (màu về `#3b82f6`).
  - Bản gốc **không có nút chia sẻ**: chỉ đọc query lúc mở trang và có `window.__app.shareURL()`. Nút
    "Sao chép liên kết" của BaSa3D là phần thêm.
  - Không có phụ đề dưới tiêu đề; thông tin mô hình in số kiểu `toFixed(1)` và số tam giác `toLocaleString()`,
    kích thước thẻ `W×H` làm tròn 0 chữ số, độ dày 1 chữ số; nút tải nhãn 3MF nằm ở chân panel cạnh "Tải STL".
  - Chuỗi VI đúng nguyên văn: "Nội dung", "Chiều cao thẻ", "Kích thước thẻ", "Màu thẻ", "Tải phông lên...",
    "Tệp phông không hợp lệ…", "Thành quá mỏng cho vành xếp chồng.".
- **Giữ khác bản gốc (phần thêm của BaSa3D, có chủ đích):** báo giá + Custom Request + GA4, chế độ kích thước
  ngăn tuỳ chỉnh (D4), cảnh báo `warn.thinWalls` (D8) / `warn.labelNoFit` / `warn.custom*`, kẹp tham số vào dải
  slider khi đọc từ URL (gốc chỉ kẹp ≥ 1), nút sao chép liên kết, nút VI/EN ẩn theo
  `NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED` (ADR-0048).
- **Lỗi parity đã sửa:** tâm ngăn của lưới đều phải tính đúng biểu thức gốc `x0 + i·(cell + divider)`;
  cách cộng dồn cũ lệch bit cuối → cùng thể tích nhưng manifold tam giác hoá khác (vd. 150×100, 4×2, rãnh lấy
  đồ: 6224 vs 6220 tam giác). Bảng 20 ca đầu không bắt được — lý do mở rộng lên 46 ca.
- **Giao diện giống hoàn toàn** (OWNER duyệt 2026-10-21): CSS gốc port 1:1 vào `organizer.module.css`
  (neumorphism, panel 360 px, header/footer dính, mục thu gọn ▾/▸, toggle 1 cột, ô màu full-width); viewer
  dựng lại bằng three.js thuần cùng thông số r3f/drei: nền `#e6ebf2`, ACES exposure 0.9, đèn, vật liệu
  flat-shaded, `ContactShadows`, `Grid` vô hạn, `Bounds` margin 1.25. Lưu ý: `Bounds` gốc fit lúc chưa có mesh
  → khung camera cố định (khoảng cách ≈ 496) không phụ thuộc kích thước hộp; chỉ fit lại theo mô hình khi đổi
  kích thước cửa sổ — đã làm y như vậy. Phần thêm của BaSa3D (báo giá, Custom Request, chia sẻ, ngăn tuỳ chỉnh)
  dùng cùng ngôn ngữ thiết kế, đặt ở mục "Báo giá & đặt in" trên footer.
- License: `public/licenses/manifold-3d-LICENSE.txt` (Apache-2.0) + `public/fonts/OFL-Inter.txt`.
- **Dùng thử như người dùng (Chrome thật, GPU Metal, 1440×900 / 1280×720 / iPhone 13), 2026-10-21 — đã sửa:**
  - Header dùng chung của `(tools)` làm canvas thấp hơn 56 px → OrbitControls (tỉ lệ theo chiều cao canvas)
    xoay/zoom khác bản gốc. Organizer chuyển sang route group `(tools-fullscreen)` (layout không header, URL
    giữ `/tools/organizer`); link "Về cửa hàng BaSa3D" nằm trong mục "Báo giá & đặt in".
  - Zoom con lăn nhanh gấp ~2×: OrbitControls của three r185 nhân theo |deltaY|, còn three-stdlib (drei) của
    gốc zoom cố định 0.95/sự kiện → ghi đè `_getZoomScale` như stdlib.
  - Bản gốc không có CSS reset: nút/ô nhập dùng font mặc định của trình duyệt (Arial) và `line-height: normal`;
    Tailwind preflight ép kế thừa → mũi tên ▾ nhỏ, panel thưa hơn. Dùng `revert` trong phạm vi tool.
  - Sau sửa: cùng thao tác kéo/zoom/đổi preset cho khung hình trùng gần như từng pixel (đo camera qua hook
    `?__probe` giống gốc). Còn khác có chủ đích: nút VI/EN ẩn theo `NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED`
    (ADR-0048, thay đổi của phiên khác), tên file nhãn bỏ dấu tiếng Việt (`label_Oc_vit_M3_2color.3mf`; gốc
    xoá ký tự có dấu → `label_c_v_t_M3_2color.3mf`).
- Bản gốc có API `window.__app` (`setParams`, `loadPreset`, `setLabel`, `regen`, `getInfo`, `getWarnings`,
  `getLabelInfo`) — dùng để đo giá trị vàng tự động.

Kết quả spike lát A: `manifold-3d@3.5.4` chạy trong Node 22 (hộp bo góc trừ 1 ngăn: 19 ms, `NoError`).
`next build` **chưa chạy xong** — sandbox Linux hết dung lượng giữa chừng. OWNER cần chạy trên máy (mục 7).

## 5. Lát cắt

- [x] **A. Spike WASM + worker** — kiểm 2026-10-21 trên macOS: `next build` xanh; `manifold.wasm` (541 KB) xuất
  thành `static/media/manifold.<hash>.wasm`, worker là chunk riêng chỉ do webpack runtime nạp (không page nào
  khác tham chiếu). Chromium headless ở cả `next dev` và `next start`: worker khởi động, wasm 200
  `application/wasm`, mặc định hiện 65,6 cm³ / 81,3 g; không vi phạm CSP `worker-src`/`wasm-unsafe-eval`.
  (Vi phạm `script-src-elem inline` dạng report-only có sẵn trên mọi trang, kể cả trang chủ — không thuộc
  Phase 45.) Lưu ý: build vào `.next` khi `next dev` đang chạy sẽ làm hỏng dev server — dùng `NEXT_DIST_DIR`.
- [x] **B. Params & chuẩn hoá** — `organizer-params.ts` (mặc định, preset, máy in, `normalizeOrganizerParams`
  trả `{params, warnings}`, `fitsPrinter`), `organizer-share-url.ts` (encode/decode). Test đủ các nhánh mục 1.3.
- [x] **C. Hình học lõi** — vỏ bo góc, lòng ngăn, lỗ đáy, rãnh lấy đồ, vành xếp chồng, label tab; trả
  `positions/indices/info`. Test chạy manifold trong Node (Vitest): mesh manifold, bbox, số ngăn, thể tích.
- [x] **D. Vân tường** — 5 kiểu + kẹp độ sâu/mật độ. Test: thể tích tăng (vân lồi) hoặc giảm (vân lõm) so với
  không vân; số điểm trong `[120, 2400]`.
- [x] **E. Nhãn snap-on** — boss/pocket trên hộp, tấm nhãn + chữ nổi, co chữ, 3MF 2 màu, upload font.
- [x] **F. Worker client + workbench mới** — panel thu gọn, slider + ô số, preset, máy in, cảnh báo, info,
  màu, chia sẻ URL, VI/EN; giữ khu báo giá + Custom Request + GA4 (thêm `preset`, `texture`, toggle vào event).
  Canvas dùng lại `organizer-canvas.tsx`, nhận `positions/indices` từ worker.
- [x] **G. Parity test** — 46 cấu hình đo trên trang gốc qua `window.__app` bằng Chromium headless
  (2026-10-21): mặc định, 6 preset, 5 vân, 4 toggle, bật cả 4 toggle, 2 ca nhãn (Inter), 1 ca bị kẹp vân,
  6 ca preset + đủ tính năng + nhãn, 20 ca ngẫu nhiên (seed cố định) trên đúng step của slider.
  Lưu ở `tests/fixtures/organizer-parity.json`; `tests/organizer-parity.test.ts` so thể tích, khối lượng,
  **số tam giác chính xác**, bbox, kích thước ngăn, cảnh báo và thông tin nhãn. Kết quả: lệch thể tích 0,0000%,
  số tam giác trùng 100% (chặt hơn yêu cầu ≤ 1% / ≤ 5% vì cùng WASM + cùng font).
- [x] **H. E2E + docs** — `e2e/organizer.spec.ts`: sửa kỳ vọng mô tả ở trang admin (còn `200x120x35mm` từ
  mặc định cũ), thêm case mở link chia sẻ (preset Giá đựng dụng cụ) + tải STL (tên file, số tam giác, kích thước).
  Đã xoá `organizer-engine.ts`, `organizer-constants.ts`, `tests/organizer-engine.test.ts` (không còn import).
  ADR-0047 cập nhật font + đối chiếu.

## 6. Rủi ro

- **WASM trên Next/Vercel** (D3) — rủi ro lớn nhất, nên mới đặt spike ở lát A.
- **Máy yếu/điện thoại**: vân 2.400 điểm × 144 ngăn × boolean có thể mất vài trăm ms. Worker + debounce
  giữ UI mượt; thêm trạng thái "Đang dựng…" và giữ mesh cũ cho tới khi có mesh mới.
- **Rò bộ nhớ WASM**: mọi đối tượng manifold phải `.delete()` (bản gốc có làm). Test chạy 200 lần dựng liên
  tiếp, theo dõi heap.
- **Đổi mặc định** (180×120×35 → 120×80×40) làm thay đổi mô tả Custom Request và GA4 — chỉ ảnh hưởng dữ liệu
  mới, không có migration.
- **Bản gốc có thể thay đổi** (nó đang chuyển sang app desktop). Giá trị vàng ghi kèm ngày đo; không
  phụ thuộc trang gốc khi chạy CI.
- Giấy phép: OWNER đã nhận trách nhiệm (mục 0).

## 7. Definition of Done

- [x] typecheck, lint, unit test (không DB) xanh; `next build` xanh; storefront không tăng JS (so sánh chunk).
- [x] Parity test (lát G) xanh cho toàn bộ bảng giá trị vàng (46 ca, khớp chính xác).
- [x] STL xuất ra manifold (kiểm bằng `Manifold.status()` trong test) và mở được trong Bambu Studio không lỗi.
- [x] E2E `organizer.spec.ts` — case chia sẻ link + tải STL xanh trên production build (2026-10-21). Case gửi
  Custom Request (cần Supabase test) **chuyển sang follow-up theo quyết định OWNER 2026-10-21**: máy hiện không có
  Supabase CLI/Docker; chạy lại khi có Supabase test hoặc trên CI.
- [x] OWNER: in thử 1 hộp có vành xếp chồng + 1 nhãn snap để xác nhận dung sai 0,25 mm khớp thật — OWNER xác nhận OK 2026-10-21.
- [x] Webpack config fix: NormalModuleReplacementPlugin + fallback cho `node:module` từ manifold-3d.
