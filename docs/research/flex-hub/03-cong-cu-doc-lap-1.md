# Flex Hub v0.2.24 — Ghi chú công cụ (phần 1): timetable · flexi · bottle · vase · leather

Phương pháp: chỉ đọc tĩnh các bundle trong `flexhub-web/assets/` (không chạy, không import). Mọi offset là **offset ký tự (Python `str.find`) trong file**, không phải byte. Tên file viết tắt:
`App` = App-CXT8Oy65.js · `TT` = TimetableScreen-BkPntagu.js · `design` = design-mDRcZtB5.js · `store` = store-SGyaWieW.js · `W` = worker-Cc0bSqjO.js (worker hình học, dùng manifold-3d) · `VW` = worker-CzXTwprB.js (worker riêng của vase) · `pipe` = pipeline-DVPZCkNy.js · `i18n` = i18n-EFUBxO61.js · `acc` = store-UjNBdwk8.js · `common` = common-BI3l0mmp.js.

Ký hiệu: **[Quan sát]** đọc trực tiếp trong code · **[Suy luận]** suy ra từ code/số liệu · **[Chưa rõ]** chưa xác định được.

---

## 0. Bản đồ bundle và các điểm chung

| Tool id | Nhãn VI / EN | UI | State/logic | Hình học |
|---|---|---|---|---|
| `timetable` | Thời khóa biểu / Timetable | `TT` (`function xs()` TT:249537, `Ss` màn chính) | `store` (`Zn` mặc định store:39476, build debounce `dr` store:42543) | `W` `Zx` W:3284127, export `Nh` W:2321838 |
| `flexi` | Đồ chơi khớp / Flexi toy | `App` `_c()` App:446828 | `store` store `X` store:417166 | `W` `Gh`/`Jh` W:2682728/2684159, `case flexiExport` W:3299500 |
| `bottle` | Làm chai / Bottle Maker | `App` `Nc()` App:456917 | `design` `Tf` design:385840 | `W` `gg` W:3140719, `og` template W:2687904 |
| `vase` | FLEX VASE | `App` `Hc` (tab `Vc` App:464761) | `design` design:394522–397900 | `VW` (toàn bộ file, 5.6 KB) |
| `leather` | Rập da / Leather pattern | `App` (App:485600–492000), export `Qc` App:481223 | `store` `Cv` store:438181 | `store` đầu file (store:0–18300); DXF/SVG `design` `ws`/`Ts` design:5273/6243 |

- [Quan sát] Prefix i18n: `tt.*` timetable (+`deco.*` trang trí), `fx.*` flexi, `bt.*` bottle, `vs.*` vase, `lt.*` leather. EN bắt đầu ở đầu file, VI sau `},vi:` (i18n:41054). Ví dụ `tool.vase` i18n:328, `tool.timetable` i18n:11173, `tool.flexi` i18n:15844, `tool.leather` i18n:16771, `tool.bottle` i18n:34905.
- [Quan sát] Ánh xạ tool → màn: App:1129273 (`timetable`→timetable, `flexi`→flexi hoặc `groups` khi đang tô màu, `bottle`, `vase`, …). Nhóm tool này ẩn component `QR` chung ở header (App:1109087).
- [Quan sát] Lưu thiết kế vào Thư viện: `saveToolDesign` đóng gói `{kind:"flexhub-design",version:1,flow,tool,data}` + file phụ + file in + thumbnail (design:399113, `Zp`). Mỗi tool có hàm gom dữ liệu riêng: leather `Wp` design:400258, flexi `Kp` design:400747, timetable `qp` design:401326, bottle `Jp` design:402049, vase `Xp` design:402806.
- [Quan sát] Panel "Thư viện" trong sidebar (component `wr`/`Ba`, TT:26908): leather → "thêm miếng" từ SVG trong thư viện; timetable → thêm trang trí, áp kiểu chữ tiêu đề/chữ; flexi → ghép mô hình (`Cr`); bottle → thay mô hình.
- **Pro / giới hạn**:
  - [Quan sát] Tài khoản trả về `lockedTools`, `dailyExports`, `exportsToday` (acc:~900, `u=e=>({…lockedTools:[],dailyExports:0…})`). `toolLocked(tool)` = signedIn && lockedTools.includes(tool) (acc:1200). Hub hiển thị huy hiệu "Pro" cho tool bị khóa (store:38790).
  - [Quan sát] Mỗi lần xuất gọi `claimExport` → lệnh Tauri `account_claim_export {tool}`; nếu bị từ chối bật dialog lý do `limit` → `pro.limit` "Free: 1 export a day / Free: 1 lượt xuất mỗi ngày" (acc:1494, Gate:3145, i18n:32237). Vase gọi tại `Ap` (design:397534, `await hs()`), bottle `qf` (design:388264), flexi `c_`/`l_` (store ~423000, `await A()`).
  - [Chưa rõ] Tool nào trong 5 tool bị khóa Pro: do server quyết định (`lockedTools` động), không hard-code trong bundle.
  - [Quan sát] `lib.savedNoPrints`: khi hết lượt xuất trong ngày, lưu thư viện không kèm file in (i18n:33565).
- [Quan sát] Nút "Bambu Studio ↗" (`bambu.open`): lưu 3MF rồi mở bằng Bambu Studio (Windows, tìm trong Program Files) — có ở flexi (App:451267, `l_` store:423219).

---

## 1. `timetable` — Thời khóa biểu (bảng 3D có thẻ môn học cắm vào)

### 1.1 Mục đích
[Quan sát] Tạo bảng thời khóa biểu in 3D: bảng nền có các ô lõm (pocket) theo lưới ngày × tiết, thẻ môn học (tile) rời cắm vào ô, đĩa ngày (disc) rời, tiêu đề chữ nổi/khắc, chân đế dựng bảng, tùy chọn trang trí hình ảnh (W:3284127 `Zx`; i18n `tt.heading` "Design your timetable / Thiết kế thời khóa biểu" i18n:11202).

### 1.2 UI (sidebar `xs()` TT:249537), theo thứ tự
1. **Máy in của bạn** (`g.des.printer`): 2 thẻ `mode` 1 = "Multi-color (AMS) / In nhiều màu (AMS)", 2 = "Single color / In một màu" (TT:249929). [Quan sát]
2. **Tiêu đề** (`tt.title`): ô chữ, phông (`tt.font`), kiểu Nổi/Khắc chìm (`tt.raised`/`tt.engraved`), màu tiêu đề (hiện "cuộn nhựa {n}" khi mode 1 và kiểu nổi). [Quan sát]
3. **Ngày & tiết** (`tt.layout`): Số ngày 1–7 step 1 (TT:250580) + ô sửa tên từng ngày; Tiết buổi sáng 0–8, Tiết buổi chiều 0–8 step 1 (TT:250966); **Hình bảng** (8 lựa chọn, icon SVG TT:248027); nút "Đổi hình" khi `custom`; checkbox **Chân đế**. [Quan sát]
4. **Môn học**: danh sách (nút cọ tô = số ô đang dùng, tên, màu, xóa), "+ Thêm môn", "Tẩy", "Xóa hết"; vẽ bằng cách click ô trong trình soạn 2D. [Quan sát]
5. **Chữ trên thẻ & ngày** (`tt.text`): phông chữ, kiểu thẻ (nổi/khắc), kiểu ngày (nổi/khắc), màu chữ thẻ, màu đĩa ngày, màu chữ ngày. [Quan sát]
6. **Trang trí** (`deco.title`): danh sách hình + kích thước, cảnh báo "làm cho in nhiều màu/một màu" khi `deco.mode !== mode`; "+ Thêm hình" (mở flow `picture`/móc khóa ở chế độ decorating, design:~7600 `ks`). [Quan sát]
7. **Thư viện** (`wr`). 8. **Bảng**: màu bảng, màu chân đế. 9. **Thêm tùy chọn** (`<details>` TT:254725) = các tham số số bên dưới. [Quan sát]
- Khung xem: chọn "Soạn" (2D editor SVG) / "Mô hình 3D" (TT:~255600). Cảnh báo `tt.missing` "Phông này không có: {chars}" khi ký tự không có glyph (W:3284451). Dòng trạng thái `{w} × {h} mm`. Nút "Xuất tệp…" (`_s` TT:247656). [Quan sát]

