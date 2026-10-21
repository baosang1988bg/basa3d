# Flex Hub — khảo sát công cụ (REA, 2026-10-21)

> Bước 3 của nhiệm vụ Phase 45: phân tích app **Flex Hub** của tác giả bản gốc (OWNER đã được uỷ quyền) để
> lập danh sách tool, input/output, thông số và thuật toán. **Chỉ khảo sát — chưa code tool nào.**
> Chi tiết từng tool (bảng tham số đầy đủ, hằng số, dẫn chứng offset) nằm trong `docs/research/flex-hub/`.

## 1. Đối tượng & cách thu thập

| Hạng mục | Giá trị |
|---|---|
| App | **Flex Hub** v0.2.24 (phát hành 2026-10-20), bundle id `dev.img2print.desktop`, binary `img2print-desktop` |
| Nền tảng | Tauri v2 (Rust + webview), Windows 10/11 x64 và macOS 11+ (universal) |
| Nguồn | Trang tải `landing.vunguyenhoanglong06031992.workers.dev/flex-hub/` → GitHub release `angrybo/flex-hub-releases` (`FlexHub_0.2.24_universal.app.tar.gz`, SHA-256 `508780ea…915c`) |
| Gói | Free: mọi công cụ, **1 lượt xuất file/ngày**; Pro 250.000đ/tháng: xuất không giới hạn (quota do server cấp) |

App **không có trên máy** OWNER, nên đã tải bản phát hành công khai và **chỉ phân tích tĩnh — không cài, không chạy**:

1. REA `inspect_web_page` + `analyze_web_bundle` trên trang hub (Chromium headless, CDP loopback) — Evidence
   `ev_8407ef31…dd7` (DOM/accessibility: mô tả "hơn 20 công cụ", gói Free/Pro), `ev_00c61e3d…f5c` (bundle trang hub).
2. `lipo -thin arm64` → REA `inspect_rust_binary` — Evidence `ev_30e1dc61…8df` (không có `cargo-auditable`; suy ra commit rustc).
3. Tách frontend nhúng: Tauri lưu asset nén Brotli trong `__TEXT`, bảng `(path, bytes)` ở `__DATA_CONST` (chained fixups).
   Script đọc byte thuần: `docs/research/flex-hub/extract-tauri-assets.mjs` → 100 asset (`index.html`, ~9 MB JS, font, STL).
4. REA `analyze_javascript_application` trên cây đã tách — Evidence `ev_ce3000d0…f75` (phạm vi chọn lọc; bundle
   `index` vượt heap REA → coverage **partial**); lần chạy toàn bộ timeout 300 s, giữ partial `ev_696ca3c4…bab`.
5. Đọc tĩnh bundle (regex/slicing, không `eval`/`import`) bởi 4 agent song song → 4 file chi tiết dưới đây. Mỗi khẳng định
   có `file:charOffset` (offset ký tự trong bundle v0.2.24) và nhãn **[Quan sát] / [Suy luận] / [Chưa rõ]**.

Viết tắt file trong dẫn chứng: `P` pipeline-DVPZCkNy.js · `W` worker-Cc0bSqjO.js · `VW` worker-CzXTwprB.js ·
`App` App-CXT8Oy65.js · `T`/`TT` TimetableScreen-BkPntagu.js · `I` i18n-EFUBxO61.js · `store`/`SG` store-SGyaWieW.js ·
`design`/`D` design-mDRcZtB5.js.

## 2. Kiến trúc

- **Rust (p3d-core + vectorcraft-trace/geom):** nạp/chuẩn bị ảnh (`load_image`, `prepare_image`: xoá nền 0–60%, mặc định
  12; median smooth 0–3; upscale 1/2/4×, trần 8,4 MP), **vector hoá + lượng tử màu** (`trace_image` — VTracer/VectorCraft),
  `import_svg`, ghi file, font hệ thống, mở Bambu Studio, tài khoản (Supabase auth, RPC `claim_export`/`my_entitlements`),
  thư viện cục bộ, tab, updater (`latest.json` trên GitHub, ký minisign), gọi OpenAI cho Creative. **Thuật toán xử lý ảnh
  nằm trong Rust → [Chưa rõ]** (chưa decompile native).
