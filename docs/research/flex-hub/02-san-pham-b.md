# Flex Hub v0.2.24 — Sản phẩm nhóm B (backpack, keycap, thermoform, tray, notebook, bookmark, layerframe, clock, poptext, rect)

Đọc tĩnh. Viết tắt file:
- `P` = `flexhub-web/assets/pipeline-DVPZCkNy.js` (định nghĩa sản phẩm + hình học, bản main-thread)
- `W` = `flexhub-web/assets/worker-Cc0bSqjO.js` (bản copy trong worker; định nghĩa sản phẩm giống P, chỉ khác tên biến do minify — so sánh đã chuẩn hóa định danh cho tỉ lệ khớp ≥0.99 ở 2.5 KB đầu mỗi định nghĩa)
- `A` = `App-CXT8Oy65.js`, `T` = `TimetableScreen-BkPntagu.js`, `I` = `i18n-EFUBxO61.js`

Offset là chỉ số ký tự (Python `str.find`, file đọc dạng UTF‑8). Nhãn: **[Quan sát]** đọc thẳng từ code; **[Suy luận]** diễn giải; **[Chưa rõ]** chưa xác minh được.

## 0. Quy ước chung (chỉ phần dùng riêng cho nhóm này)

- `mode` của dự án: `1` = "Multi-color (AMS)" (mỗi màu là một khối riêng, cao `heightMm`), `2` = "Single color" (đổi nhựa theo lớp — "bands"). **[Quan sát]** `A:1123548` (`t===1?'g.des.ams':'g.des.single'`), chuỗi `I` `"g.des.ams":"Multi-color (AMS)"`, `"g.des.single":"Single color"`.
- `oo(...)` = bộ dựng "tấm phẳng + màu" dùng chung (cả 2 mode); không mô tả lại ở đây. `Ei(art, border)` = viền bao hình (offset + nối các đảo bằng closing tăng dần 0.5→128 mm, cuối cùng hull nếu vẫn nhiều mảnh) **[Quan sát]** `P:99364`.
- Param helper: `yi(range=150, step=.5)` sinh `artX`/`artY` ("Dịch hình sang phải/lên (mm)", min −range, max range, default 0) **[Quan sát]** `P:98434`. `gi(on)` sinh 4 param tab `keychain`: `loop` (toggle, default `+on`), `loopAngle` 0–359 step 1 (default 0 nếu on, 90 nếu off, showIf loop=1), `loopHoleMm` 2.5–8 step .5 def 4, `loopWidthMm` 1.5–5 step .5 def 2 **[Quan sát]** `P:97766`. `xi(map, params)` gán `tab` cho param theo map; param không có trong map → tab đầu tiên **[Quan sát]** `P:98699`, `A:1122148` (`ne=e=>e.tab??j`). `showIf` = mọi điều kiện đúng (mảng = "thuộc"), `showIfAny` = một trong các điều kiện **[Quan sát]** `P:98764` (hàm `Si`). Giá trị bị clamp vào [min,max] khi đọc **[Quan sát]** `P:98927` (hàm `Ci`).
- `advanced:!0` = chỉ hiện khi bật "Nâng cao" **[Quan sát]** `A:1122148` (`co,{which:e=>e.advanced===!0&&...}`). `build3d:!0` và `live:` là cờ UI/tái dựng **[Suy luận]**.
- Cảnh báo sản phẩm được phát ở `P:92079` (`clockHands`) và `P:92215` (`thermoSlope`) **[Quan sát]**.
- `products.json` (trích bằng regex) **thiếu/sai nhiều**: backpack 6 vs thực tế 17 param; keycap 0 vs 4; thermoform 14 vs 31; tray 8 vs 11; notebook 25 vs 29; bookmark 15 vs 20; layerframe 10 vs 15; clock 12 vs 19; poptext 18 vs 21; `rect` trong products.json là danh sách param của một màn hình khác (`slotW`, `slotH`, `gapX`...) — sai hoàn toàn. **[Quan sát]** đối chiếu với các offset bên dưới.

---

## 1. `backpack` — Hộp ba lô / Backpack box

**Mục đích:** hộp nhỏ dáng ba lô có nắp bản lề + chốt gài, quai treo, cửa sổ trong suốt, tai trang trí; hình in trên nắp và (tùy chọn) trên 4 thành + đáy. **[Quan sát]** `P:1895829`.

**Tabs:** `shape` (Hình dáng), `lid` (Nắp), `walls` (Thành hộp). `customShape:!0` (nhận viền "hình tùy chọn"). Tab `walls` có thêm UI riêng chọn hình cho từng mặt (`zR`) **[Quan sát]** `P:1895829`, `A:1125007` (`M==='walls'&&u.id==='backpack'&&zR`), `A:1091166`.

### Tham số (`Wc(key,en,vi,min,max,step,def,extra)` — `P:1895287`)

| key | VI | EN | min | max | step | def | ghi chú |
|---|---|---|---|---|---|---|---|
| shape | Dáng hộp | Box shape | 0 | 4 | 1 | 0 | choices: Gốc/Original, Tròn/Round, Vuông bo/Soft square, Mái vòm/Arch top, Theo hình/Picture |
| sizePct | Cỡ hộp (%) | Box size (%) | 70 | 200 | 1 | 100 | |
| hingeShift | Vị trí bản lề (mm) | Hinge position (mm) | −20 | 20 | .5 | 0 | |
| latchShift | Vị trí chốt (mm) | Latch position (mm) | −20 | 20 | .5 | 0 | |
| loop | Quai treo | Hanging loop | 0 | 1 | 1 | 1 | toggle |
| loopShift | Vị trí quai (mm) | Loop position (mm) | −25 | 25 | .5 | 0 | showIf loop=1 |
| window | Cửa sổ | Window | 0 | 4 | 1 | 1 | tab lid; Không/None, Tròn/Circle, Trái tim/Heart, Ngôi sao/Star, Vuông bo/Rounded square |
| windowMm | Cỡ cửa sổ (mm) | Window size (mm) | 8 | 45 | .5 | 30.25 | tab lid; showIf window∈[1..4] |
| windowX | Cửa sổ trái / phải (mm) | Window left / right (mm) | −25 | 25 | .5 | .4 | tab lid; showIf window∈[1..4] |
| windowY | Cửa sổ lên / xuống (mm) | Window up / down (mm) | −25 | 25 | .5 | 4.8 | tab lid; showIf window∈[1..4] |
| insert | Tấm trong suốt | Clear insert | 0 | 1 | 1 | 1 | tab lid; toggle; showIf window∈[1..4] |
| ears | Tai | Ears | 0 | 4 | 1 | 0 | tab lid; Không, Mèo/Cat, Thỏ/Bunny, Gấu/Bear, Nơ/Bow |
| earsMm | Cỡ tai (mm) | Ear size (mm) | 6 | 25 | .5 | 13 | tab lid; showIf ears∈[1..4] |
| earsSpread | Khoảng cách tai (mm) | Ear spacing (mm) | 10 | 50 | .5 | 36 | tab lid; showIf ears∈[1,2,3] |
| artPct | Cỡ hình (%) | Picture size (%) | 20 | 150 | 1 | 80 | tab lid |
| artX | Hình trái / phải (mm) | Picture left / right (mm) | −25 | 25 | .5 | 0 | tab lid |
| artY | Hình lên / xuống (mm) | Picture up / down (mm) | −25 | 25 | .5 | −8 | tab lid |
| wallRaiseMm | Độ nổi (mm) | Raised height (mm) | .4 | 1.6 | .1 | .8 | tab walls; build3d |
| wallDepthMm | Độ khắc (mm) | Engrave depth (mm) | .3 | 1.2 | .1 | .6 | tab walls; build3d |
| floorMm | Độ sâu hình đáy (mm) | Floor picture depth (mm) | .4 | 1.2 | .1 | .6 | tab walls; build3d; advanced |

**[Quan sát]** `P:1895829`–`P:1898000`. Mỗi mặt thành (front/back/left/right/floor) còn có cấu hình riêng (hình, `style` raised/engraved, fit/fill, `sizePct` 10–200, x/y ±150, xoay, màu thay thế) lưu trong `state.backpack.faces` — không phải param **[Quan sát]** `A:1091166`, `A:1092856`; mặc định `{pic:null,fill:false,sizePct:90,x:0,y:0,rotateDeg:0}` biến `js` tại `P:1868949`.

