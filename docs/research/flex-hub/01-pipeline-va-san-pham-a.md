# Flex Hub v0.2.24 — Pipeline "ảnh → 3D nhiều màu" và 10 sản phẩm (nhóm A)

Phạm vi: đọc tĩnh frontend đã giải nén. Không chạy bundle. Script phụ trợ (chỉ đọc text): `scratchpad/agent-scripts/{sl,pp,grep,fnidx,obj,meshstats}.py`.

## Quy ước dẫn chứng

| Viết tắt | Tệp (trong `flexhub-web/assets/`) |
|---|---|
| `P:` | `pipeline-DVPZCkNy.js` (bản UI/main-thread: định nghĩa sản phẩm + hình học, store, gọi worker) |
| `W:` | `worker-Cc0bSqjO.js` (bản worker thực sự build/export; chứa bản sao gần như y hệt các hàm hình học của `P`, đổi tên biến) |
| `CW:` | `colorWorker-BQPwzs5C.js` |
| `App:` | `App-CXT8Oy65.js` |
| `C:` | `common-BI3l0mmp.js` |
| `D:` | `design-mDRcZtB5.js` |
| `I18N:` | `i18n-EFUBxO61.js` |

Số sau dấu `:` là charOffset trong tệp. Nhãn: **[Quan sát]** = đọc thẳng từ code; **[Suy luận]** = suy ra; **[Chưa rõ]** = không xác định được từ JS.

Bảng đối chiếu tên hàm giữa P và W (cùng logic) **[Quan sát]**: `Ei`(P:99364)=`vo`(W:361097) · `hi`(P:97331)=`so`(W:359232) · `ri`(P:92484)=`ra`(W:106464) · `ii`(P:92904)=`la`(W:107270) · `oi`(P:93521)=`da`(W:107887) · `ci`(P:94059)=`pa`(W:108425) · `gi`(P:97766)=`co`(W:~359660) · outline `Di`(P:99749)=`yo`(W:361491) · clicker `Sa`(P:302094)=`Q`(W:563879) · croc P:340762=W:602569 · lightbox P:1069114=W:1330919 · penholder P:1073445=W:1335252 · bracelet P:1077443=W:1339272 · canopener P:1083351=W:1345178 · jar P:1394631=W:1656436 · toolbox P:1626078=W:1887881 · foldbox P:1874885=W:2136742.

Lưu ý tên hàm tiện ích khác nhau giữa P và W: trong P, `h`=lọc đa giác diện tích>0 (P:44414), `g`=lọc giữ lỗ có |diện tích|>0.05 mm² (P:44414), `v`=“đóng khe” offset +0.2/−0.2 Miter + simplify 0.01 (P:44765, hằng `_=.4` P:44700), `y`=union+`v` (P:44889). Trong W lần lượt là `_`, `v`, `y`(W:44797 vùng), `b`. **[Quan sát]**

---

# PHẦN 1 — Pipeline chung "ảnh → 3D nhiều màu"

## 1.1 Kiến trúc tổng thể

1. **Nạp ảnh/SVG** – `Ch(bytes,name)` (P:2484937): xác định loại theo đuôi (`xh`: png/jpg/jpeg/webp/svg), tạo blob URL, chuyển màn hình `image` hoặc `colors` (svg). Ảnh raster → `oh` → `Sf` = Tauri command `load_image` (P:2470591); SVG → `sh` → `wf` = `import_svg` (P:2470704). **[Quan sát]**
2. **Chuẩn bị ảnh (prep)** – xem trước bằng `bf` = Tauri `prepare_image{image,prep}` trả PNG (P:2470467), debounce 150 ms (`_h`, P:2484145). Prep chỉ áp dụng khi bấm “Trace again” (`bh`, P:2484585). **[Quan sát]**
3. **Vector hóa + lượng tử màu** – `Ym()` (P:2481438) gọi `Cf` = Tauri `trace_image{image,n:colorCount,opts,prep}` (P:2470631). Kết quả: `regionSet` (mỗi region = 1 màu: `{id,color,visible,polygons:[{outer,holes}]}`, đơn vị px) + `palette`. Việc lượng tử màu ảnh raster và trace (VTracer/VectorCraft) **chạy trong backend Rust**, không có trong JS → thuật toán cụ thể **[Chưa rõ]**.
   - Nếu `opts.engine==='vectorcraft'`: kết quả được gửi tiếp qua worker op `prepareSvg` (`Rf`, P:2472153) → `Lp` gộp màu (W:2284647). **[Quan sát]**
   - SVG nhập vào cũng đi `prepareSvg` với `n=colorCount`. **[Quan sát]** (P:2481438 nhánh `t?Km(...)`)
4. **Chỉnh sửa vùng (history ops)** – op `adjust` (`zf`, P:2472225) → `Ue/He` trong worker (W:62014). Các op: `removeSpecks{minAreaMm2}`, `smooth{radiusMm}`, `simplify{toleranceMm}`, `mergeColor{fromId,intoId}`, `deleteRegion`, `recolor{id,hex}`, `toggleVisible`, `deletePieces`, `movePiece(s)`, `paintArea`, `smoothArea` (W:62048…62342). Đơn vị mm được đổi sang px qua `widthPx/widthMm`. Undo/redo: `zr={ops:[],cursor:0}`, `Vr/Hr/Ur` (P:88885). **[Quan sát]**
5. **Build 3D** – `Rm()` hẹn giờ `km=120` ms (P:2479146), `Lm()` (P:2479333) gửi op `build` (`Bf`, P:2472303) sang worker `worker-Cc0bSqjO.js` (lane `main`). Worker: `LS` (W:3292668) → `case build` (W:3293123): `xp` (prep cross-section, W:2275189, có cache 3 bản) → `Np` (dựng parts, W:2281796) → `D()` lấy mesh (W:46154). **[Quan sát]**
6. **Export** – op `export{baseName}` → `jh` (W:2317989) → ghi file bằng Tauri `write_export_file` (`Ef`, P:2470840), có thể mở Bambu Studio (`open_in_bambu`, P:2470964). **[Quan sát]**

Hình học dùng **manifold-3d** (WASM `manifold-BE4c7gO-.wasm`, glue Emscripten ở đầu P và W: `CrossSection.offset/union/subtract/extrude`, `Manifold.union/difference/hull`…, P:9118–12059). **[Quan sát]**

## 1.2 Prep ảnh (prep.*)

Mặc định `yf` (P:2470314) **[Quan sát]**:
`{removeBackground:null, transparent:null, masks:[], upscale:1, smoothRadius:0, brightness:0, contrast:0, saturation:0, sharpenRadius:1, sharpenAmount:0}`

UI (App:380465–381800) **[Quan sát]**:

| Điều khiển | Khóa | Giá trị | i18n |
|---|---|---|---|
| Xóa nền (toggle) + `prep.tolerance` “Sai số (%)” | `removeBackground` | null (tắt) hoặc 0–60, bước 1, bật = 12 (`ns=12`) | `g.img.removeBg`, I18N:7351/48196 |
| Làm mượt (median filter, px) | `smoothRadius` | {0(Tắt),1,2,3} (`ts`) | `prep.smooth` I18N:7223, hint I18N:39002 |
| Phóng to | `upscale` | {1,2,4}× (`$o`); nút bị khóa nếu `w*h*k² > 8.4e6` px (`es=84e5`) → “Ảnh đã đủ lớn” | `prep.upscale`, `prep.upscaleBig` I18N:7263 |

Các khóa `brightness/contrast/saturation/sharpen*`, `masks`, `transparent` có trong state nhưng không thấy điều khiển ở đoạn UI này → **[Chưa rõ]** nơi chỉnh. Toàn bộ xử lý pixel nằm trong Rust (`prepare_image`) → **[Chưa rõ]** thuật toán.

## 1.3 Trace (vector hóa) & số màu

- `colorCount` mặc định 4, kẹp 1–8 (`ch`, P:2483370; UI C:17887 min 1 max 8). **[Quan sát]**
- Tùy chọn trace mặc định `_f` (P:2470094) **[Quan sát]**: `mode:'spline'`, `filterSpeckle:4`, `cornerThreshold:60`, `lengthThreshold:4`, `spliceThreshold:45`, `simplify:0`, `engine:'vtracer'`, `vc:` preset VectorCraft “6 Colors”, `vcSimplify:null`.
- Giới hạn UI (C:16524–16937) **[Quan sát]**: filterSpeckle 0–64 (1); simplify 0–5 (0.25); cornerThreshold 0–180 (1); lengthThreshold 3.5–10 (0.5); spliceThreshold 0–180 (1). Mode: pixel/polygon/spline (I18N:4575–4654).
- Preset VectorCraft `gf` (P:2468821): Default, Auto Color (6 màu, palette automatic), High/Low Fidelity Photo, 3/6/16 Colors, Shades of Gray, Black and White Logo, Sketched Art, Silhouettes, Line Art, Technical Drawing, Flat Logo; tham số: `mode(color|grayscale|blackAndWhite|logo)`, `palette(limited|fullTone|automatic)`, `threshold`, `colorDetail`, `paths`, `corners`, `noise`, `method(abutting|overlapping)`, `ignoreWhite`, `snapCurvesToLines`… **[Quan sát]**