### 1.3 Mặc định (`Zn(lang)` store:39476) [Quan sát]
- Tiêu đề: VI "Thời Khóa Biểu" / EN "My Timetable". Ngày: VI `T2…T7`, EN `Mon…Sat` (6 ngày). Sáng 5, chiều 5.
- Môn: VI `Toán, Tiếng Việt, Tiếng Anh, Khoa học, Mĩ thuật, Thể dục`; EN `Math, English, Science, History, Art, PE` (store:39114). Bảng màu môn xoay vòng `#f6a5c0 #9ad0f5 #b8e994 #ffd166 #cdb4db #ffadad #a0e7e5 #fbc4ab` (store:39369).
- Ô mặc định điền theo công thức `cells[r] = (floor(r/days)*2 + (r%days)*3) % nSubjects` (store:39476).
- Kiểu: title/tile/disc đều `raised`; `edge:"wavy"`; `stands:true`.
- Màu: board `#ffffff`, title `#e75480`, tileText `#320125`, disc `#ffd6e7`, discText `#320125`, stand `#ffffff`.
- Phông: tiêu đề `dancing-script`, chữ `be-vietnam-pro`; `mode:1`.

### 1.4 Tham số nâng cao (`Ix`, W:3278768; clamp `Lx`) [Quan sát]
| key | VI | EN | min | max | step | default | adv |
|---|---|---|---|---|---|---|---|
| slotW | Dài thẻ (mm) | Tile length (mm) | 18 | 45 | 0.5 | 28.5 | |
| slotH | Rộng thẻ (mm) | Tile width (mm) | 8 | 20 | 0.1 | 11.2 | |
| gapX | Khoảng cách ngày (mm) | Gap between days (mm) | 1.5 | 10 | 0.1 | 2.7 | |
| gapY | Khoảng cách tiết (mm) | Gap between periods (mm) | 1.5 | 10 | 0.05 | 3.55 | |
| groupGap | Khoảng cách sáng / chiều (mm) | Gap morning / afternoon (mm) | 0 | 20 | 0.5 | 7 | |
| margin | Lề bảng (mm) | Board margin (mm) | 5 | 30 | 0.5 | 12 | |
| titleSize | Cỡ tiêu đề (mm) | Title size (mm) | 6 | 30 | 0.5 | 16 | |
| tileTextSize | Cỡ chữ thẻ (mm) | Tile text size (mm) | 3 | 10 | 0.1 | 5.5 | |
| discTextSize | Cỡ chữ ngày (mm) | Day text size (mm) | 3 | 8 | 0.1 | 5 | |
| thickness | Độ dày bảng (mm) | Board thickness (mm) | 3 | 10 | 0.1 | 5 | ✓ |
| pocketDepth | Độ sâu ô (mm) | Pocket depth (mm) | 1.5 | 4 | 0.1 | 2.8 | ✓ |
| tileH | Cao thẻ (mm) | Tile height (mm) | 3 | 8 | 0.1 | 4.4 | ✓ |
| textDepth | Cao / sâu chữ (mm) | Text height / depth (mm) | 0.4 | 2 | 0.1 | 1 | ✓ |
| discD | Đường kính đĩa ngày (mm) | Day disc diameter (mm) | 10 | 24 | 0.5 | 14 | ✓ |
| discH | Cao đĩa ngày (mm) | Day disc height (mm) | 2.5 | 6 | 0.1 | 3.6 | ✓ |
| tileFit | Khe hở thẻ (mm) | Tile fit clearance (mm) | 0 | 0.4 | 0.05 | 0.1 | ✓ |
| discFit | Khe hở đĩa ngày (mm) | Day disc fit clearance (mm) | 0 | 0.5 | 0.05 | 0.2 | ✓ |

[Quan sát] UI hiển thị toàn bộ bảng này trong "Thêm tùy chọn" bằng label theo ngôn ngữ (`e.label[t]`, TT:254725); cờ `advanced` không thấy dùng để ẩn trong TT. [Suy luận]

Lựa chọn khác: board shape `wavy | rounded | straight | scallop | cloud | heart | oval | custom` (nhãn `tt.shape.*` i18n:12614–12801: Lượn sóng / Bo góc / Thẳng / Vỏ sò / Đám mây / Trái tim / Bầu dục / Theo hình). Kiểu chữ `raised|engraved`. Phông bundled (common:11946): Be Vietnam Pro Bold, Dancing Script Bold, Lilita One, Cherry Bomb One, Luckiest Guy, Titan One, Bagel Fat One, Bevan, Ultra; + phông hệ thống + nạp file `.ttf,.otf,.woff` (TT:14197). [Quan sát]

### 1.5 Thuật toán (`Zx` W:3284127)
**Bố cục lưới `Yx` (W:3283405)** [Quan sát]
- `n = days`, `rows = morning+afternoon`; `gridW = n·slotW + (n−1)·gapX`; `gg = groupGap` chỉ khi cả sáng và chiều > 0;
- `gridH = rows·slotH + (rows−1)·gapY + gg`; dải đĩa ngày cao `discD + 4`;
- `boardW = gridW + 2·margin`, `boardH = gridH + discD + 4 + 2·margin` (gốc tọa độ ở tâm bảng);
- tâm ô (row i, col j): `x = −gridW/2 + slotW/2 + j(slotW+gapX)`, `y = top − slotH/2 − i(slotH+gapY) − (i ≥ morning ? gg : 0)`, với `top = −boardH/2 + margin + gridH`; đĩa ngày ở `y = top + (discD+4)/2` thẳng cột ngày;
- vạch chia sáng/chiều ở giữa khe `gg`.

**Lượng tử hóa theo lớp (mode 2)** `Xx(v) = first + (n−1)·layer`, `n = 1 + ceil((v−first)/layer − 1e−6)` (W:3283992); `layerMm = firstLayerMm = 0.2` mặc định (pipe:90446). `textDepth` mode 2 = `max(layer, round(textDepth/layer)·layer)`. [Quan sát]