### Hình học gốc (dữ liệu nhúng `os`, `P:1628087`)
- Thân: `body.outer` 816 điểm, bbox x 0…55.95, y 7.67…69.56 (≈56×62 mm); `inner` bbox x 2.34…53.69 (thành ≈2.3 mm); `height 41.2172`, `floor 4.1705` **[Quan sát]** `P:1656312` (bbox tính từ mảng số).
- `notches` (hinge x −1…11, y 22.55…50.35, z0 37.485; latch x 44.95…56.95, y 30.55…40.85, z0 37.611); `pins` (2 chốt bản lề r≈1.03/0.99, len≈1.99 tại z 40.013); `balls` (2 bi chốt gài r 1.0377, scale y .9425/.7057) **[Quan sát]** `P:1656339`–`P:1656680`.
- `loop` (quai): outer 260 điểm, `hole`, `insets` 8 mức z 19.6…23.6, `z0 19.35, z1 23.9274`, `anchor [27.94,69.565]` **[Quan sát]** `P:1656680`.
- `lid`: outline 720 điểm (bbox −0.5…56.5 × 7.15…69.79), `insets` 12 mức (z .01…4.846 / inset .55→0→.65 — profile bo cạnh dưới & trên), `z0 41.2172, z1 46.0557, seat 41.2093`, `recess` + `recessBox` + `recessRoof 3.745` (hốc bản lề), `notch.profile` (khe chốt), `balls` (2 bi trên nắp), `pin` (r .71, len 12.8429) **[Quan sát]** `P:1662229`–`P:1675632`.
- `link` (khâu bản lề, mesh 2747 đỉnh, bbox x −0.3…6.51, z 33.29…44.95) và `tab` (lẫy chốt, 1050 đỉnh, x 53.19…61.93, z 41.21…46.08) **[Quan sát]** `P:1675633`, `P:1812834`.
- `tabAxis`, `hingeAxis [[1.4109,23.1716,40.013],[2.4087,49.8938,40.013]]`, `zones.hinge {x −60…8, y 18.05…54.85}`, `zones.latch {x 47.95…120, y 26.55…44.85}` **[Quan sát]** `P:1861987`, `P:1862047`.
- Hằng: `dc=.5` (nắp lớn hơn thân 0.5 mm), `fc={ledge:1.2,thick:1.2,fit:.15}` (gờ cửa sổ), `pc=[27.9764,38.6176]` (tâm scale) **[Quan sát]** `P:1882880`.

### Thuật toán
1. **Cache:** kết quả `Hc` được cache theo mọi param trừ `artPct, artX, artY, minFeatureMm, wallRaiseMm, wallDepthMm, floorMm` (đổi các param này không dựng lại vỏ) **[Quan sát]** `P:1895378` (`Gc`), `P:1895568` (`Jc`).
2. **Biên dạng thân (`Pc`, `P:1886710`; `Mc` `P:1885722`; `Nc` `P:1886321`):** shape 0 = outline gốc; 1 = ellipse cùng bbox; 2 = chữ nhật bo r=14 (square [w−28,h−28] offset 14); 3 = mái vòm: rect bo r=8 + nửa ellipse cao 2·0.32h ở đỉnh; 4 = viền hình tùy chọn (customShape) scale vừa bbox gốc, tâm `pc`. Sau đó scale `sizePct/100` quanh `pc` **[Quan sát]**.
3. **Bố trí bản lề/chốt (`Rc`, `P:1887735`):** tìm cạnh trái tại y bản lề và cạnh phải tại y chốt (`xc` lát 0.5 mm). Nếu dáng khác gốc, `Lc` (`P:1887472`) quét dịch y bản lề từng 1 mm để giảm phần nắp nhô qua trục bản lề (`Ic`), rồi cộng `hingeShift`; chốt = y gốc + `latchShift`. Cảnh báo `hingeOff`/`latchOff` (không tìm thấy cạnh), `tooNarrow` (hinge.x1+shift > latch.x0+shift − 6) **[Quan sát]** `P:1888089`.
4. `Fc` (`P:1886983`) "ghép" vùng bản lề/chốt của hình học gốc vào dáng mới (dịch theo shift) để cơ cấu giữ nguyên kích thước. Thân = ghép → làm mượt `bc(S,3,1)` → ghép lại; khoang = thân offset −2.5 (thành 2.5 mm) + ghép vùng `inner`; nắp = thân offset +0.5 → ghép `lid.outline` → làm mượt `bc(N,2,.5)` **[Quan sát]** `P:1887735`–`P:1889039`. Dáng gốc không đổi → dùng thẳng outline gốc (`plain`).
5. **Thân (`Hc`, `P:1890594`):** extrude thân 0…41.2172, trừ khoang từ z=4.1705; trừ 2 notch; nếu không `plain`: phần thân phía bản lề vượt đường trục +0.3 bị hạ xuống từ z=max(floor+5, swingZ) với `swingZ = 40.013 − (độ nhô nắp) − 0.3` (để nắp xoay không va) → báo `hingeStep` **[Quan sát]**. Thêm 2 chốt trụ (cylinder 48 cạnh) và 2 bi (sphere scale y). Quai: outline quai + rect nối, loft qua `insets` (`Tc`), khoét lỗ, đặt ở x=27.94+`loopShift` tại mép trên thân, trừ khoang **[Quan sát]**.
6. **Nắp:** tai (`Bc`, `P:1889746`): Mèo = tam giác bo (−.55s,−.35s)(.5s,−.35s)(.12s,.75s); Thỏ = ellipse .38s×1.5s nghiêng ±8°; Gấu = tròn r .45s; Nơ = 2 tam giác + tròn .22s, 1 cái ở giữa. Đặt tại mép trên nắp − 0.25·earsMm, cách nhau `earsSpread`; trừ vùng bản lề/chốt ±1.5 (`Vc`), nối + làm mượt **[Quan sát]**. Thân nắp = loft biên nắp qua 12 mức `lid.insets` từ `seat` (bo 2 mép); trừ hốc bản lề tới `seat+3.745` và khe chốt; thêm 2 bi + 1 trục chốt **[Quan sát]** `P:1890594`+.
7. **Cửa sổ (`zc`, `P:1889039`):** Tròn r=w/2; Tim = đường cong tim tham số 160 điểm scale theo w; Sao 5 cánh (r trong 0.48) bo 0.8; Vuông bo = square .6w offset .2w. Đặt tại tâm nắp + (windowX, windowY): khoét xuyên; gờ đỡ rộng 1.2 dày 1.2 từ mặt dưới; `insert`=1 → tấm trong suốt = gờ offset −0.15, dày 1.15, màu `#e8f4fa`. `windowClash` nếu gờ vượt vùng cho phép (nắp offset −(0.65+2.5) trừ vùng cơ cấu) **[Quan sát]**.
8. **Hình trên nắp:** vùng in `top` = nắp offset −(0.65+0.3) − vùng cơ cấu − (cửa sổ offset 2.0). Hình (chính hoặc hình được chọn cho `faces.lid`) scale = min(top.w/hình.w, top.h/hình.h)·artPct/100, dịch artX/artY, cắt theo `top`. Mode 1: mỗi màu extrude từ z=46.0557 lên +`heightMm`; Mode 2: bands với `baseLayers = 1+round((46.0557−41.2172−firstLayer)/layer)` **[Quan sát]** `P:1897000`–`P:1901228`.
9. **Hình trên thành (`uc` `P:1879615`, `rc` `P:1877414`):** với mỗi hướng front/back/left/right: lấy mẫu biên thân mỗi 0.5 mm, giữ điểm có pháp tuyến lệch ≤45° (`qs=cos45+.001`), sát cực trị ≤0.6 mm, ngoài vùng cơ cấu ±1.5 (`Xs`), chọn đoạn liên tục dài nhất (gap >1.5 mm cắt đoạn); cần ≥6 mm, cao v=1 (`Js`)…41.2172−1.5 (`Ys`) (giới hạn thêm bởi swingZ−1 gần bản lề), cao <5 → "Mặt này không đủ chỗ" (`noRoom`, `I:30652`). Đáy: vùng bbox thân inset 1.5 (`Qs`) **[Quan sát]** `P:1876565`.
   - Raised (mặc định): khối màu = hình chiếu ngang ∩ vành ngoài dày `wallRaiseMm` quanh thân, giới hạn trong nêm hướng mặt và z v0…v1 **[Quan sát]** `P:1879615`+ (`sc` `P:1879276`).
   - Engraved: chỉ các màu khác màu vỏ bị khắc vào vành (thân offset 0.5) − (thân offset −`wallDepthMm` ∪ khoang offset 0.8 `Zs`) → luôn chừa ≥0.8 mm đến khoang **[Quan sát]**.
   - Mode 2 + raised: gộp thành `bodyAdd` cùng màu vỏ (không đa màu) **[Quan sát]**.
   - Đáy: hình lật gương x, ∩ thân offset −1.5, extrude 0…`floorMm`; mode 1 = khảm phẳng (cắt thân + khối màu), mode 2 = chỉ khắc **[Quan sát]**.
   - Thân sau add/cut được `simplify(.002)` và bỏ mảnh rời thể tích <0.001 (`Ga`, `P:1066763`) **[Quan sát]**.

