# Phase 46 — Flex Keychain: khảo sát hành vi bằng REA & đối chiếu `/tools/keychain-blocks`

> Owner yêu cầu 2026-10-21; owner xác nhận **đã được chủ trang tham khảo cho phép** phân tích.
> Phạm vi: chỉ quan sát hành vi (UI, network, cấu trúc file export). Không tải/sao chép mã nguồn
> hay asset của trang; file export chỉ được đọc cấu trúc trong bộ nhớ trình duyệt, không lưu ra đĩa.
> Phase này là **khảo sát + đề xuất**, chưa sửa code.

## Brief (Step 1)
- **Goal:** ghi lại control, default, ràng buộc, network và cấu trúc STL zip / 3MF của trang tham khảo
  `https://flex-keychain.vunguyenhoanglong06031992.workers.dev/`, đối chiếu với `/tools/keychain-blocks`.
- **Non-goals:** clone geometry/asset của trang; sửa engine trong phase này.
- **Inputs:** kịch bản REA `docs/rea/flex-keychain/scenario.json`, script `scripts/rea/run-flex-keychain.sh`,
  code BaSa3D (đường dẫn ở bảng Evidence).

## Cách thu evidence

| Tiền tố | Nguồn | Trạng thái |
|---|---|---|
| `C-xx` | Claude in Chrome, 2026-10-21: accessibility tree, thuộc tính DOM, network log, chặn blob export trong trang để đọc cấu trúc zip/3MF | **Đã có** (số liệu trong doc này) |
| `R-xx` | `rea capture-browser-scenario` (rea-agents 6.7.0) chạy cùng các bước S01–S11 | **Chờ chạy trên Mac**: sandbox của agent bị proxy chặn `*.workers.dev` (HTTP 403) |
| `B-xx` | Code BaSa3D (`src/...`) | Đã đọc |

Chạy REA để có evidence chuẩn: `./scripts/rea/run-flex-keychain.sh` → `docs/rea/flex-keychain/evidence/scenario-*.json`.
Lưu ý: REA **huỷ download** và chỉ ghi `suggested_filename` (sự kiện `download-cancelled`), nên cấu trúc
bên trong 3MF/zip vẫn phải dựa vào `C-30…C-36`. Sau khi chạy xong, điền mapping `R-xx` ở cuối file.

---

## Observations (trang tham khảo)

### Control & mặc định
| ID | Control | Mặc định | Ràng buộc quan sát được |
|---|---|---|---|
| C-01 | `NAME` — `input.word-input`, placeholder "TYPE A NAME" | `FLEX` | `maxLength=10`; CSS `text-transform: uppercase` (value giữ nguyên chữ thường, map cap không phân biệt hoa/thường) |
| C-02 | Nhãn phụ dưới NAME | "4-slot base" | Đổi theo số ký tự: "6-slot base"; Modular → "6-unit modular (Bubbly)" |
| C-03 | `BASE TYPE` — segmented | `Compact` | Compact / Modular; chọn Modular hiện thêm **Bubbly** (mặc định) / **Bubbly V2** |
| C-04 | `TYPEFACE` — `select.font-select` | `default` = "Default (built-in)" | Poppins, Bungee, Titan One, Bangers, Be Vietnam Pro; "Upload font…" nhận `.ttf,.otf,.woff`; có nút **Reset** khi đổi font; ghi chú "Applied to letters — icons unaffected." |
| C-05 | `SWITCH` — segmented + nút mắt `icon-toggle` | `Physical`; preview switch tắt (`aria-pressed=false`) | Physical / 3D-printed; nút mắt "Show/Hide switch preview" |
| C-06 | `BASE COLOR` — `input[type=color]` | `#f4f2ee` | — |
| C-07 | `SLOTS` — mỗi `.slot-row`: select ký tự + `Cap color` + `Text/icon color` | Option đầu là "`X` (auto)" theo ký tự tên | Danh sách option: (blank), 0–9, A–Z, `? ! & @ $`, 30 chữ có dấu Latin (Å Æ Ø Œ Ç Ä Ñ Ů Ÿ Á À Â Ã É Ê Ë È Í Î Ï Ì Ó Ô Ö Ò Õ Ú Û Ü Ù), 21 icon (airplane, apple, banana, basketball, cat, cloud, clover, coffee, duck, fire, flower, grapes, heart, lightning, moon, music, paw, ribbon, rugby, soccer, star) |
| C-08 | Màu cap mặc định theo vị trí | `#e0665b, #e0a13b, #e0d23b, #7bc47f, #4fa3e0, #7b6fe0` (slot 1→6) | Text/icon mặc định `#ffffff` |
| C-09 | Nút export | — | "Export Bambu 3MF (colors)" (`.export-btn`), "Export STL zip" (`.export-btn.secondary`) |