**Hình bảng `qx` (W:3282088)** [Quan sát]
- bán kính góc `a = 1` (straight) hoặc `min(14, w/4, h/4)`;
- rounded/straight: chữ nhật co `a` rồi offset tròn `a`;
- wavy: chu vi bo góc lấy mẫu mỗi 0.5 mm, dịch theo pháp tuyến `2.5·sin(2π·k·i/N)` với `k = max(8, round(chu vi/40))`;
- scallop: hình bo góc ∪ đường tròn r = 5 đặt mỗi 9 mm dọc chu vi; cloud: bo góc co thêm 4 mm ∪ tròn r = `9 + 4·sin²(i·2.399)` mỗi 16 mm, lùi vào `0.55r`;
- heart: đường cong `x=16sin³t, y=13cos t−5cos2t−2cos3t−cos4t` (240 điểm, W:3281889); oval: ellipse; custom: đường viền ảnh;
- heart/oval/custom được `Gx` phóng sao cho **phủ kín** chữ nhật w×h: thử dy ∈ {−0.3…0.3}·h, nhị phân 24 vòng tìm hệ số nhỏ nhất, ×1.0005 (W:3281292).
- Ảnh custom (`silhouette` op): SVG → union các ring; raster → ngưỡng alpha ≥ 128, hoặc khoảng cách màu > 60 so với màu nền trội ở viền ảnh; giảm mẫu ≤ 400 px; simplify 0.25; `Mx` lấy đa giác dương lớn nhất, đóng hình thái học ±0.8% kích thước, simplify 0.08%, chuẩn hóa chiều cao = 1 (W:3277148/3277683/3277924).

**Tiêu đề** [Quan sát]: chữ cao `titleSize`, rộng tối đa `0.8·boardW` (`Jx` co lại nếu tràn, W:3283101); đặt tại `y = boardH/2 + 0.35·hText`; viền bảng = union(bảng, offset(text, 4)) (hàm `vo(n,4)`; [Suy luận] "4" là offset mm tạo "tai" tiêu đề). Raised: khối màu cao `textDepth` trên mặt bảng; Engraved: khoét sâu `min(textDepth, thickness−1)`.

**Bảng nền** (cao `l = Xx(thickness)`) [Quan sát]
- ô lõm hình "stadium" (`Ux`, chữ nhật đầu tròn, W:3280445) kích thước `(slotW+2·tileFit) × (slotH+2·tileFit)`, sâu `pocketDepth` (đáy ở `T = l − pocketDepth`), + 3 bậc vát miệng lan rộng tới `Bx = 0.5` mm trong 0.5 mm trên cùng (W:3285215);
- lỗ đĩa ngày: tròn `discD/2 + discFit`, đáy `E = l − min(3, l−1)`; trong lỗ có chốt vuông 6×6 mm cao 1.5 mm (W:3285494);
- rãnh chia sáng/chiều: rộng 0.8, dài `gridW+4`, sâu 0.5 (W:3285693);
- chân đế: 2 lỗ vuông 8×8 sâu 1 mm cho mỗi chân, ở 25% và 75% chiều `along` (W:3285843).

**Thẻ môn (tile)** [Quan sát] (W:3286790): stadium `slotW × slotH`, cao `R = Xx(tileH)`; khoét rỗng mặt dưới (thành `zx = 0.8`, sâu `R−1.1`); 4 gờ giữ `Rx = {len 3, out 0.25, z 0.6–1.6}` tại x = ±slotW/4 trên 2 cạnh dài (khớp bấm). Chữ: cỡ `tileTextSize`, rộng ≤ `slotW − 0.6·slotH`, cao ≤ `slotH − 2.4`; raised cao `textDepth`, engraved sâu `min(textDepth, 0.7)`. Chỉ tạo thẻ cho ô có môn.

**Đĩa ngày** [Quan sát] (W:3288000): trụ Ø`discD` cao `Xx(discH)`, khoét lỗ vuông `6+2·discFit` sâu 1.7 ở đáy (ăn vào chốt 6×6); chữ ≤ `0.72·discD` × `0.5·discD`.

**Chân đế** [Quan sát] (`Vx={along:43, depth:42, width:15, frame:4.5, peg:7.8, pegH:0.8, hole:8, holeDepth:1}` W:3280234; dựng W:3288830): 2 chân tại x = ±boardW/4; tam giác vuông (cạnh 42 × (offset+43)) dạng khung dày 4.5, đùn 15 mm, 2 chốt 0.8 × 7.8 cắm lỗ đáy bảng; xuất ra được xoay `printRotate [0,−90,0]` để in nằm.

**Trang trí** [Quan sát]: tạo bằng flow "picture" rồi đặt lên mặt bảng tại (x,y), z cộng thêm chiều cao bảng (`eS` W:3290410).

**Màu/slot** [Quan sát] (`nr` store:40675): danh sách màu duy nhất theo thứ tự board → title (nếu nổi) → các môn đang dùng → tileText (nếu nổi) → disc → discText (nếu nổi) → stand (nếu có) → màu trang trí; slot filament = thứ tự xuất hiện (1-based). Mode 2 phần chữ là `band` (đổi nhựa theo lớp), mode 1 là `color`.

### 1.6 Xuất (`Nh` W:2321838, `Mh` W:2321027)
- [Quan sát] Gom part theo `object` (board, `tiles-<i>`, discs, stands, `deco-<n>`), mỗi object đặt cạnh nhau theo X cách 10 mm, căn đáy z=0.
- [Quan sát] Mode 1 (AMS): `<base>_timetable.3mf` (mọi object, layerHeight/firstLayer theo mode2) + STL cho từng object × từng màu: `<base>_<object>.stl` hoặc `<base>_<object>_<tên part>.stl` cho phần chỉ là chữ màu.
- [Quan sát] Mode 2 (một màu): mỗi object `<base>_<object>.3mf` + `.stl`; nếu có band màu: `<base>_<object>_swaps_en.txt` và `_swaps_vi.txt` (hướng dẫn đổi nhựa theo lớp, mẫu `g.exp.swapLine` "Layer {n} (Z = {z} mm): change to {color}").
- [Quan sát] `<base>` = tiêu đề (hoặc `timetable`) đã thay ký tự không phải chữ/số/`_-` bằng `_` (`NS` W:3292222; `qp` design:401326).

---

## 2. `flexi` — Đồ chơi khớp (cắt mô hình thành các đốt có khớp)

### 2.1 Mục đích / đầu vào
[Quan sát] Nhập mô hình kín STL/OBJ/3MF (App:446804) hoặc "Mẫu" (capsule: trụ dài 112 r = 14 + 2 cầu r = 14 → ~140×28×28 mm, `$h` W:2684747); đặt các "khớp cắt" (cutter) lên mô hình; mô hình bị trừ đi cutter → nhiều đốt (i18n `fx.title` "Make a flexi toy").

### 2.2 UI (`_c` App:446828)
- Thanh canvas: "+ Thêm khớp" (chế độ đặt, con trỏ chữ thập; `fx.addHint` "Bấm vào mô hình ở chỗ đặt khớp"), Gizmo Di chuyển/Xoay. [Quan sát]
- Sidebar: **Mô hình** — Xoay X/Y/Z mỗi lần +90°; Kích thước (%) 20–400 step 5 (App:448983); Đáy phẳng (checkbox); Cắt đáy (mm) 0–30 step 0.2 (App:449280). **Màu** — "Một màu"/"{n} màu" + nút "Tô màu…" (mở tool groups/colorsplit với source flexi). **Khớp ({n})** — danh sách, chọn nhiều Ctrl/Shift, ⧉ nhân bản, × xóa, "Tất cả"; Cỡ khớp (%) 30–250 step 5 (App:450363); "Xóa {n}". Ghi chú "Phóng ×{k} khi mở"; "{n} phần · w×d×h mm". Thư viện (ghép mô hình). Nút "Bambu Studio ↗", "Xuất tệp…". Phím Delete xóa khớp chọn, Esc hủy. [Quan sát]
- Cảnh báo `fx.missed` "{n} khớp chưa cắt hết: tăng cỡ hoặc dời khớp" (App:448392). [Quan sát]