### Đầu ra
Parts: `body` (Body, màu vỏ `shellColor??baseColor`), `wall:<region>` (màu hình), `lid` (Lid, kind base, `baseColor`), `tab` (Latch tab, màu vỏ, object lid), `link` (Hinge link, màu vỏ, `printRotate:[180,0,0]`), `insert` (Window insert, `#e8f4fa`), các part màu/band trên nắp. `product` gồm hinge/latch X/Y, `lidTop`, `windowClash`, `hingeStep`, `hingeOff`, `latchOff`, `tooNarrow`, `wallNoRoom`, `wallNoRoomMask` (bit front=1, back=2, left=4, right=8, floor=16), trục tab/hinge (để preview mở nắp) **[Quan sát]** `P:1897000`–`P:1901600`. 
**Cảnh báo/giới hạn:** chỉ `bag.noRoom` có chuỗi UI; `hingeOff/latchOff/tooNarrow/windowClash` không có chuỗi i18n tương ứng trong `I` **[Quan sát]** (tìm không thấy) → có thể chỉ dùng nội bộ/preview **[Chưa rõ]**. Preview đọc `hingeAx0` để vẽ animation nắp **[Quan sát]** `T:238000`.

---

## 2. `keycap` — Nút phím / Keycap

**Mục đích:** keycap (chân MX) với hình đa màu nổi trên đỉnh. **[Quan sát]** `P:1927802`.
**Tabs:** `picture` (Hình).

| key | VI | EN | min | max | step | def | ghi chú |
|---|---|---|---|---|---|---|---|
| sizePct | Cỡ hình (%) | Picture size (%) | 30 | 150 | 1 | 90 | |
| artX | Dịch hình sang phải (mm) | Move picture right (mm) | −8 | 8 | .1 | 0 | `yi(8,.1)` |
| artY | Dịch hình lên (mm) | Move picture up (mm) | −8 | 8 | .1 | 0 | `yi(8,.1)` |
| minFeatureMm | Chi tiết tối thiểu (mm) | Min detail (mm) | 0 | 2 | .05 | 0 | advanced |

**[Quan sát]** `P:1927802` (products.json báo 0 param do không bắt được `...yi(8,.1)` và key dạng object).

**Thuật toán:**
1. Vùng in (`base`) = vuông 10.2×10.2 offset 2 (bo r=2) → 14.2×14.2 (`$c=14.2, el=2`) **[Quan sát]** `P:1927479`, `P:1927492`. `artBox` = 14.2·sizePct% vuông, dịch artX/artY.
2. Thân phím = mesh nhúng `Qc` (`height 7.998`, 638 đỉnh, 1272 tam giác; bbox 18.9×18.94×7.998 mm; mặt đỉnh ≈15.2×15.2 ở z≈8) **[Quan sát]** `P:1901829`, `P:1927602`. Có trụ Ø≈5.8 cao 6 mm với rãnh chữ thập ±2.13/±0.61 tại tâm **[Suy luận]** = chân Cherry MX (phân tích đỉnh mesh).
3. Màu = hình ∩ vùng in. Mode 1: mỗi màu extrude z 7.998…7.998+`heightMm`. Mode 2: bands với `baseLayers = 1+max(0,round((7.998−firstLayer)/layer))`, báo `keyLayers` **[Quan sát]** `P:1927802`+.

**Đầu ra:** part `keycap` (kind base, `baseColor` — nhãn "Keycap color" `I:~14100`), các part màu/band; `product.top=7.998`. Preview 3D tải `mx-switch-dMvdWM9i.stl` để vẽ switch (chỉ hiển thị) **[Quan sát]** `T:222090` (`Do=/assets/mx-switch...`), `T:228475` (`es()` load) **[Suy luận]** chỉ preview.

---

## 3. `thermoform` — Ép nhiệt / Thermoform

**Mục đích:** in tấm lưới (mesh) phẳng có hình đa màu + bộ khuôn dương/âm để ép nhiệt tấm thành vỏ phồng (dạng "squishy"/vỏ gối), tùy chọn tấm mặt sau, ren + đai ốc và chốt đáy để ghép 2 nửa. **[Quan sát]** `P:1940771`.
**Tabs:** `sheet` (Tấm lưới), `mold` (Khuôn), `join` (Ghép).

### Tham số (`q(...)`, cờ cuối = advanced; `P:1940771`)

| key | VI | EN | min | max | step | def | tab / ghi chú |
|---|---|---|---|---|---|---|---|
| sizeMm | Cỡ hình (mm) | Picture size (mm) | 30 | 220 | 1 | 100 | sheet; live xy |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 0 | 15 | .5 | 3 | sheet |
| pattern | Lưới | Mesh | 0 | 2 | 1 | 0 | sheet; Thoi/Diamond, Vuông/Square, Lục giác/Hexagon |
| picStyle | Hình | Picture | 0 | 1 | 1 | 0 | sheet; Nổi/Raised, Lưới/Mesh |
| cellMm | Ô lưới (mm) | Mesh cell (mm) | 1.5 | 8 | .1 | 3 | sheet |
| lineMm | Độ dày sợi lưới (mm) | Mesh line width (mm) | .3 | 1.5 | .05 | .5 | sheet; adv |
| thicknessMm | Độ dày tấm (mm) | Sheet thickness (mm) | .4 | 2 | .1 | .8 | sheet |
| rimWidthMm | Bề rộng viền (mm) | Rim width (mm) | .8 | 4 | .1 | 1.6 | sheet; adv |
| rimHeightMm | Cao viền (mm) | Rim height (mm) | .8 | 8 | .1 | 4 | sheet; adv |
| solidMm | Dải đặc trong viền (mm) | Solid band inside the rim (mm) | 0 | 6 | .1 | 1 | sheet; adv |
| domeMm | Độ phồng (mm) | Shell depth (mm) | 3 | 60 | .5 | 20 | mold |
| roundMm | Độ bo cạnh (mm) | Edge roundness (mm) | 1 | 60 | .5 | 20 | mold |
| insetMm | Khoảng lùi khuôn (mm) | Dome inset from the edge (mm) | 2.5 | 15 | .1 | 5 | mold; adv |
| marginMm | Lề khuôn (mm) | Mold margin (mm) | 2 | 20 | .5 | 5 | mold; adv |
| baseMm | Độ dày đế khuôn (mm) | Mold base thickness (mm) | 2 | 10 | .5 | 4 | mold; adv |
| roofMm | Độ dày nóc khuôn (mm) | Cavity roof thickness (mm) | 1.5 | 10 | .5 | 3 | mold; adv |
| gapMm | Khe khuôn (mm) | Mold gap (mm) | .6 | 3 | .05 | 1.2 | mold; adv |
| rimFitMm | Khe rãnh viền (mm) | Rim groove fit (mm) | 0 | .5 | .01 | .17 | mold; adv |
| back | Tấm mặt sau | Back sheet | 0 | 1 | 1 | 1 | join; toggle |
| backShape | Mặt sau | Back | 0 | 1 | 1 | 0 | join; Ép phồng/Formed, Phẳng/Flat; showIf back=1 |
| join | Ghép | Join | 0 | 1 | 1 | 1 | join; Không/None, Ren + đai ốc/Screw + nut |
| neckAngle | Vị trí ren (độ) | Screw position (deg) | 0 | 359 | 1 | 90 | join; showIf join=1 |
| neckMm | Dài ren (mm) | Screw length (mm) | 3 | 12 | .5 | 5 | join; showIf join=1 |
| threadMm | Đường kính ren (mm) | Screw diameter (mm) | 5 | 16 | .1 | 8.8 | join; adv; showIf join=1 |
| pitchMm | Bước ren (mm) | Thread pitch (mm) | 1 | 3 | .1 | 2 | join; adv; showIf join=1 |
| threadFitMm | Khe đai ốc (mm) | Nut fit (mm) | .1 | 1.2 | .05 | .4 | join; adv; showIf join=1 |
| key | Chốt đáy | Bottom key | 0 | 1 | 1 | 1 | join; toggle |
| keyAngle | Vị trí chốt (độ) | Key position (deg) | 0 | 359 | 1 | 270 | join; adv; showIf key=1 |
| keyWMm | Rộng chốt (mm) | Key width (mm) | 3 | 10 | .1 | 5.4 | join; adv; showIf key=1 |
| keyDMm | Dày chốt (mm) | Key depth (mm) | 2 | 6 | .1 | 3.85 | join; adv; showIf key=1 |
| keyFitMm | Khe chốt (mm) | Key fit (mm) | 0 | .5 | .05 | .15 | join; adv; showIf key=1 |

