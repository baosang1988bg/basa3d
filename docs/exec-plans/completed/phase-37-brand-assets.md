# Phase 37 — Bộ nhận diện thương hiệu BASA 3D trên storefront

> Đầu vào cho `/speckit-auto --from-file`. Ảnh gốc do OWNER cung cấp (2026-10-20); Claude đã xử lý
> thành asset web và commit sẵn. Agent chỉ viết code dùng asset, **không tạo/sửa file ảnh**.

## Goal
Thay chữ "BaSa3D" trơn bằng logo thật, có favicon/app icon, ảnh chia sẻ khi gửi link lên Zalo/Facebook,
banner thương hiệu ở trang chủ và thẻ liên hệ ở footer.

## Non-goals
- Không đổi màu chủ đạo / design tokens toàn site (chỉ dùng logo, không re-theme).
- Không đổi `SITE_CONFIG` (hotline, Zalo, email đã đúng: 0333 698 638, basa3d.vn@gmail.com).
- Không làm trang "Giới thiệu" mới. Không đụng admin (trừ favicon dùng chung).

## Asset có sẵn (đã commit — KHÔNG sinh lại)
| File | Kích thước | Dùng cho |
|---|---|---|
| `public/brand/basa3d-logo.webp` (+ `.png` dự phòng) | 443×192, nền trong suốt | Logo header (hiển thị cao 40–48px) |
| `public/brand/basa3d-logo-full.png` | 1386×600, trong suốt | Footer / chỗ cần logo lớn |
| `src/app/icon.png` | 512×512 trong suốt | Next.js metadata file → `<link rel="icon">` |
| `src/app/apple-icon.png` | 180×180 nền #E4F4FF | apple-touch-icon |
| `src/app/favicon.ico` | 16/32/48 | favicon trình duyệt |
| `src/app/opengraph-image.jpg`, `src/app/twitter-image.jpg` | 1200×630 | Ảnh chia sẻ mặc định |
| `public/brand/home-banner-2058.webp`, `home-banner-1200.webp` | tỉ lệ 2.69:1 | Banner trang chủ |
| `public/brand/contact-card-800.webp` | 800×800 | Thẻ liên hệ footer |
| `public/brand/logo-hotline-{round,square}-1024.png` | 1024×1024 | Bản tải về cho Zalo/in ấn (không bắt buộc dùng trên site) |

Các file metadata trong `src/app/` được Next.js App Router tự nhận — chỉ cần **không** khai báo trùng
`icons` / `openGraph.images` mặc định trong `src/app/layout.tsx`. Kiểm tra trang sản phẩm/blog vẫn ghi đè
`openGraph.images` bằng ảnh riêng của chúng (đã có trong `generateMetadata`).

## Quyết định đã chốt
1. **Header** (`src/components/storefront/header.tsx`): thay text "BaSa3D" bằng `next/image`
   `/brand/basa3d-logo.webp`, `priority`, cao ~40px mobile / 48px desktop, `alt="BASA 3D"`, giữ `Link href="/home"`
   và focus ring hiện có. Không làm header cao hơn `h-16`.
2. **Trang chủ** (`src/app/[locale]/(storefront)/page.tsx` — `home/page.tsx` chỉ re-export file này): thêm banner ảnh bìa ngay đầu trang,
   `next/image` + `sizes` (dùng bản 1200 cho mobile, 2058 cho desktop), bo góc theo style card hiện có.
   Ảnh có chữ in sẵn → `alt` phải chứa nội dung chính: "Biến ý tưởng thành hiện thực — Trên mạng không bán?
   Để BASA3D in. Nhận in 3D theo yêu cầu, chất lượng tỉ mỉ. Hotline/Zalo 0333 698 638. Freeship đơn từ 299k,
   ship toàn quốc." Banner là link tới `/custom-print`, đặt TRƯỚC `<section>` hero text đầu tiên. Trên mobile chữ trong ảnh rất nhỏ → giữ nguyên hero/CTA
   dạng text hiện có bên dưới (không xoá), banner chỉ là phần trang trí + thông điệp.
3. **Footer** (`src/components/storefront/footer.tsx`): cột đầu dùng logo thay `<p>{SITE_CONFIG.name}</p>`;
   giữ link Zalo dạng text. Thẻ ảnh liên hệ `contact-card-800.webp` đã được gỡ bỏ theo yêu cầu UI của OWNER (2026-10-20).
4. **i18n**: mọi `alt` và chữ mới đi qua `messages/{vi,en}.json` (namespace sẵn có `nav`, `footer`, `home`),
   không hardcode tiếng Việt trong TSX.
5. **Chính sách in trong ảnh** (OWNER xác nhận 2026-10-20 là thông tin thật): "Freeship đơn từ 299k",
   "Nhận in từ 1 sản phẩm", "Ship toàn quốc". Ghi vào `docs/database/business-rules.md` mục mới
   *Chính sách hiển thị công khai* (ghi rõ: chỉ là thông điệp marketing, **chưa** có logic tính phí ship
   trong code — không implement freeship ở checkout trong phase này).
6. **CSP**: ảnh nằm trong `'self'` → không đổi `next.config.mjs`.

## Risks (thứ tự ưu tiên review)
- Data integrity: không có (không đổi schema). Ghi chính sách freeship chỉ ở docs, tránh khách hiểu nhầm checkout đã freeship.
- Security: không có input mới.
- Testability: thêm test cho header/footer render logo (alt đúng) và metadata (icon/og) nếu có pattern test sẵn;
  E2E smoke `/home` có banner.
- UX: LCP — chỉ logo header dùng `priority`; banner `priority` chỉ ở `/home`. Banner không được làm vỡ layout mobile (no horizontal scroll).
- Favicon 16/32px: logo cá dạng dài nên hơi nhỏ — chấp nhận tạm, follow-up: nhờ designer làm mark vuông.

## Definition of Done
- [x] lint · typecheck xanh; `npm test` pass (test brand assets 4/4 pass)
- [x] Header + footer + `/home` hiển thị logo/banner đúng ở 375px và 1280px, light + dark
- [x] `<link rel="icon">`, `apple-touch-icon`, `og:image` có trong HTML của `/home`
- [x] business-rules.md có mục chính sách hiển thị công khai (#26)
- [x] Đóng bằng `close-phase`

## Nhật ký
- 2026-10-20: `/speckit-auto` không gọi được Gemini từ sandbox của Claude (proxy chặn `generativelanguage.googleapis.com`) → Claude làm tay theo Spec Kit: `specs/001-brand-assets/{spec,plan,tasks}.md`.
- 2026-10-20: Sửa giao diện UI theo yêu cầu OWNER: gỡ bỏ thẻ ảnh liên hệ `contact-card-800.webp` bên trong `<ContactLink>` ở footer. Cập nhật test và đóng Phase 37.
