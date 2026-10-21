# Change — Tắt hẳn EN trên storefront (2026-10-21)

> Không phải phase mới: chỉnh lại hạ tầng Phase 18 theo yêu cầu OWNER. Quyết định: **ADR-0048**
> (sửa đổi ADR-0029; ADR-0045 mục 2 đã ghi chú theo).

## 1. Bối cảnh

OWNER đã yêu cầu ẩn nút VI/EN và không dự kiến bật lại tiếng Anh sớm. Rà soát cho thấy flag
`NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED` chỉ ẩn **nút ở Header**, còn:

- `routing.locales` vẫn là `['vi', 'en']` → `/en/*` vẫn truy cập được và vẫn được prerender;
- `sitemap.ts` vẫn liệt kê mọi URL `/en/*`;
- 6 trang vẫn khai báo hreflang `en` (`alternates.languages`);
- trang Organizer có nút VI/EN riêng, không đi qua flag.

## 2. Phương án

| | A — một flag tắt EN toàn bộ (**đã chọn**) | B — gỡ hẳn i18n routing |
|---|---|---|
| Phạm vi | ~10 file | ~30 file route + ADR-0045 + test phase-42/43 + e2e |
| Bật lại EN | Đổi env + build lại | Gần như làm lại Phase 18 |
| `vi` trong URL nội bộ | Còn (rewrite next-intl, khách không thấy) | Hết |

## 3. Thay đổi

| File | Nội dung |
|---|---|
| `src/i18n/routing.ts` | `ALL_LOCALES`, `AppLocale`, `isEnglishEnabled`; `locales` = `['vi']` khi tắt |
| `src/middleware.ts` | Tắt EN: `/en` → 308 `/home`, `/en/<path>` → 308 `/<path>` (giữ query). Bật EN: giữ `/en` → `/en/home` như cũ |
| `src/i18n/seo.ts` (mới) | `englishPath()`, `localeAlternates()` — chỉ thêm hreflang khi bật EN |
| 6 trang storefront | home, products, products/[slug], privacy/shipping/return/file-confidentiality policy dùng `localeAlternates()` |
| `src/app/sitemap.ts` | Chỉ thêm URL EN khi bật EN |
| `organizer-workbench.tsx` | Ẩn nút VI/EN theo `SITE_CONFIG.languageSwitcherEnabled` |
| `src/config/site.ts`, `[locale]/layout.tsx`, `playwright.config.ts` | Cập nhật comment |
| `.env.example` | Thêm `NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED=false` kèm giải thích |
| Docs | ADR-0048, ghi chú ADR-0029/0045, `CHANGELOG.md`, `docs/roadmap.md`, banner trong `phase-18.md` |

Giữ nguyên: next-intl, segment `[locale]`, `messages/en.json`, `LanguageSwitcher`, `UntranslatedNotice`,
`e2e/i18n.spec.ts`.

## 4. Kiểm thử

- `tests/locale-alternates.test.ts` — `englishPath`, `localeAlternates` ở cả 2 trạng thái flag.
- `tests/locale-routing-en-disabled.test.ts` — gọi trực tiếp `middleware` khi flag tắt: `routing.locales`
  = `['vi']`; `/en`, `/en/`, `/en/products`, `/en/products/<slug>`, `/en/...?utm_source=x` → 308 đúng đích;
  `/english-guide`, `/products` không bị redirect.
- `e2e/i18n.spec.ts` — vẫn chạy với flag bật (Playwright và test-runner ép `true`), phủ nhánh EN.

Chọn unit test thay vì e2e cho nhánh tắt EN: Playwright build một lần với flag bật; thêm bản build thứ
hai với flag tắt sẽ làm thời gian e2e gần gấp đôi.

## 5. Trạng thái xác minh

- [ ] `npx tsc --noEmit`
- [ ] `node --import tsx --test tests/locale-alternates.test.ts tests/locale-routing-en-disabled.test.ts`
- [ ] `npm test` (đầy đủ, cần DB test)
- [ ] `npx playwright test e2e/i18n.spec.ts`
- [ ] Smoke trên Preview (flag tắt): `/en/products` → 308 `/products`; `view-source` trang chủ không có
      `hreflang="en"`; `/sitemap.xml` không có `/en`; `/tools/organizer` không có nút VI/EN.

Chưa chạy được bước nào trong sandbox (shell lỗi hết dung lượng đĩa) — OWNER chạy trên máy.

## 6. Rủi ro và lưu ý

- `NEXT_PUBLIC_*` được gắn cứng lúc build: đổi flag phải build lại/redeploy. Đặt flag ở cả Preview và Production trên Vercel.
- Test middleware import `next/server` + `next-intl/middleware` trong Node thay vì runtime của Next. Nếu
  lỗi ở bước import, chuyển sang kiểm tra 308 bằng smoke trên Preview.
- Cookie `NEXT_LOCALE=en` cũ không có tác dụng vì `localeDetection: false`.
- Bật lại EN: đặt flag `true`, build lại; không cần sửa code. Kiểm tra lại banner `UntranslatedNotice`
  vì cart/checkout/custom-print/blog/quotes vẫn chưa dịch.