### Xử lý tên (nhập qua input event)
| ID | Input | Kết quả |
|---|---|---|
| C-10 | `A B` | 3 slot; khoảng trắng thành 1 slot; nhãn: "— some characters have no matching cap, shown blank" |
| C-11 | `ĐẠT` | 3 slot; Đ, Ạ không có cap → blank + cảnh báo như trên (tiếng Việt **không** được hỗ trợ đủ) |
| C-12 | `Hé!` | 3 slot, không cảnh báo (é → cap É) |
| C-13 | `😀A` | Danh sách slot có 2 dòng nhưng nhãn ghi "**3**-slot base" → đếm theo UTF-16 code unit (lệch) |
| C-14 | `ABCDEFGHIJKLM` (13 ký tự, đặt bằng script vượt `maxLength`) | Danh sách slot rỗng, không có thông báo lỗi |
| C-15 | `""` | 0 slot, nhãn phụ biến mất |

### Kịch bản chính (S01–S11, tương đương `scenario.json`)
- C-20: Nhập `BASA3D` → 6 slot B, A, S, A, 3, D; nhãn "6-slot base".
- C-21: Slot 1 Cap color → `#1e3a8a`, slot 4 Text color → `#ffd700`; preview 3D cập nhật ngay.
- C-22: Network khi tải trang và đổi tên: chỉ có `GET` HTML, `assets/index-*.js`, `assets/index-*.css` và các mesh dựng sẵn
  `assets/base/base-{N}.stl`, `assets/caps/{letter|digit|punct|accent|icon}-<id>-body.stl` và `…-glyph.stl`.
- C-23: Khi bấm 2 nút export, trang **tải lại toàn bộ mesh** (base + 6×body + 6×glyph, mỗi lần export một lượt) và
  **không gọi API, analytics hay bất kỳ origin bên ngoài nào**. Export chạy hoàn toàn phía client.
- C-24: Modular → `assets/base/modular-bubbly.stl`; 3D-printed → `assets/print-switch.stl`; font Poppins →
  `assets/fonts/Poppins-Bold.ttf` và cap chuyển sang `blank-body.stl` (glyph dựng từ font lúc runtime).

### File export (đọc trong bộ nhớ, không lưu ra đĩa)
- C-30: Tên file `BASA3D.3mf` (`model/3mf`, 467 670 B) và `BASA3D-stls.zip` (`application/zip`, 711 777 B), tức là **lấy theo tên người dùng nhập**.
- C-31: 3MF chỉ gồm 3 entry: `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`. Không có `Metadata/model_settings.config`,
  `project_settings.config` hay thumbnail. `<metadata name="Application">Flex Keychain Text</metadata>`.
- C-32: Màu: một `m:colorgroup id=1` (namespace material 2015/02) gồm 9 màu đã khử trùng
  (`#F4F2EE, #1E3A8A, #FFFFFF, #E0A13B, #E0D23B, #7BC47F, #FFD700, #4FA3E0, #7B6FE0`).
