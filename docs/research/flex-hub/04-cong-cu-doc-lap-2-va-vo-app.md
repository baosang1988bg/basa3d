# Flex Hub v0.2.24 — Ghi chú phần 2: 5 công cụ độc lập + vỏ ứng dụng

Phạm vi: `kitcard`, `colorsplit`, `split3mf`, `library`, `creative` và app shell (hub, tab, tài khoản/gói, updater, Rust↔JS, endpoint, lưu trữ, định dạng nhập).

**Quy ước bằng chứng**
- `file:N` = vị trí **ký tự** (Python `str` index, không phải byte) trong `flexhub-web/assets/<file>`. Tên file viết tắt: `App`=App-CXT8Oy65.js, `W`=worker-Cc0bSqjO.js, `P`=pipeline-DVPZCkNy.js, `KS`=store-OCIqCn_s.js (store kitcard + split3mf), `SG`=store-SGyaWieW.js, `ACC`=store-UjNBdwk8.js, `D`=design-mDRcZtB5.js, `TT`=TimetableScreen-BkPntagu.js, `C`=common-BI3l0mmp.js, `IDX`=index-y6KblS8r.js, `G`=Gate-BREEksXS.js, `i18n`=i18n-EFUBxO61.js.
- Khoá i18n trích dạng `key@enOff/viOff` (offset trong `i18n`).
- `binary:strings` = chuỗi lấy bằng `strings -n 6` trên `img2print-desktop-arm64` (không chạy binary).
- Nhãn: **[Quan sát]** đọc trực tiếp trong code/chuỗi; **[Suy luận]** rút ra từ code nhưng chưa thấy toàn bộ; **[Chưa rõ]** không xác minh được.

---

## 0. Kiến trúc chung của 5 công cụ

- Danh sách tool (thứ tự cũng là thứ tự tile trên hub): `picture, clicker, croc, lightbox, penholder, bracelet, jar, toolbox, keycap, tray, notebook, bookmark, foldbox, layerframe, clock, poptext, thermoform, canopener, backpack, flexi, bottle, vase, colorsplit, split3mf, leather, kitcard, timetable, library, creative`. 5 tool trong phạm vi có `templates:[]` (không dùng luồng ảnh→màu→thiết kế). **[Quan sát]** `C:13389`
- Router màn hình: `tool===colorsplit → "groups"` (component `KL`), `split3mf → sR`, `kitcard → mj`, `library → to` (từ TT), `creative → ej`; `tool===null → hub`. **[Quan sát]** `App:1129128`
- Hình học nặng chạy trong **Web Worker** `worker-Cc0bSqjO.js` (manifold-3d WASM `manifold-BE4c7gO-.wasm`), gọi qua RPC `postMessage({op,...})` với "lane" (main/shapes). **[Quan sát]** `P:2471146` (`jf` tạo Worker), danh sách op `P:2473211…2475580`.
- Lưu file ra đĩa: Rust command `write_export_file` (bytes trong body, header `x-dir`,`x-name`), chọn thư mục bằng `plugin:dialog|open {directory:true}`. **[Quan sát]** `P:2468400–2471100`
- Mọi nút "Export files…" của 3 tool hình học đều gọi `claimExport()` trước khi ghi (đếm lượt xuất/ngày). **[Quan sát]** kitcard `KS:3875` (`await g()`), split3mf `KS:10391`, colorsplit `App:1009524` (`await Pa()`); `claimExport` định nghĩa `ACC:1494`.
- Tên file cơ sở được làm sạch: `NS=(e,t)=>e.replace(/[^\p{L}\p{N}_-]+/gu,'_')||t`. **[Quan sát]** `W:3292228`
- Nhập mô hình 3D (kitcard, colorsplit): STL (nhị phân nếu `size==84+n*50`, ngược lại ASCII), OBJ (`v`/`f`), 3MF. **[Quan sát]** `W:2678255`. Hàn đỉnh theo lưới `1e-4`, loại tam giác suy biến, yêu cầu manifold kín, nếu không → lỗi `not a closed solid`. **[Quan sát]** `W:2681201`. Tự co giãn: nếu cạnh lớn nhất ∉ [30, 300] mm → scale về **100 mm** (hiển thị "Scaled ×{k} on import", `fx.imported@16601/57004`). **[Quan sát]** `W:2681850` (`Bh=[30,300]`, `r=100/n`)

---

## 1. `kitcard` — Thẻ lắp ráp (Kit card)

### 1.1 Mục đích
Biến mô hình 3D thành bộ chi tiết phẳng cắt laser kiểu "egg-crate" (các lát X/Y xẻ rãnh ăn khớp), xếp lên thẻ/khổ tấm có khung + cầu nối giữ chi tiết, kèm chữ/logo, xuất SVG + DXF. **[Quan sát]** `kc.title@24760` "Turn a 3D model into a / kit card"; xuất `W:3296198`.

### 1.2 Đầu vào
- Mô hình: `.stl,.obj,.3mf` (`lj`), dự án `.json` (`uj`), logo `.svg,.png,.jpg,.jpeg,.webp` (`dj`). **[Quan sát]** `App:908808`
- Mẫu "Sample duck" (`kc.sample@24820`): vịt dựng bằng hợp 4 ellipsoid (sphere 72 seg scale [48,32,26], [18,14,14], [1,1,1]·19, [13,9,4]). **[Quan sát]** `W:3261445`
- Kéo-thả file `.json` = mở dự án, file khác = mô hình. **[Quan sát]** `App:909047`

### 1.3 UI
- Thanh xem: `kc.view` = Model / Assembled / Card (mặc định `card`); chọn thẻ khi >1 thẻ; nút "Reset layout" khi đã kéo chi tiết. **[Quan sát]** `App:909047`, default `view:'card'` `KS:1099`
- 3 tab: `parts` (Chi tiết), `card` (Thẻ), `decor` (Chữ & logo). **[Quan sát]** `fj` `App:908808`; i18n `kc.tab.parts@26131`, `kc.tab.card@26154`, `kc.tab.decor@26175`
- Checkbox "Advanced settings" (`g.des.advanced`) ẩn/hiện tham số nâng cao. **[Quan sát]** `App:909047`
- Cảnh báo (`pj`): noCross / loose / tiny / tooBig / unheld / overlap. **[Quan sát]** `App:908808`, i18n `kc.warn.*@25958…26204`
- Tóm tắt: "{n} parts · {c} card(s) · {w} × {h} mm". **[Quan sát]** `kc.summary@25904`
- Hành động: Save project / Open project / Export files…. **[Quan sát]** `App:918047+`

