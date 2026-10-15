'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, Loader2, X, ArrowRight } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CustomRequestSummary } from '@/services/custom-request.service';
import { nextCustomRequestStatuses } from '@/domain/custom-request-status';
import { deleteCustomRequestAction, updateCustomRequestAction } from '@/app/admin/(protected)/custom-requests/actions';

const CHANNELS = ['ZALO', 'FACEBOOK', 'WEBSITE', 'TIKTOK', 'INSTAGRAM', 'OTHER'];

export function CustomRequestRowActions({
  item,
  isOwner,
}: {
  item: CustomRequestSummary;
  isOwner: boolean;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const res = await updateCustomRequestAction(item.id, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setIsEditOpen(false);
      }
    });
  }

  async function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteCustomRequestAction(item.id);
      if (res.error) {
        setError(res.error);
      } else {
        setIsDeleteOpen(false);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <Link
          href={`/admin/custom-requests/${item.id}`}
          className={buttonVariants({ size: 'sm', variant: 'default' })}
          title="Mở màn hình phân tích file 3D, báo giá và xử lý yêu cầu"
        >
          <span>Xử lý</span>
          <ArrowRight className="size-3.5 ml-1" />
        </Link>

        {isOwner && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-foreground hover:bg-muted"
              onClick={() => {
                setError(null);
                setIsEditOpen(true);
              }}
              title="Chỉnh sửa yêu cầu (Dành cho Owner)"
            >
              <Pencil className="size-3.5 mr-1" />
              Sửa
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="bg-destructive/90 hover:bg-destructive"
              onClick={() => {
                setError(null);
                setIsDeleteOpen(true);
              }}
              title="Xóa yêu cầu / dữ liệu test (Dành cho Owner)"
            >
              <Trash2 className="size-3.5 mr-1" />
              Xóa
            </Button>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  Chỉnh sửa yêu cầu {item.requestNumber}
                </h2>
                <p className="text-xs text-muted-foreground">Quyền hạn OWNER — chỉnh sửa thông tin hoặc dữ liệu test</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isPending}
              >
                <X className="size-4" />
                <span className="sr-only">Đóng</span>
              </Button>
            </div>

            <form onSubmit={handleUpdate} className="mt-4 flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-channel-${item.id}`}>Kênh tiếp nhận</Label>
                  <select
                    id={`edit-channel-${item.id}`}
                    name="sourceChannel"
                    defaultValue={item.sourceChannel}
                    className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  >
                    {CHANNELS.map((ch) => (
                      <option key={ch} value={ch} className="bg-popover text-popover-foreground">
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-status-${item.id}`}>Trạng thái</Label>
                  <select
                    id={`edit-status-${item.id}`}
                    name="status"
                    defaultValue={item.status}
                    className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  >
                    {/* Phase 36: only the current status and its forward moves — backward moves need the
                        detail page's OWNER override with a reason (the server refuses them here). */}
                    {[item.status, ...nextCustomRequestStatuses(item.status)].map((st) => (
                      <option key={st} value={st} className="bg-popover text-popover-foreground">
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-name-${item.id}`}>Tên khách hàng</Label>
                  <Input
                    id={`edit-name-${item.id}`}
                    name="customerName"
                    defaultValue={item.customerName || ''}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-phone-${item.id}`}>Số điện thoại</Label>
                  <Input
                    id={`edit-phone-${item.id}`}
                    name="customerPhone"
                    defaultValue={item.customerPhone || ''}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-email-${item.id}`}>Email (tuỳ chọn)</Label>
                  <Input
                    id={`edit-email-${item.id}`}
                    name="customerEmail"
                    type="email"
                    defaultValue={item.customerEmail || ''}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-quantity-${item.id}`}>Số lượng</Label>
                  <Input
                    id={`edit-quantity-${item.id}`}
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={item.quantity || 1}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-mat-${item.id}`}>Chất liệu</Label>
                  <Input
                    id={`edit-mat-${item.id}`}
                    name="requestedMaterial"
                    defaultValue={item.requestedMaterial || ''}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-color-${item.id}`}>Màu sắc</Label>
                  <Input
                    id={`edit-color-${item.id}`}
                    name="requestedColor"
                    defaultValue={item.requestedColor || ''}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-size-${item.id}`}>Kích thước</Label>
                  <Input
                    id={`edit-size-${item.id}`}
                    name="requestedSize"
                    defaultValue={item.requestedSize || ''}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`edit-desc-${item.id}`}>Mô tả yêu cầu</Label>
                <Textarea
                  id={`edit-desc-${item.id}`}
                  name="description"
                  defaultValue={item.description || ''}
                  rows={3}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`edit-note-${item.id}`}>Ghi chú nội bộ</Label>
                <Textarea
                  id={`edit-note-${item.id}`}
                  name="internalNote"
                  defaultValue={item.internalNote || ''}
                  rows={2}
                  placeholder="Ghi chú nội bộ cho xưởng..."
                />
              </div>

              {error && <p className="text-sm font-medium text-destructive">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isPending}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="relative w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <h2 className="font-heading text-lg font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Xác nhận xóa yêu cầu
            </h2>
            <p className="mt-2 text-sm text-foreground">
              Bạn có chắc chắn muốn xóa vĩnh viễn yêu cầu{' '}
              <strong className="font-semibold text-primary">{item.requestNumber}</strong>
              {item.customerName ? ` của ${item.customerName}` : ''}?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ⚠️ Quyền hạn OWNER: Hành động này sẽ xoá sạch yêu cầu cùng toàn bộ báo giá, việc in và file liên quan. Rất phù hợp để dọn dẹp các dữ liệu kiểm thử (test data). Thao tác này không thể hoàn tác.
            </p>

            {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isPending}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Xác nhận xóa vĩnh viễn
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