### Gộp màu (chỉ nhánh SVG / VectorCraft) — `Lp`+`Ip` (W:2284647, W:2284035) **[Quan sát]**
1. Nếu số màu khác nhau ≤ n → giữ nguyên.
2. Tính diện tích mỗi màu (union cross-section).
3. Gom cụm kết tụ (agglomerative): mỗi bước tìm cặp có khoảng cách OKLab nhỏ nhất (`Fp=on('oklab')` = differenceEuclidean OKLab [Suy luận]), trộn trung bình OKLab **có trọng số diện tích**, lặp tới khi còn n cụm.
4. Cụm 1 phần tử giữ hex gốc; cụm gộp lấy hex trung bình. Region mới id `c-<hex>`; polygon = union các phần.

### colorWorker — KHÔNG phải lượng tử màu
`colorWorker` (CW:85814 `mr`, CW:86463 `onmessage`) là pool worker phụ (số luồng `max(1,min(6,cores-1))`, W:3290979; điều phối `oS`, W:3291163) chạy song song bước **region(px) → cross-section(mm) + lọc chi tiết nhỏ** (cùng logic `ta`, W:105818) khi có ≥2 region. Nó nhúng culori (bảng màu CSS) và manifold. **[Quan sát]**

## 1.4 Từ region (px) sang cross-section (mm) — `yp`, `ta`, `Op`

`yp` (W:2274848) **[Quan sát]**:
- Sản phẩm thường (không có `body`): hệ số `k = widthMm / widthPx` (widthMm = “Chiều rộng in”, mặc định 100, UI 10–400, App:1078935).
- Sản phẩm `body`: gọi `Op` (W:2279839) với `artBox(params)` → bbox các region đang hiện; `k = (cover? max : min)(w/bboxW, h/bboxH)`; nếu có `r` thì giới hạn thêm theo bán kính; hình được **căn tâm bbox vào gốc (0,0)**, rồi xoay `place.turn` và dịch `place.dx/dy` (= `artX/artY`, hàm `bi`, P:98664).
- `minFeatureMm`: lấy từ params sản phẩm nếu có (các body product có `minFeatureMm` mặc định **0**), ngược lại lấy của mode (mặc định **0.4**, P:90350).

`ta(region)` (W:105818; CW:85814) **[Quan sát]**:
1. Polygon (outer+holes) → `CrossSection(NonZero)`.
2. Trừ tâm (body) hoặc giữ; `scale([k,−k])` (lật trục Y ảnh); body: xoay/dịch; thường: `translate(0, heightPx*k)` (hình nằm trong 0..W × 0..H).
3. Lọc chi tiết mảnh: `a = minFeatureMm/2`; **opening** `offset(−a,Round)` rồi `offset(+a,Round)`, `simplify(0.01)` (`$i=.01`, W:105681).
4. `removedMm2` (`na`, W:106206): nếu phần mất <5% thì lấy hiệu diện tích, ngược lại chỉ cộng các mảnh bị mất có |diện tích| ≥ minFeature².

Ghép trong `xp` (W:2275189) **[Quan sát]**: các lớp “layer” (ảnh phụ), chữ (text) và marks được **trừ khỏi** các vùng màu bên dưới (vật trên cùng thắng); text `raised` thành màu riêng, text khác thành `engraves` (khắc, `Dp`, W:2279114: cắt sâu `min(depthMm, top−bottom−0.4)`, bỏ qua nếu <0.1). `art` = union tất cả màu; `base = product.base(art, params)`; nếu sản phẩm không có `body` hoặc có `keychainOnBase` thì gắn móc khóa (`so`).

## 1.5 Hai chế độ in

Mặc định project `Zr` (P:90350) **[Quan sát]**: `colorCount 4, mode 1, mode1:{baseMm:1, widthMm:100, minFeatureMm:0.4}, mode2:{order:[], baseLayers:3, layerMm:0.2, firstLayerMm:0.2, widthMm:100, minFeatureMm:0.4}, template:{id:'outline'}, baseColor:{hex:'#ffffff', slot:1}`. Màu mới từ trace: `heightMm:1, bandLayers:3`, slot tự cấp từ `min(16, index+2)` tránh trùng (`Qr`, P:90599). Slot tối đa 16.

UI (App:1078935–1079617) **[Quan sát]**: base.thickness 0.2–10 (bước = layerMm); layerMm 0.04–0.6 (0.02); firstLayerMm 0.08–0.6 (0.02); baseLayers 1–50; minFeature 0–3 (0.05) (ẩn khi sản phẩm có body); colors.height min `N`–10; colors.layers 1–50.

### Mode 1 · “màu cạnh nhau” (side by side) — `ri` (P:92484) **[Quan sát]**
- Part `base`: `base.extrude(baseMm)`, z 0→baseMm, màu baseColor.
- Mỗi màu: `cs.extrude(heightMm)` đặt tại z = baseMm → baseMm+heightMm. Các màu nằm cạnh nhau trên đế, mỗi màu 1 part/1 slot (in đa vật liệu AMS).

### Mode 2 · “mỗi lớp một màu” (color per layer) — `ii`+`oi`+`si`+`ci` (P:92904–94551) **[Quan sát]**
1. `baseTop = firstLayerMm + (max(1,round(baseLayers))−1)·layerMm` (mặc định 0.6 mm).
2. Thứ tự dải: `mode2.order` (kéo thả), text raised được nối thêm (`Gr`), màu còn lại nối cuối.
3. Mỗi màu = 1 dải (band) dày `max(1,round(bandLayers))·layerMm` xếp chồng: z0 = đỉnh dải trước; ghi `firstLayer` (số thứ tự lớp bắt đầu).
4. Footprint dải i = **union các màu từ i tới cuối** (`oi`: duyệt ngược, cộng dồn, làm sạch `g`) → dải dưới phủ cả diện tích các màu phía trên (hình bậc thang), nên in 1 vật thể đơn và đổi filament theo lớp.
5. Cache theo khóa `bands:<id#hash>` (tối đa 4).
- Cảnh báo `showThrough`: dải < 3 lớp và độ sáng OKLab của màu dưới chênh ≥0.2 (`ni`, P:92353).

## 1.6 Đế, viền, móc khóa

### Viền sticker `Ei(art, borderMm)` (P:99364) **[Quan sát]**
1. `n = h(art)` (chỉ giữ đa giác dương = lấp lỗ).
2. Nếu border>0: `Ti` (P:99166): border ≤0.6 → `offset(t,Round)`; ngược lại simplify 0.02 → offset 0.5 (8 seg) → simplify 0.05 → offset (t−0.5) (64 seg).
3. Trong khi còn >1 mảnh: closing với e = 0.5,1,2,…,128 mm (`offset(+e)` rồi `offset(−e)`, Round, 48 seg) và union với hình cũ.
4. Nếu vẫn >1 mảnh → **convex hull**. Kết quả: đúng 1 mảnh liền.

### Móc khóa (keychain loop) — `gi`, `fi`, `pi`, `mi`, `hi` (P:96064–97653) **[Quan sát]**
- Kích thước `fi(holeMm,widthMm)`: bán kính lỗ `hole=d/2`, vòng ngoài `outer=hole+width`, `out=outer−0.5`, cầu nối `bridge=1.5·outer`.
- Vị trí `pi`: tia từ tâm bbox theo góc `loopAngle`, lấy giao xa nhất với viền (`edge`); dịch tâm vòng ra ngoài tới khi khoảng cách từ tâm vòng tới viền ≥ hole+1 mm (bước 0.5, tối đa out+30, rồi chia đôi tới sai số 0.02).
- Hình `mi`: hình tròn `outer` (64 seg) + chữ nhật cầu nối dài `out+2`, rộng `bridge` (từ x=−2 tới tâm vòng) − lỗ tròn `hole`; xoay theo góc; đặt tại `edge`.
- `hi`: union vào base (trên hình đã căn tâm + simplify 0.02). Cảnh báo `keychainThin` nếu chiều dày phần móc < 1.6 mm (`ni`, P:91899; I18N:12897).

Tham số chung `gi(on)` (P:97766) — tab `keychain` **[Quan sát]**:

