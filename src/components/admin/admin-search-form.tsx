import { Search } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ADMIN_SEARCH_MAX_LENGTH } from '@/lib/admin-search';

// Phase 55 (D3): plain GET form — no client state, same pattern as the products list filters.
// `hidden` carries the params that must survive a search (e.g. the active status tab).
export function AdminSearchForm({ basePath, query, placeholder, hidden = {} }: {
  basePath: string;
  query?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
}) {
  const kept = Object.entries(hidden).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const clearHref = kept.length ? `${basePath}?${new URLSearchParams(kept)}` : basePath;
  return (
    <form method="get" action={basePath} role="search" className="flex gap-2">
      {kept.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className="relative flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" type="search" defaultValue={query} maxLength={ADMIN_SEARCH_MAX_LENGTH} placeholder={placeholder} aria-label={placeholder} className="h-10 pl-9" />
      </div>
      <Button type="submit" variant="outline" className="h-10">Tìm</Button>
      {query ? <a href={clearHref} className={buttonVariants({ variant: 'ghost', className: 'h-10' })}>Xoá tìm</a> : null}
    </form>
  );
}
