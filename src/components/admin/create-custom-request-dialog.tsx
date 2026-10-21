'use client';

import { useState, useTransition } from 'react';
import { Plus, Loader2, X, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createCustomRequestAction } from '@/app/admin/(protected)/custom-requests/actions';

const CHANNELS = [
  { value: 'ZALO', label: 'Zalo' },
  { value: 'FACEBOOK', label: 'Facebook / Messenger' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'OTHER', label: 'Khác (Gọi điện, trực tiếp...)' },
];

export function CreateCustomRequestDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const res = await createCustomRequestAction(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setIsOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className="font-medium shadow-xs"
      >
        <Plus className="size-4 mr-1.5" />
        Ghi nhận yêu cầu mới
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FilePlus className="size-5" />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-semibold text-foreground">
                    Ghi nhận yêu cầu in mới
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Nhập thông tin yêu cầu của khách từ Zalo, Facebook hoặc các kênh tiếp nhận
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                <X className="size-4" />
                <span className="sr-only">Đóng</span>
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-channel">Kênh tiếp nhận <span className="text-destructive">*</span></Label>
                  <select
                    id="create-channel"
                    name="sourceChannel"
                    defaultValue="ZALO"
                    className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  >
                    {CHANNELS.map((ch) => (
                      <option key={ch.value} value={ch.value} className="bg-popover text-popover-foreground">
                        {ch.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-quantity">Số lượng món <span className="text-destructive">*</span></Label>
                  <Input
                    id="create-quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={1}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-customerName">Tên khách hàng <span className="text-destructive">*</span></Label>
                  <Input
                    id="create-customerName"
                    name="customerName"
                    placeholder="VD: Anh Nam, Chị Linh..."
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-customerPhone">Số điện thoại <span className="text-destructive">*</span></Label>
                  <Input
                    id="create-customerPhone"
                    name="customerPhone"
                    placeholder="VD: 0912345678"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-customerEmail">Email (tùy chọn)</Label>
                  <Input
                    id="create-customerEmail"
                    name="customerEmail"
                    type="email"
                    placeholder="khachhang@email.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-material">Chất liệu yêu cầu</Label>
                  <Input
                    id="create-material"
                    name="requestedMaterial"
                    placeholder="VD: PLA, PETG, ABS, TPU..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-color">Màu sắc yêu cầu</Label>
                  <Input
                    id="create-color"
                    name="requestedColor"
                    placeholder="VD: Đen nhám, Trắng, Trong suốt..."
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-size">Kích thước yêu cầu</Label>
                  <Input
                    id="create-size"
                    name="requestedSize"
                    placeholder="VD: 15x10x5 cm, tỉ lệ 1:1..."
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="create-description">Mô tả yêu cầu <span className="text-destructive">*</span></Label>
                <Textarea
                  id="create-description"
                  name="description"
                  rows={3}
                  placeholder="Mô tả chi tiết yêu cầu, link file gửi qua Zalo, lưu ý đặc biệt về độ bền, hoàn thiện..."
                  required
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 mr-1.5 animate-spin" />}
                  Ghi nhận yêu cầu
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