| key | VI | EN | min | max | step | default | showIf |
|---|---|---|---|---|---|---|---|
| loop | Móc khóa | Keychain loop | 0 | 1 | 1 | on?1:0 (toggle) | – |
| loopAngle | Vị trí móc khóa (°) | Keychain position (°) | 0 | 359 | 1 | on?0:90 | loop=1 |
| loopHoleMm | Lỗ móc khóa (mm) | Keychain hole (mm) | 2.5 | 8 | 0.5 | 4 | loop=1 |
| loopWidthMm | Độ dày vòng móc khóa (mm) | Keychain ring width (mm) | 1.5 | 5 | 0.5 | 2 | loop=1 |

Tham số chung `yi(range=150, step=0.5)` (P:98434): `artX` “Dịch hình sang phải (mm)”/“Move picture right (mm)”, `artY` “Dịch hình lên (mm)”/“Move picture up (mm)”, min −range, max +range, default 0. **[Quan sát]**

Hệ tham số: `Ci` (P:98927) kẹp mọi giá trị vào [min,max], không hợp lệ → default; `Si` (P:98764) đánh giá `showIf` (giá trị hoặc mảng giá trị, AND) và `showIfAny` (OR); `xi(map,params)` (P:98699) gán `tab` cho khóa. Tham số không có `tab` → tab đầu tiên **[Suy luận]**. Cờ `advanced:!0` = mục nâng cao (ẩn sau “More”) **[Suy luận]** (App:1125329 lọc `advanced===!0`).

## 1.7 Cảnh báo (`ni`, P:91544) **[Quan sát]**
`thinRemoved` (đã bỏ >0.01 mm² và ≥5% màu đó), `emptyColor`, `keychainThin` (<1.6 mm), `clockHands`, `thermoSlope`, `showThrough` (mode 2), `import` (cảnh báo SVG: gradient/pattern/transparency/clip/mask/image/text, I18N:5018–5242).

## 1.8 Export — `jh` (W:2317989), `Ah` (W:2317356), `Oh` (W:2312478)

Tên gốc `baseName`: tên tệp ảnh bỏ đuôi; nếu không có → từ đầu tiên của text đầu tiên; nếu không → tên công cụ theo ngôn ngữ (`om`, D:405242). Làm sạch `kh` (W:2317250): ký tự ngoài `[\p{L}\p{N}._-]` → `_`, gộp `_`, rỗng → `part`. Trùng tên part → hậu tố `_2`, `_3`. **[Quan sát]**

Bố trí (`Ah`) **[Quan sát]**: gom part theo `object`; object có `printFlip` → xoay 180° quanh X; `printRotate` → xoay theo vector; nhiều object → xếp dọc trục X cách 10 mm, căn giữa Y, đáy z=0.

Danh sách file **[Quan sát]** (`t.summary.product` có ⇔ sản phẩm `body`; `outline` không có):

| Điều kiện | 3MF | STL | Khác |
|---|---|---|---|
| body + mode 2 | `<base>_<template>_<object>.3mf` mỗi object | `<base>_<template>_<object>.stl` (union các part, `simplify(2e-4)`, sửa mesh `k`) | swap list |
| body + mode 1 | `<base>_<template>.3mf` (tất cả object) | mỗi part `<base>_<part>.stl` (có tiền tố object nếu nhiều object) | – |
| không body, mode 1 | `<base>_mode1.3mf` | mỗi part `<base>_<part>.stl` | – |
| không body, mode 2 | `<base>_mode2.3mf` | `<base>_mode2.stl` (union, trừ model) | swap list |
| luôn luôn | – | – | `<base>.svg` (gộp) + `<base>_<Base|màu>.svg` từng lớp (2D) |

