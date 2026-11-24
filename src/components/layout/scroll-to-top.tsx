'use client';

/**
 * ScrollToTop
 * Mỗi khi pathname thay đổi (navigate sang page/tab mới) sẽ cuộn window
 * về đầu trang (top: 0). Dùng `window.scrollTo` với `behavior: 'instant'`
 * để không có hiệu ứng delay làm user thấy content cũ trước khi scroll.
 *
 * Mounted ở StorefrontLayout — áp dụng cho toàn bộ storefront.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // Dùng 'instant' thay vì 'smooth' để tránh flash nội dung cũ
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