### Thuật toán
1. **Viền (`base`)** = `Ei(art, borderMm)` **[Quan sát]** `P:1929269`. Màu tấm = màu có diện tích lớn nhất (`ll`), các màu khác (khác slot) là màu hình **[Quan sát]** `P:1929310`, build ở `P:1940771`+.
2. **Tấm (`Ll`, `P:1938790`):** dựng bằng `oo` (dày `thicknessMm`); phần base thay bằng: vùng trong = base offset −(rimWidth+solid) − (hợp màu hình offset max(solid,line) `Ti`) → đục lỗ lưới `ul` (`P:1929462`): lỗ cạnh `cellMm−lineMm`, bước `cellMm`; Diamond = ô vuông xoay 45°, Square = 0°, Hexagon = lục giác bán kính (cell−line)/√3, hàng cách cell·√3/2, so le cell/2; co lỗ 0.03. Cộng gờ viền `dl` (`P:1930300`): vành rộng rimWidth cao rimHeight−r, cộng mép trên mỏng (offset −r…−(rimWidth−r)) với r=min(.4, rimWidth/3). Cộng/trừ chi tiết ghép **[Quan sát]**.
   - `picStyle=1` (Lưới) + mode 1 → `Rl` (`P:1939661`): cả vùng màu cũng là lưới, mỗi màu = (lưới ∩ vùng) ∪ (phần mảnh hơn ô/2) ∪ viền dày `lineMm` quanh vùng, tất cả dày `thicknessMm` cùng mặt phẳng **[Quan sát]**.
3. **Khuôn (`_l` `P:1933858`):** `baseTop=−0.2`, `baseBottom=−0.2−baseMm`, `domeTop=−0.2+domeMm`, `cavityTop=domeTop+gap`, `blockTop=max(cavityTop+roof, rimHeight+0.8+roof)` **[Quan sát]**. `gap` hiệu dụng = max(gapMm, thickness + chiều cao màu nổi tối đa) **[Quan sát]** build.
   - Dương (`vl` `P:1934030`): đế = base offset margin, z baseBottom…baseTop; vòm = trường cao `gl` (`P:1932647`) trên base offset −inset: lưới bước s=clamp(max(w,h)/200, 0.4, 1.2) mm, khoảng cách tới biên bằng EDT (Felzenszwalb `pl`/`ml`, tinh chỉnh chính xác trong 3 ô gần biên), cao `hl(d)=dome·√(1−(1−d/round)²)` khi d<round, = dome khi d≥round (profile 1/4 tròn); cắt theo lăng trụ viền, `simplify(.01)` **[Quan sát]** `P:1932556`.
   - Âm (`yl` `P:1934280`): khối = base offset margin, z 0…blockTop; trừ vòm nở thêm gap (inset−gap, dome+gap, round+gap); trừ rãnh viền: vùng trong (offset −rimWidth) z −1…thickness+0.2 (`al=.2`) và vành (offset +rimFit … −rimWidth−rimFit) z −1.2…rimHeight+0.8 (`ol=.8`); trừ "relief" của chi tiết ghép **[Quan sát]** `P:1929181`.
   - Cache tối đa 2 cặp khuôn theo hash FNV của polygon + param (`Ml`, `Pl` `P:1938299`) **[Quan sát]**.
4. **Ghép (`El` `P:1936080`):** điểm biên theo góc (`Sl`); `join=1`: trục ren `xl` (`P:1935155`, profile ren hình thang `bl`: đỉnh 1/8 bước, chân 1/4, sâu min(0.4r, 0.54·pitch), 72 cạnh, xoắn) dài rimWidth+0.4+neckMm nhô ra ngoài viền; nửa trên gắn tấm trước, nửa dưới (lật) gắn tấm sau; relief trụ r=thread/2+0.6 trừ khỏi khuôn âm. Đai ốc `Ol` (`P:1936849`): bán kính ngoài thread/2+fit+2, khía 16 múi biên độ 0.45, cao max(3,neck−0.5)+1.6, ren trong nới `threadFitMm`, có khoen treo (vòng r 3.2/1.8, dày 2.4) **[Quan sát]**. `key=1`: bệ chữ nhật (keyD+fit+2·1.6 × keyW+fit+2·1.6, bo .8) cao rimHeight gắn tấm, khe keyW+fit × keyD+fit sâu min(rimHeight−1, 3) (`Dl=3`); chốt rời `kl` (`P:1937395`) keyW×keyD×5.7 vát 0.3 **[Quan sát]**.
5. **Tấm sau:** `back=1` → `Ll` không màu, lật gương; `backShape=0` (Formed) → tấm lưới, `backShape=1` (Flat) → tham số `l=!O` = true → không đục lưới (tấm đặc) **[Quan sát]** `P:1940771`+ (`Ll(...,!O)`, `P:1938790` `v=l?_.subtract(_):ul(...)`). Formed + viền đối xứng gương (`Al` `P:1937609`, sai lệch < offset 0.4) → khuôn dùng chung ("both"); không đối xứng → thêm cặp khuôn `-back` riêng **[Quan sát]**.
6. **Bố trí:** khuôn dương tại x=0, khuôn âm lật 180° quanh X tại x=−b (b = rộng+2·margin+15), tấm tại x=+b, tấm sau tại (b, −(cao+2·margin+15)), đai ốc tại x=−b+minX−margin−15, chốt tại (đó, −18) **[Quan sát]**.

**Đầu ra:** `sheet` (+màu), `back-sheet`, `mold-positive` (Mold dome), `mold-negative` (Mold cavity), `mold-positive-back`/`mold-negative-back` (nếu cần), `nut`, `key`. Màu khuôn = `baseColor` ("Mold color"), tấm/đai ốc/chốt = màu tấm **[Quan sát]**. 
**Cảnh báo:** `slopeShare` = tỉ lệ diện tích màu hình nằm ngoài base offset −(inset+round) (vùng sườn cong); ≥3 % → `warn.thermoSlope` "Hình nằm trên mép cong của khuôn ({pct} %)…" **[Quan sát]** `P:1946344`, `P:92215`, `I:15197`.

---

## 4. `tray` — Khay / Tray

**Mục đích:** khay có thành, tấm hình rời (insert) lắp vào rãnh trong lòng khay hoặc âm dưới đáy. **[Quan sát]** `P:1947846`.
**Tabs:** `picture` (Hình), `tray` (Khay).

| key | VI | EN | min | max | step | def | ghi chú |
|---|---|---|---|---|---|---|---|
| place | Hình | Picture | 0 | 1 | 1 | 0 | Bên trong/Inside, Mặt dưới/Underneath |
| sizeMm | Cỡ hình (mm) | Picture size (mm) | 30 | 250 | 1 | 100 | live xy |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 0 | 10 | .5 | 2 | |
| inlayMm | Độ sâu hình (mm) | Picture depth (mm) | .2 | 2 | .1 | .6 | adv |
| insertMm | Độ dày tấm hình (mm) | Picture insert thickness (mm) | .8 | 4 | .1 | 1.2 | adv |
| offsetMm | Khoảng cách thành (mm) | Wall distance from the picture (mm) | 0 | 40 | .5 | 5 | tab tray |
| heightMm | Cao khay (mm) | Tray height (mm) | 6 | 120 | 1 | 25 | tab tray; live z |
| wallMm | Độ dày thành (mm) | Wall thickness (mm) | 1.2 | 6 | .1 | 2 | tab tray |
| floorMm | Độ dày đáy (mm) | Floor thickness (mm) | 1.2 | 8 | .1 | 2 | tab tray |
| slotMm | Độ sâu rãnh gắn hình (mm) | Slot depth for the picture (mm) | 0 | 4 | .1 | 1 | tab tray; showIf place=0 |
| fitMm | Khe hở lắp tấm hình (mm) | Insert fit clearance (mm) | 0 | .5 | .05 | .2 | tab tray; adv |

**Thuật toán:**
1. Biên khay `Vl` = `Ei(art,border)` offset max(offsetMm, wallMm+fitMm) **[Quan sát]** `P:1946567`. Biên tấm hình c = `Ei(art,border)`.
2. Tấm hình: mode 2 → `oo` dày `insertMm`; mode 1 → `Wl` (`P:1947160`): tấm 0…insert, màu khảm phẳng sâu i=min(inlayMm, insert−0.4) ở mặt trên **[Quan sát]**. p = đỉnh tấm.
3. `Ul` (`P:1946876`) dựng thân khay theo các lát: đáy đặc 0…s, (lát có hốc) s…c, đặc c…m, thành (biên − biên offset −wall) m…heightMm **[Quan sát]**.
   - place 0: e=min(slotMm,p), m=max(floorMm, e+1); hốc = c offset fitMm, z m−e…m; tấm đặt ở z=m−e (nằm trong rãnh) **[Quan sát]** `P:1947846`+.
   - place 1: m=max(floorMm, p+1); hốc lật gương (`Gl`) từ đáy 0…p+0.1; tấm xoay 180° quanh Y (`printRotate:[0,180,0]`), thân `printFlip:true`, mặt phẳng hiển thị lật x **[Quan sát]**.

