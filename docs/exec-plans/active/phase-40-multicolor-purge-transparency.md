# Phase 40 — Báo giá minh bạch + tính nhựa xả đổi màu (AMS) cho .3mf chưa slice

> Yêu cầu OWNER (2026-10-21): (1) hiện thêm thông tin minh bạch ở ô "Giá in" của /custom-print;
> (2) mẫu nhiều màu trên cùng plate (vd `gengar-keycap.3mf`, P2S + AMS) đang chỉ tính giá cơ bản,
> **nhựa thải khi đổi màu chưa được tính** dù là chi phí thật.
> (Đánh số 40 vì nhánh `feature/002` chưa merge đã dùng "Phase 39" trong roadmap.)
> Đầu vào cho `/speckit-auto --from-file` sau khi OWNER chốt mục "Cần chốt".

## Hiện trạng (đọc code 2026-10-21)
| Đường | Nguồn số liệu | Nhựa xả đổi màu | Thời gian đổi màu | UI hiện |
|---|---|---|---|---|
| `.3mf` **đã slice** | `slice_info.config`: `prediction` + `used_g` mỗi filament | ✅ đã nằm trong `used_g` (slicer cộng flush + prime tower) | ✅ trong `prediction` | giờ in · gram · plate |
| `.3mf` **chưa slice** | chỉ thể tích mesh (`parseThreeMfMeshVolume`) | ❌ **coi là 1 màu**, hao hụt mặc định 5% (`colorsCount: 1, amsRequired: false`) | ❌ `12 + 1.8×gram` phút | **không hiện gì** ngoài khoảng giá (specs đều null, `.3mf` bỏ `sizeMm`) |
| `.stl/.obj` | thể tích mesh | ❌ (không có thông tin màu trong file) | ❌ | kích thước |

→ Với mẫu nhỏ nhiều màu, **nhựa xả có thể lớn hơn chính model nhiều lần** và mỗi lần đổi màu tốn thêm thời gian máy
(cắt sợi → rút → nạp → xả), nên khoảng giá "30.000đ – 30.000đ" ở ảnh chụp gần như chắc chắn **báo thiếu**.

## File .3mf chưa slice có đủ thông tin không? — Có, phần lớn
Bambu Studio lưu trong project `.3mf` (cần xác minh lại trên file thật `gengar-keycap.3mf`):
- `Metadata/project_settings.config` (JSON): `filament_colour[]`, `filament_type[]`, **`flush_volumes_matrix`**
  (mm³ xả cho mỗi cặp màu từ→tới), `flush_multiplier`, `enable_prime_tower`, `prime_tower_width`, `layer_height`,
  `printer_model` (vd "Bambu Lab P2S").
- `Metadata/model_settings.config` (XML): mỗi object/part gán `extruder` (filament số mấy), và object nào thuộc plate nào.
- `3D/Objects/*.model`: tam giác được **tô màu** (MMU painting) có thuộc tính `paint_color` → biết vùng nào dùng filament nào.
- Chiều cao model → số layer = `chiều cao / layer_height`.

Không có trong file chưa slice: số lần đổi màu chính xác (slicer mới biết thứ tự in từng layer) → phải **ước lượng**.

## Mô hình ước lượng đề xuất (chỉ cho `.3mf` chưa slice, ≥ 2 màu trên cùng plate)
```
k                = số filament thực sự dùng trên plate (part extruder ∪ paint_color)
layers_multi     = số layer có ≥ 2 màu   (khoảng z chung của các vùng màu khác nhau / layer_height)
color_changes    ≈ layers_multi × (k − 1)                       (slicer xếp để mỗi layer đổi k−1 lần)
purge_mm3        ≈ color_changes × trung bình(flush_volumes_matrix) × flush_multiplier
purge_g          ≈ purge_mm3 / 1000 × tỉ trọng (PLA 1.24)  + prime tower (nếu bật)
thêm_thời_gian   ≈ color_changes × T_change                     (T_change P2S: đo thực tế, mặc định 40 s)
gram_tính_giá    = gram_model (khoảng 0.35–0.75 như hiện tại) + purge_g
phút_tính_giá    = phút_ước_lượng + thêm_thời_gian
```
Ví dụ minh hoạ (số giả định, cần kiểm bằng file thật): keycap cao 20 mm, layer 0.2 mm, 4 màu suốt chiều cao →
100 × 3 = 300 lần đổi màu × ~200 mm³ ≈ 60 cm³ ≈ **75 g nhựa xả** (model chỉ vài gram) và thêm ~**3,3 giờ** máy.

