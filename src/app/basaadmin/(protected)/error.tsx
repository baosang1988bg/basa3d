'use client';

import { Button } from '@/components/ui/button';

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4" role="alert">
      <h1 className="text-xl font-semibold">Không thể tải nội dung quản trị</h1>
      <p>Vui lòng thử lại. Nếu lỗi xảy ra sau khi lưu, kiểm tra bản ghi trước khi gửi lại thao tác.</p>
      <Button onClick={reset}>Thử lại</Button>
    </div>
  );
}
