import Link from 'next/link';
import type { DashboardTab } from '@/lib/executive-metrics';
import { cn } from '@/lib/utils';

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'business', label: 'Kinh doanh & Tài chính' },
  { id: 'operations', label: 'Vận hành xưởng' },
];

// Phase 41: OWNER-only switcher. Plain links (server-rendered, no client state) — switching tab is a
// navigation, and the page loads only the active tab's data. The page never renders this for STAFF.
export function DashboardTabs({ active }: { active: DashboardTab }) {
  return (
    <nav aria-label="Chế độ xem dashboard" className="flex h-8 w-full items-center gap-0.5 rounded-md border border-border/70 bg-muted/40 p-0.5 sm:w-auto">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/admin/dashboard?tab=${tab.id}`}
          aria-current={active === tab.id ? 'page' : undefined}
          className={cn(
            'flex h-full flex-1 items-center justify-center whitespace-nowrap rounded px-3 text-xs font-medium transition-colors sm:flex-none',
            active === tab.id ? 'bg-background text-foreground shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
