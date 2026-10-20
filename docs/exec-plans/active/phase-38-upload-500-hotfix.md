# Phase 38 — Hotfix: upload file ở /custom-print và /bao-gia lỗi 500

> Báo lỗi (OWNER, 2026-10-20): "trong custom-print khi bỏ 3mf vào toàn bị lỗi".
> Trạng thái: **code đã sửa (dev)** · **chờ OWNER đặt secret trên Vercel + redeploy** · chờ xác minh live.

## Phase brief
- **Goal**: khách upload được file (.3mf/.stl/.obj/.step/ảnh) ở `/custom-print` và `/bao-gia` trên Production.
- **Non-goals**: không đổi parser .3mf, không đổi giới hạn dung lượng, không đổi luồng báo giá.
- **Inputs**: tái hiện trên `basa3d.vercel.app`, log mạng trình duyệt, code `src/lib/upload-claim.ts`, `scripts/deploy/qc-deploy-vercel.mjs`.
- **Outputs**: secret trên Vercel (OWNER), script release sinh secret, test chặn tái phát.
- **Risks**: đổi secret làm mất hiệu lực upload claim đang mở (hiện không có — mọi upload đều đang lỗi).
- **DoD**: xem cuối file.

## Chẩn đoán (đã xác minh trên Production, 2026-10-20)
| Bước | Kết quả | Kết luận |
|---|---|---|
| Upload `.3mf` mẫu kiểu Bambu (sliced) qua UI | "An unexpected error occurred." | Tái hiện được |
| Upload `.stl` 1 tam giác | cũng 500 | **Không riêng .3mf** — mọi file đều lỗi |
| `POST /api/public/custom-requests/upload-urls` `{files:[]}` | 400 VALIDATION_ERROR | DB + rate limiter OK |
| cùng route, 1 file `png` | **500** INTERNAL_ERROR | Lỗi trong `createCustomRequestUploadTargets` |
| `POST /api/public/file-estimate` claim giả (không đụng Supabase) | **500** (đúng ra phải 403) | `uploadClaimSecret()` throw |
| Parser `.3mf` với 3 file mẫu (project chưa slice + `p:path`, sliced, zip64) | đọc đúng (62 phút / 12.34 g, 8 cm³) | Parser không có lỗi |

**Nguyên nhân gốc**: Production thiếu `UPLOAD_CLAIM_SECRET` (hoặc < 32 ký tự). Biến này thêm ở Phase 34
(`src/lib/upload-claim.ts`), nhưng `scripts/deploy/qc-deploy-vercel.mjs` chỉ sinh `ORDER_CONFIRMATION_SECRET`
và `CRON_SECRET` → chưa bao giờ được đặt trên Vercel → `createUploadClaim()` / `verifyUploadClaim()` ném
`Error` thường → `apiError` trả 500.

## Lát cắt
1. **Ops (OWNER — bắt buộc, Claude không làm thay được: không có phiên Vercel và không được nhập secret)**
   ```bash
   cd ~/Documents/AI00/BaSa3D
   openssl rand -hex 32 | npx vercel env add UPLOAD_CLAIM_SECRET production
   openssl rand -hex 32 | npx vercel env add UPLOAD_CLAIM_SECRET preview
   git push origin dev main        # deploy mới để function nhận biến
   ```
   (Hoặc Vercel → basa3d → Settings → Environment Variables → thêm → Deployments → Redeploy.)
   Dùng giá trị KHÁC `ORDER_CONFIRMATION_SECRET` (deployment.md, Phase 34).
2. **Code** — commit `30dc0af` (dev): `GENERATED` trong `qc-deploy-vercel.mjs` có `UPLOAD_CLAIM_SECRET`.
3. **Test** — `tests/phase-38-deploy-env.test.ts`: quét mọi `throw new Error('X must be configured…')` trong
   `src/` và bắt buộc script release xử lý X (DB_KEYS / COPY_IF_MISSING / GENERATED). Đã kiểm chứng: bỏ bản
   sửa → test fail "release script never sets: UPLOAD_CLAIM_SECRET".
4. **Docs** — `docs/operations/deployment.md` mục *Biến môi trường bắt buộc*; roadmap Phase 38.

## Follow-up (không chặn hotfix)
- [ ] `apiError` đang trả câu tiếng Anh "An unexpected error occurred." cho khách → nên có thông điệp tiếng
      Việt + mã lỗi để khách báo lại (UX, Phase sau).
- [ ] Health check `/api/health` (chỉ báo "thiếu cấu hình X", không lộ giá trị) để phát hiện sớm sau deploy.
- [ ] E2E Playwright `custom-print` upload chạy trên Preview deployment trước khi promote Production.

## Definition of Done
- [x] Tìm được nguyên nhân gốc, tái hiện trên Production
- [x] Script release sinh secret + test chặn tái phát (lint/typecheck/test xanh)
- [ ] OWNER đặt `UPLOAD_CLAIM_SECRET` (Production + Preview) và redeploy
- [ ] Xác minh live: upload `.3mf` (sliced → giá chính xác, chưa slice → khoảng giá), `.stl`, ảnh ở `/custom-print`;
      upload nhiều file ở `/bao-gia`
- [ ] Đóng bằng `close-phase`