### 1.4 Tham số (mặc định ở `KS:380–1099`, slider ở `App:912927–918354`) **[Quan sát]**

| key | VI | EN | min | max | step | default | ghi chú |
|---|---|---|---|---|---|---|---|
| turn[x,y,z] | Xoay | Turn | — | — | 90° | [0,0,0] | nút X/Y/Z 90° |
| sizePct | Kích thước (%) | Size (%) | 20 | 400 | 5 | 100 | `fx.size` |
| slices.nx | Lát X | X slices | 1 | 30 | 1 | 5 | |
| slices.ny | Lát Y | Y slices | 1 | 30 | 1 | 4 | |
| material | Vật liệu | Material | — | — | — | plywood3 | bảng dưới + `custom` |
| slices.thicknessMm | Độ dày (mm) | Thickness (mm) | 0.5 | 12 | 0.1 | 3 | đổi → material=custom |
| slices.rotateDeg (adv) | Xoay lưới (°) | Grid turn (°) | 0 | 90 | 5 | 0 | |
| slices.ratio (adv) | Chia rãnh (%) | Slot split (%) | 10 | 90 | 5 | 50 | engine kẹp 0.05–0.95 |
| slices.slotFitMm (adv) | Độ hở rãnh (mm) | Slot fit (mm) | −0.5 | 1 | 0.05 | 0.1 (theo vật liệu) | |
| kerfOn (adv) | Bù đường cắt | Kerf compensation | — | — | — | false | tip: tắt nếu phần mềm laser tự bù |
| kerfMm (adv) | Đường cắt (mm) | Kerf (mm) | 0 | 1 | 0.01 | 0.15 (theo vật liệu) | |
| card.on | Khung và cầu nối | Frame and bridges | — | — | — | true | |
| sheet preset | Khổ tấm | Sheet | — | — | — | — | A4 297×210, A3 420×297, 300×200, 400×300, 400×400, 600×400, custom (`KS:883`) |
| card.widthMm | Rộng (mm) | Width (mm) | 60 | 1000 | 5 | 200 | |
| card.heightMm | Cao (mm) | Height (mm) | 60 | 1000 | 5 | 0 = "Auto height" | |
| card.labels | Tên chi tiết | Part names | — | — | — | true | |
| card.gapMm (adv) | Khoảng cách (mm) | Gap (mm) | 0.5 | 20 | 0.5 | 3 | engine `max(0.5,gap)` |
| card.frameMm (adv, on) | Khung (mm) | Frame (mm) | 2 | 30 | 0.5 | 6 | |
| card.cornerMm (adv, on) | Bo góc (mm) | Corner (mm) | 0 | 30 | 0.5 | 4 | |
| card.bridgeMm (adv, on) | Rộng cầu nối (mm) | Bridge width (mm) | 0.3 | 5 | 0.1 | 1 | |
| card.bridges (adv, on) | Cầu nối mỗi chi tiết | Bridges per part | 1 | 6 | 1 | 2 | |
| card.labelMm (adv) | Cỡ tên (mm) | Name size (mm) | 1.5 | 10 | 0.5 | 3 | |
| message.text | Lời nhắn | Message | — | — | — | "" | chỉ khi card.on |
| message.font | Phông chữ | Font | — | — | — | bundled `be-vietnam-pro` | |
| message.sizeMm | Cỡ (mm) | Size (mm) | 2 | 30 | 0.5 | 5 | |
| message.place | Vị trí | Place | — | — | — | strip | frame / strip |
| logo | Logo | Logo | — | — | — | null | Load / Remove |
| logo.sizeMm | Chiều cao (mm) | Height (mm) | 3 | 100 | 0.5 | 15 | |
| logo.place | Vị trí | Place | — | — | — | strip | frame / strip / free (frame,strip disabled khi card.on=false) |
| logo.style | Kiểu | Style | — | — | — | engrave | engrave (Khắc) / cut (Cắt) |

Vật liệu preset (`KS:612`) **[Quan sát]**:

| id | VI/EN | thickness | slotFit | kerf |
|---|---|---|---|---|
| plywood3 | Ván ép 3 mm / Plywood 3 mm | 3 | 0.10 | 0.15 |
| plywood4 | Ván ép 4 mm | 4 | 0.10 | 0.15 |
| mdf3 | MDF 3 mm | 3 | 0.05 | 0.15 |
| acrylic3 | Mica 3 mm / Acrylic 3 mm | 3 | 0.00 | 0.12 |
| cardboard2 | Bìa cứng 2 mm / Cardboard 2 mm | 2 | 0.20 | 0.10 |

### 1.5 Thuật toán
**Chuẩn bị mô hình** — ma trận = Euler(turn, XYZ) × scale(sizePct/100); sau transform, căn giữa XY và đặt đáy Z=0. **[Quan sát]** `KS:1099+` (`ce`), `W:2682268` (`Uh`)

**Rebuild debounce** — mỗi thay đổi: build "quick" sau 20 ms, build "full" sau 450 ms; đổi turn/size/slices thì xoá các dịch chuyển tay (`moves`). **[Quan sát]** `KS:1828`