## Thông tin minh bạch hiển thị ở ô "Giá in" (không lộ chi phí nội bộ/margin — quy tắc B1)
- Chip: kích thước (mm) · số plate · **số màu + ô màu** (từ `filament_colour`) · vật liệu.
- Dòng "Ước tính": nhựa model ~X–Y g · **nhựa xả đổi màu ~Z g (~N lần đổi màu)** · thời gian máy ~H giờ.
- "Giá đã gồm": nhựa (kể cả nhựa xả), điện, khấu hao máy, hao hụt/in lỗi dự phòng, thao tác & đóng gói.
  "Chưa gồm": phí ship, hậu kỳ/sơn, thiết kế lại.
- Khi min = max: hiện **một giá** thay vì "30.000đ – 30.000đ".
- Mẫu nhiều màu chưa slice: nhãn cảnh báo "Mẫu N màu — nhựa xả đổi màu được ước tính; slice file để có giá chính xác".

## Lát cắt (không đổi DB — không migration)
1. Parser `src/lib/parsers/threemf-project-info.ts`: đọc project_settings (JSON) + model_settings (XML) + `paint_color`
   theo plate, có giới hạn kích thước như các parser hiện có (zip bomb, Phase 35 D4). Trả `{ plates: [{ filaments, layersMulti, ... }], flushAvgMm3, layerHeight, printerModel }`.
2. `instant-estimate.service.ts`: `estimateFromMesh` nhận thêm `projectInfo` → cộng `purge_g` (dòng vật liệu riêng
   "Nhựa xả đổi màu", `extraWaste: 'NONE'` để không cộng thêm % hao hụt) + `thêm_thời_gian`.
   DTO `specs` thêm `colors[]`, `purgeGrams`, `colorChanges`, `modelGramsRange`.
3. UI `custom-request-form.tsx`: chip + dòng ước tính + "đã gồm / chưa gồm" + một giá khi min = max. Chuỗi qua messages vi/en.
4. Test: parser với fixture `.3mf` thật (OWNER cung cấp `gengar-keycap.3mf` + 1 file 1 màu); estimate nhiều màu > 1 màu;
   so với bản đã slice của cùng file (sai số mục tiêu ±30% gram, ±30% thời gian).
5. Docs: ADR "Ước tính nhựa xả cho .3mf chưa slice"; business-rules (giá ước tính gồm nhựa xả).

## Kèm theo (từ review công thức 2026-10-21, cùng file service)
- `roundInstant`: làm tròn **lên** 5.000đ (hiện là gần nhất → có lúc thấp hơn giá ADR-0010).
- Nhân công nhiều plate: `15' × số plate + phút ráp` thay vì 20'/50' cố định.
- Dòng keo/vật tư cho gói "ráp sẵn" ở storefront.

## Cần chốt (OWNER)
- [ ] Gửi file `gengar-keycap.3mf` (và bản đã slice nếu có) vào thư mục `Downloads/basa3d` để làm fixture + đối chiếu.
- [ ] `T_change` thực tế trên P2S (đồng hồ: từ lúc cắt sợi tới lúc in tiếp) — mặc định 40 s.
- [ ] Có tính thêm hao mòn AMS/cutter theo số lần đổi màu không, hay để trong % khấu hao.

## Definition of Done
- [ ] Mẫu nhiều màu chưa slice: giá ước tính gồm nhựa xả + thời gian đổi màu, sai số so với bản slice ≤ ±30%
- [ ] UI hiện chip màu, nhựa xả, thời gian, "đã gồm/chưa gồm", một giá khi min = max (375px + 1280px)
- [ ] lint · typecheck · npm test · build xanh; test parser + estimate mới
- [ ] ADR + business-rules cập nhật; đóng bằng `close-phase`
