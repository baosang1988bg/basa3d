# Feature 003 — Chạy thử toàn bộ kho KeyCap3D (giai đoạn test, chưa public domain)

> OWNER đã duyệt plan 2026-10-21. Giai đoạn này nhập **toàn bộ** 46 thư mục KeyCap3D (kể cả mẫu
> thương hiệu) để test, vì site chưa public. Mục "Trước khi public" ở cuối là bắt buộc trước khi mở domain.
>
> Cách dùng: dán từng prompt vào Claude Code (phiên mới, `/clear`), chế độ accept edits.

---

## Prompt A — Hoàn thiện code + test local

```
Feature 003 (STL bulk import) — hoàn thiện trước khi chạy thử. Làm tuần tự, dừng nếu bước nào fail.

1. Dọn worktree swarm: `git worktree list`, tìm nhánh feature/003-0-vai-tro-quy-trinh-ban-la-senior-engine.
   Cho tôi xem đường dẫn + `git log --oneline -5`, CHỜ tôi gõ "xoá" rồi mới remove worktree + xoá nhánh.
   Báo nếu còn tiến trình speckit-auto đang chạy.

2. Rà thay đổi tôi đã sửa: 2 hàm trigger trong supabase/migrations/20261022000000_stl_bulk_import.sql
   đổi sang `security definer` (search_path = ''); docs/database/schema.md và
   specs/003-stl-bulk-import/data-model.md đã cập nhật; sửa tasks.md cho khớp.
   Thêm test DB: grant tạm `select` trên product_import_items cho role authenticated (không policy)
   → chuyển sản phẩm nhập chưa duyệt sang ACTIVE vẫn bị IMPORT_PUBLISH_BLOCKED. Revoke sau test.

3. Danh mục Keycap: migration mới 20261022000100_keycap_category.sql
   insert categories (name 'Keycap', slug 'keycap', is_active true) on conflict (slug) do nothing.
   scripts/stl-import/category-map.json đã có rule { "KeyCap3D" → keycap, skuCode KCP }.

4. Hỗ trợ .3mf trong scripts/stl-import (một số thư mục KeyCap3D chỉ có .3mf, vd gengar-keycap.3mf):
   - scan.ts: nhận .stl và .3mf (một model có thể trộn cả hai trong cùng thư mục lá).
   - Tái dùng parser 3MF sẵn có (src/lib/parsers/threemf-project-info.ts, cách đọc của
     scripts/model-library-spike/generate-previews.mjs) để lấy mesh → metrics + render như STL.
   - KHÔNG dùng ảnh nhúng Auxiliaries/.thumbnails/* (ảnh cover của tác giả). Ảnh Metadata/plate_N.png
     cũng không dùng — luôn render để ảnh đồng nhất 4 góc.
   - 3MF không đọc được mesh → ghi process_error, không dừng lô.
   - Bỏ qua file khác (.jpg, .png, .txt...) và ghi số file bị bỏ qua vào report.
   - Test: fixture 3MF nhỏ tự tạo trong tests/, thư mục trộn stl+3mf, 3MF hỏng.

5. Report: thêm cột "thư mục nguồn" và bộ lọc theo cảnh báo (nghi sai đơn vị, gộp sai, lỗi) trong
   .stl-import/report.html nếu chưa có.

6. `supabase start`, `supabase db reset`, rồi chạy: lint · typecheck · npm test · build ·
   Playwright E2E stl-import, admin, copyright-compliance. Fail thì sửa tối đa 3 lần, vẫn fail thì dừng báo tôi.

7. Commit cục bộ theo từng phần (Conventional Commits):
   fix(db): security definer cho publish gate · feat(db): danh mục keycap ·
   feat(stl-import): hỗ trợ 3mf · test(...).

Cấm: git push, supabase db push, kết nối DB hosted, đọc .env.local, chạy import-stl --apply.
Kết thúc: bảng kết quả từng cổng + danh sách commit.
```

---

## Prompt B — Đưa lên môi trường test (Supabase + Vercel)

```
Feature 003 — đưa lên môi trường hiện tại (chưa public domain). HỎI tôi xác nhận trước mỗi lệnh có ghi.

1. Nhắc tôi backup DB (Supabase Dashboard → Database → Backups), chờ tôi xác nhận.
2. `supabase db push --dry-run` → liệt kê migration sẽ chạy (phải có 20261022000000 và 20261022000100).
   Chờ tôi gõ "apply" rồi mới `supabase db push`.
3. Kiểm tra read-only: bảng product_import_items + RLS bật; 2 trigger tồn tại; prosecdef = true cho
   enforce_import_publish_gate và enforce_import_item_link; category chua-phan-loai is_active = false;
   category keycap tồn tại.
4. Kiểm tra site đang chặn index: robots.txt / meta robots có noindex trên môi trường này không. Báo tôi
   kết quả (không tự sửa).
5. Chờ tôi gõ "push" rồi mới `git push origin dev`. Theo dõi deploy Vercel, báo khi xong.

Cấm: force push, sửa migration đã apply, chạy import-stl --apply.
```