**Cắt lát (`Zb`)** **[Quan sát]** `W:3259131–3261299`
1. Lưới mặt phẳng dọc: họ X có pháp tuyến `(cosθ, sinθ, 0)`, họ Y `(−sinθ, cosθ, 0)` với θ=rotateDeg. Với n lát, vị trí lát thứ i = `min + (max−min)·(i+0.5)/n` theo hình chiếu đỉnh lên pháp tuyến (`Xb`).
2. Mỗi lát = thiết diện của solid tại mặt phẳng đó, `simplify(0.01)`.
3. Với mỗi cặp (X_i, Y_j): tính đường giao; lấy các đoạn thẳng đứng mà **cả hai** lát cùng có vật liệu (giao khoảng, chỉ giữ đoạn > 0.5 mm).
4. Với mỗi đoạn [s, c] (đáy, đỉnh): độ rộng rãnh `w = thickness + slotFit`; điểm chia `o = c − ratio·(c − s)`. Lát X nhận rãnh từ `o` lên `c + 1 + w` (xẻ từ trên xuống); lát Y nhận rãnh từ `s − 1 − w` lên `o` (xẻ từ dưới lên). Đây là mối ghép ngàm chéo (halving joint).
5. Trừ rãnh, tách thành mảnh rời, sắp theo diện tích, bỏ mảnh < 2 mm². Tên: `X-1`, `Y-3`, có hậu tố `a,b,…` nếu một lát vỡ thành nhiều mảnh.
6. Cảnh báo: `noCross` (lát không giao lát nào), `loose` (mảnh không chạm rãnh nào — thử bằng offset 0.05 giao rãnh), `tiny` (mọi mảnh < 2 mm²).
7. Xem 3D: mỗi chi tiết đùn dày `thickness`, căn giữa, đưa về vị trí thật (`Qb`).

**Xếp lên thẻ (`wx` + `sx`)** **[Quan sát]** `W:3261725–3276066`
- Lề: `frame = on ? frameMm : 0`; `gap = max(0.5, gapMm)`; dải dưới ("strip") cao `max(frame, h_chữ/logo + 2·1.5)`; lề trên/bên `d = frame + gap`, lề dưới `f = strip + gap`; vùng dùng được `W − 2d` × (`H − d − f` nếu có chiều cao cố định; auto-height = không giới hạn ⇒ 1 thẻ). `xx=1.5` `W:3269127`.
- Mỗi chi tiết thử nhiều tư thế: góc khởi điểm = góc có bbox nhỏ nhất (quét 0–87°, bước 3°, `dx`), rồi xoay mỗi **15°** (full) hoặc **45°** (quick), có/không **lật gương**; loại tư thế không vừa vùng dùng được → cảnh báo `tooBig`.
- Bộ xếp raster: ô lưới **0.5 mm** (full) / **1 mm** (quick); biên nở `gap/2 + cell·0.7072 + 0.02`; thuật toán bottom-left (tìm vị trí thấp nhất, trượt trái/xuống), mở thẻ mới khi đầy (chỉ khi có chiều cao cố định). Thứ tự thử: theo diện tích giảm dần, theo kích thước giảm dần, rồi 16 lần hoán đổi ngẫu nhiên (PRNG seed 1234567), ngân sách **600 ms** (quick: 0). Điểm = `(số thẻ−1)·1e6 + đáy thẻ cuối`. `W:3264420`
- Nội dung căn giữa ngang trong vùng dùng được; kéo tay chi tiết (`moves`) → kẹp trong lề, kiểm tra chồng lấn (`overlap`).
- **Khung**: chữ nhật bo góc ngoài (corner) trừ chữ nhật trong (corner − frame), EvenOdd. Bo góc = 4 cung × 8 đoạn (`px`).
- **Cầu nối** (`gx`, `_x`): rộng `c = max(0.3, bridgeMm)`; dò mép ngoài lớn nhất của chi tiết mỗi **1.5 mm**, cần đoạn mép gần thẳng (lệch ≤ 0.25 mm trong ±(c/2+0.3)), cách rãnh ≥ c/2+1; chiếu 3 tia (tâm và ±c/2) theo pháp tuyến ra ngoài, phải cùng chạm một chủ (chi tiết khác hoặc khung) trong tầm `gap·2.5+1`. Chọn tham lam tối đa `bridges` cầu/chi tiết, điểm = `min(khoảng cách tới cầu đã chọn, 0.6·đường chéo) − 0.8·độ dài + 0.5 (nếu nối khung)`, khoảng cách tối thiểu giữa cầu `4c`. Sau đó union-find đảm bảo mọi chi tiết nối về khung, thêm cầu ngắn nhất giữa các cụm; không nối được → `unheld`. Cầu ăn sâu 0.3 mm vào hai bên.
- **Chữ/logo dải dưới** (chỉ thẻ đầu): co theo chiều cao dải, cách nhau 4 mm, căn giữa; logo `cut` thì khoét khỏi vật liệu, còn lại khắc.
- **Logo "free"** thành một chi tiết riêng id `logo`: style engrave → tấm chữ nhật bo 2 mm, lề 2 mm quanh logo và logo khắc; style cut → offset 1 mm (nhiều mảnh thì lấy bao lồi). `W:3269172`
- **Nhãn tên chi tiết**: khắc id (`X-1`…) cỡ `labelMm`, đặt ở chỗ rộng nhất gần tâm của chi tiết đã co vào `h/2+0.6` (quét ngang bước 0.5 mm). `vx` `W:3268422`
- **Kerf**: toàn bộ đường CẮT offset ra ngoài `kerf/2` (Miter, limit 2). Kerf chỉ áp khi `kerfOn`. `W:3269633+`, `KS:1828+`

**Logo raster → vector** (`Dx`): nếu ảnh có pixel alpha < 250 → lấy alpha ≥ 128; không thì lấy pixel có độ sáng `0.299R+0.587G+0.114B < 128`; giảm mẫu để cạnh dài ≤ 400 ô; ghép các run ngang thành đa giác, union, `simplify(0.25)`, chuẩn hoá chiều cao = 1. Logo SVG: parse với dung sai 0.2. **[Quan sát]** `W:3276066`, `W:3276305`

