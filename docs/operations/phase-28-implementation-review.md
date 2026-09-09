# Phase 28 implementation review — 2026-09-08

## Trạng thái

Đã triển khai Slice 1–5. Chưa đạt toàn bộ DoD: thiếu PostgreSQL/Supabase local test
để chạy integration/E2E/RBAC thật; build compile/type validation qua nhưng prerender
sitemap cần DATABASE_URL test. Phase giữ trong active để Claude/Owner review.

## Files changed (chỉ Phase 28)

- `src/services/dashboard.service.ts`: thêm getAdminNavBadges độc lập.
- `src/app/admin/(protected)/layout.tsx`, `dashboard/page.tsx`: dùng badge reader nhỏ,
  chạy hai nhóm metrics song song sau requireAdmin; financial vẫn OWNER-only.
- `src/services/{order,print-job,product,custom-request,filament}.service.ts`:
  stable ordering, hasNext cho năm list; warningTier lọc trước LIMIT.
- `src/app/admin/(protected)/{orders,print-jobs,products,custom-requests,materials}/page.tsx`:
  page URL và pagination; products sửa hiển thị giá 0.
- `src/components/admin/admin-pagination.tsx`: Trước/Sau, giữ filter qua URL.
- `src/components/admin/action-form.tsx`: useActionState, pending, lỗi tại chỗ.
- `src/app/admin/(protected)/error.tsx`: lỗi bất ngờ, thông báo chung và retry.
- `src/app/admin/(protected)/{orders,custom-requests,print-jobs}/actions.ts` và
  các `[id]/page.tsx`: safeParse, handled DomainError, form pending/error, nhãn trạng thái.
  Form tạo request/báo giá và quick status ở list cũng tiêu thụ cùng kết quả action.
- `src/app/admin/(protected)/expenses/{actions.ts,page.tsx}`: tái dùng
  ConfirmedActionForm nguyên trạng; cancel action trả kết quả tương thích.
- `tests/phase-28-admin-{badges,actions,pagination}.test.ts`,
  `tests/phase-28-dashboard-role.test.ts`, `tests/helpers/phase-28-fixtures.ts`,
  `e2e/phase-28-admin.spec.ts`: test mới.
- Execution plan Phase 28 và báo cáo này.

Workspace đã có thay đổi kho nhựa, test isolation và storefront trước lượt này.
Không tính các thay đổi đó vào Phase 28; không sửa Phase 14 route-auth test hoặc
e2e/admin.spec.ts trong lượt này. Không tạo migration/dependency mới.

## Quyết định triển khai nhỏ

- DEFAULT_PAGE_SIZE vốn là 20; MAX_PAGE_SIZE là 100, không phải default. Giữ cả hai,
  bỏ limit cố định ở năm trang. Callers yêu cầu 100 (categories/blog/API...) vẫn giữ
  giới hạn 100. List lấy thêm một dòng để biết hasNext, chỉ trả tối đa limit dòng;
  không thêm COUNT toàn bảng và không đổi công thức offset.
- Orders/jobs/products/custom requests thêm ID sau created_at DESC; listVariants
  cũng thêm ID cho ORDER BY created_at DESC. Cuộn nhựa đang sort spool_code UNIQUE,
  giữ sort đó và thêm fs.id; không đổi thứ tự lock hoặc truy vấn nghiệp vụ.
- warningTier SQL dùng cùng mốc 0g, <=20%, <=50%, >50% của domain helper. Parameter
  được bind, không ghép trực tiếp input vào SQL. Tier không hợp lệ trả danh sách rỗng
  như cách lọc JS trước đó; không lưu warningTier vào DB.
- ActionForm tái sử dụng useActionState nhưng dispatch trong onSubmit/startTransition:
  tránh React tự reset uncontrolled fields khi action trả `{ error }` như một Promise
  đã resolve. Fieldset disabled khi pending; giữ các field ở server component, không
  đưa thêm DTO tài chính vào client. Component cần JavaScript để submit.
- Lỗi xác thực vẫn ở ngoài catch; DomainError hiện inline, lỗi bất ngờ tiếp tục throw
  tới error boundary. Boundary không render error.message/stack hoặc dữ liệu nhạy cảm.
- Nhãn tiếng Việt thực tế nằm ở *_STEPS và *_TERMINAL_STATUSES, không phải mảng
  ORDER_STATUSES như mô tả handoff. Tái dùng các label đó, thêm label NEED_INFO còn thiếu.
- Giữ status-filter-tabs.tsx nguyên trạng. Pagination dùng Link theo phase contract;
  soft-navigation query-only trên production vẫn cần E2E thực xác nhận, không coi là
  đã giải quyết chỉ vì URL builder đúng.

## Tests/checks

