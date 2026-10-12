# Release plan — MakerWorld Profile Verification Phase A lên Vercel

**Status:** draft 2026-10-12 (Claude). Chưa thực hiện. Bổ sung cho `go-live-deployment-plan.md` (kế hoạch go-live tổng) — file này chỉ lo việc đưa Phase A lên Preview rồi Production an toàn.

## Tóm tắt rủi ro

| Hạng mục | Đánh giá |
|---|---|
| Migration DB | **Không có.** `model_snapshot` vẫn là JSONB, v2 chỉ là shape mới. |
| Env var mới | **Không có.** Nhưng `ORDER_CONFIRMATION_SECRET` (blocker #1 của go-live plan) phải có, nếu không link báo giá public lỗi 500. |
| Tương thích dữ liệu cũ | Quote Phase 13 (v1, không có `schemaVersion`) vẫn đọc được — có test. |
| Rollback | **An toàn.** Code cũ đọc snapshot v2 vẫn được (v2 giữ nguyên mọi field v1: `title`, `coverImageUrl`, `platesCount`, `totalPrintMinutes`, `colorsCount`, `sourceUrl`; field mới bị bỏ qua). Không có thay đổi schema DB cần hoàn tác. |
| Phụ thuộc bên ngoài | Resolver gọi `makerworld.com` từ IP Vercel — **nhiều khả năng bị Cloudflare chặn**. Không phải lỗi deploy; panel tự chuyển sang nhập tay. |
| Hành vi đổi với staff | Form báo giá giờ chỉ hiện 1 công cụ (mặc định "Từ link MakerWorld") — báo trước cho staff. |

## Bước 0 — Kiểm tra trước khi đẩy (trên máy bạn)

- [ ] `npm run typecheck && npm run lint && npm run build`
- [ ] Mức 1 trong `docs/operations/local-testing.md` (bấm thử 11 bước) — ít nhất bước 1–8.
- [ ] (Nếu có Docker) Mức 3: `npm test` + `npx playwright test e2e/makerworld-quote.spec.ts e2e/pricing.spec.ts`.
- [ ] Kiểm tra env trên Vercel (cần `vercel login` một lần):
  ```bash
  vercel env ls
  ```
  - `ORDER_CONFIRMATION_SECRET` có ở **Preview** và **Production** chưa? Chưa có → tạo riêng cho từng môi trường:
    ```bash
    openssl rand -hex 32 | vercel env add ORDER_CONFIRMATION_SECRET production
    openssl rand -hex 32 | vercel env add ORDER_CONFIRMATION_SECRET preview
    ```
    (Secret là lâu dài — đổi sau này sẽ vô hiệu mọi link báo giá đã gửi khách.)
  - **Preview đang trỏ vào Supabase nào?** `vercel env pull .env.preview.local --environment=preview` rồi xem `DATABASE_URL` (đặt tên `.env.preview.local` để `.gitignore` chặn, không lỡ commit secret; xem xong thì xoá file). Nếu Preview dùng chung DB **Production** thì *không* tạo báo giá thử trên Preview (sẽ ghi vào dữ liệu thật) — hoặc đổi Preview sang project Development trước.

## Bước 1 — Đưa code lên nhánh riêng

Các commit Phase A đang nằm trên `main` local (đi trước `origin/main`). Không push thẳng `main`; đẩy sang nhánh tính năng và mở PR:

```bash
git status                                   # sạch (trừ file cá nhân chưa track)
git push origin HEAD:feat/makerworld-phase-a
```

Mở PR `feat/makerworld-phase-a` → `main` trên GitHub. Workflow `Attestation Gate (D3)` chỉ báo cáo (advisory), không chặn merge.

## Bước 2 — Preview deployment

- Nếu project Vercel đã nối GitHub (Vercel → Project `basa3d` → Settings → Git): PR tự tạo **Preview URL** (comment trên PR).
- Nếu chưa nối Git (trước đây deploy bằng CLI): từ nhánh tính năng chạy
  ```bash
  vercel            # tạo Preview deployment, in ra URL
  ```

Smoke test trên Preview URL (`/admin/login`):
- [ ] Mở 1 custom request → dán link MakerWorld 3246150 → ghi lại kết quả: lấy được dữ liệu hay báo chặn.
- [ ] Nếu bị chặn: luồng "Nhập tay thông số" + "Tách thông số" ra giá được.
- [ ] (Chỉ khi Preview **không** dùng DB Production) tạo 1 báo giá → mở link public → thấy card profile.
- [ ] Mở 1 báo giá **cũ** (Phase 13) trên trang public → vẫn hiển thị bình thường.
- [ ] Xem log: Vercel → Deployment → Logs, lọc `MAKERWORLD_RESOLVER` → thấy `{ outcome: 'OK' }` hoặc `{ outcome: 'BLOCKED_OR_TIMEOUT' }`.

## Bước 3 — Production

- [ ] Merge PR vào `main`.
  - Có Git integration: Vercel tự deploy Production từ `main`.
  - Không có: `git checkout main && git pull && vercel --prod`.
- [ ] Sau đó trên máy bạn: `git pull` để `main` local khớp `origin/main`.
- [ ] Smoke Production: đăng nhập admin → mở custom request → panel MakerWorld hiện → (tuỳ chọn) tạo 1 báo giá cho custom request test rồi để hết hạn/huỷ.
- [ ] Báo staff: form báo giá có 3 tab công cụ; báo giá từ MakerWorld bắt buộc chọn đúng profile + tick xác nhận.

## Rollback

Nếu Production có lỗi: Vercel Dashboard → Deployments → deployment trước đó → **Promote to Production** (hoặc `vercel rollback`). Không cần thao tác DB. Báo giá v2 đã tạo vẫn hiển thị được với code cũ.

## Theo dõi 2 tuần sau release

- Tỷ lệ `MAKERWORLD_RESOLVER` `OK` vs `BLOCKED_OR_TIMEOUT` → quyết định có làm Phase B (Storefront) không và làm theo hướng nào (plan §6 O5).
- Log `QUOTE_SNAPSHOT_CORRUPTED` → phải bằng 0.
- Audit log `MANUAL_PRICE_OVERRIDE` → staff có thường xuyên sửa giá tay không (nếu nhiều: preset công/hao phí đang lệch thực tế).
- Lỗi `QUOTE_SNAPSHOT_MISMATCH` mà staff báo → kiểm tra có phải false positive của ngưỡng ±15% không.

## Việc của go-live plan vẫn còn mở (không chặn release này, nhưng nên làm)

Từ `go-live-deployment-plan.md`: `NEXT_PUBLIC_SITE_URL`, các biến Zalo/hotline, backup Supabase Production (Pro + dump offsite), domain + DNS-only, `release-check` trước khi mở domain cho khách. Trạng thái các mục này tính đến 2026-09-17 — chạy `vercel env ls` để cập nhật.
