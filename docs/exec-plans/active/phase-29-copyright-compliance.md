# Phase 29 — Kiểm soát rủi ro bản quyền/SHTT (standing, không đóng phase)

**Loại phase đặc biệt: KHÔNG đóng theo quy trình `close-phase` thông thường.**
Đây là tài liệu sống (living doc) — mọi vấn đề bản quyền/SHTT phát sinh sau này
(model từ MakerWorld/Thingiverse/Printables, khiếu nại vi phạm, câu hỏi pháp lý mới,
quyết định của Owner...) được ghi tiếp vào mục "Nhật ký cập nhật" bên dưới, không tạo
phase mới. Chỉ đóng/archive file này nếu Owner quyết định BaSa3D ngừng nhận rủi ro này
(ví dụ ngừng bán theo custom request) hoặc gộp toàn bộ scope đã hoàn tất vào một
runbook vận hành riêng.

## Brief

BaSa3D bán sản phẩm in 3D thương mại (catalogue tự thiết kế + custom request khách tự
gửi file). Rủi ro bản quyền/SHTT đến từ 2 hướng:
1. **Model bên thứ 3** (MakerWorld/Thingiverse/Printables...) — license mặc định của
   các nền tảng này thường chỉ cho phép in dùng cá nhân, cấm bán trừ khi có
   Commercial License hoặc license CC BY/CC0 rõ ràng.
2. **Luật SHTT Việt Nam** — quyền tác giả (tự động, không cần đăng ký), kiểu dáng công
   nghiệp (phải đăng ký mới được bảo hộ), nhãn hiệu (logo/thương hiệu gắn trên sản
   phẩm). Vi phạm có thể bị xử phạt hành chính (tối đa 250tr/cá nhân, 500tr/tổ chức)
   hoặc hình sự theo Điều 226 BLHS (pháp nhân thương mại tối đa 5 tỷ đồng hoặc đình chỉ
   hoạt động đến 2 năm).

Chi tiết nghiên cứu ban đầu và nguồn tham khảo: xem mục "Nhật ký cập nhật — 2026-09-08"
bên dưới.

- **Goal**: BaSa3D có quy trình/cơ chế kỹ thuật + vận hành để giảm rủi ro bị xử phạt
  hành chính/hình sự vì vi phạm bản quyền/SHTT khi bán sản phẩm in 3D, và có nơi
  duy nhất để tra cứu lại quyết định/rủi ro đã ghi nhận về chủ đề này.
- **Non-goals**: tư vấn pháp lý chính thức (cần luật sư khi có tranh chấp thật); rà
  soát hồi tố toàn bộ catalogue hiện có (nằm trong scope slice riêng bên dưới, không
  phải mặc định làm ngay); thay đổi mô hình kinh doanh (ví dụ ngừng nhận custom
  request) — đó là quyết định của Owner, không tự suy diễn.

## Scope — các hạng mục kiểm soát (checkbox khi triển khai, không phải "xong phase")

### A. Terms of Service / xác nhận trách nhiệm khách hàng
- [x] Custom request: thêm checkbox bắt buộc "Tôi xác nhận có quyền sở hữu hợp pháp
      đối với file/thiết kế này, và chịu trách nhiệm nếu vi phạm bản quyền bên thứ 3"
      trước khi submit. (2026-09-08 — implemented, checkbox required client + server-side.)
- [x] ToS công khai: nêu rõ BaSa3D đóng vai trò gia công/in ấn theo yêu cầu, không xác
      minh quyền sở hữu file khách gửi, có quyền từ chối/gỡ đơn nếu phát hiện vi phạm.
      (2026-09-08 — tái dùng trang có sẵn `/file-confidentiality-policy` thay vì tạo
      `/dieu-khoan-in-an` mới, xem "Nhật ký cập nhật" bên dưới.)

### B. Truy vết nguồn gốc license cho catalogue tự bán
- [x] Thêm field lưu nguồn gốc/license cho model dùng trong catalogue (không phải
      custom request) — ví dụ `source_url`, `license_type`, `license_proof` — vị trí
      cụ thể (product/material schema) quyết định lúc implement, cần review
      `src/domain/schemas.ts` trước khi thêm field. (2026-09-08 — implemented as
      `license_type`/`license_source_url`/`license_proof_url` trên bảng `products`.)
