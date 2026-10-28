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
- **I6: DEFER** (2026-10-28, Claude + OWNER) — không tạo `/cam-nang/loi-in/[slug]` ở Phase 53. Mỗi lỗi hiện chỉ 35–78 từ và chưa có ảnh thật: trang con gần như chắc chắn rơi vào "Crawled – currently not indexed", lợi ích SEO ≈ 0, có rủi ro tín hiệu chất lượng toàn site, và CTA bị xé lẻ. Thay bằng deep-link từng lỗi trên trang pillar (S7). Test `I6 DEFER is enforced` chặn việc tạo route trước khi đủ điều kiện.

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
- [x] **OWNER shot list ready:** xem `docs/content/handbook-defect-shotlist.md`. Chụp ảnh rồi khai báo `photos` trong `src/data/handbook/troubleshooting.ts`.

### ✅ S5 — Slicer presets infrastructure (commit `1f7c022`)
- [x] Typed manifest `src/data/handbook/presets.ts` + block `presets` (`slicer-presets.tsx` server component, `<PresetDownloadLink>`).
- [x] `public/downloads/presets/` sẵn sàng; tên có version, không ghi đè: `basa3d_<nhựa>_<slicer>_<máy>_<nozzle>_v<YYYY-MM>.json`.
- [x] Test: mọi file trong manifest tồn tại; không có key machine G-code (`machine_start_gcode`, `machine_end_gcode`, `change_filament_gcode`…); không có đường dẫn local/tên người dùng.
- [ ] **OWNER:** xuất Filament + Process preset từ Bambu Studio / OrcaSlicer đã dùng thật ở xưởng và thêm vào manifest.

### ✅ S6 — Nội dung lỗi mới (B4, commit `fecc617`)
- [x] Thêm `z-banding`, `pillowing` (id mới) với ≥ 3 cách khắc phục; cập nhật test số lượng (6 → 8), copy "Tám lỗi kinh điển", bump `HANDBOOK_UPDATED_AT` (`2026-10-28`).