- **JS / Web Worker:** toàn bộ hình học 2D/3D bằng **manifold-3d (WASM)** — cùng thư viện BaSa3D vừa đưa vào ở Phase 45;
  writer 3MF (kiểu Bambu, `extruder` theo slot, `paint_color`), STL, SVG, DXF R12; đọc 3MF/STL/OBJ.
- **App shell:** cửa sổ nhiều tab (Ctrl+T/W/Tab/1–8), màn hub là lưới tool phẳng; bắt buộc đăng nhập; mọi nút xuất đi qua
  `claimExport` (trừ quota).

## 3. Pipeline chung "ảnh → đồ in 3D nhiều màu" (dùng cho 20 sản phẩm)

Ảnh (PNG/JPG/WEBP/SVG) → prep (Rust) → trace thành các vùng màu → (nhánh SVG) gộp màu theo khoảng cách OKLab có trọng số
diện tích → `colorWorker` đổi vùng px → cross-section mm, lọc chi tiết nhỏ bằng opening ±minFeature/2 → dựng 3D:

- **Mode 1 · màu cạnh nhau:** đế dày `baseMm` (mặc định 1), mỗi màu đùn `heightMm` (1) nằm cạnh nhau trên đế.
  Xuất `<base>_mode1.3mf` + STL từng part.
- **Mode 2 · mỗi lớp một màu:** đế = `firstLayer + (baseLayers−1)·layer` (mặc định 0,6 mm); mỗi màu là một dải
  `bandLayers·layer`, dải dưới phủ cả diện tích các màu phía trên → in 1 đầu phun, đổi nhựa theo lớp; kèm
  `_swaps_en/vi.txt` (danh sách đổi filament).
- Viền sticker `Ei(art, borderMm)`, vòng móc khoá (cảnh báo `keychainThin` khi < 1,6 mm), luôn xuất kèm SVG 2D.

Chi tiết: `flex-hub/01-pipeline-va-san-pham-a.md` §1.

## 4. Danh sách công cụ

### 4.1 Sản phẩm từ ảnh (20) — cùng pipeline §3, mỗi sản phẩm thêm thân/khung riêng