### 2.3 Tham số / mặc định (`X` store:417166)
| key | VI | EN | min | max | step | default |
|---|---|---|---|---|---|---|
| turn[x,y,z] | Xoay | Turn | — | — | 90° | [0,0,0] |
| sizePct | Kích thước (%) | Size (%) | 20 | 400 | 5 | 100 |
| flat | Đáy phẳng | Flat base | — | — | bool | true |
| trimMm | Cắt đáy (mm) | Trim from the bottom (mm) | 0 | 30 | 0.2 | 1 |
| cutter.scale | Cỡ khớp (%) | Cutter size (%) | 30 | 250 | 5 | tự tính (fit) |
| gizmo | Điều khiển | Gizmo | — | — | translate/rotate | translate |
[Quan sát]

### 2.4 Thuật toán
1. **Nhập** (`Vh` W:2681868, `Bh=[30,300]` W:2681856): nếu cạnh lớn nhất của bbox nằm ngoài [30, 300] mm → phóng đều để cạnh lớn nhất = 100 mm (`importFactor`). [Quan sát]
2. **Đặt mô hình** (`Og` store:417548, `Uh` W:2682268): ma trận = scale(sizePct/100) · rotEuler(turn); sau biến đổi căn tâm XY, đáy z = 0. Khi đổi size/trim, vị trí & scale các cutter được nhân/dịch theo (store `Pg`). [Quan sát]
3. **Đáy phẳng** (`Wh` W:2682415): cắt bỏ phần dưới `i = min(trimMm, chiều cao/2)` bằng giao với hộp, rồi hạ xuống z = 0. [Quan sát]
4. **Tự gợi ý khớp khi click** (`Jh`/`Kh` W:2684159/2683169): thử 3 mặt phẳng trục X, Y, Z qua điểm click; với mỗi trục lấy lát cắt, chọn mảnh tiết diện chứa/gần điểm nhất; ưu tiên mảnh chứa điểm, rồi diện tích nhỏ nhất. Kết quả: tâm = trọng tâm tiết diện, pháp tuyến = trục, `scale = clamp((bán kính xa nhất + 1.5)/24, 0.3, 3)`. Cutter mới: quat quay Z→pháp tuyến (`Hg` store:419511). [Quan sát]
5. **Cutter** = mesh dựng sẵn `Ph={radius:24, gap:5.176, vert, tri}` (W:2323230): 1 vỏ kín, 6 929 đỉnh / 13 862 tam giác, bbox ≈ Ø48 × 25.8 mm (z −12.92…+12.88), thể tích ≈ 14 073 mm³, có "vành" ra tới r = 24 quanh z ≈ ±3, phần thân r ≈ 10–17 (đo bằng script đọc số liệu). [Quan sát số liệu] Ý nghĩa hình học cụ thể của khớp (bi-ổ, bản lề…) và vai trò của `gap = 5.176` (khoảng hở/hành trình?) **[Chưa rõ]**; [Suy luận] đây là khớp in-tại-chỗ dạng hình cầu có rãnh, vì không có tham số khe hở nào chỉnh được trong UI — dung sai nằm sẵn trong mesh.
6. **Cắt** (`Gh` W:2682728): `result = trimmed − ∪(cutter_i biến đổi bởi pos/quat/scale)`; số đốt = số mảnh `decompose()` có thể tích > 1 mm³; `missed = max(0, mảnh_trước + số_cutter − mảnh_sau)` → cảnh báo. Build debounce 150 ms (350 ms khi đổi size/trim). [Quan sát]
7. **Stamp/nhân bản dãy** (`Zg`/`e_` store:420580/420931): bản sao kế tiếp dịch `30·scale` mm theo trục pháp tuyến (hoặc theo bước giữa 2 lần đặt nếu ≥ `5·scale`). [Quan sát]
8. **Ghép mô hình phụ** (`n_` store:421227, op `flexiJoin`): mô hình phụ được căn giữa, tự scale `0.4·max(size chính)/max(size phụ)` nếu lớn hơn 1.5× hoặc nhỏ hơn 0.1× mô hình chính; ghép thành STL mới. [Quan sát]
9. **Tô màu**: mesh được refine (`tg`, chiều dài cạnh ≈ max(size/150, √(area/77940))) để tô theo vùng; màu mỗi tam giác giữ qua phép trừ boolean, mặt cắt mới lấy màu lân cận (flood-fill) (`rg` W:~2685000). [Quan sát]

### 2.5 Xuất (`case flexiExport` W:3299500)
- [Quan sát] `<name>_flexi.3mf` + `<name>_flexi.stl`. Không tô màu: 3MF 1 object, màu `#ffffff`, slot 1, layerHeight 0.2 / first 0.2. Có tô màu: 3MF đa màu (`Bg`, palette 3MF) + STL.
- [Quan sát] `<name>` = tên file gốc bỏ đuôi, sanitize (`NS`), mặc định `flexi`.

---

## 3. `bottle` — Làm chai (biến mô hình thành chai có nắp vặn)

### 3.1 Mục đích / đầu vào
[Quan sát] Nhập mô hình **đặc, kín** STL/OBJ/3MF hoặc từ Thư viện (App:456651); app "khoét" lòng mô hình và lắp sẵn một **thân chai + nắp ren** chuẩn bên trong, chia mô hình thành phần thân và phần nắp.
- [Quan sát] Sửa lỗi khi mở (`Tg` W:3146448): thử weld đỉnh chính xác → nếu không thành manifold, sửa với dung sai 0 rồi 0.001 (vá lỗ, bỏ/lật mặt), báo `bt.repaired` "vá {holes} lỗ, chỉnh {faces} mặt"; thất bại → `bt.notClosed` (gợi ý Bambu Studio Fix model).

### 3.2 Template chai nhúng sẵn (`og` W:2687904) [Quan sát + số liệu đo]
- `cutZ = 75.5026`, `height = 90.5026`, `radius = 20.0048`, `pitch = 2.9992` (ren ~3 mm), `hand = 1`, `travel = 13`.
- `bodyProfile` (W:2687981): 886 điểm [z, r], z 0 → 88.5; r 18.88 tại đáy bo lên 20.005 ở z ≈ 1.5; r = 20.0048 tới z = 75.5; cổ r ≈ 17.90 từ z = 75.6 tới 88.5.
- `capProfile` (W:2700991): 151 điểm, z 75.503 → 90.503, r 20.005 → bo về 18.88 ở đỉnh.
- Mesh `body`: 5 255 đỉnh / 10 518 tam giác, bbox Ø≈40 × 0…88.5, thể tích ≈ 31 563 mm³; ống rỗng: r trong ≈ 17 (thành ≈ 3 mm), cổ r trong ≈ 15.3–16.2. Mesh `cap`: 3 143 đỉnh / 6 282 tam giác, z 75.5…90.5, thể tích ≈ 6 279 mm³, ren trong r ≈ 16.5–18.2. [Quan sát số liệu; "ren" là Suy luận từ pitch/hand/travel]
- Hoạt ảnh Mở/Đóng: nắp quay `hand·360·s/pitch` độ với s ≤ travel (13 mm ≈ 4.3 vòng) rồi nhấc thêm 12 mm (`cf` pipe:2467945; `Dc` App:452762). [Quan sát]

