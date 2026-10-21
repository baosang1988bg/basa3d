import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';

export default async function ToolsLayout({ children, params }: { children: ReactNode; params: LocaleParams }) {
  // Phase 42: the localized Link resolves the locale on the server; see src/i18n/request-locale.ts.
  await applyRequestLocale(params);
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="flex h-14 items-center justify-between border-b px-4">
      <Link href="/" className="group inline-flex items-center gap-1"><span aria-hidden className="transition-transform duration-200 ease-out group-hover:-translate-x-1 motion-reduce:transition-none">←</span> Về cửa hàng</Link>
      <a href="#tool-quote" className="font-semibold text-primary">Gửi báo giá</a>
    </header>
    <main>{children}</main>
  </div>;
}