**Đầu ra:** `tray-body` (Tray, kind shell, màu `baseColor`), part tấm `object:"insert"`. `product {place,height,insertTop}` — preview dùng `insertTop` **[Quan sát]** `T:238000`. Không có cảnh báo riêng.

---

## 5. `notebook` — Bìa sổ / Notebook cover

**Mục đích:** bìa trước (có hình) + bìa sau cho sổ A4/A5 với lỗ đóng gáy theo 5 hệ (đĩa, lược, kẽm 3:1, kẽm 2:1, xoắn). **[Quan sát]** `P:1952074`.
**Tabs:** `cover` (Bìa), `binding` (Đóng gáy). Param binding-specific dùng `eu(binding, p)` → `advanced:true`, `showIf:{binding}`, tab binding **[Quan sát]** `P:1951590`+.

| key | VI | EN | min | max | step | def | ghi chú |
|---|---|---|---|---|---|---|---|
| paper | Khổ giấy | Paper | 0 | 1 | 1 | 0 | A4 (210×297), A5 (148×210) |
| overhangMm | Bìa dư ra so với giấy (mm) | Overhang past the paper (mm) | 0 | 10 | .5 | 0 | |
| thicknessMm | Độ dày bìa (mm) | Cover thickness (mm) | .4 | 3 | .1 | .6 | live z |
| cornerMm | Bo góc (mm) | Corner radius (mm) | 0 | 15 | .5 | 3 | adv |
| inlayMm | Độ sâu hình (mm) | Picture depth (mm) | .2 | 1.5 | .1 | .4 | adv |
| sizePct | Cỡ hình (%) | Picture size (%) | 50 | 250 | 1 | 100 | adv |
| artX / artY | Dịch hình sang phải / lên (mm) | Move picture right / up (mm) | −150 | 150 | .5 | 0 | `yi(150)` |
| binding | Kiểu đóng gáy | Binding | 0 | 4 | 1 | 0 | Đĩa/Disc, Lược/Comb, Kẽm 3:1/Wire 3:1, Kẽm 2:1/Wire 2:1, Xoắn/Coil; tab binding |
| holeCount | Số lỗ (0 = tự động) | Number of holes (0 = auto) | 0 | 80 | 1 | 0 | tab binding |
| discPitchMm | Khoảng cách rãnh (mm) | Slot spacing (mm) | 10 | 40 | .1 | 25 | binding=0 |
| discNeckMm | Rộng cổ rãnh (mm) | Neck width (mm) | 1.5 | 8 | .1 | 3.5 | binding=0 |
| discNeckLenMm | Dài cổ rãnh (mm) | Neck length (mm) | 2 | 15 | .1 | 6.9 | binding=0 |
| discHeadMm | Rộng đầu rãnh (mm) | Head width (mm) | 2 | 12 | .1 | 6.1 | binding=0 |
| discReachMm | Độ sâu rãnh từ mép (mm) | Slot depth from the edge (mm) | 4 | 25 | .01 | 10.09 | binding=0 |
| combPitchMm | Khoảng cách lỗ (mm) | Hole spacing (mm) | 5 | 30 | .01 | 14.3 | binding=1 |
| combAlongMm | Dài lỗ (mm) | Hole length (mm) | 2 | 15 | .1 | 8 | binding=1 |
| combAcrossMm | Rộng lỗ (mm) | Hole width (mm) | 1 | 10 | .1 | 3 | binding=1 |
| combEdgeMm | Cách mép (mm) | Distance from the edge (mm) | 1 | 15 | .1 | 4 | binding=1 |
| wire3PitchMm | Khoảng cách lỗ (mm) | Hole spacing (mm) | 4 | 20 | .01 | 8.47 | binding=2 |
| wire3AlongMm | Dài lỗ (mm) | Hole length (mm) | 1.5 | 10 | .1 | 4 | binding=2 |
| wire3AcrossMm | Rộng lỗ (mm) | Hole width (mm) | 1.5 | 10 | .1 | 4 | binding=2 |
| wire3EdgeMm | Cách mép (mm) | Distance from the edge (mm) | 1 | 15 | .1 | 3.2 | binding=2 |
| wire2PitchMm | Khoảng cách lỗ (mm) | Hole spacing (mm) | 5 | 25 | .01 | 12.7 | binding=3 |
| wire2AlongMm | Dài lỗ (mm) | Hole length (mm) | 2 | 12 | .1 | 7 | binding=3 |
| wire2AcrossMm | Rộng lỗ (mm) | Hole width (mm) | 2 | 12 | .1 | 5.5 | binding=3 |
| wire2EdgeMm | Cách mép (mm) | Distance from the edge (mm) | 1 | 15 | .1 | 4.8 | binding=3 |
| coilPitchMm | Khoảng cách lỗ (mm) | Hole spacing (mm) | 3 | 15 | .01 | 6.35 | binding=4 |
| coilHoleMm | Đường kính lỗ (mm) | Hole diameter (mm) | 2 | 10 | .1 | 4.5 | binding=4 |
| coilEdgeMm | Cách mép (mm) | Distance from the edge (mm) | 1 | 15 | .1 | 3.5 | binding=4 |

**[Quan sát]** `P:1952074`–`P:1955000`; bảng khổ giấy `Jl` `P:1950274`, hệ gáy `Yl` (end = khoảng chừa đầu/cuối: disc 20, còn lại 4) `P:1950339`.

**Thuật toán:**
1. Kích thước bìa `Xl`: w = giấy.w + overhang (chỉ 1 phía — phía gáy không dư), h = giấy.h + 2·overhang **[Quan sát]** `P:1950555`.
2. Lỗ `Zl` (`P:1950643`) dọc mép trái x=−w/2, căn giữa theo y; số lỗ auto = floor((h−2·end)/pitch)+1; nếu holeCount>0 → min(holeCount, floor(h/pitch)). Disc: cổ chữ nhật (neckLen+1)×neckW từ mép + đầu tròn: reach i=max(neckLen+0.5, discReach), a=head/2, tâm o=(i²−n²−a²)/(2(i−n)), bán kính s=i−o, chỉ lấy phần từ neckLen trở ra (rãnh hình nấm). Coil: lỗ tròn tâm edge+d/2. Comb/wire: chữ nhật across×along tâm edge+across/2 **[Quan sát]**.
3. `Ql` (`P:1951590`): chữ nhật bo r=min(corner, w/2−.5, h/2−.5) − lỗ = `base` **[Quan sát]**.
4. Bìa trước: mode 1 → tấm 0…t, màu khảm phẳng sâu min(inlay, t−0.2) ở mặt trên, `printFlip:true` (in úp mặt hình xuống bàn); mode 2 → `oo`. Bìa sau = cùng `base` đặc, màu `shellColor??baseColor`, dịch x = w+15 **[Quan sát]** `P:1952074`+. `artBox` cover=true (hình phủ kín) w·sizePct × h·sizePct **[Quan sát]**.

**Đầu ra:** object `front` (Front + màu), `back` (Back). `product {width, holes, pitch}` **[Quan sát]**. Nhãn màu "Cover color"/"Back cover color" **[Quan sát]** `I:~14200`.

---

## 6. `bookmark` — Bookmark

**Mục đích:** bookmark 2 mặt (hình trước/sau), nhiều dáng, lỗ tua; có chế độ xuất Laser. `twoSided:!0`, `customShape:!0`, `laserSheets` **[Quan sát]** `P:1962169`.
**Tabs:** `bookmark`, `picture` (Hình), `hole` (Lỗ tua), `back` (Mặt sau). Param `laser` thuộc tab `output` **[Quan sát]**.