### 3.3 UI (`Nc` App:456917)
- Thanh canvas: "Gizmo di chuyển": Mô hình / Chai; Gizmo: Di chuyển / Xoay / Phóng to (chai chỉ di chuyển); X-ray + thanh Độ trong 0–100 %; Mở/Đóng (sau khi tạo). [Quan sát]
- Sidebar **Mô hình**: Vị trí X/Y/Z −300…300 step 0.5 (App:460398); Xoay X/Y/Z −180…180 step 1; Cỡ (mm) 10–400 step 0.5 (cạnh lớn nhất × scale). **Chai**: Vị trí X/Y/Z −200…200 step 0.5; Khe nắp (mm) 0–1 step 0.05 (App:460851); Đáy phẳng; Cắt đáy (mm) 0–50 step 0.5 (App:461144). Sau khi tạo: **Mảnh rời ({n})** "Xoá hết"/"Hoàn tác" + click mảnh đỏ để xoá; "{n} phần · w×d×h". Lưu thư viện / Lưu thành bản mới. Nút "Tạo chai" → sau đó "Xuất STL" và "Xuất 3MF" (App:462599). [Quan sát]

### 3.4 Tham số / mặc định (`Tf` design:385840)
| key | VI | EN | min | max | step | default |
|---|---|---|---|---|---|---|
| pos[3] | Vị trí (mô hình) | Position | −300 | 300 | 0.5 | [0,0,height/2] rồi auto-fit |
| rot[3] | Xoay | Turn | −180 | 180 | 1 | [0,0,0] |
| scale (hiển thị Cỡ mm) | Cỡ (mm) | Size (mm) | 10 | 400 | 0.5 | auto-fit |
| bottlePos[3] | Vị trí (chai) | Position | −200 | 200 | 0.5 | [0,0,0] |
| gapMm | Khe nắp (mm) | Cap gap (mm) | 0 | 1 | 0.05 | 0.2 |
| flat | Đáy phẳng | Flat base | — | — | bool | false |
| trimMm | Cắt đáy (mm) | Trim from the bottom (mm) | 0 | 50 | 0.5 | 2 |
| xray / opacity | X-ray / Độ trong | X-ray / Opacity | 0 | 100 | 1 | true / 35 |
| target, gizmo | Gizmo di chuyển | Gizmo moves | — | — | model/bottle; translate/rotate/scale | model, translate |
[Quan sát]
- Auto-fit khi mở (`Rf` design:386970): `scale = 1.25 · max(40/sizeX, 40/sizeY, 90.5/sizeZ)` (lớn hơn template 25%), đặt tâm mô hình tại chai, z + height/2. [Quan sát]

### 3.5 Thuật toán (`gg` W:3140719)
1. Biến đổi mô hình theo modelMatrix, dịch `−bottlePos` (chai về gốc). [Quan sát]
2. Nếu Đáy phẳng: cắt bỏ dưới mặt `z = min(zmin + trimMm, 0)`. [Quan sát]
3. Phần thân = mô hình dưới `z = cutZ − max(0, gapMm)`; phần nắp = mô hình trên `z = cutZ`. [Quan sát]
4. Lòng khoét = khối tròn xoay từ profile (đơn giản hóa Douglas–Peucker 0.005, bán kính trừ `sg = 0.05`, 128 cạnh; thân từ z = 0.05 tới đỉnh−0.05; nắp từ cutZ−0.01) (`ug`/`dg` W:3139407/3139687). [Quan sát]
5. `body = (thân − lòng_thân) ∪ template.body`; `cap = (nắp − lòng_nắp) ∪ template.cap`. [Quan sát]
6. `decompose()`, bỏ mảnh < 0.5 mm³; mảnh chính = mảnh bao trùm bbox template và có thể tích giao lớn nhất; các mảnh còn lại = "mảnh rời" (`body-n`, `cap-n`) cho người dùng xoá; khi xuất, mảnh chưa xoá được union lại (`hg`/`yg` W:3140268/3141849). [Quan sát]
7. Rebuild debounce 400 ms sau mỗi thay đổi khi đã "Tạo" (design `If`). [Quan sát]

### 3.6 Xuất (`case bottleExport` W:3298858)
- [Quan sát] `<name>_bottle.3mf` (2 object `<name>_body`, `<name>_cap`, màu `#ffffff`, slot 1, layer 0.2/0.2), `<name>_body.stl`, `<name>_cap.stl`. Thân đặt ở x ≤ −3, nắp ở x ≥ +3, đáy z = 0. Nút "Xuất STL"/"Xuất 3MF" lọc theo đuôi (`qf` design:388264). Thumbnail: thân `#d4c4cf`, nắp `#ffcf66`.

---

## 4. `vase` — FLEX VASE (bình tham số)

### 4.1 Mục đích
[Quan sát] Bình hoa/chậu tham số hoàn toàn (không cần đầu vào), sinh mesh trong worker riêng `VW`, xuất STL (`vs.subtitle` "Tạo dáng bình. Thêm cá tính. In 3D.").

### 4.2 UI — 6 tab (`Vc=["shape","surface","sculpt","view","print","files"]` App:464761)
- **Dáng** (`vs.tab.shape`): "Mẫu bắt đầu" (6 preset có thumbnail render 240 px), "Hình dáng & kích thước": height, bottom, top, shape, silhouette, bulge, twist, wall, base, style. [Quan sát]
- **Bề mặt**: pattern; nếu ≠ none: ribs, depth, ribProfile, width, turns (+ ghi chú lattice `vs.latticeHint` "Đan chéo là gân nổi trên thành kín, không tạo lỗ xuyên"); texture; nếu ≠ smooth: textureDepth, textureScale; nếu có gân hoặc vân: start, end, fade. [Quan sát]
- **Tạo hình**: lobes (+lobeDepth nếu > 0), deform (+seed nếu > 0), flare, slant, rimWaves (+rimDepth nếu > 0). [Quan sát]
- **Xem**: Hoàn tác/Làm lại/Vừa khung, Lưới tam giác, chọn Màu. [Quan sát]
- **In**: Kích thước "Ø d × h mm", Tam giác, Ước tính vật liệu `~volume·0.00124 g PLA` (App:469664; [Suy luận] mật độ 1.24 g/cm³); detail; "Gợi ý khi in" + độ dốc thân, khoảng gân. [Quan sát]
- **Tệp**: Lưu/Mở tệp thiết kế `flex-vase.json` (≤ 100 KB, App:470549/471403), "Đặt lại mẫu Xoắn", Thư viện, Lưu/Lưu bản mới. Cuối sidebar: "STL · milimét · đặt đứng trên bàn in" + "Xuất STL" (App:471989). [Quan sát]

