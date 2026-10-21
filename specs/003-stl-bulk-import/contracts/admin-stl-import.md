# Contract — Admin "Kho nhập STL" (`/admin/stl-import`)

Trang: `src/app/admin/(protected)/stl-import/page.tsx` (server component, `requireAdmin()`), actions:
`src/app/admin/(protected)/stl-import/actions.ts` (`'use server'`), service: `src/services/stl-import.service.ts`.

## Đọc

`listImportItems(filter)` — `filter = stlImportFilterSchema` (`status: PENDING|APPROVED|REJECTED|ERROR` — ERROR =
`render_status = 'ERROR'`; `categoryId?`, `sourceDir?`, `q?` (ilike trên `products.name`), `page` (24/trang)).
Trả về `{ items: [{ itemId, itemUpdatedAt (chuỗi µs), productId, productUpdatedAt (chuỗi µs), coverUrl, name, slug,
categoryId, categoryName, bboxMm, volumeCm3, basePrice, licenseType, licenseSourceUrl, licenseReviewed, reviewStatus,
renderStatus, processError, warnings[], needsPriceReview, needsRerender, sourceChangedAt, sourceRelPath, sourceDir }],
total, page, bucketUsageBytes }`. Chỉ trang admin dùng; **không** có API public.

## Ghi (server actions)

| Action | Quyền | Input (Zod) | Kết quả |
|---|---|---|---|
| `quickEditImportItemAction` | `requireAdmin` (OWNER, STAFF) | `stlImportQuickEditSchema` | `{ ok: true, itemUpdatedAt, productUpdatedAt }` hoặc `{ ok: false, code: 'STALE_WRITE' }` (409) |
| `requestRerenderAction` | `requireAdmin` | `{ itemId, expectedItemUpdatedAt }` | đặt `needs_rerender = true` |
| `approveImportItemsAction` | **`requireOwner`** | `stlImportBulkDecisionSchema` (1–100 item) | `{ approved: itemId[], blocked: [{ itemId, reasons: ('NOT_RENDERED'\|'LICENSE_NOT_REVIEWED'\|'NO_IMAGE'\|'NO_PRICE'\|'UNCATEGORIZED'\|'STALE'\|'NOT_PENDING')[] }] }` |
| `rejectImportItemsAction` | **`requireOwner`** | `stlImportBulkDecisionSchema` | `{ rejected: itemId[], blocked: [{ itemId, reasons: ('STALE'\|'NOT_PENDING')[] }] }` |

Quy tắc chung:

- Chưa đăng nhập → 401 (layout chuyển `/admin/login`); STAFF gọi approve/reject → 403 `FORBIDDEN`; khách gọi bất kỳ
  action → 401/403. Kiểm cả ở action và service.
- Sửa nhanh: đổi giá → ghi `base_price` + `pricing_breakdown = null` + `pricing_config_id = null` (giá tay, giữ CHECK
  cặp) và cập nhật variant mặc định `price`; đặt `needs_price_review = false`. Tick bản quyền → `license_reviewed_by/at`.
- Duyệt: mỗi item một transaction (`for update` item rồi product, theo thứ tự id); kiểm trước các điều kiện gate để trả
  lý do; đặt item APPROVED + `reviewed_by/at`, product ACTIVE; trigger DB là lưới an toàn (nếu trigger chặn → item vào
  `blocked`). Item hợp lệ vẫn được duyệt khi item khác bị chặn.
- Từ chối: item REJECTED + product ARCHIVED.
- Mọi ghi → `audit_logs` (`STL_IMPORT_*`) và `revalidateTag('storefront-catalog')` sau khi có thay đổi trạng thái.
- Banner "Dung lượng ảnh > 800 MB" khi `bucketUsageBytes > 800 * 1024²`.