### 1.6 Đầu ra **[Quan sát]**
- Mỗi thẻ → 2 file: `<base>_card.svg` + `<base>_card.dxf`; nhiều thẻ → `<base>_card-<n>.svg/.dxf`. `base` = tên mô hình bỏ đuôi (mặc định `kit`). `W:3296198`, `KS:3875`
- Lớp: **CUT** đỏ `#ff0000` (ACI 1), **ENGRAVE** xanh lá `#00e000` (ACI 3) (bảng có thêm STITCH xanh dương `#0000ff` ACI 5 dùng cho rập da). `W:355619`
- SVG: đơn vị mm (`width="…mm"`, viewBox mm), mỗi lớp là `<g inkscape:groupmode="layer">`, `fill="none"`, `stroke-width="0.1"`, path `M…L…Z`. `W:357146`
- DXF: R12 (`$ACADVER AC1009`), `$INSUNITS 4` (mm), bảng LAYER, thực thể `POLYLINE/VERTEX/SEQEND` (đường tròn → `CIRCLE`), CRLF; gốc toạ độ dịch về (0,0), trục Y lật theo chiều cao thẻ. `W:356176`, `W:3276820`

### 1.7 File dự án `*.kitcard.json` **[Quan sát]** `KS:4582–4885`
```json
{ "kind":"img2print-kitcard", "version":1,
  "model": {"name":"…","data":"<base64 bytes>"} | null,
  "logo":  {"name":"…","data":"<base64>"} | null,
  "settings": { "turn":[..], "sizePct":100, "material":"plywood3", "kerfOn":false, "kerfMm":0.15,
                "slices":{…}, "card":{…}, "logo":{…}, "moves":{ "<partId>":[x,y] },
                "message":{ "text":"", "sizeMm":5, "place":"strip",
                            "font":{"kind":"bundled","id":"be-vietnam-pro"} | {"kind":"file","name","data":"<base64>"} } } }
```
Mở dự án: kiểm tra `kind`, nạp lại mô hình/logo từ base64, merge settings với default. Lưu qua `plugin:dialog|save` (filter "Kit card" `.json`) + `write_export_file`. Bản web (không Tauri): tải xuống qua `<a download>`.

---

## 2. `colorsplit` — Tách và cắt (Split and cut)

### 2.1 Mục đích
Cắt một mô hình 3D thành nhiều phần in riêng (đường cắt thẳng/tự do/đa giác/vòng), thêm chốt nối (pin/key/nam châm), xem lắp ráp/tách rời, xuất 3MF nhiều phần (giữ màu sơn) + STL từng phần. Tên tool `tool.colorsplit@18889/59064` "Split and cut / Tách và cắt"; tiêu đề màn hình bắt đầu `gr.title@21118` "Split a 3D model". **[Quan sát]**

### 2.2 Đầu vào
`.stl,.obj,.3mf` (`WL`) + nút "Sample" (mô hình hình nhân dựng từ hộp 30×20×40, đầu cầu r14, 2 chân trụ, 2 tay, 2 tai, `refine(2)`). **[Quan sát]** `App:1046985`, `W:2685018`
Sau nạp: solid được remesh `refineToLength(max(maxDim/150, √(area/77940)))` để tam giác đều cho công cụ vẽ/cắt. **[Quan sát]** `W:2685492`
Chế độ thứ 2: khi mở từ `flexi` (`source==='flexi'`) thì hiện bộ sửa nhóm màu (tabs groups/colors/split) — nằm ngoài phạm vi chính. **[Quan sát]** `App:1047367`

### 2.3 UI (chế độ độc lập, `source==='file'`) **[Quan sát]**
- Thanh trên (`UL` `App:1044755`): Assembled / Exploded (+ slider Distance), See-through (x-ray), Paint colors (khi >1 phần), Undo (Ctrl+Z) / Redo (Ctrl+Shift+Z/Ctrl+Y).
- Dock dưới (`jL` `App:1032129`): 4 kiểu nét cắt `straight` (Thẳng), `freehand` (Tự do), `polygon` (Đa giác), `loop` (Vòng = method `loopcut`; 3 kiểu kia = method `splitcut`).
- Panel phải (`BL` `App:1042123`): tab `Parts ({n})` (danh sách phần: màu, đổi tên, ẩn/hiện, chọn phần để cắt) và tab `Cut` (chỉ bật khi có lát cắt chờ xác nhận) chứa preview + chốt nối (`RL`).
- Nút: "Bambu Studio ↗" và "Export files…". Phím: Enter = áp dụng/đóng vòng, Esc/Backspace…

### 2.4 Tham số (store `$` mặc định `App:996237`; slider `App:1033…1046…`) **[Quan sát]**

| key | VI | EN | min | max | step | default | ghi chú |
|---|---|---|---|---|---|---|---|
| lineMode | Nét | Line | — | — | — | straight | straight/freehand/polygon (+loop) |
| polyCurve | Đường | Lines | — | — | — | false | Thẳng / Cong |
| polyAction | Thao tác | Action | — | — | — | cut | Cắt / Đùn (extrude: đa giác kín thành mảnh riêng) |
| extrudeMm | Độ sâu (mm) | Depth (mm) | 0.2 | 40 | 0.2 | 2 | khi extrude |
| extrudeScale | Tỉ lệ đầu xa (%) | Scale far end (%) | 20 | 150 | 5 | 100 | |
| loopMode | Cách đặt | Placement | — | — | — | ring | manual (Đặt điểm) / ring (Vòng tự động) |
| loopAxis | Hướng vòng | Ring faces | — | — | — | z | x/y/z |
| loopSnap | Bám cạnh | Snap to edge | — | — | — | false | |
| loopAngle | Góc cạnh (°) | Crease angle (°) | 5 | 80 | 1 | 35 | khi snap |
| loopCount | Số điểm | Dot count | 3 | 24 | 1 | 5 | |
| connKind | Chốt nối | Connector | — | — | — | standard | none / standard / magnet |
| standard | — | — | — | — | — | pin5 | pin3 Ø3×6, pin4 Ø4×8, pin5 Ø5×10, pin6 Ø6×12, pin8 Ø8×16, key5 5×10 (vuông), key8 8×14 (`P:2468084`) |
| magnet | — | — | — | — | — | mag6x2 | mag3x2, 4x2, 5x2, 6x2, 6x3, 8x2, 8x3, 10x2, 10x3, 12x3 (d×h mm) |
| clearanceMm | Khe hở (mm) | Clearance (mm) | 0 | 0.8 | 0.05 | 0.2 | |
| connMode | Kiểu chốt | Connector mode | — | — | — | integrated | integrated (Liền) / separate (Rời) — chỉ standard |
| conns[i].on / flip / turnDeg | Mối nối n / Đổi chiều / Xoay (°) | Joint n / Flip / Turn (°) | −180 | 180 | 5 | — | turn chỉ cho key vuông |
| view | — | — | — | — | — | exploded | assembled / exploded |
| explodeMm | Khoảng cách (mm) | Distance (mm) | 0 | 200 | 2 | 20 | |
| colors | — | — | — | — | — | paint | parts / paint |

