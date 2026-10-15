# MakerWorld — báo giá từ ảnh chụp màn hình profile (ADR-0039)

Trạng thái: **đang implement** (2026-10-15). Feature flag `MAKERWORLD_SCREENSHOT_ESTIMATE_ENABLED` mặc định **tắt**.

## 1. Bối cảnh

- MakerWorld đặt Cloudflare challenge trước mọi request tự động (ADR-0034) → resolver server-side (AUTO) gần như luôn `BLOCKED`.
- Đường SPEC hiện có (khách dán dòng thông số) đúng về kỹ thuật nhưng khách lười gõ/copy, nhất là trên điện thoại.
- **Non-goal:** vượt Cloudflare (headless solver, mượn `cf_clearance`, proxy xoay IP). Không làm.

## 2. Giải pháp

Khách dán link **và** chụp màn hình phần profile trên app/web MakerWorld → server cho model vision đọc ảnh → trích danh sách profile → tính giá bằng **đúng** `estimateFromSpec` (giống SPEC) → khách chọn profile → gửi yêu cầu.

```
Browser                         Server                                   Ngoài
 │ upload ảnh (signed URL, đã có) ─────────────────────────────────────▶ Supabase Storage
 │ POST /api/public/makerworld-screenshot-estimate {url, attachmentPath, uploadClaim}
 │                               ├ verify uploadClaim + inspectUploadedObject (magic bytes)
 │                               ├ download ảnh (≤ 8MB) ───────────────▶ Gemini (vision, JSON schema)
 │                               ├ Zod-bound kết quả, đối chiếu link ↔ ảnh
 │                               ├ estimateFromSpec cho từng profile
 │                               └ INSERT makerworld_screenshot_estimates (id, url, path, profiles, match)
 │ ◀── { screenshotEstimateId, profiles[p0..], matchStatus }
 │ POST /api/public/custom-requests { makerworld: { screenshotEstimateId, profileKey, tier, … } }
 │                               ├ đọc bản ghi (chưa dùng, chưa hết hạn, URL trùng)
 │                               └ 1 transaction: tạo custom_request + đánh dấu consumed
```

## 3. Quyết định (Owner duyệt — đánh dấu ⚠ là tạm, cần xác nhận)