### 4.3 Tham số (mặc định `i` VW:231; range `[min,max,step]` `a` VW:599; enum VW:0)
| key | VI | EN | min | max | step | default | choices |
|---|---|---|---|---|---|---|---|
| height | Chiều cao (mm) | Height | 20 | 400 | 1 | 160 | |
| bottom | Đường kính đáy (mm) | Bottom diameter | 16 | 240 | 1 | 72 | |
| top | Đường kính miệng (mm) | Top diameter | 16 | 240 | 1 | 66 | |
| wall | Độ dày thành (mm) | Wall thickness | 0.6 | 8 | 0.1 | 2 | |
| base | Độ dày đáy (mm) | Base thickness | 0.8 | 12 | 0.1 | 3 | |
| shape | Tiết diện | Cross-section | | | | circle | circle Tròn, ellipse Elip, hexagon Lục giác, octagon Bát giác, rounded-square Vuông bo góc / Rounded square, star Ngôi sao, flower Hoa |
| silhouette | Dáng bình | Silhouette | | | | rounded | straight Thẳng, rounded Phồng tròn, teardrop Giọt nước, hourglass Đồng hồ cát, bottle Dáng chai, wave Lượn sóng, tulip Tulip |
| bulge | Độ phồng | Shape intensity | 0 | 1 | 0.01 | 0.28 | |
| twist | Góc xoắn (°) | Twist | −360 | 360 | 1 | 65 | |
| lobes | Số múi | Lobes | 0 | 12 | 1 | 0 | |
| lobeDepth | Độ sâu múi | Lobe intensity | 0 | 0.3 | 0.01 | 0.12 | |
| pattern | Kiểu gân | Rib pattern | | | | ribs | none Không, ribs "Gân / vây", lattice Đan chéo |
| ribs | Số gân | Rib count | 4 | 120 | 1 | 64 | |
| depth | Độ nổi gân (mm) | Rib depth | 0 | 6 | 0.1 | 2.4 | |
| width | Bề rộng gân | Rib width | 0.2 | 1 | 0.01 | 0.75 | |
| turns | Vòng xoắn gân | Helical turns | −1 | 1 | 0.01 | 0.12 | |
| ribProfile | Tiết diện gân | Rib profile | | | | round | round Tròn, sharp Nhọn, flat Phẳng |
| texture | Vân bề mặt | Texture | | | | smooth | smooth Nhẵn, waves Sóng, diamond Kim cương, dots Chấm, hammered Vân gõ |
| textureDepth | Độ sâu vân (mm) | Texture depth | 0 | 3 | 0.1 | 0.8 | |
| textureScale | Mật độ vân | Texture frequency | 2 | 30 | 1 | 12 | |
| start | Bắt đầu gân (%) | Relief starts | 0 | 90 | 1 | 3 | |
| end | Kết thúc gân (%) | Relief ends | 10 | 100 | 1 | 97 | |
| fade | Chuyển tiếp mép (%) | Edge fade | 1 | 20 | 1 | 4 | |
| deform | Nếp gấp tự nhiên | Organic folds | 0 | 0.2 | 0.01 | 0 | |
| seed | Biến thể | Variation seed | 1 | 999 | 1 | 1 | |
| flare | Độ loe miệng (mm) | Rim flare | −8 | 24 | 0.5 | 0 | |
| slant | Độ nghiêng miệng (mm) | Rim slant | 0 | 40 | 1 | 0 | |
| rimWaves | Số sóng miệng | Rim waves | 0 | 12 | 1 | 0 | |
| rimDepth | Độ sâu sóng miệng (mm) | Rim wave depth | 0 | 15 | 0.5 | 6 | |
| style | Kiểu in | Print style | | | | shell | shell "Thành rỗng", solid "Đặc để in chế độ xoắn" |
| detail | Chất lượng lưới | Mesh quality | | | | standard | standard Tiêu chuẩn, fine Chi tiết |
| color | Màu | Color | | | | #c9a785 | `#rrggbb` |
[Quan sát; nhãn từ i18n:1187–3477]

Chuẩn hóa (`u` VW:1121): làm tròn về bội số step rồi clamp; enum/màu sai → lỗi "Invalid value"; `end = max(end, start+5)`; `base = min(base, H_eff − 2)` với `H_eff = height − min(slant, 0.35h) − (rimWaves ? min(rimDepth, 0.2h) : 0)` (VW:1856). [Quan sát]

### 4.4 Preset (`pp` design:394522) — đều trộn lên mặc định [Quan sát]
- `swirl`: = mặc định.
- `lattice`: height 90, bottom 96, top 96, wall 2.4, straight, twist −90, lobes 4, lattice, ribs 56, depth 1.4, width 0.42, turns 0.16, start 14, end 93, flare 12, deform 0.08, `#6b7a4a`.
- `petal`: height 180, bottom 54, top 80, flower, tulip, twist 45, ribs 36, depth 1.5, `#c98087`.
- `minimal`: height 140, bottom 72, top 56, rounded-square, pattern none, twist 0, straight, `#e2dbcf`.
- `bottle`: height 200, bottom 70, top 40, silhouette bottle, bulge 0.55, ribs 48, depth 1.2, twist 0, turns 0, `#8197ab`.
- `bowl`: height 65, bottom 66, top 130, rounded, bulge 0.15, ribs 80, twist 45, depth 1.8, `#bf774e`.

### 4.5 Thuật toán sinh mesh (`g` VW:3783)
Ký hiệu `t ∈ [0,1]` chiều cao chuẩn hóa, `θ` góc, `S(x)` = smoothstep clamp `x²(3−2x)`.
1. **Tiết diện** `d(shape, θ)` (VW:2019): ellipse `0.72/hypot(0.72cosθ, sinθ)`; rounded-square `(cos⁴θ+sin⁴θ)^−¼`; hexagon/octagon (n = 6/8) `cos(π/n)/cos((θ mod 2π/n) − π/n)`; star `0.73+0.27cos5θ`; flower `0.87+0.13cos6θ`; circle 1. [Quan sát]
2. **Dáng** `f(t)` (VW:2372): rounded `1+b·sin πt`; teardrop `1+1.7b·sin πt·(1−t)`; hourglass `1−0.75b·sin πt`; bottle `1+b(sin πt − 0.65·S((t−0.62)/0.25))`; wave `1+0.35b·sin 4πt`; tulip `1+b(t² − 0.3 sin πt)`; straight 1. (`b` = bulge) [Quan sát]
3. **Bán kính thân** `m(t,θ)` (VW:2926): `r = (bottom + (top−bottom)t)/2 · f(t) · d(θ) · (1 + lobeDepth·cos(lobes·θ)) · (1 + deform·sin πt·(0.65 sin(3θ+7t+seed) + 0.35 cos(5θ−4t+0.7seed))) + flare·S((t−0.85)/0.15)`, tối thiểu `wall + 1.5`. [Quan sát]
4. **Gân + vân** `h(θ,t)` (VW:3203): cửa sổ `w = S((t−start%)/fade%)·S((end%−t)/fade%)`; gân `p((θ/2π − turns·t)·ribs)` với `p(u)`: `n = |frac(u)−0.5|·2/width`, n ≥ 1 → 0; sharp `1−n`; flat `S((1−n)/0.22)`; round `(1+cos πn)/2`; lattice = max với xoắn ngược `(θ/2π + turns·t)`; × depth. Vân (`l = θ·scale`, `u = 2πt·scale`): waves `(1+sin(u+sin l))/2`; diamond `max(0, 1−(|sin(l+u)|+|sin(l−u)|))`; dots `max(0, cos l·cos u)⁴`; hammered `(1+sin(l+seed)·sin(u+sin 0.7l))/2`; tổng `(gân + vân·textureDepth)·w`. [Quan sát]
5. **Miệng** `z_top(θ) = height − min(slant, 0.35h)(1+cos θ)/2 − (rimWaves ? min(rimDepth, 0.2h)(1+sin(rimWaves·θ))/2 : 0)` (VW:4224). [Quan sát]
6. **Lưới**: số cột `N = clamp(ceil(R·(fine?12:8)/4)·4, fine?192:128, fine?960:640)` với `R = max(pattern≠none ? ribs : 0, texture≠smooth ? 2·textureScale : 0)`; làm tròn bội 6/8 cho hexagon/octagon; số hàng `M = clamp(ceil(|turns|·R·10), fine?160:96, fine?360:220)` (VW:4060). Đỉnh ngoài: góc `θ + twist°·t`, bán kính `m + h`, z = `t·z_top(θ)` (VW:4567). [Quan sát]
7. **Shell**: mặt trong bán kính `m(t',θ) − wall` (không có gân/vân) từ z = base tới miệng, nối mép miệng ngoài–trong; nắp đáy (fan) ở z = 0 và sàn trong ở z = base (VW:4618, VW:4991). **Solid**: một mặt + nắp trên ở z = height (để in chế độ spiral/vase). [Quan sát]
8. **Thống kê**: thể tích (tích vô hướng tam giác/6), đường kính = 2·max bán kính, `overhang` = max `atan2(|Δr|, Δz)` giữa các hàng của thân trơn (VW:4746), `pitch = 2π·min(r_thân)/ribs` (VW:5454). [Quan sát]
9. Debounce 120 ms (design:396327); lịch sử undo 40 bước, gộp thay đổi trong 450 ms (design:396571). [Quan sát]

