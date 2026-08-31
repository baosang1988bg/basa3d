import Link from 'next/link';

// Lives at the app root (not inside the (storefront) route group), so it renders for any
// completely unmatched path without the storefront Header/Footer — kept intentionally minimal
// rather than duplicating that component tree for a 404 edge case.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-heading text-6xl font-extrabold text-foreground">404</p>
      <h1 className="font-heading text-xl font-bold text-foreground">Không tìm thấy trang</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Trang bạn tìm không tồn tại hoặc đã được di chuyển.</p>
      <Link href="/" className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90">
        Về trang chủ
      </Link>
    </div>
  );
}