| # | Quyết định | Lý do / trade-off |
|---|---|---|
| D1 ⚠ | Provider: **Gemini 3.5 Flash-Lite** qua REST `generateContent` (không thêm SDK — AGENTS rule 8). Env `GEMINI_API_KEY`, `MAKERWORLD_VISION_MODEL` (mặc định `gemini-3.5-flash-lite`; đổi sang `gemini-3.8-flash` nếu đọc sai nhiều). Google giới hạn model 2.5 cho project đã dùng trước đó (trang deprecations, kiểm tra 2026-10-15). | Rẻ, hỗ trợ `responseSchema` JSON. Đổi provider chỉ sửa `makerworld-screenshot-vision.ts`. Ảnh là trang MakerWorld công khai, gần như không có PII — nhưng ảnh của khách được gửi cho bên thứ ba → cần ghi vào chính sách bảo mật. |
| D2 | Link + ảnh đi **cùng 1 request**; server lưu bản ghi, trả `screenshotEstimateId`. Khi gửi yêu cầu chỉ gửi `id` + `profileKey`. | Không thể ghép ảnh lần này với link lần khác. Không gọi AI lần 2 lúc submit (tốn tiền + kết quả có thể khác). |
| D3 | Ảnh dùng lại luồng upload hiện có (signed URL + `uploadClaim` + magic bytes). Trình duyệt re-encode sang JPEG (cạnh dài ≤ 2600px) trước khi upload → xoá EXIF/GPS, giảm dung lượng, đọc được HEIC nếu trình duyệt hỗ trợ. Server chỉ nhận JPG/PNG/WEBP ≤ **8MB**. Ảnh đã có bản ghi → 409 trước khi gọi AI. | Không vướng giới hạn body 4.5MB của Vercel; không thêm đường upload mới. |
| D4 | Profile key do server đặt `p0..p9` (tối đa **10** profile). Không dùng tên profile làm khoá. | Hai profile có thể trùng tên. |
| D5 | Profile thiếu giờ in hoặc gram → `dataIncomplete`, **không ra giá** (không bao giờ coi thiếu = 0). UI nhắc chụp phần chi tiết. | Giống `dataIncomplete` của resolver. |
| D6 | 1 profile đủ dữ liệu → chọn sẵn. ≥ 2 → **không chọn sẵn**. `#profileId` trong link chỉ lưu cho staff, không dùng để chọn. | Không biết profileId ứng với profile nào trong ảnh. |
| D7 ⚠ | Đối chiếu mức model: (a) AI đọc được `models/<id>` trong ảnh → so chính xác; (b) slug của link so với tên mẫu trong ảnh (token overlap). Kết quả `MATCH` / `MISMATCH` / `UNKNOWN`. **MISMATCH → ẩn giá**, vẫn cho gửi yêu cầu. | Mức profile luôn không kiểm được → staff xác nhận ở panel Phase A. |
| D8 | Bản ghi sống **2 giờ** (`expires_at`), dùng 1 lần (`consumed_at` set trong cùng transaction tạo request). Cron hằng ngày xoá bản ghi chưa dùng > 2 ngày. Ảnh không được gắn vào request sẽ bị orphan-cron xoá sau 24h. | Chống replay; dọn rác. |
| D9 | Ảnh được gắn vào `custom_requests.attachment_path` (lấy từ bản ghi DB, không lấy từ browser). | Staff xem được ảnh bằng khối "File đính kèm" sẵn có; orphan-cron tự giữ lại. |
| D10 | Snapshot lưu thêm `specText` tổng hợp (vd `0.2mm layer · P1S · 7.4 h · 6 plates · 168 g · No AMS`) + khối `screenshot` (match, tên mẫu AI đọc, toàn bộ profile, key khách chọn). | Admin page + panel báo giá Phase A đọc `specText` sẵn → không cần sửa panel. |
| D11 | Chống lạm dụng: 10 lần/giờ/IP (DB limiter) + ngân sách toàn cục **200 lần/giờ** (đếm bản ghi). | Mỗi lần gọi vision tốn tiền. |
| D12 | Prompt injection trong ảnh: output bắt buộc theo JSON schema, mọi trường Zod-bound (số có trần, chuỗi ≤ 300 ký tự), React escape khi render; giá chỉ là "ước tính". | Ảnh giả chỉ cho ra giá ước tính giả, không đổi giá chính thức (giống trade-off SPEC đã chấp nhận ở ADR-0034). |

## 4. Thay đổi

### DB — `supabase/migrations/20261018000000_makerworld_screenshot_estimates.sql`
`makerworld_screenshot_estimates(id uuid pk, model_id, source_url, requested_profile_id, attachment_path unique, model_title_extracted, match_status, profiles jsonb (array 0..10), created_at, expires_at, consumed_at, custom_request_id fk)`, RLS bật, index `created_at`.

### Code
- `src/lib/parsers/makerworld-screenshot.ts` — pure: Zod schema output AI, chuẩn hoá profile + key, `matchScreenshotToUrl`, `profileSpecLine`.
- `src/lib/vision/gemini-vision.ts` — gọi Gemini REST (timeout 25s, không log ảnh/key).
- `src/services/makerworld-screenshot-estimate.service.ts` — `estimateMakerWorldScreenshot`, `loadScreenshotEstimateForSubmission`, `cleanupExpiredScreenshotEstimates`.
- `src/app/api/public/makerworld-screenshot-estimate/route.ts` — route mới.
- `src/app/api/public/makerworld-estimate/route.ts` — thêm `screenshotAvailable` vào DTO.
- `src/app/api/public/custom-requests/route.ts` + `src/services/custom-request.service.ts` — nhánh `screenshotEstimateId`, consume trong transaction.
- `src/domain/schemas.ts` — `publicMakerWorldIntakeSchema` thêm `screenshotEstimateId` + `profileKey` (loại trừ với `specText`).
- `src/components/storefront/makerworld-intake-card.tsx` — nút "Chụp màn hình profile", hiển thị match, chọn profile.
- Admin: badge `SCREENSHOT`, khối kết quả đối chiếu.
- Cron: dọn bản ghi hết hạn.