- C-33: 7 `object` (base + 6 cap), **không có `name`**, 7 `build/item` riêng, không transform. Màu gán **theo tam giác**
  (`pid=1 p1=…`): mỗi cap là **1 mesh có 2 màu** (body 5 364 tam giác + glyph 736–1 204 tam giác). Vertex được dùng chung
  (vd. cap 1: 3 170 vertex / 6 340 tam giác).
- C-34: 3MF được **xếp sẵn trên bàn in**: cap nằm phẳng, z 0–5.59 mm, bước 24 mm (x 16→154, y 16–34); base nằm riêng
  ở y 79–101, kích thước 128.38 × 22 × 16 mm.
- C-35: STL zip gồm 13 file binary theo **toạ độ lắp ráp**: `base.stl` (9 082 tam giác, 128.38 × 22 × 16 mm), và
  `cap-{i}-{char}-body.stl` + `cap-{i}-{char}-glyph.stl` riêng cho từng slot. Body cap 18 × 18 mm, z 8.5–13.5; glyph nổi 0.6 mm (z 13.48–14.08);
  bước cap ≈ 20.51 mm.
- C-36: Modular/Bubbly + 3D-printed + Poppins → 3MF có 18 object: 6 đế module 26 × 34.54 × 16 mm, 6 cap,
  6 switch in 13.5 × 19.65 × 13 mm (thêm màu `#8B8F97`). Bbox của đế module đầu tiên (x 77–103, y 72.73–107.27)
  **chồng lên** switch #4 (x 66.25–79.75, y 75.17–94.82) trên bàn in.

## Observations (BaSa3D `/tools/keychain-blocks`)
| ID | Nội dung | Nguồn |
|---|---|---|
| B-01 | Tên: NFC → uppercase → cắt ở `MAX_BLOCKS = 16` ký tự (đếm theo code point); mặc định `BASA` | `keychain-blocks-workbench.tsx:67`, `keychain-blocks-constants.ts:1` |
| B-02 | Ký tự hợp lệ: Latin (có dấu tiếng Việt), 0–9, `? ! & @ $`; 17 icon Lucide; slot dropdown không có "(auto)" và không có chữ có dấu | `keychain-blocks-engine.ts:32`, constants `:115-117` |
| B-03 | Base type Compact/Modular (Modular = 1 khối có rãnh khuyết); không có Bubbly/V2 | engine `:111-129` |
| B-04 | Switch Physical/3D-printed **chỉ ghi vào mô tả báo giá**, không đổi geometry | workbench `:28, 101` |
| B-05 | Base mặc định `#334155`; palette `#ef4444, #f59e0b, #eab308, #22c55e, #3b82f6, #a855f7`; glyph `#ffffff` | constants `:12, :118` |
| B-06 | Geometry: khối 12 × 12 × 8 mm liền với đế phẳng 2 mm, khe 0.8 mm; glyph nổi 1.2 mm, đùn từ font (opentype) | constants, engine `:37, 85-97` |
| B-07 | 3MF: 1 object/part có `name` (`compact-base`, `slot-N-block`, `slot-N-glyph`), màu **theo object** (`pid/pindex`), thêm 1 object assembly "Compact keychain" (kể cả Modular) và **1** build item; toạ độ lắp ráp | `common/3mf-writer.ts:19-35` |
| B-08 | STL zip: gộp block+glyph thành 1 file; tên `00-compact-base.stl` (sai khi Modular), `NN-block.stl` (không có ký tự) | `3mf-writer.ts:37-53` |
| B-09 | Tên file cố định `moc-khoa-khoi.3mf` / `.zip` | workbench `:87` |
| B-10 | Network: `POST /api/public/tool-price-estimate` (debounce 500 ms), GA4 `tool_keychain_blocks_*`, upload báo giá; export chạy client-side | workbench `:51-65, 92-105` |

## Inferences
- I-1 (từ C-24, C-34, C-35, C-36): Sản phẩm tham khảo là **keycap cắm trên switch**. Đế cao 16 mm chứa switch (thật,
  hoặc switch in `print-switch.stl`), cap 18 × 18 in rời. BaSa3D (B-06) đang làm **khối đặc liền đế**, tức là khác hẳn
  concept sản phẩm, không chỉ khác về UI. Đây là gap lớn nhất. *Độ tin: cao (bbox + tên asset), chưa thấy switch thật.*