- [ ] Chỉ đưa vào catalogue công khai model có license rõ ràng cho thương mại (CC BY/
      CC BY-SA/CC0/tự thiết kế/đã mua Commercial License) — screenshot license lưu lại
      làm bằng chứng tại thời điểm tải. (Vận hành, không phải code — Owner tự áp dụng
      quy tắc này khi tạo sản phẩm mới bằng field đã có ở trên.)

### C. Flag rủi ro cao (IP bên thứ 3: nhân vật, logo, thương hiệu)
- [x] Custom request có cơ chế gắn cờ "cần admin duyệt thủ công" khi phát hiện từ khóa/
      mô tả liên quan thương hiệu, nhân vật phim/game nổi tiếng — không auto-approve
      thẳng vào hàng in. (2026-09-08 — `ip_risk_flag` + soft gate xác nhận bắt buộc
      trước khi tạo báo giá, không chặn state machine.)
- [ ] Không quảng cáo/niêm yết công khai các mẫu có rủi ro IP bên thứ 3 dù license gốc
      "cho thương mại" — chỉ nhận theo yêu cầu cá nhân hóa riêng lẻ của khách. (Vận
      hành, không phải code.)

### D. Quy trình xử lý khiếu nại (giống DMCA)
- [x] Có kênh liên hệ rõ ràng để bên thứ 3 báo vi phạm bản quyền.
- [x] Quy trình gỡ sản phẩm/đơn hàng trong 24–48h khi nhận khiếu nại hợp lệ.
      (2026-09-08 — ghi vào `docs/operations/runbook.md` mục "Khiếu nại bản quyền".)

### E. Bảo hộ chủ động cho thiết kế gốc của BaSa3D
- [ ] Với thiết kế gốc có giá trị thương mại cao, Owner cân nhắc đăng ký kiểu dáng công
      nghiệp tại Cục SHTT (vì KDCN không tự động được bảo hộ như quyền tác giả).

## Quyết định đã chốt (sau Gemini challenge — 2026-09-08)

Các quyết định đã được challenge và chốt theo nguyên tắc: **Bảo vệ pháp lý vững chắc + Trải nghiệm cực kỳ đơn giản cho cả khách hàng và chủ shop (Zero friction).**

### Slice 1 (Scope A) — Xác nhận bản quyền khi submit custom request
- **File dự kiến**:
  - `src/domain/schemas.ts` — `publicCustomRequestInputSchema` thêm 2 field:
    - `copyrightConfirmed: z.literal(true)` (bắt buộc tích checkbox).
    - `tosVersion: z.string().trim().min(1).max(50)` (frontend gửi tự động ngầm, ví dụ `'2026-09-08'`).
  - `src/services/custom-request.service.ts` — 2 cột mới `copyright_confirmed boolean` và `tos_version varchar(50)` trên bảng `custom_requests`, lưu cùng lúc `createCustomRequest`.
  - UI form public custom request — Thêm 1 dòng checkbox ngắn gọn, thân thiện ngay trên nút Gửi: *"Tôi cam kết có quyền sử dụng hợp pháp file/mô tả này và đồng ý với [Điều khoản dịch vụ](/dieu-khoan-in-an)."*
- **Quyết định chốt #1**: Lưu `copyright_confirmed boolean` + `tos_version varchar(50)`. Văn bản ToS được lưu tĩnh trong markdown/codebase kèm version tag. Khách chỉ cần tích 1 ô, frontend tự đính kèm version ngầm → Đảm bảo giá trị chứng cứ pháp lý khi tranh chấp mà không cần bảng quan hệ `tos_versions` phức tạp.

### Slice 2 (Scope B) — Truy vết license cho catalogue tự bán
- **File dự kiến**:
  - `src/domain/schemas.ts` — Thêm 3 field nullable vào `productInputSchema` / `productUpdateInputSchema`:
    - `licenseType: z.enum(['OWN_DESIGN', 'CC_BY', 'CC0', 'COMMERCIAL_LICENSE', 'OTHER']).default('OWN_DESIGN').optional()`
    - `licenseSourceUrl: z.string().trim().url().max(2000).nullable().optional()`
    - `licenseProofPath: z.string().trim().max(500).nullable().optional()`
  - Migration DB: Thêm 3 cột vào bảng `products`: `license_type varchar(50) default 'OWN_DESIGN'`, `license_source_url text`, `license_proof_path varchar(500)`. Dùng `varchar(50)` thay vì Postgres ENUM để mở rộng license platform mới (Cults3D, Patreon...) mà không cần migration DDL.
  - Admin UI Sản phẩm: Thêm mục phụ "Bản quyền & Nguồn model" (mặc định là "Tự thiết kế", chỉ cần điền link/ảnh khi lấy mẫu bên thứ 3).