| key | VI | EN | min | max | step | def | ghi chú |
|---|---|---|---|---|---|---|---|
| shape | Hình dạng | Shape | 0 | 6 | 1 | 1 | Chữ nhật/Rectangle, Bo góc/Rounded, Vòm/Arch, Mũi nhọn/Pointed, Đuôi nơ/Ribbon, Viền theo hình/Picture outline, Tự chọn/Custom (`nu` `P:1955638`) |
| widthMm | Rộng (mm) | Width (mm) | 20 | 120 | 1 | 50 | |
| heightMm | Cao (mm) | Height (mm) | 40 | 300 | 1 | 160 | |
| thicknessMm | Độ dày (mm) | Thickness (mm) | .8 | 5 | .1 | 2 | |
| style | Hình | Picture | 0 | 1 | 1 | 0 | Phẳng/Flat, Nổi/Raised; showIf laser=0 |
| backStyle | Hình | Picture | 0 | 1 | 1 | 0 | tab back; Flat/Raised; showIf laser=0 |
| cornerMm | Bo góc (mm) | Corner radius (mm) | 0 | 20 | .5 | 4 | adv; showIf shape∈[1..4] |
| inlayMm | Độ sâu hình (mm) | Picture depth (mm) | .2 | 2 | .1 | .6 | adv; showIf style=0 & laser=0 |
| borderMm | Viền (mm) | Outline (mm) | 0 | 10 | .5 | 3 | adv; showIfAny shape=5 hoặc overflow=1 |
| sizePct | Cỡ hình (%) | Picture size (%) | 20 | 300 | 1 | 100 | tab picture |
| artX | Dịch phải (mm) | Move right (mm) | −150 | 150 | .5 | 0 | tab picture |
| artY | Dịch lên (mm) | Move up (mm) | −150 | 150 | .5 | 0 | tab picture |
| artTurn | Xoay (°) | Turn (°) | −180 | 180 | 1 | 0 | tab picture |
| overflow | Tràn viền | Past the edge | 0 | 1 | 1 | 0 | tab picture; Cắt bỏ/Clip, Mở rộng/Extend; showIf shape∈[0,1,2,3,4,6] |
| marginMm | Lề (mm) | Margin (mm) | 0 | 15 | .5 | 4 | tab picture; adv; showIf shape∈[0,1,2,3,4,6] |
| laser | Laser | Laser | 0 | 1 | 1 | 0 | toggle; tab output |
| hole | Lỗ tua | Tassel hole | 0 | 1 | 1 | 1 | tab hole; toggle |
| holeMm | Cỡ lỗ (mm) | Hole size (mm) | 2 | 12 | .5 | 5 | showIf hole=1 |
| holeTopMm | Cách mép trên (mm) | From the top (mm) | 3 | 60 | .5 | 9 | showIf hole=1 & shape∈[0,1,2,3,4,6] |
| holeX | Dịch phải (mm) | Move right (mm) | −50 | 50 | .5 | 0 | showIf hole=1 & shape∈[0,1,2,3,4,6] |

**[Quan sát]** `P:1962169`–`P:1964500` (`vu={laser:0}`, `_u={shape:ru}`, `ru=[0,1,2,3,4,6]` ở `P:1955848`).

**Thuật toán:**
1. Dáng `pu` (`P:1957606`): Rectangle; Arch = rect (w, h−w/2) + tròn r=w/2 ở đỉnh; Pointed = ngũ giác, mũi cao w/2; Ribbon = khấc chữ V đáy sâu 0.35·w (`iu=.35`); bo góc (shape≠0) bằng offset −s/+s rồi scale lại đúng w×h; Custom (6) = viền hình tùy chọn scale giữ tỉ lệ vừa w×h (`su` `P:1955887`) **[Quan sát]**.
2. Hộp đặt hình `lu` (`P:1956670`): inset margin; tránh phần vòm/mũi (y ≤ h/2−w/2), khấc ribbon (y ≥ −h/2+0.35w), lỗ tua (y ≤ top−holeTop−hole/2−margin); Custom: tìm nhị phân 14 vòng hộp lớn nhất nằm trong shape offset −margin (`du` `P:1957009`). Dáng được dịch y để hộp này nằm tâm (`fu`) **[Quan sát]**.
3. `mu` (`P:1958487`): shape 5 → `Ei(art,border)` + nếu có lỗ: móc kiểu keychain (`hi`, góc 90°, lỗ holeMm, vòng rộng 2.5 `au`). Khác: dáng + (overflow=1: phần hình tràn ra có diện tích >0.5 mm² được nối thêm với viền borderMm) − lỗ tròn Ø holeMm tại (holeX, top−holeTop) **[Quan sát]**.
4. `Cu` (`P:1960559`), mỗi mặt dựng bằng `bu` (`P:1959395`): Flat (mode 1) = tấm dày t, khảm màu sâu min(inlay, t−0.2), in úp; Raised hoặc mode 2 = `oo`. Mặt sau dựng trên base lật gương rồi lật 180° (`xu`). Trường hợp: chỉ trước; chỉ sau; 2 mặt khác kiểu → 1 miếng (giữ base của mặt Flat); 2 mặt cùng kiểu → **2 miếng** mỗi miếng dày t/2 (`front` nâng lên t/2, `back` lật) — `pieces=2` (dán lại) **[Suy luận]** về việc dán. Chữ khắc mặt sau cắt sâu min(depthMm, t−0.4) nếu ≥0.1 (`Su`) **[Quan sát]**.
5. **Laser** (`laser=1`): `ku` (`P:1964850`) xuất các "sheet" 2D: `front` = layer `CUT` (viền) + `ENGRAVE` (màu khác màu nền + chữ khắc), `back` tương tự (lật gương, dịch); y bị đảo dấu (tọa độ SVG). 3D preview `Au` (`P:1965292`): tấm đặc + lớp khắc dày min(0.2, t/3) màu `#4a3426` (`Tu`) ở mặt trên/dưới **[Quan sát]**. UI hiện thẻ thứ 3 "Laser" khi sản phẩm có `laserSheets` **[Quan sát]** `A:1123548`.

**Đầu ra:** part `base` (Bookmark) + màu; object `bookmark` hoặc `front`/`back`; `product {width,height,thickness,pieces,(laser)}` **[Quan sát]**. Định dạng file của laser sheets do module xuất khác xử lý **[Chưa rõ]**.

---

## 7. `layerframe` — Tranh xếp lớp / Layer frame

**Mục đích:** tranh nhiều lớp (mỗi màu một tấm, xếp cách nhau tạo chiều sâu) kèm khung hộp + viền trước. **[Quan sát]** `P:1966955`.
**Tabs:** `picture` (Hình), `layers` (Lớp), `frame` (Khung).

| key | VI | EN | min | max | step | def | ghi chú |
|---|---|---|---|---|---|---|---|
| widthMm | Rộng tranh (mm) | Picture width (mm) | 40 | 300 | 1 | 140 | |
| heightMm | Cao tranh (mm) | Picture height (mm) | 40 | 300 | 1 | 140 | |
| fit | Cách đặt hình | Picture fit | 0 | 1 | 1 | 0 | Lấp đầy (cắt)/Fill (crop), Vừa bên trong/Fit inside |
| sizePct | Cỡ hình (%) | Picture size (%) | 30 | 250 | 1 | 100 | |
| artX / artY | Dịch hình sang phải / lên (mm) | Move picture right / up (mm) | −100 | 100 | .5 | 0 | `yi(100)` |
| plateMm | Độ dày lớp (mm) | Layer thickness (mm) | .4 | 3 | .1 | .8 | tab layers |
| spacingMm | Khoảng cách lớp (mm) | Layer spacing (mm) | .4 | 10 | .1 | 2.2 | tab layers |
| ringMm | Viền lớp (mm) | Layer rim width (mm) | 1 | 6 | .5 | 2 | tab layers; adv |
| pegMm | Đường kính chốt (mm) | Peg diameter (mm) | 1.5 | 6 | .5 | 3 | tab layers; adv |
| frame | Khung | Frame | 0 | 1 | 1 | 1 | tab frame; toggle |
| wallMm | Thành khung (mm) | Frame wall (mm) | 1 | 8 | .1 | 1.6 | showIf frame=1 |
| backMm | Mặt sau khung (mm) | Frame back (mm) | 1 | 6 | .1 | 2.4 | showIf frame=1 |
| bezelMm | Viền trước (mm) | Front frame (mm) | 1 | 6 | .1 | 2.4 | showIf frame=1 |
| fitMm | Khe hở lắp (mm) | Fit clearance (mm) | 0 | 1 | .05 | .3 | adv; showIf frame=1 |

**Thuật toán (`P:1966955`+):**
1. Khung tranh = chữ nhật w×h (`Nu`). Thứ tự lớp = `mode2.order` (có thêm chữ nổi, `Gr` `P:89254`), rồi các màu còn lại; mỗi màu ∩ khung **[Quan sát]**.
2. a = min(plate, spacing), o = max(spacing, a), c = backMm (nếu có khung) hoặc 0. Lớp thứ n đặt ở z = c + n·o, dày a. Vùng lớp n = hợp các vùng n…cuối (lớp đầu là tấm đầy đủ nhất, nằm thấp nhất) **[Quan sát]**; diễn giải: lớp n=0 là lớp nền/sau cùng **[Suy luận]** (UI ghi "Lớp trước ở trên cùng; kéo để đổi thứ tự" `I:~15050`).
3. Mỗi lớp + vành (rect (w+2ring)×(h+2ring) − rect (w−0.1)×(h−0.1)); vành kéo dài thêm từ i+a đến i+o làm cột đệm khi spacing>plate **[Quan sát]**.
4. Chốt: với n>0 và b=o−a>0.05, mỗi mảnh rời của vùng lớp không chạm mép khung (bên trong khung co 0.1) → tìm điểm trong bằng offset −(r+0.3) (hoặc chốt nửa cỡ r/2 với +0.2), thêm trụ Ø pegMm từ z i−b…i+0.01 để tựa lên lớp dưới (`Fu` `P:1966664`) **[Quan sát]**.
5. Khung (`Pu` `P:1966522`): trong = w+2ring+2fit, ngoài = trong+2wall, bo r=1; hộp = đáy 0…backMm + thành 0…s (s = đỉnh chồng lớp + fitMm); viền trước = ngoài − rect(w×h), z s…s+bezel, `printFlip` **[Quan sát]**.

