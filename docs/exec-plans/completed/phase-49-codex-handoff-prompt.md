# Prompt Codex Handoff — Phase 49: MakerWorld China Support & 3MF Quick-Download Helper

Đọc kỹ `AGENTS.md`, sau đó đọc kế hoạch tại `docs/exec-plans/active/phase-49-makerworld-china-support.md`.

## Nhiệm vụ
Triển khai toàn bộ Phase 49 theo các vertical slices đã định nghĩa:
1. **Lát 1 (Core Resolver & Sanitizer):**
   - Mở rộng `src/lib/parsers/makerworld-resolver.ts` để hỗ trợ `makerworld.com`, `makerworld.com.cn`, `makerworld.cn`.
   - Bổ sung các host CDN hình ảnh MakerWorld China vào `src/lib/parsers/makerworld-image.ts`.
   - Cập nhật thông điệp schema tại `src/domain/schemas.ts`.
   - Cập nhật và bổ sung unit test tại `tests/phase-13-makerworld-resolver.test.ts`.
2. **Lát 2 (Admin UI & Helper Bridge):**
   - Cập nhật `src/components/admin/makerworld-quote-panel.tsx` với placeholder mới và nút "Mở công cụ tải 3MF (3DHubVN)" dẫn sang `https://mwc.3dhubvn.net/makerworld-cn`.
3. **Lát 3 (Storefront Compatibility):**
   - Cập nhật `src/app/api/public/makerworld-estimate/route.ts` và `src/components/storefront/makerworld-intake-card.tsx`.
4. **Lát 4 (Docs & Quality Gates):**
   - Thêm ADR-0052 vào `docs/architecture/decisions.md`.
   - Cập nhật `docs/roadmap.md`.
   - Đảm bảo `npx tsx --test tests/phase-13-makerworld-resolver.test.ts`, `npm run typecheck` và `npm run lint` đều xanh.
   - Đánh dấu `[x]` vào các checklist trong `docs/exec-plans/active/phase-49-makerworld-china-support.md`.

## Nguyên tắc triển khai
- Không sửa các file không liên quan.
- Giữ nguyên các biện pháp bảo mật hiện có: SSRF prevention, manual redirect inspection hop-by-hop, response body size cap, image sanitization allowlist (không dùng wildcard lỏng lẻo).
- Báo cáo chi tiết: files changed, behavior changed, tests/checks run, known risks.