### ✅ S7 — Deep-link từng lỗi trên trang pillar (I6 DEFER)
- [x] `src/lib/handbook/defect-anchor.ts` — anchor `#loi-<id>` (tiền tố tránh trùng id chương); `parseDefectHash` validate `location.hash` (rule #6).
- [x] `troubleshooting-table.tsx` — `id` + `scroll-mt` trên mỗi `<details>`, link "Link tới lỗi này" (copy/chia sẻ không cần JS clipboard).
- [x] `defect-hash-opener.tsx` — island render `null`, chỉ set `open` cho `<details>` được trỏ tới (lúc tải + `hashchange`); không scroll, không `querySelector`.
- [x] Tên lỗi kèm từ khoá người dùng hay tìm (warping, stringing, under-extrusion, layer shift, elephant foot); id giữ nguyên (B4).
- [x] Meta description nêu "8 lỗi" + ví dụ; test buộc số khớp `HANDBOOK_DEFECTS.length`, ≤ 160 ký tự.
- [x] Không thêm `FAQPage`/`HowTo` (FAQ rich result Google dừng 2026; HowTo dừng 2023).

#### I6 — tiêu chí mở lại (phase SEO riêng, cần đủ cả 3)
1. ≥ 3 lỗi có bài phân tích riêng ≥ 400 từ (nguyên nhân, chẩn đoán, thông số theo slicer, khi nào gửi xưởng).
2. Mỗi lỗi đó có cặp ảnh xưởng tự chụp theo `docs/content/handbook-defect-shotlist.md`.
3. Search Console cho thấy `/cam-nang` có impression cho truy vấn long-tail theo từng lỗi.

#### Guard rails khi mở lại
- `generateStaticParams` chỉ sinh trang cho lỗi có trường `article` đạt ngưỡng chữ **và** có `photos` (có test).
- Chương 08 rút về triệu chứng + 1 dòng + link sang trang con (không lặp danh sách khắc phục) → tránh cannibalization; giữ anchor `#loi-<id>`.
- Self-canonical; `TechArticle` + `BreadcrumbList` + `image`; thêm vào sitemap; không `FAQPage`/`HowTo`.
- Xoá test `I6 DEFER is enforced` trong cùng commit mở route.

### ✅ S8 — Đo lường (commit `91c7370`)
- [x] GA events: `trackHandbookToolUsed('fit' | 'cost')` (chỉ gửi 1 lần/phiên/công cụ khi có kết quả hợp lệ đầu tiên), `trackHandbookPresetDownload(id)`.
- [ ] Baseline KPI trước release: organic sessions `/cam-nang`, thời gian on-site, CTR sang `/bao-gia`.

## Kiểm tra đã chạy (sandbox Linux, 2026-10-28)
- `tsc --noEmit` ✅ · `eslint` (file thay đổi) ✅ · `node --test` phase-50 + phase-53: 42/42 ✅
- `next build` ✅ (bản sao trong sandbox, font Google tắt tạm vì sandbox không có mạng tới Google Fonts):
  `/[locale]/cam-nang` vẫn ● SSG; route JS 6.23 → 9.37 kB; First Load 133 → 141 kB.

## OWNER cần làm trên macOS
- [ ] `npm test` (có DB) + `npm run build` + mở `/cam-nang` ở 375px: thử 2 máy tính, gõ `3,5`, `300.000`, ô trống, chữ.
- [ ] Duyệt giá trị mặc định của máy tính chi phí (300.000 ₫/kg, 150 W, 3.000 ₫/kWh) — chỉ là ví dụ, nhưng nên sát thực tế.
- [ ] Duyệt câu "Bambu Studio / OrcaSlicer → X-Y hole compensation (giá trị dương làm lỗ to ra)" trên bản slicer đang dùng.
- [x] Quyết định I6 → DEFER (xem trên).
- [ ] Mở `/cam-nang#loi-stringing` trên Chrome **và** Safari iOS: trang cuộn tới đúng lỗi và lỗi tự mở; bấm "Link tới lỗi này" đổi URL, không nhảy trang.
- [ ] GA4 DebugView: mỗi công cụ (fit/cost) chỉ 1 event/lượt xem; tải preset ghi `handbook_preset_download`.
- [ ] Lighthouse mobile `/cam-nang`: CLS < 0.1, INP không kém baseline Phase 50.
- [ ] Duyệt số liệu kỹ thuật của `z-banding`, `pillowing`.
- [ ] Ghi baseline KPI (organic sessions `/cam-nang`, thời gian on-site, CTR → `/bao-gia`) để phase SEO sau so sánh.
- [ ] Sau khi xanh: chuyển file này sang `docs/exec-plans/completed/`, cập nhật dòng Phase 53 trong `docs/roadmap.md`. Ảnh xưởng và preset thật là việc nội dung, **không chặn** đóng phase (code đã sẵn sàng, ẩn khi chưa có dữ liệu).

## Rủi ro đã biết
- Số liệu dung sai/sấy vẫn là "OWNER REVIEW REQUIRED" từ Phase 50 — máy tính khe hở dùng chung số đó.
- `toLocaleString('vi-VN')` chạy cả server lẫn client; Node và trình duyệt hiện đại cho cùng kết quả, nhưng nếu thấy hydration warning ở số tiền thì đây là chỗ nghi ngờ đầu tiên.

## Kiểm tra S7 (sandbox Linux, 2026-10-28)
- `tsc --noEmit` ✅ · `eslint` (file thay đổi) ✅ · `node --test` phase-50 + phase-53: 52/52 ✅
- `next build` ✅ (bản sao, font Google tắt tạm): `/[locale]/cam-nang` vẫn ● SSG; route JS 12 kB, First Load 144 kB (gồm cả S5/S8); HTML tĩnh có đủ 8 `id="loi-…"`.