- **Quyết định chốt #2**: Giữ 3 cột trực tiếp trên bảng `products` (không tạo bảng riêng `product_licenses` để tránh JOIN thừa, đúng quan hệ 1-1 thực tế). Dùng `varchar(50)` + Zod enum để dễ mở rộng.

### Slice 3 (Scope C) — Flag rủi ro IP bên thứ 3 & Soft Gate khi tạo báo giá
- **File dự kiến**:
  - `src/lib/copyright/ip-risk-keywords.ts` — Hằng số danh sách từ khóa rủi ro (thương hiệu xe, nhân vật Marvel/Disney/Anime, logo nổi tiếng). Cài đặt hàm `detectIpRiskKeywords(text: string)` dùng **Word-Boundary / Token Match** sau khi normalize bỏ dấu (tránh false positive từ `includes()`).
  - `src/services/custom-request.service.ts` — Cột mới `ip_risk_flag boolean default false` trên `custom_requests`. Chạy detect tự động khi tạo request.
  - `src/domain/schemas.ts` & `src/services/quote.service.ts` — Khi tạo báo giá (`quoteInputSchema` / `createQuote`):
    - Nếu request có `ip_risk_flag = true`, form tạo báo giá bắt buộc gửi kèm `ipRiskAcknowledged: true` (Admin/Staff tích xác nhận: *"Đã kiểm tra yêu cầu này không vi phạm SHTT hoặc in chi tiết phi thương mại theo yêu cầu cá nhân"*).
    - Nếu request bình thường (`ip_risk_flag = false`), không hiện checkbox này (luồng tạo báo giá giữ nguyên 100% như cũ).
  - Admin UI: Hiển thị badge vàng `[⚠️ Rủi ro SHTT]` trên danh sách và chi tiết custom request.
- **Quyết định chốt #3**: Danh sách từ khóa hardcode trong code + token matching (không làm bảng CRUD từ khóa thừa thãi). Không sửa state machine (`CUSTOM_REQUEST_STATUS_TRANSITIONS`), nhưng thêm **Soft Gate (Xác nhận khi tạo Quote)** để tránh nhân viên vô tình duyệt đơn vi phạm (tránh "checkbox theater" hình thức).
- **Giới hạn đã biết (Known Limitation)**: Bộ lọc từ khóa chỉ là tuyến cảnh báo heuristic mức 1. Khách có thể viết tắt/trại tên; nhân viên duyệt đơn vẫn là chốt chặn cuối cùng.

### Slice 4 (Scope D) — Quy trình khiếu nại (vận hành)
- Kênh email/hotline tiếp nhận khiếu nại bản quyền tại trang Điều khoản dịch vụ. SLA gỡ listing/ngừng in đơn trong vòng 24–48h khi nhận thông báo có căn cứ. Ghi vào `docs/operations/runbook.md`.

### Slice 5 (Scope E) — Đăng ký KDCN cho sản phẩm độc quyền
- Quyết định kinh doanh của Owner: xem xét đăng ký kiểu dáng công nghiệp tại Cục SHTT cho các mẫu tự thiết kế bán chạy có giá trị thương mại lớn.

## Rủi ro nếu không làm

- Xử phạt hành chính vi phạm quyền tác giả/SHCN (Nghị định 341/2025/NĐ-CP; Nghị định
  99/2013 sửa đổi bởi Nghị định 46/2024) — tối đa 250 triệu đồng (cá nhân) / 500 triệu
  đồng (tổ chức), cộng buộc nộp lại lợi nhuận bất hợp pháp + tiêu hủy hàng vi phạm.
