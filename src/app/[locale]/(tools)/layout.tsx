import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="flex h-14 items-center justify-between border-b px-4">
      <Link href="/">← Về cửa hàng</Link>
      <a href="#tool-quote" className="font-semibold text-primary">Gửi báo giá</a>
    </header>
    <main>{children}</main>
  </div>;
}
