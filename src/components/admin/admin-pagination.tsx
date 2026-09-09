import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export function AdminPagination({ basePath, page, hasNext, filters = {} }: {
  basePath: string;
  page: number;
  hasNext: boolean;
  filters?: Record<string, string | undefined>;
}) {
  function href(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    params.set('page', String(target));
    return `${basePath}?${params}`;
  }
  return (
    <nav aria-label="Phân trang" className="mt-4 flex items-center justify-end gap-3">
      {page > 1 ? <Link href={href(page - 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Trang trước</Link> : null}
      <span className="text-sm" aria-current="page">Trang {page}</span>
      {hasNext ? <Link href={href(page + 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Trang sau</Link> : null}
    </nav>
  );
}