- Typecheck và lint: pass sau khi thêm code/test.
- Unit badge: gọi đúng 3 SQL count với đúng WHERE gốc; query khác hoặc write làm test fail.
- Unit dashboard: OWNER bắt đầu cả hai reader trước khi bất kỳ reader nào hoàn tất;
  STAFF không gọi financial reader và không serialize financial dataset.
- Unit actions: invalid enum/material/spool/actuals không gọi writer; DomainError
  trả inline; auth/unexpected error vẫn throw; valid status giữ actor/role; malformed
  quote JSON trả lỗi trước write.
- Integration mới: đã viết, **chưa thực thi**. Seed 105 hàng có timestamp trùng cho
  bốn bảng và 105 spool, so sánh trang 1–6 (bao gồm 2/3 và hàng 101+), kiểm tra tier
  ngoài hàng 100 và các ngưỡng, STAFF purchaseCost masking, badge/dashboard agreement.
  Service SQL chạy qua cùng connection transaction thật; finally ROLLBACK fixture.
- E2E mới: đã viết, **chưa thực thi**. Invalid status + giữ input/pending; lỗi nghiệp
  vụ thanh toán + retry; dismiss/accept cancel expense; filter/page/back/forward/refresh;
  hàng 101+ ở năm màn hình; warningTier và OWNER/STAFF dashboard.
- Đã gọi Playwright cho file mới và e2e/admin.spec.ts; bị cấu hình isolation chặn
  vì thiếu TEST_DATABASE_URL/TEST_SUPABASE_*; không kết luận regression pass.
- Đã gọi riêng Phase 14 route-auth baseline nguyên trạng: 4 test skip vì thiếu môi
  trường. Không kết luận RBAC thực đã xanh.
- Build cô lập `.next-test`: lần đầu DNS Google Fonts bị sandbox chặn; chạy lại với
  network đã compile và qua type validation, dừng tại `/sitemap.xml` do không có
  DATABASE_URL test. Không dùng DB app để né lỗi; tsconfig/next-env được khôi phục.
- Full test runner: **152 pass, 0 fail, 88 skip** (240 tests). Các test cần DB skip
  đúng cơ chế isolation, không tạo fixture trên DB app. `git diff --check` pass.

## Database review — canonical checklist

**BLOCKERS:** chưa có bằng chứng integration thực cho SQL mới; là blocker kiểm chứng
DoD, chưa phát hiện lỗi schema từ static review.

**IMPORTANT:** offset pagination ổn định khi sort key trùng trên dataset cố định;
insert/delete/đổi filter trong lúc chuyển trang có thể dịch vị trí hàng (đặc tính offset,
không hứa snapshot xuyên request). Không có baseline EXPLAIN/index trong scope.

**SUGGESTIONS:** chạy test fixture/tier trên instance đã migrate trước review cuối.

PK/FK/unique/nullability không đổi; fs.spool_code đã unique. Query mới chỉ read,
parameterized, giữ status WHERE và DTO/masking. Không chạm row locks, transaction
nghiệp vụ, inventory counters/movements, order snapshots hoặc money arithmetic.
Expense vẫn soft cancel bằng service cũ và ghi audit như cũ; không xóa ledger.

## Security review — canonical checklist

**BLOCKERS:** chưa chạy baseline auth qua HTTP trên Supabase test; unit mock không
thay thế kiểm chứng session/cookie/route thật.

**IMPORTANT:** auth flow/middleware/requireAdmin không đổi. Actions vẫn authenticate
trước parse/write; expense vẫn requireOwner. Financial reader vẫn gated OWNER trước
khi tạo Promise. Error boundary ở `(protected)` xử lý page/children, không bắt lỗi
của chính layout cùng segment; đây là giới hạn segment boundary.

**SUGGESTIONS:** sau khi cấu hình local test, chạy cả OWNER/STAFF E2E và kiểm tra
soft navigation/pending thực trước đánh dấu acceptance.

Không thêm raw SQL input, secrets/log nhạy cảm, upload, outbound URL hay abuse surface.
Không đổi RLS/rate limit. Không khẳng định hệ thống đã an toàn chỉ từ static review.

## Follow-up bắt buộc

1. Cấu hình disposable local TEST_DATABASE_URL và TEST_SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY
   theo `docs/operations/test-data-cleanup.md`, apply migrations/seed vào instance đó.
2. Chạy full runner (production server port 3411 + RBAC baseline), Playwright file mới
   và e2e/admin.spec.ts trên production build port 3412; sửa failure nếu có.
3. Claude/Owner review diff và acceptance. Chưa chuyển phase sang completed.

EXPLAIN/index/dashboard SQL rewrite, filter workaround và sidebar vẫn hoãn theo scope đã chốt.