- Xử lý hình sự Điều 226 BLHS nếu quy mô nghiêm trọng — cá nhân tù 6 tháng–3 năm/phạt
  đến 500 triệu; pháp nhân thương mại phạt đến 5 tỷ đồng hoặc đình chỉ hoạt động đến
  2 năm.
- License MakerWorld hết hạn trong khi listing vẫn còn sống → vô tình vi phạm mà không
  biết (rủi ro vận hành, không phải rủi ro thiết kế).

## Nhật ký cập nhật

### 2026-09-08 — Khởi tạo phase, nghiên cứu ban đầu
Owner hỏi về vấn đề bản quyền trên MakerWorld và luật bản quyền/SHTT tại Việt Nam khi
bán sản phẩm in 3D thương mại. Nghiên cứu qua Agent Reach (Exa search) + WebSearch/
WebFetch, tóm tắt:

**MakerWorld:**
- License mặc định phổ biến: chỉ cho in dùng cá nhân, cấm bán/phân phối thương mại trừ
  khi có license khác cho phép.
- 3 đường hợp pháp để bán print từ model không phải tự thiết kế: (1) license CC BY/
  CC BY-SA/CC BY-ND/PD, (2) functional part không được bảo hộ bản quyền (tranh cãi,
  vẫn có rủi ro), (3) mua Commercial License Membership (nhà thiết kế cần ≥200
  followers, ≥600 lượt in, sạch vi phạm 90 ngày mới được bật bán license, phí ~$3–5/
  tháng).
- Rủi ro: license có thể hết hạn trong khi listing vẫn sống; nên chụp màn hình lưu
  bằng chứng license ngay lúc tải.