- I-2 (C-22, C-24): Trang tham khảo dùng **mesh dựng sẵn cho từng ký tự**; chỉ khi đổi font mới dựng glyph lúc runtime.
  BaSa3D đùn mọi ký tự từ font, linh hoạt hơn (hỗ trợ tiếng Việt, xem C-11 với B-02) nhưng khó đạt độ "bóng bẩy" của cap dựng sẵn.
- I-3 (C-33 với B-07): Màu theo tam giác giúp mỗi cap thành **1 part 2 màu** trên Bambu Studio. Cách của BaSa3D (assembly +
  sub-object) có thể hiện thành 1 object nhiều part. Cả hai đều thiếu `model_settings.config` nên không gán sẵn khay AMS.
- I-4 (C-34 với B-07): 3MF tham khảo "print-ready" (xếp phẳng); STL zip tham khảo giữ toạ độ lắp ráp để xem trước.
  BaSa3D dùng toạ độ lắp ráp cho cả hai.
- I-5 (C-13, C-14, C-23, C-36): Trang tham khảo có lỗi nhỏ (đếm emoji theo UTF-16, >10 ký tự không báo lỗi,
  tải lại asset mỗi lần export, có thể xếp chồng trên bàn in ở Modular). **Không sao chép các hành vi này.**

## Unknowns
- U-1: Loại switch "Physical" (MX? Kailh choc?) và hình học chân cap/socket. Cần ảnh sản phẩm thật hoặc hỏi chủ trang.
- U-2: Bambu Studio xử lý 3MF tham khảo (per-triangle color) và 3MF BaSa3D (per-object) ra sao: số object, gán filament.
  Cần import thử thủ công.
- U-3: Khác biệt hình học Bubbly và Bubbly V2; base type Compact khi Switch = 3D-printed.
- U-4: Hành vi khi upload font `.woff` và nút Reset font.
- U-5: Bbox chồng nhau ở C-36 có gây va chạm thật trên bàn in không (bbox ≠ hình thật).

## Đề xuất lát cắt (chưa làm, cần owner duyệt)
- [ ] A. Quyết định concept sản phẩm (I-1): giữ "khối liền đế" hay chuyển sang "keycap + switch". Cần ADR, vì việc này ảnh hưởng geometry, giá và quy trình in.
- [ ] B. Export: tên file theo tên người dùng (C-30); STL zip đặt tên `NN-<char>-...` (sửa B-08 với Modular); thử 3MF dạng
  per-triangle color + xếp phẳng (C-33, C-34) sau khi trả lời U-2.
- [ ] C. Slot dropdown: thêm "(auto)" + chữ có dấu (khép spec parity cũ); giữ lợi thế tiếng Việt (B-02 so với C-11).
- [ ] D. Chạy `scripts/rea/run-flex-keychain.sh`, điền mapping R-xx bên dưới.

## Definition of Done (phase khảo sát)
- [x] Liệt kê control, default, ràng buộc (C-01…C-15)
- [x] Kịch bản BASA3D + đổi màu 2 khối + 2 export (C-20…C-24)
- [x] Cấu trúc 3MF/STL zip (C-30…C-36)
- [x] Đối chiếu BaSa3D (B-01…B-10)
- [ ] Evidence REA chính thức (R-xx) — chờ chạy trên Mac

## Mapping REA (điền sau khi chạy)
| R-ID | Step / event trong evidence JSON | Xác nhận cho |
|---|---|---|
| R-01 | `S03-fill-name` + DOM/accessibility cuối | C-20 |
| R-02 | `S05`, `S06` | C-21 |
| R-03 | events `network` | C-22, C-23 |
| R-04 | events `download-cancelled` (`suggested_filename`) | C-30 (chỉ tên file) |
