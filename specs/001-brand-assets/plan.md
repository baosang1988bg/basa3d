# Implementation Plan: Bộ nhận diện thương hiệu BASA 3D

**Spec**: [spec.md](./spec.md) · **Date**: 2026-10-20

## Summary
Asset đã xử lý sẵn (logo tách nền, icon, OG, banner, thẻ liên hệ). Code chỉ dùng chúng qua `next/image` và metadata
file convention của App Router — không đổi schema, không thêm dependency, không đổi CSP (ảnh nằm trong `'self'`).

## Technical Context
Next.js 15 App Router · React 19 · next-intl · Tailwind 3. Không DB. Test: `node --test` (tsx) cho i18n parity.

## Constitution Check
- I/II (DB, tồn kho): không chạm. ✅  III (bảo mật): không có input mới. ✅
- IV (test): thêm `tests/phase-37-brand-assets.test.ts` (asset tồn tại, kích thước OG, khoá i18n đủ vi/en). ✅
- V (đơn giản): không dependency mới; Next tự sinh srcset từ ảnh gốc. ✅  VI (truy vết): business-rules #26. ✅

## File thay đổi
- `src/components/storefront/header.tsx` — logo `next/image` `priority`.
- `src/components/storefront/footer.tsx` — logo + thẻ liên hệ (ContactLink → Zalo, có tracking sẵn).
- `src/app/[locale]/(storefront)/page.tsx` — banner trên hero, `priority`, `sizes`.
- `messages/{vi,en}.json` — `nav.logoAlt`, `footer.logoAlt`, `footer.contactCardAlt`, `home.bannerAlt`.
- `docs/database/business-rules.md` #26.

## BaSa3D Phase Bridge
**Exec-plan cầu nối**: `docs/exec-plans/active/phase-37-brand-assets.md`
**Phase brief**: goal = logo/favicon/OG/banner/thẻ liên hệ; non-goals = re-theme, freeship ở checkout; risk chính = hứa
chính sách sai → ghi business-rules #26, LCP → chỉ logo + banner home dùng `priority`.
**Lát cắt dọc**: (không DB) → (không API) → UI header/footer/home → test → docs.
**Tài liệu phải cập nhật**: ADR không cần (dùng convention sẵn có của Next) · business-rules #26 ✅ · schema/migrations không đổi · roadmap: thêm Phase 37.
**Cổng chất lượng**: lint · typecheck · npm test · build (Vercel) · E2E smoke `/home` (tự chạy trên Mac).
