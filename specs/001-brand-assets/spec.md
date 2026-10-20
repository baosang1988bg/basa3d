# Feature Specification: Bộ nhận diện thương hiệu BASA 3D trên storefront

**Feature Branch**: `dev` (làm tay — swarm `/speckit-auto` không gọi được Gemini từ sandbox)
**Created**: 2026-10-20 · **Status**: Implemented · **Input**: `docs/exec-plans/active/phase-37-brand-assets.md`

## User Scenarios & Testing

### User Story 1 — Khách nhận ra thương hiệu (P1)
Khách vào bất kỳ trang storefront nào thấy logo BASA 3D ở header thay vì chữ trơn; tab trình duyệt có favicon.
**Acceptance**: Given trang bất kỳ, When tải xong, Then header có `<img alt="BASA 3D — về trang chủ">` dẫn về `/home`
và HTML có `<link rel="icon">` + `apple-touch-icon`.

### User Story 2 — Link chia sẻ có ảnh (P1)
Given khách gửi link `/home` lên Zalo/Facebook, When nền tảng đọc meta, Then có `og:image` 1200×630 (logo + hotline).
Trang sản phẩm/blog vẫn dùng ảnh riêng của chúng.

### User Story 3 — Trang chủ có banner, footer có thẻ liên hệ (P2)
Given `/home`, Then banner ảnh bìa nằm trên hero, bấm vào tới `/custom-print`; footer có logo + thẻ liên hệ bấm mở Zalo.
Hero text/CTA cũ vẫn còn (chữ trong ảnh nhỏ trên mobile).

### Edge Cases
- Dark mode: logo nền trong suốt vẫn đọc được trên nền tối.
- 375px: banner co theo chiều ngang, không gây cuộn ngang.
- Screen reader: ảnh có chữ → alt mang đủ nội dung (gồm hotline, chính sách freeship).

## Requirements
- **FR-001** Header dùng `public/brand/basa3d-logo.webp`, cao 40px (mobile) / 48px (≥ md), không làm header cao hơn `h-16`.
- **FR-002** `src/app/{icon.png,apple-icon.png,favicon.ico,opengraph-image.jpg,twitter-image.jpg}` là metadata file của Next.js.
- **FR-003** Banner `/home` + thẻ liên hệ footer + logo footer bằng `next/image`, alt qua `messages/{vi,en}.json`.
- **FR-004** Chính sách in trong ảnh ghi ở `docs/database/business-rules.md` #26 (chỉ hiển thị, chưa có logic checkout).

## Success Criteria
- **SC-001** lint · typecheck · `npm test` xanh; `next build` xanh trên Vercel.
- **SC-002** HTML `/home` chứa `rel="icon"`, `apple-touch-icon`, `og:image`.