**Đầu ra:** mỗi lớp 1 part `kind:"color"` (màu vùng), `object:"layer-n"`; `frame-box` (Frame) và `frame-bezel` (Front frame), màu `baseColor` ("Frame color"). `product {layers, spacing, back, stackTop, bezelZ, frame}` **[Quan sát]**.

---

## 8. `clock` — Đồng hồ / Clock

**Mục đích:** mặt đồng hồ treo tường in hình, có vạch/số, lỗ tâm + hốc máy cho bộ máy kim (quartz). **[Quan sát]** `P:1972078`.
**Tabs:** `dial` (Mặt), `markers` (Số), `movement` (Máy).

| key | VI | EN | min | max | step | def | ghi chú |
|---|---|---|---|---|---|---|---|
| shape | Hình mặt | Dial shape | 0 | 2 | 1 | 0 | Tròn/Circle, Theo viền hình/Picture outline, Vuông bo góc/Rounded square |
| sizeMm | Cỡ đồng hồ (mm) | Clock size (mm) | 110 | 400 | 1 | 200 | live xy |
| fit | Cách đặt hình | Picture fit | 0 | 1 | 1 | 0 | Fill (crop)/Fit inside; showIf shape∈[0,2] |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 0 | 20 | .5 | 4 | showIf shape=1 |
| cornerMm | Bo góc (mm) | Corner radius (mm) | 0 | 100 | 1 | 20 | adv; showIf shape=2 |
| artX / artY | Dịch hình sang phải / lên (mm) | Move picture right / up (mm) | −150 | 150 | .5 | 0 | `yi()` |
| thicknessMm | Độ dày mặt (mm) | Dial thickness (mm) | 2 | 15 | .2 | 4 | build3d; live z |
| inlayMm | Độ sâu hình (mm) | Picture depth (mm) | .2 | 1.2 | .1 | .6 | adv; build3d |
| markers | Vạch số | Markers | 0 | 3 | 1 | 3 | tab markers; Không/None, Vạch/Ticks, Số/Numbers, Số + vạch |
| numerals | Các số | Numbers | 0 | 1 | 1 | 0 | "1 - 12", "12 · 3 · 6 · 9"; showIf markers∈[2,3] |
| numberSizeMm | Cỡ số (mm) | Number size (mm) | 5 | 60 | .5 | 18 | showIf markers∈[2,3] |
| insetMm | Cách mép (mm) | Distance from the edge (mm) | 2 | 40 | .5 | 8 | showIf markers∈[1,2,3] |
| tickLenMm | Dài vạch (mm) | Tick length (mm) | 2 | 30 | .5 | 8 | showIf markers∈[1,3] |
| tickWidthMm | Rộng vạch (mm) | Tick width (mm) | 1 | 10 | .5 | 2.5 | showIf markers∈[1,3] |
| markLayers | Số lớp vạch (một màu) | Marker layers (single color) | 1 | 20 | 1 | 4 | adv; showIf markers∈[1,2,3] |
| centerMm | Độ dày ở tâm (mm) | Thickness at the center (mm) | 1.2 | 3.5 | .1 | 2 | tab movement; build3d |
| holeMm | Lỗ tâm (mm) | Center hole (mm) | 8 | 10 | .1 | 8.6 | tab movement; adv; build3d |
| pocketMm | Hốc máy (mm) | Movement pocket (mm) | 56 | 70 | .5 | 57.5 | tab movement; adv; build3d |

**Hằng `zu`:** `movement 56.4, flangeMm 1.5, threadMm 5.5, rubberMm 1.4, washerMm .2, nutMm 1.8, clearMm 16, hourHandMm 8.6` **[Quan sát]** `P:1970627`.

**Thuật toán:**
1. Mặt (`Hu` `P:1970971`): Circle Ø sizeMm (256 cạnh); Rounded square size, r=min(corner, size/2−.01); Picture outline = `Ei(art,border)` ∪ tròn r = 56.4/2·√2+3 ≈ 42.88 (luôn đủ che máy) → `Ei(...,0)` **[Quan sát]**.
2. Vạch/số (`Uu` `P:1971237`): R = size/2 − inset; 12 vạch hình chữ nhật, vạch 12/3/6/9 rộng ×1.6 dài ×1.3, xoay 30°/vạch; số dùng font nhúng `bundled:be-vietnam-pro` (`Ru`), tâm ở bán kính R − (có vạch ? tickLen·1.3+1.5 : 0) − numberSize·0.55; numerals=1 chỉ 3/6/9/12 **[Quan sát]**. Trong worker, vạch thành vùng màu `marks` (màu `shellColor??baseColor` — UI "Numbers color"), `heightMm = markHeightMm??1` (clock không có markHeightMm → 1 mm), `bandLayers = markLayers`; các màu hình bị trừ đi vùng vạch **[Quan sát]** `W:2279944`, `W:2280025`.
3. Build (`P:1972078`+): vùng in = mặt − tròn Ø16 (`clearMm`) ở tâm. Mode 2 → `oo` dày t. Mode 1 → mặt 0…t, màu khảm phẳng sâu e=min(inlay, center−0.4) ở mặt trên, `printFlip:true`. Trừ khỏi base: lỗ tâm Ø holeMm xuyên; nếu f = t − centerMm > 0.05 → hốc vuông pocketMm×pocketMm từ mặt sau z −1…f (để tâm còn dày đúng centerMm) **[Quan sát]**.
4. Kiểm tra kim: face = f − 1.4 − 1.5; `handGap` = face + 8.6 − (đỉnh cao nhất các part); <0.5 mm → `warn.clockHands` "Hình quá cao, chạm kim: còn {mm} mm dưới kim giờ (giảm số lớp)" **[Quan sát]** `P:1976086`, `P:92079`, `I:15331`.