---

## Bước C — Chạy thử trên Drive thật (OWNER tự chạy)

```bash
# --in là THƯ MỤC CHA của KeyCap3D, và giữ nguyên gốc này mãi về sau (khoá chống trùng tính theo nó)
DRIVE="$HOME/Library/CloudStorage/GoogleDrive-<email>/My Drive"

# 1. Dry-run 10 mẫu → xem nhanh chất lượng ảnh
npx tsx --env-file=.env scripts/stl-import/import-stl.ts --in "$DRIVE" --only "KeyCap3D/**" --limit 10
open .stl-import/report.html

# 2. Ổn → dry-run toàn bộ (46 thư mục)
npx tsx --env-file=.env scripts/stl-import/import-stl.ts --in "$DRIVE" --only "KeyCap3D/**"

# 3. Ổn → ghi thật
npx tsx --env-file=.env scripts/stl-import/import-stl.ts --in "$DRIVE" --only "KeyCap3D/**" --apply

# 4. Chạy lại y hệt lệnh 3 → report phải báo 0 CREATE (kiểm idempotent)
```

Checklist khi xem report:

- [ ] Ảnh 4 góc rõ, keycap không bị cắt, màu/ánh sáng đủ để bán
- [ ] Bộ nhiều keycap (vd `8 Keycap Set`, 11 STL) hiển thị đủ phần, không chồng lên nhau
- [ ] Kích thước hợp lý (keycap MX ~18 × 18 × 10–25 mm); cảnh báo "nghi sai đơn vị" nếu lệch
- [ ] Thư mục chỉ có .3mf (gengar) được xử lý
- [ ] Tỉ lệ lỗi ≤ 5%, ghi lại thời gian trung bình mỗi mẫu
- [ ] Tất cả vào danh mục Keycap, SKU dạng `KCP-...`

## Bước D — Duyệt và kiểm tra (OWNER)

- [ ] `/admin/stl-import`: sửa tên cho gọn, xem giá ước tính, tick "đã kiểm tra bản quyền", duyệt toàn bộ
- [ ] Thử chặn: duyệt 1 mẫu chưa tick → bị chặn kèm lý do
- [ ] Thử từ chối 1 mẫu → chạy lại import không tạo lại
- [ ] `/products` + `/sitemap.xml` có sản phẩm mới; trang chi tiết không lộ đường dẫn Drive
- [ ] Duyệt ≥ 10 mẫu trên điện thoại, đo thời gian (mục tiêu ≤ 5 phút)
- [ ] Thử script trên Windows 1 lần (dry-run `--limit 5`)

---

## ⚠️ Trước khi public domain (bắt buộc)

Kho KeyCap3D có nhiều mẫu fan-art thương hiệu (Pokémon, Mario, Kirby, Mandalorian, Toothless, Naruto,
Dragon Ball, Genshin, Hollow Knight, Warhammer 40K, Freddy Krueger, Scream...). Giai đoạn test cho
ACTIVE được, nhưng trước khi mở domain:

- [ ] Archive (hoặc đưa về DRAFT) mọi sản phẩm thương hiệu chưa có giấy phép thương mại rõ ràng
- [ ] Bỏ tick "đã kiểm tra bản quyền" của các mẫu đó (tick ở giai đoạn test không phải kiểm tra thật)
- [ ] Bỏ noindex của môi trường test, kiểm tra lại sitemap chỉ còn mẫu được phép bán
- [ ] Nếu sau này môi trường test bị index, gửi yêu cầu gỡ URL trên Google Search Console
- [ ] **Bắt buộc khai IP khi duyệt**: admin chọn "Không có IP" hoặc "Thương hiệu: …"; chưa khai → gate chặn
      `IP_NOT_DECLARED` (`docs/research/product-tagging.md` mục 6.3, Q4). Không dựa từ khoá: từ điển hiện chỉ bắt 7/45
      thư mục KeyCap3D.
- [ ] **Tên/slug trung tính** cho mẫu khai "Thương hiệu" (vd. `gengar-pokemon-…` → tên mô tả chung) trước khi lên web public
- [ ] **Sửa `detectIpRiskKeywords()`**: lỗi ranh giới từ với `_` (`…_pokemon_edition`, `…_dragon_ball`) + bổ sung từ điển
      (Mario, Kirby, Gundam, Hollow Knight, Tetris, Mandalorian, Chainsaw Man, Digimon, Attack on Titan, Spy Family,
      Sailor Moon… — bảng mục 6.3 của `product-tagging.md`)
