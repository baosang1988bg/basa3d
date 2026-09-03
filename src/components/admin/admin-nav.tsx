'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen, Boxes, Calculator, FileEdit, LayoutDashboard, Layers, Package, Printer,
  Receipt, ShieldAlert, ShoppingBag, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/auth/require-admin';

export interface AdminNavBadges {
  pendingOrders?: number;
  customRequestsOpen?: number;
  printJobsActive?: number;
}

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; ownerOnly?: boolean; badgeKey?: keyof AdminNavBadges }[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Sản phẩm', icon: Package },
  { href: '/admin/inventory', label: 'Tồn kho', icon: Boxes },
  { href: '/admin/materials', label: 'Kho nhựa', icon: Layers },
  { href: '/admin/orders', label: 'Đơn hàng', icon: ShoppingBag, badgeKey: 'pendingOrders' },
  { href: '/admin/custom-requests', label: 'Custom request', icon: FileEdit, badgeKey: 'customRequestsOpen' },
  { href: '/admin/print-jobs', label: 'Việc in', icon: Printer, badgeKey: 'printJobsActive' },
  { href: '/admin/blog', label: 'Blog', icon: BookOpen },
  { href: '/admin/staff', label: 'Nhân viên', icon: Users, ownerOnly: true },
  { href: '/admin/expenses', label: 'Chi tiêu', icon: Receipt, ownerOnly: true },
  { href: '/admin/settings/pricing', label: 'Cấu hình giá', icon: Calculator, ownerOnly: true },
  { href: '/admin/audit-logs', label: 'Nhật ký hệ thống', icon: ShieldAlert, ownerOnly: true },
];

export function AdminNav({ role, badges = {} }: { role: StaffRole; badges?: AdminNavBadges }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between border-r border-border bg-muted/40 p-4">
      <div className="flex flex-col gap-1">
        <p className="mb-2 px-2 text-xs font-medium uppercase text-muted-foreground">BaSa3D Admin</p>
        {NAV_ITEMS.filter((item) => !item.ownerOnly || role === 'OWNER').map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md border-l-2 px-2 py-1.5 text-sm ${
                isActive
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-transparent hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badgeCount ? (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 px-2">
        <p className="text-xs text-muted-foreground">Vai trò: {role}</p>
        <Button variant="outline" size="sm" onClick={handleLogout}>Đăng xuất</Button>
      </div>
    </nav>
  );
}
