# Dọn dữ liệu test khỏi database của app — 2026-09-05

Owner đã yêu cầu xóa demo/test và xác nhận thao tác. Nguồn gây tích tụ: các test
integration/E2E đọc `.env` của app; nhiều fixture không được xóa sau mỗi lần chạy.

## Phạm vi và kết quả

Migration `20260905000000_remove_accumulated_test_data.sql` chỉ chọn các chữ ký
fixture trong `tests/`, `e2e/`, `supabase/seed.sql`, với mốc thời gian cố định
`2026-09-05T08:37:53.734Z`. Không dùng TRUNCATE hay xóa tất cả bảng.

Đã xóa 731 orders, 1.443 custom requests, 1.184 products, 384 quotes, 808 print jobs,
224 blog posts, 673 test spools, 1.196 test materials, 1.304 test warehouses,
183 test expenses, 784 test pricing configs và các dòng con/lịch sử test liên quan.
Các pricing config được xác định bằng actor test cố định hoặc tham chiếu từ
quote/product test; không tạo cấu hình kinh doanh thay thế bằng số giả.

Giữ nguyên từng bản ghi: 27 cuộn nhựa + 27 movements nhập kho thật, 24 materials,
9 khoản chi từ bảng quản lý + `Walkthrough Expense` (chưa xác định nguồn gốc),
Owner, kho MAIN, 3 danh mục nền. Không thao tác Supabase Auth hay Storage.
Các cuộn WALK/VERIFY gắn vào `Legacy PLA` và kho fixture cũng là dữ liệu thử.

## Backup, kiểm chứng và rollback

Backup ngay trước COMMIT: `.local-backups/test-cleanup-1788597744775.json`.
SHA-256: `67774fd5da64dfe63443a6e6a7ca743525c3d30ca2e4ebcd935e19177b84a718`.
Báo cáo: cùng tên file, thêm `.report.json`. Backup chứa toàn bộ các bảng public,
không chứa schema/Auth/Storage; thư mục bị Git ignore, file chỉ owner máy đọc/ghi.

`scripts/cleanup-test-data.mjs` mặc định thực hiện rehearsal rồi ROLLBACK:

```sh
node --env-file=.env scripts/cleanup-test-data.mjs
# Chỉ dùng khi được phép thực hiện cleanup:
node --env-file=.env scripts/cleanup-test-data.mjs --apply
```

Runner khóa bảng trong transaction, lưu/đọc lại backup trước khi xóa, kiểm tra
mọi bản ghi giữ lại giống hệt trước thao tác, và kiểm tra ba ledger triggers đã
được bật lại trước COMMIT. Migration từ chối nếu dữ liệu giữ lại tham chiếu vào
fixture được chọn, kể cả các FK SET NULL/CASCADE. Khi tồn tại bảng migration
history của Supabase, runner ghi version trong cùng transaction.

Muốn khôi phục: trước hết lấy thêm backup trạng thái hiện tại; thử trên database
cô lập có cùng migrations. Đọc `data` trong JSON, INSERT lại các ID còn thiếu
bằng tham số JSON + `json_populate_recordset`, theo thứ tự FK: categories,
warehouses, materials, pricing_configs, carts, products, product_variants,
product_images, cart_items, custom_requests, orders, order_items, quotes,
filament_spools, print_jobs, inventory_movements, material_movements, expenses,
blog_posts, audit_logs. Không ghi đè ID đã tồn tại; so sánh các bản ghi giữ lại.
INSERT không cần tắt immutable ledger triggers. Phục hồi vào app phải thực hiện
trong một transaction bằng migration khôi phục được review, không chạy lại seed
hay reset database. Giữ bản backup này ở nơi an toàn nếu cần khôi phục lâu dài.

## Không để tái diễn

`tests/helpers/test-environment.ts` được dùng bởi runner, từng test có truy cập
môi trường và Playwright config. Test không còn dùng credentials của app.

- Không có `TEST_DATABASE_URL`: chỉ chạy các test không cần DB; integration skip.
- Integration cần database PostgreSQL riêng, disposable, trên localhost.
- E2E cần thêm `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`,
  `TEST_SUPABASE_SERVICE_ROLE_KEY` của Supabase local riêng.
- Từ chối hosted targets và database/Supabase local trùng app.
- Vô hiệu hóa Resend và GA trong test để không gửi thông báo/analytics thật.

Apply migrations/seed vào instance test riêng trước khi chạy integration/E2E.
Không dùng credentials của database kinh doanh để chạy fixture hoặc migration test.

## Review và kiểm tra

- BLOCKERS: không còn sau rehearsal; FK guard, snapshot comparison và trigger checks đều đạt.
- IMPORTANT: không còn pricing config kinh doanh; cần nhập cấu hình giá thực trước khi báo giá.
- SUGGESTIONS: giữ bản backup ngoài máy nếu cần phục hồi dài hạn.

Lint, typecheck và diff whitespace check đạt. Test runner qua `node --import tsx`
đạt 137 tests, 87 integration tests skip vì chưa có database test riêng; không
chạy E2E/build để tạo lại fixtures trên app. Đã xác minh Playwright từ chối chạy
khi thiếu cấu hình local test và kiểm tra lại số lượng bằng kết nối read-only
sau COMMIT. Thay đổi có sẵn ở storefront `tools/page.tsx` không thuộc cleanup này.
