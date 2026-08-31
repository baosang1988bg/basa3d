'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { StorefrontButton } from '@/components/storefront/button';

export function ConfirmIntentDialog({ productName }: { productName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<StorefrontButton variant="accent" />}>Thêm vào giỏ / Đặt in ngay</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đã ghi nhận quan tâm của bạn</DialogTitle>
          <DialogDescription>
            Tính năng giỏ hàng và đặt hàng trực tuyến cho &quot;{productName}&quot; đang được hoàn thiện.
            Đây chỉ là bước xác nhận thông tin — <strong>chưa có đơn hàng nào được tạo</strong>.
            Chúng tôi sẽ liên hệ xác nhận trước khi lên đơn. Vui lòng dùng nút &quot;Đặt in&quot; ở
            đầu trang hoặc liên hệ Zalo/hotline để được hỗ trợ ngay.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <StorefrontButton variant="secondary" onClick={() => setOpen(false)}>Đã hiểu</StorefrontButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