- Swap list (mode 2): `<base>_swaps_en.txt` và `_vi.txt` (hoặc `<base>_<object>_swaps_*` nếu nhiều object). Mỗi lần đổi màu khi hex khác màu trước: `layer = 2 + round((z0 − firstLayerMm)/layerMm)` (`rh`, W:2300296; `ih`, W:2300526). Ghi chú VI: “Thêm lệnh đổi nhựa (tạm dừng) tại từng lớp… Khuyên dùng: độ đặc 100%”. **[Quan sát]**
- 3MF (`Oh`): 3MF core + production ext; mỗi part = 1 `<object>` mesh, gom vào object-components; `Metadata/model_settings.config` gán `extruder = slot` cho từng part; `basematerials` theo hex; hỗ trợ `paint_color` theo tam giác. Metadata `Application` = `BambuStudio-01.10.00.00` nếu >1 filament, ngược lại `img2print`; `slic3rpe:layer_height` / `first_layer_height` = mode2.layerMm/firstLayerMm. `project_settings.config`: nhiều màu → `filament_colour` theo slot (thiếu = #FFFFFF), `filament_type: PLA`; một màu → preset `Dh` (W:2312124: layer 0.2, first 0.2, wall_loops 1, sparse_infill 100%, printer `img2print 0.4 nozzle`, printable_height 300, Generic PLA). Assemble transform tịnh tiến (110,110,0). Có file `Metadata/img2print.config` ghi “Based on Kromacut https://github.com/vycdev/Kromacut”. Nén zip level 6. **[Quan sát]**
- Kèm theo khi lưu thiết kế: `design.json` (`kind:'flexhub-design'`) cùng 3MF (D:406670). **[Quan sát]**

---

# PHẦN 2 — Sản phẩm

Khung chung cho sản phẩm có `body` (mọi sản phẩm trong nhóm này trừ `outline`) **[Quan sát]** (`Np`, W:2281796): `body.build(manifold, prep, project, params, extras)` trả `{parts, bands, product, outline?, plane?, fold?}`; mỗi part `{id,name,kind:'base'|'shell'|'color'|'band'|'model', hex, slot, z0, z1, manifold, object, printFlip?, printRotate?}`. Màu vỏ (`shell`) dùng `project.shellColor ?? baseColor`. Hàm `oo(prep, project, thickness)` (P:1074182) dùng chung: mode 1 → `ri` với `baseMm=thickness` (màu **nổi** cao `heightMm` trên tấm); mode 2 → `ci` với `baseLayers = 1 + round((thickness − firstLayer)/layer)`.

---

## 2.1 `outline` — Viền sticker (P:99749)

**Mục đích**: sticker/móc khóa phẳng: đế là viền bao quanh hình, các màu đặt lên đế. **[Quan sát]**
**Tabs**: `base` (Đế/Base), `keychain` (Móc khóa) (P:98378). Không có `body` → dùng đường đi “thường” (chiều rộng in = `mode.widthMm`, minFeature của mode).

| key | VI | EN | min | max | step | default | ghi chú |
|---|---|---|---|---|---|---|---|
| borderMm | Viền (mm) | Outline (mm) | 0 | 10 | 0.5 | 2 | advanced |
| loop, loopAngle, loopHoleMm, loopWidthMm | (xem 1.6) | | | | | `gi(!1)`: loop=0, angle=90 | tab keychain |

**Thuật toán** **[Quan sát]**: `base = Ei(art, borderMm)` (1.6) → `hi` gắn móc khóa nếu loop=1 → mode 1 `ri` / mode 2 `ci`.
**Đầu ra**: part `base` + mỗi màu (`color` hoặc `band`); file `<base>_mode1.3mf` + STL từng part, hoặc `<base>_mode2.3mf/.stl` + swap list; SVG.
**Ghi chú**: `products.json` báo 0 tham số → sai; thực tế 5 tham số (regex bỏ sót khóa có `advanced` và các spread `...gi()`). **[Quan sát]**

---

## 2.2 `clicker` — Nút bấm clicker (P:302094)

**Mục đích**: nút bấm dùng switch cơ MX (1 phím hoặc khay nhiều phím), nắp mang hình nhiều màu. **[Quan sát]**
**Tabs**: `cap` (Nắp/Cap), `shell` (Vỏ/Shell), `keychain`. Khóa gán tab `shell`: keys, trayModule, trayFitMm, texture*, light, floorMm, gapMm, wallMm, rimMm, holeMm, plateMm, postMm, stemClearanceMm (P:302156). **[Quan sát]**

| key | VI | EN | min | max | step | default | adv | showIf / choices |
|---|---|---|---|---|---|---|---|---|
| layout | Kiểu clicker | Clicker type | 0 | 1 | 1 | 0 | | 0 Một phím/Single key · 1 Khay phím/Key tray |
| topperMm | Cỡ đầu hình (mm) | Topper size (mm) | 16 | 60 | 0.5 | 26 | | layout=1 |
| shape | Hình nắp | Cap shape | 0 | 2 | 1 | 0 | | layout=0; 0 Theo viền hình · 1 Chữ nhật bo góc · 2 Viên nhộng (Pill) |
| sizeMm | Cỡ nắp (mm) | Cap size (mm) | 20 | 60 | 0.5 | 26.8 | | layout=0, shape∈{0,2}; live xy |
| capWidthMm | Rộng nắp (mm) | Cap width (mm) | 20 | 60 | 0.5 | 26.8 | | layout=0, shape=1 |
| capDepthMm | Sâu nắp (mm) | Cap depth (mm) | 20 | 60 | 0.5 | 26.8 | | layout=0, shape=1 |
| cornerMm | Bo góc (mm) | Corner radius (mm) | 0 | 30 | 0.5 | 4 | | layout=0, shape=1 |
| marginMm | Viền quanh hình (mm) | Border around the picture (mm) | 0.5 | 8 | 0.5 | 2 | | |
| artX / artY | Dịch hình… | Move picture… | −40 | 40 | 0.25 | 0 | | `yi(40,.25)` |
| capTopMm | Độ cao mặt nắp (mm) | Cap top height (mm) | 1.2 | 20 | 0.1 | 2 | | layout=0 |
| keys | Số phím | Keys | 1 | 12 | 1 | 4 | | layout=1 |
| trayModule | Kiểu khay | Module | 0 | 1 | 1 | 0 | | layout=1; 0 Có gân/Ribbed · 1 Bo tròn/Bubbly |
| light | Công tắc | Switch | 0 | 1 | 1 | 0 | | 0 Thường/Normal · 1 Có đèn/Light-up |
| floorMm | Độ cao đế dưới switch (mm) | Base height under the switch (mm) | 1 | 20 | 0.1 | 1.6 | | |
| texture | Hoa văn thành | Wall texture | 0 | 1 | 1 | 0 | | toggle; showIfAny [{layout:0},{layout:1,trayModule:1}] |
| textureMm | Cỡ hoa văn (mm) | Texture size (mm) | 2 | 40 | 0.5 | 10 | | texture=1 + showIfAny |
| textureDepthMm | Độ sâu hoa văn (mm) | Texture depth (mm) | 0.2 | 2 | 0.1 | 0.8 | | texture=1 + showIfAny |
| textureInvert | Màu tối nổi lên | Dark is raised | 0 | 1 | 1 | 0 | | toggle; texture=1 |
| loop…loopWidthMm | (1.6) | | | | | `gi(!0)`: loop=1, angle=0 | | |
| minFeatureMm | Chi tiết tối thiểu (mm) | Min detail (mm) | 0 | 2 | 0.05 | 0 | ✓ | |
| inlayMm | Độ sâu hình trong nắp (mm) | Picture depth in the cap (mm) | 0.2 | 2 | 0.1 | 0.6 | ✓ | |
| skirtMm | Thành nắp (mm) | Cap side wall (mm) | 0.8 | 3 | 0.1 | 1.2 | ✓ | layout=0 |
| gapMm | Khe hở nắp - vỏ (mm) | Gap cap - shell (mm) | 0.2 | 1 | 0.05 | 0.4 | ✓ | layout=0 |
| wallMm | Thành vỏ (mm) | Shell wall (mm) | 1.2 | 5 | 0.1 | 2.3 | ✓ | layout=0 |
| rimMm | Viền vỏ trên tấm (mm) | Shell rim above the plate (mm) | 0 | 10 | 0.5 | 5.5 | ✓ | layout=0 |
| holeMm | Lỗ switch (mm) | Switch hole (mm) | 13.8 | 14.4 | 0.05 | 14.05 | ✓ | |
| plateMm | Độ dày tấm switch (mm) | Switch plate thickness (mm) | 1.2 | 1.8 | 0.05 | 1.5 | ✓ | |
| postMm | Đường kính trụ (mm) | Stem post diameter (mm) | 5 | 6.5 | 0.1 | 5.5 | ✓ | layout=0 |
| stemClearanceMm | Khe hở chân switch (mm) | Stem fit clearance (mm) | 0 | 0.3 | 0.01 | 0.1 | ✓ | layout=0 |
| trayFitMm | Khe hở rãnh đầu hình (mm) | Topper slot fit (mm) | 0 | 0.4 | 0.05 | 0.1 | ✓ | layout=1, trayModule=0 |

(34 tham số; `products.json` chỉ có 17.) Nguồn P:302524–305293. **[Quan sát]**

**Hằng số** **[Quan sát]**:
- Switch MX `ki` (P:288006): bodyMm 13.98, plateHoleMm 14, plateMm 1.5, belowMm 7.78, bottomMm 4.73, flangeW 15.64, flangeD 16.33, housingTop 6.2, stemBaseTop 6.52, stemTop 10.12, crossLen 4.5, crossArmY 1.35, crossArmX 1.15, travel 4.
- Lỗ chữ thập stem `Ai` (P:288264): 2 hình chữ nhật (1.35+2c)×(4.5+2c) và (4.5+2c)×(1.15+2c), c = stemClearanceMm.
- Khoang thân switch `ra=15.4` mm vuông; đế LED `Oi` mesh (P:99978, bbox 13.9×13.8×5.4 mm, xoay `ia=270°`, khoang = bbox+2·0.2 `aa`). Nắp hình mặc định tối thiểu ô 20×20 bo 4 (`la=20, ua=4`).
- Khay Ribbed `Bi` (P:291229): unit 24.4, pitch 23.5, corner 6, rib r 1.2 nhô 0.8, ribStep 2.535, 9 gân/cạnh, pocket 22 (bo 4.8, sâu 7), notch 15×5×1.5, lưỡi gài (tongue) gốc 6.6 / đầu 8.8 / sâu 2 / cao 8.5, cổ 20×5.
- Khay Bubbly `Xi` (P:293837): size 25, corner 6.5, bo đáy 2, bo đỉnh 1.4, gap 0.68, pinFloor 0.9, plateAbove 6.71, pocket 19.6 (bo 3.6, sâu 7.79), lỗ trụ 4, lỗ peg 1.9, lỗ pin 1.8, tab cổ 5.6/đầu 7.6/lỗ 4.5, tabZ [1,3.7], tabReach 4.69, linkFit 0.2, keyholeTop 8, topperNeck 10.

**Thuật toán — 1 phím (layout 0)** **[Quan sát]**
1. Đế nắp `pa` (P:296981): shape 0 → `Ei(art, margin) ∪ ô 20×20 bo 4` rồi `Ei(…,0)`; shape 1 → chữ nhật bo góc capWidth×capDepth, bo `min(corner, w/2−0.01, h/2−0.01)`; shape 2 → viên nhộng `ma` (P:297182): offset hình +margin, chiều cao viên = cao bbox + 2·margin, tìm nửa chiều dài thẳng nhỏ nhất bằng chia đôi (14 lần, sai số 0.02) sao cho viên nhộng phủ hết.
   `artBox`: hình lọt trong (size−2·margin) hoặc (capW−2m)×(capD−2m) (P:305428).
2. Cao độ `da` (P:296435): `plateTop = floor + (light? 4.73+5.4 : 7.78+0.4)`; `postBottom = plateTop+6.52+0.2`; `underside = plateTop+10.12+0.4`; `skirtBottom = mode2? postBottom : plateTop+4+0.6`; `shellTop = plateTop + rimMm + (skirtBottom − (plateTop+4.6))`; `capTop = underside + capTopMm` (mode 2 làm tròn theo lưới lớp, `capLayers`).
3. Vỏ `va` (P:298120): khối `base.offset(gap+wall)` từ 0→plateTop; trừ khoang 15.4² (từ floor tới plateTop−plateMm; nếu light: khoang đế LED từ floor tới plateTop−4.73 rồi khoang 15.4²); trừ lỗ switch holeMm² xuyên tấm (dày plateMm); cộng thành viền (vòng `offset(gap+wall) − offset(gap)`) từ plateTop→shellTop. Texture: `Li` (P:288999) tạo “da” lưới từ ảnh xám (`wallTexture`, base64) quấn quanh tường, đẩy pháp tuyến `depthMm·(invert?1−v:v)`, ô lặp `tileMm`, đệm trong 0.6 (`Pi`), lưới ≤3e5 đỉnh (`Ii`). Móc khóa: `mi` trên viền ngoài, đùn 0→min(3, plateTop).
4. Nắp `ya` (P:299058): tấm base underside→capTop + váy (base − base.offset(−skirtMm)) skirtBottom→underside + trụ Ø postMm postBottom→underside − lỗ chữ thập − (mode 1) hốc hình `v(art∩base)` sâu inlayMm từ capTop.
5. Part: `shell` (object shell), `cap` (kind base, object cap, **printFlip ở mode 1** → in úp mặt hình xuống bàn), `led-holder` (#9a8f97, nếu light, mesh `Oi` tại z=floor). Mode 1: mỗi màu `art∩base` đùn capTop−inlay→capTop (`printFlip`). Mode 2: bands `ii` với `baseLayers=capLayers`, footprint `ai`, dời lên `skirtBottom+z`.
6. `product`: plateTop, postBottom, underside, capTop, skirtBottom, shellTop, capLayers, travel 4, unitBottom, loopX/Y… (P:305963).

**Thuật toán — khay phím (layout 1)** `xa` (P:299652) **[Quan sát]**
1. Đế đầu hình `Wi` (P:291757): `Ei(art, margin)` + cổ 20×(5 | Bubbly 10) ở mép dưới, chỉ giữ phần y ≥ mép.
2. Cao độ: Bubbly `ta` (P:294698): cavityFloor=floor+0.9, plateTop=cavityFloor+(light? 4.73+5.4 : 6.71), top=plateTop+7.79; Ribbed: plateTop từ `da`, top=plateTop+7.
3. Topper: base đùn 0→top (mode 2 làm tròn lớp); trừ rãnh lưỡi gài `Yi` (Ribbed, nới trayFitMm) hoặc lỗ tab liên kết `ea` (Bubbly); mode 1 trừ hốc hình inlay. Móc khóa trên topper.
4. Khay Ribbed `Ji` (P:292666): 1 khối gồm `keys` ô (pitch 23.5, ô bo + 9 gân/cạnh), lưỡi gài; mỗi ô khoét lỗ switch, notch chữ thập 15×5, pocket 22 bo 4.8.
   Bubbly `na` (P:294835): mỗi phím 1 part riêng `key-n`: hull các mặt cắt bo tròn, texture tùy chọn, khoét khoang/lỗ switch, pocket 19.6, lỗ trụ Ø4, 2 lỗ peg Ø1.9 tại ±5.08, 8 lỗ pin Ø1.8 tại (±3.81,±2.54),(±2.54,±5.08) (kiểu footprint MX hot-swap [Suy luận]), tab nối có lỗ Ø4.5 ở z 1→3.7.
5. Part: `tray` hoặc `key-1..n` (shell), `topper` (base; printFlip khi mode 1 & Ribbed), `led-holder-n`; màu/bands vào object `topper` (Ribbed) hoặc `tray` (Bubbly).

**Đầu ra**: object `shell`, `cap`, `led-holder` (1 phím) hoặc `tray`/`topper`/`led-holder` (khay). File `<base>_clicker.3mf` (+STL từng part) hoặc mode 2: `<base>_clicker_<object>.3mf/.stl`.
**Giới hạn**: lỗ switch 13.8–14.4; khe stem 0–0.3; inlay ≤2 mm.

---

## 2.3 `croc` — Charm dép Croc (P:340762)

**Mục đích**: charm gắn lỗ dép Crocs: tấm hình + chốt (peg) mesh có sẵn. **[Quan sát]**
**Tabs**: `charm`.

| key | VI | EN | min | max | step | default | adv | ghi chú |
|---|---|---|---|---|---|---|---|---|
| sizeMm | Cỡ charm (mm) | Charm size (mm) | 15 | 60 | 0.5 | 30 | | live xy |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 0 | 6 | 0.5 | 1.5 | | |
| artX / artY | | | −25 | 25 | 0.25 | 0 | | `yi(25,.25)` |
| thicknessMm | Độ dày charm (mm) | Charm thickness (mm) | 1.6 | 8 | 0.1 | 3 | | live z |
| minFeatureMm | Chi tiết tối thiểu (mm) | Min detail (mm) | 0 | 2 | 0.05 | 0 | ✓ | |
| inlayMm | Độ sâu hình (mm) | Picture depth (mm) | 0.2 | 1.5 | 0.1 | 0.6 | ✓ | |

**Thuật toán** **[Quan sát]** (P:340102–342478):
1. `artBox`: (size−2·border)² + artX/Y.
2. Đế `Ta`: `Ei(art,border) ∪ circle(Ø14, 64 seg)` (`wa=14`) tại gốc (đảm bảo phủ chốt), `Ei(…,0)`.
3. Cao độ `Ea`: chốt mesh `Ca` cao 6.1528 (bbox Ø~12, P:307331); `charmBottom=6.1528`, `charmTop=6.1528+thickness` (mode 2: làm tròn theo lưới lớp tính từ z=0).
4. Tấm charm = base đùn (charmBottom−0.05)→charmTop ∪ mesh chốt.
5. `l = min(inlayMm, thickness−0.4)`; mode 1: trừ hốc `v(art∩base)` sâu l ở mặt trên; màu đùn charmTop−l→charmTop.
6. Part `charm` (printFlip ở mode 1 → mặt hình úp xuống, chốt hướng lên); mode 2: bands từ `ii(baseLayers=charmLayers)` đặt từ charmTop trở lên.
**Đầu ra**: 1 object `charm`; `product = {charmBottom, charmTop, charmLayers, pegHeight}`.

---

## 2.4 `lightbox` — Hộp đèn (P:1069114)

**Mục đích**: hộp đèn/biển hiệu: hộp rỗng hình theo viền ảnh, mặt trước là tấm hình nhiều màu (ánh sáng xuyên qua), ổ đèn LED tròn (mesh) phía sau. **[Quan sát]**
**Tabs**: `sign` (Biển), `box` (Hộp). Tab box: mount, depthMm, wallMm, cutMm, ledBase, fitMm, cableMm.

| key | VI | EN | min | max | step | default | adv | ghi chú |
|---|---|---|---|---|---|---|---|---|
| mount | Kiểu treo | Mount | 0 | 1 | 1 | 0 | | 0 Treo tường (keyholes) · 1 Đứng (Standing) |
| sizeMm | Cỡ biển (mm) | Sign size (mm) | 80 | 250 | 1 | 150 | | live xy |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 0 | 20 | 0.5 | 4 | | |
| artX / artY | | | −100 | 100 | 0.5 | 0 | | `yi(100)` |
| panelMm | Độ dày mặt trước (mm) | Front panel thickness (mm) | 0.4 | 3 | 0.1 | 1 | | |
| depthMm | Độ sâu hộp (mm) | Box depth (mm) | 22 | 80 | 1 | 30 | | |
| wallMm | Độ dày thành (mm) | Wall thickness (mm) | 1.2 | 5 | 0.1 | 2 | | |
| cutMm | Cắt phẳng đáy (mm) | Flat base cut (mm) | 1 | 60 | 0.5 | 8 | | mount=1 |
| ledBase | In đế LED | Print the LED base | 0 | 1 | 1 | 1 | | toggle |
| minFeatureMm | Chi tiết tối thiểu (mm) | Min detail (mm) | 0 | 2 | 0.05 | 0 | ✓ | |
| fitMm | Khe hở ổ LED (mm) | LED socket clearance (mm) | 0.1 | 0.5 | 0.05 | 0.2 | ✓ | |
| cableMm | Rộng rãnh dây (mm) | Cable groove width (mm) | 2 | 8 | 0.5 | 4 | ✓ | |
| panelFitMm | Khe hở mặt trước (mm) | Panel fit clearance (mm) | 0 | 0.5 | 0.05 | 0.2 | ✓ | |

**Hằng số** **[Quan sát]**: mesh `Ma.base` (đế LED, bbox Ø69.8 × cao 15.04) và `Ma.ring` (vòng ổ, z 8.1613→17.6794) (P:342519, P:939971; số đo bằng `meshstats.py`). `Va` (P:1065894): `baseR≈34.90`, `baseTop=15.04`, `ringBottom≈8.161`, `ringTop≈17.679`, `groove=33`. Keyhole `Ia` (P:1065576): head 9, shank 4.2, slot 8, plate 2.2, depth 5, boss 2.5. Gờ đỡ panel: `Na=1.6` chia `Pa=4` bậc.
`Ha` (P:1066238): `hole = baseR + fitMm` (≈35.1), `sleeve = hole + wall` (≈37.1), `keepOut = sleeve + wall + 1` (≈40.1) — đơn vị bán kính, với mặc định.

**Thuật toán** **[Quan sát]**
1. Đế `Ua` (P:1066334): `Ei(art,border) ∪ circle(keepOut)` → 1 mảnh; mount=1: cắt bỏ phần dưới tại `y = min(minY+cutMm, −keepOut)` để có đáy phẳng.
2. Panel `Fa` (P:1065443): mode 2: số lớp `n=1+ceil((panel−first)/layer)`, dày `first+(n−1)·layer`; mode 1: dày panelMm.
3. Hộp `Ya` (P:1067642), trục z: 0 = mặt sau, depth = mặt trước:
   - Tấm sau base 0→wall; tường vòng (base − base.offset(−wall)) 0→d và l→depth, với `l = depth − panelThickness`, `d = l − 1.6`; giữa d và l: 4 bậc gờ vào trong mỗi bậc 0.4 mm (gờ vát đỡ panel).
   - Ống ổ LED: vành (sleeve − hole) 0→ringBottom+1; vành rãnh (sleeve − r(33+0.6)) ringBottom+0.2→ringBottom+1.
   - Rãnh dây: rộng cableMm từ mép dưới tới lỗ LED, sâu `min(2.5, depth−wall−1)` (+ gờ 1.2).
   - Mount 0: `Ja` (P:1067210) thử 3 phương án đặt keyhole (2 lỗ cách đều ±min(0.3·rộng,60) gần đỉnh; 2 lỗ hai bên ổ LED; 1 lỗ giữa) — chọn phương án đầu mà mọi boss nằm gọn trong hình và không chạm ổ; boss dày tới z=6, khoét đầu Ø9 sâu 5, cổ 4.2 sâu 2.2.
   - Trừ lỗ LED xuyên tấm sau, rãnh dây; union mesh `ring`; bỏ mảnh rời có thể tích ≤0.001 (`Ga`).
4. Panel: `m = base.offset(−wall).offset(−panelFit)`, z = depth−thickness→depth. Mode 1: panel = m − `g(art∩m)`; mỗi màu `cs∩m` đùn **xuyên suốt độ dày panel** (in khảm phẳng, printFlip). Mode 2: panel đặc + bands (∩m) xếp lên từ mặt trước.
5. Part: `box` (shell), `panel` (base), `ledbase` (mesh `Ma.base`, nếu ledBase=1), các màu/bands (object panel). `product={depth,panelTop,keyholes,ringTop}`.
**Ghi chú**: biển tối thiểu phải chứa đường tròn bán kính keepOut ≈40 mm → sizeMm min 80. **[Suy luận]**

---

## 2.5 `penholder` — Ống cắm bút (P:1073445)

**Mục đích**: ống đựng bút có mặt trước là tấm hình; thân ống là lăng trụ theo viền hình, hở phía trên. **[Quan sát]**
**Tabs**: `picture` (Hình), `holder` (Ống; depthMm, cutMm, wallMm).

| key | VI | EN | min | max | step | default | adv |
|---|---|---|---|---|---|---|---|
| sizeMm | Cỡ hình (mm) | Picture size (mm) | 40 | 200 | 1 | 100 | |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 1 | 10 | 0.5 | 3 | |
| plateMm | Độ dày tấm (mm) | Plate thickness (mm) | 2 | 6 | 0.1 | 3 | |
| depthMm | Độ dày khối (mm) | Depth (mm) | 25 | 120 | 1 | 50 | |
| cutMm | Cắt phẳng đáy (mm) | Flat base cut (mm) | 1 | 40 | 0.5 | 6 | |
| wallMm | Thành (mm) | Wall (mm) | 1.2 | 4 | 0.1 | 2 | ✓ |

(Không có artX/artY, không có minFeatureMm → dùng minFeature của mode [Suy luận theo `yp`].)

**Thuật toán** **[Quan sát]** (P:1072014–1075065)
1. `artBox`: (size−2·border)²; đế `$a`: `Ei(art,border)` cắt bỏ cutMm phía dưới (đáy phẳng).
2. Tấm hình: màu cắt theo base, `oo(…, plateMm)` (mode 1: màu nổi heightMm trên tấm; mode 2: bands).
3. Thân `no` (P:1072987): tấm lưng = base đùn 0→wall; tường = (base − base.offset(−wall)) trừ phần “miệng trên” `to` rồi bỏ mảnh vụn ≤1 mm² (`ro`), đùn wall→depth. `to` (P:1072481): quét các dải x rộng 0.5 mm, tìm khoảng trên cùng của viền ngoài và viền trong, xóa tường phía trên mép trong (−0.3 mm) → miệng ống mở ở đỉnh.
4. Dựng đứng: mỗi part dịch z (tấm hình tại z=depth, thân tại 0), xoay [90,0,0], dịch để đáy (minY) chạm z=0. Tấm hình làm mặt trước, thân phía sau.
5. Part: các part tấm (object `plate`), `holder` (shell); cả hai `printRotate=[-90,0,0]` → khi export nằm phẳng. `plane = {x:[1,0,0,0], y:[0,0,1,minY]}`.
**Đầu ra**: object `plate` + `holder`; `<base>_penholder.3mf` …

---

## 2.6 `bracelet` — Vòng tay charm (P:1077443)

**Mục đích**: charm dày có lỗ xỏ dây xuyên ngang thân. **[Quan sát]**
**Tabs**: `charm`, `hole` (Lỗ xỏ dây; holeMm, holeDir, holeShiftMm).

| key | VI | EN | min | max | step | default | adv | choices |
|---|---|---|---|---|---|---|---|---|
| sizeMm | Cỡ charm (mm) | Charm size (mm) | 15 | 45 | 0.5 | 25 | | live xy |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 0 | 4 | 0.5 | 1.5 | | |
| thicknessMm | Độ dày charm (mm) | Charm thickness (mm) | 4 | 12 | 0.1 | 7 | | live z |
| holeMm | Lỗ xỏ dây (mm) | String hole (mm) | 1.5 | 6 | 0.1 | 4.5 | | |
| holeDir | Hướng lỗ | Hole direction | 0 | 2 | 1 | 0 | | 0 Tự động/Auto · 1 Dọc/Up-down · 2 Ngang/Side to side |
| holeShiftMm | Dịch lỗ (mm) | Hole shift (mm) | −10 | 10 | 0.5 | 0 | ✓ | |
| minFeatureMm | Chi tiết tối thiểu (mm) | Min detail (mm) | 0 | 2 | 0.05 | 0 | ✓ | |

**Thuật toán** **[Quan sát]** (P:1075239–1078892)
1. Đế `Ei(art,border)`; thân = `oo(…, thicknessMm)` (mode 1: đế dày thickness + màu nổi heightMm; mode 2: bands).
2. Đường kính lỗ `i = min(holeMm, thickness − 2·0.8)` (`co=.8` thành tối thiểu trên/dưới).
3. Chọn hướng `po` (P:1075449, cache 20): góc ứng viên Auto = {90,75,105,0,60,120,15,165,45,135,30,150} với phạt `lo` (90→0, 75/105→1.5, 0→2.5, 60/120→3, 15/165→3.5, 45/135→4.5, 30/150→5); Up-down = 90; Side = 0. Với mỗi góc, quét đường thẳng mỗi 0.25 mm; dây cung ≥ 2u+1 (u = i+1.6). Hợp lệ “inside” khi 1 mảnh, dải rộng u phủ ≥99.5% và phần tràn hai đầu <0.05 → điểm = phạt góc + |lệch so với trọng tâm|; nếu không có thì chọn phương án phủ tốt nhất (`inside:false`). Mặc định khi thất bại: 90°, qua trọng tâm.
4. `mo` (P:1077101): trụ Ø i, dài (chord+40), 48 seg, xoay theo góc, đặt ở z = nửa chiều dày đế, dịch vuông góc holeShiftMm. Trừ chỉ khỏi part base.
5. Part: `Charm` (base) + màu/bands (object `charm`). `product={holeMm, holeAngle, holeX, holeY, holeInside}`.
**Ghi chú**: `holeInside=0` nghĩa là lỗ có thể lộ ra ngoài viền. **[Suy luận]**

---

## 2.7 `canopener` — Đồ khui lon (P:1083351)

**Mục đích**: dụng cụ khui nắp chai/lon dạng tấm phẳng có khe (slot) và rãnh đinh tán; thân theo viền hình hoặc dáng cổ điển/chữ nhật; có móc khóa trên đế. **[Quan sát]**
**Tabs**: `opener` (Đồ khui), `mouth` (Miệng khui), `keychain`. `keychainOnBase:true`. Tab mouth: headAngle, slotWidthMm, slotDepthMm, slotMm, sideMm, backMm, outMm, notch*, chamferMm, floorMm, roofMm.

| key | VI | EN | min | max | step | default | adv | showIf / choices |
|---|---|---|---|---|---|---|---|---|
| shape | Hình dạng | Shape | 0 | 2 | 1 | 0 | | 0 Viền theo hình · 1 Cổ điển/Classic · 2 Chữ nhật bo góc |
| style | Hình | Picture | 0 | 1 | 1 | 0 | | 0 Nổi/Raised · 1 Phẳng/Flush |
| sizeMm | Cỡ hình (mm) | Picture size (mm) | 30 | 120 | 0.5 | 60 | | shape=0; live xy |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 0 | 6 | 0.5 | 2 | | shape=0 |
| lengthMm | Dài (mm) | Length (mm) | 50 | 120 | 1 | 68 | | shape∈{1,2} |
| widthMm | Rộng (mm) | Width (mm) | 30 | 60 | 1 | 36 | | shape∈{1,2} |
| marginMm | Lề hình (mm) | Picture margin (mm) | 0 | 8 | 0.5 | 3 | | shape∈{1,2} |
| artX / artY | | | −50 | 50 | 0.25 | 0 | | shape∈{1,2} |
| inlayMm | Độ sâu hình (mm) | Picture depth (mm) | 0.2 | 1.5 | 0.1 | 0.6 | ✓ | |
| headAngle | Vị trí miệng khui (°) | Mouth position (°) | 0 | 359 | 1 | 180 | | |
| slotWidthMm | Rộng khe (mm) | Slot width (mm) | 14 | 30 | 0.5 | 20 | ✓ | |
| slotDepthMm | Sâu khe (mm) | Slot depth (mm) | 12 | 30 | 0.5 | 21 | ✓ | |
| slotMm | Cao khe (mm) | Slot height (mm) | 1.2 | 4 | 0.1 | 2 | ✓ | |
| sideMm | Thành bên (mm) | Side walls (mm) | 4 | 14 | 0.5 | 8 | ✓ | |
| backMm | Thành sau khe (mm) | Wall behind the slot (mm) | 2 | 15 | 0.5 | 4 | ✓ | shape=0 |
| outMm | Miệng nhô ra (mm) | Mouth past the picture (mm) | 0 | 30 | 0.5 | 0 | ✓ | shape=0 |
| notch | Rãnh đinh tán | Rivet notch | 0 | 1 | 1 | 1 | ✓ | toggle |
| notchWidthMm | Rộng rãnh (mm) | Notch width (mm) | 4 | 16 | 0.5 | 10 | ✓ | notch=1 |
| notchDepthMm | Sâu rãnh (mm) | Notch depth (mm) | 4 | 20 | 0.5 | 10.5 | ✓ | notch=1 |
| chamferMm | Vát miệng (mm) | Mouth lip (mm) | 0 | 2 | 0.1 | 1 | ✓ | |
| floorMm | Đáy khe (mm) | Floor (mm) | 0.6 | 3 | 0.1 | 1 | ✓ | |
| roofMm | Nóc khe (mm) | Roof (mm) | 0.6 | 4 | 0.1 | 1 | ✓ | |
| loop… | (1.6) | | | | | `gi(!0)`: loop=1, angle=0 | | |

Nguồn P:1083764–1085416. **[Quan sát]**

**Thuật toán** **[Quan sát]** (P:1078892–1086551)
1. Kích thước đầu khui: `headWidth = slotWidth + 2·side` (mặc định 36); `reach = slotDepth + back` (25); bo đầu `min(3, headWidth/4)` (`bo=3`).
2. Độ dày `Ao`: `slot0 = floor`, `slot1 = floor + slotMm`, `top = slot1 + roof (+ inlay nếu Flush)` → mặc định 4 mm (4.6 Flush).
3. Đế `ko` (P:1081427):
   - shape 1 “Classic”: polygon mẫu `_o` 68×36 (P:1078892) giãn theo dấu tọa độ tới length×width; shape 2: chữ nhật bo `min(6, width/2−0.5)`; cả hai xoay `round(headAngle/90)·90 − 180`.
   - shape 0: `Ei(art,border)`; tâm bbox; `wo`/`Co` (P:1080077): mouth = khoảng xa nhất của viền theo hướng headAngle trong dải rộng headWidth + outMm; back = mouth − reach; khối đầu `Oo` (chữ nhật bo, từ back tới mouth, rộng headWidth) xoay+đặt; union; closing 3 mm; `Ei(…,0)`; simplify 0.01.
4. Thân: Flush (mode 1 & style 1) → `Mo` (P:1082608): đế đùn top, trừ hốc `y(colors)∩base` sâu inlay, màu lấp hốc (printFlip); Raised hoặc mode 2 → `oo(…, top)` (màu nổi/bands trên đỉnh).
5. Khe `jo` (P:1081955): mặt cắt (x,z) từ x=−slotDepth tới x=+1 giữa slot0..slot1, vát miệng `s = min(chamfer, slot0, top−slot1)` (+0.05), đùn theo bề rộng slotWidth; rãnh đinh tán: chữ nhật + bán nguyệt rộng `min(notchW, slotW)`, sâu `max(r, notchDepth)` từ miệng vào, cắt từ z=−0.01 xuyên đáy tới slot0. Xoay theo góc, đặt tại điểm miệng; trừ khỏi part base.
6. Móc khóa: gắn trên base qua `hi` (keychainOnBase).
7. Part `Opener` (base) + màu (object `opener`, printFlip khi Flush). `product` gồm headAngle, headX/Y, mouth, headBack, headWidth, reach, out, top, slot0, slot1, flush.

---

## 2.8 `jar` — Hũ (P:1394631)

**Mục đích**: hũ tròn có nắp vặn (mesh có sẵn) giãn theo đường kính/chiều cao; trên nắp gắn “topper” tròn mang hình. **[Quan sát]**
**Tabs**: `picture`, `keychain`, `jar` (diameterMm, heightMm, recessMm, fitMm). `keychainOnBase:true`.

| key | VI | EN | min | max | step | default | adv |
|---|---|---|---|---|---|---|---|
| sizePct | Cỡ hình (%) | Picture size (%) | 30 | 250 | 1 | 100 | |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 0 | 6 | 0.5 | 1.5 | |
| artX / artY | | | −40 | 40 | 0.5 | 0 | |
| plateMm | Độ dày hình trang trí (mm) | Topper thickness (mm) | 1.2 | 6 | 0.1 | 2 | |
| loop… | (1.6) | | | | | `gi(!1)`: loop=0, angle=90 | |
| diameterMm | Đường kính hũ (mm) | Jar diameter (mm) | 36 | 150 | 1 | 60 | (live xy, không adv) |
| heightMm | Chiều cao hũ (mm) | Jar height (mm) | 24 | 150 | 1 | 30 | |
| recessMm | Độ sâu rãnh dán (mm) | Glue recess depth (mm) | 0 | 2 | 0.1 | 1 | ✓ |
| fitMm | Khe hở lắp hình (mm) | Topper fit clearance (mm) | 0 | 0.5 | 0.05 | 0.2 | ✓ |

**Hằng số** **[Quan sát]** (P:1086551, P:1393915): mesh `Lo.jar` (cao 30, bán kính 29.993), `Lo.lid` (cao 13, bán kính 29.993); `Ro=10` (ngưỡng z giãn chiều cao), `zo=2.2`, `Vo=10` (nắp chồng 10 mm), `Ho=127.5°` (xoay nắp quanh Z, căn ren [Suy luận]).

**Thuật toán** **[Quan sát]**
1. Bán kính topper `Bo = diameter/2 − 2.2 − fitMm`; đế = `circle(Bo,128)` (+ móc khóa nếu loop).
2. `artBox`: cạnh `2·max(1, Bo−border)·sizePct/100` (hình vuông, contain) + artX/Y; màu bị cắt bởi `circle(max(.5, Bo−border))`.
3. Mesh `Uo` (P:1393978): mỗi đỉnh đẩy ra theo bán kính `n = diameter/2 − 29.993`; đỉnh có z>10 dịch lên `heightMm − 30` (chỉ áp cho thân hũ).
4. Nắp: xoay [180,0,127.5], đặt tại `top = heightMm − 10 + 13` (vị trí đóng).
5. Rãnh dán `qo` (P:1396404): `u = min(recessMm, plateMm−0.4)`; nếu u>0 trừ khỏi nắp hốc `base.offset(fitMm)` sâu u tại đỉnh.
6. Topper = `oo(…, plateMm)` dời lên z = top − u (ngồi trong rãnh).
7. Part: topper (object `topper`), `jar` (shell, 0→height), `lid` (shell, printFlip). `product={lidTop, seat, diameter, height}`.

---

## 2.9 `toolbox` — Hộp đựng đồ (P:1626078)

**Mục đích**: hộp có nắp bản lề + khay chia ngăn (mesh có sẵn, giãn theo kích thước), tấm hình gắn trên nắp. **[Quan sát]**
**Tabs**: `picture`, `box` (widthMm, depthMm, heightMm, tray).

| key | VI | EN | min | max | step | default | adv | choices |
|---|---|---|---|---|---|---|---|---|
| fit | Cách đặt hình | Picture fit | 0 | 1 | 1 | 0 | | 0 Lấp đầy (cắt)/Fill (crop) · 1 Vừa bên trong/Fit inside |
| sizePct | Cỡ hình (%) | Picture size (%) | 30 | 250 | 1 | 100 | | |
| borderMm | Viền quanh hình (mm) | Border around the picture (mm) | 0 | 20 | 0.5 | 0 | | |
| artX / artY | | | −120 | 120 | 0.5 | 0 | | |
| plateMm | Độ dày tấm hình (mm) | Plate thickness (mm) | 1.2 | 6 | 0.1 | 2 | | |
| cornerMm | Bo góc tấm hình (mm) | Plate corner radius (mm) | 0 | 20 | 0.5 | 4 | ✓ | |
| widthMm | Rộng hộp (mm) | Box width (mm) | 120 | 400 | 1 | 221 | | |
| depthMm | Sâu hộp (mm) | Box depth (mm) | 100 | 300 | 1 | 152 | | |
| heightMm | Cao hộp (mm) | Box height (mm) | 25 | 150 | 1 | 39 | | |
| tray | Khay chia ngăn | Tray insert | 0 | 1 | 1 | 1 | | toggle |

**Hằng số** **[Quan sát]** (P:1624944): mesh gốc `Yo` width 221.38, depth 151.63, height 38.9, tấm `plateW 212 × plateD 144.6`; bản lề `Xo={y:76.329,z:31.874}`, `Zo={y:−76.326,z:30.156}`; `Qo=−3.485` (lệch y tấm hình/khay); ngưỡng giãn `$o={x:30,y:0,z:12}`; khay nâng `es=3`. Mesh `Jo.base/cover/tray` (P:1396549…1626423).

**Thuật toán** **[Quan sát]**
1. Đế (= tấm hình) `rs`: chữ nhật (212+Δw)×(144.6+Δd), bo `min(corner, w/2−.5, d/2−.5)`; **không phụ thuộc hình**.
2. `artBox`: w=(plateW+Δw−2·border)·sizePct, h=(plateD+Δd−2·border)·sizePct, `cover = (fit==0)`.
3. Giãn mesh `ts` (P:1625095): Δ = kích thước mới − gốc; đỉnh x>30 cộng Δx, y>0 cộng Δy, z>12 cộng Δz (nắp: mọi z), rồi trừ Δ/2 để căn giữa. Nắp lật về vị trí đóng `(x, −y + (Xo.y+Zo.y), −z + (Xo.z+Zo.z))`; `top = 62.03 + Δz`; bản lề `y = 76.329+Δy/2, z = 31.874+Δz`.
4. Màu cắt theo `base.offset(−border)`; tấm hình `oo(…, plateMm)` dời (0, −3.485, top).
5. Part: tấm (object `plate`), `box-base`, `box-cover` (printFlip), `box-tray` (nếu tray=1). `plane.y = [0,1,0,3.485]`.
**Ghi chú**: khung hộp không cắt theo hình; hình chỉ là tấm phẳng dán/đặt trên nắp **[Suy luận]**.

---

## 2.10 `foldbox` — Hộp gấp (P:1874885)

**Mục đích**: in phẳng một tấm “net” hộp có rãnh gấp chữ V (bản lề sống), gấp thành hộp có nắp gài; mỗi mặt (13 mặt trong/ngoài) có thể gắn hình riêng. **[Quan sát]**
**Tabs**: `box` (Hộp), `faces` (Các mặt — điều khiển theo mặt, không phải param). `xi({},…)` → mọi param ở tab đầu.

| key | VI | EN | min | max | step | default | adv |
|---|---|---|---|---|---|---|---|
| widthMm | Cạnh a (mm) | Side a (mm) | 20 | 250 | 1 | 50 | |
| depthMm | Cạnh b (mm) | Side b (mm) | 20 | 250 | 1 | 50 | |
| heightMm | Chiều cao (mm) | Height (mm) | 8 | 120 | 1 | 15 | |
| thicknessMm | Độ dày tấm (mm) | Sheet thickness (mm) | 0.4 | 1.2 | 0.05 | 0.5 | ✓ |
| creaseMm | Độ sâu rãnh gấp (mm) | Crease depth (mm) | 0.2 | 1.1 | 0.05 | 0.4 | ✓ |
| notch | Khấc mở nắp | Thumb notch | 0 | 1 | 1 | 1 | ✓ (toggle) |
| earFitMm | Khe tai gấp (mm) | Ear gap (mm) | 0 | 0.5 | 0.05 | 0 | ✓ |
| tuckFitMm | Khe nắp gài (mm) | Tuck flap gap (mm) | 0 | 0.5 | 0.05 | 0.1 | ✓ |
| inlayMm | Độ sâu hình (mm) | Picture depth (mm) | 0.1 | 0.6 | 0.05 | 0.2 | ✓ |

Cài đặt mỗi mặt (`js`, P:1868936): `{pic, fill:false, sizePct:90, x:0, y:0, rotateDeg:0}` + `colors` (đổi màu theo mặt). Mặc định `Ms` (P:1869002): mặt ngoài lid/front/back/left/right gắn ảnh chính `main`; bottom và mặt trong để trống; `down = 'outside'` (mode 1) / `'inside'` (mode 2). **[Quan sát]**
13 mặt `ys` (P:1863252): lid, front, back, left, right, bottom (ngoài, side `bed`); lidIn, floor, frontIn, backIn, tuck (side `top`); leftIn, rightIn (side `bed`).

**Thuật toán** **[Quan sát]**
1. `ws` (P:1867557): t = thicknessMm (mode 2 làm tròn lên lưới lớp từ firstLayer), d = min(crease, t−0.1) (mode 2: `max(.1, min(crease, t−layer))`), c = earFit, cT = tuckFit.
2. Net `Cs` (P:1864376): panel `base`(đáy), `F`(trước), `K`(sau), `L`(nắp), `T`(nắp gài), mỗi bên `S`(thành), `R`, `I`(lớp trong), `FE/KE` (tai), `LF` (vạt nắp), với hằng `fs=.5, ps=.75, ms=1.5`(lề vùng hình), `hs=.4, gs=.3, _s=.2, vs=.25`; tai khóa có lưỡi dài `min(20,max(4,0.19·D))` tại ±D/5; khe tai (slots) trên đáy; khấc ngón tay bán kính `min(6, W/6, 0.3·C)`. Kế hoạch gấp 7 giai đoạn: mỗi panel có cha, trục, góc 90°, stage (dùng cho hoạt ảnh `us`, ma trận `cs/ss`). Kích thước ngoài khi gấp: `[W+2(3t+c), D+3t+cT, H+2t]`.
3. Phôi tấm `ks` (P:1868101): union polygon panel → opening 0.4 (Round) → trừ khe tai + khấc.
4. Rãnh gấp `As` (P:1868453): mặt cắt tam giác đỉnh tại z=t−d, miệng rộng 2(d+0.02) ở mặt trên, đùn dọc mỗi đường bản lề (hinges); trừ khỏi tấm. Nếu `down=inside` → lật (mirror X / xoay 180°).
5. Hình mỗi mặt `Ns` (P:1869159): fit/contain theo vùng `area` của mặt (lề 1.5 mm), xoay, dịch x/y, ma trận theo hướng panel; giao với vùng mặt. `zs` (P:1871568): mặt hướng xuống bàn → **flush** (khảm), ngược lại **raised** (nổi); bỏ qua: flush ở mode 2 → `needsAms`; raised ở `frontIn` → `blocksTuck`.
6. Mode 1: tấm `Box` đùn t, trừ rãnh gấp và hốc flush sâu `min(inlay, t−0.1)` từ z=0; mỗi màu: phần flush 0→inlay + phần raised t→t+max(0.2,heightMm). Mode 2: chỉ raised qua `oo(…, t)`, base trừ rãnh gấp.
7. Mỗi part được tách `pieces` theo vùng panel (`Rs`) phục vụ xem trước gấp. `product`: outerX/Y/Z, sheetX/Y, thickness, crease, foldMin/Max, skippedFaces.
**Đầu ra**: object `box` (tấm phẳng + các màu). Slot màu cho ảnh từng mặt cấp bởi `Fs` (≤16, tái dùng theo hex).

---

## Phụ lục — Sai lệch `products.json`

`products.json` bỏ sót mọi param có cờ `advanced` (đối số thứ 8 `!0`), mọi spread `...gi()`/`...yi()`, và toàn bộ `outline`. Số tham số thực/ghi nhận: outline 5/0, clicker 34/17, croc 7/3, lightbox 14/8, penholder 6/5, bracelet 7/5, canopener 27/8, jar 13/5, toolbox 11/8, foldbox 9/3 (đếm `artX/artY` là 2 và móc khóa là 4). **[Quan sát]**

## Những điểm còn **[Chưa rõ]**
- Thuật toán lượng tử màu ảnh raster, xóa nền, median smooth, upscale, VTracer/VectorCraft: chạy trong Rust (`load_image`, `prepare_image`, `trace_image`) — không có trong JS.
- Nguồn ảnh `wallTexture` cho texture tường clicker.
- Hàm sửa mesh `k` dùng trước STL mode 2 (W:46739) chỉ thấy là gộp đỉnh trùng/xử lý cạnh; chi tiết chưa đọc hết.