- Thành tối thiểu quanh chốt: `pf=0.8` mm (thông báo "it needs {w} mm of material" với w=0.8; có gợi ý "Use {size}" nhỏ hơn). **[Quan sát]** `P:2468569`, `App:1038416`
- Cảnh báo nhóm: `gr.warn.*` (flat, capFailed, plugOut, plugShort, plugThin, interlockShape, borderMissing, cutout*). Lỗi cắt: missed / crossing / noLoop / gone / flat. **[Quan sát]** `App:1044755`

### 2.5 Thuật toán (mức sản phẩm)
- Phần đầu tiên tạo từ mesh + màu sơn (`pcAdd`), các thao tác cắt `pcLine/pcExtrude/pcLoopRing/pcLoopPath/pcLoopCreases/pcLoopDots`, kiểm tra/áp chốt `pcCheck/pcMale/pcApply/pcConnectorMeshes`, xuất `pcExport` — tất cả trong worker. **[Quan sát]** danh sách op `P:2473211–2475580`. Chi tiết hình học từng op: **[Chưa rõ]** (không đọc hết).
- Lịch sử undo/redo trong store (`past/future`). **[Quan sát]** `App:996237`
- (Chế độ từ flexi) tự nhận diện nhóm mặt `Rg`: gán nhãn theo góc cạnh, gộp vùng nhỏ; mức Medium/High/Extra/Ultra = 10/20/30/40 phần; default `{method:auto, parts:20, angleDeg:12, minFaces:200}`; góc tối thiểu 1.5°, tối đa 14 vòng lặp giảm góc ×0.75, dừng khi phần lớn nhất ≤ 40% diện tích. **[Quan sát]** `SG:27122`, `W:3146659`, `W:3150247`

### 2.6 Đầu ra **[Quan sát]** `W:3230147`, `App:1009524`
- `<base>_parts.3mf`: mỗi phần là một object, giữ màu sơn từng tam giác (`paint_color`), extruder = màu chiếm đa số, layer 0.2 / first layer 0.2, bảng filament = palette; các phần xếp dọc trục X cách nhau **5 mm**, căn giữa Y, đáy Z=0.
- `<base>_<tênPhần>.stl` cho từng phần.
- Nếu chỉ có 1 phần: xuất theo luồng màu (`groupsExport`): `<base>_colors.3mf` (3MF lõi + `m:colorgroup`) + `<base>.stl`. **[Suy luận]** (`QI` gọi `yn()` khi `parts.length<=1`; `W:3303462` cho định dạng)
- "Bambu Studio ↗": lọc file `.3mf`, ghi vào thư mục `bambu_folder`, rồi `open_in_bambu {dir,names}`; Rust tìm `bambu-studio.exe` trong ProgramW6432/ProgramFiles/ProgramFiles(x86)/LOCALAPPDATA hoặc `/Applications/BambuStudio.app/Contents/MacOS/`. **[Quan sát]** `App:1009845`, `binary:strings`

---

## 3. `split3mf` — Tách 3MF (Split a painted 3MF)

### 3.1 Mục đích
Nhận file 3MF đã tô màu (Bambu/Orca/PrusaSlicer), chọn vùng màu, tách vùng đó thành khối riêng (vá mặt cắt hoặc lồng khớp) để in rời rồi ghép. **[Quan sát]** `s3.title@18951` "Split a painted 3MF", `s3.drop@18984`.

### 3.2 Đầu vào & đọc 3MF **[Quan sát]** `App:1069604` (`accept:.3mf`), `W:2303282–2308418`
- Đọc mọi `*.model`, theo `<build><item>` + `<component>` (đệ quy ≤ 8 cấp, áp transform), đơn vị `micron/millimeter/centimeter/inch/foot/meter`.
- Màu sơn tam giác: thuộc tính `paint_color` (Bambu/Orca) hoặc `slic3rpe:mmu_segmentation` (Prusa).
- Extruder theo object/part từ `Metadata/model_settings.config`; màu filament từ `Metadata/project_settings.config` (`filament_colour`) hoặc `Metadata/Slic3r_PE.config` (`extruder_colour|filament_colour`); thiếu màu → `#8f9296`.
- Cây chia nhỏ tam giác của paint được giải mã và tam giác được chia thật; nếu chi phí `Σ4^depth > 4e6` hoặc độ sâu > 24 → chế độ "coarse" (mỗi tam giác một màu, cảnh báo `s3.coarse`). `W:2308418`
- Mô hình phải kín; nếu không, thử sửa tự động; vẫn hỏng → `s3.notClosed` (hướng dẫn sửa trong Bambu Studio). Căn giữa XY, đáy Z=0. `W:3254126`

### 3.3 UI **[Quan sát]** `App:1068862–1078000`
Chọn màu trên mô hình (Ctrl/Shift để chọn nhiều, `s3.pickHint`); nhóm "Cut" (patch/volume) + tham số; nhóm Connector (chỉ patch); danh sách "Models ({n})" (đổi tên, xoá, "Open another file…"); nút Split → xem trước → Commit / huỷ; Undo/Redo; Export files… + Bambu Studio.

### 3.4 Tham số (default `KS:557`, `KS:6668`; slider `App:1073827–1074937`) **[Quan sát]**