- Nguồn: [MakerWorld Terms of Use](https://makerworld.com/en/user-agreement),
  [Commercial License Membership Agreement](https://makerworld.com/en/commercial-license-membership-agreement),
  [Makers101 — Commercial License Guide 2026](https://makers101.com/commercial-license-to-sell-3d-prints/),
  [Bambu Lab blog](https://blog.bambulab.com/empowering-our-creators-with-new-commercial-license-membership).

**Luật SHTT Việt Nam:**
- 3 nhóm quyền liên quan: quyền tác giả (tự động, không cần đăng ký), kiểu dáng công
  nghiệp (phải đăng ký + tính mới mới được bảo hộ), nhãn hiệu (logo/thương hiệu).
- Xử phạt hành chính SHCN: tối đa 250 triệu đồng (cá nhân), 500 triệu đồng (tổ chức) —
  Nghị định 99/2013/NĐ-CP sửa đổi bởi Nghị định 46/2024/NĐ-CP (hiệu lực 01/07/2024).
  Quyền tác giả: Nghị định 341/2025/NĐ-CP (hiệu lực 15/02/2026).
- Xử lý hình sự Điều 226 BLHS: cá nhân phạt 50–500 triệu đồng hoặc tù 6 tháng–3 năm;
  pháp nhân thương mại phạt tối đa 5 tỷ đồng hoặc đình chỉ hoạt động đến 2 năm.
- Nguồn: [Nghị định 341/2025/NĐ-CP](https://thuvienphapluat.vn/van-ban/So-huu-tri-tue/Nghi-dinh-341-2025-ND-CP-xu-phat-vi-pham-hanh-chinh-quyen-tac-gia-quyen-lien-quan-578605.aspx),
  [Nghị định 99/2013 sửa đổi (Lexology)](https://www.lexology.com/library/detail.aspx?g=fa32b99a-f869-4e72-a64d-e16940f11faf),
  [Điều 226 BLHS](https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/tu-van-phap-luat/46917/toi-xam-pham-quyen-so-huu-cong-nghiep-theo-dieu-226-bo-luat-hinh-su),
  [Cục Sở hữu trí tuệ — Kiểu dáng công nghiệp](https://ipvietnam.gov.vn/en/kieu-dang-cong-nghiep),
  [Xử lý hàng giả hàng nhái xâm phạm SHTT 2026 — Luật Taga](https://luattaga.vn/blog/xu-ly-hang-gia-hang-nhai-xam-pham-so-huu-tri-tue).

**Trạng thái**: Đã qua bước Gemini Challenge. 4 quyết định kỹ thuật đã được tối ưu hóa theo hướng cực kỳ đơn giản cho người dùng (Zero UX Friction) và đã chốt xong để tiến hành triển khai.

### 2026-09-08 — Gemini Challenge kết luận & Tinh gọn UX
Gemini đã hoàn thành challenge 4 quyết định:
1. Lưu `tos_version varchar(50)` cùng `copyright_confirmed` (frontend gửi ngầm, khách chỉ tích 1 checkbox).
2. Lưu 3 cột `license_*` trên bảng `products` với kiểu `varchar(50)` thay vì Postgres enum cứng.
3. Không đổi state machine, dùng **Soft Gate (Xác nhận khi tạo Quote)** đối với đơn có cờ rủi ro SHTT.
4. Hardcode danh sách từ khóa trong code nhưng dùng **Word-Boundary/Token Match** để triệt tiêu false positive.
Toàn bộ kế hoạch đã sẵn sàng cho bước triển khai.

### 2026-09-08 — Triển khai Slice 1–4, phát hiện + sửa 1 sai lệch so với kế hoạch chốt
Đã code xong Slice 1 (xác nhận bản quyền), Slice 2 (license catalogue), Slice 3
(ip_risk_flag + soft gate tạo báo giá), Slice 4 (runbook khiếu nại). Slice 5 vẫn
là quyết định kinh doanh của Owner, không có code.

**Sai lệch so với bản chốt trước đó**: kế hoạch ban đầu định tạo trang ToS mới
`/dieu-khoan-in-an`. Khi bắt tay code, phát hiện repo đã có sẵn
`/file-confidentiality-policy` (next-intl, `messages/{vi,en}.json` →
`policies.fileConfidentiality`) với đúng nội dung cần — mục 4 "Sở hữu trí tuệ"
đã có câu "khách xác nhận có quyền hợp pháp với file gửi, BaSa3D không chịu
trách nhiệm nếu vi phạm SHTT bên thứ 3". Thay vì tạo trang trùng lặp, đã: (1)
bổ sung 1 câu vào `section4BodyAfter` (2 ngôn ngữ) nói rõ quyền từ chối/dừng xử
lý đơn nếu phát hiện vi phạm, (2) trỏ checkbox trong `custom-request-form.tsx`
tới trang này, (3) trang tự hiển thị "Cập nhật lần cuối" từ
`CURRENT_TOS_VERSION` (`src/lib/copyright/tos-version.ts`) thay vì ngày hardcode
— cùng hằng số form public gửi lên làm `tosVersion`, tránh lệch version giữa 2
nơi.

**File đã đổi** (tóm tắt, không liệt kê hết dòng): migration
`20260908000000_copyright_compliance.sql`; `src/domain/schemas.ts` (4 schema);
`src/lib/copyright/{tos-version,ip-risk-keywords}.ts` (mới);
`src/services/{custom-request,quote,product}.service.ts`; admin actions +
UI cho custom-requests và products; `custom-request-form.tsx`;
`messages/{vi,en}.json` (mục `policies.fileConfidentiality.section4BodyAfter`);
`docs/operations/runbook.md`; test mới `tests/phase-29-copyright-compliance.test.ts`
+ cập nhật `tests/migration-contract.test.ts`,
`tests/phase-4-public-custom-request.test.ts`, `tests/domain-schemas.test.ts`
(2 test cũ cần thêm `copyrightConfirmed`/`tosVersion` vào payload mẫu vì field
mới bắt buộc).

**Test/build đã chạy**: `npm run typecheck` sạch; `npm run lint` sạch;
`npm run test` — 254 test, 162 pass, 92 skip (không có `DATABASE_URL` trong môi
trường này nên toàn bộ integration test mới/cũ tự skip qua cờ
`{ skip: !process.env.DATABASE_URL }`, không fail), 0 fail; `npm run build`
(production) thành công. **Chưa chạy được**: integration test thật trên DB
test riêng (cần `DATABASE_URL`, không có sẵn trong môi trường triển khai này)
và E2E Playwright cho checkbox/soft-gate UI — ghi vào rủi ro tồn đọng bên dưới,
cần Owner tự chạy `npm run test` với `DATABASE_URL` trỏ tới DB test trước khi
merge/release.

Checkbox bắt buộc mới cũng làm 8 Playwright spec hiện có (submit form
`/custom-print`: `storefront.spec.ts`, `car-nameplate.spec.ts`,
`dual-text.spec.ts`, `hinge-box.spec.ts`, `jigsaw.spec.ts`,
`keychain-blocks.spec.ts`, `keychain.spec.ts`, `lamp-shade.spec.ts`,
`organizer.spec.ts`) lẽ ra sẽ đỏ vì nút Gửi bị disable khi chưa tích — đã thêm
`page.locator('#copyrightConfirmed').check()` trước bước click submit ở cả 9
file. Chưa tự chạy được bộ Playwright này trong môi trường triển khai (cần
trình duyệt + server + DB test), cần Owner chạy `npx playwright test` xác nhận
trước khi merge.

Phase vẫn giữ nguyên trong `active/` (standing, không đóng).

### 2026-09-08 — Codex verification: bổ sung E2E, còn chặn bởi môi trường test

**Chưa hoàn tất verification Phase 29.** Không có `TEST_DATABASE_URL` hoặc bộ
`TEST_SUPABASE_*` trong môi trường/cấu hình hiện tại. Không tìm thấy PostgreSQL,
Supabase CLI hoặc Docker hoạt động (Docker symlink còn sót nhưng executable không
còn); Chromium Playwright có sẵn. Không apply migration, không dùng DB app, không
nới guard `tests/helpers/test-environment.ts`. Guard lấy `TEST_DATABASE_URL` rồi
mới gán vào `DATABASE_URL`; chỉ đặt `DATABASE_URL` không đủ để bật integration.

**Bổ sung test (chưa chạy được trên browser/DB):**
- `e2e/storefront.spec.ts`: assert nút gửi disabled trước xác nhận/enabled sau xác
  nhận; kiểm tra DB lưu `copyright_confirmed = true` và `CURRENT_TOS_VERSION`.
- `e2e/copyright-compliance.spec.ts`: dùng account OWNER thật từ helper RBAC, tạo
  request Pokemon qua UI admin; assert badge trên list/detail; bypass HTML
  validation trong test để gửi checkbox chưa tích tới `createQuoteAction`, assert
  thông báo soft gate và DB không có quote; tích checkbox, thử lại và assert đúng
  một quote được tạo. Action chỉ trả message của DomainError; integration hiện có
  kiểm tra mã `IP_RISK_ACKNOWLEDGEMENT_REQUIRED` tại service boundary.

**Kết quả thực chạy:**
- `npm run typecheck`: pass sau thay đổi test.
- `npm run lint`: pass sau thay đổi test.
- `npm run test`: 254 tests, 162 pass, 92 skip, 0 fail. Lần đầu bị sandbox chặn IPC
  của tsx; chạy lại với quyền mở socket thành công. Đây KHÔNG phải integration pass:
  DB tests Phase 29, Phase 4 và RBAC vẫn skip. Unit schema/migration contract chạy
  trong suite này.
- Playwright: cả lệnh chọn 9 specs được yêu cầu và `npx playwright test` đều dừng
  ngay tại configuration guard do thiếu TEST_*; không ca browser nào đã chạy.
- `npm run build`: compile thành công, lỗi prerender `/sitemap.xml` do DNS tới DB
  trong `.env`. Chạy lại với DB/Auth env rỗng và cho phép tải Google Fonts: compile,
  lint/type validation qua, nhưng sitemap vẫn cần `DATABASE_URL`, build exit 1.
  Không thay đổi sitemap hay cấu hình build để che lỗi môi trường.
- `git diff --check`: pass.

Không sửa production code, không sửa `CUSTOM_REQUEST_STATUS_TRANSITIONS`, không
đổi danh sách/tính heuristic của keyword filter. Đọc các nơi dùng `ip_risk_flag`
xác nhận chỉ lưu/hiển thị cảnh báo và gate tạo quote; không thêm hard block khác.
Giới hạn viết tắt/sai chính tả vẫn được chấp nhận như quyết định #3.

**Cần tiếp tục:** cung cấp Supabase local disposable + bộ TEST_* riêng, apply các
migration vào DB đó, chạy lại toàn bộ test không skip, 9 E2E specs + spec mới và
production build với DB test. Chưa có bằng chứng runtime để kết luận implementation
không có lỗi. Phase tiếp tục ở `active/`, không đóng/archive.