### 4.6 Cảnh báo (App:465512) [Quan sát]
- `overhang > 45°` → `vs.overhangWarning` "Độ dốc thân đạt {n}°…".
- `pitch < 1.6 mm` → `vs.pitchWarning` (đầu phun 0.4 mm có thể dính gân).
- `wall < 1.2 mm` → `vs.wallWarning`.
- `style = solid` → `vs.solidHint`. Không có cảnh báo → `vs.sliceHint`. `vs.checkHint`: ước tính cho thân trơn, thành tính theo bán kính.

### 4.7 Đầu ra
- [Quan sát] `flex-vase.stl` (STL nhị phân, header `FLEX VASE / Flex Hub`, mm, đứng trên bàn) (`Op` design:397249, `Es` design:7062). Qua `claimExport` (design:397534).
- [Quan sát] File thiết kế `flex-vase.json` = `{"kind":"flex-vase","version":1,"params":{…}}` (pretty JSON); khi mở kiểm `kind`/`version` rồi chuẩn hóa lại tham số (`mp`/`hp` design:395279/395424).

---

## 5. `leather` — Rập da (SVG → file laser cắt da có lỗ may)

### 5.1 Mục đích / đầu vào
[Quan sát] Nhập file SVG (hoặc "Mẫu con mèo" `xv` store:437379, 120×140 mm, 7 phần Body/Face/Left eye/Right eye/Nose/Whiskers/Heart), tạo các miếng da, thêm đường lỗ may (stitch holes) và xuất file laser DXF + SVG (`lt.title` "Biến SVG thành rập da").

### 5.2 Đọc SVG (`$e` store:14421) [Quan sát]
- Parser XML tự viết; hỗ trợ `path` (M/L/H/V/C/S/Q/T/A/Z), `rect` (kể cả rx/ry), `circle`, `ellipse`, `line`, `polyline`, `polygon`; CSS `<style>` (selector `.class`, `#id`, tag), `style=`, `transform` (matrix/translate/scale/rotate/skewX/skewY); bỏ qua `display:none`/`visibility:hidden`.
- Bỏ qua (cảnh báo `lt.skipped` "Không nhập: {list}"): `text`, `image`, `use`, `foreignObject`; bỏ im lặng `defs, clipPath, mask, symbol, pattern, gradient, marker, style, script, filter…`.
- Đơn vị (`Re` store:9209): mm 1, cm 10, in 25.4, pt 25.4/72, pc 25.4/6, px/không đơn vị 25.4/96 (96 dpi); viewBox + width/height → scale đồng đều = min(sx, sy).
- Làm phẳng đường cong theo dung sai dây cung 0.4 mm: số đoạn = clamp(ceil(len·scale/0.4), 4, 400); ellipse ≥ 24 điểm.
- Mỗi phần tử → 1 "miếng"; đa giác kín lồng nhau phân theo độ sâu chẵn/lẻ (`Ye` store:13697): vòng ngoài + các lỗ khoét; nhiều vòng ngoài → tách "name 1, name 2…". Đường hở → nhóm "lines". Tên = `inkscape:label` / `data-name` / `id` / `"<tag> n"`. Màu = fill, hoặc stroke, hoặc `#9a8a94` (`Qe` store:14270).
- Miếng có vòng kín → vai trò mặc định `cut`; chỉ có đường hở → `engrave` (`Fv` store:439536).

### 5.3 UI (App:485600–492000)
- **Miếng da ({n})**: danh sách (màu, tên, số đường may), select **Laser**: Cắt / Khắc / Bỏ qua (`cut` chỉ khi có vòng kín); chọn nhiều → Nhân bản / Xóa {n}. [Quan sát]
- Miếng đang chọn: **Rộng (mm)**, **Cao (mm)** (đổi scale đồng đều), **Xoay (°)** step 15 (App:487043); Lật (mirror); Nhân bản; **Tạo mặt sau** (`lt.backTip` App:487668); Xóa. [Quan sát]
- **Đường may** (chỉ miếng `cut`): "+ Cả viền", "+ Một cạnh" (click 2 điểm trên viền), "+ Lỗ khoét {n}" cho từng vòng trong; danh sách run "Viền/Cạnh/Lỗ khoét · {n} lỗ", ⟷ tên miếng nối, ✎ nếu đã sửa tay. [Quan sát]
- Run đang chọn: nếu đang **may với** miếng khác: "May với {name}", Đảo chiều, ◀ ▶ dịch pha ±0.005 chu vi, Bỏ liên kết. Nếu không: **Đục** (nút preset bước) + Khoảng cách (mm) 1.5–10 step 0.05 (App:490057); **Lỗ** Tròn/Thoi/Khe; Cỡ lỗ (mm) 0.4–5 step 0.1 (App:490394); Cách mép (mm) 0–20 step 0.5 (App:490495); Lỗ ở mỗi góc (App:490683); "{n} lỗ"; Khớp với… (⟷); Sửa lỗ (kéo, Delete, nhấp đúp thêm); Đặt lại lỗ; Phía kia (đổi cung giữa 2 điểm). [Quan sát]
- Khác: "Xếp gọn" (`lt.arrange`), bật/tắt lớp hiển thị Cắt/Lỗ may/Khắc (`layers`), thanh trạng thái "{w} × {h} mm · {n} lỗ", nút "Xuất DXF". [Quan sát] [Suy luận] Bộ lọc `layers` chỉ ảnh hưởng hiển thị — `Qc` không truyền `layers` vào hàm xuất (App:481223).