| id | Tên VI | Input | Output chính | Điểm thuật toán | Chi tiết |
|---|---|---|---|---|---|
| `outline` | Viền sticker | Ảnh | `base` + màu; 3MF/STL/SVG | Viền offset quanh hình + móc khoá | 01 §2.1 |
| `rect` | Hình chữ nhật bo góc | Ảnh | Tấm bo góc + màu + móc | Bộ dựng tấm phẳng chung | 02 §10 |
| `clicker` | Nút bấm clicker | Ảnh | `shell`, `cap`, `led-holder` (1 phím) / `tray`, `topper` (khay) | Hốc switch MX, khay nhiều phím, vân thành | 01 §2.2 |
| `keycap` | Nút phím | Ảnh | `keycap` + màu | Mesh keycap 18,9×18,9×8 nhúng sẵn, chân MX; hình trên ô 14,2 mm | 02 §2 |
| `croc` | Charm dép Croc | Ảnh | `charm` | Tấm hình + chốt (mesh) | 01 §2.3 |
| `bracelet` | Vòng tay charm | Ảnh | Charm dày | Lỗ xỏ dây xuyên ngang | 01 §2.6 |
| `lightbox` | Hộp đèn | Ảnh | Hộp + tấm hình + ổ LED | Hộp rỗng theo viền ảnh, mesh ổ LED tròn | 01 §2.4 |
| `penholder` | Ống cắm bút | Ảnh | `plate` + `holder` | Vỏ rỗng theo viền hình, khe bút cạnh trên (bản làm lại v0.2.24) | 01 §2.5 |
| `canopener` | Đồ khui lon | Ảnh | Tấm khui + móc | Khe khui + rãnh đinh tán, 3 dáng thân | 01 §2.7 |
| `jar` | Hũ | Ảnh | Thân + nắp ren + topper | Mesh hũ có ren, kéo giãn theo Ø/chiều cao | 01 §2.8 |
| `toolbox` | Hộp đựng đồ | Ảnh | Hộp bản lề + khay chia ngăn + tấm hình | Mesh có sẵn, kéo giãn theo kích thước | 01 §2.9 |
| `foldbox` | Hộp gấp | Ảnh (≤13 mặt) | 1 tấm phẳng | Net hộp + rãnh gấp chữ V (bản lề sống), nắp gài | 01 §2.10 |
| `backpack` | Hộp ba lô | Ảnh (nắp + 4 thành + đáy) | Thân, nắp, chốt, cửa sổ trong | Hình học gốc nhúng (~56×62×41,2), tự dò vị trí bản lề bước 1 mm, cửa sổ khít 0,15 mm | 02 §1 |
| `thermoform` | Ép nhiệt | Ảnh | Tấm lưới, khuôn dương/âm, tấm sau, đai ốc, chốt | Dome bằng distance transform + mép 1/4 tròn; cảnh báo `thermoSlope` ≥ 3% hình trên mép | 02 §3 |
| `tray` | Khay | Ảnh | `tray-body` + insert | Insert trong rãnh lòng khay hoặc âm dưới đáy | 02 §4 |
| `notebook` | Bìa sổ | Ảnh | Bìa trước/sau A4/A5 | 5 hệ lỗ gáy (đĩa — khe nấm, lược, kẽm 3:1, 2:1, xoắn) | 02 §5 |
| `bookmark` | Bookmark | Ảnh 2 mặt | 1 hoặc 2 nửa; tuỳ chọn laser CUT/ENGRAVE | Cùng kiểu 2 mặt → tách 2 nửa dày ½ | 02 §6 |
| `layerframe` | Tranh xếp lớp | Ảnh | Mỗi màu 1 tấm + khung hộp + viền trước | Tấm cách nhau bằng gờ + chốt | 02 §7 |
| `clock` | Đồng hồ | Ảnh | Mặt đồng hồ + vạch/số | Vùng trống Ø16 ở tâm, lỗ 8–10 (8,6), hốc máy vuông 57,5; cảnh báo `clockHands` < 0,5 mm; STL máy/kim chỉ để preview | 02 §8 |
| `poptext` | Chữ pop | ≤3 dòng chữ + emoji | Topper + đế MagSafe | Chữ uốn lấp đầy đĩa, 23 emoji vector, adaptor 40×4 mm | 02 §9 |

### 4.2 Công cụ độc lập (11 id trong `Hn`, `store:38019`)

