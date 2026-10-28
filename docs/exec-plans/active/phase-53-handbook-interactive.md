# Phase 53 — Cẩm nang in 3D 2.0: Interactive & Traffic Flywheel

> Owner request 2026-10-28. Claude review: **GO VỚI ĐIỀU KIỆN** (B1–B4, I1–I6 below).
> Branch: `feat/phase-53-handbook-interactive` (tách từ `netlify`, chưa push). ADR-0055.

## Brief
- **Goal:** tăng thời gian on-site và chuyển đổi sang `/bao-gia` từ `/cam-nang` bằng các công cụ nhỏ ngay trong bài, ảnh lỗi in thật, preset slicer tải về.
- **Non-goals:** không DB, không thư viện mới (rule #8), không hiển thị giá BaSa3D trên `/cam-nang`, không thu email (lead gate) ở phase này, không dịch EN.
- **Kiến trúc giữ nguyên từ Phase 50:** SSG, content-as-code trong `src/data/handbook`, island nhận dữ liệu qua props.

## Quyết định từ review (đã chốt)
- **B1** Máy tính chi phí = *chi phí tự in tại nhà*, người dùng tự nhập mọi số; không đọc `pricing_configs`; VND số nguyên. ✅ (ADR-0055)
- **B2** Ảnh lỗi chỉ dùng ảnh xưởng tự chụp, cùng mẫu/góc/khung. ⏳ OWNER
- **B3** Preset chỉ phát hành **Filament + Process**, không phát hành Machine preset (G-code start/end). `.3mf` phải xoá metadata. ⏳
- **B4** Không đổi id lỗi đã publish (`bed-adhesion`, `warping`, `stringing`, `under-extrusion`, `layer-shift`, `elephant-foot`); lỗi mới (z-banding, pillowing) thêm id mới. ⏳
- **I1** Không làm Drying Widget riêng — `MaterialTable` đã có cột Sấy. ✅
- **I2** Fit Calculator: kết quả chính là kích thước CAD; cảnh báo không bù 2 lần (CAD + slicer). ✅
- **I6** Trang con theo từng lỗi `/cam-nang/loi-in/[slug]` — **OWNER quyết định** trước khi làm SEO slice.

## Slices

### ✅ S1 — Fit & Clearance Calculator (commit `6325f87`)
- [x] `src/lib/handbook/fit.ts` — pure, µm số nguyên, parse dấu phẩy thập phân, lý do lỗi thay vì throw.
- [x] `src/components/storefront/handbook/fit-calculator.tsx` — island; nhận `{id, fit, clearanceMm}` đã cắt gọn từ `HANDBOOK_TOLERANCES`.
- [x] Block `fit-calculator` ngay sau bảng dung sai (chương 07).

### ✅ S2 — Drying: không cần code (I1)

### ✅ S3 — Máy tính chi phí tự in (commit `58b47e4`, `6137647`)
- [x] `src/lib/handbook/print-cost.ts` — VND/mg/phút/W số nguyên; `1.250` g bị từ chối (không đoán).
- [x] `print-cost-calculator.tsx` — island; CTA `/bao-gia` (fallback `/custom-print`) render ở server, truyền qua `children`.
- [x] Block `cost-calculator` ở chương 04 (Slicer).

### ✅ S4 — Khung ảnh Before/After 0-JS (commit `bb7cde3`)
- [x] `HandbookDefect.photos?` + `HandbookPhoto` (src, alt, width, height, credit).
- [x] `defect-photo-toggle.tsx` — server component, radio + CSS `:has()`; lazy trong `<details>` đóng.
- [x] Test: file phải tồn tại trong `public/images/handbook/defects/`, WebP/AVIF, alt mô tả ≥ 15 ký tự, cặp ảnh cùng tỉ lệ.
- [ ] **OWNER:** chụp ảnh (xem shot list trong `phase-53-gemini-prompt.md` §1) rồi khai báo `photos` trong `src/data/handbook/troubleshooting.ts`.

### ⏳ S5 — Slicer presets (chưa làm — cần file thật đã test trên máy)
- [ ] OWNER xuất Filament + Process preset từ Bambu Studio / OrcaSlicer đã dùng thật ở xưởng (ghi rõ máy, nozzle, phiên bản slicer).
- [ ] `public/downloads/presets/` — tên có version, không ghi đè: `basa3d_<nhựa>_<slicer>_<máy>_<nozzle>_v<YYYY-MM>.json`.
- [ ] Manifest có kiểu `src/data/handbook/presets.ts` + block `presets` (server component, `<a download>`).
- [ ] Test: mọi file trong manifest tồn tại; không có key machine G-code (`machine_start_gcode`, `machine_end_gcode`, `change_filament_gcode`…); không có đường dẫn local/tên người dùng.
- [ ] GA event `handbook_preset_download`.

### ⏳ S6 — Nội dung lỗi mới (B4)
- [ ] Thêm `z-banding`, `pillowing` (id mới) với ≥ 3 cách khắc phục; cập nhật test số lượng (6 → 8) và copy "Sáu lỗi kinh điển".

### ⏳ S7 — SEO / trang con theo lỗi (chờ quyết định I6)
- [ ] Nếu GO: `/cam-nang/loi-in/[slug]` SSG từ `HANDBOOK_DEFECTS`, metadata riêng, `TechArticle` + `BreadcrumbList` + `image`; thêm vào sitemap; chương 08 giữ bảng tóm tắt có link.
- [ ] Không thêm `FAQPage`/`HowTo` (FAQ rich result đã bị Google dừng 2026; HowTo dừng 2023).

### ⏳ S8 — Đo lường
- [ ] GA events: `handbook_fit_calc_used`, `handbook_cost_calc_used` (debounce, chỉ gửi 1 lần/phiên/công cụ), `handbook_cta_click`.
- [ ] Baseline KPI trước release: organic sessions `/cam-nang`, thời gian on-site, CTR sang `/bao-gia`.

## Kiểm tra đã chạy (sandbox Linux, 2026-10-28)
- `tsc --noEmit` ✅ · `eslint` (file thay đổi) ✅ · `node --test` phase-50 + phase-53: 42/42 ✅
- `next build` ✅ (bản sao trong sandbox, font Google tắt tạm vì sandbox không có mạng tới Google Fonts):
  `/[locale]/cam-nang` vẫn ● SSG; route JS 6.23 → 9.37 kB; First Load 133 → 141 kB.

## OWNER cần làm trên macOS
- [ ] `npm test` (có DB) + `npm run build` + mở `/cam-nang` ở 375px: thử 2 máy tính, gõ `3,5`, `300.000`, ô trống, chữ.
- [ ] Duyệt giá trị mặc định của máy tính chi phí (300.000 ₫/kg, 150 W, 3.000 ₫/kWh) — chỉ là ví dụ, nhưng nên sát thực tế.
- [ ] Duyệt câu "Bambu Studio / OrcaSlicer → X-Y hole compensation (giá trị dương làm lỗ to ra)" trên bản slicer đang dùng.
- [ ] Quyết định I6 (trang con theo lỗi).

## Rủi ro đã biết
- Số liệu dung sai/sấy vẫn là "OWNER REVIEW REQUIRED" từ Phase 50 — máy tính khe hở dùng chung số đó.
- `toLocaleString('vi-VN')` chạy cả server lẫn client; Node và trình duyệt hiện đại cho cùng kết quả, nhưng nếu thấy hydration warning ở số tiền thì đây là chỗ nghi ngờ đầu tiên.
