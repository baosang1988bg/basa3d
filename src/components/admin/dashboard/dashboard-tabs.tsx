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
    <nav aria-label="Chế độ xem dashboard" className="flex w-full gap-1 rounded-lg border border-border bg-muted p-1 sm:w-auto">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/admin/dashboard?tab=${tab.id}`}
          aria-current={active === tab.id ? 'page' : undefined}
          className={cn(
            'flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors sm:flex-none',
            active === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