| key | VI | EN | min | max | step | default | ghi chú |
|---|---|---|---|---|---|---|---|
| cut | Cách cắt | Cut | — | — | — | patch | patch (Vá mặt cắt) / volume (Lồng khớp) |
| cap (patch) | Mặt vá | Cap | — | — | — | soapfilm | soapfilm (Cong) / flat (Phẳng) / centroid (Đơn giản) |
| othersYield (patch, >1 solid) | Chồng lấn | Overlap | — | — | — | false | piece = cắt phần tách / others = cắt phần khác |
| depthMm (volume) | Độ sâu (mm) | Depth (mm) | 0.4 | 20 | 0.2 | 2 | |
| toleranceMm (volume) | Khe hở (mm) | Fit (mm) | 0 | 1 | 0.05 | 0.2 | |
| smoothMm (volume) | Làm mượt viền (mm) | Smooth edge (mm) | 0 | 3 | 0.1 | 0.6 | |
| connector.kind (patch) | Chốt nối | Connector | — | — | — | none | none / cylinder (Tròn) / triangle / rectangle |
| connector.areaPct | Cỡ (%) | Size (%) | 5 | 70 | 5 | 30 | % diện tích mặt cắt |
| connector.side | Chốt ở | Plug on | — | — | — | part | part (Phần tách) / rest (Mô hình) |
| connector.toleranceMm | Khe hở (mm) | Fit (mm) | 0 | 1 | 0.05 | 0.2 | |

### 3.5 Thuật toán **[Quan sát]** `W:3255508–3257854`, `KS:6668–10391`
- Chọn = tập "component" màu (vùng liền cùng màu). Split (`Bb`):
  - `volume`: tạo khối lồng khớp đẩy sâu `depthMm` vào mô hình + hốc khớp có khe `toleranceMm`, viền làm mượt `smoothMm`; preview hốc cập nhật sau 80 ms. Lỗi: interlockShape (quá cong), deep, pieces, small.
  - `patch`: cắt theo biên vùng màu, vá lỗ bằng cap đã chọn (fallback sang "Simple" được đếm `s3.fallbacks`); mô hình nhiều shell xử lý chồng lấn theo `othersYield`.
  - Chốt nối: lấy vòng biên có diện tích lớn nhất làm mặt cắt; diện tích chốt = `max(0.5, areaPct%·A)`, rộng `2√(area/π)`, dài `1.5×rộng`, hướng theo pháp tuyến (đảo nếu đặt ở `rest`).
- Phần mới đặt cạnh phải: `x = maxX + 8 mm`, tên `<model>_<n>`. Lịch sử undo giới hạn **15** bước. Worker "warm" tiền tính cho mô hình nhiều solid.

### 3.6 Đầu ra **[Quan sát]** `W:3257854`
`<base>_split.3mf` (mỗi model là 1 object kèm paint gốc, extruder = màu đa số, layer 0.2/0.2, filaments = palette, ghi kiểu Bambu có `p:UUID` và `paint_color` — `W:2314038`) + `<base>_<name>.stl` mỗi model. Bambu Studio: như colorsplit (`KS:10391`).

---

## 4. `library` — Thư viện

### 4.1 Mục đích & nội dung
Kho tài sản cục bộ dùng chung giữa các tool. Loại (`kind`): `design`, `model`, `picture`, `text` (kiểu chữ), `font`. **[Quan sát]** `TT:5769`, i18n `lib.kind.*@32597…34121`
- Nhập: model `stl,3mf,obj`; picture `png,jpg,jpeg,webp,svg,gif,bmp`; font `ttf,otf,woff`; gói `.flexasset`. **[Quan sát]** `D:375759`
- Thumbnail PNG tự sinh (model render, ảnh, font vẽ "Aa / Ăê 123"). **[Quan sát]** `D:375759` lân cận

### 4.2 UI **[Quan sát]** `TT:7549`, i18n `lib.*`
Bộ lọc All / Designs / 3D models / Pictures / Text styles / Fonts; vùng thả file; Import…; Open folder (`library_reveal`); chi tiết mục: tên (sửa trực tiếp), loại, tool, dung lượng, ngày tạo; nút Open (design), "Add to design", Export file…/Export 3MF…, "Export for sharing…" (.flexasset), Duplicate, Delete (xác nhận).

### 4.3 Lưu trữ **[Quan sát]** `D:9039–10352`, `binary:strings`
- Rust commands: `library_list`, `library_put {meta}`, `library_write` (bytes + header `x-id`,`x-name`), `library_read {id,name}`, `library_remove_file`, `library_delete`, `library_copy {id,meta}`, `library_reveal {id}`; event `library` để làm mới.
- Mỗi tài sản = 1 thư mục có `asset.json` (meta) + file. **[Suy luận]** từ chuỗi `asset.json`, `library`, "use library_put for the description" (`binary:strings`). Vị trí thư mục gốc: **[Chưa rõ]**.
- Meta: `{id,name,kind,created,updated,file,size,thumb?,tool?,extra?,prints?,claimed?}`; file chính đặt tên `<kind>.<ext>`, thumbnail `thumb.png`. `D:375759+`
- Không chạy trong Tauri → kho tạm trong RAM (Map). `D:9039`
- Lưu thiết kế ("Save to library", nút ở thanh trên của các tool có template): `design.json` = `{kind:"flexhub-design", version:1, flow:"picture", tool, picture:{file:"source.<ext>",name}, pipeline, project, fonts, box, layers, models}` + file phụ (ảnh gốc, font `font-N.bin`, layer, model) + **file in** (3MF; hoặc SVG/DXF nếu chế độ laser) + thumb. File in chỉ được đính kèm nếu `claimExport({quiet:true})` thành công; nếu hết lượt → lưu không kèm file in, báo `lib.savedNoPrints`. `D:405780`, `D:407024`, `D:10352`
- Xuất file thô từ thư viện của tài sản có `tool` mà chưa "claimed" cũng phải qua `claimExport`. `D:379091` lân cận (`Ud`)

