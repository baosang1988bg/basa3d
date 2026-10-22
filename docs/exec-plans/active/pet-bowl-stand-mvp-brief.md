# Công cụ thiết kế giá bát ăn thú cưng /tools/pet-bowl-stand — MVP (đầu vào /speckit-auto)

> Owner duyệt GATE A lát 0 ngày 2026-10-22, cho chạy trên **số tạm** với `NEXT_PUBLIC_PET_BOWL_ENABLED=false`.
> Owner sẽ gửi số đo bát, công thức chiều cao, ngưỡng ổn định và câu GDV sau. Khi đó **chỉ** sửa constants + ADR-0050 rồi
> chạy lại test, nên engine/UI/test **không được chép số** ra ngoài file constants.
> Không push, không deploy.

## Nguồn (đọc trước)
- `docs/exec-plans/active/phase-47-printpaws-rea.md`: khảo sát hành vi trang tham khảo. Mục I-8 là danh sách lỗi **không được sao chép**.
- `docs/exec-plans/active/phase-48-pet-bowl-slice-0.md`: lát 0, bảng giá trị CHƯA ĐO.
- `docs/architecture/decisions.md`: **ADR-0050** (bát, dung sai, chiều cao, ổn định, GDV, bàn in), **ADR-0051** (3MF extruders).
- `AGENTS.md`, `docs/database/business-rules.md`, `.agents/skills/ui-ux/SKILL.md`.

## Đã có sẵn từ lát 0 (dùng lại, không viết lại)
- `src/lib/3d-tools/pet-bowl-stand/pet-bowl-stand-constants.ts`: nguồn số duy nhất (`BOWL_SIZES`, `HOLE_CLEARANCE_MM`,
  `MIN_LEDGE_WIDTH_MM`, `BOWL_FLOOR_CLEARANCE_MM`, `HEIGHT_RULES`, `SHOULDER_HEIGHT_RANGE_MM`, `MIN_BASE_TO_HEIGHT_RATIO`,
  `MIN_TIP_ANGLE_DEG`, `MAX_OVERHANG_DEG`, `MIN_WALL_MM`, `BED_MARGIN_MM`, `petBowlBuildVolumeMm()`, `GDV_WARNING`,
  `PET_BOWL_UNCONFIRMED`). Giá trị mới nào chưa đo thì **thêm vào file này** với comment `// CHƯA ĐO — xem ADR-0050`
  và thêm tên vào `PET_BOWL_UNCONFIRMED`.
- `src/config/pet-bowl.ts`: `isPetBowlEnabled()` / `PET_BOWL_ENABLED_IN_BROWSER` (bật chỉ khi `=== 'true'`). `.env.example` đã có flag = false.
- `src/lib/3d-tools/common/3mf-writer.ts`: `write3mf(parts, name, { extruders })` + `extrudersByColor()` (ADR-0051).
  `tests/3mf-writer-snapshot.test.ts` giữ output 7 tool cũ byte-for-byte; **không sửa golden**.
- `src/lib/3d-tools/common/text-metrics.ts`: `normalizeText`, `graphemeCount`, `findMissingGlyphs`, `textWidthMm`, `fitTextOnArc`.

## MVP
- Engine thuần TS `src/lib/3d-tools/pet-bowl-stand/` (params + validate + kích thước dẫn xuất + danh sách cảnh báo/lỗi;
  test được không cần DOM). Geometry bằng `manifold-3d` trong Web Worker theo mẫu organizer (ADR-0047: module inject,
  `delete()` mọi object WASM, request id, debounce). Preview three.js. Text bằng opentype.js + helper `text-metrics`.
- Hình: thân **trụ** hoặc **nón** (profile xoay). Lỗ ôm bát + gờ đỡ theo ADR-0050 §2. **1 hoặc 2 bát** (cỡ S/M từ `BOWL_SIZES`).
  Đường nối 2 màu: **thẳng** + **1 kiểu sóng do BaSa3D tự thiết kế** (không dùng kiểu, tên hay số liệu của Print Paws).
  Tên bé chạy theo cung trên thân, nổi hoặc chìm.
- Chiều cao: `HEIGHT_RULES[loài]` theo vai (ADR-0050 §3), khách chỉnh được trong [min, max].
- Kiểm tra in, **chặn** export/báo giá kèm lý do khi vi phạm:
  - vành/gờ < lỗ + 2 × gờ tối thiểu;
  - vượt `petBowlBuildVolumeMm()` (min mọi printer profile, không hard-code);
  - overhang > 45°;
  - thành < `MIN_WALL_MM`;
  - ổn định theo ADR-0050 §4 (tỉ lệ đáy/H **và** góc lật khi bát đầy nước).
- Tên bé: rỗng/toàn khoảng trắng → lỗi rõ ràng (không lặng lẽ bỏ); giới hạn theo **cung còn trống** (`fitTextOnArc`) và
  số grapheme; glyph thiếu (emoji, chữ Hán…) → lỗi liệt kê ký tự; không cho chữ vắt qua đường nối.
- Export **chỉ bản AMS 2 màu**: 3MF qua `write3mf(..., { extruders: extrudersByColor(parts) })` + STL zip (1 file/part).
  Tên file = `slug(tên bé)` (tái dùng `slug()` trong `organizer/organizer-export.ts` hoặc đưa vào `common/`).
  Đặt mô hình trên bàn in (z ≥ 0).
- UI: `/[locale]/(tools)/tools/pet-bowl-stand`, trả 404 khi flag tắt; ẩn khỏi trang `/tools` khi flag tắt.
  Cảnh báo GDV (`GDV_WARNING`) **luôn hiện** khi chọn chó. Trạng thái empty/loading/error theo `.agents/skills/ui-ux`;
  mobile-first; VI/EN qua `messages/`; GA4 `tool_pet_bowl_*` theo mẫu `src/lib/analytics`.
- Giá: báo giá qua `POST /api/public/tool-price-estimate` (giữ tính giá ở server) + nút Custom Request (upload STL/3MF như
  lamp-shade). **Ghi rõ trong exec-plan:** chỉ PLA 1 màu, chưa tính hao nhựa đổi màu; TODO hiệu chỉnh bằng 1 lần slice thật.
- Test:
  - unit engine: biên chiều cao theo loài, cỡ bát S/M, 1/2 bát, gờ < lỗ, vượt bàn in, ổn định, tên (rỗng, tiếng Việt,
    emoji, quá dài theo cung);
  - test 3MF hợp lệ (số object, `model_settings.config` + extruder theo màu, bbox trong build volume, z ≥ 0);
  - `e2e/pet-bowl-stand.spec.ts` chạy với flag bật trong môi trường test.

## Ngoài phạm vi (ghi vào backlog của exec-plan)
- Bản không AMS lồng 2 nửa (cần in thử dung sai).
- Nghiêng mặt bát.
- Tai / chân / mặt mèo.
- Rãnh chống kiến.
- Phối ngẫu nhiên + hoàn tác.
- Lưu thiết kế trên máy.
- Bát tự đặt kích thước.
- U-3 (payload thanh toán của trang tham khảo).
- Bật extruders cho các tool cũ.

## Kết thúc
- Cập nhật `docs/exec-plans/active/feature-NNN-*.md`, `docs/roadmap.md`, `CHANGELOG.md`.
- Liệt kê mọi giá trị còn `CHƯA ĐO` trong exec-plan.
- Review theo BLOCKERS / IMPORTANT / NICE TO HAVE / RECOMMENDATION.