**Đầu ra:** part `base` (Dial, `baseColor` — "Dial color") + màu/bands + vùng `marks`; object `dial`. `product {face, centerTop, pocket, size, handGap}`. **STL nhúng (`clock-movement`, `clock-rubber-washer`, `clock-nut`, `clock-hour-hand`, `clock-minute-hand`, `clock-second-hand`)** chỉ được tải trong preview 3D (`T:222090` khai báo URL; `rs()` tải 6 file; component vẽ máy tại z=face, long đền tại face+1.5, đai ốc tại centerTop, kim giờ/phút/giây tại face+8.6/12.4/13.2, quay theo giờ thực; màu #3a3438/#2b2b2b/#9a8f97/#1d1a1c/#d23c2c) **[Quan sát]** `T:228528`–`T:230300`. Không thấy pipeline/worker tham chiếu các STL này → không nằm trong file xuất **[Suy luận]** (grep `clock-` trên mọi `*.js` chỉ ra `T`).

---

## 9. `poptext` — Chữ pop / Pop text

**Mục đích:** "topper" tròn (hoặc theo hình) với tối đa 3 dòng chữ uốn cong lấp đầy đĩa (+ biểu tượng emoji vector), viền chữ, gợn sóng, đế MagSafe tùy chọn. `ownsTexts:!0`, có `ownColors` + `layoutTexts` **[Quan sát]** `P:2007666`.
**Tabs:** `words` (Chữ), `fit` (Căn chỉnh), `wave` (Gợn sóng), `base` (Đế). Tab words có UI dòng chữ riêng (`kR`) **[Quan sát]** `A:1125007`.

| key | VI | EN | min | max | step | def | tab / ghi chú |
|---|---|---|---|---|---|---|---|
| outline | Viền chữ | Outline | 0 | 1 | 1 | 0 | words; toggle |
| outlineMm | Độ dày viền (mm) | Outline width (mm) | .4 | 4 | .1 | 1.2 | words; showIf outline=1 |
| outlineHeightMm | Chiều cao viền (mm) | Outline height (mm) | .4 | 10 | .2 | 2 | words; showIf outline=1 |
| sideMarginMm | Lề cạnh (mm) | Side margin (mm) | .5 | 4 | .25 | 1.5 | fit |
| lineSpacingMm | Khoảng cách dòng (mm) | Line spacing (mm) | 0 | 3 | .1 | .9 | fit |
| letterSpacingPct | Khoảng cách chữ (%) | Letter spacing (%) | −10 | 30 | 1 | 2 | fit |
| wordSpacePct | Khoảng cách từ (%) | Word space (%) | 0 | 100 | 5 | 35 | fit |
| widthFillPct | Lấp chiều ngang (%) | Width fill (%) | 70 | 100 | 1 | 94 | fit |
| roundWarpPct | Uốn theo vòng tròn (%) | Round warp (%) | 0 | 100 | 5 | 100 | fit |
| glyphWidthPct | Bề ngang chữ (%) | Letter width (%) | 65 | 145 | 5 | 100 | fit; adv |
| glyphHeightPct | Chiều cao chữ (%) | Letter height (%) | 70 | 125 | 5 | 100 | fit; adv |
| wave | Dòng gợn sóng | Wavy lines | 0 | 1 | 1 | 1 | wave; toggle |
| waveMm | Độ gợn (mm) | Wave amount (mm) | 0 | 6 | .25 | 2.5 | wave; showIf wave=1 |
| waveCycles | Số gợn | Wave cycles | .5 | 2.5 | .25 | 1 | wave; showIf wave=1 |
| wavePhaseDeg | Pha gợn (°) | Wave phase (°) | −180 | 180 | 10 | 0 | wave; showIf wave=1 |
| shape | Hình dạng | Shape | 0 | 1 | 1 | 0 | base; Tròn/Circle, Hình ảnh/Picture |
| diameterMm | Kích thước (mm) | Size (mm) | 30 | 120 | 1 | 40 | base |
| baseMm | Độ dày đế (mm) | Base thickness (mm) | .6 | 6 | .2 | 1 | base |
| markHeightMm | Chiều cao chữ (mm) | Text height (mm) | 1 | 10 | .2 | 4 | base |
| topRoundMm | Bo cạnh trên (mm) | Top edge round (mm) | 0 | 1.5 | .05 | .15 | base; adv |
| adaptor | Đế MagSafe | Adaptor | 0 | 1 | 1 | 1 | base; toggle |

**Thuật toán:**
1. Đế (`jd` `P:2004971`): tròn bán kính `yd = max(diameter/2, adaptor?20:0)` (`bd` `P:2002630`); shape=1 → `Ad` (`P:2003990`): viền hình tùy chọn, tìm tâm "xa biên nhất" bằng lưới 9×9 quanh trọng tâm (±0.2·h, phạt 0.3·độ lệch), fallback bằng tìm nhị phân offset 16 vòng; scale để max(w,h)=diameter; nếu adaptor và bán kính nội tiếp·scale < 20 → phóng to (`shapeGrown`, UI "Đã phóng to để vừa đế MagSafe" `I:56171`) **[Quan sát]**.
2. Dòng chữ (`Nd`): tối đa 3 text không rỗng; trọng số dòng = max(.2, sizeMm/10) **[Quan sát]** `P:2005657` lân cận. Xếp glyph (`md` `P:2000220`) ở cỡ chuẩn 10 mm (`dd`), letterSpacing % của 10 mm; ký tự emoji ánh xạ sang 23 hình vector (`rd`/`nd`: heart, star, sparkle, flower, paw, smile, cat, moon, sun, bolt, music, crown, cloud, clover, bow, pumpkin, ghost, skull, bat, spider, candy, tombstone, witchhat), cao = 1.1 × chiều cao chữ "H"; bỏ variation selector/ZWJ/skin tone **[Quan sát]** `P:1995630`, `P:1999199`.
3. Uốn (`vd` `P:2001383`): tọa độ chuẩn hóa (x,y)∈[−1,1]; ánh xạ vuông→đĩa (x·√(1−y²/2), y·√(1−x²/2)) trộn với tuyến tính ·1/√2 theo `roundWarp`; nhân r(θ) (tròn: hằng; hình: bán kính ray-cast của shape offset −margin, lọc min ±15° rồi trung bình) ; gợn: y += u(1−y²)·sin(π·cycles·x + phase), u=min(0.4, waveMm/r̄); bề ngang = min(1, widthFill·glyphWidth); tổng chiều cao 2·glyphHeight chia theo (cao glyph × trọng số); khoảng dòng tăng ×1.12 tối đa 20 lần đến khi các dòng offset lineSpacing/2 không chồng; cắt theo vùng clip (r − sideMargin − outlineMm) (`Md` `P:2005086`) **[Quan sát]**.
4. Vùng màu (`Id`/`Ld` `P:2005657`/`P:2006229`): `marks-outline` (offset chữ outlineMm − chữ, ∩ đế offset −sideMargin; màu vỏ; cao min(outlineHeight, markHeight)); mỗi nhóm slot nhựa → `marks-<slot>` cao markHeight; bandLayers nhóm đầu = round((markHeight − outline)/layer), nhóm sau max(2, round(·/4)) **[Quan sát]**.
5. Build: `oo` với đế dày baseMm; mode 1 → part màu được bo mép trên `Bd` (`P:2007225`, 4 bậc offset 1/4 tròn, r=min(topRound, h/2)). Adaptor: mesh nhúng `Ku` (465 đỉnh, Ø40×4 mm) lật 180° quanh X, z −4…0 (`cd.disc 1.2 + ringH 2.8`); hằng `cd={disc:1.2,ringIn:15.5,ringOut:16.5,ringH:2.8,lugOut:19,lugH:1,lugW:2}` **[Quan sát]** `P:1976109`, `P:1999940`, `P:2007048`. Vành r 15.5–16.5 khớp vòng nam châm MagSafe **[Suy luận]**.

**Đầu ra:** object `topper` (base + chữ), `adaptor` (màu `baseColor`). `product {thickness, radius, shapeW/H, shapeGrown}` **[Quan sát]**. Preview nhận diện poptext có adaptor **[Quan sát]** `T:238000`.

---

## 10. `rect` — Hình chữ nhật bo góc / Rounded rectangle

**Mục đích:** tấm nền chữ nhật bo góc chứa hình (dạng sticker/keychain); không có `body` → dùng bộ dựng tấm phẳng + móc khóa chung **[Quan sát]** `P:2010621` (trong registry `Ud`), so sánh `W:2276860` (`o.body&&!o.keychainOnBase ? base : so(...)` — không có body thì gắn móc khóa).
**Tabs:** `base` (Đế, `_i`), `keychain` (Móc khóa, `vi`).

| key | VI | EN | min | max | step | def | ghi chú |
|---|---|---|---|---|---|---|---|
| widthMm | Rộng (mm) | Width (mm) | 2 | 300 | .5 | 18 | adv |
| heightMm | Cao (mm) | Height (mm) | 2 | 300 | .5 | 18 | adv |
| radiusMm | Bo góc (mm) | Corner radius (mm) | 0 | 50 | .5 | 2 | adv |
| loop | Móc khóa | Keychain loop | 0 | 1 | 1 | 0 | `gi(false)`, toggle, tab keychain |
| loopAngle | Vị trí móc khóa (°) | Keychain position (°) | 0 | 359 | 1 | 90 | showIf loop=1 |
| loopHoleMm | Lỗ móc khóa (mm) | Keychain hole (mm) | 2.5 | 8 | .5 | 4 | showIf loop=1 |
| loopWidthMm | Độ dày vòng móc khóa (mm) | Keychain ring width (mm) | 1.5 | 5 | .5 | 2 | showIf loop=1 |

**Thuật toán (`P:2010621`):** r = min(radiusMm, w/2−.001, h/2−.001); chữ nhật (w−2r)×(h−2r) offset r (Round, 96 cạnh), tâm đặt tại tâm bbox của hình; ∪ hình (hình tràn ra ngoài vẫn được giữ) → `Ei(...,0)` (nối đảo) **[Quan sát]**. Độ dày/màu theo cài đặt chung `mode1.baseMm` / `mode2.baseLayers` (UI "base.thickness"/"base.baseLayers") **[Quan sát]** `A:1125007`.

**Đầu ra:** như sản phẩm phẳng mặc định (base + màu + móc khóa); cảnh báo chung `keychainThin` nếu vòng móc <1.6 mm **[Quan sát]** `P:91951`.

---

## Ghi chú độ tin cậy
- Toàn bộ bảng tham số được đọc trực tiếp từ literal trong `P` (không chạy code). Ý nghĩa "Raised/Flat" trong mode 2 → luôn dùng `oo` (không khảm) **[Quan sát]** `P:1959395` (`r.mode===1&&i` mới khảm).
- Logic gắn `marks` (clock) chỉ tìm thấy trong `W`, không có trong `P` **[Quan sát]** (grep `marksName`). Phần art-building chung có lẽ chỉ nằm trong worker **[Suy luận]**.
