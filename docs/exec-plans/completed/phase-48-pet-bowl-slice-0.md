# Phase 48 — Pet bowl stand, lát 0: quyết định + hạ tầng (GATE A)

> Owner yêu cầu 2026-10-22, sau khi duyệt phase 47 làm tài liệu khảo sát. Lát 0 làm trước `/speckit-auto` (MVP
> `/tools/pet-bowl-stand`) và được commit local riêng. Không push, không deploy, không mở lại REA.

## Brief
- **Goal:** chốt khung quyết định (ADR-0050), mở rộng 3MF writer mà không đổi output cũ (ADR-0051), viết helper text dùng
  chung, chặn commit evidence REA, rồi dừng ở GATE A.
- **Non-goals:** engine/geometry/UI của giá bát (thuộc `/speckit-auto`); bản không AMS; mọi thứ trong backlog phase 47.
- **Inputs:** phase 47 (BLOCKERS 1–3, IMPORTANT 2/3/5), OWNER INPUT (**trống toàn bộ** ở lần chạy này).
- **Risks:** chạy speckit trên số tạm → engine đúng logic nhưng sai kích thước thật. Vì vậy flag phải tắt.

## Checklist
- [x] ADR-0050: bát, dung sai, công thức chiều cao, ổn định (tỉ lệ đáy/H + góc lật khi bát đầy nước), GDV — `docs/architecture/decisions.md`
- [x] Constants một file `src/lib/3d-tools/pet-bowl-stand/pet-bowl-stand-constants.ts`, mọi giá trị tạm có comment `CHƯA ĐO / CHƯA CHỐT / CHƯA DUYỆT`, liệt kê trong `PET_BOWL_UNCONFIRMED`
- [x] Flag `NEXT_PUBLIC_PET_BOWL_ENABLED` (chỉ bật khi đúng `"true"`), `src/config/pet-bowl.ts`, `.env.example=false`; test giữ flag tắt khi danh sách chưa rỗng
- [x] ADR-0051: `write3mf(parts, name, { extruders })` + `extrudersByColor()`; mặc định tắt
- [x] Snapshot **trước khi sửa**: `tests/3mf-writer-snapshot.test.ts`, 12 digest SHA-256 của 7 tool (lamp-shade, dual-text, car-nameplate, hinge-box, jigsaw 3MF+zip, keychain-blocks compact/modular 3MF+zip, organizer label+bin). Date mock + `TZ=UTC`, đã chạy với `TZ=America/Los_Angeles`. Sau khi sửa writer, cả 12 digest vẫn giữ nguyên
- [x] Test chế độ mới: có `model_settings.config`, Content_Types override, id part = id object, extruder theo màu, từ chối sai số lượng / ngoài 1–16
- [x] `.gitignore`: `docs/rea/*/evidence/`
- [x] Helper `src/lib/3d-tools/common/text-metrics.ts`: `normalizeText` (NFC + gộp khoảng trắng), `graphemes/graphemeCount` (`Intl.Segmenter`), `findMissingGlyphs`, `textWidthMm`, `arcLengthMm`, `fitTextOnArc`. Test `tests/text-metrics.test.ts`: tiếng Việt dựng sẵn/tổ hợp, emoji, ZWJ, cờ, chữ Hán, khoảng trắng
- [x] typecheck + lint + test
- [x] **GATE A** (2026-10-22): owner duyệt lát 0, cho chạy `/speckit-auto` trên số tạm (flag tắt), sẽ gửi số đo sau
- [x] Bàn in = `petBowlBuildVolumeMm()` (min mọi profile); ADR-0051 ghi `model_settings.config` chỉ có tác dụng với Bambu/Orca + Unknown "import 3MF vào slicer Snapmaker"

## Giá trị còn CHƯA ĐO / CHƯA CHỐT / CHƯA DUYỆT
| Hằng số | Giá trị tạm | Owner cần cung cấp |
|---|---|---|
| `BOWL_SIZES` S | Ø miệng 150, Ø gờ 150, Ø thân dưới gờ 130, sâu 50, 450 ml, 120 g | Đo bát thật |
| `BOWL_SIZES` M | Ø miệng 200, Ø gờ 200, Ø thân dưới gờ 175, sâu 60, 1000 ml, 200 g | Đo bát thật |
| `HOLE_CLEARANCE_MM` | 1,0 | Dung sai lỗ ôm bát mong muốn |
| `MIN_LEDGE_WIDTH_MM` | 3 | Gờ đỡ tối thiểu mỗi bên |
| `BOWL_FLOOR_CLEARANCE_MM` | 5 | Khe dưới đáy bát |
| `HEIGHT_RULES` | chó: k 0,25, 60–200 mm; mèo: k 0,25, 60–120 mm | Công thức chiều cao theo loài |
| `SHOULDER_HEIGHT_RANGE_MM` | 150–800, bước 5 | Khoảng nhập vai |
| `MIN_BASE_TO_HEIGHT_RATIO` | 1,0 | Ngưỡng ổn định |
| `MIN_TIP_ANGLE_DEG` | 20° | Ngưỡng góc lật khi bát đầy nước |
| `MIN_WALL_MM` | 1,6 | Thành tối thiểu |
| `PET_BOWL_MAIN_PRINTER_ID` | `null` | Máy in chính cho giá bát (U1 hay P2S); chỉ ảnh hưởng ghi chú slicer. Bàn in đã chốt = min buildVolume mọi profile (256 mm) |
| `GDV_WARNING` VI/EN | Câu tạm "hỏi bác sĩ thú y…" | Duyệt nội dung |

## Sau GATE A
Chạy `/speckit-auto` với prompt MVP trong yêu cầu của owner. Spec phải đọc constants từ file trên, **không** chép số
vào spec. Đánh giá lại: chỉ bật flag khi `PET_BOWL_UNCONFIRMED` rỗng **và** đã in thử 1 giá cho mỗi cỡ bát (ADR-0050 Trade-off).
