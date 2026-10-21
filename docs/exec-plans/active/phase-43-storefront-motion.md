# Phase 43 — Animation cho storefront (tinh tế, chỉ CSS + Tailwind)

> Yêu cầu OWNER (2026-10-21): "implement animation cho web nhìn sinh động hơn".
> OWNER chọn: phạm vi **Trang chủ + Sản phẩm + Header/Footer & chuyển trang + Tools & đặt in**;
> mức **tinh tế, chuyên nghiệp**; **chỉ CSS + Tailwind** (không thêm dependency — AGENTS.md rule #8).
> Người làm: Claude. Skill `.agents/skills/ui-ux` (storefront là loại trang skill "chưa được dạy" → dùng các luật
> chuyển động chung của skill, giữ brand tactile hiện có).

## Brief (Step 1)
- **Goal:** storefront có cảm giác "sống" — phần tử hiện dần khi cuộn tới, hover/press có phản hồi, menu/accordion
  mở đóng mượt, chuyển trang êm — mà không làm chậm trang, không phá cache static của Phase 42.
- **Non-goals:** admin; canvas 3D trong các workbench `/tools/*`; đổi bố cục/màu/nội dung; thư viện animation;
  hiệu ứng lớn (parallax, số đếm, 3D xoay ở hero).
- **Outputs:** nền tảng motion trong `globals.css` + `tailwind.config.ts`; vài client component nhỏ
  (`FaqAccordion`, `ProductGallery`, `template.tsx`); chỉnh class ở các trang trong phạm vi.
- **DoD:** cuối file.

## Nguyên tắc (freeze)
1. **Chỉ `transform` + `opacity`** (ngoại lệ: accordion `grid-template-rows`, nét vẽ SVG `stroke-dashoffset`).
2. **Không animate lúc tải trang cho nội dung chính** (LCP + luật skill): hero text, banner, ảnh sản phẩm đầu tiên hiện
   ngay. Chỉ phần **dưới màn hình đầu** mới hiện dần khi cuộn tới.
3. **Hiện dần khi cuộn = CSS scroll-driven animation** (`animation-timeline: view()`), **không JS**: nội dung luôn có
   trong HTML tĩnh và luôn hiện; trình duyệt chưa hỗ trợ (Firefox) chỉ đơn giản là không có hiệu ứng. Không
   IntersectionObserver → không có rủi ro "JS chậm thì nội dung tàng hình", không ảnh hưởng trang static/ISR.
4. **`prefers-reduced-motion: reduce`** → tắt translate/scale/vẽ nét; giữ tối đa đổi màu. Mọi hiệu ứng mới đều gate
   bằng `motion-safe:` hoặc `@media (prefers-reduced-motion: no-preference)`.
5. **Nhịp thống nhất:** vi tương tác 150–200ms `ease-out`; hiện dần 600ms; panel trượt 500ms vào / 350ms ra
   `cubic-bezier(0.32,0.72,0,1)` (số của skill); ra nhanh hơn vào; không nảy lố, không scale < 95%.
6. Không lặp vô hạn gây xao nhãng (ngoại lệ: vòng sóng nút Zalo, làm chậm và nhạt hơn hiện tại).

## Danh sách hiệu ứng
### Nền tảng
- [ ] F1 `globals.css`: utility `.reveal` (mờ + trồi 16px theo view timeline) và `.reveal-stagger` (con thứ n trễ dần
      bằng `animation-range`), gate `@supports (animation-timeline: view())` + no-preference.
- [ ] F2 `tailwind.config.ts`: keyframes `draw-line`, `badge-pop`, `soft-ping`, `page-enter`.
- [ ] F3 Nút tactile (`storefrontButtonClasses` primary/accent): rê → nhấc 1px, bóng dày lên; nhấn → lún xuống, bóng
      mất ("bấm phím" — hợp brand đổ bóng cứng 3px đang dùng). Secondary giữ đổi màu.

### Trang chủ
- [ ] H1 Hero: nét "đường in" (SVG) tự vẽ dưới tiêu đề một lần (trang trí, `aria-hidden`); icon chip giá trị nghiêng nhẹ khi rê.
- [ ] H2 Banner: ảnh phóng rất nhẹ (1.02) khi rê, 700ms.
- [ ] H3 Các section dưới hero: tiêu đề + lưới card hiện dần khi cuộn, card trễ dần.
- [ ] H4 FAQ: thay `<details>` bằng accordion `grid-rows` (luật I30 của skill) — mở đóng mượt, chevron xoay,
      khối đóng `inert`. JSON-LD FAQ giữ nguyên.

### Sản phẩm
- [ ] P1 `/products`: lưới sản phẩm hiện dần khi cuộn (card đã có zoom ảnh khi rê).
- [ ] P2 Chi tiết: `ProductGallery` — bấm thumbnail đổi ảnh chính (cross-fade), thumbnail đang chọn có viền.
      Trước đây thumbnail chỉ để nhìn.
- [ ] P3 Thêm vào giỏ: dòng "Đã thêm" trượt vào; badge giỏ trên header nảy nhẹ khi số thay đổi.

### Header / Footer / chuyển trang
- [ ] N1 Menu desktop: gạch chân chạy (active đầy, rê thì mọc từ trái).
- [ ] N2 Menu mobile: luôn có trong DOM, lớp phủ mờ dần + panel trượt từ phải (500/350ms), `inert` khi đóng, Esc để đóng.
- [ ] N3 Badge giỏ hàng: `badge-pop` khi `itemCount` đổi.
- [ ] N4 `(storefront)/template.tsx`: nội dung trang mới trồi nhẹ 200ms **chỉ khi điều hướng phía client**, không
      chạy ở lần tải đầu (không hại LCP, không lệch hydration).
- [ ] N5 Footer: link đổi màu + gạch chân chạy.
- [ ] N6 Nút Zalo nổi: thay `animate-ping` (nhanh, gắt) bằng vòng sóng chậm 2.4s nhạt hơn; rê không `scale` lố.

### Tools & đặt in
- [ ] T1 `/tools`: card hiện dần khi cuộn; rê card → viền primary + ô icon đảo màu.
- [ ] T2 `/custom-print`: 4 bước + các section dưới hiện dần; hàng bảng vật liệu đổi nền khi rê.
- [ ] T3 Header của `(tools)`: mũi tên "← Về cửa hàng" nhích trái khi rê.

## Rủi ro
- **Firefox** chưa bật scroll-driven animation → không có hiệu ứng hiện dần (vẫn đầy đủ nội dung). Chấp nhận.
- **Nút tactile nhấc lên khi rê** trái luật F22 của skill (gu flat cho màn app) — storefront đang dùng gu tactile có
  bóng cứng, OWNER muốn "sinh động"; giữ biên độ 1–2px.
- File Phase 41 đang dở (`contact-link.tsx`, `format.ts`, `site.ts`, dashboard) **không đụng tới**.

## Definition of Done
- [ ] typecheck, lint, test (không DB) xanh; test hợp đồng `tests/phase-43-storefront-motion.test.ts`.
- [ ] `next build` không DB xanh; các trang static của Phase 42 vẫn prerender (không có route nào chuyển sang `ƒ`).
- [ ] Ảnh chụp trước/sau (desktop + mobile) cho Home, `/tools`, menu mobile.
- [ ] OWNER xem trên `npm run build && npm run start`, thử bật "Reduce motion" của macOS.