### Env
`MAKERWORLD_SCREENSHOT_ESTIMATE_ENABLED=true`, `GEMINI_API_KEY`, (tuỳ chọn) `MAKERWORLD_VISION_MODEL`.

## 5. Kiểm thử

Unit (không cần DB/mạng) — `tests/makerworld-screenshot-estimate.test.ts`, đã pass:
- [x] Zod bound: số âm / NaN / vượt trần / > 10 profile / chuỗi dài → bị loại.
- [x] Profile thiếu giờ hoặc gram → `dataIncomplete`, không có giá.
- [x] `matchScreenshotToUrl`: id trùng → MATCH; id khác → MISMATCH (dù slug khớp); slug khớp tên → MATCH; khác hẳn → MISMATCH; không có slug/tên → UNKNOWN; tiếng Việt có dấu.
- [x] Gemini client: timeout, HTTP lỗi, JSON hỏng → `VisionUnavailableError` (fetch giả).
- [x] Service với deps giả: flag cần cả switch + API key; MISMATCH → giá null; 1 profile → chọn sẵn; 2 profile → không chọn.
- [x] Schema intake: `specText` + `screenshotEstimateId` cùng lúc → lỗi; `profileKey` sai dạng → lỗi.

DB (skip khi không có `TEST_DATABASE_URL`) — đã chạy trên PGlite, nên chạy lại trên Postgres thật:
- [x] Submit với id hết hạn / đã dùng → 409; URL khác / profileKey không tồn tại → 400 (unit).
- [x] Hai submit đồng thời cùng id → chỉ 1 thành công (PGlite).
- [ ] Ngân sách toàn cục (rate limiter scope `makerworld-screenshot-global`) — chỉ có test với deps giả.

Thủ công (Owner, Dev): chụp 3 loại ảnh (danh sách profile trên app, chi tiết profile trên web, ảnh không liên quan) → kiểm tra profile, match, giá; gửi yêu cầu → admin thấy ảnh + snapshot.

## 5b. Review lần 2 (2026-10-15) — đã sửa

- Model mặc định `gemini-2.5-flash` → `gemini-3.5-flash-lite` (2.5 bị giới hạn cho project mới).
- Thời gian dạng "1d 2h" trước đây bị đọc thành 2 h (báo giá thấp) → thêm `parseDurationText` xử lý ngày.
- Đối chiếu bằng chữ chỉ ra MISMATCH khi cả slug và tên mẫu có ≥ 2 từ và không trùng từ nào (tránh ẩn giá vì tên 1 từ/tên đã dịch).
- Bỏ qua phần "thought" trong response của model có thinking.
- Ảnh đã dùng bị từ chối trước khi tốn tiền gọi AI.
- Card profile không còn hiện "0h · 0 plates · 0g" cho profile thiếu số liệu.
- Re-encode ảnh phía trình duyệt (EXIF, dung lượng, HEIC) + dòng thông báo ảnh được đọc bằng AI.
- DB test (single-use đồng thời, hết hạn) đã chạy pass trên PGlite (Postgres WASM) — nên chạy lại trên Postgres thật của máy Owner.

## 6. Rủi ro còn lại / follow-up

- AI đọc sai số → khách thấy giá ước tính sai; staff vẫn chốt giá thật. Theo dõi log `[MAKERWORLD_SCREENSHOT]` (outcome, số profile, match) 2 tuần đầu.
- Chi phí vision: ước tính ≤ 200 lần/giờ × vài chục đồng — xem lại ngân sách sau 1 tháng.
- Có thể nâng lên tối đa 3 ảnh/lần nếu khách hay cần chụp cả danh sách lẫn chi tiết.
- Chính sách bảo mật cần ghi: ảnh chụp được xử lý bởi dịch vụ AI bên thứ ba.