### 4.4 Gói chia sẻ `.flexasset` **[Quan sát]** `D:377606`, `D:379091`
```json
{ "kind":"flexhub-asset", "version":1, "meta":{…không có id, prints}, "files":{ "<name>":"<base64>" } }
```
Nhập: kiểm tra `kind`, tạo id mới, ghi lại file (bỏ `prints`).

---

## 5. `creative` — Không gian sáng tạo (Creative Workspace)

### 5.1 Mục đích
Canvas node-graph (kiểu React Flow) để brainstorm bằng AI: node văn bản (chat LLM), node tạo ảnh, node ảnh/media, chip giá trị, node hiển thị; kết quả ảnh có thể "Send to tool…" sang các tool in 3D. **[Quan sát]** i18n `cw.*@35929…38954`, `App:826641` (`WE` 6 loại node)

### 5.2 UI **[Quan sát]**
- Màn bắt đầu: "Start a new idea" với 3 lựa chọn (Text / Image / Upload). `cw.start.*`
- Thanh: Add node, Run all, Project (Open folder…, Recent), Workspace settings (OpenAI key: Save/Remove, "Stored in Windows Credential Manager"). `cw.*`
- Menu node: Upload image…, Settings, Duplicate, Delete, Fit view, Send to tool…; trạng thái Running/Failed/Output ready; Tab = Generate.
- Tham số node text: Model, Prompt, System Prompt, Temperature, Max Tokens. Node image: Model, Prompt, Negative Prompt, Width, Height, Number of Images. Node media: Media Path, Media Type, Image Fit, Auto-play, Loop, "Auto-upload to Replicate", Show Upload Badge. Giá trị min/max cụ thể: **[Chưa rõ]** (form sinh từ schema).

### 5.3 Mô hình AI & mạng
- Mặc định `openai:gpt-5-mini` (text) và `openai:gpt-image-1` (image); danh sách model lấy qua `creative_openai_models`, lọc text `^(gpt-|o\d|chatgpt-)` loại image/audio/realtime/…; image `^(gpt-image|dall-e|chatgpt-image)`. **[Quan sát]** `App:754081`, `App:755500+`
- Kích thước ảnh: tỉ lệ >1.2 → `1536x1024`, <1/1.2 → `1024x1536`, còn lại `1024x1024`, không có → `auto`. **[Quan sát]** `App:756023`
- Gọi API thực hiện ở **Rust** (`creative_openai_chat`, `creative_openai_image`) tới `https://api.openai.com/v1`; khóa lưu bằng keyring (crate `keyring-3.6.3`, mục `openai-api-key`). **[Quan sát]** `App:753355`, `binary:strings`
- Code JS còn đường cho Replicate/OpenRouter (default text model cũ `meta/meta-llama-3-70b-instruct`; command `replicate_*`, `download_and_save_file`) nhưng **không có** các command này trong binary → nhiều khả năng là code thừa từ thư viện workflow, không hoạt động. **[Suy luận]** `App:873043`, `App:783394`; kiểm `grep` binary = 0 lần. `creative_has_openai_key` cũng không thấy trong binary **[Chưa rõ]**.

### 5.4 Dự án / lưu trữ **[Quan sát]** `App:753355`, `App:884458`, `App:887181–887676`
- Dự án = **một thư mục**; thư mục trống tạo dự án mới (`creative_open_project {dir, create}`); có thư mục scratch mặc định (`creative_scratch_dir`). Recent: localStorage `img2print.creative.recent` (tối đa 8).
- Workflow tự lưu mỗi **1.5 s** (khi đổi) qua `creative_save_workflow` → `project.json`:
  `{schema:"img2print.creative-workflow", version:1, nodes:[{id,type,position,style,width,height,parentNode,extent,zIndex,data}], edges:[…], viewport}`; đường dẫn asset trong thư mục dự án ghi dạng tương đối `project:<path>`. Phiên bản > 1 bị từ chối.
- Asset sinh ra/nhập lưu bằng `creative_save_asset` (header `x-name`, `x-kind`: imported/generated…), đọc lại bằng `creative_read_asset`; thư mục con `assets`, `generated`, `svg`, `models` **[Suy luận]** từ `binary:strings`.
- "Send to tool": ảnh PNG/JPG/WEBP/SVG → các tool có template (trừ `poptext`); SVG còn gửi được sang `leather`. **[Quan sát]** `App:885545`

---

## 6. App shell

### 6.1 Cửa sổ, tab, khởi động **[Quan sát]**
- Tauri v2, bundle `dev.img2print.desktop`, tên "Flex Hub", dev URL `http://localhost:1420/`. `binary:strings`
- Đa tab: cửa sổ "strip" (thanh tab, `Strip-Blbauk0X.js`) + mỗi tab là một webview (`role:'tab'`) — Rust chèn `window.__IMG2PRINT__ = {role:'strip'|'tab', …}`. Lệnh: `tab_new, tab_close, tab_select, tab_move, tab_drag, tab_drop, tabs_state, tab_info, tab_key`. Phím: Ctrl+T mới, Ctrl+W đóng, Ctrl+Tab / Ctrl+Shift+Tab, Ctrl+1…8. `IDX:219737`, `IDX:221906`, `binary:strings`
- Tiêu đề tab = tên tool + tên tài liệu (`tab_info`). `tab-pwCscTeU.js:600`
- Khởi động tab: `startAccount, startProjectSync, startAutoFixes, startDesignSync, startToolDesignSync`, render trong `Gate`. Module `headless` (API tự động hoá: importFile, openTool, trace, build, exportAll…) được nạp; cách phơi ra ngoài **[Chưa rõ]**. `IDX:221906`, `headless-B8N-6M8y.js`
- Chế độ "Advanced" (workspace chuyên gia) lưu localStorage `img2print.advanced`; ngôn ngữ `img2print.lang` (en/vi, mặc định en). `store-CxF8NhHa.js:45`, `i18n:80528`