| id | Tên VI | Input | Output | Điểm thuật toán | Chi tiết |
|---|---|---|---|---|---|
| `picture` | Móc khóa | Ảnh | như §3 | Cửa vào pipeline ảnh → sản phẩm §4.1 | 01 §1 |
| `timetable` | Thời khóa biểu | Môn học, lưới ngày × tiết, chữ | Bảng + thẻ môn + đĩa ngày + chân; 3MF/STL (+ txt đổi nhựa khi 1 màu) | 17 tham số, 8 dáng bảng, ô lõm khít `tileFit`, 4 gờ bấm, chốt 6×6 | 03 §1 |
| `flexi` | Đồ chơi khớp | STL/OBJ/3MF kín | `_flexi.3mf/.stl` | Đặt cutter khớp (Ø48×25,8) lên mô hình, tự scale về 100 mm nếu ngoài [30, 300] | 03 §2 |
| `bottle` | Làm chai | Mô hình đặc, kín | `_bottle.3mf`, `_body.stl`, `_cap.stl` | Template chai Ø40×90,5, cắt z 75,5, ren bước ~3, khe nắp 0,2 | 03 §3 |
| `vase` | FLEX VASE | — (tham số) | `flex-vase.stl` + `flex-vase.json` | 31 tham số, 6 preset; cảnh báo overhang > 45°, gân < 1,6, thành < 1,2; nhựa = volume·0,00124 g | 03 §4 |
| `leather` | Rập da | SVG | DXF R12 + SVG (CUT đỏ / STITCH xanh dương / ENGRAVE xanh lá) | Lỗ may offset vào trong, góc ≥ 40°, bước đục 2,7–6; ghép mặt sau bằng Procrustes 96 mẫu; xếp tấm 300 mm, khe 6 | 03 §5 |
| `kitcard` | Thẻ lắp ráp | Mô hình 3D | `<base>_card[-n].svg/.dxf` (CUT #ff0000, ENGRAVE #00e000) | Lát X/Y ăn khớp "egg-crate", rãnh = thickness + slotFit, 5 vật liệu sẵn, kerf, cầu nối, `*.kitcard.json` | 04 §1 |
| `colorsplit` | Tách và cắt | Mô hình (có màu) | `<base>_parts.3mf` + STL từng phần | 4 kiểu nét cắt; chốt pin/key/nam châm khe 0,2, thành ≥ 0,8 | 04 §2 |
| `split3mf` | Tách 3MF | 3MF đã tô (Bambu/Orca `paint_color`, Prusa `mmu_segmentation`) | `<base>_split.3mf` + STL | Tách vùng màu thành khối: vá mặt cắt hoặc lồng khớp | 04 §3 |
| `library` | Thư viện | — | Tài sản cục bộ, gói `.flexasset` | 5 loại: design, model, picture, text, font | 04 §4 |
| `creative` | Không gian sáng tạo | Prompt, ảnh | Ảnh/văn bản → "Send to tool…" | Canvas node gọi OpenAI qua Rust (khoá của người dùng, keyring) | 04 §5 |

## 5. Đối chiếu nhanh với BaSa3D (`/tools/*`) — **[Suy luận]**, để chọn phase sau

| BaSa3D | Gần nhất trong Flex Hub | Ghi chú |
|---|---|---|
| `organizer` | `toolbox`, `tray` | Flex Hub không có tool "khay chia ngăn" thuần như bản web Flex Organizer (Phase 45 dựa trên bản web) |
| `hinge-box` | `toolbox`, `backpack` | Cả hai dùng mesh bản lề dựng sẵn + kéo giãn |
| `lamp-shade` | `lightbox`, `vase` | `vase` gần chế độ "Mô hình" của Lamp |
| `keychain-generator`, `keychain-blocks` | `picture`/`outline`/`rect` | Flex Hub có pipeline ảnh → nhiều màu (Mode 1/2) mà BaSa3D chưa có |
| `jigsaw` | — | Không có tương ứng |
| `dual-text`, `car-nameplate` | `poptext` (một phần) | — |

Khoảng trống lớn nhất của BaSa3D so với Flex Hub: **pipeline ảnh → vùng màu → 3MF nhiều màu (Mode 1/2)**. Phần lõi
(trace + lượng tử màu) nằm trong Rust, chưa đọc được; muốn làm parity cần decompile native hoặc tự chọn thuật toán
(ví dụ VTracer — MIT — chạy WASM).

## 6. Chưa rõ / giới hạn

- Thuật toán xử lý ảnh trong Rust (`prepare_image`, `trace_image`): chưa decompile (cần Ghidra/Hopper); chỉ biết tham số.
- Tool nào bị khoá Pro (`lockedTools`) do server trả về, không nằm trong bundle.
- Một số hình học chi tiết: cutter khớp của `flexi`, các thao tác cắt `pc*` của `colorsplit`, hàm sửa mesh trước khi xuất
  STL Mode 2 (`W:46739`), nguồn ảnh `wallTexture` của clicker.
- REA `analyze_javascript_application` coverage partial (bundle `index` vượt heap); kết luận chính dựa trên đọc tĩnh
  có offset, không phải quan sát runtime.
- Không chép khoá API / hạ tầng của tác giả: URL project Supabase đã được che trong file chi tiết.

## 7. Tái lập

```bash
# 1) tải bản phát hành (không chạy) vào thư mục riêng, giải nén
curl -L -o FlexHub.app.tar.gz https://github.com/angrybo/flex-hub-releases/releases/download/v0.2.24/FlexHub_0.2.24_universal.app.tar.gz
tar -xzf FlexHub.app.tar.gz
# 2) tách lát arm64 và trích asset frontend
lipo -thin arm64 "Flex Hub.app/Contents/MacOS/img2print-desktop" -output img2print-arm64
node docs/research/flex-hub/extract-tauri-assets.mjs img2print-arm64 ./flexhub-web
```

Các offset trong file chi tiết chỉ đúng với v0.2.24 (tên chunk có hash). Bản mới cần trích lại.
