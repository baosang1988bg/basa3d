import Link from 'next/link';
import { cn } from '@/lib/utils';

export type DashboardViewTab = 'catalog' | 'operations' | 'business';

interface TabItem {
  id: DashboardViewTab;
  label: string;
  href: string;
  ownerOnly?: boolean;
}

const TABS: TabItem[] = [
  { id: 'catalog', label: '📦 Mẫu in đang bán', href: '/basaadmin/dashboard' },
  { id: 'operations', label: '⚙️ Vận hành xưởng', href: '/basaadmin/dashboard?tab=operations' },
  { id: 'business', label: '📊 Doanh thu & Chi tiêu', href: '/basaadmin/dashboard?tab=business', ownerOnly: true },
];

/**
 * Tab switcher cho Dashboard xưởng BaSa3D.
 * Hỗ trợ chuyển đổi giữa Hub Mẫu In (mặc định), Vận hành xưởng (cho thợ/nhân viên/chủ xưởng),
 * và Doanh thu/Chi tiêu (chỉ dành cho OWNER theo ADR-0011 boundary #2).
 */
export function DashboardTabs({ active, isOwner = false }: { active: DashboardViewTab | string; isOwner?: boolean }) {
  const visibleTabs = TABS.filter((tab) => !tab.ownerOnly || isOwner);

  return (
    <nav aria-label="Chế độ xem dashboard" className="flex h-9 w-full items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1 sm:w-auto">
      {visibleTabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex h-full flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-all sm:flex-none',
              isActive
                ? 'bg-background text-foreground shadow-xs ring-1 ring-border'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