### 5.4 Tham số đường may (`ae` store:597, preset bước `oe` store:652)
| key | VI | EN | min | max | step | default | choices |
|---|---|---|---|---|---|---|---|
| pitch | Khoảng cách (mm) / Đục | Spacing (mm) / Iron | 1.5 | 10 | 0.05 | 4 | nút preset 2.7, 3, 3.38, 3.85, 4, 5, 6 |
| shape | Lỗ | Hole | | | | round | round Tròn, diamond Thoi, slit Khe |
| size | Cỡ lỗ (mm) | Hole size (mm) | 0.4 | 5 | 0.1 | 1.2 | |
| inset | Cách mép (mm) | From edge (mm) | 0 | 20 | 0.5 | 3 | |
| corners | Lỗ ở mỗi góc | Hole on every corner | | | | true | bool |
Miếng: `role` cut/engrave/off; `x,y,rot,scale,mirror`. Thiết lập lần cuối (`lastSet`) được dùng cho run mới. [Quan sát]

### 5.5 Thuật toán lỗ may
1. **Đường tâm lỗ** (`dt` store:16796): offset vòng vào trong `inset` mm bằng `CrossSection.offset(−inset, Round)` (manifold), số đoạn cung `clamp(ceil(2π·inset/0.3), 16, 256)`; chọn đa giác kết quả có khoảng cách trung bình tới vòng gốc ≈ inset (sai số < 0.5·inset), giữ chiều quay, xoay điểm đầu theo điểm đầu vòng gốc. Run "một cạnh" = đoạn từ `from` đến `to` (tham số chu vi 0–1) chiếu lên đường offset. [Quan sát]
2. **Phát hiện góc** (`me` store:3182): tại mỗi đỉnh so hướng tiếp tuyến trong cửa sổ 0.6 mm; góc đổi ≥ 40° → góc; gộp cụm trong 0.6 mm lấy điểm gắt nhất. Với vòng kín, bắt đầu đường tại góc đầu tiên. [Quan sát]
3. **Chia đoạn** (`ve` store:4185): mốc = 0, các góc (bỏ góc cách mốc trước/cuối < 0.6·pitch), cuối. Mỗi đoạn: thử số lỗ `n ∈ [round(L/pitch) ± 2]`, với mỗi n tìm bước dây cung `p` sao cho bước đúng n lần (giao đường tròn bán kính p với polyline) tới đúng cuối đoạn — nhị phân 60 vòng, sai số 1e−4, khoảng tìm [0.4, 1.05]·(L/n) (mở rộng 0.7×/1.15× nếu cần) (`fe`/`pe` store:2612/2931); chọn n có |p − pitch|/pitch nhỏ nhất; nếu không giải được → bước đều đúng `pitch`. ⇒ **khoảng cách dây cung đều giữa các lỗ, có lỗ đúng tại mỗi góc**. Hướng lỗ = tiếp tuyến trong cửa sổ min(pitch/2, 1.5). [Quan sát]
4. **Hình lỗ** (`Ce` store:6235): round → circle Ø`size`; diamond → hình thoi dài `size`, rộng `0.4·size`, xoay tiếp tuyến **+45°** (−45° cho miếng mặt sau/mirror, kiểu lưỡi đục pricking iron); slit → chữ nhật dài `size`, rộng `max(0.2, 0.18·size)`, cùng góc 45°. [Quan sát]
5. **Khớp với miếng khác / Mặt sau** (`Se` store:5467, `py` store:444741): lấy 96 mẫu đều theo chu vi trên cả hai đường, thử đảo chiều × dịch pha (2·96 bước + golden-section 40 vòng), có/không lật gương, cực tiểu sai số Procrustes (căn tâm + quay); chọn mirror nếu sai số ≤ không-mirror + 0.002. Run "follow" lấy **cùng số lỗ**, vị trí theo cùng tỉ lệ chu vi của miếng gốc (`ye`/`be`), nên lỗ thẳng hàng khi may úp mặt. "Tạo mặt sau" = bản sao `mirror` đặt cách +10 mm, mọi run follow bản gốc. Sửa tay lỗ → lưu `holes` cố định và cắt liên kết follow. [Quan sát]
6. **Xếp gọn** (`ht` store:18268, `Jv` store:442118): shelf packing — sắp miếng (bỏ `off`) theo chiều cao giảm dần, xếp hàng rộng tối đa **300 mm**, khe **6 mm**. Nhân bản dịch +8 mm theo X; ghép SVG thêm vào cách 15 mm bên phải. [Quan sát]
7. Undo/redo 100 bước (`past.slice(-99)`). [Quan sát]

### 5.6 Xuất (`xs`/`ws`/`Ts` design:4393/5273/6243; `Qc` App:481223)
- [Quan sát] Thực thể: miếng `cut` → vòng kín lớp **CUT**; miếng `engrave` → vòng kín lớp **ENGRAVE**; đường hở luôn **ENGRAVE**; lỗ may (chỉ miếng `cut`) lớp **STITCH** (circle hoặc polyline kín). Miếng `off` bỏ qua.
- [Quan sát] Lớp/màu (`bs` design:4250): CUT `#ff0000` ACI 1; STITCH `#0000ff` ACI 5; ENGRAVE `#00e000` ACI 3.
- [Quan sát] DXF: R12 (`$ACADVER AC1009`), `$INSUNITS 4` (mm), `$MEASUREMENT 1`, bảng LAYER 3 lớp CONTINUOUS, thực thể `CIRCLE` / `POLYLINE`+`VERTEX`+`SEQEND`, gốc dời về (0,0), trục Y lật (DXF Y-up), số 4 chữ số thập phân, xuống dòng CRLF.
- [Quan sát] SVG: kích thước `width/height` theo mm, viewBox = mm, 3 `<g>` kiểu layer Inkscape (`inkscape:groupmode="layer"`, label Cut/Stitch holes/Engrave), `fill="none"`, `stroke-width="0.1"`.
- [Quan sát] Tên tệp: `<tên SVG bỏ đuôi>-laser.dxf` và `<…>-laser.svg` (mặc định `leather`). Nút "Xuất DXF" trong app desktop ghi vào thư mục chọn sau khi gọi hàm cổng xuất ([Suy luận] `Pa()` = claimExport); bản web tải về trực tiếp.

---

## 6. Giới hạn / cảnh báo tổng hợp
- Timetable: thiếu glyph phông → `tt.missing`; ngày 1–7, sáng/chiều 0–8 mỗi buổi; trang trí khác chế độ máy in → cảnh báo. [Quan sát]
- Flexi: cutter không cắt đứt → `fx.missed`; mô hình ngoài [30, 300] mm tự phóng về 100 mm. [Quan sát]
- Bottle: chỉ nhận mô hình kín (tự sửa); mảnh rời < 0.5 mm³ bị bỏ, mảnh lớn hơn phải xử lý thủ công. Kích thước lòng chai cố định (Ø40 × 90.5 mm, ren ~3 mm) — không có tham số đổi cỡ chai. [Quan sát]
- Vase: cảnh báo overhang > 45°, khoảng gân < 1.6 mm, thành < 1.2 mm; JSON > 100 KB bị từ chối. [Quan sát]
- Leather: chỉ SVG; text/image/use không nhập. [Quan sát]
- Mọi tool: giới hạn xuất theo ngày + khóa Pro do server cấu hình. [Quan sát cơ chế; danh sách cụ thể Chưa rõ]