### 6.2 Hub **[Quan sát]** `SG:38019`
Eyebrow "3D print factory / Xưởng in 3D", tiêu đề "What do you want to make? / Bạn muốn làm gì?", lưới tile theo danh sách tool ở §0 (không phân nhóm), badge "Soon" nếu `soon`, badge "Pro" nếu tool bị khoá cho tài khoản; ô cuối "More coming". Thả ảnh vào hub = mở tool mặc định theo template hiện tại.
- Lưu ý: tiền tố `g.*` **không** phải nhóm tool mà là chuỗi của luồng "guided" ảnh→màu→thiết kế→in (`g.step.image/colors/design/export`, `g.des.*`…). `g.allTools@13727` "All tools" là nút quay về hub. **[Quan sát]** i18n `g.*@8544…15813`

### 6.3 Tài khoản & gói (mức sản phẩm) **[Quan sát]**
- Trong app desktop phải đăng nhập (Gate hiện form Sign in / Create account, mật khẩu ≥ 6 ký tự khi đăng ký, xác nhận email bằng mã 6 số, quên mật khẩu). Bản web không Tauri: `status:'off'` → không giới hạn. `G:1643`, `G:5691`, `ACC:847`
- Trạng thái tài khoản (do Rust trả): `{status, email, plan:'free'|'pro', proUntil, daysLeft, lockedTools[], dailyExports, exportsToday, payCode, priceVnd, shop, offline, reason}`. `ACC:847`
- **Free**: "1 export a day" (`pro.limit@32237`); số lượt/ngày lấy từ server (`dailyExports`), hiển thị "Exports today x / y". Một số tool có thể bị khoá theo `lockedTools` (badge Pro, mở tool → hộp nâng cấp `reason:'tool'`). **Pro**: theo tháng, hiển thị "Pro until", "Days left". `ACC:1200–1494`, `App:359569`, `C:14472`
- Mỗi lần xuất gọi `account_claim_export {tool}`; hết lượt → hộp "Get Pro" (`reason:'limit'`), lỗi mạng → `offline`. `ACC:1494`
- Hộp nâng cấp: giá VND/tháng, mã QR chuyển khoản ngân hàng VN (chuẩn VietQR/NAPAS, sinh SVG bằng Rust `qr_svg`), số tài khoản/chủ TK/nội dung chuyển khoản = `payCode`, liên kết Zalo/Facebook/Email (mở bằng `open_link`). Kích hoạt Pro là thủ công/phía server. `G:2829–5691` **[Quan sát]**; quy trình đối soát **[Chưa rõ]**.

### 6.4 Updater **[Quan sát]**
`tauri-plugin-updater 2.14.0`, endpoint `https://github.com/angrybo/flex-hub-releases/releases/latest/download/latest.json`, có pubkey minisign. JS: `update_state` (lấy version mới), event `update`, nút "Update to {version}" gọi `update_install`. `ACC:353–458`, `App:360725`, `binary:strings`

### 6.5 Rust vs JS
- **Rust** (crate `p3d-core` + vendored `vectorcraft-trace/geom`; file `account.rs, creative.rs, fonts.rs, library.rs, tabs.rs, update.rs, lib.rs`): đọc/chuẩn bị ảnh (`load_image, prepare_image`), vector hoá (`trace_image` — VTracer/VectorCraft), `import_svg`, ghi file (`write_export_file`), font hệ thống (`list_system_fonts, read_system_font`), Bambu (`bambu_folder, open_in_bambu`), tài khoản (`account_state, account_sign_in, account_sign_up, account_confirm, account_resend, account_reset_start, account_reset_finish, account_sign_out, account_refresh, account_retry, account_claim_export`), thư viện (`library_*`), creative (`creative_open_project, creative_scratch_dir, creative_save_workflow, creative_save_asset, creative_read_asset, creative_set_openai_key, creative_openai_models, creative_openai_chat, creative_openai_image`), tab (`tab_*`, `tabs_state`), `update_state, update_install`, `qr_svg, open_link`. **[Quan sát]** `binary:strings`; vị trí gọi trong JS: `P:2470512–2471096`, `ACC:353–2161`, `D:9039–10208`, `App:753355`, `G:3526–3914`, `Strip-Blbauk0X.js:17250–19699`.
- **JS/Worker**: toàn bộ hình học 3D/2D (manifold-3d WASM): kitcard, split3mf, colorsplit, flexi, bottle, timetable, 3MF/STL/SVG/DXF writer, đọc 3MF. **[Quan sát]** `P:2473211–2475580`
- Plugin Tauri dùng: dialog (open/save), event, image, window, webview, updater. **[Quan sát]** danh sách invoke.

### 6.6 Endpoint mạng **[Quan sát]** `binary:strings`
- Supabase `https://<project-ref>.supabase.co (đã che)`: `/auth/v1/token?grant_type=password|refresh_token`, `/auth/v1/signup`, `/auth/v1/verify`, `/auth/v1/resend`, `/auth/v1/recover`, `/auth/v1/user`, `/auth/v1/logout?scope=local`, `/rest/v1/rpc/claim_export`, `/rest/v1/rpc/my_entitlements`. (Có biến môi trường `FLEXHUB_SUPABASE_URL`/`FLEXHUB_SUPABASE_KEY`.) Không ghi lại khoá API.
- OpenAI `https://api.openai.com/v1` (chỉ Creative, dùng khóa của người dùng).
- GitHub release `latest.json` (updater).
- JS không gọi mạng trực tiếp ngoài fetch font/asset nội bộ; mọi request mạng đi qua Rust. **[Suy luận]**

### 6.7 Định dạng nhập tổng hợp **[Quan sát]**
- Ảnh: PNG, JPG/JPEG, WEBP, SVG (luồng ảnh — `store-CxF8NhHa.js:534`, `canvas.badType@4243`); thư viện thêm GIF, BMP.
- 3D: STL, OBJ, 3MF (kitcard/colorsplit/flexi…), 3MF có sơn màu (split3mf).
- Font: TTF/OTF/WOFF (`TT:14197`) + font hệ thống + font đóng gói (be-vietnam-pro, dancing-script, lilita-one, space-grotesk…).
- Dự án: `*.kitcard.json`, `design.json` trong thư viện, `.flexasset`, `project.json` (Creative).
